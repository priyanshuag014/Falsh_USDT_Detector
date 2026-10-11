import { Request, Response, NextFunction } from 'express';
import { AuthenticatedClient } from './index';
declare global {
    namespace Express {
        interface Request {
            client?: AuthenticatedClient;
            clientId?: string;
        }
    }
}
export declare function apiKeyAuth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function jwtAuth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function optionalAuth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function requireTier(...allowedTiers: string[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function quotaCheck(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function usageTracking(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=middleware.d.ts.map