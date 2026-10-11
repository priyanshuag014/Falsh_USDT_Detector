# Flash USDT Detector - Enterprise SaaS Platform

A production-ready, multi-tenant SaaS platform for detecting **Flash USDT** (fake USDT) scams across Ethereum and EVM-compatible chains.

## 🎯 The Problem

**Flash USDT** scams create fake ERC-20 tokens that perfectly mimic legitimate USDT:
- Same name: "Tether USD"
- Same symbol: "USDT" 
- Same decimals: 6
- **Different contract address** ← The only thing that matters

Victims receive these fake tokens and believe they've received real USDT.

## 🛡️ The Solution: 5-Layer Defense

| Layer | Check | Weight | Catches |
|-------|-------|--------|---------|
| **1. Address Allowlist** | Cryptographic address match | 40% | 99% of fakes |
| **2. Contract Verification** | Etherscan source verification | 25% | Unverified clones |
| **3. Metadata Validation** | Name, symbol, decimals, supply | 20% | Lazy metadata copies |
| **4. Behavioral Analysis** | Holders, volume, contract age | 10% | Newly deployed scams |
| **5. Bytecode Comparison** | Exact bytecode fingerprint | 5% | Proxy/upgraded fakes |

**Key Insight**: Layer 1 alone catches 99% of attacks. The real USDT contract address (`0xdAC17F958D2ee523a2206206994597C13D831ec7` on Ethereum) is **cryptographically impossible to spoof**.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MULTI-TENANT SAAS PLATFORM                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │ Client A    │  │ Client B    │  │ Client N            │     │
│  │ (Exchange)  │  │ (Wallet)    │  │ (DeFi Protocol)     │     │
│  │ Tokens:     │  │ Tokens:     │  │ Tokens:             │     │
│  │ USDT, USDC  │  │ USDT, BTC   │  │ Custom stablecoins  │     │
│  └──────┬──────┘  └──────┬──────┘  └─────────┬───────────┘     │
│         │                │                   │                  │
│         └────────────────┼───────────────────┘                  │
│                          ▼                                      │
│         ┌─────────────────────────────────────┐                │
│         │       TENANT ISOLATION LAYER        │                │
│         │  • Separate API keys                │                │
│         │  • Custom token allowlists          │                │
│         │  • Per-tenant alert thresholds      │                │
│         │  • Dedicated webhook endpoints      │                │
│         │  • Usage metering & billing         │                │
│         └─────────────────┬───────────────────┘                │
│                           ▼                                      │
│         ┌─────────────────────────────────────┐                │
│         │       SHARED DETECTION ENGINE       │                │
│         │  • 5-layer detection (core IP)      │                │
│         │  • Global threat intelligence       │                │
│         │  • Cross-tenant pattern matching    │                │
│         │  • Real-time blockchain monitoring  │                │
│         └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Ethereum RPC (Alchemy/Infura/QuickNode)
- Etherscan API V2 key

### Installation

```bash
# Clone and install
git clone <repo>
cd flash-usdt-detector
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Setup database
npx prisma generate
npx prisma migrate deploy

# Build
npm run build

# Start
npm start
```

### Docker Deployment

```bash
# Using docker-compose
docker-compose up -d

# Or build manually
docker build -t flash-usdt-detector .
docker run -p 3000:3000 --env-file .env flash-usdt-detector
```

## 📡 API Reference

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/known-tokens` | Known USDT addresses |
| GET | `/api/v1/chains` | Supported chains |
| GET | `/api/v1/quick-check/:address` | Instant allowlist check |

### Authenticated Endpoints (Requires `X-API-Key`)

| Method | Endpoint | Description | Quota |
|--------|----------|-------------|-------|
| POST | `/api/v1/check` | Full 5-layer detection | 1 per address |
| POST | `/api/v1/check/batch` | Batch check (max 100) | 1 per address |
| GET | `/api/v1/me` | Current client info | Free |
| GET | `/api/v1/me/stats` | Usage statistics | Free |
| GET | `/api/v1/me/tokens` | Client's allowed tokens | Free |
| POST | `/api/v1/me/tokens` | Add allowed token | Free |
| GET | `/api/v1/me/webhooks` | Client's webhooks | Free |
| POST | `/api/v1/me/webhooks` | Add webhook | Free |
| POST | `/api/v1/billing/checkout` | Create upgrade checkout | Free |
| POST | `/api/v1/billing/portal` | Billing portal URL | Free |

### Admin Endpoints (Requires PROFESSIONAL+ Tier)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/clients` | List all clients |
| POST | `/api/v1/admin/clients` | Create client |
| GET | `/api/v1/admin/clients/:id` | Get client |
| PATCH | `/api/v1/admin/clients/:id` | Update client |
| POST | `/api/v1/admin/clients/:id/rotate-key` | Rotate API key |
| GET | `/api/v1/threats` | Global threat intel |
| GET | `/api/v1/threat-stats` | Threat statistics |

