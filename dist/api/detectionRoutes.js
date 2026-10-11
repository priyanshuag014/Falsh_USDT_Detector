"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDetectionServices = setDetectionServices;
const express_1 = require("express");
const ethers_1 = require("ethers");
const middleware_1 = require("../auth/middleware");
const router = (0, express_1.Router)();
let detector;
let alertManager;
function setDetectionServices(d, a) {
    detector = d;
    alertManager = a;
}
// ============================================
// PUBLIC DETECTION ENDPOINTS
// ============================================
// Quick check - address allowlist only (fast, no quota)
router.get('/quick-check/:address', (0, middleware_1.optionalAuth)(), async (req, res) => {
    try {
        const { address } = req.params;
        if (!ethers_1.ethers.isAddress(address)) {
            res.status(400).json({ error: 'Invalid Ethereum address' });
            return;
        }
        const normalizedAddress = ethers_1.ethers.getAddress(address);
        const isLegitimate = detector.quickCheck(normalizedAddress);
        // Get the known token for this chain
        const knownToken = detector.getKnownToken();
        const isKnownUSDT = normalizedAddress.toLowerCase() === knownToken.address.toLowerCase();
        res.json({
            address: normalizedAddress,
            isLegitimate,
            isKnownUSDT,
            knownUSDTAddress: knownToken.address,
            chainId: knownToken.chainId,
            message: isLegitimate
                ? 'Address matches known legitimate USDT'
                : 'Address does not match any known legitimate USDT',
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Full detection - requires API key and quota
router.post('/check', (0, middleware_1.apiKeyAuth)(), (0, middleware_1.quotaCheck)(), (0, middleware_1.usageTracking)(), async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) {
            res.status(400).json({ error: 'Address is required' });
            return;
        }
        if (!ethers_1.ethers.isAddress(address)) {
            res.status(400).json({ error: 'Invalid Ethereum address' });
            return;
        }
        const result = await detector.detect(address);
        // Log threat if detected
        if (!result.isLegitimate && result.riskScore > 50) {
            // Threat logging happens in threat-intel service
        }
        res.json(formatDetectionResult(result));
    }
    catch (error) {
        console.error('Detection error:', error);
        res.status(500).json({ error: 'Detection failed' });
    }
});
// Batch check - max 100 addresses
router.post('/check/batch', (0, middleware_1.apiKeyAuth)(), (0, middleware_1.quotaCheck)(), (0, middleware_1.usageTracking)(), async (req, res) => {
    try {
        const { addresses } = req.body;
        if (!addresses || !Array.isArray(addresses)) {
            res.status(400).json({ error: 'Addresses array is required' });
            return;
        }
        if (addresses.length > 100) {
            res.status(400).json({ error: 'Maximum 100 addresses per batch' });
            return;
        }
        const validAddresses = addresses.filter(addr => ethers_1.ethers.isAddress(addr));
        const results = await Promise.all(validAddresses.map(addr => detector.detect(addr)));
        res.json(results.map(formatDetectionResult));
    }
    catch (error) {
        res.status(500).json({ error: 'Batch detection failed' });
    }
});
// Get known USDT addresses for all supported chains
router.get('/known-tokens', (0, middleware_1.optionalAuth)(), async (req, res) => {
    const knownToken = detector.getKnownToken();
    res.json({
        chainId: knownToken.chainId,
        address: knownToken.address,
        name: knownToken.name,
        symbol: knownToken.symbol,
        decimals: knownToken.decimals,
        verified: knownToken.verified,
    });
});
// Get supported chains
router.get('/chains', (0, middleware_1.optionalAuth)(), async (req, res) => {
    res.json({
        chains: [
            { chainId: 1, name: 'Ethereum', nativeCurrency: 'ETH' },
            { chainId: 56, name: 'BSC', nativeCurrency: 'BNB' },
            { chainId: 137, name: 'Polygon', nativeCurrency: 'MATIC' },
            { chainId: 42161, name: 'Arbitrum', nativeCurrency: 'ETH' },
            { chainId: 10, name: 'Optimism', nativeCurrency: 'ETH' },
            { chainId: 8453, name: 'Base', nativeCurrency: 'ETH' },
        ],
    });
});
// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        version: '1.0.0',
    });
});
function formatDetectionResult(result) {
    return {
        tokenAddress: result.tokenAddress,
        chainId: result.chainId,
        timestamp: result.timestamp,
        riskScore: result.riskScore,
        isLegitimate: result.isLegitimate,
        layers: {
            addressMatch: formatLayer(result.layers.addressMatch),
            contractVerification: formatLayer(result.layers.contractVerification),
            metadataValidation: formatLayer(result.layers.metadataValidation),
            behavioralAnalysis: formatLayer(result.layers.behavioralAnalysis),
            bytecodeComparison: formatLayer(result.layers.bytecodeComparison),
        },
        alerts: result.alerts.map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            message: a.message,
            timestamp: a.timestamp,
        })),
    };
}
function formatLayer(layer) {
    return {
        passed: layer.passed,
        score: layer.score,
        weight: layer.weight,
        message: layer.message,
    };
}
exports.default = router;
//# sourceMappingURL=detectionRoutes.js.map