/**
 * Flash USDT Detector - Main Entry Point
 * 
 * A real-time detection system for Flash USDT (fake USDT) scams on Ethereum
 */

import { ethers } from 'ethers';
import { config, validateConfig } from './config';
import { FlashUSDTDetector } from './detectors';
import { AlertManager } from './alerts/alertManager';
import { TransactionMonitor } from './monitor/transactionMonitor';
import { ApiServer } from './api/server';
import { MonitorStats } from './config/types';
import { connectDatabase, disconnectDatabase } from './db/prisma';
import { ThreatIntelService } from './threat-intel/service';

class FlashUSDTDetectorApp {
  private detector: FlashUSDTDetector;
  private alertManager: AlertManager;
  private monitor: TransactionMonitor;
  private apiServer: ApiServer;
  private provider: ethers.WebSocketProvider | ethers.JsonRpcProvider;
  private isShuttingDown = false;

  constructor() {
    // Validate configuration
    validateConfig();

    // Initialize provider
    this.provider = new ethers.WebSocketProvider(config.monitor.wsUrl);

    // Initialize core components
    this.alertManager = new AlertManager(config.alerts);
    this.detector = new FlashUSDTDetector(config.monitor, this.provider);
    this.monitor = new TransactionMonitor(config.monitor, this.detector, this.alertManager);
    this.apiServer = new ApiServer(this.detector, this.alertManager, this.monitor, config.api);

    // Setup graceful shutdown
    this.setupShutdownHandlers();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    this.alertManager.log('info', '🚀 Starting Flash USDT Detector', {
      version: '1.0.0',
      chainId: config.monitor.chainId,
      rpcUrl: config.monitor.rpcUrl,
      wsUrl: config.monitor.wsUrl
    });

    try {
      // Connect to database
      await connectDatabase();

      // Initialize detector (load bytecodes)
      await this.detector.initialize();

      // Set detection services on API server
      this.apiServer.setDetectionServices(this.detector, this.alertManager);

      // Start transaction monitor
      await this.monitor.start();

      // Start API server
      await this.apiServer.start();

      this.alertManager.log('info', '✅ Flash USDT Detector started successfully');
      this.printStartupInfo();

    } catch (error) {
      this.alertManager.log('error', 'Failed to start application', { error: String(error) });
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.alertManager.log('info', '🛑 Shutting down Flash USDT Detector...');

    try {
      await this.monitor.stop();
      await this.apiServer.stop();
      this.alertManager.close();
      await this.provider.destroy();
      await disconnectDatabase();
      
      this.alertManager.log('info', '✅ Shutdown complete');
    } catch (error) {
      this.alertManager.log('error', 'Error during shutdown', { error: String(error) });
    }
  }

  /**
   * Get current statistics
   */
  getStats(): MonitorStats {
    return this.monitor.getStats();
  }

  /**
   * Manually check a token address
   */
  async checkToken(address: string) {
    return this.detector.detect(address);
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      this.alertManager.log('info', `Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart

    process.on('uncaughtException', (error) => {
      this.alertManager.log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
      this.stop().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      this.alertManager.log('error', 'Unhandled rejection', { reason: String(reason) });
    });
  }

  private printStartupInfo(): void {
    const knownToken = this.detector.getKnownToken();
    
    console.log('\n' + '='.repeat(60));
    console.log('🛡️  FLASH USDT DETECTOR - RUNNING');
    console.log('='.repeat(60));
    console.log(`Chain: Ethereum Mainnet (Chain ID: ${config.monitor.chainId})`);
    console.log(`Known USDT: ${knownToken.address}`);
    console.log(`Monitoring: ${config.monitor.monitorPendingTxs ? 'Pending' : ''}${config.monitor.monitorPendingTxs && config.monitor.monitorConfirmedTxs ? ', ' : ''}${config.monitor.monitorConfirmedTxs ? 'Confirmed' : ''} transactions`);
    console.log(`API Server: http://${config.api.host}:${config.api.port}`);
    console.log(`Risk Threshold: ${config.monitor.detectionThresholds.riskScoreThreshold}/100`);
    console.log('='.repeat(60));
    console.log('\n📡 Public Endpoints:');
    console.log(`  GET  /health                              - Health check`);
    console.log(`  GET  /api/v1/known-tokens                 - Get known USDT info`);
    console.log(`  GET  /api/v1/chains                       - Get supported chains`);
    console.log(`  GET  /api/v1/quick-check/:address         - Quick allowlist check (no auth)`);
    console.log(`  POST /api/v1/check                        - Full detection (requires API key)`);
    console.log(`  POST /api/v1/check/batch                  - Batch detection (max 100)`);
    console.log('\n🔐 Authenticated Endpoints (require X-API-Key):');
    console.log(`  GET  /api/v1/me                           - Current client info`);
    console.log(`  GET  /api/v1/me/stats                     - Usage statistics`);
    console.log(`  GET  /api/v1/me/tokens                    - Client's allowed tokens`);
    console.log(`  POST /api/v1/me/tokens                    - Add allowed token`);
    console.log(`  GET  /api/v1/me/webhooks                  - Client's webhooks`);
    console.log(`  POST /api/v1/me/webhooks                  - Add webhook`);
    console.log(`  POST /api/v1/billing/checkout             - Create upgrade checkout`);
    console.log(`  POST /api/v1/billing/portal               - Billing portal URL`);
    console.log('\n👑 Admin Endpoints (require PROFESSIONAL+ tier):');
    console.log(`  GET  /api/v1/admin/clients                - List all clients`);
    console.log(`  POST /api/v1/admin/clients                - Create client`);
    console.log(`  GET  /api/v1/admin/clients/:id            - Get client`);
    console.log(`  PATCH /api/v1/admin/clients/:id           - Update client`);
    console.log(`  POST /api/v1/admin/clients/:id/rotate-key - Rotate API key`);
    console.log(`  GET  /api/v1/admin/clients/:id/stats      - Client stats`);
    console.log(`  GET  /api/v1/admin/clients/:id/usage      - Client usage logs`);
    console.log(`  GET  /api/v1/threats                      - Global threat intel`);
    console.log(`  GET  /api/v1/threat-stats                 - Threat statistics`);
    console.log('\nPress Ctrl+C to stop\n');
  }
}

// Run if executed directly
async function main(): Promise<void> {
  const app = new FlashUSDTDetectorApp();
  
  try {
    await app.start();
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

// Export for testing
export { FlashUSDTDetectorApp, main };

// Run if not imported
if (require.main === module) {
  main();
}