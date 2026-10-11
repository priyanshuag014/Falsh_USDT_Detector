/**
 * Utility functions
 */

import { ethers } from 'ethers';

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number | bigint): string {
  const str = num.toString();
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
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
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!ethers.isAddress(address)) return address;
  const checksum = ethers.getAddress(address);
  return `${checksum.slice(0, chars + 2)}...${checksum.slice(-chars)}`;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if running in test environment
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Normalize address to checksum format
 */
export function normalizeAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    return address.toLowerCase();
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}