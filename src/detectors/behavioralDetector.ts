/**
 * Layer 4: Behavioral Analysis Detector
 * Analyzes holder count, transfer volume, contract age
 */

import { ethers } from 'ethers';
import { LayerResult, HolderAnalysis } from '../config/types';

export interface EtherscanTokenHolderResponse {
  status: string;
  message: string;
  result: Array<{
    TokenHolderQuantity: string;
    TokenHolderAddress: string;
    TokenHolderQuantityPercent: string;
  }>;
}

export interface EtherscanTokenTxResponse {
  status: string;
  message: string;
  result: Array<{
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
  }>;
}

export interface EtherscanContractCreationResponse {
  status: string;
  message: string;
  result: Array<{
    contractAddress: string;
    contractCreator: string;
    txHash: string;
    blockNumber: string;
    timestamp: string;
  }>;
}

export class BehavioralAnalysisDetector {
  private apiKey: string;
  private apiUrl: string;
  private chainId: number;
  private thresholds: {
    minHolderCount: number;
    minDailyTransfers: number;
    minContractAgeDays: number;
  };
  private cache: Map<string, { result: LayerResult; timestamp: number }> = new Map();
  private cacheTtl = 600000; // 10 minutes

  constructor(
    apiKey: string,
    apiUrl: string,
    chainId: number,
    thresholds: {
      minHolderCount: number;
      minDailyTransfers: number;
      minContractAgeDays: number;
    }
  ) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.chainId = chainId;
    this.thresholds = thresholds;
  }

  async detect(tokenAddress: string): Promise<LayerResult> {
    const cacheKey = `${this.chainId}:${tokenAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.result;
    }

    try {
      const [holderAnalysis, transferAnalysis, contractAge] = await Promise.all([
        this.getHolderAnalysis(tokenAddress),
        this.getTransferAnalysis(tokenAddress),
        this.getContractAge(tokenAddress)
      ]);

      let score = 0;
      const messages: string[] = [];
      const details: HolderAnalysis = {
        holderCount: holderAnalysis.holderCount,
        topHoldersPercentage: holderAnalysis.topHoldersPercentage,
        recentTransfers24h: transferAnalysis.recentTransfers24h,
        uniqueSenders24h: transferAnalysis.uniqueSenders24h,
        uniqueReceivers24h: transferAnalysis.uniqueReceivers24h
      };

      // Holder count scoring
      if (holderAnalysis.holderCount >= this.thresholds.minHolderCount) {
        score += 30;
        messages.push(`Holder count: ${holderAnalysis.holderCount} (✓)`);
      } else if (holderAnalysis.holderCount > 1000) {
        score += 15;
        messages.push(`Holder count: ${holderAnalysis.holderCount} (low)`);
      } else {
        messages.push(`Holder count: ${holderAnalysis.holderCount} (very low)`);
      }

      // Transfer volume scoring
      if (transferAnalysis.recentTransfers24h >= this.thresholds.minDailyTransfers) {
        score += 30;
        messages.push(`24h transfers: ${transferAnalysis.recentTransfers24h} (✓)`);
      } else if (transferAnalysis.recentTransfers24h > 10) {
        score += 15;
        messages.push(`24h transfers: ${transferAnalysis.recentTransfers24h} (low)`);
      } else {
        messages.push(`24h transfers: ${transferAnalysis.recentTransfers24h} (very low)`);
      }

      // Contract age scoring
      if (contractAge >= this.thresholds.minContractAgeDays) {
        score += 25;
        messages.push(`Contract age: ${contractAge} days (✓)`);
      } else if (contractAge > 7) {
        score += 10;
        messages.push(`Contract age: ${contractAge} days (new)`);
      } else {
        messages.push(`Contract age: ${contractAge} days (very new)`);
      }

      // Distribution scoring
      if (holderAnalysis.topHoldersPercentage < 80) {
        score += 15;
        messages.push('Token distribution: Healthy');
      } else if (holderAnalysis.topHoldersPercentage < 95) {
        score += 5;
        messages.push('Token distribution: Concentrated');
      } else {
        messages.push('Token distribution: Highly concentrated (rugpull risk)');
      }

      const result: LayerResult = {
        passed: score >= 60,
        score: Math.min(score, 100),
        weight: 0.1,
        message: messages.join('; '),
        details: details as unknown as Record<string, unknown>
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      const result: LayerResult = {
        passed: false,
        score: 0,
        weight: 0.1,
        message: `Behavioral analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  }

  private async getHolderAnalysis(tokenAddress: string): Promise<{
    holderCount: number;
    topHoldersPercentage: number;
  }> {
    try {
      const url = `${this.apiUrl}?chainid=${this.chainId}&module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=1&offset=100&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as EtherscanTokenHolderResponse;

      if (data.status !== '1' || !data.result || data.result.length === 0) {
        return { holderCount: 0, topHoldersPercentage: 100 };
      }

      const holderCount = parseInt(data.result[0]?.TokenHolderQuantity || '0');
      
      // Calculate top 10 holders percentage
      let top10Percentage = 0;
      for (let i = 0; i < Math.min(10, data.result.length); i++) {
        top10Percentage += parseFloat(data.result[i]?.TokenHolderQuantityPercent || '0');
      }

      return { holderCount, topHoldersPercentage: top10Percentage };
    } catch {
      return { holderCount: 0, topHoldersPercentage: 100 };
    }
  }

  private async getTransferAnalysis(tokenAddress: string): Promise<{
    recentTransfers24h: number;
    uniqueSenders24h: number;
    uniqueReceivers24h: number;
  }> {
    try {
      const url = `${this.apiUrl}?chainid=${this.chainId}&module=account&action=tokentx&contractaddress=${tokenAddress}&page=1&offset=1000&sort=desc&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as EtherscanTokenTxResponse;

      if (data.status !== '1' || !data.result) {
        return { recentTransfers24h: 0, uniqueSenders24h: 0, uniqueReceivers24h: 0 };
      }

      const now = Date.now() / 1000;
      const dayAgo = now - 86400;

      const recentTxs = data.result.filter(tx => parseInt(tx.timeStamp) > dayAgo);
      const senders = new Set(recentTxs.map(tx => tx.from.toLowerCase()));
      const receivers = new Set(recentTxs.map(tx => tx.to.toLowerCase()));

      return {
        recentTransfers24h: recentTxs.length,
        uniqueSenders24h: senders.size,
        uniqueReceivers24h: receivers.size
      };
    } catch {
      return { recentTransfers24h: 0, uniqueSenders24h: 0, uniqueReceivers24h: 0 };
    }
  }

  private async getContractAge(tokenAddress: string): Promise<number> {
    try {
      const url = `${this.apiUrl}?chainid=${this.chainId}&module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json() as EtherscanContractCreationResponse;

      if (data.status !== '1' || !data.result || data.result.length === 0) {
        return 0;
      }

      const timestamp = parseInt(data.result[0]?.timestamp || '0');
      const ageDays = (Date.now() / 1000 - timestamp) / 86400;
      return Math.floor(ageDays);
    } catch {
      return 0;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Layer 5: Bytecode Comparison Detector
 * Compares deployed bytecode with known legitimate USDT bytecode
 */

export class BytecodeComparisonDetector {
  private provider: ethers.Provider;
  private knownBytecodes: Map<number, string> = new Map();
  private cache: Map<string, { result: LayerResult; timestamp: number }> = new Map();
  private cacheTtl = 3600000; // 1 hour

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Set known bytecode for a chain (should be called during initialization)
   */
  async initializeKnownBytecodes(knownTokens: Array<{ address: string; chainId: number }>): Promise<void> {
    for (const token of knownTokens) {
      try {
        const bytecode = await this.provider.getCode(token.address);
        if (bytecode && bytecode !== '0x') {
          this.knownBytecodes.set(token.chainId, bytecode);
          console.log(`Loaded known bytecode for chain ${token.chainId}: ${bytecode.slice(0, 20)}...`);
        }
      } catch (error) {
        console.warn(`Failed to load bytecode for chain ${token.chainId}:`, error);
      }
    }
  }

  /**
   * Manually set known bytecode (useful for testing or if RPC fails)
   */
  setKnownBytecode(chainId: number, bytecode: string): void {
    this.knownBytecodes.set(chainId, bytecode);
  }

  async detect(tokenAddress: string, chainId: number): Promise<LayerResult> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.result;
    }

    try {
      const targetBytecode = await this.provider.getCode(tokenAddress);
      const knownBytecode = this.knownBytecodes.get(chainId);

      if (!knownBytecode) {
        const result: LayerResult = {
          passed: false,
          score: 50, // Neutral - can't compare
          weight: 0.05,
          message: 'No known bytecode available for comparison',
          details: { targetBytecodeLength: targetBytecode.length }
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      if (!targetBytecode || targetBytecode === '0x') {
        const result: LayerResult = {
          passed: false,
          score: 0,
          weight: 0.05,
          message: 'Target contract has no bytecode (not deployed or not a contract)',
          details: { targetBytecode }
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Exact match check
      const exactMatch = targetBytecode === knownBytecode;
      
      // Similarity analysis (simplified - in production use more sophisticated comparison)
      const similarityScore = this.calculateSimilarity(targetBytecode, knownBytecode);
      
      let score = 0;
      let message = '';

      if (exactMatch) {
        score = 100;
        message = 'Bytecode EXACTLY matches known legitimate USDT';
      } else if (similarityScore > 0.95) {
        score = 80;
        message = `Bytecode highly similar (${(similarityScore * 100).toFixed(1)}%) - possible proxy or upgrade`;
      } else if (similarityScore > 0.7) {
        score = 40;
        message = `Bytecode partially similar (${(similarityScore * 100).toFixed(1)}%) - suspicious`;
      } else {
        score = 0;
        message = `Bytecode completely different (${(similarityScore * 100).toFixed(1)}% similarity) - LIKELY FAKE`;
      }

      const differences = this.findDifferences(targetBytecode, knownBytecode);

      const result: LayerResult = {
        passed: exactMatch || similarityScore > 0.95,
        score,
        weight: 0.05,
        message,
        details: {
          exactMatch,
          similarityScore,
          targetBytecodeHash: this.hashBytecode(targetBytecode),
          knownBytecodeHash: this.hashBytecode(knownBytecode),
          differences: differences.slice(0, 10) // Limit to first 10
        }
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      const result: LayerResult = {
        passed: false,
        score: 0,
        weight: 0.05,
        message: `Bytecode comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: String(error) }
      };
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  }

  private calculateSimilarity(bytecode1: string, bytecode2: string): number {
    // Simple similarity based on common substrings
    // In production, use more sophisticated algorithms (Levenshtein, n-grams, etc.)
    const shorter = bytecode1.length < bytecode2.length ? bytecode1 : bytecode2;
    const longer = bytecode1.length >= bytecode2.length ? bytecode1 : bytecode2;
    
    if (longer.length === 0) return 0;
    
    let matches = 0;
    const chunkSize = 32; // Compare in 32-byte chunks
    
    for (let i = 0; i < shorter.length; i += chunkSize) {
      const chunk = shorter.slice(i, i + chunkSize);
      if (longer.includes(chunk)) {
        matches++;
      }
    }
    
    return matches / Math.ceil(longer.length / chunkSize);
  }

  private findDifferences(bytecode1: string, bytecode2: string): string[] {
    const differences: string[] = [];
    const maxLen = Math.max(bytecode1.length, bytecode2.length);
    const chunkSize = 64;
    
    for (let i = 0; i < maxLen; i += chunkSize) {
      const chunk1 = bytecode1.slice(i, i + chunkSize);
      const chunk2 = bytecode2.slice(i, i + chunkSize);
      
      if (chunk1 !== chunk2) {
        differences.push(`Offset ${i}: ${chunk1 || '(end)'} vs ${chunk2 || '(end)'}`);
      }
    }
    
    return differences;
  }

  private hashBytecode(bytecode: string): string {
    // Simple hash for identification
    let hash = 0;
    for (let i = 0; i < bytecode.length; i++) {
      const char = bytecode.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  clearCache(): void {
    this.cache.clear();
  }
}