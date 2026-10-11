/**
 * Flash USDT Guard SDK Client
 * 
 * Main entry point for interacting with the Flash USDT Guard API
 */

import { ethers } from 'ethers';
import {
  DetectionResult,
  LayerResult,
  Alert,
  QuickCheckResult,
  KnownToken,
  SupportedChain,
  ClientInfo,
  ClientStats,
  UsageLog,
  AllowedToken,
  WebhookConfig,
  CreateTokenInput,
  CreateWebhookInput,
  ThreatRecord,
  ThreatStats,
  CheckoutSessionResponse,
  BillingPortalResponse,
} from './types';
import {
  SDKError,
  AuthError,
  QuotaExceededError,
  NetworkError,
  ValidationError,
  NotFoundError,
  isSDKError,
  isAuthError,
  isQuotaExceededError,
} from './errors';

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

export class FlashUSDTGuard {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(config: SDKConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.flashusdtguard.com').replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  /**
   * Quick address check - no quota consumption
   * Checks if address matches known legitimate USDT
   */
  async quickCheck(address: string, options: CheckOptions = {}): Promise<QuickCheckResult> {
    this.validateAddress(address);
    
    const response = await this.request<QuickCheckResult>(
      'GET',
      `/api/v1/quick-check/${address}`,
      undefined,
      options
    );
    
    return response;
  }

  /**
   * Full detection with all 5 layers
   * Consumes 1 quota unit
   */
  async check(address: string, options: CheckOptions = {}): Promise<DetectionResult> {
    this.validateAddress(address);
    
    const response = await this.request<DetectionResult>(
      'POST',
      '/api/v1/check',
      { address },
      options
    );
    
    return response;
  }

  /**
   * Batch check multiple addresses (max 100)
   * Consumes 1 quota unit per address
   */
  async checkBatch(addresses: string[], options: BatchCheckOptions = {}): Promise<DetectionResult[]> {
    if (addresses.length > 100) {
      throw new ValidationError('Maximum 100 addresses per batch', { max: 100, provided: addresses.length });
    }

    const validAddresses = addresses.filter(addr => ethers.isAddress(addr));
    if (validAddresses.length !== addresses.length) {
      const invalid = addresses.filter(addr => !ethers.isAddress(addr));
      throw new ValidationError('Invalid Ethereum addresses', { invalid });
    }

    const response = await this.request<DetectionResult[]>(
      'POST',
      '/api/v1/check/batch',
      { addresses: validAddresses },
      options
    );
    
    return response;
  }

  /**
   * Get known USDT address for current chain
   */
  async getKnownUSDT(): Promise<KnownToken> {
    return this.request<KnownToken>('GET', '/api/v1/known-tokens');
  }

  /**
   * Get supported chains
   */
  async getChains(): Promise<SupportedChain[]> {
    const response = await this.request<{ chains: SupportedChain[] }>('GET', '/api/v1/chains');
    return response.chains;
  }

  /**
   * Get current client info
   */
  async getClientInfo(): Promise<ClientInfo> {
    return this.request<ClientInfo>('GET', '/api/v1/me');
  }

  /**
   * Get client usage statistics
   */
  async getStats(): Promise<ClientStats> {
    return this.request<ClientStats>('GET', '/api/v1/me/stats');
  }

  /**
   * Get client usage logs
   */
  async getUsageLogs(days: number = 30): Promise<UsageLog[]> {
    return this.request<UsageLog[]>('GET', `/api/v1/me/usage?days=${days}`);
  }

  /**
   * Get client's allowed tokens
   */
  async getAllowedTokens(): Promise<AllowedToken[]> {
    return this.request<AllowedToken[]>('GET', '/api/v1/me/tokens');
  }

  /**
   * Add a new allowed token
   */
  async addAllowedToken(token: CreateTokenInput): Promise<AllowedToken> {
    return this.request<AllowedToken>('POST', '/api/v1/me/tokens', token);
  }

  /**
   * Get client's webhooks
   */
  async getWebhooks(): Promise<WebhookConfig[]> {
    return this.request<WebhookConfig[]>('GET', '/api/v1/me/webhooks');
  }

  /**
   * Add a new webhook
   */
  async addWebhook(webhook: CreateWebhookInput): Promise<WebhookConfig> {
    return this.request<WebhookConfig>('POST', '/api/v1/me/webhooks', webhook);
  }

  /**
   * Create checkout session for tier upgrade
   */
  async createCheckoutSession(tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE', successUrl?: string, cancelUrl?: string): Promise<CheckoutSessionResponse> {
    return this.request<CheckoutSessionResponse>('POST', '/api/v1/billing/checkout', {
      tier,
      successUrl,
      cancelUrl,
    });
  }

  /**
   * Get billing portal URL
   */
  async getBillingPortalUrl(returnUrl?: string): Promise<BillingPortalResponse> {
    return this.request<BillingPortalResponse>('POST', '/api/v1/billing/portal', {
      returnUrl,
    });
  }

  /**
   * Get global threat intelligence (requires PROFESSIONAL+ tier)
   */
  async getThreats(limit: number = 100, offset: number = 0, minRiskScore: number = 70): Promise<{ threats: ThreatRecord[]; total: number }> {
    return this.request<{ threats: ThreatRecord[]; total: number }>(
      'GET',
      `/api/v1/threats?limit=${limit}&offset=${offset}&minRiskScore=${minRiskScore}`
    );
  }

  /**
   * Get threat statistics (requires PROFESSIONAL+ tier)
   */
  async getThreatStats(): Promise<ThreatStats> {
    return this.request<ThreatStats>('GET', '/api/v1/threat-stats');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: number; version: string }> {
    return this.request('GET', '/health');
  }

  /**
   * Internal request method with retry logic
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: any,
    options: CheckOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Combine signals if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    let lastError: Error = new Error('Unknown error');

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
          throw new AuthError('Invalid or expired API key', 401);
        }

        if (response.status === 403) {
          throw new AuthError('Insufficient permissions', 403);
        }

        if (response.status === 404) {
          throw new NotFoundError('Resource');
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (attempt < this.retries && retryAfter) {
            await this.sleep(parseInt(retryAfter) * 1000);
            continue;
          }
          throw new QuotaExceededError({
            used: 0,
            limit: 0,
            tier: 'UNKNOWN',
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '' })) as { error?: string };
          throw new SDKError(
            errorData.error || `HTTP ${response.status}`,
            'API_ERROR',
            response.status
          );
        }

        return await response.json() as T;

      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;

        // Don't retry on auth/validation errors
        if (isAuthError(error) || error instanceof ValidationError || error instanceof NotFoundError) {
          throw error;
        }

        // Don't retry on quota exceeded (handled above)
        if (isQuotaExceededError(error)) {
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
    if (lastError instanceof SDKError) {
      throw lastError;
    }
    throw new NetworkError(`Request failed after ${this.retries + 1} attempts`, lastError);
  }

  private validateAddress(address: string): void {
    if (!ethers.isAddress(address)) {
      throw new ValidationError('Invalid Ethereum address', { address });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a new client with different configuration
   */
  withConfig(config: Partial<SDKConfig>): FlashUSDTGuard {
    return new FlashUSDTGuard({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      retries: this.retries,
      ...config,
    });
  }
}

/**
 * Factory function for creating a client
 */
export function createClient(config: SDKConfig): FlashUSDTGuard {
  return new FlashUSDTGuard(config);
}

// Re-export types and errors
export * from './types';
export * from './errors';