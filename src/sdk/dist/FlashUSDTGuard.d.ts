/**
 * Flash USDT Guard SDK Client
 *
 * Main entry point for interacting with the Flash USDT Guard API
 */
import { DetectionResult, QuickCheckResult, KnownToken, SupportedChain, ClientInfo, ClientStats, UsageLog, AllowedToken, WebhookConfig, CreateTokenInput, CreateWebhookInput, ThreatRecord, ThreatStats, CheckoutSessionResponse, BillingPortalResponse } from './types';
export interface SDKConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    retries?: number;
}
export interface CheckOptions {
    signal?: AbortSignal;
}
export interface BatchCheckOptions extends CheckOptions {
    concurrency?: number;
}
export declare class FlashUSDTGuard {
    private apiKey;
    private baseUrl;
    private timeout;
    private retries;
    constructor(config: SDKConfig);
    /**
     * Quick address check - no quota consumption
     * Checks if address matches known legitimate USDT
     */
    quickCheck(address: string, options?: CheckOptions): Promise<QuickCheckResult>;
    /**
     * Full detection with all 5 layers
     * Consumes 1 quota unit
     */
    check(address: string, options?: CheckOptions): Promise<DetectionResult>;
    /**
     * Batch check multiple addresses (max 100)
     * Consumes 1 quota unit per address
     */
    checkBatch(addresses: string[], options?: BatchCheckOptions): Promise<DetectionResult[]>;
    /**
     * Get known USDT address for current chain
     */
    getKnownUSDT(): Promise<KnownToken>;
    /**
     * Get supported chains
     */
    getChains(): Promise<SupportedChain[]>;
    /**
     * Get current client info
     */
    getClientInfo(): Promise<ClientInfo>;
    /**
     * Get client usage statistics
     */
    getStats(): Promise<ClientStats>;
    /**
     * Get client usage logs
     */
    getUsageLogs(days?: number): Promise<UsageLog[]>;
    /**
     * Get client's allowed tokens
     */
    getAllowedTokens(): Promise<AllowedToken[]>;
    /**
     * Add a new allowed token
     */
    addAllowedToken(token: CreateTokenInput): Promise<AllowedToken>;
    /**
     * Get client's webhooks
     */
    getWebhooks(): Promise<WebhookConfig[]>;
    /**
     * Add a new webhook
     */
    addWebhook(webhook: CreateWebhookInput): Promise<WebhookConfig>;
    /**
     * Create checkout session for tier upgrade
     */
    createCheckoutSession(tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE', successUrl?: string, cancelUrl?: string): Promise<CheckoutSessionResponse>;
    /**
     * Get billing portal URL
     */
    getBillingPortalUrl(returnUrl?: string): Promise<BillingPortalResponse>;
    /**
     * Get global threat intelligence (requires PROFESSIONAL+ tier)
     */
    getThreats(limit?: number, offset?: number, minRiskScore?: number): Promise<{
        threats: ThreatRecord[];
        total: number;
    }>;
    /**
     * Get threat statistics (requires PROFESSIONAL+ tier)
     */
    getThreatStats(): Promise<ThreatStats>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: string;
        timestamp: number;
        version: string;
    }>;
    /**
     * Internal request method with retry logic
     */
    private request;
    private validateAddress;
    private sleep;
    /**
     * Create a new client with different configuration
     */
    withConfig(config: Partial<SDKConfig>): FlashUSDTGuard;
}
/**
 * Factory function for creating a client
 */
export declare function createClient(config: SDKConfig): FlashUSDTGuard;
export * from './types';
export * from './errors';
//# sourceMappingURL=FlashUSDTGuard.d.ts.map