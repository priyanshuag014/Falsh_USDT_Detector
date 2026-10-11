/**
 * Core types for Flash USDT Detection System
 */
export type Network = 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'optimism' | 'base';
export interface KnownToken {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    chainId: number;
    verified: boolean;
    coingeckoId?: string;
    logoUrl?: string;
}
export declare const KNOWN_USDT_ADDRESSES: Record<number, KnownToken>;
export interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
    contractAddress: string;
}
export interface VerificationResult {
    isVerified: boolean;
    sourceCode?: string;
    abi?: string;
    contractName?: string;
    compilerVersion?: string;
    optimizationEnabled?: boolean;
    runs?: number;
    licenseType?: string;
    proxy?: boolean;
    implementation?: string;
}
export interface HolderAnalysis {
    holderCount: number;
    topHoldersPercentage: number;
    recentTransfers24h: number;
    uniqueSenders24h: number;
    uniqueReceivers24h: number;
}
export interface BytecodeAnalysis {
    matchesKnown: boolean;
    similarityScore: number;
    knownBytecodeHash: string;
    targetBytecodeHash: string;
    differences: string[];
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
    details: {
        knownToken?: KnownToken;
        metadata?: TokenMetadata;
        verification?: VerificationResult;
        holderAnalysis?: HolderAnalysis;
        bytecodeAnalysis?: BytecodeAnalysis;
    };
    alerts: Alert[];
}
export interface LayerResult {
    passed: boolean;
    score: number;
    weight: number;
    message: string;
    details?: Record<string, unknown>;
}
export interface Alert {
    id: string;
    type: 'warning' | 'critical' | 'info';
    title: string;
    message: string;
    tokenAddress: string;
    chainId: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export interface TransactionEvent {
    hash: string;
    from: string;
    to: string;
    value: bigint;
    tokenAddress?: string;
    blockNumber: number;
    timestamp: number;
    status: 'pending' | 'confirmed' | 'failed';
}
export interface MonitorConfig {
    rpcUrl: string;
    wsUrl: string;
    etherscanApiKey: string;
    etherscanApiUrl: string;
    chainId: number;
    knownTokens: KnownToken[];
    checkIntervalMs: number;
    monitorPendingTxs: boolean;
    monitorConfirmedTxs: boolean;
    detectionThresholds: DetectionThresholds;
}
export interface DetectionThresholds {
    minHolderCount: number;
    minDailyTransfers: number;
    minContractAgeDays: number;
    maxSupplyDeviationPercent: number;
    riskScoreThreshold: number;
}
export interface ApiConfig {
    port: number;
    host: string;
    corsOrigins: string[];
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
}
export interface AlertConfig {
    console: boolean;
    file: boolean;
    filePath: string;
    webhooks: {
        discord?: string;
        telegram?: {
            botToken: string;
            chatId: string;
        };
        slack?: string;
        custom?: string[];
    };
}
export interface MonitorStats {
    startTime: number;
    blocksProcessed: number;
    transactionsChecked: number;
    alertsGenerated: number;
    fakeTokensDetected: number;
    errors: number;
    lastBlockNumber: number;
}
//# sourceMappingURL=types.d.ts.map