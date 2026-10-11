import { prisma } from '../db/prisma';
import { AuthService } from '../auth';
import { WebhookEvent } from '@prisma/client';

export interface CreateClientInput {
  name: string;
  email: string;
  tier?: 'DEVELOPER' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  tokens?: CreateTokenInput[];
  webhooks?: CreateWebhookInput[];
}

export interface CreateTokenInput {
  chainId: number;
  symbol: string;
  name: string;
  addresses: string[];
  decimals: number;
  minHolders?: number;
  minTransfers?: number;
  minAgeDays?: number;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
}

export interface ClientResponse {
  id: string;
  name: string;
  email: string;
  tier: string;
  apiKey: string;
  monthlyQuota: number;
  usedQuota: number;
  status: string;
  allowedTokens: TokenResponse[];
  webhooks: WebhookResponse[];
  createdAt: Date;
}

export interface TokenResponse {
  id: string;
  chainId: number;
  symbol: string;
  name: string;
  addresses: string[];
  decimals: number;
  minHolders: number;
  minTransfers: number;
  minAgeDays: number;
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
}

export class TenantService {
  static async createClient(input: CreateClientInput): Promise<ClientResponse> {
    const apiKey = AuthService.generateApiKey();
    const apiKeyHash = await AuthService.hashApiKey(apiKey);
    const tier = input.tier || 'DEVELOPER';
    const monthlyQuota = AuthService.getTierQuota(tier);

    const client = await prisma.client.create({
      data: {
        name: input.name,
        email: input.email,
        apiKey,
        apiKeyHash,
        tier,
        monthlyQuota,
        allowedTokens: {
          create: input.tokens?.map(t => ({
            chainId: t.chainId,
            symbol: t.symbol.toUpperCase(),
            name: t.name,
            addresses: t.addresses.map(a => a.toLowerCase()),
            decimals: t.decimals,
            minHolders: t.minHolders || 1000,
            minTransfers: t.minTransfers || 100,
            minAgeDays: t.minAgeDays || 30,
          })) || [],
        },
        webhooks: {
          create: input.webhooks?.map(w => ({
            url: w.url,
            events: w.events as WebhookEvent[],
            secret: AuthService.generateApiKey().substring(0, 32),
          })) || [],
        },
      },
      include: {
        allowedTokens: true,
        webhooks: true,
      },
    });

    return this.mapClientResponse(client, apiKey);
  }

  static async getClient(clientId: string): Promise<ClientResponse | null> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        allowedTokens: true,
        webhooks: true,
      },
    });

    if (!client) return null;

    return this.mapClientResponse(client);
  }

  static async listClients(page = 1, limit = 20, search?: string): Promise<{ clients: ClientResponse[]; total: number }> {
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { allowedTokens: true, webhooks: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    return {
      clients: clients.map((c: any) => this.mapClientResponse(c)),
      total,
    };
  }

  static async updateClient(clientId: string, data: Partial<CreateClientInput>): Promise<ClientResponse | null> {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        name: data.name,
        email: data.email,
        tier: data.tier,
        monthlyQuota: data.tier ? AuthService.getTierQuota(data.tier) : undefined,
      },
      include: { allowedTokens: true, webhooks: true },
    });

    return this.mapClientResponse(client);
  }

  static async deleteClient(clientId: string): Promise<boolean> {
    await prisma.client.delete({ where: { id: clientId } });
    return true;
  }

  static async rotateApiKey(clientId: string): Promise<string> {
    return AuthService.rotateApiKey(clientId);
  }

  static async addToken(clientId: string, input: CreateTokenInput): Promise<TokenResponse> {
    const token = await prisma.allowedToken.create({
      data: {
        clientId,
        chainId: input.chainId,
        symbol: input.symbol.toUpperCase(),
        name: input.name,
        addresses: input.addresses.map(a => a.toLowerCase()),
        decimals: input.decimals,
        minHolders: input.minHolders || 1000,
        minTransfers: input.minTransfers || 100,
        minAgeDays: input.minAgeDays || 30,
      },
    });

    return this.mapTokenResponse(token);
  }

  static async updateToken(tokenId: string, input: Partial<CreateTokenInput>): Promise<TokenResponse | null> {
    const token = await prisma.allowedToken.update({
      where: { id: tokenId },
      data: {
        chainId: input.chainId,
        symbol: input.symbol?.toUpperCase(),
        name: input.name,
        addresses: input.addresses?.map(a => a.toLowerCase()),
        decimals: input.decimals,
        minHolders: input.minHolders,
        minTransfers: input.minTransfers,
        minAgeDays: input.minAgeDays,
      },
    });

    return this.mapTokenResponse(token);
  }

  static async deleteToken(tokenId: string): Promise<boolean> {
    await prisma.allowedToken.delete({ where: { id: tokenId } });
    return true;
  }

  static async addWebhook(clientId: string, input: CreateWebhookInput): Promise<WebhookResponse> {
    const webhook = await prisma.webhookConfig.create({
      data: {
        clientId,
        url: input.url,
        events: input.events as WebhookEvent[],
        secret: AuthService.generateApiKey().substring(0, 32),
      },
    });

    return this.mapWebhookResponse(webhook);
  }

  static async updateWebhook(webhookId: string, data: Partial<CreateWebhookInput> & { enabled?: boolean }): Promise<WebhookResponse | null> {
    const webhook = await prisma.webhookConfig.update({
      where: { id: webhookId },
      data: {
        url: data.url,
        events: data.events as WebhookEvent[] | undefined,
        enabled: data.enabled,
      },
    });

    return this.mapWebhookResponse(webhook);
  }

  static async deleteWebhook(webhookId: string): Promise<boolean> {
    await prisma.webhookConfig.delete({ where: { id: webhookId } });
    return true;
  }

  static async getClientUsage(clientId: string, days = 30): Promise<any[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return prisma.usageLog.findMany({
      where: {
        clientId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  static async getClientStats(clientId: string): Promise<any> {
    const [totalChecks, threatsDetected, avgLatency] = await Promise.all([
      prisma.usageLog.count({ where: { clientId } }),
      prisma.threatReport.count({ where: { clientId } }),
      prisma.usageLog.aggregate({
        where: { clientId },
        _avg: { latencyMs: true },
      }),
    ]);

    const client = await prisma.client.findUnique({ where: { id: clientId } });

    return {
      totalChecks,
      threatsDetected,
      avgLatencyMs: avgLatency._avg.latencyMs || 0,
      quotaUsed: client?.usedQuota || 0,
      quotaLimit: client?.monthlyQuota || 0,
      quotaRemaining: (client?.monthlyQuota || 0) - (client?.usedQuota || 0),
    };
  }

  private static mapClientResponse(client: any, apiKey?: string): ClientResponse {
    return {
      id: client.id,
      name: client.name,
      email: client.email,
      tier: client.tier,
      apiKey: apiKey || '***hidden***',
      monthlyQuota: client.monthlyQuota,
      usedQuota: client.usedQuota,
      status: client.status,
      allowedTokens: client.allowedTokens.map(this.mapTokenResponse),
      webhooks: client.webhooks.map(this.mapWebhookResponse),
      createdAt: client.createdAt,
    };
  }

  private static mapTokenResponse(token: any): TokenResponse {
    return {
      id: token.id,
      chainId: token.chainId,
      symbol: token.symbol,
      name: token.name,
      addresses: token.addresses,
      decimals: token.decimals,
      minHolders: token.minHolders,
      minTransfers: token.minTransfers,
      minAgeDays: token.minAgeDays,
    };
  }

  private static mapWebhookResponse(webhook: any): WebhookResponse {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
    };
  }
}