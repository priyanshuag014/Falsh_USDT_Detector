/**
 * Type definitions for Flash USDT Guard SDK
 */
export interface LayerResult {
    passed: boolean;
    score: number;
    weight: number;
    message: string;
}
export interface Alert {
    id: string;
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: number;
    tokenAddress: string;
    chainId: number;
}
export interface DetectionResult {
    tokenAddress: string;
    chainId: number;
    timestamp: number;
    riskScore: number;
    isLegitimate: boolean;
    layers: {
        addressMatch: LayerResult;
        contractVerification: LayerResult;
        metadataValidation: LayerResult;
        behavioralAnalysis: LayerResult;
        bytecodeComparison: LayerResult;
    };
    alerts: Alert[];
}
export interface QuickCheckResult {
    address: string;
    isLegitimate: boolean;
    isKnownUSDT: boolean;
    knownUSDTAddress: string;
    chainId: number;
    message: string;
}
export interface KnownToken {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    chainId: number;
    verified: boolean;
}
export interface SupportedChain {
    chainId: number;
    name: string;
    nativeCurrency: string;
}
export interface ClientInfo {
    id: string;
    name: string;
    email: string;
    tier: string;
    monthlyQuota: number;
    usedQuota: number;
    quotaRemaining: number;
}
export interface ClientStats {
    totalChecks: number;
    threatsDetected: number;
    avgLatencyMs: number;
    quotaUsed: number;
    quotaLimit: number;
    quotaRemaining: number;
}
export interface UsageLog {
    id: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}
export interface AllowedToken {
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
export interface WebhookConfig {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
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
export interface ThreatRecord {
    address: string;
    chainId: number;
    riskScore: number;
    layers: any;
    firstSeenAt: string;
    lastSeenAt: string;
    reporterCount: number;
    status: 'ACTIVE' | 'RESOLVED' | 'FALSE_POSITIVE';
}
export interface ThreatStats {
    activeThreats: number;
    resolvedThreats: number;
    falsePositives: number;
    totalReports: number;
    topThreats: Array<{
        address: string;
        chainId: number;
        riskScore: number;
        reporterCount: number;
        firstSeenAt: string;
    }>;
}
export interface CheckoutSessionResponse {
    url: string;
}
export interface BillingPortalResponse {
    url: string;
}
//# sourceMappingURL=types.d.ts.map