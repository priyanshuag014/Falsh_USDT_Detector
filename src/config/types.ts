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

export const KNOWN_USDT_ADDRESSES: Record<number, KnownToken> = {
  1: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chainId: 1,
    verified: true,
    coingeckoId: 'tether',
    logoUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png'
  },
  56: {
    address: '0x55d398326f99059fF775485246999027B3197955',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 18,
    chainId: 56,
    verified: true,
    coingeckoId: 'tether'
  },
  137: {
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chainId: 137,
    verified: true,
    coingeckoId: 'tether'
  },
  42161: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chainId: 42161,
    verified: true,
    coingeckoId: 'tether'
  },
  10: {
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chainId: 10,
    verified: true,
    coingeckoId: 'tether'
  },
  8453: {
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    chainId: 8453,
    verified: true,
    coingeckoId: 'tether'
  }
};

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
  riskScore: number; // 0-100
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
  score: number; // 0-100
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
    telegram?: { botToken: string; chatId: string };
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