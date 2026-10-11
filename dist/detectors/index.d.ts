/**
 * Main Detection Engine - Orchestrates all detection layers
 */
import { ethers } from 'ethers';
import { DetectionResult, KnownToken, MonitorConfig } from '../config/types';
export declare class FlashUSDTDetector {
    private addressDetector;
    private verificationDetector;
    private metadataDetector;
    private behavioralDetector;
    private bytecodeDetector;
    private provider;
    private config;
    private knownToken;
    constructor(config: MonitorConfig, provider: ethers.Provider);
    /**
     * Initialize bytecode detector with known good bytecodes
     */
    initialize(): Promise<void>;
    /**
     * Run full detection on a token address
     */
    detect(tokenAddress: string): Promise<DetectionResult>;
    /**
     * Quick check - only address allowlist (fastest)
     */
    quickCheck(tokenAddress: string): boolean;
    /**
     * Get known token info for this chain
     */
    getKnownToken(): KnownToken;
    private calculateRiskScore;
    private generateAlerts;
    /**
     * Clear all detector caches
     */
    clearCaches(): void;
}
//# sourceMappingURL=index.d.ts.map