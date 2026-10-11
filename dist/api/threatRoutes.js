"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service_1 = require("../threat-intel/service");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
router.use((0, middleware_1.apiKeyAuth)());
router.use((0, middleware_1.usageTracking)());
router.use((0, middleware_1.quotaCheck)());
// Get global threat intelligence (PROFESSIONAL+)
router.get('/threats', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const offset = parseInt(req.query.offset) || 0;
        const minRiskScore = parseInt(req.query.minRiskScore) || 70;
        const result = await service_1.ThreatIntelService.getGlobalThreats(limit, offset, minRiskScore);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch threats' });
    }
});
// Get threat details
router.get('/threats/:threatId', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const threat = await service_1.ThreatIntelService.getThreatDetails(req.params.threatId);
    if (!threat) {
        res.status(404).json({ error: 'Threat not found' });
        return;
    }
    res.json(threat);
});
// Mark threat as false positive
router.post('/threats/:threatId/false-positive', async (req, res) => {
    const success = await service_1.ThreatIntelService.markFalsePositive(req.params.threatId, req.client.id);
    if (!success) {
        res.status(404).json({ error: 'Threat not found or not authorized' });
        return;
    }
    res.json({ success: true });
});
// Resolve threat
router.post('/threats/:threatId/resolve', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const success = await service_1.ThreatIntelService.resolveThreat(req.params.threatId);
    if (!success) {
        res.status(404).json({ error: 'Threat not found' });
        return;
    }
    res.json({ success: true });
});
// Get client's threat history
router.get('/my-threats', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const threats = await service_1.ThreatIntelService.getClientThreatHistory(req.client.id, limit);
    res.json(threats);
});
// Get threat statistics (admin)
router.get('/threat-stats', (0, middleware_1.requireTier)('PROFESSIONAL', 'ENTERPRISE'), async (req, res) => {
    const stats = await service_1.ThreatIntelService.getThreatStats();
    res.json(stats);
});
exports.default = router;
//# sourceMappingURL=threatRoutes.js.map