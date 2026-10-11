/**
 * Layer 4: Behavioral Analysis Detector
 * Analyzes holder count, transfer volume, contract age
 */
import { ethers } from 'ethers';
import { LayerResult } from '../config/types';
export interface EtherscanTokenHolderResponse {
    status: string;
    message: string;
    result: Array<{
        TokenHolderQuantity: string;
        TokenHolderAddress: string;
        TokenHolderQuantityPercent: string;
    }>;
}
export interface EtherscanTokenTxResponse {
    status: string;
    message: string;
    result: Array<{
        blockNumber: string;
        timeStamp: string;
        hash: string;
        from: string;
        to: string;
        value: string;
        tokenName: string;
        tokenSymbol: string;
        tokenDecimal: string;
    }>;
}
export interface EtherscanContractCreationResponse {
    status: string;
    message: string;
    result: Array<{
        contractAddress: string;
        contractCreator: string;
        txHash: string;
        blockNumber: string;
        timestamp: string;
    }>;
}
export declare class BehavioralAnalysisDetector {
    private apiKey;
    private apiUrl;
    private chainId;
    private thresholds;
    private cache;
    private cacheTtl;
    constructor(apiKey: string, apiUrl: string, chainId: number, thresholds: {
        minHolderCount: number;
        minDailyTransfers: number;
        minContractAgeDays: number;
    });
    detect(tokenAddress: string): Promise<LayerResult>;
    private getHolderAnalysis;
    private getTransferAnalysis;
    private getContractAge;
    clearCache(): void;
}
/**
 * Layer 5: Bytecode Comparison Detector
 * Compares deployed bytecode with known legitimate USDT bytecode
 */
export declare class BytecodeComparisonDetector {
    private provider;
    private knownBytecodes;
    private cache;
    private cacheTtl;
    constructor(provider: ethers.Provider);
    /**
     * Set known bytecode for a chain (should be called during initialization)
     */
    initializeKnownBytecodes(knownTokens: Array<{
        address: string;
        chainId: number;
    }>): Promise<void>;
    /**
     * Manually set known bytecode (useful for testing or if RPC fails)
     */
    setKnownBytecode(chainId: number, bytecode: string): void;
    detect(tokenAddress: string, chainId: number): Promise<LayerResult>;
    private calculateSimilarity;
    private findDifferences;
    private hashBytecode;
    clearCache(): void;
}
//# sourceMappingURL=behavioralDetector.d.ts.map