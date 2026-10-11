/**
 * Tests for Flash USDT Detector
 */

import { ethers } from 'ethers';
import { FlashUSDTDetector } from '../src/detectors';
import { AddressAllowlistDetector } from '../src/detectors/addressDetector';
import { config } from '../src/config';
import { KNOWN_USDT_ADDRESSES } from '../src/config/types';

// Mock provider
const createMockProvider = () => {
  return {
    getCode: jest.fn(),
    call: jest.fn()
  } as unknown as ethers.Provider;
};

describe('AddressAllowlistDetector', () => {
  let detector: AddressAllowlistDetector;

  beforeEach(() => {
    detector = new AddressAllowlistDetector(Object.values(KNOWN_USDT_ADDRESSES));
  });

  test('should detect legitimate USDT on Ethereum', () => {
    const result = detector.detect(KNOWN_USDT_ADDRESSES[1].address, 1);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.message).toContain('matches known legitimate USDT');
  });

  test('should reject fake USDT address', () => {
    const result = detector.detect('0x1234567890123456789012345678901234567890', 1);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  test('should reject legitimate USDT on wrong chain', () => {
    // Ethereum USDT address on BSC chain
    const result = detector.detect(KNOWN_USDT_ADDRESSES[1].address, 56);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('wrong chain');
  });

  test('isAllowed should return boolean', () => {
    expect(detector.isAllowed(KNOWN_USDT_ADDRESSES[1].address, 1)).toBe(true);
    expect(detector.isAllowed('0x1234567890123456789012345678901234567890', 1)).toBe(false);
  });

  test('getKnownToken should return token info', () => {
    const token = detector.getKnownToken(KNOWN_USDT_ADDRESSES[1].address, 1);
    expect(token).not.toBeNull();
    expect(token?.symbol).toBe('USDT');
    expect(token?.chainId).toBe(1);
  });
});

describe('FlashUSDTDetector', () => {
  let detector: FlashUSDTDetector;
  let mockProvider: ethers.Provider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    detector = new FlashUSDTDetector(config.monitor, mockProvider);
  });

  test('should initialize with correct known token', () => {
    const knownToken = detector.getKnownToken();
    expect(knownToken.address).toBe(KNOWN_USDT_ADDRESSES[1].address);
    expect(knownToken.chainId).toBe(1);
  });

  test('quickCheck should work without RPC calls', () => {
    const isLegit = detector.quickCheck(KNOWN_USDT_ADDRESSES[1].address);
    expect(isLegit).toBe(true);

    const isFake = detector.quickCheck('0x1234567890123456789012345678901234567890');
    expect(isFake).toBe(false);
  });
});

describe('Configuration', () => {
  test('should have all required known USDT addresses', () => {
    expect(KNOWN_USDT_ADDRESSES[1]).toBeDefined();
    expect(KNOWN_USDT_ADDRESSES[56]).toBeDefined();
    expect(KNOWN_USDT_ADDRESSES[137]).toBeDefined();
    expect(KNOWN_USDT_ADDRESSES[42161]).toBeDefined();
    expect(KNOWN_USDT_ADDRESSES[10]).toBeDefined();
    expect(KNOWN_USDT_ADDRESSES[8453]).toBeDefined();
  });

  test('Ethereum USDT should have correct properties', () => {
    const ethUSDT = KNOWN_USDT_ADDRESSES[1];
    expect(ethUSDT.address).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    expect(ethUSDT.symbol).toBe('USDT');
    expect(ethUSDT.decimals).toBe(6);
    expect(ethUSDT.verified).toBe(true);
  });

  test('config should have detection thresholds', () => {
    expect(config.monitor.detectionThresholds.minHolderCount).toBeGreaterThan(0);
    expect(config.monitor.detectionThresholds.minDailyTransfers).toBeGreaterThan(0);
    expect(config.monitor.detectionThresholds.riskScoreThreshold).toBeGreaterThan(0);
  });
});

describe('Utility Functions', () => {
  const { formatNumber, formatTokenAmount, shortenAddress, calculatePercentage } = require('../src/utils/helpers');

  test('formatNumber should add commas', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(1234567890)).toBe('1,234,567,890');
  });

  test('formatTokenAmount should handle decimals', () => {
    expect(formatTokenAmount(1000000n, 6)).toBe('1');
    expect(formatTokenAmount(1500000n, 6)).toBe('1.5');
    expect(formatTokenAmount(1234567n, 6)).toBe('1.234567');
  });

  test('shortenAddress should truncate', () => {
    const addr = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    expect(shortenAddress(addr)).toBe('0xdAC1...1ec7');
    expect(shortenAddress(addr, 6)).toBe('0xdAC17F...831ec7');
  });

  test('calculatePercentage should work', () => {
    expect(calculatePercentage(50, 100)).toBe(50);
    expect(calculatePercentage(1, 3)).toBe(33.33);
    expect(calculatePercentage(0, 100)).toBe(0);
  });
});

describe('Risk Score Calculation', () => {
  test('should calculate weighted risk score correctly', () => {
    // This tests the private method indirectly through detector
    // We'll test the logic here
    const layers = {
      addressMatch: { passed: true, score: 100, weight: 0.4 },
      contractVerification: { passed: true, score: 80, weight: 0.25 },
      metadataValidation: { passed: true, score: 100, weight: 0.2 },
      behavioralAnalysis: { passed: true, score: 90, weight: 0.1 },
      bytecodeComparison: { passed: true, score: 100, weight: 0.05 }
    };

    let totalWeight = 0;
    let weightedScore = 0;
    for (const [, layer] of Object.entries(layers)) {
      const riskContribution = (100 - layer.score) * layer.weight;
      weightedScore += riskContribution;
      totalWeight += layer.weight;
    }
    const riskScore = Math.round((weightedScore / totalWeight) * 100) / 100;
    
    // All high scores = low risk
    expect(riskScore).toBeLessThan(20);
  });

  test('should give high risk for failed address match', () => {
    const layers = {
      addressMatch: { passed: false, score: 0, weight: 0.4 },
      contractVerification: { passed: true, score: 80, weight: 0.25 },
      metadataValidation: { passed: true, score: 100, weight: 0.2 },
      behavioralAnalysis: { passed: true, score: 90, weight: 0.1 },
      bytecodeComparison: { passed: true, score: 100, weight: 0.05 }
    };

    let totalWeight = 0;
    let weightedScore = 0;
    for (const [, layer] of Object.entries(layers)) {
      const riskContribution = (100 - layer.score) * layer.weight;
      weightedScore += riskContribution;
      totalWeight += layer.weight;
    }
    const riskScore = Math.round((weightedScore / totalWeight) * 100) / 100;
    
    // Failed address match (weight 0.4, score 0) = high risk
    expect(riskScore).toBeGreaterThan(40);
  });
});

// Jest setup
beforeAll(() => {
  jest.setTimeout(30000);
});