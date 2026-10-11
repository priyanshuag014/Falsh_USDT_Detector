"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyAuth = apiKeyAuth;
exports.jwtAuth = jwtAuth;
exports.optionalAuth = optionalAuth;
exports.requireTier = requireTier;
exports.quotaCheck = quotaCheck;
exports.usageTracking = usageTracking;
const index_1 = require("./index");
function apiKeyAuth() {
    return async (req, res, next) => {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;
        if (!apiKey) {
            res.status(401).json({ error: 'API key required', code: 'MISSING_API_KEY' });
            return;
        }
        const client = await index_1.AuthService.authenticateApiKey(apiKey);
        if (!client) {
            res.status(401).json({ error: 'Invalid or expired API key', code: 'INVALID_API_KEY' });
            return;
        }
        req.client = client;
        req.clientId = client.id;
        next();
    };
}
function jwtAuth() {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Bearer token required', code: 'MISSING_TOKEN' });
            return;
        }
        const token = authHeader.substring(7);
        const client = await index_1.AuthService.authenticateJWT(token);
        if (!client) {
            res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
            return;
        }
        req.client = client;
        req.clientId = client.id;
        next();
    };
}
function optionalAuth() {
    return async (req, res, next) => {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;
        const authHeader = req.headers.authorization;
        if (apiKey) {
            const client = await index_1.AuthService.authenticateApiKey(apiKey);
            if (client) {
                req.client = client;
                req.clientId = client.id;
            }
        }
        else if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const client = await index_1.AuthService.authenticateJWT(token);
            if (client) {
                req.client = client;
                req.clientId = client.id;
            }
        }
        next();
    };
}
function requireTier(...allowedTiers) {
    return (req, res, next) => {
        if (!req.client) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedTiers.includes(req.client.tier)) {
            res.status(403).json({ error: 'Insufficient tier', required: allowedTiers });
            return;
        }
        next();
    };
}
function quotaCheck() {
    return async (req, res, next) => {
        if (!req.client) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (req.client.usedQuota >= req.client.monthlyQuota) {
            res.status(429).json({
                error: 'Monthly quota exceeded',
                code: 'QUOTA_EXCEEDED',
                quota: {
                    used: req.client.usedQuota,
                    limit: req.client.monthlyQuota,
                    tier: req.client.tier,
                },
            });
            return;
        }
        next();
    };
}
function usageTracking() {
    return async (req, res, next) => {
        const start = Date.now();
        res.on('finish', async () => {
            if (req.clientId) {
                const latencyMs = Date.now() - start;
                await index_1.AuthService.incrementUsage(req.clientId, req.path, req.method, res.statusCode, latencyMs, req.ip, req.headers['user-agent']);
            }
        });
        next();
    };
}
//# sourceMappingURL=middleware.js.map