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
export declare class AuthService {
    static hashApiKey(apiKey: string): Promise<string>;
    static verifyApiKey(apiKey: string, hash: string): Promise<boolean>;
    static generateApiKey(): string;
    static generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
    static verifyJWT(token: string): JWTPayload | null;
    static authenticateApiKey(apiKey: string): Promise<AuthenticatedClient | null>;
    static authenticateJWT(token: string): Promise<AuthenticatedClient | null>;
    private static mapClientToAuth;
    static incrementUsage(clientId: string, endpoint: string, method: string, statusCode: number, latencyMs: number, ipAddress?: string, userAgent?: string): Promise<void>;
    static rotateApiKey(clientId: string, rotatedBy?: string): Promise<string>;
    static getTierQuota(tier: string): number;
}
//# sourceMappingURL=index.d.ts.map