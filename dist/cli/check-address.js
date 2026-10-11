"use strict";
/**
 * CLI Tool for manual address checking
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const detectors_1 = require("../detectors");
const alertManager_1 = require("../alerts/alertManager");
const config_1 = require("../config");
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .scriptName('flash-usdt-check')
        .usage('$0 [options]')
        .option('address', {
        alias: 'a',
        type: 'string',
        description: 'Single token address to check'
    })
        .option('batch', {
        alias: 'b',
        type: 'string',
        description: 'Path to file with addresses (one per line)'
    })
        .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output file path (JSON)'
    })
        .option('json', {
        alias: 'j',
        type: 'boolean',
        default: false,
        description: 'Output as JSON'
    })
        .option('quick', {
        alias: 'q',
        type: 'boolean',
        default: false,
        description: 'Quick check (address allowlist only)'
    })
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        default: false,
        description: 'Verbose output'
    })
        .option('rpc-url', {
        type: 'string',
        description: 'Custom RPC URL (overrides .env)'
    })
        .option('ws-url', {
        type: 'string',
        description: 'Custom WebSocket URL (overrides .env)'
    })
        .option('etherscan-key', {
        type: 'string',
        description: 'Etherscan API key (overrides .env)'
    })
        .demandOption(['address'], 'Either --address or --batch is required')
        .help()
        .parse();
    const options = argv;
    // Validate config
    try {
        (0, config_1.validateConfig)();
    }
    catch (error) {
        console.error('❌ Configuration error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
    // Override config with CLI options
    const rpcUrl = options.rpcUrl || config_1.config.monitor.rpcUrl;
    const wsUrl = options.wsUrl || config_1.config.monitor.wsUrl;
    const etherscanKey = options.etherscanKey || config_1.config.monitor.etherscanApiKey;
    // Initialize provider
    const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
    // Initialize detector
    const detector = new detectors_1.FlashUSDTDetector(config_1.config.monitor, provider);
    // Initialize alert manager
    const alertManager = new alertManager_1.AlertManager(config_1.config.alerts);
    try {
        // Initialize detector (load bytecodes)
        await detector.initialize();
        let results = [];
        if (options.batch) {
            // Batch mode
            const addresses = readAddressesFromFile(options.batch);
            console.log(`📋 Checking ${addresses.length} addresses from ${options.batch}...`);
            for (let i = 0; i < addresses.length; i++) {
                const addr = addresses[i];
                if (!ethers_1.ethers.isAddress(addr)) {
                    console.warn(`⚠️  Skipping invalid address: ${addr}`);
                    continue;
                }
                if (options.verbose) {
                    console.log(`\n[${i + 1}/${addresses.length}] Checking ${addr}...`);
                }
                const result = options.quick
                    ? createQuickResult(addr, detector.quickCheck(addr))
                    : await detector.detect(addr);
                results.push(result);
                printResult(result, options.json ?? false, options.verbose ?? false);
            }
        }
        else if (options.address) {
            // Single address mode
            const address = options.address;
            if (!ethers_1.ethers.isAddress(address)) {
                console.error('❌ Invalid Ethereum address');
                process.exit(1);
            }
            const result = options.quick
                ? createQuickResult(address, detector.quickCheck(address))
                : await detector.detect(address);
            results.push(result);
            printResult(result, options.json ?? false, options.verbose ?? false);
        }
        // Save output if requested
        if (options.output) {
            const outputData = options.json
                ? JSON.stringify(results, null, 2)
                : results.map(r => formatTextResult(r)).join('\n\n');
            fs.writeFileSync(options.output, outputData);
            console.log(`\n💾 Results saved to ${options.output}`);
        }
        // Summary
        if (results.length > 1) {
            printSummary(results);
        }
    }
    catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        alertManager.close();
        await provider.destroy();
    }
}
function readAddressesFromFile(filePath) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}
function createQuickResult(address, isLegitimate) {
    return {
        tokenAddress: address,
        chainId: 1,
        timestamp: Date.now(),
        riskScore: isLegitimate ? 0 : 100,
        isLegitimate,
        layers: {
            addressMatch: {
                passed: isLegitimate,
                score: isLegitimate ? 100 : 0,
                weight: 1,
                message: isLegitimate ? 'Address matches known USDT' : 'Address does not match known USDT'
            },
            contractVerification: { passed: false, score: 0, weight: 0, message: 'Skipped (quick mode)' },
            metadataValidation: { passed: false, score: 0, weight: 0, message: 'Skipped (quick mode)' },
            behavioralAnalysis: { passed: false, score: 0, weight: 0, message: 'Skipped (quick mode)' },
            bytecodeComparison: { passed: false, score: 0, weight: 0, message: 'Skipped (quick mode)' }
        },
        details: {},
        alerts: isLegitimate ? [] : [{
                id: `quick-${Date.now()}`,
                type: 'critical',
                title: 'FAKE USDT DETECTED',
                message: `Address ${address} is not the legitimate USDT contract`,
                tokenAddress: address,
                chainId: 1,
                timestamp: Date.now()
            }]
    };
}
function printResult(result, asJson, verbose) {
    if (asJson) {
        console.log(JSON.stringify(formatResultForJson(result), null, 2));
        return;
    }
    const isLegit = result.isLegitimate;
    const statusIcon = isLegit ? '✅' : '🚨';
    const riskColor = result.riskScore >= 70 ? '\x1b[31m' : result.riskScore >= 40 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`\n${statusIcon} ${riskColor}Risk Score: ${result.riskScore}/100${reset}`);
    console.log(`   Address: ${result.tokenAddress}`);
    console.log(`   Legitimate: ${isLegit ? 'YES' : 'NO'}`);
    console.log(`   Chain: ${result.chainId}`);
    if (verbose) {
        console.log('\n   Layer Scores:');
        for (const [name, layer] of Object.entries(result.layers)) {
            const layerIcon = layer.passed ? '✓' : '✗';
            console.log(`     ${layerIcon} ${name}: ${layer.score}/100 (weight: ${layer.weight})`);
            console.log(`        ${layer.message}`);
        }
        if (result.alerts.length > 0) {
            console.log('\n   Alerts:');
            for (const alert of result.alerts) {
                const alertIcon = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
                console.log(`     ${alertIcon} [${alert.type.toUpperCase()}] ${alert.title}`);
                console.log(`        ${alert.message}`);
            }
        }
    }
}
function formatTextResult(result) {
    const lines = [
        `Address: ${result.tokenAddress}`,
        `Risk Score: ${result.riskScore}/100`,
        `Legitimate: ${result.isLegitimate ? 'YES' : 'NO'}`,
        `Chain: ${result.chainId}`,
        `Timestamp: ${new Date(result.timestamp).toISOString()}`,
        '',
        'Layer Scores:'
    ];
    for (const [name, layer] of Object.entries(result.layers)) {
        lines.push(`  ${name}: ${layer.score}/100 - ${layer.message}`);
    }
    if (result.alerts.length > 0) {
        lines.push('', 'Alerts:');
        for (const alert of result.alerts) {
            lines.push(`  [${alert.type.toUpperCase()}] ${alert.title}: ${alert.message}`);
        }
    }
    return lines.join('\n');
}
function formatResultForJson(result) {
    return {
        tokenAddress: result.tokenAddress,
        chainId: result.chainId,
        timestamp: result.timestamp,
        riskScore: result.riskScore,
        isLegitimate: result.isLegitimate,
        layers: Object.fromEntries(Object.entries(result.layers).map(([k, v]) => [k, {
                passed: v.passed,
                score: v.score,
                weight: v.weight,
                message: v.message
            }])),
        alerts: result.alerts.map(a => ({
            id: a.id,
            type: a.type,
            title: a.title,
            message: a.message,
            timestamp: a.timestamp
        }))
    };
}
function printSummary(results) {
    const legitimate = results.filter(r => r.isLegitimate).length;
    const fake = results.filter(r => !r.isLegitimate).length;
    const highRisk = results.filter(r => r.riskScore >= 70).length;
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total checked: ${results.length}`);
    console.log(`✅ Legitimate: ${legitimate}`);
    console.log(`🚨 Fake/High Risk: ${fake}`);
    console.log(`⚠️  High Risk (score ≥70): ${highRisk}`);
    if (fake > 0) {
        console.log('\n⚠️  FAKE USDT ADDRESSES DETECTED:');
        results
            .filter(r => !r.isLegitimate)
            .forEach(r => console.log(`   ${r.tokenAddress} (risk: ${r.riskScore})`));
    }
}
// Run if executed directly
main().catch(console.error);
//# sourceMappingURL=check-address.js.map