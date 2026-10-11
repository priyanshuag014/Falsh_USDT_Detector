"use strict";
/**
 * Layer 1: Address Allowlist Detector
 * Primary defense - checks if token address matches known legitimate USDT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataValidationDetector = exports.ContractVerificationDetector = exports.AddressAllowlistDetector = void 0;
const ethers_1 = require("ethers");
class AddressAllowlistDetector {
    knownTokens = new Map();
    normalizedAddresses = new Set();
    constructor(knownTokens) {
        for (const token of knownTokens) {
            const normalized = ethers_1.ethers.getAddress(token.address).toLowerCase();
            this.knownTokens.set(normalized, token);
            this.normalizedAddresses.add(normalized);
        }
    }
    /**
     * Check if an address is a known legitimate USDT
     */
    detect(tokenAddress, chainId) {
        const normalized = ethers_1.ethers.getAddress(tokenAddress).toLowerCase();
        const knownToken = this.knownTokens.get(normalized);
        if (knownToken && knownToken.chainId === chainId) {
            return {
                passed: true,
                score: 100,
                weight: 0.4, // Highest weight - this is the most reliable check
                message: `Address matches known legitimate USDT on chain ${chainId}`,
                details: {
                    knownToken: {
                        address: knownToken.address,
                        name: knownToken.name,
                        symbol: knownToken.symbol,
                        decimals: knownToken.decimals,
                        chainId: knownToken.chainId
                    }
                }
            };
        }
        // Check if it's a known USDT on a different chain
        const wrongChainToken = Array.from(this.knownTokens.values())
            .find(t => t.address.toLowerCase() === normalized);
        if (wrongChainToken) {
            return {
                passed: false,
                score: 0,
                weight: 0.4,
                message: `Address is legitimate USDT but on wrong chain (expected ${chainId}, found ${wrongChainToken.chainId})`,
                details: {
                    knownToken: {
                        address: wrongChainToken.address,
                        name: wrongChainToken.name,
                        symbol: wrongChainToken.symbol,
                        chainId: wrongChainToken.chainId
                    }
                }
            };
        }
        return {
            passed: false,
            score: 0,
            weight: 0.4,
            message: 'Address does not match any known legitimate USDT contract',
            details: {
                checkedAddress: normalized,
                knownAddressesCount: this.normalizedAddresses.size
            }
        };
    }
    /**
     * Get all known USDT addresses for a specific chain
     */
    getKnownAddresses(chainId) {
        return Array.from(this.knownTokens.values())
            .filter(t => t.chainId === chainId)
            .map(t => t.address);
    }
    /**
     * Check if address is in allowlist (simple boolean)
     */
    isAllowed(tokenAddress, chainId) {
        const result = this.detect(tokenAddress, chainId);
        return result.passed;
    }
    /**
     * Get the known token info if address matches
     */
    getKnownToken(tokenAddress, chainId) {
        const normalized = ethers_1.ethers.getAddress(tokenAddress).toLowerCase();
        const token = this.knownTokens.get(normalized);
        return token && token.chainId === chainId ? token : null;
    }
}
exports.AddressAllowlistDetector = AddressAllowlistDetector;
class ContractVerificationDetector {
    apiKey;
    apiUrl;
    cache = new Map();
    cacheTtl = 3600000; // 1 hour
    constructor(apiKey, apiUrl) {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
    }
    async detect(tokenAddress, chainId) {
        const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
            return cached.result;
        }
        try {
            const url = `${this.apiUrl}?chainid=${chainId}&module=contract&action=getsourcecode&address=${tokenAddress}&apikey=${this.apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status !== '1' || !data.result || data.result.length === 0) {
                const result = {
                    passed: false,
                    score: 0,
                    weight: 0.25,
                    message: 'Contract verification check failed - API error or no result',
                    details: { apiStatus: data.status, apiMessage: data.message }
                };
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
            const contract = data.result[0];
            const isVerified = Boolean(contract.SourceCode &&
                contract.SourceCode !== '' &&
                contract.ABI !== 'Contract source code not verified' &&
                contract.ABI !== '');
            let score = 0;
            let message = '';
            if (isVerified) {
                score = 80;
                message = 'Contract source code is verified on Etherscan';
                // Bonus for exact match with known USDT
                if (contract.ContractName.toLowerCase().includes('tether') ||
                    contract.ContractName.toLowerCase().includes('usdt')) {
                    score = 95;
                    message += ' - Contract name matches USDT/Tether';
                }
            }
            else {
                score = 10;
                message = 'Contract source code is NOT verified on Etherscan';
            }
            const result = {
                passed: isVerified,
                score,
                weight: 0.25,
                message,
                details: {
                    contractName: contract.ContractName,
                    compilerVersion: contract.CompilerVersion,
                    optimizationUsed: String(contract.OptimizationUsed) === '1',
                    runs: parseInt(contract.Runs) || 0,
                    licenseType: contract.LicenseType,
                    isProxy: String(contract.Proxy) === '1',
                    implementation: contract.Implementation || undefined
                }
            };
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }
        catch (error) {
            const result = {
                passed: false,
                score: 0,
                weight: 0.25,
                message: `Contract verification check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: { error: String(error) }
            };
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }
    }
    clearCache() {
        this.cache.clear();
    }
}
exports.ContractVerificationDetector = ContractVerificationDetector;
class MetadataValidationDetector {
    provider;
    knownToken;
    cache = new Map();
    cacheTtl = 300000; // 5 minutes
    constructor(provider, knownToken) {
        this.provider = provider;
        this.knownToken = knownToken;
    }
    async detect(tokenAddress) {
        const cacheKey = tokenAddress.toLowerCase();
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
            return cached.result;
        }
        try {
            const contract = new ethers_1.ethers.Contract(tokenAddress, [
                'function name() view returns (string)',
                'function symbol() view returns (string)',
                'function decimals() view returns (uint8)',
                'function totalSupply() view returns (uint256)'
            ], this.provider);
            const [name, symbol, decimals, totalSupply] = await Promise.all([
                contract.name().catch(() => ''),
                contract.symbol().catch(() => ''),
                contract.decimals().catch(() => 0),
                contract.totalSupply().catch(() => 0n)
            ]);
            const validation = {
                name,
                symbol,
                decimals,
                totalSupply,
                isValidName: name.toLowerCase() === this.knownToken.name.toLowerCase() ||
                    name.toLowerCase().includes('tether') ||
                    name.toLowerCase().includes('usdt'),
                isValidSymbol: symbol.toUpperCase() === this.knownToken.symbol.toUpperCase(),
                isValidDecimals: decimals === this.knownToken.decimals,
                isReasonableSupply: this.isReasonableSupply(totalSupply)
            };
            let score = 0;
            const messages = [];
            if (validation.isValidName) {
                score += 25;
                messages.push('Name matches');
            }
            else {
                messages.push(`Name mismatch: "${name}" vs "${this.knownToken.name}"`);
            }
            if (validation.isValidSymbol) {
                score += 25;
                messages.push('Symbol matches');
            }
            else {
                messages.push(`Symbol mismatch: "${symbol}" vs "${this.knownToken.symbol}"`);
            }
            if (validation.isValidDecimals) {
                score += 25;
                messages.push('Decimals match');
            }
            else {
                messages.push(`Decimals mismatch: ${decimals} vs ${this.knownToken.decimals}`);
            }
            if (validation.isReasonableSupply) {
                score += 25;
                messages.push('Supply in reasonable range');
            }
            else {
                messages.push(`Supply suspicious: ${totalSupply.toString()}`);
            }
            const result = {
                passed: score >= 75,
                score,
                weight: 0.2,
                message: messages.join('; '),
                details: validation
            };
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }
        catch (error) {
            const result = {
                passed: false,
                score: 0,
                weight: 0.2,
                message: `Metadata validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: { error: String(error) }
            };
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
        }
    }
    isReasonableSupply(totalSupply) {
        // USDT supply should be between 10B and 200B (with decimals)
        const minSupply = 10000000000n * 10n ** BigInt(this.knownToken.decimals);
        const maxSupply = 200000000000n * 10n ** BigInt(this.knownToken.decimals);
        return totalSupply >= minSupply && totalSupply <= maxSupply;
    }
    clearCache() {
        this.cache.clear();
    }
}
exports.MetadataValidationDetector = MetadataValidationDetector;
//# sourceMappingURL=addressDetector.js.map