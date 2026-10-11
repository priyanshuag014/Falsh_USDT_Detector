"use strict";
/**
 * REST API Server for external integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const detectionRoutes_1 = __importDefault(require("./detectionRoutes"));
const adminRoutes_1 = __importDefault(require("./adminRoutes"));
const billingRoutes_1 = __importDefault(require("./billingRoutes"));
const webhookRoutes_1 = __importDefault(require("./webhookRoutes"));
class ApiServer {
    app;
    detector;
    alertManager;
    monitor;
    config;
    server;
    constructor(detector, alertManager, monitor, config) {
        this.detector = detector;
        this.alertManager = alertManager;
        this.monitor = monitor;
        this.config = config;
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        // CORS
        this.app.use((req, res, next) => {
            const origin = req.headers.origin;
            if (this.config.corsOrigins.includes('*') || (origin && this.config.corsOrigins.includes(origin))) {
                res.header('Access-Control-Allow-Origin', origin || '*');
            }
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });
        // Body parser - but skip for Stripe webhooks
        this.app.use((req, res, next) => {
            if (req.path === '/api/v1/webhooks/stripe') {
                next();
            }
            else {
                express_1.default.json({ limit: '1mb' })(req, res, next);
            }
        });
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Rate limiting
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: this.config.rateLimit.windowMs,
            max: this.config.rateLimit.maxRequests,
            message: { error: 'Too many requests, please try again later' },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => req.headers['x-api-key'] || req.ip || 'anonymous',
        });
        this.app.use(limiter);
        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                this.alertManager.log('info', 'API Request', {
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    durationMs: Date.now() - start,
                    ip: req.ip,
                    clientId: req.clientId,
                });
            });
            next();
        });
    }
    setupRoutes() {
        // Health check (no auth)
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: Date.now(), version: '1.0.0' });
        });
        // Stripe webhook (needs raw body)
        this.app.use('/api/v1/webhooks', webhookRoutes_1.default);
        // Mount route modules
        this.app.use('/api/v1', detectionRoutes_1.default);
        this.app.use('/api/v1', adminRoutes_1.default);
        this.app.use('/api/v1', billingRoutes_1.default);
        // Initialize detection routes with services
        // This is done after construction via setDetectionServices
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found', path: req.path });
        });
        // Error handler
        this.app.use((err, req, res, next) => {
            this.alertManager.log('error', 'API Error', { error: err.message, stack: err.stack });
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    /**
     * Set detection services (called after construction)
     */
    setDetectionServices(detector, alertManager) {
        // Import and set the services
        const detectionRoutesModule = require('./detectionRoutes');
        detectionRoutesModule.setDetectionServices(detector, alertManager);
    }
    /**
     * Start the API server
     */
    start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.config.port, this.config.host, () => {
                this.alertManager.log('info', `API Server started`, {
                    host: this.config.host,
                    port: this.config.port,
                });
                resolve();
            });
        });
    }
    /**
     * Stop the API server
     */
    async stop() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(() => resolve());
            });
            this.alertManager.log('info', 'API Server stopped');
        }
    }
    getApp() {
        return this.app;
    }
}
exports.ApiServer = ApiServer;
//# sourceMappingURL=server.js.map