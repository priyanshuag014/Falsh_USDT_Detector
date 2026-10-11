/**
 * REST API Server for external integration
 */
import express from 'express';
import { FlashUSDTDetector } from '../detectors';
import { AlertManager } from '../alerts/alertManager';
import { TransactionMonitor } from '../monitor/transactionMonitor';
import { ApiConfig } from '../config/types';
export declare class ApiServer {
    private app;
    private detector;
    private alertManager;
    private monitor;
    private config;
    private server?;
    constructor(detector: FlashUSDTDetector, alertManager: AlertManager, monitor: TransactionMonitor, config: ApiConfig);
    private setupMiddleware;
    private setupRoutes;
    /**
     * Set detection services (called after construction)
     */
    setDetectionServices(detector: FlashUSDTDetector, alertManager: AlertManager): void;
    /**
     * Start the API server
     */
    start(): Promise<void>;
    /**
     * Stop the API server
     */
    stop(): Promise<void>;
    getApp(): express.Application;
}
//# sourceMappingURL=server.d.ts.map