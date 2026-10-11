/**
 * Configuration loader
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
  MonitorConfig,
  DetectionThresholds,
  ApiConfig,
  AlertConfig,
  KnownToken,
  KNOWN_USDT_ADDRESSES
} from './types';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true';
}

export const config = {
  monitor: {
    rpcUrl: getEnv('ETH_RPC_URL'),
    wsUrl: getEnv('ETH_WS_URL'),
    etherscanApiKey: getEnv('ETHERSCAN_API_KEY'),
    etherscanApiUrl: getEnv('ETHERSCAN_API_URL', 'https://api.etherscan.io/v2/api'),
    chainId: getEnvNumber('CHAIN_ID', 1),
    knownTokens: Object.values(KNOWN_USDT_ADDRESSES) as KnownToken[],
    checkIntervalMs: getEnvNumber('CHECK_INTERVAL_MS', 1000),
    monitorPendingTxs: getEnvBoolean('MONITOR_PENDING_TXS', true),
    monitorConfirmedTxs: getEnvBoolean('MONITOR_CONFIRMED_TXS', true),
    detectionThresholds: {
      minHolderCount: getEnvNumber('MIN_HOLDER_COUNT', 10000),
      minDailyTransfers: getEnvNumber('MIN_DAILY_TRANSFERS', 100),
      minContractAgeDays: getEnvNumber('MIN_CONTRACT_AGE_DAYS', 30),
      maxSupplyDeviationPercent: getEnvNumber('MAX_SUPPLY_DEVIATION_PERCENT', 50),
      riskScoreThreshold: getEnvNumber('RISK_SCORE_THRESHOLD', 70)
    } as DetectionThresholds
  } as MonitorConfig,

  api: {
    port: getEnvNumber('API_PORT', 3000),
    host: getEnv('API_HOST', '0.0.0.0'),
    corsOrigins: getEnv('CORS_ORIGINS', '*').split(','),
    rateLimit: {
      windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
      maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100)
    }
  } as ApiConfig,

  alerts: {
    console: getEnvBoolean('ALERT_CONSOLE', true),
    file: getEnvBoolean('ALERT_FILE', true),
    filePath: getEnv('LOG_FILE', './logs/detector.log'),
    webhooks: {
      discord: getEnv('DISCORD_WEBHOOK_URL', ''),
      telegram: (() => {
        const botToken = getEnv('TELEGRAM_BOT_TOKEN', '');
        const chatId = getEnv('TELEGRAM_CHAT_ID', '');
        return botToken && chatId ? { botToken, chatId } : undefined;
      })(),
      slack: getEnv('SLACK_WEBHOOK_URL', ''),
      custom: getEnv('CUSTOM_WEBHOOK_URLS', '').split(',').filter(Boolean)
    }
  } as AlertConfig
};

export function validateConfig(): void {
  const requiredDirs = [path.dirname(config.alerts.filePath)];
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  if (!config.monitor.rpcUrl || !config.monitor.wsUrl) {
    throw new Error('RPC URLs are required');
  }

  if (!config.monitor.etherscanApiKey) {
    console.warn('WARNING: Etherscan API key not set - contract verification will be limited');
  }
}