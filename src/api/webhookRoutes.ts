import { Router, Request, Response } from 'express';
import { BillingService } from '../billing/service';

const router = Router();

// Stripe webhooks need raw body
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const payload = req.body; // Raw body from express.raw()

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    const result = await BillingService.handleWebhook(payload, signature);
    res.json(result);
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;