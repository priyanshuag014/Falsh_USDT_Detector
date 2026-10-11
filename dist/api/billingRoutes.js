"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service_1 = require("../billing/service");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
router.use((0, middleware_1.apiKeyAuth)());
router.use((0, middleware_1.usageTracking)());
// Create checkout session for tier upgrade
router.post('/billing/checkout', (0, middleware_1.quotaCheck)(), async (req, res) => {
    try {
        const { tier, successUrl, cancelUrl } = req.body;
        if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(tier)) {
            res.status(400).json({ error: 'Invalid tier' });
            return;
        }
        const url = await service_1.BillingService.createCheckoutSession(req.client.id, tier, successUrl || `${process.env.FRONTEND_URL}/billing/success`, cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`);
        if (!url) {
            res.status(503).json({ error: 'Billing not configured' });
            return;
        }
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get billing portal URL
router.post('/billing/portal', async (req, res) => {
    try {
        const { returnUrl } = req.body;
        const url = await service_1.BillingService.getBillingPortalUrl(req.client.id, returnUrl || `${process.env.FRONTEND_URL}/dashboard`);
        if (!url) {
            res.status(503).json({ error: 'Billing not configured or no subscription' });
            return;
        }
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get current subscription status
router.get('/billing/status', async (req, res) => {
    res.json({
        tier: req.client.tier,
        monthlyQuota: req.client.monthlyQuota,
        usedQuota: req.client.usedQuota,
        quotaRemaining: req.client.monthlyQuota - req.client.usedQuota,
    });
});
// Admin: Get all billing events
router.get('/admin/billing/events', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    // This would query the billing events table
    res.json({ message: 'Admin billing events endpoint' });
});
exports.default = router;
//# sourceMappingURL=billingRoutes.js.map