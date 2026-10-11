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
export declare class TenantService {
    static createClient(input: CreateClientInput): Promise<ClientResponse>;
    static getClient(clientId: string): Promise<ClientResponse | null>;
    static listClients(page?: number, limit?: number, search?: string): Promise<{
        clients: ClientResponse[];
        total: number;
    }>;
    static updateClient(clientId: string, data: Partial<CreateClientInput>): Promise<ClientResponse | null>;
    static deleteClient(clientId: string): Promise<boolean>;
    static rotateApiKey(clientId: string): Promise<string>;
    static addToken(clientId: string, input: CreateTokenInput): Promise<TokenResponse>;
    static updateToken(tokenId: string, input: Partial<CreateTokenInput>): Promise<TokenResponse | null>;
    static deleteToken(tokenId: string): Promise<boolean>;
    static addWebhook(clientId: string, input: CreateWebhookInput): Promise<WebhookResponse>;
    static updateWebhook(webhookId: string, data: Partial<CreateWebhookInput> & {
        enabled?: boolean;
    }): Promise<WebhookResponse | null>;
    static deleteWebhook(webhookId: string): Promise<boolean>;
    static getClientUsage(clientId: string, days?: number): Promise<any[]>;
    static getClientStats(clientId: string): Promise<any>;
    private static mapClientResponse;
    private static mapTokenResponse;
    private static mapWebhookResponse;
}
//# sourceMappingURL=service.d.ts.map