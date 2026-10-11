export interface ThreatIntelRecord {
    address: string;
    chainId: number;
    riskScore: number;
    layers: any;
    firstSeenAt: Date;
    lastSeenAt: Date;
    reporterCount: number;
    status: 'ACTIVE' | 'RESOLVED' | 'FALSE_POSITIVE';
}
export declare class ThreatIntelService {
    private static CACHE_TTL;
    private static cache;
    static reportThreat(clientId: string, detection: any): Promise<{
        threatId: string;
        isNew: boolean;
    }>;
    static checkThreat(address: string, chainId: number): Promise<ThreatIntelRecord | null>;
    static getGlobalThreats(limit?: number, offset?: number, minRiskScore?: number): Promise<{
        threats: ThreatIntelRecord[];
        total: number;
    }>;
    static getThreatDetails(threatId: string): Promise<any>;
    static markFalsePositive(threatId: string, clientId: string): Promise<boolean>;
    static resolveThreat(threatId: string): Promise<boolean>;
    static getClientThreatHistory(clientId: string, limit?: number): Promise<any[]>;
    static getThreatStats(): Promise<any>;
    private static invalidateCache;
    private static extractSymbol;
}
//# sourceMappingURL=service.d.ts.map