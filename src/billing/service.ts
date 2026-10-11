import { prisma } from '../db/prisma';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any })
  : null;

export interface SubscriptionData {
  clientId: string;
  tier: 'DEVELOPER' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export class BillingService {
  static async createCustomer(clientId: string, email: string, name: string): Promise<string> {
    if (!stripe) throw new Error('Stripe not configured');

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { clientId },
    });

    return customer.id;
  }

  static async createSubscription(data: SubscriptionData): Promise<Stripe.Subscription | null> {
    if (!stripe) return null;

    const priceId = this.getPriceId(data.tier);
    if (!priceId) throw new Error(`No price ID for tier: ${data.tier}`);

    let customerId = data.stripeCustomerId;

    if (!customerId) {
      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client) throw new Error('Client not found');

      customerId = await this.createCustomer(data.clientId, client.email, client.name);
      if (customerId) {
        await prisma.client.update({
          where: { id: data.clientId },
          data: { stripeCustomerId: customerId },
        });
      }
    }

    if (!customerId) throw new Error('Failed to create customer');

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: { clientId: data.clientId, tier: data.tier },
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return subscription;
  }

  static async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    if (!stripe) return;
    await stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  static async updateSubscriptionTier(stripeSubscriptionId: string, newTier: string): Promise<Stripe.Subscription | null> {
    if (!stripe) return null;

    const priceId = this.getPriceId(newTier);
    if (!priceId) throw new Error(`No price ID for tier: ${newTier}`);

    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    });

    return updated;
  }

  static async handleWebhook(payload: Buffer, signature: string): Promise<{ processed: boolean; eventType: string }> {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return { processed: false, eventType: 'stripe_not_configured' };
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    // Store webhook event for audit
    const eventObject = event.data.object as any;
    await prisma.billingEvent.create({
      data: {
        clientId: eventObject.metadata?.clientId || 'unknown',
        stripeEventId: event.id,
        eventType: event.type,
        amount: eventObject.amount || null,
        currency: eventObject.currency || null,
        status: 'received',
        payload: eventObject as unknown as Prisma.InputJsonValue,
      },
    });

    // Handle specific events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.Invoice);
        break;
    }

    // Mark as processed
    await prisma.billingEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'processed', processedAt: new Date() },
    });

    return { processed: true, eventType: event.type };
  }

  private static async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const clientId = subscription.metadata.clientId;
    const tier = subscription.metadata.tier as string;

    if (!clientId || !tier) return;

    const status = subscription.status;
    const isActive = status === 'active' || status === 'trialing';

    await prisma.client.update({
      where: { id: clientId },
      data: {
        tier: isActive ? (tier as 'DEVELOPER' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') : 'DEVELOPER',
        monthlyQuota: isActive ? this.getTierQuota(tier) : this.getTierQuota('DEVELOPER'),
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  private static async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const clientId = subscription.metadata.clientId;
    if (!clientId) return;

    await prisma.client.update({
      where: { id: clientId },
      data: {
        tier: 'DEVELOPER',
        monthlyQuota: this.getTierQuota('DEVELOPER'),
        stripeSubscriptionId: null,
      },
    });
  }

  private static async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    // Payment succeeded - ensure subscription is active
    const subscriptionId = (invoice as any).subscription;
    if (subscriptionId) {
      const subscription = await stripe!.subscriptions.retrieve(subscriptionId as string);
      await this.handleSubscriptionChange(subscription);
    }
  }

  private static async handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    // Payment failed - could downgrade or notify
    console.warn(`Payment failed for invoice: ${invoice.id}`);
  }

  static getPriceId(tier: string): string | null {
    const priceIds: Record<string, string | undefined> = {
      DEVELOPER: process.env.STRIPE_PRICE_DEVELOPER,
      STARTER: process.env.STRIPE_PRICE_STARTER,
      PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL,
      ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
    };
    return priceIds[tier] || null;
  }

  static getTierQuota(tier: string): number {
    const quotas: Record<string, number> = {
      DEVELOPER: 1000,
      STARTER: 10000,
      PROFESSIONAL: 100000,
      ENTERPRISE: 1000000,
    };
    return quotas[tier] || quotas.DEVELOPER;
  }

  static async createCheckoutSession(clientId: string, tier: string, successUrl: string, cancelUrl: string): Promise<string | null> {
    if (!stripe) return null;

    const priceId = this.getPriceId(tier);
    if (!priceId) throw new Error(`No price ID for tier: ${tier}`);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');

    let customerId = client.stripeCustomerId;
    if (!customerId) {
      customerId = await this.createCustomer(clientId, client.email, client.name);
      if (customerId) {
        await prisma.client.update({
          where: { id: clientId },
          data: { stripeCustomerId: customerId },
        });
      }
    }

    if (!customerId) throw new Error('Failed to create customer');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { clientId, tier },
    });

    return session.url;
  }

  static async getBillingPortalUrl(clientId: string, returnUrl: string): Promise<string | null> {
    if (!stripe) return null;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client?.stripeCustomerId) return null;

    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }
}