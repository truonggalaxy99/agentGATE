# AgentGate

Agent ID–gated Agentic Wallet dApp for the **Binance Wallet × BNB Chain Agent ID Hackathon**.

## Live deployment (BSC mainnet)

| Item | Value |
|------|--------|
| Contract | [`0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e`](https://bscscan.com/address/0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e) |
| Network | BNB Smart Chain (chainId `56`) |
| Agent ID NFT | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| Frontend config | `frontend/config.js` (auto-filled by deploy script) |

## What it does

- Verifies non-transferable Agent ID (`name.ai`) on BNB Chain
- **Dual entry:** Web3 wallet (direct sign) × AI Agent (`name.ai` + intent handoff)
- Dashboard: balances, Send / Receive / Swap, Earn intent, Perp, prediction markets
- **AI Agent Intent handoff** — structured prompt + JSON for Claude / Codex / Binance Agentic Wallet (`simulate → confirm → execute`)
- On-chain `AgentGate`: `checkIn`, `logIntent`, `recordAction` (identity gate + audit trail, **no fund custody**)

## Agent ID usage

| Feature | How Agent ID is used |
|--------|----------------------|
| Access | Only Agent ID holders can call gated contract methods (`onlyAgent`) |
| Identity | Dashboard shows `name.ai` + verified badge |
| Execution | Intents bind to Agent wallet; AI agent must simulate before signing |
| Metrics | `checkIn` / `logIntent` / `recordAction` emit events for on-chain interaction counts |

## Demo flow (hackathon judges)

1. Open frontend → choose **AI Agent** → enter `name.ai`
2. Tap **Activate AgentGate** → copy prompt → paste into Codex / Claude / Binance Agent
3. Agent calls `checkIn()` on BSC (identity only, no funds moved)
4. Use **Earn / Swap / Perp / Predict** → same intent handoff; prompts **require** `logIntent` + `recordAction` before the market action

## Smart contract

- Path: `contracts/AgentGate.sol`
- Owner permission: `transferOwnership` only (no mint / tax / pause / freeze / withdraw-user-funds)
- Never custodies user assets

### Deploy (BSC mainnet)

```bash
cp .env.example .env
# PRIVATE_KEY=...
# BSCSCAN_API_KEY=...   # for BscScan verify
npm install
npm run compile
npm run deploy:bsc
npm run verify:bsc
```

### Verify on BscScan

```bash
# set BSCSCAN_API_KEY in .env (https://bscscan.com/myapikey or Etherscan API key with BSC)
npm run verify:bsc
```

Sourcify is also enabled in `hardhat.config.js` as a fallback when verifying.

## Frontend

Serve the static `frontend/` folder (not `file://`):

```bash
npx --yes serve frontend -p 3456
```

### Host (public URL for submit)

- **Vercel:** `npx vercel` from repo root (`vercel.json` publishes `frontend/`)
- **Netlify:** drag-drop `frontend/` or connect repo (`netlify.toml` publish = `frontend`)

## Safety (hackathon red lines)

- No Agentic Wallet QR login on third-party pages
- Trading screens show risk warnings
- Intent prompts require simulate + user/agent confirmation — no confirm bypass
- Contract does not move user funds
- No collection of seed phrases / private keys / pairing codes

## Submit pack

See `HACKATHON_SUBMIT.md`.

| Field | Value |
|-------|--------|
| Project name | AgentGate |
| Website | _(host `frontend/` then paste URL)_ |
| Contract | `0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e` |
| Repo | _(public GitHub URL)_ |
| Hashtags | `#BinanceWalletHackathon` `#AgenticWallet` |
