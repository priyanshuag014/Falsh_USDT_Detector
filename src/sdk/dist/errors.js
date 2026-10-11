"use strict";
/**
 * Error classes for Flash USDT Guard SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.NotFoundError = exports.ValidationError = exports.NetworkError = exports.QuotaExceededError = exports.AuthError = exports.SDKError = void 0;
exports.isSDKError = isSDKError;
exports.isAuthError = isAuthError;
exports.isQuotaExceededError = isQuotaExceededError;
exports.isNetworkError = isNetworkError;
class SDKError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.name = 'SDKError';
        this.code = code;
        this.statusCode = statusCode;
        // Maintains proper stack trace in V8 environments
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.SDKError = SDKError;
class AuthError extends SDKError {
    constructor(message = 'Authentication failed', statusCode = 401) {
        super(message, 'AUTH_ERROR', statusCode);
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
class QuotaExceededError extends SDKError {
    constructor(quota) {
        super('Monthly quota exceeded', 'QUOTA_EXCEEDED', 429);
        this.name = 'QuotaExceededError';
        this.quota = quota;
    }
}
exports.QuotaExceededError = QuotaExceededError;
class NetworkError extends SDKError {
    constructor(message = 'Network error', originalError) {
        super(message, 'NETWORK_ERROR', 0);
        this.name = 'NetworkError';
        if (originalError && Error.captureStackTrace) {
            Error.captureStackTrace(this, originalError.constructor);
        }
    }
}
exports.NetworkError = NetworkError;
class ValidationError extends SDKError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends SDKError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class RateLimitError extends SDKError {
    constructor(message = 'Rate limit exceeded', retryAfter) {
        super(message, 'RATE_LIMIT', 429);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
function isSDKError(error) {
    return error instanceof SDKError;
}
function isAuthError(error) {
    return error instanceof AuthError;
}
function isQuotaExceededError(error) {
    return error instanceof QuotaExceededError;
}
function isNetworkError(error) {
    return error instanceof NetworkError;
}
//# sourceMappingURL=errors.js.map