"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = require("../db/prisma");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const API_KEY_PREFIX = process.env.API_KEY_PREFIX || 'fusd_';
class AuthService {
    static async hashApiKey(apiKey) {
        return bcrypt.hash(apiKey, 12);
    }
    static async verifyApiKey(apiKey, hash) {
        return bcrypt.compare(apiKey, hash);
    }
    static generateApiKey() {
        const randomPart = (0, uuid_1.v4)().replace(/-/g, '').substring(0, 24);
        return `${API_KEY_PREFIX}${randomPart}`;
    }
    static generateJWT(payload) {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    }
    static verifyJWT(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        }
        catch {
            return null;
        }
    }
    static async authenticateApiKey(apiKey) {
        if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
            return null;
        }
        const client = await prisma_1.prisma.client.findFirst({
            where: {
                apiKey: apiKey,
                status: 'active',
            },
            include: {
                allowedTokens: true,
                webhooks: { where: { enabled: true } },
            },
        });
        if (!client)
            return null;
        const isValid = await this.verifyApiKey(apiKey, client.apiKeyHash);
        if (!isValid)
            return null;
        // Check quota
        if (client.usedQuota >= client.monthlyQuota) {
            return null; // Quota exceeded
        }
        return this.mapClientToAuth(client);
    }
    static async authenticateJWT(token) {
        const payload = this.verifyJWT(token);
        if (!payload)
            return null;
        const client = await prisma_1.prisma.client.findUnique({
            where: { id: payload.clientId },
            include: {
                allowedTokens: true,
                webhooks: { where: { enabled: true } },
            },
        });
        if (!client || client.status !== 'active')
            return null;
        return this.mapClientToAuth(client);
    }
    static mapClientToAuth(client) {
        return {
            id: client.id,
            name: client.name,
            email: client.email,
            tier: client.tier,
            monthlyQuota: client.monthlyQuota,
            usedQuota: client.usedQuota,
            allowedTokens: client.allowedTokens.map((t) => ({
                chainId: t.chainId,
                symbol: t.symbol,
                name: t.name,
                addresses: t.addresses,
                decimals: t.decimals,
                minHolders: t.minHolders,
                minTransfers: t.minTransfers,
                minAgeDays: t.minAgeDays,
            })),
            webhooks: client.webhooks.map((w) => ({
                id: w.id,
                url: w.url,
                events: w.events,
                secret: w.secret,
            })),
        };
    }
    static async incrementUsage(clientId, endpoint, method, statusCode, latencyMs, ipAddress, userAgent) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.client.update({
                where: { id: clientId },
                data: { usedQuota: { increment: 1 }, lastActiveAt: new Date() },
            }),
            prisma_1.prisma.usageLog.create({
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
    static async rotateApiKey(clientId, rotatedBy) {
        const newApiKey = this.generateApiKey();
        const newHash = await this.hashApiKey(newApiKey);
        const client = await prisma_1.prisma.client.findUnique({ where: { id: clientId } });
        if (!client)
            throw new Error('Client not found');
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.client.update({
                where: { id: clientId },
                data: { apiKey: newApiKey, apiKeyHash: newHash },
            }),
            prisma_1.prisma.apiKeyRotation.create({
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
    static getTierQuota(tier) {
        const quotas = {
            DEVELOPER: parseInt(process.env.QUOTA_DEVELOPER || '1000'),
            STARTER: parseInt(process.env.QUOTA_STARTER || '10000'),
            PROFESSIONAL: parseInt(process.env.QUOTA_PROFESSIONAL || '100000'),
            ENTERPRISE: parseInt(process.env.QUOTA_ENTERPRISE || '1000000'),
        };
        return quotas[tier] || quotas.DEVELOPER;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=index.js.map