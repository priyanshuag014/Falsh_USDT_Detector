"use strict";
/**
 * Flash USDT Guard SDK Client
 *
 * Main entry point for interacting with the Flash USDT Guard API
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlashUSDTGuard = void 0;
exports.createClient = createClient;
const ethers_1 = require("ethers");
const errors_1 = require("./errors");
class FlashUSDTGuard {
    apiKey;
    baseUrl;
    timeout;
    retries;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl || 'https://api.flashusdtguard.com').replace(/\/$/, '');
        this.timeout = config.timeout || 30000;
        this.retries = config.retries || 3;
    }
    /**
     * Quick address check - no quota consumption
     * Checks if address matches known legitimate USDT
     */
    async quickCheck(address, options = {}) {
        this.validateAddress(address);
        const response = await this.request('GET', `/api/v1/quick-check/${address}`, undefined, options);
        return response;
    }
    /**
     * Full detection with all 5 layers
     * Consumes 1 quota unit
     */
    async check(address, options = {}) {
        this.validateAddress(address);
        const response = await this.request('POST', '/api/v1/check', { address }, options);
        return response;
    }
    /**
     * Batch check multiple addresses (max 100)
     * Consumes 1 quota unit per address
     */
    async checkBatch(addresses, options = {}) {
        if (addresses.length > 100) {
            throw new errors_1.ValidationError('Maximum 100 addresses per batch', { max: 100, provided: addresses.length });
        }
        const validAddresses = addresses.filter(addr => ethers_1.ethers.isAddress(addr));
        if (validAddresses.length !== addresses.length) {
            const invalid = addresses.filter(addr => !ethers_1.ethers.isAddress(addr));
            throw new errors_1.ValidationError('Invalid Ethereum addresses', { invalid });
        }
        const response = await this.request('POST', '/api/v1/check/batch', { addresses: validAddresses }, options);
        return response;
    }
    /**
     * Get known USDT address for current chain
     */
    async getKnownUSDT() {
        return this.request('GET', '/api/v1/known-tokens');
    }
    /**
     * Get supported chains
     */
    async getChains() {
        const response = await this.request('GET', '/api/v1/chains');
        return response.chains;
    }
    /**
     * Get current client info
     */
    async getClientInfo() {
        return this.request('GET', '/api/v1/me');
    }
    /**
     * Get client usage statistics
     */
    async getStats() {
        return this.request('GET', '/api/v1/me/stats');
    }
    /**
     * Get client usage logs
     */
    async getUsageLogs(days = 30) {
        return this.request('GET', `/api/v1/me/usage?days=${days}`);
    }
    /**
     * Get client's allowed tokens
     */
    async getAllowedTokens() {
        return this.request('GET', '/api/v1/me/tokens');
    }
    /**
     * Add a new allowed token
     */
    async addAllowedToken(token) {
        return this.request('POST', '/api/v1/me/tokens', token);
    }
    /**
     * Get client's webhooks
     */
    async getWebhooks() {
        return this.request('GET', '/api/v1/me/webhooks');
    }
    /**
     * Add a new webhook
     */
    async addWebhook(webhook) {
        return this.request('POST', '/api/v1/me/webhooks', webhook);
    }
    /**
     * Create checkout session for tier upgrade
     */
    async createCheckoutSession(tier, successUrl, cancelUrl) {
        return this.request('POST', '/api/v1/billing/checkout', {
            tier,
            successUrl,
            cancelUrl,
        });
    }
    /**
     * Get billing portal URL
     */
    async getBillingPortalUrl(returnUrl) {
        return this.request('POST', '/api/v1/billing/portal', {
            returnUrl,
        });
    }
    /**
     * Get global threat intelligence (requires PROFESSIONAL+ tier)
     */
    async getThreats(limit = 100, offset = 0, minRiskScore = 70) {
        return this.request('GET', `/api/v1/threats?limit=${limit}&offset=${offset}&minRiskScore=${minRiskScore}`);
    }
    /**
     * Get threat statistics (requires PROFESSIONAL+ tier)
     */
    async getThreatStats() {
        return this.request('GET', '/api/v1/threat-stats');
    }
    /**
     * Health check
     */
    async healthCheck() {
        return this.request('GET', '/health');
    }
    /**
     * Internal request method with retry logic
     */
    async request(method, path, body, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        // Combine signals if provided
        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort());
        }
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
        };
        let lastError = new Error('Unknown error');
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                const response = await fetch(url, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                // Handle specific status codes
                if (response.status === 401) {
                    throw new errors_1.AuthError('Invalid or expired API key', 401);
                }
                if (response.status === 403) {
                    throw new errors_1.AuthError('Insufficient permissions', 403);
                }
                if (response.status === 404) {
                    throw new errors_1.NotFoundError('Resource');
                }
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    if (attempt < this.retries && retryAfter) {
                        await this.sleep(parseInt(retryAfter) * 1000);
                        continue;
                    }
                    throw new errors_1.QuotaExceededError({
                        used: 0,
                        limit: 0,
                        tier: 'UNKNOWN',
                    });
                }
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: '' }));
                    throw new errors_1.SDKError(errorData.error || `HTTP ${response.status}`, 'API_ERROR', response.status);
                }
                return await response.json();
            }
            catch (error) {
                clearTimeout(timeoutId);
                lastError = error;
                // Don't retry on auth/validation errors
                if ((0, errors_1.isAuthError)(error) || error instanceof errors_1.ValidationError || error instanceof errors_1.NotFoundError) {
                    throw error;
                }
                // Don't retry on quota exceeded (handled above)
                if ((0, errors_1.isQuotaExceededError)(error)) {
                    throw error;
                }
                // Retry on network errors
                if (attempt < this.retries) {
                    await this.sleep(Math.min(1000 * Math.pow(2, attempt), 10000));
                    continue;
                }
            }
        }
        // If we got here, all retries failed
        if (lastError instanceof errors_1.SDKError) {
            throw lastError;
        }
        throw new errors_1.NetworkError(`Request failed after ${this.retries + 1} attempts`, lastError);
    }
    validateAddress(address) {
        if (!ethers_1.ethers.isAddress(address)) {
            throw new errors_1.ValidationError('Invalid Ethereum address', { address });
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Create a new client with different configuration
     */
    withConfig(config) {
        return new FlashUSDTGuard({
            apiKey: this.apiKey,
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            retries: this.retries,
            ...config,
        });
    }
}
exports.FlashUSDTGuard = FlashUSDTGuard;
/**
 * Factory function for creating a client
 */
function createClient(config) {
    return new FlashUSDTGuard(config);
}
// Re-export types and errors
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
//# sourceMappingURL=FlashUSDTGuard.js.map