/**
 * Error classes for Flash USDT Guard SDK
 */

export class SDKError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
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

export class AuthError extends SDKError {
  constructor(message: string = 'Authentication failed', statusCode: number = 401) {
    super(message, 'AUTH_ERROR', statusCode);
    this.name = 'AuthError';
  }
}

export class QuotaExceededError extends SDKError {
  public readonly quota: {
    used: number;
    limit: number;
    tier: string;
  };

  constructor(quota: { used: number; limit: number; tier: string }) {
    super('Monthly quota exceeded', 'QUOTA_EXCEEDED', 429);
    this.name = 'QuotaExceededError';
    this.quota = quota;
  }
}

export class NetworkError extends SDKError {
  constructor(message: string = 'Network error', originalError?: Error) {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
    if (originalError && Error.captureStackTrace) {
      Error.captureStackTrace(this, originalError.constructor);
    }
  }
}

export class ValidationError extends SDKError {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends SDKError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends SDKError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export function isSDKError(error: any): error is SDKError {
  return error instanceof SDKError;
}

export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError;
}

export function isQuotaExceededError(error: any): error is QuotaExceededError {
  return error instanceof QuotaExceededError;
}

export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError;
}