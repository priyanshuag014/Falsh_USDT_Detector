/**
 * Flash USDT Detector - Main Entry Point
 *
 * A real-time detection system for Flash USDT (fake USDT) scams on Ethereum
 */
import { MonitorStats } from './config/types';
declare class FlashUSDTDetectorApp {
    private detector;
    private alertManager;
    private monitor;
    private apiServer;
    private provider;
    private isShuttingDown;
    constructor();
    /**
     * Start the application
     */
    start(): Promise<void>;
    /**
     * Stop the application gracefully
     */
    stop(): Promise<void>;
    /**
     * Get current statistics
     */
    getStats(): MonitorStats;
    /**
     * Manually check a token address
     */
    checkToken(address: string): Promise<import("./config/types").DetectionResult>;
    private setupShutdownHandlers;
    private printStartupInfo;
}
declare function main(): Promise<void>;
export { FlashUSDTDetectorApp, main };
//# sourceMappingURL=index.d.ts.map