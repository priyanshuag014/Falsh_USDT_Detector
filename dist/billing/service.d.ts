import Stripe from 'stripe';
export interface SubscriptionData {
    clientId: string;
    tier: 'DEVELOPER' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}
export declare class BillingService {
    static createCustomer(clientId: string, email: string, name: string): Promise<string>;
    static createSubscription(data: SubscriptionData): Promise<Stripe.Subscription | null>;
    static cancelSubscription(stripeSubscriptionId: string): Promise<void>;
    static updateSubscriptionTier(stripeSubscriptionId: string, newTier: string): Promise<Stripe.Subscription | null>;
    static handleWebhook(payload: Buffer, signature: string): Promise<{
        processed: boolean;
        eventType: string;
    }>;
    private static handleSubscriptionChange;
    private static handleSubscriptionCancellation;
    private static handlePaymentSuccess;
    private static handlePaymentFailure;
    static getPriceId(tier: string): string | null;
    static getTierQuota(tier: string): number;
    static createCheckoutSession(clientId: string, tier: string, successUrl: string, cancelUrl: string): Promise<string | null>;
    static getBillingPortalUrl(clientId: string, returnUrl: string): Promise<string | null>;
}
//# sourceMappingURL=service.d.ts.map