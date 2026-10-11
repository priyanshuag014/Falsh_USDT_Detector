"use strict";
/**
 * Real-time Transaction Monitor
 * Monitors pending and confirmed transactions for USDT transfers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionMonitor = void 0;
const ethers_1 = require("ethers");
class TransactionMonitor {
    config;
    detector;
    alertManager;
    provider;
    wsProvider;
    stats;
    isRunning = false;
    seenTokens = new Map();
    tokenCacheTtl = 300000; // 5 minutes
    knownUSDTAddress;
    usdtTransferTopic;
    constructor(config, detector, alertManager) {
        this.config = config;
        this.detector = detector;
        this.alertManager = alertManager;
        this.knownUSDTAddress = config.knownTokens.find(t => t.chainId === config.chainId)?.address.toLowerCase() || '';
        this.usdtTransferTopic = ethers_1.ethers.id('Transfer(address,address,uint256)');
        this.stats = {
            startTime: Date.now(),
            blocksProcessed: 0,
            transactionsChecked: 0,
            alertsGenerated: 0,
            fakeTokensDetected: 0,
            errors: 0,
            lastBlockNumber: 0
        };
        // Initialize provider
        if (config.monitorPendingTxs) {
            this.provider = new ethers_1.ethers.WebSocketProvider(config.wsUrl);
            this.wsProvider = this.provider;
        }
        else {
            this.provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
        }
    }
    /**
     * Start monitoring
     */
    async start() {
        if (this.isRunning) {
            this.alertManager.log('warn', 'Monitor already running');
            return;
        }
        this.isRunning = true;
        this.alertManager.log('info', 'Starting Flash USDT Transaction Monitor', {
            chainId: this.config.chainId,
            monitorPending: this.config.monitorPendingTxs,
            monitorConfirmed: this.config.monitorConfirmedTxs,
            knownUSDT: this.knownUSDTAddress
        });
        // Initialize detector bytecodes
        await this.detector.initialize();
        if (this.config.monitorPendingTxs && this.wsProvider) {
            await this.startPendingTxMonitoring();
        }
        if (this.config.monitorConfirmedTxs) {
            await this.startConfirmedTxMonitoring();
        }
        // Periodic stats reporting
        setInterval(() => this.reportStats(), 60000);
    }
    /**
     * Stop monitoring
     */
    async stop() {
        this.isRunning = false;
        if (this.wsProvider) {
            await this.wsProvider.destroy();
        }
        this.alertManager.log('info', 'Monitor stopped', this.getStats());
    }
    /**
     * Monitor pending transactions via WebSocket
     */
    async startPendingTxMonitoring() {
        if (!this.wsProvider)
            return;
        this.wsProvider.on('pending', async (txHash) => {
            if (!this.isRunning)
                return;
            try {
                await this.checkPendingTransaction(txHash);
            }
            catch (error) {
                this.stats.errors++;
                this.alertManager.log('error', 'Error checking pending transaction', {
                    txHash,
                    error: String(error)
                });
            }
        });
        this.wsProvider.on('error', (error) => {
            this.stats.errors++;
            this.alertManager.log('error', 'WebSocket error', { error: String(error) });
        });
        this.wsProvider.on('close', () => {
            this.alertManager.log('warn', 'WebSocket connection closed, attempting reconnect...');
            // Reconnection handled by ethers
        });
        this.alertManager.log('info', 'Pending transaction monitoring started');
    }
    /**
     * Monitor confirmed transactions via block polling
     */
    async startConfirmedTxMonitoring() {
        const pollInterval = this.config.checkIntervalMs;
        const pollBlocks = async () => {
            if (!this.isRunning)
                return;
            try {
                const blockNumber = await this.provider.getBlockNumber();
                if (blockNumber > this.stats.lastBlockNumber) {
                    for (let i = this.stats.lastBlockNumber + 1; i <= blockNumber; i++) {
                        await this.checkBlock(i);
                    }
                    this.stats.lastBlockNumber = blockNumber;
                }
            }
            catch (error) {
                this.stats.errors++;
                this.alertManager.log('error', 'Error polling blocks', { error: String(error) });
            }
            if (this.isRunning) {
                setTimeout(pollBlocks, pollInterval);
            }
        };
        pollBlocks();
        this.alertManager.log('info', 'Confirmed transaction monitoring started', { pollIntervalMs: pollInterval });
    }
    /**
     * Check a pending transaction for USDT transfers
     */
    async checkPendingTransaction(txHash) {
        try {
            const tx = await this.provider.getTransaction(txHash);
            if (!tx)
                return;
            // Check if transaction interacts with a token contract
            if (tx.to && await this.isTokenTransfer(tx)) {
                await this.analyzeTokenInTransaction(tx.to, txHash, 'pending');
            }
        }
        catch (error) {
            // Transaction might not be available yet
        }
    }
    /**
     * Check a confirmed block for USDT transfers
     */
    async checkBlock(blockNumber) {
        try {
            const block = await this.provider.getBlock(blockNumber, true);
            if (!block || !block.transactions)
                return;
            this.stats.blocksProcessed++;
            for (const tx of block.transactions) {
                if (!this.isRunning)
                    break;
                // When getBlock is called with true, transactions are full TransactionResponse objects
                // But TypeScript doesn't know this, so we check the type
                if (typeof tx === 'string') {
                    // It's a transaction hash, skip for now (would need to fetch full tx)
                    continue;
                }
                const txResponse = tx;
                if (txResponse.to && await this.isTokenTransfer(txResponse)) {
                    await this.analyzeTokenInTransaction(txResponse.to, txResponse.hash, 'confirmed', blockNumber);
                }
            }
        }
        catch (error) {
            this.stats.errors++;
            this.alertManager.log('error', 'Error checking block', { blockNumber, error: String(error) });
        }
    }
    /**
     * Check if transaction is likely a token transfer
     */
    async isTokenTransfer(tx) {
        if (!tx.data || tx.data === '0x')
            return false;
        // Check if data starts with transfer function selector
        // transfer(address,uint256) = 0xa9059cbb
        // transferFrom(address,address,uint256) = 0x23b872dd
        const transferSelectors = ['0xa9059cbb', '0x23b872dd'];
        return transferSelectors.some(sel => tx.data.startsWith(sel));
    }
    /**
     * Analyze a token contract found in a transaction
     */
    async analyzeTokenInTransaction(tokenAddress, txHash, status, blockNumber) {
        const normalizedAddress = tokenAddress.toLowerCase();
        // Skip if it's the known legitimate USDT
        if (normalizedAddress === this.knownUSDTAddress.toLowerCase()) {
            return;
        }
        // Check cache
        const cached = this.seenTokens.get(normalizedAddress);
        if (cached && Date.now() - cached.timestamp < this.tokenCacheTtl) {
            // Re-emit alerts for cached fake tokens
            if (!cached.isLegitimate && cached.alerts.length > 0) {
                await this.alertManager.sendAlerts(cached.alerts);
                this.stats.alertsGenerated += cached.alerts.length;
            }
            return;
        }
        this.stats.transactionsChecked++;
        try {
            // Run detection
            const result = await this.detector.detect(normalizedAddress);
            // Cache result
            this.seenTokens.set(normalizedAddress, result);
            // Clean old cache entries
            if (this.seenTokens.size > 10000) {
                const cutoff = Date.now() - this.tokenCacheTtl;
                for (const [addr, res] of this.seenTokens.entries()) {
                    if (res.timestamp < cutoff) {
                        this.seenTokens.delete(addr);
                    }
                }
            }
            // Send alerts if suspicious
            if (!result.isLegitimate && result.alerts.length > 0) {
                await this.alertManager.sendAlerts(result.alerts);
                this.stats.alertsGenerated += result.alerts.length;
                this.stats.fakeTokensDetected++;
                this.alertManager.log('warn', 'Fake USDT detected in transaction', {
                    tokenAddress: normalizedAddress,
                    txHash,
                    status,
                    blockNumber,
                    riskScore: result.riskScore,
                    alerts: result.alerts.length
                });
            }
            else if (result.isLegitimate && result.riskScore < 20) {
                this.alertManager.log('info', 'Legitimate token verified', {
                    tokenAddress: normalizedAddress,
                    txHash,
                    riskScore: result.riskScore
                });
            }
        }
        catch (error) {
            this.stats.errors++;
            this.alertManager.log('error', 'Error analyzing token', {
                tokenAddress: normalizedAddress,
                error: String(error)
            });
        }
    }
    /**
     * Get current monitoring statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Report statistics
     */
    reportStats() {
        const uptime = (Date.now() - this.stats.startTime) / 1000 / 60; // minutes
        this.alertManager.log('info', 'Monitor Statistics', {
            uptimeMinutes: uptime.toFixed(1),
            blocksProcessed: this.stats.blocksProcessed,
            transactionsChecked: this.stats.transactionsChecked,
            alertsGenerated: this.stats.alertsGenerated,
            fakeTokensDetected: this.stats.fakeTokensDetected,
            errors: this.stats.errors,
            lastBlockNumber: this.stats.lastBlockNumber,
            cacheSize: this.seenTokens.size
        });
    }
    /**
     * Manually check a token address
     */
    async checkToken(tokenAddress) {
        return this.detector.detect(tokenAddress);
    }
    /**
     * Clear token cache
     */
    clearCache() {
        this.seenTokens.clear();
        this.detector.clearCaches();
    }
}
exports.TransactionMonitor = TransactionMonitor;
//# sourceMappingURL=transactionMonitor.js.map