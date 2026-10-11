/**
 * Error classes for Flash USDT Guard SDK
 */
export declare class SDKError extends Error {
    readonly code: string;
    readonly statusCode?: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare class AuthError extends SDKError {
    constructor(message?: string, statusCode?: number);
}
export declare class QuotaExceededError extends SDKError {
    readonly quota: {
        used: number;
        limit: number;
        tier: string;
    };
    constructor(quota: {
        used: number;
        limit: number;
        tier: string;
    });
}
export declare class NetworkError extends SDKError {
    constructor(message?: string, originalError?: Error);
}
export declare class ValidationError extends SDKError {
    readonly details?: any;
    constructor(message: string, details?: any);
}
export declare class NotFoundError extends SDKError {
    constructor(resource?: string);
}
export declare class RateLimitError extends SDKError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
export declare function isSDKError(error: any): error is SDKError;
export declare function isAuthError(error: any): error is AuthError;
export declare function isQuotaExceededError(error: any): error is QuotaExceededError;
export declare function isNetworkError(error: any): error is NetworkError;
//# sourceMappingURL=errors.d.ts.map