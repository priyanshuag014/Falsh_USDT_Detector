import { Router, Request, Response } from 'express';
import { BillingService } from '../billing/service';
import { apiKeyAuth, requireTier, quotaCheck, usageTracking } from '../auth/middleware';

const router = Router();

router.use(apiKeyAuth());
router.use(usageTracking());

// Create checkout session for tier upgrade
router.post('/billing/checkout', quotaCheck(), async (req: Request, res: Response) => {
  try {
    const { tier, successUrl, cancelUrl } = req.body;

    if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(tier)) {
      res.status(400).json({ error: 'Invalid tier' });
      return;
    }

    const url = await BillingService.createCheckoutSession(
      req.client!.id,
      tier,
      successUrl || `${process.env.FRONTEND_URL}/billing/success`,
      cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`
    );

    if (!url) {
      res.status(503).json({ error: 'Billing not configured' });
      return;
    }

    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get billing portal URL
router.post('/billing/portal', async (req: Request, res: Response) => {
  try {
    const { returnUrl } = req.body;

    const url = await BillingService.getBillingPortalUrl(
      req.client!.id,
      returnUrl || `${process.env.FRONTEND_URL}/dashboard`
    );

    if (!url) {
      res.status(503).json({ error: 'Billing not configured or no subscription' });
      return;
    }

    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current subscription status
router.get('/billing/status', async (req: Request, res: Response) => {
  res.json({
    tier: req.client!.tier,
    monthlyQuota: req.client!.monthlyQuota,
    usedQuota: req.client!.usedQuota,
    quotaRemaining: req.client!.monthlyQuota - req.client!.usedQuota,
  });
});

// Admin: Get all billing events
router.get('/admin/billing/events', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  // This would query the billing events table
  res.json({ message: 'Admin billing events endpoint' });
});

export default router;