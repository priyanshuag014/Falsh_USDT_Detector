"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service_1 = require("../billing/service");
const router = (0, express_1.Router)();
// Stripe webhooks need raw body
router.post('/webhooks/stripe', async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        const payload = req.body; // Raw body from express.raw()
        if (!signature) {
            res.status(400).json({ error: 'Missing stripe-signature header' });
            return;
        }
        const result = await service_1.BillingService.handleWebhook(payload, signature);
        res.json(result);
    }
    catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=webhookRoutes.js.map