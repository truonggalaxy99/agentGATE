# Agent ID Hackathon — Submit Checklist (AgentGate)

## Campaign

- Binance Wallet × BNB Chain **Agent ID Hackathon**
- Submission: **2026-11-18 → 2026-12-09 08:00 UTC**
- Prize pool: **60,000 USDC**

## Eligibility checklist

- [x] Uses Agent ID (`name.ai`) for access / identity / agent execution
- [x] **Ownership-gated Agent login** — homepage verify (Binance AI deep link / privacy prompt → `checkIn`); dashboard after **fresh** on-chain checkIn; **device trust 24h** (`localStorage`); logout clears trust; never a public name→wallet lookup
- [x] Smart contract on BNB Chain (`contracts/AgentGate.sol`)
- [x] Contract **deployed** on BSC mainnet — `0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e`
- [x] Source **verified + open-source** on BscScan — https://bscscan.com/address/0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e#code
- [x] Repo public — https://github.com/truonggalaxy99/agentGATE
- [x] Trading UIs show **risk warnings**
- [x] No Agentic Wallet QR login / no seed collection / no confirm bypass
- [x] Approve defaults to **Exact** allowance (Unlimited requires explicit opt-in + warning)
- [x] Product branding is **AgentGate** (BNB Smart Chain = network name only; not official Binance/BNB impersonation)
- [x] Drive ≥1 Agent ID address interactions (Pioneer) — Activate/`checkIn` done
- [ ] Drive ≥30 Agent ID interactions for Innovation Award eligibility

## Campaign rules compliance

| Rule | AgentGate stance |
|------|------------------|
| No packaging Agent ID as “look up others’ wallets by name” | Agent path opens by your `name.ai` but **hides address/QR/balances** until ownership proven via AI Agent `checkIn` (or optional owning Web3 wallet). Wrong Web3 wallet does not unlock another person’s funds UI |
| No web QR / pairing-code login for Agentic Wallet | Receive QR is deposit address only after ownership-proven session |
| No server session to place orders on behalf of users | Static frontend; no custodial backend |
| Skills/prompts must not bypass user confirmation | Intent prompts mandate simulate → confirm → sign; `confirmBeforeSign: true` |
| No unauthorized transfers / silent unlimited approvals | No auto-transfer; Approve defaults Exact; Unlimited shows MaxUint256 warning |
| No seed / private key / API secret / pairing collection | Not collected |
| Contracts open-source + owner permissions disclosed | AgentGate: `transferOwnership` only; no mint/tax/pause/freeze/withdraw-user-funds. Launchpad tokens: mint/ownable disclosed in UI + prompt |
| Do not impersonate Binance/BNB in product name/domain | Product name **AgentGate**; domain `agentgate-hazel.vercel.app` |
| No promising passive income / auto money-making | Earn/risk copy rejects Simple Earn–style promises |
| Trading risk warnings on page | Present on Perp / Swap / Predict / Earn / Launch / Bridge / Approve |

## Submit fields

| Field | Value |
|-------|--------|
| Project name | AgentGate |
| Website | https://agentgate-hazel.vercel.app |
| Contract address(es) | Gate `0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e` · Pass `0xb346d2705Ec8F8f863CBdfd3F0B78aB766AEA4c2` · PulseMine `0x80d2e58C74c0b95E62cD46D295fd6b0B8d69a298` · AGPULSE `0xBFDCf46D62d0C701CcE89965C12716f95667dD60` |
| BscScan | Gate https://bscscan.com/address/0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e · PulseMine https://bscscan.com/address/0x80d2e58C74c0b95E62cD46D295fd6b0B8d69a298 |
| Agent ID usage | Ownership-gated access via Agent ID; on-chain `checkIn` / `logIntent` / `recordAction`; soulbound Pass `mintProof`; **Pulse Mode A** (`enterFree` 0.002 BNB → 24h `claimFree` refund 100% BNB + experimental AGPULSE); **Soft Ref** (`?ref=name.ai` → points → redeem trial AGPULSE, experimental / no promised returns). |
| Repo | https://github.com/truonggalaxy99/agentGATE |
| Reward address | _(your BSC address)_ |

### Pulse Mode A (owner permissions)

| Contract | Owner powers | User funds |
|----------|--------------|------------|
| AgentPulseMine | `transferOwnership`, `setBaseRewardPerShare` (decrease only) | Escrow BNB claimable **only** by the agent via `claimFree` / `claimFreeAll` — no owner withdraw |
| AgentPulseToken | `transferOwnership`, `setMinter` | No custody; mint only by PulseMine |

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

1. Hold Agent ID (`name.ai`) on **your** wallet
2. Open AgentGate → AI Agent tab → enter **your** `name.ai` → connect the owning wallet (ownership proof)
3. **Activate AgentGate** → on-chain `checkIn()` (or AI Agent prompt for the same)
4. Each Earn/Perp/Swap/Predict/Transfer intent requires AI Agent to call `logIntent` + `recordAction` before trading

## Scoring angle

- **Ecosystem Pioneer**: maximize unique Agent ID addresses calling AgentGate
- **Application Innovation**: Agent ID in core ownership-gated flow + Agentic Wallet intent UX + live product completion (≥30 Agent ID addresses)
