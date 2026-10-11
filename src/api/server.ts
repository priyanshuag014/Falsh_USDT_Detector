/**
 * REST API Server for external integration
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { ethers } from 'ethers';
import { FlashUSDTDetector } from '../detectors';
import { AlertManager } from '../alerts/alertManager';
import { TransactionMonitor } from '../monitor/transactionMonitor';
import { DetectionResult, ApiConfig } from '../config/types';
import detectionRoutes from './detectionRoutes';
import adminRoutes from './adminRoutes';
import billingRoutes from './billingRoutes';
import webhookRoutes from './webhookRoutes';

export class ApiServer {
  private app: express.Application;
  private detector: FlashUSDTDetector;
  private alertManager: AlertManager;
  private monitor: TransactionMonitor;
  private config: ApiConfig;
  private server?: ReturnType<typeof this.app.listen>;

  constructor(
    detector: FlashUSDTDetector,
    alertManager: AlertManager,
    monitor: TransactionMonitor,
    config: ApiConfig
  ) {
    this.detector = detector;
    this.alertManager = alertManager;
    this.monitor = monitor;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use((req: Request, res: Response, next: NextFunction) => {
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
      } else {
        express.json({ limit: '1mb' })(req, res, next);
      }
    });
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.maxRequests,
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.headers['x-api-key'] as string || req.ip || 'anonymous',
    });
    this.app.use(limiter);

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        this.alertManager.log('info', 'API Request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
          ip: req.ip,
          clientId: (req as any).clientId,
        });
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check (no auth)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now(), version: '1.0.0' });
    });

    // Stripe webhook (needs raw body)
    this.app.use('/api/v1/webhooks', webhookRoutes);

    // Mount route modules
    this.app.use('/api/v1', detectionRoutes);
    this.app.use('/api/v1', adminRoutes);
    this.app.use('/api/v1', billingRoutes);

    // Initialize detection routes with services
    // This is done after construction via setDetectionServices

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found', path: req.path });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.alertManager.log('error', 'API Error', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Set detection services (called after construction)
   */
  setDetectionServices(detector: FlashUSDTDetector, alertManager: AlertManager): void {
    // Import and set the services
    const detectionRoutesModule = require('./detectionRoutes');
    detectionRoutesModule.setDetectionServices(detector, alertManager);
  }

  /**
   * Start the API server
   */
  start(): Promise<void> {
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
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.alertManager.log('info', 'API Server stopped');
    }
  }

  getApp(): express.Application {
    return this.app;
  }
}