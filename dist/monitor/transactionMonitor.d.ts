/**
 * Real-time Transaction Monitor
 * Monitors pending and confirmed transactions for USDT transfers
 */
import { MonitorConfig, DetectionResult } from '../config/types';
import { FlashUSDTDetector } from '../detectors';
import { AlertManager } from '../alerts/alertManager';
export interface MonitorStats {
    startTime: number;
    blocksProcessed: number;
    transactionsChecked: number;
    alertsGenerated: number;
    fakeTokensDetected: number;
    errors: number;
    lastBlockNumber: number;
}
export declare class TransactionMonitor {
    private config;
    private detector;
    private alertManager;
    private provider;
    private wsProvider?;
    private stats;
    private isRunning;
    private seenTokens;
    private tokenCacheTtl;
    private knownUSDTAddress;
    private usdtTransferTopic;
    constructor(config: MonitorConfig, detector: FlashUSDTDetector, alertManager: AlertManager);
    /**
     * Start monitoring
     */
    start(): Promise<void>;
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
    /**
     * Monitor pending transactions via WebSocket
     */
    private startPendingTxMonitoring;
    /**
     * Monitor confirmed transactions via block polling
     */
    private startConfirmedTxMonitoring;
    /**
     * Check a pending transaction for USDT transfers
     */
    private checkPendingTransaction;
    /**
     * Check a confirmed block for USDT transfers
     */
    private checkBlock;
    /**
     * Check if transaction is likely a token transfer
     */
    private isTokenTransfer;
    /**
     * Analyze a token contract found in a transaction
     */
    private analyzeTokenInTransaction;
    /**
     * Get current monitoring statistics
     */
    getStats(): MonitorStats;
    /**
     * Report statistics
     */
    private reportStats;
    /**
     * Manually check a token address
     */
    checkToken(tokenAddress: string): Promise<DetectionResult>;
    /**
     * Clear token cache
     */
    clearCache(): void;
}
//# sourceMappingURL=transactionMonitor.d.ts.map