"use strict";
/**
 * Flash USDT Guard SDK
 *
 * TypeScript/JavaScript client for the Flash USDT Guard API
 *
 * @package @flash-usdt/guard-sdk
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDKError = exports.NetworkError = exports.QuotaExceededError = exports.AuthError = exports.FlashUSDTGuard = void 0;
var FlashUSDTGuard_1 = require("./FlashUSDTGuard");
Object.defineProperty(exports, "FlashUSDTGuard", { enumerable: true, get: function () { return FlashUSDTGuard_1.FlashUSDTGuard; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "AuthError", { enumerable: true, get: function () { return errors_1.AuthError; } });
Object.defineProperty(exports, "QuotaExceededError", { enumerable: true, get: function () { return errors_1.QuotaExceededError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return errors_1.NetworkError; } });
Object.defineProperty(exports, "SDKError", { enumerable: true, get: function () { return errors_1.SDKError; } });
//# sourceMappingURL=index.js.map