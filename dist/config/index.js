"use strict";
/**
 * Configuration loader
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
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const types_1 = require("./types");
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
function getEnv(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
function getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid number for environment variable: ${key}`);
    }
    return parsed;
}
function getEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value.toLowerCase() === 'true';
}
exports.config = {
    monitor: {
        rpcUrl: getEnv('ETH_RPC_URL'),
        wsUrl: getEnv('ETH_WS_URL'),
        etherscanApiKey: getEnv('ETHERSCAN_API_KEY'),
        etherscanApiUrl: getEnv('ETHERSCAN_API_URL', 'https://api.etherscan.io/v2/api'),
        chainId: getEnvNumber('CHAIN_ID', 1),
        knownTokens: Object.values(types_1.KNOWN_USDT_ADDRESSES),
        checkIntervalMs: getEnvNumber('CHECK_INTERVAL_MS', 1000),
        monitorPendingTxs: getEnvBoolean('MONITOR_PENDING_TXS', true),
        monitorConfirmedTxs: getEnvBoolean('MONITOR_CONFIRMED_TXS', true),
        detectionThresholds: {
            minHolderCount: getEnvNumber('MIN_HOLDER_COUNT', 10000),
            minDailyTransfers: getEnvNumber('MIN_DAILY_TRANSFERS', 100),
            minContractAgeDays: getEnvNumber('MIN_CONTRACT_AGE_DAYS', 30),
            maxSupplyDeviationPercent: getEnvNumber('MAX_SUPPLY_DEVIATION_PERCENT', 50),
            riskScoreThreshold: getEnvNumber('RISK_SCORE_THRESHOLD', 70)
        }
    },
    api: {
        port: getEnvNumber('API_PORT', 3000),
        host: getEnv('API_HOST', '0.0.0.0'),
        corsOrigins: getEnv('CORS_ORIGINS', '*').split(','),
        rateLimit: {
            windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
            maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100)
        }
    },
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
    }
};
function validateConfig() {
    const requiredDirs = [path.dirname(exports.config.alerts.filePath)];
    for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    if (!exports.config.monitor.rpcUrl || !exports.config.monitor.wsUrl) {
        throw new Error('RPC URLs are required');
    }
    if (!exports.config.monitor.etherscanApiKey) {
        console.warn('WARNING: Etherscan API key not set - contract verification will be limited');
    }
}
//# sourceMappingURL=index.js.map