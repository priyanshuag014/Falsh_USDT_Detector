"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service_1 = require("../tenant/service");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
// All admin routes require authentication
router.use((0, middleware_1.apiKeyAuth)());
router.use((0, middleware_1.usageTracking)());
router.use((0, middleware_1.quotaCheck)());
// ============================================
// CLIENT MANAGEMENT (requires PROFESSIONAL+ tier)
// ============================================
router.post('/admin/clients', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    try {
        const client = await service_1.TenantService.createClient(req.body);
        res.status(201).json(client);
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Email already exists' });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
router.get('/admin/clients', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = req.query.search;
    const result = await service_1.TenantService.listClients(page, limit, search);
    res.json(result);
});
router.get('/admin/clients/:id', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const client = await service_1.TenantService.getClient(req.params.id);
    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }
    res.json(client);
});
router.patch('/admin/clients/:id', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const client = await service_1.TenantService.updateClient(req.params.id, req.body);
    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }
    res.json(client);
});
router.delete('/admin/clients/:id', (0, middleware_1.requireTier)('ENTERPRISE'), async (req, res) => {
    await service_1.TenantService.deleteClient(req.params.id);
    res.status(204).send();
});
router.post('/admin/clients/:id/rotate-key', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const newApiKey = await service_1.TenantService.rotateApiKey(req.params.id);
    res.json({ apiKey: newApiKey });
});
// ============================================
// TOKEN MANAGEMENT
// ============================================
router.post('/admin/clients/:clientId/tokens', async (req, res) => {
    // Verify client ownership
    if (req.client.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client.tier)) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    try {
        const token = await service_1.TenantService.addToken(req.params.clientId, req.body);
        res.status(201).json(token);
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Token already exists for this chain/symbol' });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
router.patch('/admin/tokens/:tokenId', async (req, res) => {
    const token = await service_1.TenantService.updateToken(req.params.tokenId, req.body);
    if (!token) {
        res.status(404).json({ error: 'Token not found' });
        return;
    }
    res.json(token);
});
router.delete('/admin/tokens/:tokenId', async (req, res) => {
    await service_1.TenantService.deleteToken(req.params.tokenId);
    res.status(204).send();
});
// ============================================
// WEBHOOK MANAGEMENT
// ============================================
router.post('/admin/clients/:clientId/webhooks', async (req, res) => {
    if (req.client.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client.tier)) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    const webhook = await service_1.TenantService.addWebhook(req.params.clientId, req.body);
    res.status(201).json(webhook);
});
router.patch('/admin/webhooks/:webhookId', async (req, res) => {
    const webhook = await service_1.TenantService.updateWebhook(req.params.webhookId, req.body);
    if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
    }
    res.json(webhook);
});
router.delete('/admin/webhooks/:webhookId', async (req, res) => {
    await service_1.TenantService.deleteWebhook(req.params.webhookId);
    res.status(204).send();
});
// ============================================
// ANALYTICS & USAGE
// ============================================
router.get('/admin/clients/:clientId/stats', async (req, res) => {
    if (req.client.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client.tier)) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    const stats = await service_1.TenantService.getClientStats(req.params.clientId);
    res.json(stats);
});
router.get('/admin/clients/:clientId/usage', async (req, res) => {
    if (req.client.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client.tier)) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    const days = parseInt(req.query.days) || 30;
    const usage = await service_1.TenantService.getClientUsage(req.params.clientId, days);
    res.json(usage);
});
// ============================================
// SELF-SERVICE ENDPOINTS (for clients)
// ============================================
router.get('/me', async (req, res) => {
    const client = await service_1.TenantService.getClient(req.client.id);
    res.json(client);
});
router.get('/me/stats', async (req, res) => {
    const stats = await service_1.TenantService.getClientStats(req.client.id);
    res.json(stats);
});
router.get('/me/usage', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const usage = await service_1.TenantService.getClientUsage(req.client.id, days);
    res.json(usage);
});
router.get('/me/tokens', async (req, res) => {
    const client = await service_1.TenantService.getClient(req.client.id);
    res.json(client?.allowedTokens || []);
});
router.post('/me/tokens', async (req, res) => {
    const token = await service_1.TenantService.addToken(req.client.id, req.body);
    res.status(201).json(token);
});
router.get('/me/webhooks', async (req, res) => {
    const client = await service_1.TenantService.getClient(req.client.id);
    res.json(client?.webhooks || []);
});
router.post('/me/webhooks', async (req, res) => {
    const webhook = await service_1.TenantService.addWebhook(req.client.id, req.body);
    res.status(201).json(webhook);
});
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map