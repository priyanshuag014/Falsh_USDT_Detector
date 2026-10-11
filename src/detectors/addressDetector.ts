/**
 * Layer 1: Address Allowlist Detector
 * Primary defense - checks if token address matches known legitimate USDT
 */

import { KnownToken, DetectionResult, LayerResult, Alert } from '../config/types';
import { ethers } from 'ethers';

export class AddressAllowlistDetector {
  private knownTokens: Map<string, KnownToken> = new Map();
  private normalizedAddresses: Set<string> = new Set();

  constructor(knownTokens: KnownToken[]) {
    for (const token of knownTokens) {
      const normalized = ethers.getAddress(token.address).toLowerCase();
      this.knownTokens.set(normalized, token);
      this.normalizedAddresses.add(normalized);
    }
  }

  /**
   * Check if an address is a known legitimate USDT
   */
  detect(tokenAddress: string, chainId: number): LayerResult {
    const normalized = ethers.getAddress(tokenAddress).toLowerCase();
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
  getKnownAddresses(chainId: number): string[] {
    return Array.from(this.knownTokens.values())
      .filter(t => t.chainId === chainId)
      .map(t => t.address);
  }

  /**
   * Check if address is in allowlist (simple boolean)
   */
  isAllowed(tokenAddress: string, chainId: number): boolean {
    const result = this.detect(tokenAddress, chainId);
    return result.passed;
  }

  /**
   * Get the known token info if address matches
   */
  getKnownToken(tokenAddress: string, chainId: number): KnownToken | null {
    const normalized = ethers.getAddress(tokenAddress).toLowerCase();
    const token = this.knownTokens.get(normalized);
    return token && token.chainId === chainId ? token : null;
  }
}

/**
 * Layer 2: Contract Verification Detector
 * Checks if contract source code is verified on Etherscan
 */

export interface EtherscanVerificationResponse {
  status: string;
  message: string;
  result: Array<{
    SourceCode: string;
    ABI: string;
    ContractName: string;
    CompilerVersion: string;
    OptimizationUsed: string;
    Runs: string;
    ConstructorArguments: string;
    EVMVersion: string;
    Library: string;
    LicenseType: string;
    Proxy: string;
    Implementation: string;
    SwarmSource: string;
  }>;
}

export class ContractVerificationDetector {
  private apiKey: string;
  private apiUrl: string;
  private cache: Map<string, { result: LayerResult; timestamp: number }> = new Map();
  private cacheTtl = 3600000; // 1 hour

  constructor(apiKey: string, apiUrl: string) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async detect(tokenAddress: string, chainId: number): Promise<LayerResult> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.result;
    }

    try {
      const url = `${this.apiUrl}?chainid=${chainId}&module=contract&action=getsourcecode&address=${tokenAddress}&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as EtherscanVerificationResponse;

      if (data.status !== '1' || !data.result || data.result.length === 0) {
        const result: LayerResult = {
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
      const isVerified: boolean = Boolean(contract.SourceCode && 
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
      } else {
        score = 10;
        message = 'Contract source code is NOT verified on Etherscan';
      }

      const result: LayerResult = {
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
    } catch (error) {
      const result: LayerResult = {
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

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Layer 3: Metadata Validation Detector
 * Validates token metadata (name, symbol, decimals, totalSupply)
 */

export interface MetadataValidationResult {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  isValidName: boolean;
  isValidSymbol: boolean;
  isValidDecimals: boolean;
  isReasonableSupply: boolean;
}

export class MetadataValidationDetector {
  private provider: ethers.Provider;
  private knownToken: KnownToken;
  private cache: Map<string, { result: LayerResult; timestamp: number }> = new Map();
  private cacheTtl = 300000; // 5 minutes

  constructor(provider: ethers.Provider, knownToken: KnownToken) {
    this.provider = provider;
    this.knownToken = knownToken;
  }

  async detect(tokenAddress: string): Promise<LayerResult> {
    const cacheKey = tokenAddress.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.result;
    }

    try {
      const contract = new ethers.Contract(
        tokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ],
        this.provider
      );

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().catch(() => ''),
        contract.symbol().catch(() => ''),
        contract.decimals().catch(() => 0),
        contract.totalSupply().catch(() => 0n)
      ]);

      const validation: MetadataValidationResult = {
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
      const messages: string[] = [];

      if (validation.isValidName) {
        score += 25;
        messages.push('Name matches');
      } else {
        messages.push(`Name mismatch: "${name}" vs "${this.knownToken.name}"`);
      }

      if (validation.isValidSymbol) {
        score += 25;
        messages.push('Symbol matches');
      } else {
        messages.push(`Symbol mismatch: "${symbol}" vs "${this.knownToken.symbol}"`);
      }

      if (validation.isValidDecimals) {
        score += 25;
        messages.push('Decimals match');
      } else {
        messages.push(`Decimals mismatch: ${decimals} vs ${this.knownToken.decimals}`);
      }

      if (validation.isReasonableSupply) {
        score += 25;
        messages.push('Supply in reasonable range');
      } else {
        messages.push(`Supply suspicious: ${totalSupply.toString()}`);
      }

      const result: LayerResult = {
        passed: score >= 75,
        score,
        weight: 0.2,
        message: messages.join('; '),
        details: validation as unknown as Record<string, unknown>
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      const result: LayerResult = {
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

  private isReasonableSupply(totalSupply: bigint): boolean {
    // USDT supply should be between 10B and 200B (with decimals)
    const minSupply = 10_000_000_000n * 10n ** BigInt(this.knownToken.decimals);
    const maxSupply = 200_000_000_000n * 10n ** BigInt(this.knownToken.decimals);
    return totalSupply >= minSupply && totalSupply <= maxSupply;
  }

  clearCache(): void {
    this.cache.clear();
  }
}