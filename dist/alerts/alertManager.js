"use strict";
/**
 * Alert System - Handles notifications via multiple channels
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const winston_1 = require("winston");
class AlertManager {
    config;
    logger;
    fileStream;
    constructor(config) {
        this.config = config;
        // Setup winston logger
        this.logger = (0, winston_1.createLogger)({
            level: 'info',
            format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.json()),
            transports: [
                new winston_1.transports.Console({
                    format: winston_1.format.combine(winston_1.format.colorize(), winston_1.format.simple())
                })
            ]
        });
        // Setup file logging if enabled
        if (config.file) {
            const logDir = path.dirname(config.filePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            this.fileStream = fs.createWriteStream(config.filePath, { flags: 'a' });
            this.logger.add(new winston_1.transports.File({
                filename: config.filePath,
                format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.json())
            }));
        }
    }
    /**
     * Send alert through all configured channels
     */
    async sendAlert(alert) {
        const formatted = this.formatAlert(alert);
        // Console output
        if (this.config.console) {
            this.logToConsole(alert);
        }
        // File logging
        if (this.config.file) {
            this.logToFile(formatted);
        }
        // Webhooks
        await Promise.all([
            this.sendDiscord(alert),
            this.sendTelegram(alert),
            this.sendSlack(alert),
            ...this.config.webhooks.custom?.map(url => this.sendCustomWebhook(url, alert)) || []
        ]);
    }
    /**
     * Send multiple alerts
     */
    async sendAlerts(alerts) {
        await Promise.all(alerts.map(alert => this.sendAlert(alert)));
    }
    formatAlert(alert) {
        return JSON.stringify({
            ...alert,
            timestamp: new Date(alert.timestamp).toISOString()
        }, null, 2);
    }
    logToConsole(alert) {
        const colors = {
            critical: '\x1b[31m', // Red
            warning: '\x1b[33m', // Yellow
            info: '\x1b[36m' // Cyan
        };
        const reset = '\x1b[0m';
        const color = colors[alert.type] || '';
        console.log(`${color}[${alert.type.toUpperCase()}]${reset} ${alert.title}\n` +
            `  ${alert.message}\n` +
            `  Token: ${alert.tokenAddress} | Chain: ${alert.chainId} | Time: ${new Date(alert.timestamp).toISOString()}`);
    }
    logToFile(formatted) {
        if (this.fileStream) {
            this.fileStream.write(formatted + '\n');
        }
    }
    async sendDiscord(alert) {
        const webhookUrl = this.config.webhooks.discord;
        if (!webhookUrl)
            return;
        const color = alert.type === 'critical' ? 0xFF0000 : alert.type === 'warning' ? 0xFFAA00 : 0x00AAFF;
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                            title: alert.title,
                            description: alert.message,
                            color,
                            fields: [
                                { name: 'Token Address', value: alert.tokenAddress, inline: true },
                                { name: 'Chain ID', value: alert.chainId.toString(), inline: true },
                                { name: 'Type', value: alert.type, inline: true },
                                { name: 'Timestamp', value: new Date(alert.timestamp).toISOString(), inline: true }
                            ],
                            footer: { text: 'Flash USDT Detector' }
                        }]
                })
            });
        }
        catch (error) {
            this.logger.error('Failed to send Discord alert', { error: String(error), alertId: alert.id });
        }
    }
    async sendTelegram(alert) {
        const { botToken, chatId } = this.config.webhooks.telegram || {};
        if (!botToken || !chatId)
            return;
        const emoji = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
        const text = `${emoji} <b>${alert.title}</b>\n\n${alert.message}\n\n` +
            `<b>Token:</b> <code>${alert.tokenAddress}</code>\n` +
            `<b>Chain:</b> ${alert.chainId}\n` +
            `<b>Type:</b> ${alert.type}\n` +
            `<b>Time:</b> ${new Date(alert.timestamp).toISOString()}`;
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML'
                })
            });
        }
        catch (error) {
            this.logger.error('Failed to send Telegram alert', { error: String(error), alertId: alert.id });
        }
    }
    async sendSlack(alert) {
        const webhookUrl = this.config.webhooks.slack;
        if (!webhookUrl)
            return;
        const color = alert.type === 'critical' ? 'danger' : alert.type === 'warning' ? 'warning' : 'good';
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attachments: [{
                            color,
                            title: alert.title,
                            text: alert.message,
                            fields: [
                                { title: 'Token Address', value: alert.tokenAddress, short: true },
                                { title: 'Chain ID', value: alert.chainId.toString(), short: true },
                                { title: 'Type', value: alert.type, short: true },
                                { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
                            ],
                            footer: 'Flash USDT Detector',
                            ts: Math.floor(alert.timestamp / 1000)
                        }]
                })
            });
        }
        catch (error) {
            this.logger.error('Failed to send Slack alert', { error: String(error), alertId: alert.id });
        }
    }
    async sendCustomWebhook(url, alert) {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert)
            });
        }
        catch (error) {
            this.logger.error('Failed to send custom webhook', { error: String(error), alertId: alert.id, url });
        }
    }
    /**
     * Log a general message (not an alert)
     */
    log(level, message, meta) {
        this.logger.log(level, message, meta);
    }
    /**
     * Close file stream
     */
    close() {
        if (this.fileStream) {
            this.fileStream.end();
        }
    }
}
exports.AlertManager = AlertManager;
//# sourceMappingURL=alertManager.js.map