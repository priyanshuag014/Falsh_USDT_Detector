/**
 * Alert System - Handles notifications via multiple channels
 */

import * as fs from 'fs';
import * as path from 'path';
import { Alert, AlertConfig } from '../config/types';
import { createLogger, Logger, format, transports } from 'winston';

export class AlertManager {
  private config: AlertConfig;
  private logger: Logger;
  private fileStream?: fs.WriteStream;

  constructor(config: AlertConfig) {
    this.config = config;
    
    // Setup winston logger
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
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
      
      this.logger.add(new transports.File({
        filename: config.filePath,
        format: format.combine(format.timestamp(), format.json())
      }));
    }
  }

  /**
   * Send alert through all configured channels
   */
  async sendAlert(alert: Alert): Promise<void> {
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
  async sendAlerts(alerts: Alert[]): Promise<void> {
    await Promise.all(alerts.map(alert => this.sendAlert(alert)));
  }

  private formatAlert(alert: Alert): string {
    return JSON.stringify({
      ...alert,
      timestamp: new Date(alert.timestamp).toISOString()
    }, null, 2);
  }

  private logToConsole(alert: Alert): void {
    const colors = {
      critical: '\x1b[31m',   // Red
      warning: '\x1b[33m',    // Yellow
      info: '\x1b[36m'        // Cyan
    };
    const reset = '\x1b[0m';
    const color = colors[alert.type] || '';
    
    console.log(
      `${color}[${alert.type.toUpperCase()}]${reset} ${alert.title}\n` +
      `  ${alert.message}\n` +
      `  Token: ${alert.tokenAddress} | Chain: ${alert.chainId} | Time: ${new Date(alert.timestamp).toISOString()}`
    );
  }

  private logToFile(formatted: string): void {
    if (this.fileStream) {
      this.fileStream.write(formatted + '\n');
    }
  }

  private async sendDiscord(alert: Alert): Promise<void> {
    const webhookUrl = this.config.webhooks.discord;
    if (!webhookUrl) return;

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
    } catch (error) {
      this.logger.error('Failed to send Discord alert', { error: String(error), alertId: alert.id });
    }
  }

  private async sendTelegram(alert: Alert): Promise<void> {
    const { botToken, chatId } = this.config.webhooks.telegram || {};
    if (!botToken || !chatId) return;

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
    } catch (error) {
      this.logger.error('Failed to send Telegram alert', { error: String(error), alertId: alert.id });
    }
  }

  private async sendSlack(alert: Alert): Promise<void> {
    const webhookUrl = this.config.webhooks.slack;
    if (!webhookUrl) return;

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
    } catch (error) {
      this.logger.error('Failed to send Slack alert', { error: String(error), alertId: alert.id });
    }
  }

  private async sendCustomWebhook(url: string, alert: Alert): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      this.logger.error('Failed to send custom webhook', { error: String(error), alertId: alert.id, url });
    }
  }

  /**
   * Log a general message (not an alert)
   */
  log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    this.logger.log(level, message, meta);
  }

  /**
   * Close file stream
   */
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
    }
  }
}