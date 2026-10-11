import { Router, Request, Response } from 'express';
import { TenantService } from '../tenant/service';
import { apiKeyAuth, requireTier, quotaCheck, usageTracking } from '../auth/middleware';

const router = Router();

// All admin routes require authentication
router.use(apiKeyAuth());
router.use(usageTracking());
router.use(quotaCheck());

// ============================================
// CLIENT MANAGEMENT (requires PROFESSIONAL+ tier)
// ============================================

router.post('/admin/clients', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  try {
    const client = await TenantService.createClient(req.body);
    res.status(201).json(client);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/admin/clients', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = req.query.search as string;

  const result = await TenantService.listClients(page, limit, search);
  res.json(result);
});

router.get('/admin/clients/:id', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const client = await TenantService.getClient(req.params.id);
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  res.json(client);
});

router.patch('/admin/clients/:id', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const client = await TenantService.updateClient(req.params.id, req.body);
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  res.json(client);
});

router.delete('/admin/clients/:id', requireTier('ENTERPRISE'), async (req: Request, res: Response) => {
  await TenantService.deleteClient(req.params.id);
  res.status(204).send();
});

router.post('/admin/clients/:id/rotate-key', requireTier('PROFESSIONAL', 'ENTERPRISE'), async (req: Request, res: Response) => {
  const newApiKey = await TenantService.rotateApiKey(req.params.id);
  res.json({ apiKey: newApiKey });
});

// ============================================
// TOKEN MANAGEMENT
// ============================================

router.post('/admin/clients/:clientId/tokens', async (req: Request, res: Response) => {
  // Verify client ownership
  if (req.client!.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client!.tier)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    const token = await TenantService.addToken(req.params.clientId, req.body);
    res.status(201).json(token);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Token already exists for this chain/symbol' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.patch('/admin/tokens/:tokenId', async (req: Request, res: Response) => {
  const token = await TenantService.updateToken(req.params.tokenId, req.body);
  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }
  res.json(token);
});

router.delete('/admin/tokens/:tokenId', async (req: Request, res: Response) => {
  await TenantService.deleteToken(req.params.tokenId);
  res.status(204).send();
});

// ============================================
// WEBHOOK MANAGEMENT
// ============================================

router.post('/admin/clients/:clientId/webhooks', async (req: Request, res: Response) => {
  if (req.client!.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client!.tier)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const webhook = await TenantService.addWebhook(req.params.clientId, req.body);
  res.status(201).json(webhook);
});

router.patch('/admin/webhooks/:webhookId', async (req: Request, res: Response) => {
  const webhook = await TenantService.updateWebhook(req.params.webhookId, req.body);
  if (!webhook) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  res.json(webhook);
});

router.delete('/admin/webhooks/:webhookId', async (req: Request, res: Response) => {
  await TenantService.deleteWebhook(req.params.webhookId);
  res.status(204).send();
});

// ============================================
// ANALYTICS & USAGE
// ============================================

router.get('/admin/clients/:clientId/stats', async (req: Request, res: Response) => {
  if (req.client!.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client!.tier)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const stats = await TenantService.getClientStats(req.params.clientId);
  res.json(stats);
});

router.get('/admin/clients/:clientId/usage', async (req: Request, res: Response) => {
  if (req.client!.id !== req.params.clientId && !['PROFESSIONAL', 'ENTERPRISE'].includes(req.client!.tier)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const days = parseInt(req.query.days as string) || 30;
  const usage = await TenantService.getClientUsage(req.params.clientId, days);
  res.json(usage);
});

// ============================================
// SELF-SERVICE ENDPOINTS (for clients)
// ============================================

router.get('/me', async (req: Request, res: Response) => {
  const client = await TenantService.getClient(req.client!.id);
  res.json(client);
});

router.get('/me/stats', async (req: Request, res: Response) => {
  const stats = await TenantService.getClientStats(req.client!.id);
  res.json(stats);
});

router.get('/me/usage', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const usage = await TenantService.getClientUsage(req.client!.id, days);
  res.json(usage);
});

router.get('/me/tokens', async (req: Request, res: Response) => {
  const client = await TenantService.getClient(req.client!.id);
  res.json(client?.allowedTokens || []);
});

router.post('/me/tokens', async (req: Request, res: Response) => {
  const token = await TenantService.addToken(req.client!.id, req.body);
  res.status(201).json(token);
});

router.get('/me/webhooks', async (req: Request, res: Response) => {
  const client = await TenantService.getClient(req.client!.id);
  res.json(client?.webhooks || []);
});

router.post('/me/webhooks', async (req: Request, res: Response) => {
  const webhook = await TenantService.addWebhook(req.client!.id, req.body);
  res.status(201).json(webhook);
});

export default router;