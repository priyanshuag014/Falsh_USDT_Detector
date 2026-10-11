import { prisma } from '../db/prisma';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const API_KEY_PREFIX = process.env.API_KEY_PREFIX || 'fusd_';

export interface JWTPayload {
  clientId: string;
  email: string;
  tier: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedClient {
  id: string;
  name: string;
  email: string;
  tier: string;
  monthlyQuota: number;
  usedQuota: number;
  allowedTokens: AllowedTokenConfig[];
  webhooks: WebhookConfig[];
}

export interface AllowedTokenConfig {
  chainId: number;
  symbol: string;
  name: string;
  addresses: string[];
  decimals: number;
  minHolders: number;
  minTransfers: number;
  minAgeDays: number;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
}

export class AuthService {
  static async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, 12);
  }

  static async verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hash);
  }

  static generateApiKey(): string {
    const randomPart = uuidv4().replace(/-/g, '').substring(0, 24);
    return `${API_KEY_PREFIX}${randomPart}`;
  }

  static generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  }

  static verifyJWT(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return null;
    }
  }

  static async authenticateApiKey(apiKey: string): Promise<AuthenticatedClient | null> {
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    const client = await prisma.client.findFirst({
      where: {
        apiKey: apiKey,
        status: 'active',
      },
      include: {
        allowedTokens: true,
        webhooks: { where: { enabled: true } },
      },
    });

    if (!client) return null;

    const isValid = await this.verifyApiKey(apiKey, client.apiKeyHash);
    if (!isValid) return null;

    // Check quota
    if (client.usedQuota >= client.monthlyQuota) {
      return null; // Quota exceeded
    }

    return this.mapClientToAuth(client);
  }

  static async authenticateJWT(token: string): Promise<AuthenticatedClient | null> {
    const payload = this.verifyJWT(token);
    if (!payload) return null;

    const client = await prisma.client.findUnique({
      where: { id: payload.clientId },
      include: {
        allowedTokens: true,
        webhooks: { where: { enabled: true } },
      },
    });

    if (!client || client.status !== 'active') return null;

    return this.mapClientToAuth(client);
  }

  private static mapClientToAuth(client: any): AuthenticatedClient {
    return {
      id: client.id,
      name: client.name,
      email: client.email,
      tier: client.tier,
      monthlyQuota: client.monthlyQuota,
      usedQuota: client.usedQuota,
      allowedTokens: client.allowedTokens.map((t: any) => ({
        chainId: t.chainId,
        symbol: t.symbol,
        name: t.name,
        addresses: t.addresses,
        decimals: t.decimals,
        minHolders: t.minHolders,
        minTransfers: t.minTransfers,
        minAgeDays: t.minAgeDays,
      })),
      webhooks: client.webhooks.map((w: any) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        secret: w.secret,
      })),
    };
  }

  static async incrementUsage(clientId: string, endpoint: string, method: string, statusCode: number, latencyMs: number, ipAddress?: string, userAgent?: string): Promise<void> {
    await prisma.$transaction([
      prisma.client.update({
        where: { id: clientId },
        data: { usedQuota: { increment: 1 }, lastActiveAt: new Date() },
      }),
      prisma.usageLog.create({
        data: {
          clientId,
          endpoint,
          method,
          statusCode,
          latencyMs,
          ipAddress,
          userAgent,
        },
      }),
    ]);
  }

  static async rotateApiKey(clientId: string, rotatedBy?: string): Promise<string> {
    const newApiKey = this.generateApiKey();
    const newHash = await this.hashApiKey(newApiKey);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Client not found');

    await prisma.$transaction([
      prisma.client.update({
        where: { id: clientId },
        data: { apiKey: newApiKey, apiKeyHash: newHash },
      }),
      prisma.apiKeyRotation.create({
        data: {
          clientId,
          oldKeyHash: client.apiKeyHash,
          newKeyHash: newHash,
          rotatedBy,
        },
      }),
    ]);

    return newApiKey;
  }

  static getTierQuota(tier: string): number {
    const quotas: Record<string, number> = {
      DEVELOPER: parseInt(process.env.QUOTA_DEVELOPER || '1000'),
      STARTER: parseInt(process.env.QUOTA_STARTER || '10000'),
      PROFESSIONAL: parseInt(process.env.QUOTA_PROFESSIONAL || '100000'),
      ENTERPRISE: parseInt(process.env.QUOTA_ENTERPRISE || '1000000'),
    };
    return quotas[tier] || quotas.DEVELOPER;
  }
}