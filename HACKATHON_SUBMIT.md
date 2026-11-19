# Agent ID Hackathon — Submit Checklist (AgentGate)

## Campaign

- Binance Wallet × BNB Chain **Agent ID Hackathon**
- Submission: **2026-11-18 → 2026-12-09 08:00 UTC**
- Prize pool: **60,000 USDC**

## Eligibility checklist

- [x] Uses Agent ID (`name.ai`) for access / identity / agent execution
- [x] Smart contract on BNB Chain (`contracts/AgentGate.sol`)
- [x] Contract **deployed** on BSC mainnet — `0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e`
- [ ] Source **verified + open-source** on BscScan (`npm run verify:bsc` + public repo)
- [ ] Repo public
- [x] Trading UIs show **risk warnings**
- [x] No Agentic Wallet QR login / no seed collection / no confirm bypass
- [x] Drive ≥1 Agent ID address interactions (Pioneer) — Activate/`checkIn` done
- [ ] Drive ≥30 Agent ID interactions for Innovation Award eligibility

## Submit fields

| Field | Value |
|-------|--------|
| Project name | AgentGate |
| Website | Claim/permanent host: `npx vercel login` then `npx vercel --prod` (temp demo was issued during packaging; claim link expires) |
| Contract address(es) | `0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e` |
| BscScan | https://bscscan.com/address/0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e |
| Agent ID usage | Gate access via Agent ID NFT; on-chain `checkIn` / `logIntent` / `recordAction`; AI Agent intent handoff bound to Agent wallet (simulate → confirm → execute) |
| Repo | _(GitHub public URL)_ |
| Reward address | _(your BSC address)_ |

## Innovation scoring (official weights)

| Weight | Criteria |
|--------|----------|
| 30% | Agent ID Application Depth |
| 25% | Practicality & Feasibility |
| 25% | Product Completion |
| 20% | Innovation |

## Deploy / verify

```bash
cp .env.example .env
# PRIVATE_KEY=...
# BSCSCAN_API_KEY=...
npm install
npm run compile
npm run deploy:bsc
npm run verify:bsc
```

Then host `frontend/` and submit.

## How users generate on-chain interactions

1. Hold Agent ID (`name.ai`)
2. Open AgentGate → **Activate AgentGate (on-chain check-in)**  
   - EOA: signs `checkIn()`  
   - Agentic Wallet: AI Agent executes `checkIn()` from intent prompt
3. Each Earn/Perp/Swap/Predict/Transfer intent requires AI Agent to call `logIntent` + `recordAction` before trading

## Scoring angle

- **Ecosystem Pioneer**: maximize unique Agent ID addresses calling AgentGate
- **Application Innovation**: Agent ID in core flow + Agentic Wallet intent UX + live product completion (≥30 Agent ID addresses)
