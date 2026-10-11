"use strict";
/**
 * Utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNumber = formatNumber;
exports.formatTokenAmount = formatTokenAmount;
exports.parseTokenAmount = parseTokenAmount;
exports.shortenAddress = shortenAddress;
exports.calculatePercentage = calculatePercentage;
exports.sleep = sleep;
exports.retry = retry;
exports.generateId = generateId;
exports.isTestEnvironment = isTestEnvironment;
exports.isValidAddress = isValidAddress;
exports.normalizeAddress = normalizeAddress;
exports.deepClone = deepClone;
exports.safeJsonParse = safeJsonParse;
const ethers_1 = require("ethers");
/**
 * Format large numbers with commas
 */
function formatNumber(num) {
    const str = num.toString();
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/**
 * Format token amount with decimals
 */
function formatTokenAmount(amount, decimals) {
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    if (fraction === 0n) {
        return formatNumber(whole);
    }
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${formatNumber(whole)}.${fractionStr}`;
}
/**
 * Parse token amount from string
 */
function parseTokenAmount(amount, decimals) {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction);
}
/**
 * Shorten address for display
 */
function shortenAddress(address, chars = 4) {
    if (!ethers_1.ethers.isAddress(address))
        return address;
    const checksum = ethers_1.ethers.getAddress(address);
    return `${checksum.slice(0, chars + 2)}...${checksum.slice(-chars)}`;
}
/**
 * Calculate percentage
 */
function calculatePercentage(part, total) {
    if (total === 0)
        return 0;
    return Math.round((part / total) * 10000) / 100;
}
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxAttempts) {
                throw lastError;
            }
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Generate unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
/**
 * Check if running in test environment
 */
function isTestEnvironment() {
    return process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
}
/**
 * Validate Ethereum address
 */
function isValidAddress(address) {
    try {
        return ethers_1.ethers.isAddress(address);
    }
    catch {
        return false;
    }
}
/**
 * Normalize address to checksum format
 */
function normalizeAddress(address) {
    try {
        return ethers_1.ethers.getAddress(address);
    }
    catch {
        return address.toLowerCase();
    }
}
/**
 * Deep clone object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
/**
 * Safe JSON parse
 */
function safeJsonParse(json, fallback) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=helpers.js.map