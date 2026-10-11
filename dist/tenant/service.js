"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const prisma_1 = require("../db/prisma");
const auth_1 = require("../auth");
class TenantService {
    static async createClient(input) {
        const apiKey = auth_1.AuthService.generateApiKey();
        const apiKeyHash = await auth_1.AuthService.hashApiKey(apiKey);
        const tier = input.tier || 'DEVELOPER';
        const monthlyQuota = auth_1.AuthService.getTierQuota(tier);
        const client = await prisma_1.prisma.client.create({
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
                        events: w.events,
                        secret: auth_1.AuthService.generateApiKey().substring(0, 32),
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
    static async getClient(clientId) {
        const client = await prisma_1.prisma.client.findUnique({
            where: { id: clientId },
            include: {
                allowedTokens: true,
                webhooks: true,
            },
        });
        if (!client)
            return null;
        return this.mapClientResponse(client);
    }
    static async listClients(page = 1, limit = 20, search) {
        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ],
        } : {};
        const [clients, total] = await Promise.all([
            prisma_1.prisma.client.findMany({
                where,
                include: { allowedTokens: true, webhooks: true },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.client.count({ where }),
        ]);
        return {
            clients: clients.map((c) => this.mapClientResponse(c)),
            total,
        };
    }
    static async updateClient(clientId, data) {
        const client = await prisma_1.prisma.client.update({
            where: { id: clientId },
            data: {
                name: data.name,
                email: data.email,
                tier: data.tier,
                monthlyQuota: data.tier ? auth_1.AuthService.getTierQuota(data.tier) : undefined,
            },
            include: { allowedTokens: true, webhooks: true },
        });
        return this.mapClientResponse(client);
    }
    static async deleteClient(clientId) {
        await prisma_1.prisma.client.delete({ where: { id: clientId } });
        return true;
    }
    static async rotateApiKey(clientId) {
        return auth_1.AuthService.rotateApiKey(clientId);
    }
    static async addToken(clientId, input) {
        const token = await prisma_1.prisma.allowedToken.create({
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
    static async updateToken(tokenId, input) {
        const token = await prisma_1.prisma.allowedToken.update({
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
    static async deleteToken(tokenId) {
        await prisma_1.prisma.allowedToken.delete({ where: { id: tokenId } });
        return true;
    }
    static async addWebhook(clientId, input) {
        const webhook = await prisma_1.prisma.webhookConfig.create({
            data: {
                clientId,
                url: input.url,
                events: input.events,
                secret: auth_1.AuthService.generateApiKey().substring(0, 32),
            },
        });
        return this.mapWebhookResponse(webhook);
    }
    static async updateWebhook(webhookId, data) {
        const webhook = await prisma_1.prisma.webhookConfig.update({
            where: { id: webhookId },
            data: {
                url: data.url,
                events: data.events,
                enabled: data.enabled,
            },
        });
        return this.mapWebhookResponse(webhook);
    }
    static async deleteWebhook(webhookId) {
        await prisma_1.prisma.webhookConfig.delete({ where: { id: webhookId } });
        return true;
    }
    static async getClientUsage(clientId, days = 30) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return prisma_1.prisma.usageLog.findMany({
            where: {
                clientId,
                createdAt: { gte: since },
            },
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });
    }
    static async getClientStats(clientId) {
        const [totalChecks, threatsDetected, avgLatency] = await Promise.all([
            prisma_1.prisma.usageLog.count({ where: { clientId } }),
            prisma_1.prisma.threatReport.count({ where: { clientId } }),
            prisma_1.prisma.usageLog.aggregate({
                where: { clientId },
                _avg: { latencyMs: true },
            }),
        ]);
        const client = await prisma_1.prisma.client.findUnique({ where: { id: clientId } });
        return {
            totalChecks,
            threatsDetected,
            avgLatencyMs: avgLatency._avg.latencyMs || 0,
            quotaUsed: client?.usedQuota || 0,
            quotaLimit: client?.monthlyQuota || 0,
            quotaRemaining: (client?.monthlyQuota || 0) - (client?.usedQuota || 0),
        };
    }
    static mapClientResponse(client, apiKey) {
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
    static mapTokenResponse(token) {
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
    static mapWebhookResponse(webhook) {
        return {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            enabled: webhook.enabled,
        };
    }
}
exports.TenantService = TenantService;
//# sourceMappingURL=service.js.map