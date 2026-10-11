"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreatIntelService = void 0;
const prisma_1 = require("../db/prisma");
class ThreatIntelService {
    static CACHE_TTL = 300000; // 5 minutes
    static cache = new Map();
    static async reportThreat(clientId, detection) {
        const address = detection.tokenAddress.toLowerCase();
        const chainId = detection.chainId;
        // Check if threat already exists
        let threatRecord = await prisma_1.prisma.threatRecord.findUnique({
            where: { address_chainId: { address, chainId } },
        });
        let isNew = false;
        if (!threatRecord) {
            // Create new threat record
            threatRecord = await prisma_1.prisma.threatRecord.create({
                data: {
                    address,
                    chainId,
                    symbol: this.extractSymbol(detection),
                    riskScore: detection.riskScore,
                    status: 'ACTIVE',
                    layers: detection.layers,
                    reporters: [clientId],
                    reporterCount: 1,
                },
            });
            isNew = true;
        }
        else {
            // Update existing threat
            const reporters = new Set(threatRecord.reporters);
            reporters.add(clientId);
            threatRecord = await prisma_1.prisma.threatRecord.update({
                where: { id: threatRecord.id },
                data: {
                    riskScore: Math.max(threatRecord.riskScore, detection.riskScore),
                    lastSeenAt: new Date(),
                    reporters: Array.from(reporters),
                    reporterCount: reporters.size,
                    layers: detection.layers, // Update with latest analysis
                    status: 'ACTIVE',
                },
            });
        }
        // Create threat report linking client to threat
        await prisma_1.prisma.threatReport.create({
            data: {
                clientId,
                threatRecordId: threatRecord.id,
                detectionId: detection.alerts[0]?.id || `det-${Date.now()}`,
                riskScore: detection.riskScore,
                layers: detection.layers,
            },
        });
        // Invalidate cache
        this.invalidateCache(address, chainId);
        return { threatId: threatRecord.id, isNew };
    }
    static async checkThreat(address, chainId) {
        const cacheKey = `${chainId}:${address.toLowerCase()}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        const threat = await prisma_1.prisma.threatRecord.findUnique({
            where: { address_chainId: { address: address.toLowerCase(), chainId } },
        });
        const result = threat ? {
            address: threat.address,
            chainId: threat.chainId,
            riskScore: threat.riskScore,
            layers: threat.layers,
            firstSeenAt: threat.firstSeenAt,
            lastSeenAt: threat.lastSeenAt,
            reporterCount: threat.reporterCount,
            status: threat.status,
        } : null;
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    }
    static async getGlobalThreats(limit = 100, offset = 0, minRiskScore = 70) {
        const [threats, total] = await Promise.all([
            prisma_1.prisma.threatRecord.findMany({
                where: {
                    riskScore: { gte: minRiskScore },
                    status: 'ACTIVE',
                },
                orderBy: { lastSeenAt: 'desc' },
                skip: offset,
                take: limit,
            }),
            prisma_1.prisma.threatRecord.count({
                where: {
                    riskScore: { gte: minRiskScore },
                    status: 'ACTIVE',
                },
            }),
        ]);
        return {
            threats: threats.map((t) => ({
                address: t.address,
                chainId: t.chainId,
                riskScore: t.riskScore,
                layers: t.layers,
                firstSeenAt: t.firstSeenAt,
                lastSeenAt: t.lastSeenAt,
                reporterCount: t.reporterCount,
                status: t.status,
            })),
            total,
        };
    }
    static async getThreatDetails(threatId) {
        const threat = await prisma_1.prisma.threatRecord.findUnique({
            where: { id: threatId },
            include: {
                reports: {
                    include: {
                        client: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!threat)
            return null;
        return {
            ...threat,
            reporters: threat.reports.map((r) => ({
                clientId: r.client.id,
                clientName: r.client.name,
                riskScore: r.riskScore,
                detectedAt: r.createdAt,
            })),
        };
    }
    static async markFalsePositive(threatId, clientId) {
        const threat = await prisma_1.prisma.threatRecord.findUnique({ where: { id: threatId } });
        if (!threat)
            return false;
        // Only allow if client reported this threat
        const report = await prisma_1.prisma.threatReport.findFirst({
            where: { threatRecordId: threatId, clientId },
        });
        if (!report)
            return false;
        await prisma_1.prisma.threatRecord.update({
            where: { id: threatId },
            data: { status: 'FALSE_POSITIVE' },
        });
        this.invalidateCache(threat.address, threat.chainId);
        return true;
    }
    static async resolveThreat(threatId) {
        const threat = await prisma_1.prisma.threatRecord.findUnique({ where: { id: threatId } });
        if (!threat)
            return false;
        await prisma_1.prisma.threatRecord.update({
            where: { id: threatId },
            data: { status: 'RESOLVED' },
        });
        this.invalidateCache(threat.address, threat.chainId);
        return true;
    }
    static async getClientThreatHistory(clientId, limit = 50) {
        return prisma_1.prisma.threatReport.findMany({
            where: { clientId },
            include: {
                threatRecord: true,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    static async getThreatStats() {
        const [active, resolved, falsePositive, totalReports] = await Promise.all([
            prisma_1.prisma.threatRecord.count({ where: { status: 'ACTIVE' } }),
            prisma_1.prisma.threatRecord.count({ where: { status: 'RESOLVED' } }),
            prisma_1.prisma.threatRecord.count({ where: { status: 'FALSE_POSITIVE' } }),
            prisma_1.prisma.threatReport.count(),
        ]);
        const topThreats = await prisma_1.prisma.threatRecord.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { reporterCount: 'desc' },
            take: 10,
        });
        return {
            activeThreats: active,
            resolvedThreats: resolved,
            falsePositives: falsePositive,
            totalReports,
            topThreats: topThreats.map((t) => ({
                address: t.address,
                chainId: t.chainId,
                riskScore: t.riskScore,
                reporterCount: t.reporterCount,
                firstSeenAt: t.firstSeenAt,
            })),
        };
    }
    static invalidateCache(address, chainId) {
        this.cache.delete(`${chainId}:${address.toLowerCase()}`);
    }
    static extractSymbol(detection) {
        // Try to extract symbol from metadata
        if (detection.details?.metadata?.symbol) {
            return detection.details.metadata.symbol;
        }
        return undefined;
    }
}
exports.ThreatIntelService = ThreatIntelService;
//# sourceMappingURL=service.js.map