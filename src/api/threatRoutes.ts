import { Router, Request, Response } from 'express';
import { ThreatIntelService } from '../threat-intel/service';
import { apiKeyAuth, requireTier, quotaCheck, usageTracking } from '../auth/middleware';

const router = Router();

router.use(apiKeyAuth());
router.use(usageTracking());
router.use(quotaCheck());

// Get global threat intelligence (PROFESSIONAL+)
router.get('/threats', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const minRiskScore = parseInt(req.query.minRiskScore as string) || 70;

    const result = await ThreatIntelService.getGlobalThreats(limit, offset, minRiskScore);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch threats' });
  }
});

// Get threat details
router.get('/threats/:threatId', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const threat = await ThreatIntelService.getThreatDetails(req.params.threatId);
  if (!threat) {
    res.status(404).json({ error: 'Threat not found' });
    return;
  }
  res.json(threat);
});

// Mark threat as false positive
router.post('/threats/:threatId/false-positive', async (req: Request, res: Response) => {
  const success = await ThreatIntelService.markFalsePositive(req.params.threatId, req.client!.id);
  if (!success) {
    res.status(404).json({ error: 'Threat not found or not authorized' });
    return;
  }
  res.json({ success: true });
});

// Resolve threat
router.post('/threats/:threatId/resolve', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const success = await ThreatIntelService.resolveThreat(req.params.threatId);
  if (!success) {
    res.status(404).json({ error: 'Threat not found' });
    return;
  }
  res.json({ success: true });
});

// Get client's threat history
router.get('/my-threats', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const threats = await ThreatIntelService.getClientThreatHistory(req.client!.id, limit);
  res.json(threats);
});

// Get threat statistics (admin)
router.get('/threat-stats', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const stats = await ThreatIntelService.getThreatStats();
  res.json(stats);
});

export default router;