/**
 * Utility functions
 */
/**
 * Format large numbers with commas
 */
export declare function formatNumber(num: number | bigint): string;
/**
 * Format token amount with decimals
 */
export declare function formatTokenAmount(amount: bigint, decimals: number): string;
/**
 * Parse token amount from string
 */
export declare function parseTokenAmount(amount: string, decimals: number): bigint;
/**
 * Shorten address for display
 */
export declare function shortenAddress(address: string, chars?: number): string;
/**
 * Calculate percentage
 */
export declare function calculatePercentage(part: number, total: number): number;
/**
 * Sleep utility
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelay?: number): Promise<T>;
/**
 * Generate unique ID
 */
export declare function generateId(): string;
/**
 * Check if running in test environment
 */
export declare function isTestEnvironment(): boolean;
/**
 * Validate Ethereum address
 */
export declare function isValidAddress(address: string): boolean;
/**
 * Normalize address to checksum format
 */
export declare function normalizeAddress(address: string): string;
/**
 * Deep clone object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Safe JSON parse
 */
export declare function safeJsonParse<T>(json: string, fallback: T): T;
//# sourceMappingURL=helpers.d.ts.map