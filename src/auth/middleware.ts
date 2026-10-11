import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthenticatedClient } from './index';

declare global {
  namespace Express {
    interface Request {
      client?: AuthenticatedClient;
      clientId?: string;
    }
  }
}

export function apiKeyAuth() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;

    if (!apiKey) {
      res.status(401).json({ error: 'API key required', code: 'MISSING_API_KEY' });
      return;
    }

    const client = await AuthService.authenticateApiKey(apiKey);

    if (!client) {
      res.status(401).json({ error: 'Invalid or expired API key', code: 'INVALID_API_KEY' });
      return;
    }

    req.client = client;
    req.clientId = client.id;
    next();
  };
}

export function jwtAuth() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Bearer token required', code: 'MISSING_TOKEN' });
      return;
    }

    const token = authHeader.substring(7);
    const client = await AuthService.authenticateJWT(token);

    if (!client) {
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
      return;
    }

    req.client = client;
    req.clientId = client.id;
    next();
  };
}

export function optionalAuth() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;
    const authHeader = req.headers.authorization;

    if (apiKey) {
      const client = await AuthService.authenticateApiKey(apiKey);
      if (client) {
        req.client = client;
        req.clientId = client.id;
      }
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const client = await AuthService.authenticateJWT(token);
      if (client) {
        req.client = client;
        req.clientId = client.id;
      }
    }

    next();
  };
}

export function requireTier(...allowedTiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.client) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedTiers.includes(req.client.tier)) {
      res.status(403).json({ error: 'Insufficient tier', required: allowedTiers });
      return;
    }

    next();
  };
}

export function quotaCheck() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.client) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.client.usedQuota >= req.client.monthlyQuota) {
      res.status(429).json({
        error: 'Monthly quota exceeded',
        code: 'QUOTA_EXCEEDED',
        quota: {
          used: req.client.usedQuota,
          limit: req.client.monthlyQuota,
          tier: req.client.tier,
        },
      });
      return;
    }

    next();
  };
}

export function usageTracking() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const start = Date.now();

    res.on('finish', async () => {
      if (req.clientId) {
        const latencyMs = Date.now() - start;
        await AuthService.incrementUsage(
          req.clientId!,
          req.path,
          req.method,
          res.statusCode,
          latencyMs,
          req.ip,
          req.headers['user-agent']
        );
      }
    });

    next();
  };
}