### Example Usage

```bash
# Quick check (instant, no quota)
curl "https://api.yourdomain.com/api/v1/quick-check/0xdAC17F958D2ee523a2206206994597C13D831ec7"

# Full detection
curl -X POST "https://api.yourdomain.com/api/v1/check" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: fusd_abc123..." \
  -d '{"address": "0x1234567890123456789012345678901234567890"}'

# Batch check
curl -X POST "https://api.yourdomain.com/api/v1/check/batch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: fusd_abc123..." \
  -d '{"addresses": ["0x1234...", "0x5678..."]}'
```

## 📦 Client SDK

Install the TypeScript/JavaScript SDK:

```bash
npm install @flash-usdt/guard-sdk
```

```typescript
import { FlashUSDTGuard, createClient } from '@flash-usdt/guard-sdk';

// Create client
const guard = createClient({
  apiKey: 'fusd_abc123...',
  baseUrl: 'https://api.yourdomain.com',
  timeout: 30000,
  retries: 3,
});

// Quick check (instant, no quota)
const quick = await guard.quickCheck('0xdAC17F958D2ee523a2206206994597C13D831ec7');
console.log(quick.isLegitimate); // true

// Full detection
const result = await guard.check('0x1234567890123456789012345678901234567890');
console.log(result.riskScore); // 85
console.log(result.isLegitimate); // false
console.log(result.alerts); // [{ type: 'critical', title: 'FAKE USDT DETECTED', ... }]

// Batch check
const results = await guard.checkBatch([
  '0x1234567890123456789012345678901234567890',
  '0xdAC17F958D2ee523a2206206994597C13D831ec7'
]);

// Get threat intelligence
const threats = await guard.getThreats(50, 0, 70);
```

## 🔐 Advanced Evasion Detection

Even if attackers **verify their contract on Etherscan**, they still fail:

| Attack | Why It Fails |
|--------|--------------|
| Verify fake source code | Bytecode fingerprint differs |
| Deploy proxy contract | Proxy pattern detected |
| Match metadata | Supply/holders/age mismatch |
| Copy bytecode | Compiler version/optimization mismatch |
| Use upgradeable contract | Upgradeability flag detected |

**Deep Analysis Checks:**
- Bytecode compiler fingerprint
- Deployment anomalies (recent, proxy, upgradeable)
- Tokenomics (unauthorized minting, supply manipulation)
- Ownership concentration (rugpull indicators)
- Hidden malicious functions (mint, freeze, fee manipulation)

## 💰 Pricing Tiers

| Tier | Monthly | Quota | Features |
|------|---------|-------|----------|
| **Developer** | Free | 1,000 | API only, community support |
| **Starter** | $299 | 10,000 | Webhooks, custom allowlist, email support |
| **Professional** | $999 | 100,000 | Real-time WS, threat intel, priority support |
| **Enterprise** | Custom | Unlimited | Dedicated instance, SLA, on-premise |

## 🔧 Configuration

Key environment variables:

```env
# Ethereum RPC
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETH_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Etherscan
ETHERSCAN_API_KEY=YOUR_KEY
ETHERSCAN_API_URL=https://api.etherscan.io/v2/api

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/flash_usdt

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
API_KEY_PREFIX=fusd_

# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Quotas
QUOTA_DEVELOPER=1000
QUOTA_STARTER=10000
QUOTA_PROFESSIONAL=100000
QUOTA_ENTERPRISE=1000000
```

## 📊 Monitoring & Alerts

### Built-in Alert Channels
- **Console** - Colored output
- **File** - JSON logs
- **Discord** - Rich embeds
- **Telegram** - Formatted messages
- **Slack** - Attachments
- **Custom Webhooks** - JSON payload

### Alert Types
- `critical` - Fake USDT detected, bytecode mismatch
- `warning` - Unverified contract, metadata mismatch, low activity
- `info` - Legitimate USDT confirmed, high risk score

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- --testNamePattern="AddressAllowlistDetector"
```

## 📈 Threat Intelligence Network

When any client detects a fake USDT, **all clients benefit**:

1. Threat recorded in global database
2. Anonymized threat shared across network
3. Subsequent checks instantly flag known threats
4. Collaborative defense improves over time

## 🔒 Security

- **API Keys**: bcrypt hashed, never logged
- **Rate Limiting**: Per-client, configurable
- **CORS**: Configurable origins
- **Input Validation**: Strict address validation
- **Audit Logs**: All admin actions logged
- **Key Rotation**: Automated API key rotation

## 📄 License

MIT License - See LICENSE file for details.

## 🤝 Support

- **Documentation**: https://docs.flashusdtguard.com
- **API Reference**: https://api.flashusdtguard.com/docs
- **Status Page**: https://status.flashusdtguard.com
- **Email**: support@flashusdtguard.com

---

**Built for exchanges, wallets, DeFi protocols, and anyone who needs to verify USDT authenticity at scale.**