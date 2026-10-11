/**
 * Layer 1: Address Allowlist Detector
 * Primary defense - checks if token address matches known legitimate USDT
 */
import { KnownToken, LayerResult } from '../config/types';
import { ethers } from 'ethers';
export declare class AddressAllowlistDetector {
    private knownTokens;
    private normalizedAddresses;
    constructor(knownTokens: KnownToken[]);
    /**
     * Check if an address is a known legitimate USDT
     */
    detect(tokenAddress: string, chainId: number): LayerResult;
    /**
     * Get all known USDT addresses for a specific chain
     */
    getKnownAddresses(chainId: number): string[];
    /**
     * Check if address is in allowlist (simple boolean)
     */
    isAllowed(tokenAddress: string, chainId: number): boolean;
    /**
     * Get the known token info if address matches
     */
    getKnownToken(tokenAddress: string, chainId: number): KnownToken | null;
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
export declare class ContractVerificationDetector {
    private apiKey;
    private apiUrl;
    private cache;
    private cacheTtl;
    constructor(apiKey: string, apiUrl: string);
    detect(tokenAddress: string, chainId: number): Promise<LayerResult>;
    clearCache(): void;
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
export declare class MetadataValidationDetector {
    private provider;
    private knownToken;
    private cache;
    private cacheTtl;
    constructor(provider: ethers.Provider, knownToken: KnownToken);
    detect(tokenAddress: string): Promise<LayerResult>;
    private isReasonableSupply;
    clearCache(): void;
}
//# sourceMappingURL=addressDetector.d.ts.map