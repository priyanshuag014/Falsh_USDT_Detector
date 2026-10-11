"use strict";
/**
 * Main Detection Engine - Orchestrates all detection layers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlashUSDTDetector = void 0;
const ethers_1 = require("ethers");
const addressDetector_1 = require("./addressDetector");
const addressDetector_2 = require("./addressDetector");
const behavioralDetector_1 = require("./behavioralDetector");
const behavioralDetector_2 = require("./behavioralDetector");
class FlashUSDTDetector {
    addressDetector;
    verificationDetector;
    metadataDetector;
    behavioralDetector;
    bytecodeDetector;
    provider;
    config;
    knownToken;
    constructor(config, provider) {
        this.config = config;
        this.provider = provider;
        // Find the known token for this chain
        const knownToken = config.knownTokens.find(t => t.chainId === config.chainId);
        if (!knownToken) {
            throw new Error(`No known USDT token configured for chain ${config.chainId}`);
        }
        this.knownToken = knownToken;
        // Initialize all detectors
        this.addressDetector = new addressDetector_1.AddressAllowlistDetector(config.knownTokens);
        this.verificationDetector = new addressDetector_1.ContractVerificationDetector(config.etherscanApiKey, config.etherscanApiUrl);
        this.metadataDetector = new addressDetector_2.MetadataValidationDetector(provider, this.knownToken);
        this.behavioralDetector = new behavioralDetector_1.BehavioralAnalysisDetector(config.etherscanApiKey, config.etherscanApiUrl, config.chainId, {
            minHolderCount: config.detectionThresholds.minHolderCount,
            minDailyTransfers: config.detectionThresholds.minDailyTransfers,
            minContractAgeDays: config.detectionThresholds.minContractAgeDays
        });
        this.bytecodeDetector = new behavioralDetector_2.BytecodeComparisonDetector(provider);
    }
    /**
     * Initialize bytecode detector with known good bytecodes
     */
    async initialize() {
        await this.bytecodeDetector.initializeKnownBytecodes(this.config.knownTokens);
    }
    /**
     * Run full detection on a token address
     */
    async detect(tokenAddress) {
        const normalizedAddress = ethers_1.ethers.getAddress(tokenAddress);
        const timestamp = Date.now();
        // Run all detection layers in parallel
        const [addressResult, verificationResult, metadataResult, behavioralResult, bytecodeResult] = await Promise.all([
            this.addressDetector.detect(normalizedAddress, this.config.chainId),
            this.verificationDetector.detect(normalizedAddress, this.config.chainId),
            this.metadataDetector.detect(normalizedAddress),
            this.behavioralDetector.detect(normalizedAddress),
            this.bytecodeDetector.detect(normalizedAddress, this.config.chainId)
        ]);
        // Calculate weighted risk score
        const layers = {
            addressMatch: addressResult,
            contractVerification: verificationResult,
            metadataValidation: metadataResult,
            behavioralAnalysis: behavioralResult,
            bytecodeComparison: bytecodeResult
        };
        const riskScore = this.calculateRiskScore(layers);
        const isLegitimate = riskScore < this.config.detectionThresholds.riskScoreThreshold;
        // Generate alerts
        const alerts = this.generateAlerts(normalizedAddress, this.config.chainId, layers, riskScore, isLegitimate);
        return {
            tokenAddress: normalizedAddress,
            chainId: this.config.chainId,
            timestamp,
            riskScore,
            isLegitimate,
            layers,
            details: {
                knownToken: addressResult.passed ? this.knownToken : undefined,
                metadata: metadataResult.details,
                verification: verificationResult.details,
                holderAnalysis: behavioralResult.details,
                bytecodeAnalysis: bytecodeResult.details
            },
            alerts
        };
    }
    /**
     * Quick check - only address allowlist (fastest)
     */
    quickCheck(tokenAddress) {
        return this.addressDetector.isAllowed(tokenAddress, this.config.chainId);
    }
    /**
     * Get known token info for this chain
     */
    getKnownToken() {
        return this.knownToken;
    }
    calculateRiskScore(layers) {
        let totalWeight = 0;
        let weightedScore = 0;
        for (const [, layer] of Object.entries(layers)) {
            // Invert score for risk (high score = low risk)
            const riskContribution = (100 - layer.score) * layer.weight;
            weightedScore += riskContribution;
            totalWeight += layer.weight;
        }
        // Normalize to 0-100
        return Math.round((weightedScore / totalWeight) * 100) / 100;
    }
    generateAlerts(tokenAddress, chainId, layers, riskScore, isLegitimate) {
        const alerts = [];
        const alertId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        // Critical: Address doesn't match known USDT
        if (!layers.addressMatch.passed) {
            alerts.push({
                id: alertId(),
                type: 'critical',
                title: 'FAKE USDT DETECTED',
                message: `Token at ${tokenAddress} is NOT the legitimate USDT contract. This is likely a Flash USDT scam token.`,
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { layer: 'addressMatch', riskScore }
            });
        }
        if (!layers.bytecodeComparison.passed && layers.bytecodeComparison.score < 50) {
            const similarity = layers.bytecodeComparison.details?.similarityScore;
            alerts.push({
                id: alertId(),
                type: 'critical',
                title: 'BYTECODE MISMATCH',
                message: `Contract bytecode does not match legitimate USDT. Similarity: ${similarity !== undefined ? (similarity * 100).toFixed(1) : 'unknown'}%`,
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { layer: 'bytecodeComparison', ...layers.bytecodeComparison.details }
            });
        }
        // Warning: Contract not verified
        if (!layers.contractVerification.passed) {
            alerts.push({
                id: alertId(),
                type: 'warning',
                title: 'UNVERIFIED CONTRACT',
                message: 'Contract source code is not verified on Etherscan. Legitimate USDT is fully verified.',
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { layer: 'contractVerification', ...layers.contractVerification.details }
            });
        }
        // Warning: Metadata mismatch
        if (!layers.metadataValidation.passed) {
            alerts.push({
                id: alertId(),
                type: 'warning',
                title: 'METADATA MISMATCH',
                message: `Token metadata doesn't match legitimate USDT: ${layers.metadataValidation.message}`,
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { layer: 'metadataValidation', ...layers.metadataValidation.details }
            });
        }
        // Warning: Low holder count/activity
        if (!layers.behavioralAnalysis.passed) {
            alerts.push({
                id: alertId(),
                type: 'warning',
                title: 'SUSPICIOUS ACTIVITY',
                message: `Low holder count or transfer volume: ${layers.behavioralAnalysis.message}`,
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { layer: 'behavioralAnalysis', ...layers.behavioralAnalysis.details }
            });
        }
        // Info: Overall risk score
        if (riskScore > 50) {
            alerts.push({
                id: alertId(),
                type: riskScore > 70 ? 'critical' : 'warning',
                title: `HIGH RISK SCORE: ${riskScore}`,
                message: `Overall risk assessment: ${riskScore}/100. ${isLegitimate ? 'Proceed with caution.' : 'HIGHLY LIKELY TO BE FAKE USDT.'}`,
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { overallRiskScore: riskScore, isLegitimate }
            });
        }
        // Info: Legitimate token confirmed
        if (isLegitimate && riskScore < 20) {
            alerts.push({
                id: alertId(),
                type: 'info',
                title: 'LEGITIMATE USDT CONFIRMED',
                message: `Token at ${tokenAddress} passes all verification checks. This is genuine USDT.`,
                tokenAddress,
                chainId,
                timestamp: Date.now(),
                metadata: { overallRiskScore: riskScore, isLegitimate: true }
            });
        }
        return alerts;
    }
    /**
     * Clear all detector caches
     */
    clearCaches() {
        this.verificationDetector.clearCache();
        this.metadataDetector.clearCache();
        this.behavioralDetector.clearCache();
        this.bytecodeDetector.clearCache();
    }
}
exports.FlashUSDTDetector = FlashUSDTDetector;
//# sourceMappingURL=index.js.map