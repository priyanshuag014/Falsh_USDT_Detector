/**
 * Alert System - Handles notifications via multiple channels
 */
import { Alert, AlertConfig } from '../config/types';
export declare class AlertManager {
    private config;
    private logger;
    private fileStream?;
    constructor(config: AlertConfig);
    /**
     * Send alert through all configured channels
     */
    sendAlert(alert: Alert): Promise<void>;
    /**
     * Send multiple alerts
     */
    sendAlerts(alerts: Alert[]): Promise<void>;
    private formatAlert;
    private logToConsole;
    private logToFile;
    private sendDiscord;
    private sendTelegram;
    private sendSlack;
    private sendCustomWebhook;
    /**
     * Log a general message (not an alert)
     */
    log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
    /**
     * Close file stream
     */
    close(): void;
}
//# sourceMappingURL=alertManager.d.ts.map