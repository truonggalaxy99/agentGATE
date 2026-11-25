const AGENT_ID_CONTRACT = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const AGENT_ID_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function ownerOfHandle(string handle) external view returns (address)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)"
];
const AGENT_GATE_ABI = [
    "function hasAgentID(address user) view returns (bool)",
    "function checkIn()",
    "function logIntent(bytes32 intentType, bytes32 intentHash, string summary)",
    "function recordAction(string action)",
    "function activated(address) view returns (bool)",
    "function lastCheckIn(address) view returns (uint256)",
    "function totalCheckIns() view returns (uint256)",
    "function uniqueAgents() view returns (uint256)"
];
const BSC_CHAIN_HEX = "0x38";
const BSC_RPC = "https://bsc-dataseed.binance.org/";

function getAgentGateAddress() {
    const cfg = window.AGENT_GATE_CONFIG || {};
    return cfg.address || "";
}

function getAgentGateContract(signerOrProvider) {
    const addr = getAgentGateAddress();
    if (!addr || !ethers.utils.isAddress(addr)) return null;
    return new ethers.Contract(addr, AGENT_GATE_ABI, signerOrProvider);
}

async function refreshGateStatus(address = currentDashboardAddress) {
    const el = document.getElementById("gateStatus");
    if (!el) return;
    const gateAddr = getAgentGateAddress();
    if (!gateAddr) {
        el.className = "gate-status";
        el.innerText = t("gateNoDeploy");
        return;
    }
    try {
        const gate = getAgentGateContract(getReadProvider());
        const activated = await gate.activated(address);
        const last = await gate.lastCheckIn(address);
        if (activated && last && last.gt(0)) {
            el.className = "gate-status ok";
            el.innerText = t("gateOk");
            // Ownership for Agent path is session-based (homepage verify) — do not unlock from permanent activated alone
        } else {
            el.className = "gate-status";
            el.innerText = t("gateNeedActivate");
        }
    } catch (_) {
        el.className = "gate-status";
        el.innerText = t("gateReadFail");
    }
}

async function onChainCheckIn() {
    const gateAddr = getAgentGateAddress();
    // Luồng AI Agent: luôn tạo prompt handoff (kể cả chưa deploy — ghi rõ trong prompt)
    if (!isWeb3Mode || !signer) {
        if (!gateAddr) showToast(t("gateDeployAlert"), 4200);
        const intent = buildAgentIntent("gate.checkIn", {
            contract: gateAddr || null,
            method: "checkIn()",
            deployRequired: !gateAddr
        });
        const summary = gateAddr
            ? `Call AgentGate.checkIn() on contract ${gateAddr} from my Agent ID wallet. This only registers identity access; it does not move funds.`
            : `AgentGate contract address is not set yet (frontend/config.js). After deploy, call checkIn() from my Agent ID wallet. This only registers identity; it does not move funds.`;
        const prompt = openIntentHandoff("AgentGate checkIn", intent, summary);
        navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
        return;
    }
    if (!gateAddr) {
        showToast(t("gateDeployAlert"), 4500);
        return;
    }
    try {
        setLoading(true);
        const eth = getWalletProvider();
        await ensureBscNetwork(eth);
        provider = new ethers.providers.Web3Provider(eth, "any");
        signer = provider.getSigner();
        const gate = getAgentGateContract(signer);
        const tx = await gate.checkIn();
        showToast(t("toastCheckIn"));
        await tx.wait(1);
        showToast(t("toastCheckInOk"));
        await refreshGateStatus(await signer.getAddress());
    } catch (err) {
        showToast(`${t("gateCheckFail")}: ${formatTxError(err)}`, 4500);
    } finally {
        setLoading(false);
    }
}

async function onChainLogIntent(intent, summary) {
    const gateAddr = getAgentGateAddress();
    if (!gateAddr || !isWeb3Mode || !signer) return null;
    try {
        const eth = getWalletProvider();
        await ensureBscNetwork(eth);
        provider = new ethers.providers.Web3Provider(eth, "any");
        signer = provider.getSigner();
        const gate = getAgentGateContract(signer);
        const intentType = ethers.utils.id(intent.type || "unknown");
        const intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(intent)));
        const tx = await gate.logIntent(intentType, intentHash, (summary || intent.type || "").slice(0, 180));
        await tx.wait(1);
        showToast(t("toastIntentLogged"));
        return tx.hash;
    } catch (err) {
        console.log("logIntent skipped:", err.message || err);
        return null;
    }
}
const ERC20_MIN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];
const DASH_TOKENS = [
    { id: "BNB", symbol: "BNB", name: "BNB", decimals: 18, address: null, native: true, icon: "https://cryptologos.cc/logos/bnb-bnb-logo.png" },
    { id: "USDT", symbol: "USDT", name: "Tether USD", decimals: 18, address: "0x55d398326f99059fF775485246999027B3197955", native: false, stable: true, icon: "https://cryptologos.cc/logos/tether-usdt-logo.png" },
    { id: "USDC", symbol: "USDC", name: "USD Coin", decimals: 18, address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", native: false, stable: true, icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png" },
    { id: "BTCB", symbol: "BTCB", name: "Bitcoin BEP20", decimals: 18, address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", native: false, icon: "https://cryptologos.cc/logos/bitcoin-btc-logo.png" },
    { id: "ETH", symbol: "ETH", name: "Ethereum", decimals: 18, address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", native: false, icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png" },
    { id: "CAKE", symbol: "CAKE", name: "PancakeSwap", decimals: 18, address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", native: false, icon: "https://cryptologos.cc/logos/pancakeswap-cake-logo.png" }
];

let currentLang = localStorage.getItem("agentgate_lang") || "vi";
let currentTheme = localStorage.getItem("agentgate_theme") || "dark";
let provider, signer, userAddress = "";
let currentBalance = ethers.BigNumber.from(0);
let perpSide = "Long";
let isWeb3Mode = false;
let entryFlow = localStorage.getItem("agentgate_flow") === "web3" ? "web3" : "agent";
let loginTab = entryFlow;
let injectedProvider = null;
let eip6963Providers = [];
let walletChoiceList = [];
let currentAgentAddress = "";
let currentDashboardAddress = "";
let currentAgentName = "";
let priceCache = { BNB: 0, ETH: 0, BTCB: 0, CAKE: 0, USDT: 1, USDC: 1 };
let portfolioRefreshTimer = null;
let balanceHidden = localStorage.getItem("agentgate_hide_balance") === "1";
// Phải khai báo sớm — updateUI → applyModeChrome chạy trong initSettingsUi (trước block Swap)
let dashWorkspacePanel = localStorage.getItem("agentgate_dash_panel") || "trade";
/** "web3" | "agentProof" — picker ví dùng chung / chứng minh chủ Agent ID (tuỳ chọn) */
let walletConnectPurpose = "web3";
/** Handle/input đang chờ (agent login / optional wallet proof) */
let pendingAgentLogin = null;
/** AI Agent path: đã chứng minh ownership trong phiên trình duyệt hiện tại */
let agentOwnershipVerified = false;
const AGENT_TRUST_KEY = "agentgate_trust_v1";
const AGENT_TRUST_MS = 24 * 60 * 60 * 1000; // 24h trên máy này
const BINANCE_AI_URL = "https://www.binance.com/en/agent-os";
let agentVerifyPollTimer = null;
let agentVerifyStartedAt = 0; // unix sec — checkIn phải mới hơn mốc này
let agentVerifyOwner = "";
let agentVerifyHandle = "";
let agentVerifySessionId = "";

const I18N = {
    vi: {
        settings: "Cài đặt", language: "Ngôn ngữ", theme: "Giao diện", themeLight: "Sáng", themeDark: "Tối",
        howto: "Cách dùng", howtoTitle: "Cách dùng AI Agent", collapse: "Thu gọn", live: "Live",
        howtoNote: "Quy tắc vàng: AgentGate không tự ký. AI Agent phải simulate trước — bạn confirm mới execute. Chỉ mạng BNB Smart Chain. Không phải lời khuyên đầu tư.",
        howtoSteps: [
            "<b>1. Nhập Agent ID của bạn</b> — <em>name.ai</em> trên trang chủ (claim trong Binance App nếu chưa có). Không dùng để tra ví người khác.",
            "<b>2. Xác minh</b> — mở Binance AI (hoặc copy prompt) → checkIn. On-chain OK → vào dashboard. <em>Máy này tin 24 giờ</em>; hết hạn / Đăng xuất mới hỏi lại.",
            "<b>3. Chọn tay / chế độ</b> — trên dashboard: <em>Perp</em>, <em>Dự đoán</em>, <em>Launch</em>, Gửi / Nhận / Swap / Earn, hoặc hàng <em>AI Agent tools</em> (Approve, Bridge, Cancel).",
            "<b>4. Điền form như app thật</b> — ví dụ Perp (Market/Limit/Stop), Earn (Deposit/Withdraw/Claim), Launch Token/NFT, Approve spender, Bridge chain…",
            "<b>5. Chốt → tạo Prompt</b> — bấm nút chính; AgentGate mở intent + <em>tự copy prompt</em> vào clipboard.",
            "<b>6. Dán vào AI Agent</b> — Claude / Codex / Binance Agent / TWAK. Agent đọc INTENT_JSON, <em>simulate trước</em>, báo rủi ro, rồi chờ bạn confirm mới ký/broadcast.",
            "<b>7. On-chain audit</b> — prompt yêu cầu agent gọi <em>logIntent</em> rồi <em>recordAction</em> trên AgentGate trước khi đụng tiền (khi contract đã cấu hình).",
            "<b>8. Theo dõi lại</b> — xem <em>AI Agent intents gần đây</em> để mở lại / copy; Perp Limit/Stop có thể hủy bằng tool <em>Cancel</em>; token list dùng ⋮ Manage như MetaMask."
        ],
        predict: "Dự đoán", estBalance: "Số dư ước tính", pnlToday: "PNL hôm nay",
        activateGate: "Activate AgentGate (on-chain check-in)",
        gateOk: "Đã check-in on-chain ✓", gateNeedActivate: "Chưa check-in — bấm Activate",
        gateNoDeploy: "Chưa deploy AgentGate — set address trong config.js", gateReadFail: "Không đọc được trạng thái gate",
        send: "Gửi", receive: "Nhận", swap: "Swap", check: "Check",
        subtitle: "Chọn một luồng để bắt đầu — Web3 ví thường hoặc AI Agent (Agent ID của bạn).",
        placeholder: "ví dụ: yourname.ai", connect: "Kết nối ví", connectWeb3: "Kết nối ví", connected: "Đã kết nối",
        loginDivider: "hoặc mở bằng Agent ID", loginTitle: "AgentGate",
        flowWeb3: "Web3 Wallet", flowAgent: "AI Agent", flowAbout: "Giới thiệu",
        flowWeb3Desc: "Kết nối ví → số dư → Gửi / Nhận / Swap / Earn (Venus). Perp & Predict mở Swap on-chain. DeFi tab sắp ra mắt.",
        flowAgentDesc: "Luồng AI Agent: nhập name.ai → xác minh bằng Binance AI / prompt (không lộ tên/ví) → vào dashboard. Máy này tin 24 giờ; hết hạn mới xác minh lại. Không dùng để tra ví người khác.",
        aboutKicker: "Binance Wallet × BNB Chain · Agent ID Hackathon",
        aboutTitle: "Về AgentGate",
        aboutTagline: "Cổng ownership-gated: chỉ Agent ID của bạn mới mở dashboard Web3 × AI Agent trên BNB Smart Chain.",
        aboutMetricLabel: "Agent ID đã tương tác on-chain",
        aboutP1: "AgentGate chứng minh bạn sở hữu name.ai bằng checkIn on-chain (Binance AI / prompt riêng tư, hoặc ví chủ). Sau đó mới mở số dư, Swap / Perp / Predict / Earn và công cụ Approve · Bridge · Cancel.",
        aboutP2: "Luồng AI Agent luôn simulate → confirm → execute. AgentGate không tự ký, không lưu seed / private key, không đăng nhập Agentic Wallet bằng QR trên web.",
        aboutPoint1: "Hai lối vào: Web3 Wallet hoặc AI Agent (Agent ID)",
        aboutPoint2: "Trust thiết bị 24 giờ sau khi xác minh; Đăng xuất xoá trust",
        aboutPoint3: "Intent on-chain: checkIn · logIntent · recordAction",
        aboutPoint4: "Không phải công cụ tra ví người khác theo tên",
        aboutRoadmapTitle: "Tầm nhìn",
        aboutRoadmapNote: "Hiện có → hướng dài hạn. Tầm nhìn kỹ thuật — không cam kết tự trade / kiếm tiền hộ. Mọi thao tác tài sản vẫn cần user confirm.",
        aboutVisionNow: "Hiện có",
        aboutVisionNext: "Tầm nhìn",
        aboutVisionNow1: "Identity gate bằng <code>name.ai</code>",
        aboutVisionNow2: "Intent → simulate → user confirm → ký",
        aboutVisionNow3: "Audit on-chain (<code>checkIn</code> / <code>logIntent</code>)",
        aboutVisionNow4: "Dual Web3 × Agent",
        aboutVisionNext1: "Agent chạy trong permission / hạn mức user đã cấp — ít bước hơn, vẫn có kiểm soát",
        aboutVisionNext2: "UX một chạm như CEX (vẫn confirm khi đụng tài sản)",
        aboutVisionNext3: "Agent hiểu rủi ro sâu + tuân thủ policy cá nhân",
        aboutVisionNext4: "Liquidity / social / distribution riêng",
        aboutVisionNext5: "<b>Triển khai AI như ChatGPT, Grok, Claude ngay trên Dashboard làm việc</b>",
        aboutDisclaimer: "Dự án cộng đồng cho hackathon Agent ID — không phải sản phẩm chính thức của Binance / BNB Chain, không được tài trợ hay bảo chứng bởi Binance.",
        aboutLinkBsc: "Hợp đồng trên BscScan",
        aboutLinkGh: "Mã nguồn trên GitHub",
        aboutFeedbackTitle: "Liên hệ / Feedback",
        aboutFeedbackHint: "Góp ý sản phẩm hoặc hỏi kỹ thuật — không dùng để đăng nhập ví.",
        aboutBadge: "DỰ ÁN CỘNG ĐỒNG",
        aboutCtaAgent: "Vào AI Agent",
        aboutCtaWeb3: "Vào Web3",
        aboutSubtitle: "AgentGate là gì, Agent ID dùng ra sao, và liên kết hợp đồng / mã nguồn.",
        pillWeb3: "MetaMask / Binance Wallet", pillDirect: "Ký trực tiếp",
        web3Step1: "Cài / mở MetaMask hoặc Binance Wallet", web3Step2: "Kết nối ví trên BNB Smart Chain", web3Step3: "Gửi / Swap / trade trực tiếp bằng ví",
        brandWeb3: "Web3 Wallet · BNB Smart Chain", brandAgent: "Agentic Wallet · BNB Smart Chain",
        loginStep1: "Nhập Agent ID (name.ai) của bạn",
        loginStep2: "Mở Binance AI (hoặc copy prompt) → checkIn",
        loginStep3: "Vào dashboard — máy này tin 24 giờ",
        agentNeedOwnWallet: "Tuỳ chọn: nối ví chủ Agent ID để xác minh máy này ngay (không bắt buộc).",
        agentOwnerMismatch: "Ví Web3 đang kết nối không khớp Agent ID này.",
        agentUnverifiedBanner: "Chưa xác minh — quay lại trang chủ để mở Binance AI / checkIn.",
        addressHidden: "Ẩn đến khi xác minh",
        toastNeedOwnership: "Hãy xác minh Agent ID trước.",
        optionalOwnerWallet: "Tuỳ chọn: nối ví chủ",
        agentVerifyTitle: "Xác minh bằng AI Agent",
        agentVerifyHint: "Prompt không chứa name.ai / địa chỉ ví. Khuyến nghị mở Binance AI (prompt đã copy sẵn). Sau checkIn trang tự vào dashboard. Máy này được tin 24 giờ.",
        agentVerifyWaiting: "Đang chờ checkIn on-chain…",
        agentVerifyOk: "Đã xác minh — đang mở dashboard…",
        agentVerifyHandleLabel: "Sẵn sàng xác minh · trust 24h sau khi OK",
        openBinanceAi: "Mở Binance AI",
        agentVerifyIConfirmed: "Tôi đã confirm",
        agentVerifyTrustHint: "Máy này sẽ nhớ 24 giờ — không hỏi lại mỗi lần mở tab.",
        toastBinanceAiOpened: "Đã copy prompt — dán vào Binance AI rồi confirm checkIn.",
        toastVerifyPolling: "Đang kiểm tra on-chain lại…",
        earn: "Earn", defi: "DeFi", stocks: "Cổ phiếu", soonBadge: "Soon",
        stocksNote: "Giá tham khảo · chưa giao dịch on-chain",
        toastComingSoon: "Sắp ra mắt — DeFi tab sẽ có ở bản sau.",
        toastEarnNeedAgent: "Mở bằng Agent ID (.ai) rồi dùng Earn để tạo intent.",
        toastEarnWeb3OnlyVenus: "Web3 Earn hiện hỗ trợ Venus (BNB/USDT). Protocol khác dùng AI Agent.",
        toastEarnOk: "Earn thành công",
        toastEarnFail: "Earn thất bại",
        toastStockSoon: "Cổ phiếu: xem giá demo — giao dịch sẽ có sau.",
        earnTitle: "Earn",
        earnHint: "Venus / Lista / Pancake LP trên BSC. Web3: ký ví. AI Agent: tạo intent → simulate → confirm.",
        riskEarn: "⚠️ Rủi ro: smart contract / thanh khoản / APY thay đổi. Không phải Simple Earn CEX.",
        earnProtocol: "Protocol",
        earnProduct: "Product",
        earnConfirm: "Tạo Earn Intent",
        earnConfirmWeb3: "Supply (ký ví)",
        earnDeposit: "Deposit",
        earnWithdraw: "Withdraw",
        earnClaim: "Claim",
        earnConfirmWithdraw: "Tạo Withdraw Intent",
        earnConfirmClaim: "Tạo Claim Intent",
        agentTools: "AI Agent tools",
        walletActions: "Ví",
        workspaceTitle: "Không gian làm việc",
        wsTrade: "Trade",
        wsCreate: "Create",
        wsTools: "Tools",
        wsAbout: "Giới thiệu",
        wsCreateHint: "Tạo Token / NFT → prompt cho AI Agent.",
        approvals: "Approve",
        approvalsSub: "Quyền token",
        bridge: "Bridge",
        bridgeSub: "Chuyển chain",
        cancelOrders: "Cancel",
        cancelOrdersSub: "Limit / Stop",
        approvalsTitle: "Approve / Revoke",
        approvalsHint: "AI Agent only · quản lý allowance BEP-20 trên BSC trước khi swap/earn/bridge.",
        riskApprove: "⚠️ Approve sai spender = rủi ro mất token. Mặc định Exact amount — chỉ bật Unlimited khi bạn hiểu rõ rủi ro MaxUint256.",
        riskApproveUnlimited: "⚠️ Unlimited = MaxUint256. Spender có thể rút toàn bộ allowance. Chỉ dùng với contract chính thức bạn tin tưởng.",
        approveAction: "Approve",
        revokeAction: "Revoke",
        approveSpender: "Spender",
        spenderPcs: "PancakeSwap Router V2",
        spenderVenus: "Venus vUSDT",
        spenderCustom: "Custom address…",
        spenderCustomPh: "0x… spender",
        approveAmount: "Allowance",
        approveUnlimited: "Unlimited",
        approveExact: "Exact amount",
        approveNote: "Ghi chú cho Agent",
        approveNotePh: "vd. Approve USDT cho PCS trước khi swap…",
        approvalsConfirm: "Tạo Approve Prompt",
        toastNeedSpender: "Nhập địa chỉ spender hợp lệ.",
        toastNeedApproveAmt: "Nhập số allowance hợp lệ.",
        bridgeTitle: "Bridge",
        bridgeHint: "AI Agent only · tạo intent bridge (simulate → confirm). Nguồn mặc định BSC.",
        riskBridge: "⚠️ Bridge có rủi ro finality / sai địa chỉ / bridge scam. Chỉ dùng bridge uy tín.",
        bridgeFrom: "From chain",
        bridgeTo: "To chain",
        bridgeToken: "Token",
        bridgeDest: "Destination address",
        bridgeDestPh: "0x… (mặc định = Agent wallet)",
        bridgeProvider: "Bridge provider",
        bridgeSlippage: "Max slippage %",
        bridgeNotePh: "vd. Bridge USDT BSC → ETH, ưu tiên fee thấp…",
        bridgeConfirm: "Tạo Bridge Prompt",
        toastNeedBridgeAmt: "Nhập số lượng bridge hợp lệ.",
        toastSameChain: "From và To phải khác nhau.",
        cancelTitle: "Cancel Limit / Stop",
        cancelHint: "AI Agent only · hủy lệnh Limit / Stop Limit đang treo (perp).",
        riskCancel: "⚠️ Hủy nhầm lệnh có thể bỏ bảo vệ TP/SL. Simulate trước khi confirm.",
        cancelPending: "Lệnh Agent đang theo dõi",
        cancelSelected: "Hủy lệnh đã chọn",
        cancelManual: "Nhập tay",
        cancelMarket: "Market",
        cancelSide: "Side",
        cancelOrderType: "Order type",
        cancelPrice: "Price / trigger (optional)",
        cancelNotePh: "vd. Hủy Stop Limit Long BTC nếu chưa khớp…",
        cancelConfirm: "Tạo Cancel Prompt",
        toastNeedCancelOrder: "Chọn một lệnh đang treo hoặc chuyển sang nhập tay.",
        noAgentOrders: "Chưa có Limit/Stop Agent — mở Perp và đặt lệnh trước.",
        earnNeedAmount: "Nhập số lượng Earn hợp lệ.",
        earnNeedWallet: "Kết nối ví Web3 trước khi Earn.",
        earnSummary: "Earn (deposit): nạp {amount} {asset} vào {protocol} ({product}) trên BNB Smart Chain. Simulate trước, confirm rồi mới execute.",
        gateDeployAlert: "Chưa có địa chỉ AgentGate. Deploy contract rồi cập nhật frontend/config.js",
        gateCheckFail: "Check-in thất bại",
        aiAdvisorSub: "Phân tích thị trường và gợi ý — bạn xác nhận trước khi tạo prompt cho AI Agent.",
        aiAdvisorQLabel: "Câu hỏi / phân vân của bạn",
        aiAdvisorQPh: "Ví dụ: Long hay Short? Nên đặt bao nhiêu? Yes hay No?",
        aiAdvisorApply: "Chốt theo gợi ý → tạo Prompt",
        aiAdvisorDismiss: "Chỉ xem, không chốt",
        howtoWeb3Title: "Cách dùng (Web3)",
        howtoWeb3Steps: [
            "<b>1. Kết nối ví</b> — MetaMask / Binance Wallet; chắc chắn đang ở <em>BNB Smart Chain</em>.",
            "<b>2. Xem số dư</b> — danh sách token Popular; bấm ⋮ để bật/tắt hoặc thêm token tùy chỉnh.",
            "<b>3. Gửi / Nhận / Swap</b> — thao tác ví thường; mỗi lần bấm Confirm sẽ mở popup ví để bạn ký.",
            "<b>4. Earn</b> — Venus / Lista / Pancake LP: ký supply trực tiếp (Web3 không có Withdraw/Claim intent).",
            "<b>5. Perp</b> — Market mở Swap ngay; Limit / Stop Limit treo theo Mark rồi mở Swap khi khớp (trình duyệt phải còn mở).",
            "<b>6. Predict</b> — mở Swap on-chain theo hướng Yes/No (ký ví).",
            "<b>7. Không thấy Launch / Approve / Bridge?</b> — các mode đó chỉ có ở tab <em>AI Agent</em> (intent + prompt)."
        ],
        dashDisclaimerWeb3: "Luồng Web3: bạn ký giao dịch trực tiếp bằng ví. Kiểm tra mạng BNB Smart Chain trước khi confirm. Không phải lời khuyên đầu tư.",
        pillGate: "Agent ID gate", pillIntent: "AI Intent", pillChain: "BNB Smart Chain", pillSimulate: "Simulate first",
        loginStep1: "Nhập Agent ID (name.ai) của bạn", loginStep2: "Mở Binance AI (hoặc copy prompt) → checkIn", loginStep3: "Vào dashboard — máy này tin 24 giờ",
        loginClaim: "Chưa có Agent ID? <a href=\"https://www.binance.com/en/download\" target=\"_blank\" rel=\"noopener\">Claim trong Binance App</a> (Wallet → banner Agent ID)",
        popular: "Phổ biến", bnbMainnet: "BNB Smart Chain · Mainnet", agentNft: "Agent ID NFT", loading: "Đang tải...",
        networkChip: "Mạng: BNB Smart Chain",
        toastNetworkBsc: "Đang dùng BNB Smart Chain (Mainnet).",
        toastSortValue: "Sắp xếp: giá trị USD",
        toastSortName: "Sắp xếp: tên A→Z",
        toastSortBalance: "Sắp xếp: số dư",
        manageTokensTitle: "Quản lý token",
        manageTokensHint: "Bật/tắt token trên dashboard · tìm theo tên hoặc ký hiệu (BNB Smart Chain).",
        manageTokenSearchPh: "Nhập tên hoặc địa chỉ token",
        showAllTokens: "Hiện tất cả",
        hideZeroTokens: "Ẩn số dư 0",
        tokensHiddenEmpty: "Không có token nào đang hiện. Mở ⋮ để bật lại.",
        done: "Xong",
        tokenVisible: "Hiện",
        tokenHidden: "Ẩn",
        addCustomToken: "Thêm token tùy chỉnh",
        customTokenWarn: "Bất kỳ ai cũng có thể tạo token, gồm cả phiên bản giả mạo. Hãy kiểm tra địa chỉ hợp đồng trên BscScan trước khi thêm.",
        networkLabel: "Mạng",
        tokenContract: "Địa chỉ hợp đồng của token",
        tokenContractPh: "Nhập địa chỉ token",
        saveToken: "Lưu",
        toastTokenSaved: "Đã thêm token tùy chỉnh.",
        toastBadTokenAddr: "Địa chỉ token không hợp lệ.",
        toastTokenExists: "Token này đã có trong danh sách.",
        toastTokenLookup: "Đang đọc hợp đồng…",
        toastTokenLookupFail: "Không đọc được token trên BSC.",
        lockedToken: "Token gốc",
        recentIntents: "AI Agent intents gần đây", clear: "Xóa", noIntents: "Chưa có intent — thử Perp / Swap / Predict / Earn",
        history: "Lịch sử", back: "Quay lại",
        dashDisclaimer: "AgentGate không tự ký giao dịch. AI Agent phải simulate trước; bạn xác nhận mọi thao tác liên quan tài sản. Đây không phải lời khuyên đầu tư.",
        transfer: "Chuyển", riskTransfer: "⚠️ Giao dịch on-chain không hoàn tác. Kiểm tra địa chỉ & mạng (BNB Smart Chain).",
        from: "Từ", to: "Đến", coin: "Coin", amount: "Số lượng", available: "Khả dụng", confirm: "Xác nhận",
        recipientPh: "Địa chỉ ví nhận", copyAddress: "Copy địa chỉ", receiveTitle: "Nhận",
        yourAddress: "Địa chỉ ví của bạn", swapTitle: "Swap", historyTitle: "Lịch sử",
        close: "Đóng", askAi: "Hỏi AI Advisor", copyIntent: "Copy Intent JSON",
        sendLong: "Gửi Long cho AI Agent", sendShort: "Gửi Short cho AI Agent",
        perpRisk: "⚠️ Perp có rủi ro thanh lý. AgentGate không tự ký — AI Agent simulate trước, bạn confirm mới execute.",
        perpAgentNote: "Lệnh → <b>AI Agent</b> (simulate → confirm → execute)",
        sizeUsdt: "Size (USDT)", leverage: "Đòn bẩy", takeProfit: "Take Profit", stopLoss: "Stop Loss",
        positionsEmpty: "Chưa có vị thế — lệnh Perp đi qua AI Agent intent (demo).",
        predictTitle: "Dự đoán", predictRisk: "⚠️ Stake có thể mất 100%. AI Agent phải simulate trước — bạn confirm mới execute.",
        confirmPredict: "Gửi lệnh cho AI Agent", chotPrompt: "Chốt → tạo Prompt",
        intentHint: "Dán prompt vào Claude / Codex / Binance Agent. Agent phải <b>simulate trước</b>, chỉ execute khi pass.",
        copyPrompt: "Copy Prompt", copyJson: "Copy JSON", reopen: "Mở lại",
        pmAiWelcome: "Phân vân Yes/No? Hỏi mình → nhận gợi ý → chốt tạo prompt cho AI Agent.",
        perpAiWelcome: "Phân vân Long/Short? Hỏi mình → nhận gợi ý size & leverage → chốt tạo prompt.",
        searchMarket: "Tìm theo market, sự kiện hoặc từ khóa", sortBy: "Sắp xếp: Đề xuất",
        receiveHint: "Chỉ gửi token trên <b>BNB Smart Chain</b>",
        riskSwap: "⚠️ Rủi ro: giá biến động, slippage và thất bại simulation có thể làm mất vốn. Chỉ execute sau khi AI Agent simulate + bạn xác nhận.",
        rate: "Tỷ lệ", slippage: "Trượt giá", minReceived: "Tối thiểu nhận được",
        noMarket: "Không có market phù hợp", noNft: "Không có Agent ID NFT", nftFail: "Không tải được NFT",
        loadingTx: "Đang tải giao dịch...", checking: "Đang kiểm tra...",
        noAgentId: "Không tìm thấy Agent ID.", invalidAddr: "Địa chỉ không hợp lệ. Hãy nhập name.ai",
        agentOk: "Agent ID hợp lệ — đang mở dashboard AI Agent...", noAgentOnAddr: "Agent ID / ví này chưa có Agent ID NFT.",
        agentOkVerified: "Đã chứng minh ownership — mở đủ địa chỉ & số dư.",
        walletNoAgent: "Ví chưa có Agent ID. Claim trong Binance App (Wallet → Agent ID), hoặc Check bằng <b>name.ai</b>.",
        errPrefix: "Lỗi: ", gateRemind: "Nên Activate (check-in) hôm nay để ghi nhận on-chain",
        toastCopied: "Đã copy địa chỉ", toastCopiedPrompt: "Đã copy prompt AI Agent",
        toastCopiedJson: "Đã copy Intent JSON", toastClearedIntents: "Đã xóa lịch sử intent",
        toastCheckIn: "Đang check-in...", toastCheckInOk: "Check-in thành công",
        toastIntentLogged: "Đã log intent on-chain", toastSwapOk: "Swap thành công",
        toastNoMark: "Chưa có Mark price",
        toastMarketOnly: "Web3 Perp chỉ hỗ trợ Market (mở Swap). Limit / Stop Limit dùng luồng AI Agent.",
        toastNeedLimitPrice: "Nhập Limit price hợp lệ.",
        toastNeedStopPrice: "Nhập Stop trigger và Stop limit price hợp lệ.",
        toastLimitQueued: "Đã đặt Limit — chờ Mark khớp rồi mở Swap.",
        toastStopQueued: "Đã đặt Stop Limit — chờ trigger rồi mở Swap.",
        toastOrderCancelled: "Đã hủy lệnh chờ.",
        toastOrderTriggered: "Lệnh khớp điều kiện — mở Swap để ký.",
        perpHistoryEmpty: "Chưa có lịch sử lệnh.",
        perpOrdersEmpty: "Chưa có Open Orders. Limit / Stop Limit (Web3) sẽ hiện ở đây.",
        cancelOrder: "Hủy",
        armedLabel: "Armed",
        waitingLabel: "Waiting",
        limitPrice: "Limit price", stopTrigger: "Stop trigger", stopLimitPrice: "Stop limit price", useMark: "Mark",
        launch: "Launch",
        launchTitle: "Launchpad",
        launchHint: "Chỉ AI Agent · form launchpad thật → Launch tạo prompt (simulate → confirm → deploy BSC).",
        riskLaunch: "⚠️ Deploy token/NFT tốn gas, rủi ro hợp đồng & thanh khoản. Quyền mint/ownable (nếu bật) thuộc hợp đồng bạn deploy — AgentGate không custodial, không tự ký. Agent phải simulate + bạn confirm trước.",
        launchTabToken: "Create Token",
        launchTabNft: "Create NFT",
        logoPh: "Logo",
        uploadLogo: "Tải logo",
        logoUrlPh: "Hoặc dán URL logo (https://…)",
        clearLogo: "Xóa",
        tokenName: "Tên token",
        tokenNamePh: "vd. AgentGate Coin",
        tokenSymbol: "Ký hiệu",
        tokenSymbolPh: "AGT",
        tokenDecimals: "Decimals",
        tokenSupply: "Tổng cung",
        tokenSupplyPh: "1000000000",
        tokenDesc: "Mô tả",
        tokenDescPh: "Mô tả ngắn về token, utility, cộng đồng…",
        tokenWebsite: "Website",
        tokenTwitter: "Twitter / X",
        tokenTelegram: "Telegram",
        tokenMintable: "Mintable",
        tokenBurnable: "Burnable",
        tokenOwnable: "Ownable",
        nftImagePh: "Ảnh NFT",
        uploadNft: "Tải ảnh",
        nftUrlPh: "Hoặc dán URL ảnh / IPFS",
        nftName: "Tên NFT / collection",
        nftNamePh: "vd. AgentGate Pass",
        nftSymbol: "Symbol",
        nftSupply: "Số lượng mint",
        nftDesc: "Mô tả",
        nftDescPh: "Mô tả NFT, utility, quyền lợi Agent ID…",
        nftExternal: "Link ngoài (optional)",
        launchConfirm: "Launch → tạo Prompt",
        launchConfirmToken: "Launch Token → Prompt",
        launchConfirmNft: "Launch NFT → Prompt",
        toastNeedTokenName: "Nhập tên và ký hiệu token.",
        toastNeedTokenSupply: "Nhập tổng cung hợp lệ (> 0).",
        toastNeedNftName: "Nhập tên NFT / collection.",
        toastNeedNftImage: "Tải ảnh hoặc dán URL ảnh NFT.",
        toastLogoTooBig: "Logo lớn — chỉ lưu metadata; agent sẽ hỏi URL/IPFS.",
        toastLeaderboard: "Leaderboard — sắp ra mắt", toastAnalyzing: "Đang phân tích...",
        toastAnalyzeFail: "Phân tích thất bại — thử lại", analyzeMarket: "Phân tích thị trường",
        toastNoAdvice: "Chưa có gợi ý hợp lệ", markErr: "Lỗi dữ liệu", markFail: "Không tải được",
        historyFail: "Không tải được lịch sử.",
        analyzingMarket: "Đang phân tích market…", analyzingPerp: "Đang phân tích perp…",
        analyzeFailShort: "Phân tích thất bại — thử lại nhé.",
        noWalletExt: "Chưa phát hiện ví. Hãy mở trang qua http://localhost (không mở file HTML trực tiếp), bật MetaMask/Binance trên Edge, rồi thử lại. Hoặc dùng tab AI Agent.",
        fileProtocolWarn: "Đang mở bằng file:// — extension ví thường không inject. Chạy: python -m http.server 3456 trong thư mục frontend, rồi vào http://127.0.0.1:3456",
        connectFail: "Kết nối hoặc ký thất bại.",
        pickWallet: "Chọn ví để kết nối",
        walletMetaMask: "MetaMask",
        walletBinance: "Binance Wallet",
        walletAny: "Ví đã cài",
        connectingWallet: "Đang kết nối ví…",
        disconnect: "Ngắt kết nối",
        logoutAgent: "Đăng xuất Agent",
        disconnected: "Đã ngắt kết nối ví",
        walletPhantom: "Phantom",
        signToLogin: "Ký tin nhắn trên ví để đăng nhập…",
        openLong: "Long → Swap",
        openShort: "Short → Swap",
        placeOrderWeb3: "Mở Swap (ký ví)",
        needWeb3Wallet: "Hãy kết nối ví Web3 trước.",
        txSent: "Đã gửi giao dịch",
        txOk: "Giao dịch thành công",
        txFail: "Giao dịch thất bại",
        web3PerpNote: "Web3: Market mở Swap ngay. Limit / Stop Limit theo dõi Mark trên trình duyệt → khớp thì mở Swap (ký ví).",
        web3PredNote: "Web3: Predict mở Swap on-chain (ký ví). Market predict đầy đủ dùng tab AI Agent.",
        web3OpenSwap: "Đã mở Swap — kiểm tra cặp & số lượng rồi bấm Swap (ký ví).",
        sendOk: "Gửi thành công",
        sendFail: "Gửi thất bại",
        invalidSend: "Nhập đúng địa chỉ BSC và số lượng BNB.",
        invalidAmount: "Nhập số lượng hợp lệ.",
        sameToken: "Hai token phải khác nhau.",
        swapFail: "Swap thất bại",
        errInsufficient: "Không đủ {token} trong ví (cần {need}, có {have}).",
        errNeedGas: "Ví cần thêm BNB để trả gas (ước tính còn {have} BNB).",
        errWrongNetwork: "Sai mạng — hãy chuyển ví sang BNB Smart Chain (BSC).",
        errUserReject: "Bạn đã từ chối giao dịch trên ví.",
        errRpc: "Ví/RPC từ chối giao dịch (thường do thiếu tiền, gas, hoặc quote swap lỗi). Kiểm tra số dư USDT + BNB gas trên BSC.",
        perpAdvisor: "Perp Advisor", predictAdvisor: "Predict Advisor",
        askAiPh: "Hỏi AgentGate AI…",
        pickPair: "Chọn cặp",
        perpMarkets: "Markets", perpChart: "Chart", perpTrade: "Trade",
        perpMarketsTitle: "Hợp đồng vĩnh cửu",
        perpSearchPh: "Tìm cặp…",
        perpColSym: "Mã / Lev", perpColPrice: "Giá / 24h",
        perpOpenLong: "Mở Long", perpOpenShort: "Mở Short",
        chipLongShort: "Long / Short", chipSafeLev: "Safe lev", chipTpSl: "TP / SL",
        chipYesNo: "Yes / No", chipHot: "Hot", chipSafeStake: "Safe stake",
        chipQLongShort: "Long hay Short cặp này?",
        chipQSafeLev: "Gợi ý leverage an toàn và size nhỏ",
        chipQTpSl: "Nên đặt TP/SL ở đâu?",
        chipQYesNo: "Nên chọn Yes hay No trên market đang mở?",
        chipQHot: "Market nào đáng quan tâm nhất hôm nay?",
        chipQSafeStake: "Gợi ý stake nhỏ và phía an toàn hơn",
        aiPerpCh24: "24h change {ch} trên {pair}.",
        aiPerpMom: "Momentum ~15m gần đây: {mom}.",
        aiPerpLev: "Gợi ý leverage thấp ({lev}x / max {max}x) để giảm rủi ro thanh lý.",
        aiPerpSize: "Size đề xuất {size} USDT margin — điều chỉnh theo khẩu vị rủi ro của bạn.",
        aiPerpFunding: "Funding hiện tại {funding}.",
        aiPerpMark: "Mark ≈ ${mark}; TP ~${tp}, SL ~${sl}.",
        aiPerpHeadline: "Gợi ý {side} {pair} với {size} USDT @ {lev}x (simulate trước khi execute).",
        aiPerpRisk: "Perp có rủi ro thanh lý cao. AI Advisor không tự ký lệnh — chỉ tạo prompt cho AI Agent sau khi bạn chốt.",
        aiPredNoMarket: "Chưa có market để phân tích — hãy chọn một card trước.",
        aiPredNoMarketReason: "Mở một prediction card rồi hỏi lại AI Advisor.",
        aiPredNoMarketRisk: "Không tạo được lệnh khi chưa chọn market.",
        aiPredMarket: "Market: \"{title}\".",
        aiPredOdds: "Odds hiện tại {left} {yes}% / {right} {no}%.",
        aiPredVol: "Volume {vol}, {traders} traders, còn {ends}.",
        aiPredBeat: "Price to beat ${beat} vs current ${cur}.",
        aiPredSkew: "Odds lệch {spread}% — cân nhắc phía có expected value tốt hơn, không chỉ theo đám đông.",
        aiPredBalanced: "Odds khá cân — ưu tiên stake nhỏ và manage risk.",
        aiPredHeadline: "Gợi ý {side} trên \"{title}\" với ~{amount} USDT (odds ~{pct}%).",
        aiPredRisk: "Prediction có thể mất 100% stake. AI chỉ gợi ý — bạn phải chốt và dán prompt vào AI Agent.",
        aiComingSoon: "Advisor local · gợi ý từ dữ liệu thị trường — chốt rồi tạo prompt cho AI Agent thật",
        aiAdvisorDisclaimer: "AI Advisor chỉ hỗ trợ quyết định. Không phải lời khuyên tài chính. Luôn simulate trước khi execute.",
        aiConfLabel: "Độ tin cậy {n}%",
        aiPrefillPredict: "Tôi đang phân vân về \"{title}\". Nên chọn phía nào và stake bao nhiêu USDT?",
        aiPrefillPredictNone: "Market nào đáng quan tâm nhất hôm nay và nên chọn phía nào?",
        aiPrefillPerp: "Tôi đang phân vân Long hay Short {pair}. 24h đang {ch}. Nên vào hướng nào, size và leverage bao nhiêu?"
    },
    en: {
        settings: "Settings", language: "Language", theme: "Theme", themeLight: "Light", themeDark: "Dark",
        howto: "How to use", howtoTitle: "How to use AI Agent", collapse: "Collapse", live: "Live",
        howtoNote: "Golden rule: AgentGate never auto-signs. Your AI Agent must simulate first — you confirm before execute. BNB Smart Chain only. Not financial advice.",
        howtoSteps: [
            "<b>1. Open your own Agent ID</b> — enter <em>your</em> <em>name.ai</em> (claim in Binance App if needed). <em>No Web3 wallet required</em> — this is the AI Agent path. Not a lookup tool for other wallets.",
            "<b>2. Activate AgentGate</b> — create a checkIn prompt for your AI Agent / Agentic Wallet (Agent ID only, <em>no funds moved</em>). Address & balances unlock after Activate.",
            "<b>3. Pick a hand / mode</b> — dashboard: <em>Perp</em>, <em>Predict</em>, <em>Launch</em>, Send / Receive / Swap / Earn, or <em>AI Agent tools</em> (Approve, Bridge, Cancel).",
            "<b>4. Fill a real form</b> — e.g. Perp (Market/Limit/Stop), Earn (Deposit/Withdraw/Claim), Launch Token/NFT, Approve spender, Bridge routes…",
            "<b>5. Confirm → create Prompt</b> — tap the primary button; AgentGate opens the intent and <em>copies the prompt</em> to clipboard.",
            "<b>6. Paste into your AI Agent</b> — Claude / Codex / Binance Agent / TWAK. It reads INTENT_JSON, <em>simulates first</em>, shows risks, then waits for your confirm before signing.",
            "<b>7. On-chain audit</b> — prompts require <em>logIntent</em> then <em>recordAction</em> on AgentGate before moving funds (when the contract is configured).",
            "<b>8. Track & manage</b> — reopen from <em>Recent AI Agent intents</em>; cancel Limit/Stop via <em>Cancel</em>; manage the token list with ⋮ like MetaMask."
        ],
        predict: "Prediction", estBalance: "Your Estimated Balance", pnlToday: "Today's PnL",
        activateGate: "Activate AgentGate (on-chain check-in)",
        gateOk: "Checked in on-chain ✓", gateNeedActivate: "Not checked in — tap Activate",
        gateNoDeploy: "AgentGate not deployed — set address in config.js", gateReadFail: "Cannot read gate status",
        send: "Send", receive: "Receive", swap: "Swap", check: "Check",
        subtitle: "Pick a path to start — regular Web3 wallet or AI Agent (your Agent ID).",
        placeholder: "e.g. yourname.ai", connect: "Connect wallet", connectWeb3: "Connect wallet", connected: "Connected",
        loginDivider: "or open with Agent ID", loginTitle: "AgentGate",
        flowWeb3: "Web3 Wallet", flowAgent: "AI Agent", flowAbout: "About",
        flowWeb3Desc: "Connect wallet → balances → Send / Receive / Swap / Earn (Venus). Perp & Predict open on-chain Swap. DeFi tab coming soon.",
        flowAgentDesc: "AI Agent path: enter name.ai → verify with Binance AI / prompt (no name/wallet in prompt) → dashboard. This device trusts you for 24h. Not for looking up other wallets.",
        aboutKicker: "Binance Wallet × BNB Chain · Agent ID Hackathon",
        aboutTitle: "About AgentGate",
        aboutTagline: "An ownership-gated gate: only your Agent ID unlocks the Web3 × AI Agent dashboard on BNB Smart Chain.",
        aboutMetricLabel: "Agent IDs that interacted on-chain",
        aboutP1: "AgentGate proves you own name.ai with an on-chain checkIn (Binance AI / privacy prompt, or owner wallet). Only then unlock balances, Swap / Perp / Predict / Earn, and Approve · Bridge · Cancel tools.",
        aboutP2: "The AI Agent path always follows simulate → confirm → execute. AgentGate never auto-signs, never stores seeds / keys, and never uses web QR login for Agentic Wallet.",
        aboutPoint1: "Two entry paths: Web3 Wallet or AI Agent (Agent ID)",
        aboutPoint2: "24h device trust after verify; logout clears trust",
        aboutPoint3: "On-chain intents: checkIn · logIntent · recordAction",
        aboutPoint4: "Not a tool to look up other wallets by name",
        aboutRoadmapTitle: "Vision",
        aboutRoadmapNote: "Shipped today → long-term direction. Technical vision — not a promise of auto-trading or making money for you. Asset moves still require user confirm.",
        aboutVisionNow: "Now",
        aboutVisionNext: "Vision",
        aboutVisionNow1: "Identity gate via <code>name.ai</code>",
        aboutVisionNow2: "Intent → simulate → user confirm → sign",
        aboutVisionNow3: "On-chain audit (<code>checkIn</code> / <code>logIntent</code>)",
        aboutVisionNow4: "Dual Web3 × Agent",
        aboutVisionNext1: "Agent runs inside user-granted permissions / limits — fewer steps, still controlled",
        aboutVisionNext2: "One-tap UX like a CEX (still confirm when moving assets)",
        aboutVisionNext3: "Deep risk sense + personal policy compliance",
        aboutVisionNext4: "Own liquidity / social / distribution",
        aboutVisionNext5: "<b>Ship in-dashboard AI like ChatGPT, Grok, Claude for day-to-day work</b>",
        aboutDisclaimer: "Community project for the Agent ID Hackathon — not an official Binance / BNB Chain product, and not sponsored or endorsed by Binance.",
        aboutLinkBsc: "Contract on BscScan",
        aboutLinkGh: "Source on GitHub",
        aboutFeedbackTitle: "Contact / Feedback",
        aboutFeedbackHint: "Product feedback or technical questions — not for wallet login.",
        aboutBadge: "COMMUNITY PROJECT",
        aboutCtaAgent: "Open AI Agent",
        aboutCtaWeb3: "Open Web3",
        aboutSubtitle: "What AgentGate is, how Agent ID is used, and contract / source links.",
        pillWeb3: "MetaMask / Binance Wallet", pillDirect: "Direct sign",
        web3Step1: "Install / open MetaMask or Binance Wallet", web3Step2: "Connect wallet on BNB Smart Chain", web3Step3: "Send / Swap / trade directly with your wallet",
        brandWeb3: "Web3 Wallet · BNB Smart Chain", brandAgent: "Agentic Wallet · BNB Smart Chain",
        loginStep1: "Enter your Agent ID (name.ai)",
        loginStep2: "Open Binance AI (or copy prompt) → checkIn",
        loginStep3: "Enter dashboard — this device trusts you for 24h",
        agentNeedOwnWallet: "Optional: connect the Agent ID owner wallet to verify this device now.",
        agentOwnerMismatch: "Connected Web3 wallet does not match this Agent ID.",
        agentUnverifiedBanner: "Not verified — return home to open Binance AI / checkIn.",
        addressHidden: "Hidden until verified",
        toastNeedOwnership: "Verify your Agent ID first.",
        optionalOwnerWallet: "Optional: connect owner wallet",
        agentVerifyTitle: "Verify with AI Agent",
        agentVerifyHint: "Prompt has no name.ai / wallet address. Prefer Open Binance AI (prompt already copied). After checkIn this page opens the dashboard. This device is trusted for 24h.",
        agentVerifyWaiting: "Waiting for on-chain checkIn…",
        agentVerifyOk: "Verified — opening dashboard…",
        agentVerifyHandleLabel: "Ready to verify · 24h trust after OK",
        openBinanceAi: "Open Binance AI",
        agentVerifyIConfirmed: "I've confirmed",
        agentVerifyTrustHint: "This device remembers for 24h — no re-prompt every tab open.",
        toastBinanceAiOpened: "Prompt copied — paste into Binance AI and confirm checkIn.",
        toastVerifyPolling: "Checking on-chain again…",
        earn: "Earn", defi: "DeFi", stocks: "Stocks", soonBadge: "Soon",
        stocksNote: "Reference prices · not tradable on-chain yet",
        toastComingSoon: "Coming soon — DeFi tab in a later release.",
        toastEarnNeedAgent: "Open with Agent ID (.ai), then use Earn to create an intent.",
        toastEarnWeb3OnlyVenus: "Web3 Earn currently supports Venus (BNB/USDT). Other protocols use AI Agent.",
        toastEarnOk: "Earn successful",
        toastEarnFail: "Earn failed",
        toastStockSoon: "Stocks: demo quotes — trading comes later.",
        earnTitle: "Earn",
        earnHint: "Venus / Lista / Pancake LP on BSC. Web3: wallet sign. AI Agent: intent → simulate → confirm.",
        riskEarn: "⚠️ Risk: smart contract / liquidity / APY changes. Not CEX Simple Earn.",
        earnProtocol: "Protocol",
        earnProduct: "Product",
        earnConfirm: "Create Earn Intent",
        earnConfirmWeb3: "Supply (sign wallet)",
        earnDeposit: "Deposit",
        earnWithdraw: "Withdraw",
        earnClaim: "Claim",
        earnConfirmWithdraw: "Create Withdraw Intent",
        earnConfirmClaim: "Create Claim Intent",
        agentTools: "AI Agent tools",
        walletActions: "Wallet",
        workspaceTitle: "Workspace",
        wsTrade: "Trade",
        wsCreate: "Create",
        wsTools: "Tools",
        wsAbout: "About",
        wsCreateHint: "Create Token / NFT → prompt for AI Agent.",
        approvals: "Approve",
        approvalsSub: "Token allowance",
        bridge: "Bridge",
        bridgeSub: "Cross-chain",
        cancelOrders: "Cancel",
        cancelOrdersSub: "Limit / Stop",
        approvalsTitle: "Approve / Revoke",
        approvalsHint: "AI Agent only · manage BEP-20 allowances on BSC before swap/earn/bridge.",
        riskApprove: "⚠️ Wrong spender can drain tokens. Default is Exact amount — enable Unlimited only if you understand MaxUint256 risk.",
        riskApproveUnlimited: "⚠️ Unlimited = MaxUint256. The spender may use the full allowance. Only use with official contracts you trust.",
        approveAction: "Approve",
        revokeAction: "Revoke",
        approveSpender: "Spender",
        spenderPcs: "PancakeSwap Router V2",
        spenderVenus: "Venus vUSDT",
        spenderCustom: "Custom address…",
        spenderCustomPh: "0x… spender",
        approveAmount: "Allowance",
        approveUnlimited: "Unlimited",
        approveExact: "Exact amount",
        approveNote: "Note for Agent",
        approveNotePh: "e.g. Approve USDT for PCS before swap…",
        approvalsConfirm: "Create Approve Prompt",
        toastNeedSpender: "Enter a valid spender address.",
        toastNeedApproveAmt: "Enter a valid allowance amount.",
        bridgeTitle: "Bridge",
        bridgeHint: "AI Agent only · build a bridge intent (simulate → confirm). Default source BSC.",
        riskBridge: "⚠️ Bridging has finality / wrong-address / scam risks. Use reputable bridges only.",
        bridgeFrom: "From chain",
        bridgeTo: "To chain",
        bridgeToken: "Token",
        bridgeDest: "Destination address",
        bridgeDestPh: "0x… (defaults to Agent wallet)",
        bridgeProvider: "Bridge provider",
        bridgeSlippage: "Max slippage %",
        bridgeNotePh: "e.g. Bridge USDT BSC → ETH, prefer low fee…",
        bridgeConfirm: "Create Bridge Prompt",
        toastNeedBridgeAmt: "Enter a valid bridge amount.",
        toastSameChain: "From and To must differ.",
        cancelTitle: "Cancel Limit / Stop",
        cancelHint: "AI Agent only · cancel hanging Limit / Stop Limit perp orders.",
        riskCancel: "⚠️ Cancelling the wrong order may remove TP/SL protection. Simulate first.",
        cancelPending: "Tracked Agent orders",
        cancelSelected: "Cancel selected",
        cancelManual: "Manual entry",
        cancelMarket: "Market",
        cancelSide: "Side",
        cancelOrderType: "Order type",
        cancelPrice: "Price / trigger (optional)",
        cancelNotePh: "e.g. Cancel BTC Long Stop Limit if unfilled…",
        cancelConfirm: "Create Cancel Prompt",
        toastNeedCancelOrder: "Select a tracked order or switch to manual entry.",
        noAgentOrders: "No Agent Limit/Stop yet — place one from Perp first.",
        earnNeedAmount: "Enter a valid Earn amount.",
        earnNeedWallet: "Connect a Web3 wallet before Earn.",
        earnSummary: "Earn (deposit): supply {amount} {asset} into {protocol} ({product}) on BNB Smart Chain. Simulate first, then confirm before execute.",
        gateDeployAlert: "AgentGate address missing. Deploy the contract and set it in frontend/config.js",
        gateCheckFail: "Check-in failed",
        aiAdvisorSub: "Market analysis and suggestions — you confirm before creating an AI Agent prompt.",
        aiAdvisorQLabel: "Your question / uncertainty",
        aiAdvisorQPh: "e.g. Long or Short? How much size? Yes or No?",
        aiAdvisorApply: "Apply advice → create Prompt",
        aiAdvisorDismiss: "View only, don't apply",
        howtoWeb3Title: "How to use (Web3)",
        howtoWeb3Steps: [
            "<b>1. Connect wallet</b> — MetaMask / Binance Wallet; stay on <em>BNB Smart Chain</em>.",
            "<b>2. Check balances</b> — Popular token list; tap ⋮ to show/hide or add a custom token.",
            "<b>3. Send / Receive / Swap</b> — normal wallet UX; Confirm opens your wallet popup to sign.",
            "<b>4. Earn</b> — Venus / Lista / Pancake LP: sign supply directly (no Withdraw/Claim intent on Web3).",
            "<b>5. Perp</b> — Market opens Swap now; Limit / Stop Limit watches Mark then opens Swap when filled (keep the tab open).",
            "<b>6. Predict</b> — opens on-chain Swap for Yes/No (wallet sign).",
            "<b>7. Missing Launch / Approve / Bridge?</b> — those modes exist only on the <em>AI Agent</em> tab (intent + prompt)."
        ],
        dashDisclaimerWeb3: "Web3 path: you sign transactions directly with your wallet. Check BNB Smart Chain before confirming. Not financial advice.",
        pillGate: "Agent ID gate", pillIntent: "AI Intent", pillChain: "BNB Smart Chain", pillSimulate: "Simulate first",
        loginStep1: "Enter your Agent ID (name.ai)", loginStep2: "Open Binance AI (or copy prompt) → checkIn", loginStep3: "Enter dashboard — this device trusts you for 24h",
        loginClaim: "No Agent ID yet? <a href=\"https://www.binance.com/en/download\" target=\"_blank\" rel=\"noopener\">Claim in Binance App</a> (Wallet → Agent ID banner)",
        popular: "Popular", bnbMainnet: "BNB Smart Chain · Mainnet", agentNft: "Agent ID NFT", loading: "Loading...",
        networkChip: "Network: BNB Smart Chain",
        toastNetworkBsc: "Using BNB Smart Chain (Mainnet).",
        toastSortValue: "Sort: USD value",
        toastSortName: "Sort: name A→Z",
        toastSortBalance: "Sort: balance",
        manageTokensTitle: "Manage tokens",
        manageTokensHint: "Show/hide tokens on the dashboard · search by name or symbol (BNB Smart Chain).",
        manageTokenSearchPh: "Enter token name or address",
        showAllTokens: "Show all",
        hideZeroTokens: "Hide zero balances",
        tokensHiddenEmpty: "No tokens visible. Open ⋮ to enable some.",
        done: "Done",
        tokenVisible: "Shown",
        tokenHidden: "Hidden",
        addCustomToken: "Add custom token",
        customTokenWarn: "Anyone can create a token, including fake versions of existing ones. Verify the contract on BscScan before adding.",
        networkLabel: "Network",
        tokenContract: "Token contract address",
        tokenContractPh: "Enter token address",
        saveToken: "Save",
        toastTokenSaved: "Custom token added.",
        toastBadTokenAddr: "Invalid token address.",
        toastTokenExists: "This token is already in your list.",
        toastTokenLookup: "Reading contract…",
        toastTokenLookupFail: "Could not read token on BSC.",
        lockedToken: "Built-in token",
        recentIntents: "Recent AI Agent intents", clear: "Clear", noIntents: "No intents yet — try Perp / Swap / Predict / Earn",
        history: "History", back: "Back",
        dashDisclaimer: "AgentGate never auto-signs. AI Agent must simulate first; you confirm every asset move. Not financial advice.",
        transfer: "Transfer", riskTransfer: "⚠️ Irreversible on-chain transfer. Double-check address & network (BNB Smart Chain).",
        from: "From", to: "To", coin: "Coin", amount: "Amount", available: "Available", confirm: "Confirm",
        recipientPh: "Recipient wallet address", copyAddress: "Copy address", receiveTitle: "Receive",
        yourAddress: "Your wallet address", swapTitle: "Swap", historyTitle: "History",
        close: "Close", askAi: "Ask AI Advisor", copyIntent: "Copy Intent JSON",
        sendLong: "Send Long to AI Agent", sendShort: "Send Short to AI Agent",
        perpRisk: "⚠️ Perps risk liquidation. AgentGate never auto-signs — AI Agent simulates first; you confirm.",
        perpAgentNote: "Order → <b>AI Agent</b> (simulate → confirm → execute)",
        sizeUsdt: "Size (USDT)", leverage: "Leverage", takeProfit: "Take Profit", stopLoss: "Stop Loss",
        positionsEmpty: "No positions yet — Perp orders go through AI Agent intent (demo).",
        predictTitle: "Prediction", predictRisk: "⚠️ Stake can be lost 100%. AI Agent must simulate first — you confirm before execute.",
        confirmPredict: "Send order to AI Agent", chotPrompt: "Confirm → create Prompt",
        intentHint: "Paste prompt into Claude / Codex / Binance Agent. Agent must <b>simulate first</b>, execute only when passed.",
        copyPrompt: "Copy Prompt", copyJson: "Copy JSON", reopen: "Reopen",
        pmAiWelcome: "Unsure Yes/No? Ask me → get a tip → confirm to create an AI Agent prompt.",
        perpAiWelcome: "Unsure Long/Short? Ask me → get size & leverage tip → confirm to create prompt.",
        searchMarket: "Search by market, event, or keyword", sortBy: "Sort by: Recommended",
        receiveHint: "Only send tokens on <b>BNB Smart Chain</b>",
        riskSwap: "⚠️ Risk: price moves, slippage, and failed simulation can lose funds. Execute only after AI Agent simulate + your confirm.",
        rate: "Rate", slippage: "Slippage", minReceived: "Minimum received",
        noMarket: "No matching markets", noNft: "No Agent ID NFT", nftFail: "Failed to load NFT",
        loadingTx: "Loading transactions...", checking: "Checking...",
        noAgentId: "Agent ID not found.", invalidAddr: "Invalid address. Enter a name.ai",
        agentOk: "Valid Agent ID — opening AI Agent dashboard...", noAgentOnAddr: "This Agent ID / wallet has no Agent ID NFT.",
        agentOkVerified: "Ownership proven — address & balances unlocked.",
        walletNoAgent: "Wallet has no Agent ID. Claim in Binance App (Wallet → Agent ID), or Check with <b>name.ai</b>.",
        errPrefix: "Error: ", gateRemind: "Activate (check-in) today to record on-chain",
        toastCopied: "Address copied", toastCopiedPrompt: "AI Agent prompt copied",
        toastCopiedJson: "Intent JSON copied", toastClearedIntents: "Intent history cleared",
        toastCheckIn: "Checking in...", toastCheckInOk: "Check-in successful",
        toastIntentLogged: "Intent logged on-chain", toastSwapOk: "Swap successful",
        toastNoMark: "No Mark price yet",
        toastMarketOnly: "Web3 Perp supports Market only (opens Swap). Use AI Agent for Limit / Stop Limit.",
        toastNeedLimitPrice: "Enter a valid Limit price.",
        toastNeedStopPrice: "Enter valid Stop trigger and Stop limit price.",
        toastLimitQueued: "Limit placed — watching Mark, then opens Swap.",
        toastStopQueued: "Stop Limit placed — watching trigger, then opens Swap.",
        toastOrderCancelled: "Pending order cancelled.",
        toastOrderTriggered: "Order conditions met — open Swap to sign.",
        perpHistoryEmpty: "No order history yet.",
        perpOrdersEmpty: "No open orders. Web3 Limit / Stop Limit appear here.",
        cancelOrder: "Cancel",
        armedLabel: "Armed",
        waitingLabel: "Waiting",
        limitPrice: "Limit price", stopTrigger: "Stop trigger", stopLimitPrice: "Stop limit price", useMark: "Mark",
        launch: "Launch",
        launchTitle: "Launchpad",
        launchHint: "AI Agent only · real launchpad form → Launch builds a prompt (simulate → confirm → deploy on BSC).",
        riskLaunch: "⚠️ Deploying tokens/NFTs costs gas and carries contract/liquidity risk. Mint/ownable rights (if enabled) belong to the contract you deploy — AgentGate is non-custodial and never auto-signs. Agent must simulate; you confirm.",
        launchTabToken: "Create Token",
        launchTabNft: "Create NFT",
        logoPh: "Logo",
        uploadLogo: "Upload logo",
        logoUrlPh: "Or paste logo URL (https://…)",
        clearLogo: "Clear",
        tokenName: "Token name",
        tokenNamePh: "e.g. AgentGate Coin",
        tokenSymbol: "Symbol",
        tokenSymbolPh: "AGT",
        tokenDecimals: "Decimals",
        tokenSupply: "Total supply",
        tokenSupplyPh: "1000000000",
        tokenDesc: "Description",
        tokenDescPh: "Short description, utility, community…",
        tokenWebsite: "Website",
        tokenTwitter: "Twitter / X",
        tokenTelegram: "Telegram",
        tokenMintable: "Mintable",
        tokenBurnable: "Burnable",
        tokenOwnable: "Ownable",
        nftImagePh: "NFT image",
        uploadNft: "Upload image",
        nftUrlPh: "Or paste image / IPFS URL",
        nftName: "NFT / collection name",
        nftNamePh: "e.g. AgentGate Pass",
        nftSymbol: "Symbol",
        nftSupply: "Mint quantity",
        nftDesc: "Description",
        nftDescPh: "NFT utility, Agent ID perks…",
        nftExternal: "External link (optional)",
        launchConfirm: "Launch → create Prompt",
        launchConfirmToken: "Launch Token → Prompt",
        launchConfirmNft: "Launch NFT → Prompt",
        toastNeedTokenName: "Enter token name and symbol.",
        toastNeedTokenSupply: "Enter a valid total supply (> 0).",
        toastNeedNftName: "Enter NFT / collection name.",
        toastNeedNftImage: "Upload an image or paste an NFT image URL.",
        toastLogoTooBig: "Logo is large — metadata only; agent will ask for URL/IPFS.",
        toastLeaderboard: "Leaderboard — coming soon", toastAnalyzing: "Analyzing...",
        toastAnalyzeFail: "Analysis failed — try again", analyzeMarket: "Analyze market",
        toastNoAdvice: "No valid advice yet", markErr: "Data error", markFail: "Failed to load",
        historyFail: "Could not load history.",
        analyzingMarket: "Analyzing market…", analyzingPerp: "Analyzing perp…",
        analyzeFailShort: "Analysis failed — try again.",
        noWalletExt: "No wallet detected. Open via http://localhost (not a raw HTML file), enable MetaMask/Binance in Edge, then retry. Or use the AI Agent tab.",
        fileProtocolWarn: "Opened as file:// — wallet extensions usually do not inject. Run: python -m http.server 3456 in frontend/, then open http://127.0.0.1:3456",
        connectFail: "Connect or sign failed.",
        pickWallet: "Choose a wallet to connect",
        walletMetaMask: "MetaMask",
        walletBinance: "Binance Wallet",
        walletAny: "Installed wallet",
        connectingWallet: "Connecting wallet…",
        disconnect: "Disconnect",
        logoutAgent: "Sign out Agent",
        disconnected: "Wallet disconnected",
        walletPhantom: "Phantom",
        signToLogin: "Sign the message in your wallet to log in…",
        openLong: "Long → Swap",
        openShort: "Short → Swap",
        placeOrderWeb3: "Open Swap (sign wallet)",
        needWeb3Wallet: "Connect a Web3 wallet first.",
        txSent: "Transaction submitted",
        txOk: "Transaction successful",
        txFail: "Transaction failed",
        web3PerpNote: "Web3: Market opens Swap now. Limit / Stop Limit watch Mark in-browser → open Swap when filled (wallet sign).",
        web3PredNote: "Web3: Predict opens an on-chain Swap (wallet sign). Full prediction markets are on the AI Agent tab.",
        web3OpenSwap: "Swap opened — check pair & amount, then confirm Swap in your wallet.",
        sendOk: "Sent successfully",
        sendFail: "Send failed",
        invalidSend: "Enter a valid BSC address and BNB amount.",
        invalidAmount: "Enter a valid amount.",
        sameToken: "Tokens must be different.",
        swapFail: "Swap failed",
        errInsufficient: "Insufficient {token} (need {need}, have {have}).",
        errNeedGas: "Need more BNB for gas (balance ≈ {have} BNB).",
        errWrongNetwork: "Wrong network — switch wallet to BNB Smart Chain (BSC).",
        errUserReject: "You rejected the transaction in the wallet.",
        errRpc: "Wallet/RPC rejected the tx (often low balance, gas, or bad swap quote). Check USDT + BNB gas on BSC.",
        perpAdvisor: "Perp Advisor", predictAdvisor: "Predict Advisor",
        askAiPh: "Ask AgentGate AI…",
        pickPair: "Select pair",
        perpMarkets: "Markets", perpChart: "Chart", perpTrade: "Trade",
        perpMarketsTitle: "Perpetual contracts",
        perpSearchPh: "Search pair…",
        perpColSym: "Symbol / Lev", perpColPrice: "Price / 24h",
        perpOpenLong: "Open Long", perpOpenShort: "Open Short",
        chipLongShort: "Long / Short", chipSafeLev: "Safe lev", chipTpSl: "TP / SL",
        chipYesNo: "Yes / No", chipHot: "Hot", chipSafeStake: "Safe stake",
        chipQLongShort: "Long or Short this pair?",
        chipQSafeLev: "Suggest safe leverage and small size",
        chipQTpSl: "Where should I set TP/SL?",
        chipQYesNo: "Should I pick Yes or No on the open market?",
        chipQHot: "Which market is most interesting today?",
        chipQSafeStake: "Suggest a small stake and safer side",
        aiPerpCh24: "24h change {ch} on {pair}.",
        aiPerpMom: "Recent ~15m momentum: {mom}.",
        aiPerpLev: "Suggest low leverage ({lev}x / max {max}x) to reduce liquidation risk.",
        aiPerpSize: "Suggested size {size} USDT margin — adjust to your risk appetite.",
        aiPerpFunding: "Current funding {funding}.",
        aiPerpMark: "Mark ≈ ${mark}; TP ~${tp}, SL ~${sl}.",
        aiPerpHeadline: "Suggest {side} {pair} with {size} USDT @ {lev}x (simulate before execute).",
        aiPerpRisk: "Perps carry high liquidation risk. AI Advisor never auto-signs — it only builds a prompt after you confirm.",
        aiPredNoMarket: "No market to analyze — pick a card first.",
        aiPredNoMarketReason: "Open a prediction card, then ask AI Advisor again.",
        aiPredNoMarketRisk: "Cannot build an order without a selected market.",
        aiPredMarket: "Market: \"{title}\".",
        aiPredOdds: "Current odds {left} {yes}% / {right} {no}%.",
        aiPredVol: "Volume {vol}, {traders} traders, ends {ends}.",
        aiPredBeat: "Price to beat ${beat} vs current ${cur}.",
        aiPredSkew: "Odds skew {spread}% — consider expected value, not just the crowd.",
        aiPredBalanced: "Odds are fairly even — prefer small stake and manage risk.",
        aiPredHeadline: "Suggest {side} on \"{title}\" with ~{amount} USDT (odds ~{pct}%).",
        aiPredRisk: "Prediction stake can be lost 100%. AI only advises — you confirm and paste the prompt into your AI Agent.",
        aiComingSoon: "Local advisor · market-data suggestions — confirm, then build a prompt for your real AI Agent",
        aiAdvisorDisclaimer: "AI Advisor only assists decisions. Not financial advice. Always simulate before execute.",
        aiConfLabel: "Confidence {n}%",
        aiPrefillPredict: "I'm unsure about \"{title}\". Which side and how much USDT stake?",
        aiPrefillPredictNone: "Which market is most interesting today and which side should I pick?",
        aiPrefillPerp: "I'm unsure Long or Short {pair}. 24h is {ch}. Which side, size, and leverage?"
    },
    zh: {
        settings: "设置", language: "语言", theme: "主题", themeLight: "浅色", themeDark: "深色",
        howto: "使用指南", howtoTitle: "如何使用 AI Agent", collapse: "收起", live: "Live",
        howtoNote: "黄金规则：AgentGate 不会自动签名。AI Agent 必须先 simulate — 由你确认后再执行。仅 BNB Smart Chain。不构成投资建议。",
        howtoSteps: [
            "<b>1. 打开你自己的 Agent ID</b> — 输入你的 <em>name.ai</em>（没有可在 Binance App 领取）。<em>不需要 Web3 钱包</em> — 这是 AI Agent 路径。禁止用于查询他人钱包。",
            "<b>2. Activate AgentGate</b> — 为 AI Agent / Agentic Wallet 生成 checkIn prompt（仅验证 Agent ID，<em>不转移资金</em>）。Activate 后才解锁地址与余额。",
            "<b>3. 选择能力 / 模式</b> — 仪表盘：<em>Perp</em>、<em>预测</em>、<em>Launch</em>、转账 / 收款 / Swap / Earn，或 <em>AI Agent tools</em>（Approve、Bridge、Cancel）。",
            "<b>4. 像真实应用一样填表</b> — 例如 Perp（Market/Limit/Stop）、Earn（Deposit/Withdraw/Claim）、Launch Token/NFT、Approve spender、Bridge 路由…",
            "<b>5. 确认 → 生成 Prompt</b> — 点击主按钮；AgentGate 打开 intent 并<em>自动复制 prompt</em>。",
            "<b>6. 粘贴到 AI Agent</b> — Claude / Codex / Binance Agent / TWAK。读取 INTENT_JSON，先 <em>simulate</em>、提示风险，等你确认后再签名/广播。",
            "<b>7. 链上审计</b> — prompt 要求在动用资金前调用 AgentGate 的 <em>logIntent</em> 与 <em>recordAction</em>（合约已配置时）。",
            "<b>8. 跟踪与管理</b> — 在 <em>最近 AI Agent intents</em> 重新打开；用 <em>Cancel</em> 取消 Limit/Stop；用 ⋮ 像 MetaMask 一样管理代币列表。"
        ],
        predict: "预测", estBalance: "预估余额", pnlToday: "今日盈亏",
        activateGate: "激活 AgentGate（链上 check-in）",
        gateOk: "已完成链上 check-in ✓", gateNeedActivate: "尚未 check-in — 请点击 Activate",
        gateNoDeploy: "尚未部署 AgentGate — 请在 config.js 填写地址", gateReadFail: "无法读取 gate 状态",
        send: "转账", receive: "收款", swap: "兑换", check: "检查",
        subtitle: "选择一条路径开始 — 普通 Web3 钱包或 AI Agent（你的 Agent ID）。",
        placeholder: "例如：yourname.ai", connect: "连接钱包", connectWeb3: "连接钱包", connected: "已连接",
        loginDivider: "或使用 Agent ID 打开", loginTitle: "AgentGate",
        flowWeb3: "Web3 Wallet", flowAgent: "AI Agent", flowAbout: "介绍",
        flowWeb3Desc: "连接钱包 → 余额 → 转账 / 收款 / Swap / Earn（Venus）。Perp 与预测会打开链上 Swap。DeFi 标签页即将推出。",
        flowAgentDesc: "AI Agent 路径：输入 name.ai → 通过 Binance AI / prompt 验证（不暴露名称/地址）→ 进入仪表盘。本机信任 24 小时。禁止用于查询他人钱包。",
        aboutKicker: "Binance Wallet × BNB Chain · Agent ID 黑客松",
        aboutTitle: "关于 AgentGate",
        aboutTagline: "所有权门控：只有你的 Agent ID 才能打开 BNB Smart Chain 上的 Web3 × AI Agent 仪表盘。",
        aboutMetricLabel: "已链上交互的 Agent ID",
        aboutP1: "AgentGate 通过链上 checkIn（Binance AI / 隐私 prompt，或所有者钱包）证明你拥有 name.ai。通过后才解锁余额、Swap / Perp / Predict / Earn，以及 Approve · Bridge · Cancel 工具。",
        aboutP2: "AI Agent 路径始终遵循 simulate → confirm → execute。AgentGate 不会自动签名，不存储助记词 / 私钥，也不通过网页 QR 登录 Agentic Wallet。",
        aboutPoint1: "两条入口：Web3 Wallet 或 AI Agent（Agent ID）",
        aboutPoint2: "验证后本机信任 24 小时；退出登录清除信任",
        aboutPoint3: "链上意图：checkIn · logIntent · recordAction",
        aboutPoint4: "不是按名称查询他人钱包的工具",
        aboutRoadmapTitle: "愿景",
        aboutRoadmapNote: "已上线 → 长期方向。技术愿景 — 不承诺自动交易或代你赚钱。涉及资产仍需用户确认。",
        aboutVisionNow: "已有",
        aboutVisionNext: "愿景",
        aboutVisionNow1: "通过 <code>name.ai</code> 做 Identity gate",
        aboutVisionNow2: "Intent → simulate → user confirm → 签名",
        aboutVisionNow3: "链上审计（<code>checkIn</code> / <code>logIntent</code>）",
        aboutVisionNow4: "双路径 Web3 × Agent",
        aboutVisionNext1: "Agent 在用户已授权的 permission / 限额内运行 — 更少步骤，仍有控制",
        aboutVisionNext2: "像 CEX 一样的一键 UX（动用资产仍需 confirm）",
        aboutVisionNext3: "更深的风险理解 + 遵守个人 policy",
        aboutVisionNext4: "自有流动性 / 社交 / 分发",
        aboutVisionNext5: "<b>在 Dashboard 工作台内嵌 ChatGPT、Grok、Claude 级 AI</b>",
        aboutDisclaimer: "面向 Agent ID 黑客松的社区项目 — 非 Binance / BNB Chain 官方产品，未获 Binance 赞助或背书。",
        aboutLinkBsc: "BscScan 合约",
        aboutLinkGh: "GitHub 源码",
        aboutFeedbackTitle: "联系 / Feedback",
        aboutFeedbackHint: "产品反馈或技术问题 — 不用于钱包登录。",
        aboutBadge: "社区项目",
        aboutCtaAgent: "进入 AI Agent",
        aboutCtaWeb3: "进入 Web3",
        aboutSubtitle: "AgentGate 是什么、如何使用 Agent ID，以及合约 / 源码链接。",
        pillWeb3: "MetaMask / Binance Wallet", pillDirect: "直接签名",
        web3Step1: "安装 / 打开 MetaMask 或 Binance Wallet", web3Step2: "在 BNB Smart Chain 连接钱包", web3Step3: "用钱包直接转账 / Swap / 交易",
        brandWeb3: "Web3 Wallet · BNB Smart Chain", brandAgent: "Agentic Wallet · BNB Smart Chain",
        loginStep1: "输入你的 Agent ID (name.ai)",
        loginStep2: "打开 Binance AI（或复制 prompt）→ checkIn",
        loginStep3: "进入仪表盘 — 本机信任 24 小时",
        agentNeedOwnWallet: "可选：连接持有钱包以立即验证本机。",
        agentOwnerMismatch: "当前 Web3 钱包与该 Agent ID 不匹配。",
        agentUnverifiedBanner: "尚未验证 — 请返回首页打开 Binance AI / checkIn。",
        addressHidden: "验证前隐藏",
        toastNeedOwnership: "请先验证 Agent ID。",
        optionalOwnerWallet: "可选：连接持有钱包",
        agentVerifyTitle: "通过 AI Agent 验证",
        agentVerifyHint: "Prompt 不含 name.ai / 钱包地址。推荐打开 Binance AI（已自动复制 prompt）。checkIn 成功后进入仪表盘。本机信任 24 小时。",
        agentVerifyWaiting: "正在等待链上 checkIn…",
        agentVerifyOk: "已验证 — 正在打开仪表盘…",
        agentVerifyHandleLabel: "准备验证 · 成功后本机信任 24 小时",
        openBinanceAi: "打开 Binance AI",
        agentVerifyIConfirmed: "我已确认",
        agentVerifyTrustHint: "本机记住 24 小时 — 不必每次开标签都验证。",
        toastBinanceAiOpened: "已复制 prompt — 粘贴到 Binance AI 并确认 checkIn。",
        toastVerifyPolling: "正在再次检查链上…",
        earn: "Earn", defi: "DeFi", stocks: "股票", soonBadge: "Soon",
        stocksNote: "参考价格 · 暂不支持链上交易",
        toastComingSoon: "即将推出 — DeFi 标签页将在后续版本上线。",
        toastEarnNeedAgent: "请先用 Agent ID（.ai）打开，再用 Earn 创建 intent。",
        toastEarnWeb3OnlyVenus: "Web3 Earn 目前支持 Venus（BNB/USDT）。其他协议请用 AI Agent。",
        toastEarnOk: "Earn 成功",
        toastEarnFail: "Earn 失败",
        toastStockSoon: "股票：演示行情 — 交易稍后上线。",
        earnTitle: "Earn",
        earnHint: "Venus / Lista / Pancake LP（BSC）。Web3：钱包签名。AI Agent：intent → simulate → confirm。",
        riskEarn: "⚠️ 风险：智能合约 / 流动性 / APY 变动。不是 CEX Simple Earn。",
        earnProtocol: "协议",
        earnProduct: "产品",
        earnConfirm: "创建 Earn Intent",
        earnConfirmWeb3: "Supply（钱包签名）",
        earnDeposit: "Deposit",
        earnWithdraw: "Withdraw",
        earnClaim: "Claim",
        earnConfirmWithdraw: "创建 Withdraw Intent",
        earnConfirmClaim: "创建 Claim Intent",
        agentTools: "AI Agent tools",
        walletActions: "钱包",
        workspaceTitle: "工作区",
        wsTrade: "Trade",
        wsCreate: "Create",
        wsTools: "Tools",
        wsAbout: "介绍",
        wsCreateHint: "创建 Token / NFT → 生成 AI Agent prompt。",
        approvals: "Approve",
        approvalsSub: "代币授权",
        bridge: "Bridge",
        bridgeSub: "跨链",
        cancelOrders: "Cancel",
        cancelOrdersSub: "Limit / Stop",
        approvalsTitle: "Approve / Revoke",
        approvalsHint: "仅 AI Agent · 在 BSC 管理 BEP-20 allowance（swap/earn/bridge 前）。",
        riskApprove: "⚠️ 错误 spender 可能导致资产风险。默认 Exact amount — 仅在理解 MaxUint256 风险时启用 Unlimited。",
        riskApproveUnlimited: "⚠️ Unlimited = MaxUint256。Spender 可能用尽全部 allowance。仅用于你信任的官方合约。",
        approveAction: "Approve",
        revokeAction: "Revoke",
        approveSpender: "Spender",
        spenderPcs: "PancakeSwap Router V2",
        spenderVenus: "Venus vUSDT",
        spenderCustom: "自定义地址…",
        spenderCustomPh: "0x… spender",
        approveAmount: "Allowance",
        approveUnlimited: "Unlimited",
        approveExact: "Exact amount",
        approveNote: "给 Agent 的备注",
        approveNotePh: "例如：兑换前 Approve USDT 给 PCS…",
        approvalsConfirm: "生成 Approve Prompt",
        toastNeedSpender: "请输入有效 spender 地址。",
        toastNeedApproveAmt: "请输入有效 allowance。",
        bridgeTitle: "Bridge",
        bridgeHint: "仅 AI Agent · 生成 bridge intent（simulate → confirm）。默认来源 BSC。",
        riskBridge: "⚠️ Bridge 有最终确认 / 地址错误 / 诈骗风险。请只用可信桥。",
        bridgeFrom: "From chain",
        bridgeTo: "To chain",
        bridgeToken: "Token",
        bridgeDest: "Destination address",
        bridgeDestPh: "0x…（默认 Agent 钱包）",
        bridgeProvider: "Bridge provider",
        bridgeSlippage: "Max slippage %",
        bridgeNotePh: "例如：Bridge USDT BSC → ETH，优先低费用…",
        bridgeConfirm: "生成 Bridge Prompt",
        toastNeedBridgeAmt: "请输入有效 bridge 数量。",
        toastSameChain: "From 与 To 必须不同。",
        cancelTitle: "Cancel Limit / Stop",
        cancelHint: "仅 AI Agent · 取消挂单 Limit / Stop Limit（perp）。",
        riskCancel: "⚠️ 取消错误订单可能失去 TP/SL 保护。请先 simulate。",
        cancelPending: "Agent 跟踪中的订单",
        cancelSelected: "取消所选",
        cancelManual: "手动输入",
        cancelMarket: "Market",
        cancelSide: "Side",
        cancelOrderType: "Order type",
        cancelPrice: "Price / trigger（可选）",
        cancelNotePh: "例如：若未成交则取消 BTC Long Stop Limit…",
        cancelConfirm: "生成 Cancel Prompt",
        toastNeedCancelOrder: "请选择跟踪订单或切换到手动输入。",
        noAgentOrders: "暂无 Agent Limit/Stop — 请先在 Perp 下单。",
        earnNeedAmount: "请输入有效的 Earn 数量。",
        earnNeedWallet: "Earn 前请先连接 Web3 钱包。",
        earnSummary: "Earn（deposit）：向 {protocol}（{product}）存入 {amount} {asset}（BNB Smart Chain）。先 simulate，确认后再 execute。",
        gateDeployAlert: "尚未配置 AgentGate 地址。请部署合约并在 frontend/config.js 中填写。",
        gateCheckFail: "Check-in 失败",
        aiAdvisorSub: "市场分析与建议 — 生成 AI Agent prompt 前由你确认。",
        aiAdvisorQLabel: "你的问题 / 犹豫点",
        aiAdvisorQPh: "例如：该 Long 还是 Short？下多少？Yes 还是 No？",
        aiAdvisorApply: "按建议确认 → 生成 Prompt",
        aiAdvisorDismiss: "仅查看，不应用",
        howtoWeb3Title: "使用指南（Web3）",
        howtoWeb3Steps: [
            "<b>1. 连接钱包</b> — MetaMask / Binance Wallet；确认网络为 <em>BNB Smart Chain</em>。",
            "<b>2. 查看余额</b> — Popular 代币列表；点 ⋮ 显示/隐藏或添加自定义代币。",
            "<b>3. 转账 / 收款 / Swap</b> — 常规钱包操作；点 Confirm 会弹出钱包签名。",
            "<b>4. Earn</b> — Venus / Lista / Pancake LP：直接签名 supply（Web3 无 Withdraw/Claim intent）。",
            "<b>5. Perp</b> — Market 立即打开 Swap；Limit / Stop Limit 跟踪 Mark，触发后再打开 Swap（需保持页面打开）。",
            "<b>6. 预测</b> — 按 Yes/No 打开链上 Swap（钱包签名）。",
            "<b>7. 看不到 Launch / Approve / Bridge？</b> — 这些模式只在 <em>AI Agent</em> 标签（intent + prompt）。"
        ],
        dashDisclaimerWeb3: "Web3 路径：你用钱包直接签名交易。确认前请检查 BNB Smart Chain。不构成投资建议。",
        pillGate: "Agent ID 门禁", pillIntent: "AI Intent", pillChain: "BNB Smart Chain", pillSimulate: "先模拟",
        loginStep1: "输入你的 Agent ID (name.ai)", loginStep2: "打开 Binance AI（或复制 prompt）→ checkIn", loginStep3: "进入仪表盘 — 本机信任 24 小时",
        loginClaim: "还没有 Agent ID？<a href=\"https://www.binance.com/en/download\" target=\"_blank\" rel=\"noopener\">在 Binance App 领取</a>（钱包 → Agent ID 横幅）",
        popular: "热门", bnbMainnet: "BNB Smart Chain · 主网", agentNft: "Agent ID NFT", loading: "加载中...",
        networkChip: "网络：BNB Smart Chain",
        toastNetworkBsc: "当前为 BNB Smart Chain（主网）。",
        toastSortValue: "排序：USD 价值",
        toastSortName: "排序：名称 A→Z",
        toastSortBalance: "排序：余额",
        manageTokensTitle: "管理代币",
        manageTokensHint: "在仪表盘显示/隐藏代币 · 按名称或代号搜索（BNB Smart Chain）。",
        manageTokenSearchPh: "输入代币名称或地址",
        showAllTokens: "全部显示",
        hideZeroTokens: "隐藏零余额",
        tokensHiddenEmpty: "没有可见代币。打开 ⋮ 重新开启。",
        done: "完成",
        tokenVisible: "显示",
        tokenHidden: "隐藏",
        addCustomToken: "添加自定义代币",
        customTokenWarn: "任何人都可以创建代币，包括伪造现有代币。添加前请在 BscScan 核对合约地址。",
        networkLabel: "网络",
        tokenContract: "代币合约地址",
        tokenContractPh: "输入代币地址",
        saveToken: "保存",
        toastTokenSaved: "已添加自定义代币。",
        toastBadTokenAddr: "代币地址无效。",
        toastTokenExists: "该代币已在列表中。",
        toastTokenLookup: "正在读取合约…",
        toastTokenLookupFail: "无法在 BSC 读取该代币。",
        lockedToken: "内置代币",
        recentIntents: "最近的 AI Agent 意图", clear: "清除", noIntents: "暂无意图 — 试试 Perp / Swap / Predict / Earn",
        history: "历史", back: "返回",
        dashDisclaimer: "AgentGate 不会自动签名。AI Agent 必须先模拟；你确认后才执行资产操作。不构成投资建议。",
        transfer: "转账", riskTransfer: "⚠️ 链上转账不可撤销。请核对地址与网络（BNB Smart Chain）。",
        from: "From", to: "To", coin: "币种", amount: "数量", available: "可用", confirm: "确认",
        recipientPh: "收款钱包地址", copyAddress: "复制地址", receiveTitle: "收款",
        yourAddress: "你的钱包地址", swapTitle: "兑换", historyTitle: "历史",
        close: "关闭", askAi: "询问 AI Advisor", copyIntent: "复制 Intent JSON",
        sendLong: "向 AI Agent 发送 Long", sendShort: "向 AI Agent 发送 Short",
        perpRisk: "⚠️ 合约有强平风险。AgentGate 不会自动签名 — AI Agent 先模拟，再由你确认。",
        perpAgentNote: "订单 → <b>AI Agent</b>（simulate → confirm → execute）",
        sizeUsdt: "仓位 (USDT)", leverage: "杠杆", takeProfit: "止盈", stopLoss: "止损",
        positionsEmpty: "暂无仓位 — Perp 订单通过 AI Agent intent（演示）。",
        predictTitle: "预测", predictRisk: "⚠️ 本金可能全部亏损。AI Agent 必须先模拟 — 你确认后才执行。",
        confirmPredict: "向 AI Agent 发送订单", chotPrompt: "确认 → 生成 Prompt",
        intentHint: "将 prompt 粘贴到 Claude / Codex / Binance Agent。Agent 必须先 <b>simulate</b>，通过后才执行。",
        copyPrompt: "复制 Prompt", copyJson: "复制 JSON", reopen: "重新打开",
        pmAiWelcome: "犹豫 Yes/No？问我 → 获得建议 → 确认后生成 AI Agent prompt。",
        perpAiWelcome: "犹豫 Long/Short？问我 → 获得仓位与杠杆建议 → 确认后生成 prompt。",
        searchMarket: "按市场、事件或关键词搜索", sortBy: "排序：推荐",
        receiveHint: "请仅在 <b>BNB Smart Chain</b> 上发送代币",
        riskSwap: "⚠️ 风险：价格波动、滑点与模拟失败可能导致资金损失。仅在 AI Agent 模拟并通过你确认后执行。",
        rate: "汇率", slippage: "滑点", minReceived: "最少到手",
        noMarket: "没有匹配的市场", noNft: "没有 Agent ID NFT", nftFail: "无法加载 NFT",
        loadingTx: "正在加载交易...", checking: "正在检查...",
        noAgentId: "未找到 Agent ID。", invalidAddr: "地址无效。请输入 name.ai",
        agentOk: "Agent ID 有效 — 正在打开 AI Agent 仪表盘...", noAgentOnAddr: "该 Agent ID / 钱包没有 Agent ID NFT。",
        agentOkVerified: "已证明所有权 — 地址与余额已解锁。",
        walletNoAgent: "钱包没有 Agent ID。请在 Binance App 领取（钱包 → Agent ID），或用 <b>name.ai</b> 检查。",
        errPrefix: "错误：", gateRemind: "建议今天 Activate（check-in）以记录到链上",
        toastCopied: "已复制地址", toastCopiedPrompt: "已复制 AI Agent prompt",
        toastCopiedJson: "已复制 Intent JSON", toastClearedIntents: "已清除意图历史",
        toastCheckIn: "正在 check-in...", toastCheckInOk: "Check-in 成功",
        toastIntentLogged: "已在链上记录 intent", toastSwapOk: "兑换成功",
        toastNoMark: "尚无 Mark 价格",
        toastMarketOnly: "Web3 Perp 仅支持市价（打开 Swap）。Limit / Stop Limit 请用 AI Agent。",
        toastNeedLimitPrice: "请输入有效的 Limit price。",
        toastNeedStopPrice: "请输入有效的 Stop trigger 与 Stop limit price。",
        toastLimitQueued: "已挂 Limit — 等待 Mark 触发后打开 Swap。",
        toastStopQueued: "已挂 Stop Limit — 等待触发后打开 Swap。",
        toastOrderCancelled: "已取消挂单。",
        toastOrderTriggered: "条件已满足 — 打开 Swap 签名。",
        perpHistoryEmpty: "暂无历史订单。",
        perpOrdersEmpty: "暂无 Open Orders。Web3 Limit / Stop Limit 会显示在这里。",
        cancelOrder: "取消",
        armedLabel: "Armed",
        waitingLabel: "Waiting",
        limitPrice: "Limit price", stopTrigger: "Stop trigger", stopLimitPrice: "Stop limit price", useMark: "Mark",
        launch: "Launch",
        launchTitle: "Launchpad",
        launchHint: "仅 AI Agent · 完整 launchpad 表单 → Launch 生成 prompt（simulate → confirm → 在 BSC 部署）。",
        riskLaunch: "⚠️ 部署 token/NFT 需 gas，存在合约与流动性风险。Mint/ownable（若开启）属于你部署的合约 — AgentGate 不托管、不自动签名。Agent 必须先 simulate，再由你确认。",
        launchTabToken: "Create Token",
        launchTabNft: "Create NFT",
        logoPh: "Logo",
        uploadLogo: "上传 Logo",
        logoUrlPh: "或粘贴 Logo URL（https://…）",
        clearLogo: "清除",
        tokenName: "代币名称",
        tokenNamePh: "例如 AgentGate Coin",
        tokenSymbol: "代号",
        tokenSymbolPh: "AGT",
        tokenDecimals: "Decimals",
        tokenSupply: "总供应量",
        tokenSupplyPh: "1000000000",
        tokenDesc: "简介",
        tokenDescPh: "简短说明、效用、社区…",
        tokenWebsite: "Website",
        tokenTwitter: "Twitter / X",
        tokenTelegram: "Telegram",
        tokenMintable: "Mintable",
        tokenBurnable: "Burnable",
        tokenOwnable: "Ownable",
        nftImagePh: "NFT 图片",
        uploadNft: "上传图片",
        nftUrlPh: "或粘贴图片 / IPFS URL",
        nftName: "NFT / 系列名称",
        nftNamePh: "例如 AgentGate Pass",
        nftSymbol: "Symbol",
        nftSupply: "铸造数量",
        nftDesc: "简介",
        nftDescPh: "NFT 效用、Agent ID 权益…",
        nftExternal: "外链（可选）",
        launchConfirm: "Launch → 生成 Prompt",
        launchConfirmToken: "Launch Token → Prompt",
        launchConfirmNft: "Launch NFT → Prompt",
        toastNeedTokenName: "请输入代币名称与代号。",
        toastNeedTokenSupply: "请输入有效总供应量（> 0）。",
        toastNeedNftName: "请输入 NFT / 系列名称。",
        toastNeedNftImage: "请上传图片或粘贴 NFT 图片 URL。",
        toastLogoTooBig: "Logo 过大 — 仅保存元数据；agent 将询问 URL/IPFS。",
        toastLeaderboard: "排行榜 — 即将推出", toastAnalyzing: "分析中...",
        toastAnalyzeFail: "分析失败 — 请重试", analyzeMarket: "分析市场",
        toastNoAdvice: "尚无有效建议", markErr: "数据错误", markFail: "加载失败",
        historyFail: "无法加载历史记录。",
        analyzingMarket: "正在分析市场…", analyzingPerp: "正在分析合约…",
        analyzeFailShort: "分析失败 — 请重试。",
        noWalletExt: "未检测到钱包。请通过 http://localhost 打开（不要直接打开 HTML 文件），在 Edge 启用 MetaMask/Binance 后重试。或使用 AI Agent 标签。",
        fileProtocolWarn: "当前为 file:// — 扩展通常不会注入。请在 frontend/ 运行 python -m http.server 3456，然后打开 http://127.0.0.1:3456",
        connectFail: "连接或签名失败。",
        pickWallet: "选择要连接的钱包",
        walletMetaMask: "MetaMask",
        walletBinance: "Binance Wallet",
        walletAny: "已安装钱包",
        connectingWallet: "正在连接钱包…",
        disconnect: "Disconnect",
        logoutAgent: "退出 Agent",
        disconnected: "已断开钱包",
        walletPhantom: "Phantom",
        signToLogin: "请在钱包中签名以登录…",
        openLong: "Long → Swap",
        openShort: "Short → Swap",
        placeOrderWeb3: "打开 Swap（钱包签名）",
        needWeb3Wallet: "请先连接 Web3 钱包。",
        txSent: "交易已提交",
        txOk: "交易成功",
        txFail: "交易失败",
        web3PerpNote: "Web3：市价立即打开 Swap。Limit / Stop Limit 在浏览器跟踪 Mark → 触发后打开 Swap（钱包签名）。",
        web3PredNote: "Web3：Predict 将打开链上 Swap（钱包签名）。完整预测市场请用 AI Agent。",
        web3OpenSwap: "已打开 Swap — 请核对交易对与数量，然后在钱包确认。",
        sendOk: "发送成功",
        sendFail: "发送失败",
        invalidSend: "请输入正确的 BSC 地址和 BNB 数量。",
        invalidAmount: "请输入有效数量。",
        sameToken: "两个代币必须不同。",
        swapFail: "兑换失败",
        errInsufficient: "{token} 不足（需要 {need}，当前 {have}）。",
        errNeedGas: "需要更多 BNB 支付 gas（约 {have} BNB）。",
        errWrongNetwork: "网络错误 — 请切换到 BNB Smart Chain (BSC)。",
        errUserReject: "你在钱包中拒绝了交易。",
        errRpc: "钱包/RPC 拒绝交易（常见原因：余额不足、gas、swap quote 失败）。请检查 BSC 上的 USDT + BNB gas。",
        perpAdvisor: "Perp Advisor", predictAdvisor: "Predict Advisor",
        askAiPh: "询问 AgentGate AI…",
        pickPair: "选择交易对",
        perpMarkets: "Markets", perpChart: "Chart", perpTrade: "Trade",
        perpMarketsTitle: "永续合约",
        perpSearchPh: "搜索交易对…",
        perpColSym: "交易对 / 杠杆", perpColPrice: "价格 / 24h",
        perpOpenLong: "开多", perpOpenShort: "开空",
        chipLongShort: "Long / Short", chipSafeLev: "Safe lev", chipTpSl: "TP / SL",
        chipYesNo: "Yes / No", chipHot: "Hot", chipSafeStake: "Safe stake",
        chipQLongShort: "这对应该 Long 还是 Short？",
        chipQSafeLev: "建议安全杠杆和小仓位",
        chipQTpSl: "TP/SL 应该设在哪里？",
        chipQYesNo: "当前市场该选 Yes 还是 No？",
        chipQHot: "今天最值得关注的市场是哪个？",
        chipQSafeStake: "建议小额下注和更稳妥的一侧",
        aiPerpCh24: "{pair} 24h 涨跌 {ch}。",
        aiPerpMom: "近 15m 动量：{mom}。",
        aiPerpLev: "建议低杠杆（{lev}x / 最大 {max}x）以降低强平风险。",
        aiPerpSize: "建议保证金 {size} USDT — 请按你的风险偏好调整。",
        aiPerpFunding: "当前资金费率 {funding}。",
        aiPerpMark: "Mark ≈ ${mark}；TP ~${tp}，SL ~${sl}。",
        aiPerpHeadline: "建议 {side} {pair}，{size} USDT @ {lev}x（执行前先 simulate）。",
        aiPerpRisk: "合约有较高强平风险。AI Advisor 不会自动签名 — 仅在你确认后生成给 AI Agent 的 prompt。",
        aiPredNoMarket: "没有可分析的市场 — 请先选择一张卡片。",
        aiPredNoMarketReason: "打开一张预测卡片后再询问 AI Advisor。",
        aiPredNoMarketRisk: "未选择市场时无法生成订单。",
        aiPredMarket: "市场：\"{title}\"。",
        aiPredOdds: "当前赔率 {left} {yes}% / {right} {no}%。",
        aiPredVol: "成交量 {vol}，{traders} 名交易者，剩余 {ends}。",
        aiPredBeat: "目标价 ${beat}，现价 ${cur}。",
        aiPredSkew: "赔率偏差 {spread}% — 关注期望价值，不要只跟风。",
        aiPredBalanced: "赔率较均衡 — 优先小额下注并管理风险。",
        aiPredHeadline: "建议在 \"{title}\" 上选 {side}，约 {amount} USDT（赔率 ~{pct}%）。",
        aiPredRisk: "预测本金可能全部亏损。AI 仅作建议 — 你确认后把 prompt 粘贴给 AI Agent。",
        aiComingSoon: "本地 Advisor · 基于行情数据建议 — 确认后生成给真实 AI Agent 的 prompt",
        aiAdvisorDisclaimer: "AI Advisor 仅辅助决策。不构成投资建议。执行前请先 simulate。",
        aiConfLabel: "置信度 {n}%",
        aiPrefillPredict: "我对 \"{title}\" 犹豫。该选哪一侧、stake 多少 USDT？",
        aiPrefillPredictNone: "今天最值得关注的市场是哪个，该选哪一侧？",
        aiPrefillPerp: "我在犹豫 {pair} 该 Long 还是 Short。24h 为 {ch}。该选方向、仓位和杠杆？"
    }
};

function tf(key, vars = {}) {
    let s = t(key);
    Object.keys(vars).forEach(k => {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    });
    return s;
}

function t(key) {
    const pack = I18N[currentLang] || I18N.en;
    if (pack[key] != null) return pack[key];
    if (I18N.en[key] != null) return I18N.en[key];
    return key;
}

function syncLangButtons() {
    document.querySelectorAll("[data-set-lang]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.setLang === currentLang);
    });
}

function syncThemeButtons() {
    document.querySelectorAll("[data-set-theme]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.setTheme === currentTheme);
    });
}

function setLanguage(lang) {
    if (!I18N[lang]) lang = "vi";
    currentLang = lang;
    try { localStorage.setItem("agentgate_lang", lang); } catch (_) {}
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    syncLangButtons();
    updateUI();
    // Cập nhật list cổ phiếu nếu đang mở tab
    const stocksSec = document.getElementById("stocksSection");
    if (stocksSec && stocksSec.style.display !== "none") renderStockList();
}

function setTheme(theme) {
    currentTheme = theme === "light" ? "light" : "dark";
    try { localStorage.setItem("agentgate_theme", currentTheme); } catch (_) {}
    document.documentElement.setAttribute("data-theme", currentTheme);
    syncThemeButtons();
}

function showToast(msg, ms) {
    let el = document.getElementById("appToast");
    if (!el) {
        el = document.createElement("div");
        el.id = "appToast";
        el.className = "toast";
        document.body.appendChild(el);
    }
    el.innerText = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    const hold = ms || (String(msg).length > 48 ? 4200 : 2400);
    showToast._t = setTimeout(() => el.classList.remove("show"), hold);
}

function updateUI() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        if (el.id === "connectWallet" || el.id === "openPerp") return;
        const key = el.getAttribute("data-i18n");
        const val = t(key);
        if (val != null && typeof val === "string") el.innerText = val;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
        const key = el.getAttribute("data-i18n-html");
        const val = t(key);
        if (val != null && typeof val === "string") el.innerHTML = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        const val = t(key);
        if (val != null) el.placeholder = val;
    });

    const aboutSub = document.getElementById("subtitle");
    if (aboutSub && loginTab === "about") aboutSub.innerText = t("aboutSubtitle");

    const input = document.getElementById("agentInput");
    if (input) input.placeholder = t("placeholder");
    const connect = document.getElementById("connectWallet");
    if (connect) connect.innerText = userAddress ? t("connected") : t("connectWeb3");

    const steps = document.getElementById("dashHowToSteps");
    if (steps) {
        const list = (entryFlow === "web3") ? t("howtoWeb3Steps") : t("howtoSteps");
        if (Array.isArray(list)) steps.innerHTML = list.map(s => `<li>${s}</li>`).join("");
    }
    const howtoTitle = document.querySelector("#dashHowTo h4");
    if (howtoTitle) howtoTitle.innerText = entryFlow === "web3" ? t("howtoWeb3Title") : t("howtoTitle");
    const disc = document.querySelector(".dash-disclaimer");
    if (disc) disc.innerText = entryFlow === "web3" ? t("dashDisclaimerWeb3") : t("dashDisclaimer");
    const modePill = document.getElementById("dashModePill");
    if (modePill) {
        modePill.className = "dash-mode-pill " + (entryFlow === "web3" ? "web3" : "agent");
        modePill.innerText = entryFlow === "web3" ? t("flowWeb3") : t("flowAgent");
    }
    const brandSub = document.getElementById("dashBrandSub");
    if (brandSub) brandSub.innerText = entryFlow === "web3" ? t("brandWeb3") : t("brandAgent");
    try { applyModeChrome(); } catch (_) {}

    const openBtn = document.getElementById("openPerp");
    if (openBtn && !openBtn.dataset.busy) {
        if (isWeb3TradeMode()) {
            openBtn.innerText = openBtn.classList.contains("open-short") ? t("openShort") : t("openLong");
        } else {
            openBtn.innerText = openBtn.classList.contains("open-short") ? t("sendShort") : t("sendLong");
        }
    }
    const predRisk = document.querySelector(".pm-risk");
    if (predRisk) predRisk.innerText = t("predictRisk");
    const perpRisk = document.querySelector(".perp-risk");
    if (perpRisk) perpRisk.innerText = t("perpRisk");
    const perpNote = document.querySelector(".perp-agent-note");
    if (perpNote) perpNote.innerHTML = t("perpAgentNote");
    const posEmpty = document.getElementById("perpPositionsEmpty");
    if (posEmpty) posEmpty.innerText = t("positionsEmpty");
    const histEmpty = document.getElementById("perpHistoryEmpty");
    if (histEmpty) histEmpty.innerText = t("perpHistoryEmpty");
    // Chỉ re-render sau khi state Web3 orders đã init (tránh TDZ phá cả app.js)
    if (window.__agWeb3PerpReady) {
        try { renderWeb3PerpOrders(); } catch (_) {}
    }
    const askPerp = document.getElementById("askAiPerp");
    if (askPerp) askPerp.innerText = t("askAi");
    const askPred = document.getElementById("askAiPredict");
    if (askPred) askPred.innerText = t("askAi");
    const confPred = document.getElementById("confirmPredict");
    if (confPred) confPred.innerText = isWeb3TradeMode() ? t("placeOrderWeb3") : t("confirmPredict");
    const closePerp = document.getElementById("closePerpPage");
    if (closePerp) closePerp.innerText = t("close");
    const closePred = document.getElementById("closePredictPage");
    if (closePred) closePred.innerText = t("close");
    const copyPerp = document.getElementById("copyPerpIntent");
    if (copyPerp) copyPerp.innerText = t("copyIntent");
    const search = document.getElementById("predictSearch");
    if (search) search.placeholder = t("searchMarket");
    const pmApply = document.getElementById("pmAiApply");
    if (pmApply) pmApply.innerText = t("chotPrompt");
    const perpApply = document.getElementById("perpAiApply");
    if (perpApply) perpApply.innerText = t("chotPrompt");
    const intentHint = document.querySelector(".intent-hint");
    if (intentHint) intentHint.innerHTML = t("intentHint");
    const copyPrompt = document.getElementById("copyIntentPrompt");
    if (copyPrompt) copyPrompt.innerText = t("copyPrompt");
    const copyJson = document.getElementById("copyIntentJson");
    if (copyJson) copyJson.innerText = t("copyJson");
    const recipient = document.getElementById("recipient");
    if (recipient) recipient.placeholder = t("recipientPh");
    const copyRecv = document.getElementById("copyReceive");
    if (copyRecv) copyRecv.innerText = t("copyAddress");
    const confirmSend = document.getElementById("confirmSend");
    if (confirmSend) confirmSend.innerText = t("confirm");
    const confirmSwap = document.getElementById("confirmSwap");
    if (confirmSwap) confirmSwap.innerText = t("swap");

    // Welcome bubbles: only reset when chat is still the single welcome bubble
    const pmMsg = document.getElementById("pmAiMessages");
    if (pmMsg && pmMsg.children.length <= 1) {
        pmMsg.innerHTML = `<div class="pm-ai-bubble bot" data-i18n="pmAiWelcome">${t("pmAiWelcome")}</div>`;
    }
    const perpMsg = document.getElementById("perpAiMessages");
    if (perpMsg && perpMsg.children.length <= 1) {
        perpMsg.innerHTML = `<div class="pm-ai-bubble bot" data-i18n="perpAiWelcome">${t("perpAiWelcome")}</div>`;
    }

    document.querySelectorAll("[data-chip-key]").forEach(btn => {
        const key = btn.getAttribute("data-chip-key");
        if (key) btn.dataset.chip = t(key);
    });
    const perpAiIn = document.getElementById("perpAiInput");
    if (perpAiIn) perpAiIn.placeholder = t("askAiPh");
    const pmAiIn = document.getElementById("pmAiInput");
    if (pmAiIn) pmAiIn.placeholder = t("askAiPh");

    syncLangButtons();
    syncThemeButtons();
    refreshGateStatus();
    if (typeof renderIntentHistory === "function") renderIntentHistory();
}

document.querySelectorAll("[data-set-lang]").forEach(btn => {
    btn.onclick = () => setLanguage(btn.dataset.setLang);
});
document.querySelectorAll("[data-set-theme]").forEach(btn => {
    btn.onclick = () => setTheme(btn.dataset.setTheme);
});

async function refreshAboutUniqueAgents() {
    const els = document.querySelectorAll(".js-unique-agents");
    if (!els.length) return;
    const setAll = (v) => els.forEach(el => { el.textContent = v; });
    try {
        const gate = getAgentGateContract(getReadProvider());
        if (!gate) { setAll("—"); return; }
        const n = await gate.uniqueAgents();
        setAll(n.toString());
    } catch (_) {
        setAll("—");
    }
}

function setEntryFlow(flow) {
    const tab = flow === "about" ? "about" : (flow === "web3" ? "web3" : "agent");
    loginTab = tab;
    if (tab !== "about") {
        entryFlow = tab;
        try { localStorage.setItem("agentgate_flow", entryFlow); } catch (_) {}
    }
    const web3Tab = document.getElementById("flowTabWeb3");
    const agentTab = document.getElementById("flowTabAgent");
    const aboutTab = document.getElementById("flowTabAbout");
    const web3Panel = document.getElementById("flowWeb3Panel");
    const agentPanel = document.getElementById("flowAgentPanel");
    const aboutPanel = document.getElementById("flowAboutPanel");
    const isWeb3 = tab === "web3";
    const isAgent = tab === "agent";
    const isAbout = tab === "about";
    if (web3Tab) {
        web3Tab.classList.toggle("active", isWeb3);
        web3Tab.setAttribute("aria-selected", isWeb3 ? "true" : "false");
    }
    if (agentTab) {
        agentTab.classList.toggle("active", isAgent);
        agentTab.setAttribute("aria-selected", isAgent ? "true" : "false");
    }
    if (aboutTab) {
        aboutTab.classList.toggle("active", isAbout);
        aboutTab.setAttribute("aria-selected", isAbout ? "true" : "false");
    }
    if (web3Panel) web3Panel.hidden = !isWeb3;
    if (agentPanel) agentPanel.hidden = !isAgent;
    if (aboutPanel) aboutPanel.hidden = !isAbout;
    const sub = document.getElementById("subtitle");
    if (sub) sub.innerText = isAbout ? t("aboutSubtitle") : t("subtitle");
    const resultDiv = document.getElementById("result");
    if (resultDiv) { resultDiv.className = ""; resultDiv.innerHTML = ""; }
    if (isAbout) {
        refreshAboutUniqueAgents();
    } else if (isWeb3) {
        pendingAgentLogin = null;
        walletConnectPurpose = "web3";
        stopAgentVerifyUi();
        const agChoices = document.getElementById("agentWalletChoices");
        if (agChoices) { agChoices.innerHTML = ""; agChoices.hidden = true; }
        renderWalletChoices("web3");
    } else {
        document.getElementById("agentInput")?.focus();
        const wChoices = document.getElementById("walletChoices");
        if (wChoices && !pendingAgentLogin) { wChoices.innerHTML = ""; wChoices.hidden = true; }
    }
    try { applyModeChrome(); } catch (_) {}
}

(function initSettingsUi() {
    setTheme(currentTheme);
    setLanguage(currentLang);
    setEntryFlow(entryFlow);
    document.getElementById("flowTabWeb3")?.addEventListener("click", () => setEntryFlow("web3"));
    document.getElementById("flowTabAgent")?.addEventListener("click", () => setEntryFlow("agent"));
    document.getElementById("flowTabAbout")?.addEventListener("click", () => setEntryFlow("about"));
    document.getElementById("aboutGoAgent")?.addEventListener("click", () => setEntryFlow("agent"));
    document.getElementById("aboutGoWeb3")?.addEventListener("click", () => setEntryFlow("web3"));
    const btn = document.getElementById("dashSettingsBtn");
    const panel = document.getElementById("dashSettingsPanel");
    if (!btn || !panel) return;
    btn.onclick = (e) => {
        e.stopPropagation();
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    document.addEventListener("click", (e) => {
        if (!panel.hidden && !e.target.closest(".dash-settings-wrap")) {
            panel.hidden = true;
            btn.setAttribute("aria-expanded", "false");
        }
    });
})();

// Soft resume: if this device has valid 24h trust and Agent flow is selected, reopen dashboard
(async function tryResumeAgentSession() {
    if (entryFlow !== "agent") return;
    const trust = readAgentTrust();
    if (!trust?.owner) return;
    try {
        const contract = new ethers.Contract(AGENT_ID_CONTRACT, AGENT_ID_ABI, getReadProvider());
        const bal = await contract.balanceOf(trust.owner);
        if (!bal.gt(0)) {
            clearAgentSession();
            return;
        }
        await completeAgentSessionLogin(trust.owner, trust.handle || shortAddr(trust.owner));
    } catch (_) {}
})();


function setLoading(isLoading) {
    document.body.classList.toggle("loading", !!isLoading);
    // An toàn: nếu treo quá lâu (ví không trả lời), tự mở khóa UI
    clearTimeout(setLoading._safe);
    if (isLoading) {
        setLoading._safe = setTimeout(() => {
            document.body.classList.remove("loading");
        }, 45000);
    }
}

function getReadProvider() {
    return new ethers.providers.JsonRpcProvider(BSC_RPC);
}

function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 6) + "..." + a.slice(-4);
}

function setSensitiveText(idOrEl, text) {
    const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return;
    el.dataset.raw = String(text);
    el.innerText = balanceHidden ? "****" : String(text);
}

function applyBalanceVisibility() {
    const dash = document.getElementById("dashboard");
    if (dash) dash.classList.toggle("balance-hidden", balanceHidden);
    document.querySelectorAll(".sensitive").forEach(el => {
        if (el.dataset.raw == null) el.dataset.raw = el.innerText;
        el.innerText = balanceHidden ? "****" : el.dataset.raw;
    });
}

function formatViNum(n, digits = 2) {
    return Number(n).toFixed(digits).replace(".", ",");
}

function updateTodayPnl(totalUsd) {
    const el = document.getElementById("todayPnl");
    if (!el || !Number.isFinite(totalUsd)) return;

    // Baseline theo từng địa chỉ — tránh so số dư Agent với baseline ví Web3 (hoặc ngược lại)
    const addr = String(currentDashboardAddress || userAddress || "").toLowerCase();
    if (!addr || !ethers.utils.isAddress(addr)) {
        setSensitiveText(el, `+ ${formatViNum(0)} USD(${formatViNum(0)}%)`);
        el.classList.remove("up", "down");
        el.classList.add("flat");
        return;
    }

    const day = new Date().toISOString().slice(0, 10);
    const key = `agentgate_pnl_baseline_v2_${addr}`;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) {}

    if (!data || data.day !== day || data.addr !== addr || !Number.isFinite(data.usd)) {
        data = { day, addr, usd: totalUsd };
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
    }

    const diff = totalUsd - data.usd;
    const pct = data.usd > 0 ? (diff / data.usd) * 100 : 0;
    const sign = diff > 0 ? "+ " : diff < 0 ? "- " : "+ ";
    setSensitiveText(el, `${sign}${formatViNum(Math.abs(diff))} USD(${formatViNum(Math.abs(pct))}%)`);
    el.classList.remove("up", "down", "flat");
    el.classList.add(diff > 0.0001 ? "up" : diff < -0.0001 ? "down" : "flat");
}

function isFileProtocol() {
    return location.protocol === "file:";
}

function listenEip6963() {
    try {
        window.addEventListener("eip6963:announceProvider", (event) => {
            const detail = event.detail;
            if (!detail?.provider || !detail?.info) return;
            const rdns = detail.info.rdns || detail.info.name || "";
            if (eip6963Providers.some(p => p.info?.uuid === detail.info.uuid || p.info?.rdns === detail.info.rdns)) return;
            eip6963Providers.push(detail);
        });
        window.dispatchEvent(new Event("eip6963:requestProvider"));
    } catch (_) {}
}

/** Phân loại ví — Binance thường giả isMetaMask nên phải loại trừ trước */
function classifyProvider(p, hint = {}) {
    const rdns = String(hint.rdns || "").toLowerCase();
    const name = String(hint.name || "").toLowerCase();
    if (rdns.includes("phantom") || name.includes("phantom") || p?.isPhantom) {
        return { id: "phantom", label: t("walletPhantom") || "Phantom" };
    }
    if (
        rdns.includes("binance") || name.includes("binance")
        || p?.isBinance || p?.isBinanceWallet || p?.bnbSign
        || (typeof window !== "undefined" && p === window.BinanceChain)
    ) {
        return { id: "binance", label: t("walletBinance") || "Binance Wallet" };
    }
    if (rdns.includes("metamask") || name.includes("metamask") || (p?.isMetaMask && !p?.isBinance && !p?.isPhantom)) {
        return { id: "metamask", label: t("walletMetaMask") || "MetaMask" };
    }
    if (p?.isCoinbaseWallet || rdns.includes("coinbase")) {
        return { id: "coinbase", label: "Coinbase" };
    }
    return { id: "other", label: hint.name || "Wallet" };
}

function providerLabel(p) {
    return classifyProvider(p).label;
}

function collectInjectedProviders() {
    const list = [];
    const push = (p, hint) => {
        if (!p || typeof p.request !== "function") return;
        if (list.some(x => x.provider === p)) return;
        const cls = classifyProvider(p, hint || {});
        list.push({ provider: p, id: cls.id, label: cls.label, rdns: hint?.rdns || "" });
    };

    eip6963Providers.forEach(d => {
        push(d.provider, { rdns: d.info?.rdns, name: d.info?.name });
    });

    const eth = window.ethereum;
    if (eth) {
        if (Array.isArray(eth.providers)) eth.providers.forEach(p => push(p));
        else push(eth);
    }
    if (window.BinanceChain) push(window.BinanceChain, { name: "Binance Wallet", rdns: "com.binance" });
    if (window.phantom?.ethereum) push(window.phantom.ethereum, { name: "Phantom", rdns: "app.phantom" });
    return list;
}

function pickInjectedProvider(prefer) {
    const list = collectInjectedProviders();
    if (!list.length) return null;
    const want = (prefer || "").toLowerCase();
    if (want === "metamask") {
        return list.find(x => x.id === "metamask")?.provider
            || list.find(x => /metamask/i.test(x.label) && x.id !== "binance")?.provider
            || null;
    }
    if (want === "binance") {
        return list.find(x => x.id === "binance")?.provider || window.BinanceChain || null;
    }
    if (want === "phantom") {
        return list.find(x => x.id === "phantom")?.provider || window.phantom?.ethereum || null;
    }
    // Không auto ưu tiên Binance/MetaMask giả — trả null để UI bắt chọn
    if (list.length === 1) return list[0].provider;
    return null;
}

function getWalletProvider() {
    // Chỉ dùng ví đã chọn khi connect — tránh nhảy sang Binance khi multi-inject
    if (injectedProvider) return injectedProvider;
    return null;
}

function setWalletProvider(p) {
    injectedProvider = p || null;
}

function renderWalletChoices(purpose) {
    if (purpose === "web3" || purpose === "agentProof") walletConnectPurpose = purpose;
    const hostId = walletConnectPurpose === "agentProof" ? "agentWalletChoices" : "walletChoices";
    const host = document.getElementById(hostId);
    const other = document.getElementById(walletConnectPurpose === "agentProof" ? "walletChoices" : "agentWalletChoices");
    if (other) { other.innerHTML = ""; other.hidden = true; }
    if (!host) return;
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const list = collectInjectedProviders();
    // Dedup theo id ví (metamask/binance/phantom…)
    const seen = new Set();
    walletChoiceList = [];
    list.forEach(item => {
        const key = item.id !== "other" ? item.id : item.label;
        if (seen.has(key)) return;
        seen.add(key);
        walletChoiceList.push(item);
    });
    if (!walletChoiceList.length) {
        host.innerHTML = "";
        host.hidden = true;
        return;
    }
    host.hidden = false;
    host.innerHTML = `<p class="wallet-choices-label">${t("pickWallet")}</p>` + walletChoiceList.map((item, idx) => `
        <button type="button" class="wallet-choice-btn" data-wallet-idx="${idx}">
            <span>${item.label}</span>
            <em>${item.id}</em>
        </button>
    `).join("");
    host.querySelectorAll("[data-wallet-idx]").forEach(btn => {
        btn.onclick = () => {
            const item = walletChoiceList[Number(btn.dataset.walletIdx)];
            if (!item?.provider) return;
            if (walletConnectPurpose === "agentProof") connectWalletForAgentProof(item.provider);
            else connectWeb3Wallet(item.provider);
        };
    });
}

function sameAddr(a, b) {
    return !!(a && b && String(a).toLowerCase() === String(b).toLowerCase());
}

function normalizeAgentLoginInput(raw) {
    let input = String(raw || "").trim();
    if (!input) return "";
    if (!ethers.utils.isAddress(input) && !input.includes(".") && /^[a-z0-9_-]+$/i.test(input)) {
        input = input.toLowerCase() + ".ai";
    }
    return input;
}

async function linkWalletAccounts(eth) {
    if (!eth || typeof eth.request !== "function") throw new Error(t("noWalletExt"));
    setWalletProvider(eth);
    await ensureBscNetwork(eth);
    provider = new ethers.providers.Web3Provider(eth, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    bindWalletEvents(eth);
    return userAddress;
}

/** Optional Web3 proof only — AI Agent path does not require this */
async function connectWalletForAgentProof(preferOrProvider) {
    const resultDiv = document.getElementById("result");
    if (isFileProtocol()) {
        if (resultDiv) {
            resultDiv.className = "error";
            resultDiv.innerText = t("fileProtocolWarn");
        }
        return;
    }
    let eth = null;
    if (preferOrProvider && typeof preferOrProvider === "object" && typeof preferOrProvider.request === "function") {
        eth = preferOrProvider;
    }
    if (!eth) {
        await waitForWallet();
        renderWalletChoices("agentProof");
        const list = collectInjectedProviders();
        if (list.length === 1) eth = list[0].provider;
        else {
            if (resultDiv) {
                resultDiv.className = list.length ? "" : "error";
                resultDiv.innerText = list.length ? t("agentNeedOwnWallet") : t("noWalletExt");
            }
            return;
        }
    }
    try {
        setLoading(true);
        await linkWalletAccounts(eth);
        // Homepage verify in progress — matching owner wallet completes this session
        if (agentVerifyOwner && sameAddr(userAddress, agentVerifyOwner)) {
            await completeAgentSessionLogin(agentVerifyOwner, agentVerifyHandle || shortAddr(userAddress));
            return;
        }
        if (currentDashboardAddress && sameAddr(userAddress, currentDashboardAddress)) {
            writeAgentSession(userAddress, currentAgentName || shortAddr(userAddress));
            agentOwnershipVerified = true;
            showToast(t("agentVerifyOk"), 2800);
            return;
        }
        await finishAgentIdLogin();
    } catch (err) {
        console.error(err);
        setWalletProvider(null);
        if (resultDiv) {
            resultDiv.className = "error";
            resultDiv.innerText = err?.reason || err?.message || t("connectFail");
        }
    } finally {
        setLoading(false);
    }
}

function clearAgentVerifyPoll() {
    if (agentVerifyPollTimer) {
        clearInterval(agentVerifyPollTimer);
        agentVerifyPollTimer = null;
    }
}

function readAgentTrust() {
    try {
        const raw = localStorage.getItem(AGENT_TRUST_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data?.owner || !data?.at) return null;
        if (Date.now() - Number(data.at) > AGENT_TRUST_MS) {
            localStorage.removeItem(AGENT_TRUST_KEY);
            return null;
        }
        return data;
    } catch (_) {
        return null;
    }
}

function writeAgentTrust(owner, handle) {
    try {
        localStorage.setItem(AGENT_TRUST_KEY, JSON.stringify({
            owner: String(owner).toLowerCase(),
            handle: String(handle || "").toLowerCase(),
            at: Date.now(),
            expiresAt: Date.now() + AGENT_TRUST_MS
        }));
    } catch (_) {}
}

/** @deprecated alias — trust 24h */
function readAgentSession() { return readAgentTrust(); }
function writeAgentSession(owner, handle) { writeAgentTrust(owner, handle); }

function clearAgentSession() {
    try { localStorage.removeItem(AGENT_TRUST_KEY); } catch (_) {}
    try { sessionStorage.removeItem("agentgate_session_v1"); } catch (_) {}
    clearAgentVerifyPoll();
    agentVerifyStartedAt = 0;
    agentVerifyOwner = "";
    agentVerifyHandle = "";
    agentVerifySessionId = "";
    agentOwnershipVerified = false;
}

function showAgentVerifyPanel(show) {
    const panel = document.getElementById("agentVerifyPanel");
    const form = document.getElementById("agentLoginForm");
    if (panel) panel.hidden = !show;
    if (form) form.hidden = !!show;
}

function stopAgentVerifyUi() {
    clearAgentVerifyPoll();
    showAgentVerifyPanel(false);
    const st = document.getElementById("agentVerifyStatus");
    if (st) st.innerText = t("agentVerifyWaiting");
}

function requireAgentOwnership() {
    if (isWeb3Mode || agentOwnershipVerified) return true;
    showToast(t("toastNeedOwnership"), 4200);
    return false;
}

/** Banner "Chưa xác minh" chỉ hiện khi Agent path chưa ownership-verified. */
function syncAgentOwnershipUi() {
    const unverified = !isWeb3Mode && !agentOwnershipVerified;
    const dash = document.getElementById("dashboard");
    if (dash) dash.classList.toggle("agent-unverified", unverified);
    const banner = document.getElementById("agentOwnershipBanner");
    if (banner) banner.hidden = !unverified;
}

function buildSessionCheckInPrompt(_owner, _handle) {
    // Privacy: không đưa name.ai / địa chỉ ví vào prompt.
    const gate = getAgentGateAddress();
    agentVerifySessionId = `ag-sess-${Date.now().toString(36)}`;
    const sessionId = agentVerifySessionId;
    const lines = [
        "AgentGate device verify on BNB Smart Chain (NO funds moved).",
        `Locale: ${currentLang || "en"}. ${promptLocaleHint()}`,
        "",
        "Do this with MY already-bound Agent wallet only:",
        gate
            ? `1) Call checkIn() on AgentGate ${gate}`
            : "1) AgentGate address missing — ask me to configure config.js, then checkIn().",
        "2) Simulate first; wait for my explicit confirm before signing.",
        "3) Return tx hash only.",
        `4) Echo challenge id: ${sessionId}`,
        "",
        "Never ask for addresses, name.ai, seeds, keys, or pairing codes.",
        "Never look up third-party Agent IDs.",
        "",
        `INTENT: ${JSON.stringify({
            protocol: "AgentGate",
            type: "gate.checkIn",
            chainId: 56,
            params: { method: "checkIn()", contract: gate || null, sessionId, purpose: "device_trust_24h" },
            policy: { simulateFirst: true, confirmBeforeSign: true, neverAskUserForAddress: true }
        })}`
    ];
    return lines.join("\n");
}

function copyAgentVerifyPromptText() {
    const ta = document.getElementById("agentVerifyPrompt");
    const text = ta?.value || "";
    if (!text) return Promise.reject(new Error("empty"));
    return navigator.clipboard.writeText(text);
}

function openBinanceAiVerify() {
    copyAgentVerifyPromptText()
        .then(() => showToast(t("toastBinanceAiOpened"), 4200))
        .catch(() => showToast(t("toastBinanceAiOpened"), 4200));
    try {
        window.open(BINANCE_AI_URL, "_blank", "noopener,noreferrer");
    } catch (_) {}
}

async function completeAgentSessionLogin(owner, handle) {
    clearAgentVerifyPoll();
    writeAgentSession(owner, handle);
    agentOwnershipVerified = true;
    currentAgentAddress = owner;
    currentAgentName = handle;
    currentDashboardAddress = owner;
    isWeb3Mode = false;
    entryFlow = "agent";
    showAgentVerifyPanel(false);
    const resultDiv = document.getElementById("result");
    if (resultDiv) {
        resultDiv.className = "ok";
        resultDiv.innerText = t("agentVerifyOk");
    }
    showToast(t("agentVerifyOk"), 2800);
    await enterDashboard(owner, handle, true);
    applyModeChrome();
}

async function pollAgentSessionVerify() {
    const owner = agentVerifyOwner;
    const handle = agentVerifyHandle;
    const started = agentVerifyStartedAt;
    if (!owner || !started) return;
    const statusEl = document.getElementById("agentVerifyStatus");
    try {
        // Optional Web3 match for this session
        if (userAddress && getWalletProvider() && sameAddr(userAddress, owner)) {
            await completeAgentSessionLogin(owner, handle);
            return;
        }
        const gateAddr = getAgentGateAddress();
        if (!gateAddr) {
            if (statusEl) statusEl.innerText = t("gateNoDeploy");
            return;
        }
        const gate = getAgentGateContract(getReadProvider());
        const last = await gate.lastCheckIn(owner);
        const lastSec = last && last.gt ? last.toNumber() : 0;
        // Fresh checkIn after this verify attempt (allow 90s clock skew)
        if (lastSec >= started - 90) {
            await completeAgentSessionLogin(owner, handle);
            return;
        }
        if (statusEl) statusEl.innerText = t("agentVerifyWaiting");
    } catch (_) {
        if (statusEl) statusEl.innerText = t("gateReadFail");
    }
}

function startAgentSessionVerify(owner, handle) {
    agentVerifyOwner = owner;
    agentVerifyHandle = handle;
    agentVerifyStartedAt = Math.floor(Date.now() / 1000);
    currentAgentAddress = owner;
    currentAgentName = handle;
    const prompt = buildSessionCheckInPrompt(owner, handle);
    const ta = document.getElementById("agentVerifyPrompt");
    if (ta) ta.value = prompt;
    const handleEl = document.getElementById("agentVerifyHandle");
    if (handleEl) handleEl.innerText = t("agentVerifyHandleLabel");
    const statusEl = document.getElementById("agentVerifyStatus");
    if (statusEl) statusEl.innerText = `${t("agentVerifyWaiting")} · ${t("agentVerifyTrustHint")}`;
    showAgentVerifyPanel(true);
    copyAgentVerifyPromptText().then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    clearAgentVerifyPoll();
    agentVerifyPollTimer = setInterval(() => { pollAgentSessionVerify(); }, 3500);
    pollAgentSessionVerify();
}

/**
 * AI Agent login — stay on homepage with verify prompt until fresh checkIn (session-scoped).
 */
async function finishAgentIdLogin() {
    const resultDiv = document.getElementById("result");
    let input = normalizeAgentLoginInput(pendingAgentLogin || document.getElementById("agentInput")?.value);
    if (input && document.getElementById("agentInput")) {
        document.getElementById("agentInput").value = input;
    }
    setEntryFlow("agent");
    isWeb3Mode = false;
    try { localStorage.setItem("agentgate_flow", "agent"); } catch (_) {}

    if (!input) {
        if (resultDiv) { resultDiv.className = "error"; resultDiv.innerText = t("invalidAddr"); }
        return;
    }

    if (resultDiv) {
        resultDiv.className = "";
        resultDiv.innerText = t("checking");
    }

    try {
        const readProvider = getReadProvider();
        const contract = new ethers.Contract(AGENT_ID_CONTRACT, AGENT_ID_ABI, readProvider);
        let ownerAddr = null;
        let displayName = input;

        if (input.toLowerCase().endsWith(".ai")) {
            const handle = input.toLowerCase().replace(/\.ai$/i, "");
            try {
                ownerAddr = await contract.ownerOfHandle(handle);
            } catch (_) {
                if (resultDiv) { resultDiv.className = "error"; resultDiv.innerText = t("noAgentId"); }
                return;
            }
            if (!ownerAddr || ownerAddr === ethers.constants.AddressZero) {
                if (resultDiv) { resultDiv.className = "error"; resultDiv.innerText = t("noAgentId"); }
                return;
            }
            displayName = input.toLowerCase();
        } else if (ethers.utils.isAddress(input)) {
            ownerAddr = ethers.utils.getAddress(input);
            displayName = shortAddr(ownerAddr);
        } else {
            if (resultDiv) { resultDiv.className = "error"; resultDiv.innerText = t("invalidAddr"); }
            return;
        }

        const balance = await contract.balanceOf(ownerAddr);
        if (!balance.gt(0)) {
            if (resultDiv) { resultDiv.className = "error"; resultDiv.innerText = t("noAgentOnAddr"); }
            return;
        }

        pendingAgentLogin = null;
        if (resultDiv) { resultDiv.className = ""; resultDiv.innerText = ""; }

        // Device trust 24h for this Agent owner → skip prompt
        const trust = readAgentTrust();
        if (trust && sameAddr(trust.owner, ownerAddr)) {
            await completeAgentSessionLogin(ownerAddr, displayName);
            return;
        }

        // Optional: Web3 owner wallet proves this session without prompt
        if (userAddress && getWalletProvider() && sameAddr(userAddress, ownerAddr)) {
            await completeAgentSessionLogin(ownerAddr, displayName);
            return;
        }

        // Homepage verify prompt + poll fresh checkIn
        startAgentSessionVerify(ownerAddr, displayName);
    } catch (err) {
        console.error(err);
        if (resultDiv) {
            resultDiv.className = "error";
            resultDiv.innerText = t("errPrefix") + (err.message || String(err));
        }
    }
}

async function waitForWallet(ms = 800) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        window.dispatchEvent(new Event("eip6963:requestProvider"));
        const list = collectInjectedProviders();
        if (list.length) return list.length === 1 ? list[0].provider : null;
        await new Promise(r => setTimeout(r, 120));
    }
    const list = collectInjectedProviders();
    return list.length === 1 ? list[0].provider : null;
}

async function ensureBscNetwork(eth = getWalletProvider()) {
    if (!eth) throw new Error(t("noWalletExt"));
    const chainId = await eth.request({ method: "eth_chainId" });
    if (chainId === BSC_CHAIN_HEX) return true;
    try {
        await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BSC_CHAIN_HEX }]
        });
        return true;
    } catch (err) {
        if (err.code === 4902 || err?.data?.originalError?.code === 4902) {
            await eth.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: BSC_CHAIN_HEX,
                    chainName: "BNB Smart Chain",
                    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                    rpcUrls: [BSC_RPC],
                    blockExplorerUrls: ["https://bscscan.com/"]
                }]
            });
            return true;
        }
        throw new Error(t("errWrongNetwork"));
    }
}

async function fetchBinancePrices() {
    const symbols = ["BNBUSDT", "ETHUSDT", "BTCUSDT", "CAKEUSDT"];
    try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
        const data = await res.json();
        if (Array.isArray(data)) {
            data.forEach(row => {
                const p = parseFloat(row.price);
                if (row.symbol === "BNBUSDT") priceCache.BNB = p;
                if (row.symbol === "ETHUSDT") priceCache.ETH = p;
                if (row.symbol === "BTCUSDT") priceCache.BTCB = p;
                if (row.symbol === "CAKEUSDT") priceCache.CAKE = p;
            });
        }
    } catch (e) {
        for (const sym of symbols) {
            try {
                const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=" + sym);
                const data = await res.json();
                const p = parseFloat(data.price);
                if (sym === "BNBUSDT") priceCache.BNB = p;
                if (sym === "ETHUSDT") priceCache.ETH = p;
                if (sym === "BTCUSDT") priceCache.BTCB = p;
                if (sym === "CAKEUSDT") priceCache.CAKE = p;
            } catch (_) {}
        }
    }
    priceCache.USDT = 1;
    priceCache.USDC = 1;
    return priceCache;
}

function amountElId(tokenId) {
    if (tokenId === "BNB") return "bnbAmount";
    if (tokenId === "USDT") return "usdtAmount";
    return tokenId.toLowerCase() + "Amount";
}
function usdElId(tokenId) {
    if (tokenId === "BNB") return "bnbUsd";
    if (tokenId === "USDT") return "usdtUsd";
    return tokenId.toLowerCase() + "Usd";
}
function priceElId(tokenId) {
    if (tokenId === "BNB") return "bnbPrice";
    return tokenId.toLowerCase() + "Price";
}

const HIDDEN_TOKENS_KEY = "agentgate_hidden_tokens_v1";
const CUSTOM_TOKENS_KEY = "agentgate_custom_tokens_v1";
let hiddenTokenIds = new Set();
let customDashTokens = [];
let manageTokenQuery = "";
let pendingCustomToken = null;

function loadHiddenTokens() {
    try {
        const raw = JSON.parse(localStorage.getItem(HIDDEN_TOKENS_KEY) || "[]");
        hiddenTokenIds = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_) {
        hiddenTokenIds = new Set();
    }
}

function saveHiddenTokens() {
    localStorage.setItem(HIDDEN_TOKENS_KEY, JSON.stringify([...hiddenTokenIds]));
}

function loadCustomTokens() {
    try {
        const raw = JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || "[]");
        customDashTokens = Array.isArray(raw) ? raw.filter(t => t && t.id && t.address) : [];
    } catch (_) {
        customDashTokens = [];
    }
}

function saveCustomTokens() {
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(customDashTokens));
}

function getAllDashTokens() {
    loadCustomTokens();
    return [...DASH_TOKENS, ...customDashTokens];
}

function isTokenVisible(id) {
    return !hiddenTokenIds.has(id);
}

function setTokenVisible(id, visible) {
    if (id === "BNB") return; // native luôn hiện như MetaMask
    if (visible) hiddenTokenIds.delete(id);
    else hiddenTokenIds.add(id);
    saveHiddenTokens();
}

function visibleDashTokens() {
    return getAllDashTokens().filter(t => isTokenVisible(t.id));
}

function tokenIconFallback(symbol) {
    const s = String(symbol || "token").toLowerCase();
    return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${s}.png`;
}

function renderTokenList() {
    const list = document.getElementById("tokenList");
    const empty = document.getElementById("tokenListEmpty");
    if (!list) return;
    loadHiddenTokens();
    const tokens = visibleDashTokens();
    if (empty) empty.hidden = tokens.length > 0;
    list.innerHTML = tokens.map(t => `
        <div class="token-row" data-token="${t.id}">
            <div class="token-left">
                <img src="${t.icon || tokenIconFallback(t.symbol)}" width="36" height="36" alt="${t.symbol}" onerror="this.src='${tokenIconFallback(t.symbol)}'">
                <div>
                    <div class="token-name">${t.symbol}</div>
                    <div id="${priceElId(t.id)}" class="token-meta">$0.00</div>
                </div>
            </div>
            <div class="token-right">
                <div id="${amountElId(t.id)}" class="sensitive">0.00</div>
                <div id="${usdElId(t.id)}" class="token-meta sensitive">$0.00</div>
            </div>
        </div>`).join("");
}

function tokenBalanceHint(id) {
    const el = document.getElementById(amountElId(id));
    if (!el) return 0;
    const raw = el.dataset.raw || el.innerText || "0";
    return parseFloat(String(raw).replace(/[^0-9.-]/g, "")) || 0;
}

function setManageView(view) {
    const listView = document.getElementById("manageListView");
    const addView = document.getElementById("manageAddView");
    if (listView) listView.hidden = view !== "list";
    if (addView) addView.hidden = view !== "add";
}

function renderManageTokenList() {
    const box = document.getElementById("manageTokenList");
    if (!box) return;
    loadHiddenTokens();
    const q = (manageTokenQuery || "").trim().toLowerCase();
    const rows = getAllDashTokens().filter(t => {
        if (!q) return true;
        return t.symbol.toLowerCase().includes(q)
            || t.name.toLowerCase().includes(q)
            || t.id.toLowerCase().includes(q)
            || (t.address || "").toLowerCase().includes(q);
    });
    if (!rows.length) {
        box.innerHTML = `<p class="history-empty">${t("manageTokenSearchPh")}</p>`;
        return;
    }
    box.innerHTML = rows.map(t => {
        const on = isTokenVisible(t.id);
        const bal = tokenBalanceHint(t.id);
        const locked = t.id === "BNB";
        const sub = bal > 0
            ? `${bal.toFixed(4)} ${t.symbol}`
            : (t.custom ? shortAddr(t.address) : "BNB Chain");
        return `<div class="manage-token-row mm-row" data-token="${t.id}">
            <div class="manage-token-left">
                <span class="mm-token-ico">
                    <img src="${t.icon || tokenIconFallback(t.symbol)}" width="36" height="36" alt="" onerror="this.src='${tokenIconFallback(t.symbol)}'">
                    <img class="mm-chain-badge" src="https://cryptologos.cc/logos/bnb-bnb-logo.png" width="14" height="14" alt="">
                </span>
                <div>
                    <strong>${t.symbol}</strong>
                    <span>${sub}</span>
                </div>
            </div>
            <button type="button" class="mm-switch ${on ? "on" : ""} ${locked ? "locked" : ""}" data-token-toggle="${t.id}" role="switch" aria-checked="${on}" ${locked ? "disabled" : ""} aria-label="${t.symbol}"></button>
        </div>`;
    }).join("");
    box.querySelectorAll("[data-token-toggle]").forEach(btn => {
        btn.onclick = () => {
            if (btn.disabled) return;
            const id = btn.dataset.tokenToggle;
            const next = !isTokenVisible(id);
            setTokenVisible(id, next);
            renderManageTokenList();
            renderTokenList();
            refreshPortfolio().catch(() => {});
        };
    });
}

function shortAddr(addr) {
    const a = String(addr || "");
    if (a.length < 12) return a;
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function openManageTokensModal() {
    manageTokenQuery = "";
    pendingCustomToken = null;
    const search = document.getElementById("manageTokenSearch");
    if (search) search.value = "";
    resetCustomTokenForm();
    setManageView("list");
    renderManageTokenList();
    document.getElementById("manageTokensModal").style.display = "flex";
    setTimeout(() => search?.focus(), 50);
}

function resetCustomTokenForm() {
    pendingCustomToken = null;
    const addr = document.getElementById("customTokenAddress");
    if (addr) addr.value = "";
    const preview = document.getElementById("customTokenPreview");
    if (preview) preview.hidden = true;
    const status = document.getElementById("customTokenStatus");
    if (status) status.innerText = "";
    const save = document.getElementById("saveCustomToken");
    if (save) save.disabled = true;
    ["customTokenSymbol", "customTokenDecimals", "customTokenName"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "—";
    });
}

async function lookupCustomToken(address) {
    const status = document.getElementById("customTokenStatus");
    const save = document.getElementById("saveCustomToken");
    const preview = document.getElementById("customTokenPreview");
    pendingCustomToken = null;
    if (save) save.disabled = true;
    if (!ethers.utils.isAddress(address)) {
        if (status) status.innerText = t("toastBadTokenAddr");
        if (preview) preview.hidden = true;
        return null;
    }
    const checksum = ethers.utils.getAddress(address);
    const exists = getAllDashTokens().some(t => (t.address || "").toLowerCase() === checksum.toLowerCase());
    if (exists) {
        if (status) status.innerText = t("toastTokenExists");
        if (preview) preview.hidden = true;
        return null;
    }
    if (status) status.innerText = t("toastTokenLookup");
    try {
        const c = new ethers.Contract(checksum, ERC20_MIN_ABI, getReadProvider());
        const [symbol, name, decimals] = await Promise.all([
            c.symbol().catch(() => "TOKEN"),
            c.name().catch(() => "Custom Token"),
            c.decimals().catch(() => 18)
        ]);
        const token = {
            id: `CUSTOM_${checksum.slice(2, 8).toUpperCase()}`,
            symbol: String(symbol || "TOKEN").slice(0, 12),
            name: String(name || "Custom Token").slice(0, 48),
            decimals: Number(decimals) || 18,
            address: checksum,
            native: false,
            custom: true,
            icon: `https://ui-avatars.com/api/?name=${encodeURIComponent(String(symbol || "T").slice(0, 2))}&background=1e2329&color=F0B90B&bold=true&size=64`
        };
        pendingCustomToken = token;
        document.getElementById("customTokenSymbol").innerText = token.symbol;
        document.getElementById("customTokenDecimals").innerText = String(token.decimals);
        document.getElementById("customTokenName").innerText = token.name;
        if (preview) preview.hidden = false;
        if (status) status.innerText = "";
        if (save) save.disabled = false;
        return token;
    } catch (_) {
        if (status) status.innerText = t("toastTokenLookupFail");
        if (preview) preview.hidden = true;
        return null;
    }
}

function savePendingCustomToken() {
    if (!pendingCustomToken) return;
    loadCustomTokens();
    if (customDashTokens.some(t => t.address.toLowerCase() === pendingCustomToken.address.toLowerCase())) {
        showToast(t("toastTokenExists"));
        return;
    }
    customDashTokens.push(pendingCustomToken);
    saveCustomTokens();
    setTokenVisible(pendingCustomToken.id, true);
    showToast(t("toastTokenSaved"));
    resetCustomTokenForm();
    setManageView("list");
    renderManageTokenList();
    renderTokenList();
    refreshPortfolio().catch(() => {});
}

loadHiddenTokens();
loadCustomTokens();

async function updateNetworkDot() {
    const el = document.getElementById("dashNetworkStatus");
    if (!el) return;
    try {
        const eth = getWalletProvider();
        if (eth && isWeb3Mode) {
            const chainId = await eth.request({ method: "eth_chainId" });
            el.className = "net-dot " + (chainId === BSC_CHAIN_HEX ? "ok" : "bad");
            el.title = chainId === BSC_CHAIN_HEX ? "BNB Smart Chain" : "Sai mạng — hãy chuyển BSC";
        } else {
            el.className = "net-dot ok";
            el.title = "Read-only BSC RPC";
        }
    } catch (_) {
        el.className = "net-dot";
    }
}

async function refreshPortfolio(address = currentDashboardAddress) {
    if (!address || !ethers.utils.isAddress(address)) return;
    const readProvider = getReadProvider();
    await fetchBinancePrices();

    let total = 0;
    currentBalance = await readProvider.getBalance(address);

    for (const t of getAllDashTokens()) {
        let amount = 0;
        try {
            if (t.native) {
                amount = parseFloat(ethers.utils.formatEther(currentBalance));
            } else {
                const c = new ethers.Contract(t.address, ERC20_MIN_ABI, readProvider);
                const bal = await c.balanceOf(address);
                amount = parseFloat(ethers.utils.formatUnits(bal, t.decimals));
            }
        } catch (_) { amount = 0; }

        const price = t.stable ? 1 : (priceCache[t.id] || priceCache[t.symbol] || 0);
        const usd = amount * price;
        total += usd;

        const amountEl = document.getElementById(amountElId(t.id));
        const usdEl = document.getElementById(usdElId(t.id));
        const priceEl = document.getElementById(priceElId(t.id));
        if (amountEl) setSensitiveText(amountEl, amount.toFixed(4));
        if (usdEl) setSensitiveText(usdEl, `$${usd.toFixed(2)}`);
        if (priceEl) priceEl.innerText = price > 0 ? `$${price.toFixed(price >= 100 ? 2 : 4)}` : (t.custom ? shortAddr(t.address) : "$0.00");
    }

    setSensitiveText("totalUsd", `$${total.toFixed(2)}`);
    updateTodayPnl(total);
    applyBalanceVisibility();
    await updateNetworkDot();

    sortTokenListRows();
}

let tokenSortMode = localStorage.getItem("agentgate_token_sort") || "value";

function sortTokenListRows() {
    const list = document.getElementById("tokenList");
    if (!list) return;
    const rows = [...list.querySelectorAll(".token-row")];
    rows.sort((a, b) => {
        const idA = a.dataset.token || "";
        const idB = b.dataset.token || "";
        if (tokenSortMode === "name") return idA.localeCompare(idB);
        if (tokenSortMode === "balance") {
            const ba = parseFloat((document.getElementById(amountElId(idA))?.dataset.raw || "0").replace(/[^0-9.-]/g, "")) || 0;
            const bb = parseFloat((document.getElementById(amountElId(idB))?.dataset.raw || "0").replace(/[^0-9.-]/g, "")) || 0;
            return bb - ba;
        }
        const ua = parseFloat((document.getElementById(usdElId(idA))?.dataset.raw || "0").replace(/[^0-9.-]/g, "")) || 0;
        const ub = parseFloat((document.getElementById(usdElId(idB))?.dataset.raw || "0").replace(/[^0-9.-]/g, "")) || 0;
        return ub - ua;
    });
    rows.forEach(r => list.appendChild(r));
    const sortBtn = document.getElementById("sortTokensBtn");
    if (sortBtn) sortBtn.classList.toggle("active", tokenSortMode !== "value");
}

function cycleTokenSort() {
    tokenSortMode = tokenSortMode === "value" ? "name" : tokenSortMode === "name" ? "balance" : "value";
    localStorage.setItem("agentgate_token_sort", tokenSortMode);
    sortTokenListRows();
    showToast(
        tokenSortMode === "name" ? t("toastSortName")
            : tokenSortMode === "balance" ? t("toastSortBalance")
            : t("toastSortValue")
    );
}

function startPortfolioAutoRefresh() {
    if (portfolioRefreshTimer) clearInterval(portfolioRefreshTimer);
    portfolioRefreshTimer = setInterval(() => {
        const dash = document.getElementById("dashboard");
        if (!dash || dash.style.display === "none") return;
        if (!isWeb3Mode && !agentOwnershipVerified) {
            refreshGateStatus(currentDashboardAddress);
            return;
        }
        refreshPortfolio();
    }, 20000);
}

document.getElementById("toggleBalanceBtn").onclick = () => {
    balanceHidden = !balanceHidden;
    localStorage.setItem("agentgate_hide_balance", balanceHidden ? "1" : "0");
    applyBalanceVisibility();
};

document.getElementById("refreshPortfolioBtn").onclick = async () => {
    const btn = document.getElementById("refreshPortfolioBtn");
    btn.disabled = true;
    try { await refreshPortfolio(); } finally { btn.disabled = false; }
};

async function connectWeb3Wallet(preferOrProvider) {
    const resultDiv = document.getElementById("result");
    const statusEl = document.getElementById("walletStatus");
    walletConnectPurpose = "web3";
    pendingAgentLogin = null;
    setEntryFlow("web3");

    if (isFileProtocol()) {
        if (resultDiv) {
            resultDiv.className = "error";
            resultDiv.innerText = t("fileProtocolWarn");
        }
        return;
    }

    let eth = null;
    if (preferOrProvider && typeof preferOrProvider === "object" && typeof preferOrProvider.request === "function") {
        eth = preferOrProvider;
    } else if (typeof preferOrProvider === "string" && preferOrProvider) {
        eth = pickInjectedProvider(preferOrProvider);
    }

    if (!eth) {
        await waitForWallet();
        renderWalletChoices();
        const list = collectInjectedProviders();
        if (list.length === 1) eth = list[0].provider;
        else {
            if (resultDiv) {
                resultDiv.className = list.length ? "" : "error";
                resultDiv.innerText = list.length ? t("pickWallet") : t("noWalletExt");
            }
            if (statusEl) statusEl.innerText = "";
            return;
        }
    }

    setWalletProvider(eth);
    try {
        setLoading(true);
        if (resultDiv) {
            resultDiv.className = "";
            resultDiv.innerText = t("connectingWallet") + ` (${providerLabel(eth)})`;
        }
        await ensureBscNetwork(eth);
        provider = new ethers.providers.Web3Provider(eth, "any");
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        if (statusEl) statusEl.innerText = `${t("connected")}: ${shortAddr(userAddress)} · ${providerLabel(eth)}`;
        if (resultDiv) { resultDiv.className = "ok"; resultDiv.innerText = ""; }
        updateUI();
        isWeb3Mode = true;
        entryFlow = "web3";
        localStorage.setItem("agentgate_flow", "web3");
        bindWalletEvents(eth);

        let hasAgent = false;
        let displayName = shortAddr(userAddress);
        try {
            const readProvider = getReadProvider();
            const contract = new ethers.Contract(AGENT_ID_CONTRACT, AGENT_ID_ABI, readProvider);
            const bal = await contract.balanceOf(userAddress);
            hasAgent = bal.gt(0);
            if (hasAgent) displayName = "Agent ID";
        } catch (_) {}

        await enterDashboard(userAddress, displayName, hasAgent);
    } catch (err) {
        console.error(err);
        setWalletProvider(null);
        const msg = err?.reason || err?.message || t("connectFail");
        if (resultDiv) {
            resultDiv.className = "error";
            resultDiv.innerText = msg;
        }
    } finally {
        setLoading(false);
    }
}

document.getElementById("connectWallet").onclick = () => {
    // Luôn hiện danh sách ví trước — tránh auto-connect làm UI “đơ” chờ popup
    setLoading(false);
    walletConnectPurpose = "web3";
    pendingAgentLogin = null;
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    renderWalletChoices("web3");
    const list = collectInjectedProviders();
    const resultDiv = document.getElementById("result");
    if (!list.length) {
        if (resultDiv) {
            resultDiv.className = "error";
            resultDiv.innerText = t("noWalletExt");
        }
        showToast(t("noWalletExt"), 4500);
        return;
    }
    if (resultDiv) {
        resultDiv.className = "";
        resultDiv.innerText = t("pickWallet");
    }
    // Chỉ 1 ví → connect luôn; nhiều ví → user chọn nút bên dưới
    if (list.length === 1) connectWeb3Wallet(list[0].provider);
};

async function disconnectWallet() {
    const eth = injectedProvider;
    try {
        if (eth?.request) {
            await eth.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }]
            }).catch(() => {});
        }
    } catch (_) {}

    if (portfolioRefreshTimer) {
        clearInterval(portfolioRefreshTimer);
        portfolioRefreshTimer = null;
    }
    stopSwapPoll?.();

    injectedProvider = null;
    provider = null;
    signer = null;
    userAddress = "";
    isWeb3Mode = false;
    clearAgentSession();
    pendingAgentLogin = null;
    currentDashboardAddress = "";
    currentAgentAddress = "";
    currentAgentName = "";
    currentBalance = ethers.BigNumber.from(0);
    document.getElementById("dashboard")?.classList.remove("agent-unverified");
    stopAgentVerifyUi();

    document.getElementById("dashboard").style.display = "none";
    const login = document.getElementById("loginSection");
    if (login) login.style.display = "block";
    placeSettingsHost("login");
    const resultDiv = document.getElementById("result");
    if (resultDiv) { resultDiv.className = "ok"; resultDiv.innerText = t("disconnected"); }
    const statusEl = document.getElementById("walletStatus");
    if (statusEl) statusEl.innerText = "";
    const disc = document.getElementById("disconnectBtn");
    if (disc) disc.hidden = true;
    updateUI();
    applyModeChrome();
    renderWalletChoices();
    showToast(t("disconnected"));
}

document.getElementById("disconnectBtn")?.addEventListener("click", () => disconnectWallet());
document.getElementById("disconnectBtnFooter")?.addEventListener("click", () => disconnectWallet());

function bindWalletEvents(eth) {
    if (!eth || eth.__agentGateBound) return;
    eth.__agentGateBound = true;
    eth.on?.("chainChanged", () => {
        updateNetworkDot();
        if (isWeb3Mode && getWalletProvider()) {
            provider = new ethers.providers.Web3Provider(getWalletProvider(), "any");
            signer = provider.getSigner();
        }
    });
    eth.on?.("accountsChanged", async (accs) => {
        if (!accs || !accs.length) {
            disconnectWallet();
            return;
        }
        if (isWeb3Mode && getWalletProvider()) {
            const p = getWalletProvider();
            provider = new ethers.providers.Web3Provider(p, "any");
            signer = provider.getSigner();
            userAddress = accs[0];
            let hasAgent = false;
            try {
                const contract = new ethers.Contract(AGENT_ID_CONTRACT, AGENT_ID_ABI, getReadProvider());
                hasAgent = (await contract.balanceOf(userAddress)).gt(0);
            } catch (_) {}
            await enterDashboard(userAddress, hasAgent ? "Agent ID" : shortAddr(userAddress), hasAgent);
        }
    });
}

listenEip6963();
document.body.classList.remove("loading");
setTimeout(() => {
    document.body.classList.remove("loading");
    if (entryFlow === "web3") renderWalletChoices();
}, 400);

// Phần 2: Check Agent ID — bắt buộc chứng minh ownership (không tra ví người khác)
document.getElementById("checkBtn").onclick = async () => {
    const input = normalizeAgentLoginInput(document.getElementById("agentInput")?.value);
    if (!input) return;
    document.getElementById("agentInput").value = input;
    pendingAgentLogin = input;
    setLoading(true);
    try {
        await finishAgentIdLogin();
    } finally {
        setLoading(false);
    }
};

function updateDashAgentHeader(name, hasAgent) {
    const nameEl = document.getElementById("dashAgentName");
    const badge = document.getElementById("dashAgentVerified");
    let label = name || "Agent";
    if (ethers.utils.isAddress(label)) label = shortAddr(label);
    nameEl.innerText = label;
    nameEl.title = label;
    if (hasAgent) badge.removeAttribute("hidden");
    else badge.setAttribute("hidden", "");
}

function placeSettingsHost(mode) {
    const wrap = document.getElementById("settingsWrap");
    const shell = document.querySelector(".app-shell");
    const dashSlot = document.getElementById("dashSettingsSlot");
    if (!wrap || !shell) return;
    if (mode === "dash" && dashSlot) {
        dashSlot.appendChild(wrap);
        shell.classList.add("is-dashboard");
    } else {
        const login = document.getElementById("loginSection");
        if (login) shell.insertBefore(wrap, login);
        else shell.prepend(wrap);
        shell.classList.remove("is-dashboard");
    }
    const panel = document.getElementById("dashSettingsPanel");
    const btn = document.getElementById("dashSettingsBtn");
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
}

async function enterDashboard(address, name, hasAgent) {
    const login = document.getElementById("loginSection");
    if (login) login.style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    placeSettingsHost("dash");

    currentDashboardAddress = address;
    // Web3 path always "owns" the connected session; Agent path uses agentOwnershipVerified
    if (isWeb3Mode) agentOwnershipVerified = true;
    applyModeChrome();

    const addrEl = document.getElementById("agentAddress");
    if (addrEl) {
        if (agentOwnershipVerified) {
            addrEl.innerText = shortAddr(address);
            addrEl.dataset.full = address;
        } else {
            addrEl.innerText = t("addressHidden");
            addrEl.dataset.full = "";
        }
    }
    const disc = document.getElementById("disconnectBtn");
    if (disc) {
        disc.hidden = false;
        disc.innerText = isWeb3Mode ? t("disconnect") : t("logoutAgent");
    }
    const discFoot = document.getElementById("disconnectBtnFooter");
    if (discFoot) discFoot.innerText = isWeb3Mode ? t("disconnect") : t("logoutAgent");

    let verified = !!hasAgent;
    if (!verified) {
        try {
            const contract = new ethers.Contract(AGENT_ID_CONTRACT, AGENT_ID_ABI, getReadProvider());
            verified = (await contract.balanceOf(address)).gt(0);
        } catch (_) {}
    }

    const rawName = String(name || "").trim();
    let display;
    if (rawName.toLowerCase().endsWith(".ai")) {
        display = rawName.toLowerCase();
        verified = true;
    } else if (verified) {
        display = rawName && !ethers.utils.isAddress(rawName) ? rawName : "Agent ID";
    } else {
        display = agentOwnershipVerified ? shortAddr(address) : t("addressHidden");
    }

    currentAgentName = display;
    updateDashAgentHeader(display, verified && (isWeb3Mode || agentOwnershipVerified));

    const scan = document.getElementById("bscscanLink");
    if (scan) {
        if (agentOwnershipVerified) scan.href = `https://bscscan.com/address/${address}`;
        else scan.removeAttribute("href");
    }

    renderTokenList();
    applyBalanceVisibility();
    if (agentOwnershipVerified || isWeb3Mode) await refreshPortfolio(address);
    else {
        const total = document.getElementById("totalUsd");
        if (total) setSensitiveText(total, "$0.00");
    }
    startPortfolioAutoRefresh();
    await refreshGateStatus(address);
    renderIntentHistory();

    // Auto check-in once/day when EOA with Agent ID is connected
    if (verified && isWeb3Mode && signer && getAgentGateAddress()) {
        try {
            const gate = getAgentGateContract(getReadProvider());
            const last = await gate.lastCheckIn(address);
            const dayAgo = Math.floor(Date.now() / 1000) - 86400;
            if (!last || last.toNumber() < dayAgo) {
                // soft prompt — user can click Activate; avoid surprise gas
                const st = document.getElementById("gateStatus");
                if (st) {
                    st.className = "gate-status";
                    st.innerText = t("gateRemind");
                }
            }
        } catch (_) {}
    }
}


// Receive
document.getElementById("receiveBtn").onclick = () => {
    if (!requireAgentOwnership()) return;
    const el = document.getElementById("agentAddress");
    const addr = (el.dataset.full || currentDashboardAddress || "").trim();
    document.getElementById("receiveAddress").innerText = addr;
    const qr = document.getElementById("receiveQr");
    if (qr && addr) {
        qr.src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=" + encodeURIComponent(addr);
        qr.onerror = () => {
            // fallback mirror
            qr.src = "https://quickchart.io/qr?size=180&text=" + encodeURIComponent(addr);
        };
    }
    document.getElementById("receiveModal").style.display = "flex";
};
document.getElementById("copyReceive").onclick = () => {
    navigator.clipboard.writeText(document.getElementById("receiveAddress").innerText);
    showToast(t("toastCopied"));
};
document.getElementById("closeReceive").onclick = () => {
    document.getElementById("receiveModal").style.display = "none";
};

// Send
function refreshSendAvailable() {
    const avail = parseFloat(ethers.utils.formatEther(currentBalance || 0));
    document.getElementById("sendAvailable").innerText = avail.toFixed(8).replace(/\.?0+$/, "") || "0";
}

function syncSendConfirmState() {
    const recipient = document.getElementById("recipient").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);
    const ok = ethers.utils.isAddress(recipient) && amount > 0;
    document.getElementById("confirmSend").disabled = !ok;
}

document.getElementById("sendBtn").onclick = () => {
    if (!requireAgentOwnership()) return;
    const addrEl = document.getElementById("agentAddress");
    const full = (addrEl.dataset.full || currentDashboardAddress || "").trim();
    const fromEl = document.getElementById("sendFromAddress");
    fromEl.innerText = full ? shortAddr(full) : "—";
    fromEl.title = full;
    refreshSendAvailable();
    syncSendConfirmState();
    document.getElementById("sendModal").style.display = "flex";
};
document.getElementById("closeSend").onclick = () => {
    document.getElementById("sendModal").style.display = "none";
};

document.getElementById("sendHistoryBtn").onclick = () => {
    document.getElementById("sendModal").style.display = "none";
    const histBtn = document.getElementById("historyBtn");
    if (histBtn) histBtn.click();
};

document.getElementById("sendMaxBtn").onclick = () => {
    let max = parseFloat(ethers.utils.formatEther(currentBalance || 0));
    if (max > 0.001) max -= 0.001; // gas buffer
    document.getElementById("amount").value = max > 0 ? max.toFixed(8) : "";
    syncSendConfirmState();
};

document.getElementById("recipient").oninput = syncSendConfirmState;
document.getElementById("amount").oninput = syncSendConfirmState;

document.getElementById("confirmSend").onclick = async () => {
    const recipient = document.getElementById("recipient").value.trim();
    const amount = document.getElementById("amount").value.trim();
    const addrEl = document.getElementById("agentAddress");
    const fromAddr = addrEl.dataset.full || addrEl.innerText || userAddress;

    if (!recipient || !amount || !ethers.utils.isAddress(recipient) || parseFloat(amount) <= 0) {
        showToast(t("invalidSend"));
        return;
    }

    if (isWeb3TradeMode() || (isWeb3Mode && getWalletProvider())) {
        try {
            setLoading(true);
            await ensureWeb3Signer();
            const value = ethers.utils.parseEther(amount);
            const bal = await signer.getBalance();
            const gasBuffer = ethers.utils.parseEther("0.0004");
            if (bal.lt(value.add(gasBuffer))) {
                throw new Error(tf("errInsufficient", {
                    token: "BNB",
                    need: amount,
                    have: ethers.utils.formatEther(bal).slice(0, 10)
                }));
            }
            const tx = await signer.sendTransaction({ to: recipient, value });
            showToast(`${t("txSent")}: ${tx.hash.slice(0, 10)}…`);
            document.getElementById("sendModal").style.display = "none";
            await tx.wait(1);
            showToast(t("sendOk"));
            await refreshPortfolio(fromAddr || userAddress);
        } catch (err) {
            showToast(`${t("sendFail")}: ${formatTxError(err)}`);
        } finally {
            setLoading(false);
        }
        return;
    }

    const intent = buildAgentIntent("transfer.send", {
        token: "BNB",
        to: recipient,
        amount: Number(amount)
    });
    const summary = `Send ${amount} BNB to ${recipient} on BNB Smart Chain.`;
    const prompt = openIntentHandoff("Transfer BNB", intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    document.getElementById("sendModal").style.display = "none";
};

// Swap — PancakeSwap V2 (BNB Chain)
const PCS_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const SWAP_SLIPPAGE = 1; // 1% — ổn định hơn khi biến động
const ERC20_ABI = ERC20_MIN_ABI;
const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)"
];
const LISTA_STAKE_MANAGER = "0x1adB950d8bB3dA4bE104211D5AB038628e477fE6";
const LISTA_STAKE_ABI = ["function deposit() payable"];
const TOKEN_ICONS = Object.fromEntries(DASH_TOKENS.map(t => [t.id, t.icon]));
const TOKEN_META = Object.fromEntries(DASH_TOKENS.map(t => [t.id, t.name]));
const TOKEN_ADDR = Object.fromEntries(DASH_TOKENS.map(t => [t.id, t.native ? WBNB : t.address]));
const SWAP_TOKEN_IDS = DASH_TOKENS.map(t => t.id);

function isWeb3TradeMode() {
    // Ví đã connect + đang ở luồng Web3 (hoặc còn signer) → hành xử như dApp thường
    return !!isWeb3Mode && (entryFlow === "web3" || !!getWalletProvider());
}

function setDashWorkspace(panel) {
    const allowed = isWeb3TradeMode() ? ["trade", "about"] : ["trade", "create", "tools", "about"];
    dashWorkspacePanel = allowed.includes(panel) ? panel : "trade";
    try { localStorage.setItem("agentgate_dash_panel", dashWorkspacePanel); } catch (_) {}
    document.querySelectorAll("#dashWorkspaceSeg .dash-seg-btn").forEach(btn => {
        const id = btn.dataset.dashPanel || "trade";
        const isAgentBtn = btn.classList.contains("agent-only");
        if (isAgentBtn) btn.hidden = isWeb3TradeMode();
        const on = id === dashWorkspacePanel;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".dash-panel").forEach(p => {
        const id = p.dataset.panel || "";
        const show = id === dashWorkspacePanel;
        if (p.classList.contains("agent-only") && isWeb3TradeMode()) {
            p.hidden = true;
            return;
        }
        p.hidden = !show;
    });
    if (dashWorkspacePanel === "about") refreshAboutUniqueAgents();
}

function applyModeChrome() {
    const shell = document.querySelector(".app-shell");
    if (shell) {
        shell.classList.toggle("mode-web3", isWeb3TradeMode());
        shell.classList.toggle("mode-agent", !isWeb3TradeMode());
    }
    document.querySelectorAll(".agent-only").forEach(el => {
        if (el.matches(".dash-panel")) return; // setDashWorkspace quản lý
        if (el.id === "agentOwnershipBanner") return; // syncAgentOwnershipUi
        el.hidden = isWeb3TradeMode();
    });
    syncAgentOwnershipUi();
    setDashWorkspace(dashWorkspacePanel);
    const openBtn = document.getElementById("openPerp");
    if (openBtn && !openBtn.dataset.busy) {
        if (isWeb3TradeMode()) {
            openBtn.innerText = perpSide === "Short" ? t("openShort") : t("openLong");
        } else {
            openBtn.innerText = perpSide === "Short" ? t("sendShort") : t("sendLong");
        }
    }
    const confPred = document.getElementById("confirmPredict");
    if (confPred) confPred.innerText = isWeb3TradeMode() ? t("placeOrderWeb3") : t("confirmPredict");
    const perpRisk = document.querySelector(".perp-risk");
    if (perpRisk) perpRisk.innerText = isWeb3TradeMode() ? t("web3PerpNote") : t("perpRisk");
    const predRisk = document.querySelector(".pm-risk");
    if (predRisk) predRisk.innerText = isWeb3TradeMode() ? t("web3PredNote") : t("predictRisk");
}

async function ensureWeb3Signer() {
    const eth = getWalletProvider();
    if (!eth) throw new Error(t("needWeb3Wallet"));
    await ensureBscNetwork(eth);
    provider = new ethers.providers.Web3Provider(eth, "any");
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    isWeb3Mode = true;
    return signer;
}

function formatTxError(err) {
    const raw = String(err?.data?.message || err?.error?.message || err?.reason || err?.message || err || "");
    const low = raw.toLowerCase();
    if (err?.code === 4001 || low.includes("user rejected") || low.includes("user denied")) return t("errUserReject");
    if (low.includes("wrong network") || low.includes("chain")) return t("errWrongNetwork");
    if (low.includes("insufficient funds") || low.includes("exceeds balance") || low.includes("transfer amount exceeds")) {
        return raw;
    }
    if (low.includes("internal json-rpc") || low.includes("execution reverted") || low.includes("estimate gas")) {
        return t("errRpc");
    }
    return raw.slice(0, 180) || t("txFail");
}

/** On-chain PancakeSwap V2 — dùng cho Swap / Web3 Perp-spot / Web3 Predict proxy */
async function executePcsTrade(fromToken, toToken, amountStr) {
    if (!amountStr || parseFloat(amountStr) <= 0) throw new Error("Invalid amount");
    if (fromToken === toToken) throw new Error("Same token");
    await ensureWeb3Signer();

    const to = await signer.getAddress();
    const amountIn = ethers.utils.parseUnits(String(amountStr), 18);

    // Preflight: balance + gas
    const bnbBal = await signer.getBalance();
    if (bnbBal.lt(ethers.utils.parseEther("0.0003"))) {
        throw new Error(tf("errNeedGas", { have: ethers.utils.formatEther(bnbBal).slice(0, 8) }));
    }
    if (fromToken === "BNB") {
        const need = amountIn.add(ethers.utils.parseEther("0.0003"));
        if (bnbBal.lt(need)) {
            throw new Error(tf("errInsufficient", {
                token: "BNB",
                need: amountStr,
                have: ethers.utils.formatEther(bnbBal).slice(0, 10)
            }));
        }
    } else {
        const tokenAddr = TOKEN_ADDR[fromToken];
        if (!tokenAddr) throw new Error("Unknown token " + fromToken);
        const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
        const bal = await token.balanceOf(to);
        if (bal.lt(amountIn)) {
            throw new Error(tf("errInsufficient", {
                token: fromToken,
                need: amountStr,
                have: ethers.utils.formatUnits(bal, 18).slice(0, 12)
            }));
        }
    }

    let path;
    try {
        path = buildSwapPath(fromToken, toToken);
    } catch (e) {
        throw new Error(e.message || "Bad swap path");
    }

    const routerRead = new ethers.Contract(PCS_ROUTER, ROUTER_ABI, getReadProvider());
    let amounts;
    try {
        amounts = await routerRead.getAmountsOut(amountIn, path);
    } catch (_) {
        throw new Error(t("errRpc") + ` (${fromToken}→${toToken})`);
    }
    const amountOut = amounts[amounts.length - 1];
    if (!amountOut || amountOut.isZero()) throw new Error(t("errRpc"));
    const minOut = amountOut.mul(Math.floor((100 - SWAP_SLIPPAGE) * 100)).div(10000);
    const router = new ethers.Contract(PCS_ROUTER, ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    let tx;

    try {
        if (fromToken === "BNB") {
            tx = await router.swapExactETHForTokens(minOut, path, to, deadline, { value: amountIn });
        } else {
            const tokenAddr = TOKEN_ADDR[fromToken];
            const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
            const allowance = await token.allowance(to, PCS_ROUTER);
            if (allowance.lt(amountIn)) {
                // BSC USDT đôi khi cần approve(0) trước
                if (!allowance.isZero() && fromToken === "USDT") {
                    const z = await token.approve(PCS_ROUTER, 0);
                    await z.wait(1);
                }
                const approveTx = await token.approve(PCS_ROUTER, ethers.constants.MaxUint256);
                await approveTx.wait(1);
            }
            if (toToken === "BNB") {
                tx = await router.swapExactTokensForETH(amountIn, minOut, path, to, deadline);
            } else {
                tx = await router.swapExactTokensForTokens(amountIn, minOut, path, to, deadline);
            }
        }
    } catch (err) {
        throw new Error(formatTxError(err));
    }
    showToast(`${t("txSent")}: ${tx.hash.slice(0, 10)}…`);
    await tx.wait(1);
    showToast(t("txOk"));
    return tx;
}

function perpSpotRoute(side, pair) {
    // Long = mua base bằng USDT; Short = bán base lấy USDT (spot qua Swap)
    const p = String(pair || "BTCUSDT").toUpperCase();
    if (p.startsWith("BNB")) {
        return side === "Long" ? { from: "USDT", to: "BNB" } : { from: "BNB", to: "USDT" };
    }
    if (p.startsWith("ETH")) {
        return side === "Long" ? { from: "USDT", to: "ETH" } : { from: "ETH", to: "USDT" };
    }
    // BTCUSDT default → BTCB
    return side === "Long" ? { from: "USDT", to: "BTCB" } : { from: "BTCB", to: "USDT" };
}

/** Mở modal Swap với cặp/số lượng sẵn — Web3 Perp/Predict dùng đường này */
async function openWeb3Swap(fromToken, toToken, amountStr) {
    if (!getWalletProvider() && !isWeb3Mode) {
        showToast(t("needWeb3Wallet"));
        return;
    }
    const from = SWAP_TOKEN_IDS.includes(fromToken) ? fromToken : "USDT";
    const to = SWAP_TOKEN_IDS.includes(toToken) ? toToken : (from === "BNB" ? "USDT" : "BNB");
    closeTokenMenus();
    document.getElementById("fromToken").value = from;
    document.getElementById("toToken").value = to === from ? (from === "USDT" ? "BNB" : "USDT") : to;
    document.getElementById("fromAmount").value = amountStr && parseFloat(amountStr) > 0 ? String(amountStr) : "";
    document.getElementById("toAmount").value = "";
    syncSwapTokenIcons();
    document.getElementById("swapModal").style.display = "flex";
    await updateSwapBalances();
    await updateSwapQuote();
    startSwapPoll();
    showToast(t("web3OpenSwap"), 3200);
}

let swapPollTimer = null;
let swapBalances = Object.fromEntries(SWAP_TOKEN_IDS.map(id => [id, "0"]));
let lastSwapQuote = { amountOut: null, path: null };

function buildSwapPath(fromToken, toToken) {
    const a = TOKEN_ADDR[fromToken];
    const b = TOKEN_ADDR[toToken];
    if (!a || !b || a === b) throw new Error("Cặp token không hợp lệ");
    if (fromToken === "BNB" || toToken === "BNB") return [a, b];
    // multi-hop qua WBNB
    return [a, WBNB, b];
}

function getSwapReadProvider() {
    return getReadProvider();
}

function stopSwapPoll() {
    if (swapPollTimer) {
        clearInterval(swapPollTimer);
        swapPollTimer = null;
    }
}

function startSwapPoll() {
    stopSwapPoll();
    swapPollTimer = setInterval(() => { updateSwapQuote(); }, 5000);
}

function syncSwapTokenIcons() {
    const from = document.getElementById("fromToken").value;
    const to = document.getElementById("toToken").value;
    document.getElementById("fromTokenIcon").src = TOKEN_ICONS[from] || TOKEN_ICONS.BNB;
    document.getElementById("fromTokenIcon").alt = from;
    document.getElementById("toTokenIcon").src = TOKEN_ICONS[to] || TOKEN_ICONS.USDT;
    document.getElementById("toTokenIcon").alt = to;
    const fromSym = document.getElementById("fromTokenSymbol");
    const toSym = document.getElementById("toTokenSymbol");
    if (fromSym) fromSym.innerText = from;
    if (toSym) toSym.innerText = to;
    const fromMeta = document.getElementById("fromTokenMeta");
    const toMeta = document.getElementById("toTokenMeta");
    if (fromMeta) fromMeta.innerText = TOKEN_META[from] || from;
    if (toMeta) toMeta.innerText = TOKEN_META[to] || to;
}

function ensureDifferentTokens(changed) {
    const fromEl = document.getElementById("fromToken");
    const toEl = document.getElementById("toToken");
    if (fromEl.value !== toEl.value) return;
    const other = SWAP_TOKEN_IDS.find(id => id !== fromEl.value) || "USDT";
    if (changed === "from") toEl.value = other;
    else fromEl.value = other;
    syncSwapTokenIcons();
}

function closeTokenMenus() {
    document.getElementById("fromTokenMenu").hidden = true;
    document.getElementById("toTokenMenu").hidden = true;
}

function renderTokenMenu(side) {
    const menu = document.getElementById(side === "from" ? "fromTokenMenu" : "toTokenMenu");
    const current = document.getElementById(side === "from" ? "fromToken" : "toToken").value;
    menu.innerHTML = DASH_TOKENS.map(t => `
        <button type="button" class="token-picker-item ${t.id === current ? "active" : ""}" data-token="${t.id}" role="option">
            <img src="${t.icon}" alt="${t.symbol}" onerror="this.style.visibility='hidden'">
            <strong>${t.symbol}</strong>
            <span>${t.name}</span>
        </button>
    `).join("");
    menu.querySelectorAll(".token-picker-item").forEach(btn => {
        btn.onclick = async () => {
            await setSwapToken(side, btn.dataset.token);
            closeTokenMenus();
        };
    });
}

async function setSwapToken(side, tokenId) {
    if (!SWAP_TOKEN_IDS.includes(tokenId)) return;
    const el = document.getElementById(side === "from" ? "fromToken" : "toToken");
    el.value = tokenId;
    ensureDifferentTokens(side);
    syncSwapTokenIcons();
    renderSwapBalances();
    await updateSwapQuote();
}

function toggleTokenMenu(side) {
    const menu = document.getElementById(side === "from" ? "fromTokenMenu" : "toTokenMenu");
    const other = document.getElementById(side === "from" ? "toTokenMenu" : "fromTokenMenu");
    other.hidden = true;
    const open = menu.hidden;
    if (open) {
        renderTokenMenu(side);
        menu.hidden = false;
    } else {
        menu.hidden = true;
    }
}

function flipSwapTokens() {
    const fromEl = document.getElementById("fromToken");
    const toEl = document.getElementById("toToken");
    const fromAmt = document.getElementById("fromAmount").value;
    const toAmt = document.getElementById("toAmount").value;
    const tmp = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = tmp;
    document.getElementById("fromAmount").value = toAmt || "";
    document.getElementById("toAmount").value = fromAmt || "";
    syncSwapTokenIcons();
    renderSwapBalances();
    updateSwapQuote();
}

function renderSwapBalances() {
    const from = document.getElementById("fromToken").value;
    const to = document.getElementById("toToken").value;
    document.getElementById("fromBalance").innerText = swapBalances[from] || "0.00";
    document.getElementById("toBalance").innerText = swapBalances[to] || "0.00";
}

async function updateSwapBalances() {
    const address = currentDashboardAddress || document.getElementById("agentAddress").dataset.full;
    if (!address || !ethers.utils.isAddress(address)) return;

    try {
        const readProvider = getSwapReadProvider();
        for (const t of DASH_TOKENS) {
            if (t.native) {
                const bnbBal = await readProvider.getBalance(address);
                swapBalances[t.id] = parseFloat(ethers.utils.formatEther(bnbBal)).toFixed(6);
            } else {
                const c = new ethers.Contract(t.address, ERC20_ABI, readProvider);
                const bal = await c.balanceOf(address);
                swapBalances[t.id] = parseFloat(ethers.utils.formatUnits(bal, t.decimals)).toFixed(4);
            }
        }
        renderSwapBalances();
    } catch (e) {
        console.log("Không lấy được số dư swap", e);
    }
}

async function getAmountsOut(amountIn, path) {
    const router = new ethers.Contract(PCS_ROUTER, ROUTER_ABI, getSwapReadProvider());
    return router.getAmountsOut(amountIn, path);
}

async function updateSwapQuote() {
    const fromToken = document.getElementById("fromToken").value;
    const toToken = document.getElementById("toToken").value;
    const amountStr = document.getElementById("fromAmount").value.trim();
    const amount = parseFloat(amountStr);

    syncSwapTokenIcons();

    try {
        const one = ethers.utils.parseUnits("1", 18);
        const refPath = buildSwapPath(fromToken, toToken);
        const refOut = await getAmountsOut(one, refPath);
        const rate = parseFloat(ethers.utils.formatUnits(refOut[refOut.length - 1], 18));
        document.getElementById("rate").innerText = `1 ${fromToken} ≈ ${rate.toFixed(4)} ${toToken}`;

        if (!amount || amount <= 0) {
            document.getElementById("toAmount").value = "";
            document.getElementById("minReceived").innerText = "--";
            lastSwapQuote = { amountOut: null, path: null };
            return;
        }

        const amountIn = ethers.utils.parseUnits(amountStr, 18);
        const path = buildSwapPath(fromToken, toToken);
        const amounts = await getAmountsOut(amountIn, path);
        const amountOut = amounts[amounts.length - 1];
        const outFmt = parseFloat(ethers.utils.formatUnits(amountOut, 18));
        const minOut = amountOut.mul(Math.floor((100 - SWAP_SLIPPAGE) * 100)).div(10000);

        document.getElementById("toAmount").value = outFmt.toFixed(6);
        document.getElementById("minReceived").innerText =
            `${parseFloat(ethers.utils.formatUnits(minOut, 18)).toFixed(6)} ${toToken}`;
        document.getElementById("swapSlippage").innerText = `${SWAP_SLIPPAGE}%`;
        lastSwapQuote = { amountOut, path, amountIn, minOut, fromToken, toToken };
    } catch (e) {
        console.log("Quote swap lỗi", e);
        document.getElementById("rate").innerText = `1 ${fromToken} ≈ -- ${toToken}`;
        if (amount > 0) {
            document.getElementById("toAmount").value = "";
            document.getElementById("minReceived").innerText = "--";
        }
        lastSwapQuote = { amountOut: null, path: null };
    }
}

document.getElementById("swapBtn").onclick = async () => {
    if (!requireAgentOwnership()) return;
    closeTokenMenus();
    document.getElementById("swapModal").style.display = "flex";
    syncSwapTokenIcons();
    await updateSwapBalances();
    await updateSwapQuote();
    startSwapPoll();
};

document.getElementById("closeSwap").onclick = () => {
    stopSwapPoll();
    closeTokenMenus();
    document.getElementById("swapModal").style.display = "none";
};

document.getElementById("fromAmount").oninput = () => { updateSwapQuote(); };

document.getElementById("fromTokenBtn").onclick = (e) => {
    e.stopPropagation();
    toggleTokenMenu("from");
};
document.getElementById("toTokenBtn").onclick = (e) => {
    e.stopPropagation();
    toggleTokenMenu("to");
};
document.addEventListener("click", () => closeTokenMenus());
document.getElementById("fromTokenMenu").addEventListener("click", e => e.stopPropagation());
document.getElementById("toTokenMenu").addEventListener("click", e => e.stopPropagation());

document.getElementById("swapFlipBtn").onclick = () => {
    closeTokenMenus();
    flipSwapTokens();
};

document.getElementById("swapMaxBtn").onclick = () => {
    const from = document.getElementById("fromToken").value;
    let bal = parseFloat(swapBalances[from]) || 0;
    if (from === "BNB" && bal > 0.002) bal = bal - 0.002;
    document.getElementById("fromAmount").value = bal > 0 ? bal.toFixed(6) : "";
    updateSwapQuote();
};

document.getElementById("confirmSwap").onclick = async () => {
    const fromToken = document.getElementById("fromToken").value;
    const toToken = document.getElementById("toToken").value;
    const amount = document.getElementById("fromAmount").value.trim();
    const agentAddr = currentDashboardAddress || document.getElementById("agentAddress")?.dataset?.full || userAddress;

    if (!amount || parseFloat(amount) <= 0) {
        showToast(t("invalidAmount"));
        return;
    }
    if (fromToken === toToken) {
        showToast(t("sameToken"));
        return;
    }

    if (isWeb3TradeMode() || (isWeb3Mode && getWalletProvider())) {
        try {
            setLoading(true);
            await executePcsTrade(fromToken, toToken, amount);
            document.getElementById("fromAmount").value = "";
            document.getElementById("toAmount").value = "";
            await updateSwapBalances();
            await refreshPortfolio(agentAddr || userAddress);
            stopSwapPoll();
            document.getElementById("swapModal").style.display = "none";
        } catch (err) {
            showToast(`${t("swapFail")}: ${formatTxError(err)}`, 5000);
        } finally {
            setLoading(false);
        }
        return;
    }

    const out = document.getElementById("toAmount").value || "?";
    const intent = buildAgentIntent("swap.execute", {
        fromToken,
        toToken,
        amountIn: Number(amount),
        amountOutExpected: Number(out) || null,
        slippagePercent: SWAP_SLIPPAGE,
        venue: "PancakeSwap V2",
        router: PCS_ROUTER
    });
    const summary = `Swap ${amount} ${fromToken} → ${toToken} on PancakeSwap V2 (BSC). Expected ≈ ${out} ${toToken}, max slippage ${SWAP_SLIPPAGE}%.`;
    const prompt = openIntentHandoff(`Swap ${fromToken} → ${toToken}`, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    stopSwapPoll();
    document.getElementById("swapModal").style.display = "none";
};

const DASH_STOCKS = [
    { symbol: "AAPL", name: "Apple", domain: "apple.com", seed: 228.5 },
    { symbol: "TSLA", name: "Tesla", domain: "tesla.com", seed: 248.2 },
    { symbol: "NVDA", name: "NVIDIA", domain: "nvidia.com", seed: 138.4 },
    { symbol: "MSFT", name: "Microsoft", domain: "microsoft.com", seed: 415.6 },
    { symbol: "AMZN", name: "Amazon", domain: "amazon.com", seed: 198.3 },
    { symbol: "GOOGL", name: "Alphabet", domain: "abc.xyz", seed: 176.8 }
];
let stockQuotes = {};
let stockPollTimer = null;

function stopStockPoll() {
    if (stockPollTimer) {
        clearInterval(stockPollTimer);
        stockPollTimer = null;
    }
}

function startStockPoll() {
    stopStockPoll();
    stockPollTimer = setInterval(() => {
        const sec = document.getElementById("stocksSection");
        if (sec && sec.style.display !== "none") refreshStockQuotes();
        else stopStockPoll();
    }, 30000);
}

function setDashMarketTab(tab) {
    const tokenSec = document.getElementById("tokenSection");
    const nftSec = document.getElementById("nftSection");
    const stocksSec = document.getElementById("stocksSection");
    const tabs = {
        token: document.getElementById("tabToken"),
        nft: document.getElementById("tabNFT"),
        stocks: document.getElementById("stocksBtn")
    };
    if (tokenSec) tokenSec.style.display = tab === "token" ? "block" : "none";
    if (nftSec) nftSec.style.display = tab === "nft" ? "block" : "none";
    if (stocksSec) stocksSec.style.display = tab === "stocks" ? "block" : "none";
    Object.entries(tabs).forEach(([key, el]) => {
        if (el) el.classList.toggle("active", key === tab);
    });
    if (tab === "stocks") startStockPoll();
    else stopStockPoll();
}

function renderStockList() {
    const list = document.getElementById("stockList");
    if (!list) return;
    list.innerHTML = DASH_STOCKS.map(s => {
        const q = stockQuotes[s.symbol] || {};
        const price = q.price != null ? q.price : s.seed;
        const ch = q.changePct != null ? q.changePct : 0;
        const up = ch >= 0;
        const chTxt = `${up ? "+" : ""}${ch.toFixed(2)}%`;
        const logo = `https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`;
        return `
        <button type="button" class="token-row stock-row" data-stock="${s.symbol}">
            <div class="token-left">
                <img src="${logo}" width="36" height="36" alt="${s.symbol}" onerror="this.style.visibility='hidden'">
                <div>
                    <div class="token-name">${s.symbol}</div>
                    <div class="token-meta">${s.name}</div>
                </div>
            </div>
            <div class="token-right">
                <div>$${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="token-meta ${up ? "stock-up" : "stock-down"}">${chTxt}</div>
            </div>
        </button>`;
    }).join("");
    list.querySelectorAll("[data-stock]").forEach(btn => {
        btn.onclick = () => showToast(`${btn.dataset.stock}: ${t("toastStockSoon")}`, 3200);
    });
}

async function refreshStockQuotes() {
    renderStockList();
    await Promise.all(DASH_STOCKS.map(async (s) => {
        try {
            const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
            const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
            const res = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?interval=1d&range=5d`,
                ctrl ? { signal: ctrl.signal } : undefined
            );
            if (timer) clearTimeout(timer);
            if (!res.ok) throw new Error("quote fail");
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
            const price = Number(meta?.regularMarketPrice);
            if (!isFinite(price) || price <= 0) throw new Error("bad price");
            const prev = closes.filter(x => x != null).slice(-2);
            let changePct = 0;
            if (prev.length >= 2 && prev[0]) changePct = ((prev[1] - prev[0]) / prev[0]) * 100;
            else if (meta?.chartPreviousClose) changePct = ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
            stockQuotes[s.symbol] = { price, changePct };
        } catch (_) {
            // seed + biến động nhẹ để UI không trống khi CORS/API fail
            const jitter = (Math.sin(Date.now() / 60000 + s.symbol.length) * 1.2);
            stockQuotes[s.symbol] = {
                price: s.seed * (1 + jitter / 100),
                changePct: jitter
            };
        }
    }));
    renderStockList();
}

document.getElementById("tabToken").onclick = () => setDashMarketTab("token");

document.getElementById("manageTokensBtn")?.addEventListener("click", () => openManageTokensModal());
document.getElementById("sortTokensBtn")?.addEventListener("click", () => cycleTokenSort());
document.getElementById("tokenNetworkBtn")?.addEventListener("click", () => showToast(t("toastNetworkBsc"), 2800));
document.getElementById("manageNetworkChip")?.addEventListener("click", () => showToast(t("toastNetworkBsc"), 2800));
document.getElementById("closeManageTokens")?.addEventListener("click", () => {
    document.getElementById("manageTokensModal").style.display = "none";
    renderTokenList();
    refreshPortfolio().catch(() => {});
});
document.getElementById("manageTokenSearch")?.addEventListener("input", (e) => {
    manageTokenQuery = e.target.value || "";
    renderManageTokenList();
});
document.getElementById("openAddCustomToken")?.addEventListener("click", () => {
    resetCustomTokenForm();
    setManageView("add");
    document.getElementById("customTokenAddress")?.focus();
});
document.getElementById("backFromAddToken")?.addEventListener("click", () => {
    resetCustomTokenForm();
    setManageView("list");
    renderManageTokenList();
});
document.getElementById("closeAddCustomToken")?.addEventListener("click", () => {
    document.getElementById("manageTokensModal").style.display = "none";
});
let customTokenLookupTimer = null;
document.getElementById("customTokenAddress")?.addEventListener("input", (e) => {
    const val = (e.target.value || "").trim();
    clearTimeout(customTokenLookupTimer);
    customTokenLookupTimer = setTimeout(() => lookupCustomToken(val), 450);
});
document.getElementById("saveCustomToken")?.addEventListener("click", () => savePendingCustomToken());

document.getElementById("tabNFT").onclick = async () => {
    setDashMarketTab("nft");

    const address = currentDashboardAddress || document.getElementById("agentAddress").dataset.full;
    const box = document.getElementById("agentNFT");
    box.innerHTML = t("loading");

    try {
        const readProvider = getReadProvider();
        const contract = new ethers.Contract(AGENT_ID_CONTRACT, AGENT_ID_ABI, readProvider);
        const bal = await contract.balanceOf(address);

        if (!bal.gt(0)) {
            box.innerHTML = `<div class="history-empty">${t("noNft")}</div>`;
            return;
        }

        let tokenId = null;
        let uri = "";
        try {
            tokenId = await contract.tokenOfOwnerByIndex(address, 0);
            uri = await contract.tokenURI(tokenId);
        } catch (_) {}

        const label = currentAgentName && String(currentAgentName).endsWith(".ai")
            ? currentAgentName
            : (tokenId != null ? `#${tokenId}` : "Agent ID");

        box.innerHTML = `
            <div class="nft-card">
                <div class="nft-badge">AI</div>
                <div style="font-weight:700;margin-bottom:4px;">${label}</div>
                <div style="font-size:12px;color:#848e9c;margin-bottom:10px;">Soulbound · BNB Chain</div>
                <a href="https://bscscan.com/token/${AGENT_ID_CONTRACT}?a=${address}" target="_blank" rel="noopener">Xem trên BscScan</a>
                ${uri ? `<div style="font-size:11px;color:#666;margin-top:8px;word-break:break-all;">${uri}</div>` : ""}
            </div>`;
    } catch (e) {
        box.innerHTML = `<div class="history-empty">${t("nftFail")}</div>`;
    }
};

document.getElementById("stocksBtn")?.addEventListener("click", async () => {
    setDashMarketTab("stocks");
    await refreshStockQuotes();
});

document.getElementById("copyAgentBtn").onclick = () => {
    if (!requireAgentOwnership()) return;
    const el = document.getElementById("agentAddress");
    const addr = el.dataset.full || currentDashboardAddress || "";
    if (!addr || !ethers.utils.isAddress(addr)) {
        showToast(t("toastNeedOwnership"), 4200);
        return;
    }
    navigator.clipboard.writeText(addr);
    showToast(t("toastCopied"));
};

function renderHistoryItems(address, items) {
    const list = document.getElementById("historyList");
    if (!items.length) {
        list.innerHTML = `
            <div class="history-empty">
                Chưa có giao dịch gần đây.<br>
                <a href="https://bscscan.com/address/${address}" target="_blank" rel="noopener">Mở BscScan</a>
            </div>`;
        return;
    }
    list.innerHTML = items.map(tx => `
        <div class="history-item">
            <div>
                <div class="h-dir ${tx.incoming ? "in" : "out"}">${tx.incoming ? "Nhận" : "Gửi"} · ${tx.valueText}</div>
                <div class="h-meta">${tx.when} · ${shortAddr(tx.counterparty)}</div>
            </div>
            <a href="https://bscscan.com/tx/${tx.hash}" target="_blank" rel="noopener">Tx</a>
        </div>`).join("");
}

async function fetchHistoryBscScan(address) {
    const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "1" || !Array.isArray(data.result)) return null;
    return data.result.map(tx => {
        const incoming = (tx.to || "").toLowerCase() === address.toLowerCase();
        const val = parseFloat(ethers.utils.formatEther(tx.value || "0"));
        return {
            hash: tx.hash,
            incoming,
            valueText: `${val.toFixed(6)} BNB`,
            when: new Date(Number(tx.timeStamp) * 1000).toLocaleString(),
            counterparty: incoming ? tx.from : tx.to
        };
    });
}

async function fetchHistoryBlockscout(address) {
    const url = `https://bsc.blockscout.com/api/v2/addresses/${address}/transactions`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.items || data.result || [];
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows.slice(0, 15).map(tx => {
        const from = (tx.from?.hash || tx.from || "").toLowerCase();
        const to = (tx.to?.hash || tx.to || "").toLowerCase();
        const incoming = to === address.toLowerCase();
        const raw = tx.value || "0";
        let val = 0;
        try { val = parseFloat(ethers.utils.formatEther(raw)); } catch (_) {
            val = parseFloat(raw) / 1e18;
        }
        const ts = tx.timestamp || tx.timeStamp;
        const when = ts ? new Date(typeof ts === "number" || /^\d+$/.test(ts) ? Number(ts) * (String(ts).length > 12 ? 1 : 1000) : ts).toLocaleString() : "";
        return {
            hash: tx.hash,
            incoming,
            valueText: `${(val || 0).toFixed(6)} BNB`,
            when,
            counterparty: incoming ? from : to
        };
    });
}

// History — BscScan rồi fallback Blockscout
document.getElementById("historyBtn").onclick = async () => {
    if (!requireAgentOwnership()) return;
    const address = currentDashboardAddress || document.getElementById("agentAddress").dataset.full;
    document.getElementById("historyModal").style.display = "flex";
    const list = document.getElementById("historyList");
    list.innerHTML = `<div class="history-empty">${t("loadingTx")}</div>`;

    try {
        let items = null;
        try { items = await fetchHistoryBscScan(address); } catch (_) {}
        if (!items) {
            try { items = await fetchHistoryBlockscout(address); } catch (_) {}
        }
        if (!items) throw new Error("history unavailable");
        renderHistoryItems(address, items);
    } catch (e) {
        list.innerHTML = `
            <div class="history-empty">
                ${t("historyFail")}<br>
                <a href="https://bscscan.com/address/${address}" target="_blank" rel="noopener">BscScan</a>
            </div>`;
    }
};

document.getElementById("closeHistory").onclick = () => {
    document.getElementById("historyModal").style.display = "none";
};

// UX: Enter để check, Esc/click nền để đóng modal
document.getElementById("agentInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("checkBtn").click();
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
        if (e.target !== modal) return;
        modal.style.display = "none";
        if (modal.id === "swapModal") stopSwapPoll();
    });
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const intentModal = document.getElementById("intentModal");
    if (intentModal && intentModal.style.display !== "none") {
        intentModal.style.display = "none";
        return;
    }
    document.querySelectorAll(".modal").forEach(m => { m.style.display = "none"; });
    stopSwapPoll();
    const perp = document.getElementById("perpPage");
    const pred = document.getElementById("predictPage");
    if (perp && perp.style.display !== "none") closePerpPage();
    if (pred && pred.style.display !== "none") closePredictPage();
});

document.getElementById("activateGateBtn").onclick = () => onChainCheckIn();
document.getElementById("optionalOwnerWalletBtn")?.addEventListener("click", () => {
    pendingAgentLogin = currentAgentName || document.getElementById("agentInput")?.value || pendingAgentLogin;
    renderWalletChoices("agentProof");
    showToast(t("agentNeedOwnWallet"), 4200);
});
document.getElementById("openBinanceAiVerify")?.addEventListener("click", () => openBinanceAiVerify());
document.getElementById("copyAgentVerifyPrompt")?.addEventListener("click", () => {
    copyAgentVerifyPromptText().then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
});
document.getElementById("confirmAgentVerifyPoll")?.addEventListener("click", () => {
    showToast(t("toastVerifyPolling"), 2200);
    pollAgentSessionVerify();
});
document.getElementById("verifyOwnerWalletBtn")?.addEventListener("click", () => {
    pendingAgentLogin = agentVerifyHandle || document.getElementById("agentInput")?.value || pendingAgentLogin;
    renderWalletChoices("agentProof");
    showToast(t("agentNeedOwnWallet"), 4200);
});
document.getElementById("cancelAgentVerify")?.addEventListener("click", () => {
    stopAgentVerifyUi();
    agentVerifyOwner = "";
    agentVerifyHandle = "";
    agentVerifyStartedAt = 0;
    agentVerifySessionId = "";
    const resultDiv = document.getElementById("result");
    if (resultDiv) { resultDiv.className = ""; resultDiv.innerText = ""; }
});
document.getElementById("clearIntentsBtn").onclick = () => {
    localStorage.removeItem("agentgate_intents");
    renderIntentHistory();
    showToast(t("toastClearedIntents"));
};

function setHowToOpen(open) {
    const box = document.getElementById("dashHowTo");
    const btn = document.getElementById("toggleHowToBtn");
    if (!box || !btn) return;
    box.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    try { localStorage.setItem("agentgate_howto_open", open ? "1" : "0"); } catch (_) {}
}

(function initHowToGuide() {
    let open = true; // mặc định mở hướng dẫn đầy đủ cho user mới
    try {
        const saved = localStorage.getItem("agentgate_howto_open");
        if (saved === "0") open = false;
        else if (saved === "1") open = true;
    } catch (_) {}
    setHowToOpen(open);
    document.getElementById("toggleHowToBtn")?.addEventListener("click", () => {
        const box = document.getElementById("dashHowTo");
        setHowToOpen(!!box?.hidden);
    });
    document.getElementById("dismissHowToBtn")?.addEventListener("click", () => setHowToOpen(false));
})();

applyBalanceVisibility();
updateUI();
renderTokenList();
refreshGateStatus();
renderIntentHistory();


// ===== AI AGENT INTENT (Hackathon: agent-wallet execution) =====
function getAgentWalletContext() {
    const a = document.getElementById("agentAddress");
    const fromDom = a && a.dataset.full && ethers.utils.isAddress(a.dataset.full) ? a.dataset.full : "";
    const wallet = currentDashboardAddress || currentAgentAddress || agentVerifyOwner || fromDom || userAddress || "";
    return {
        wallet,
        agentId: currentAgentName || agentVerifyHandle || "unknown",
        chain: "BNB Smart Chain",
        chainId: 56
    };
}

function buildAgentIntent(type, params) {
    const ctx = getAgentWalletContext();
    return {
        protocol: "AgentGate",
        version: "1.0",
        type,
        createdAt: new Date().toISOString(),
        chain: ctx.chain,
        chainId: ctx.chainId,
        wallet: ctx.wallet,
        agentId: ctx.agentId,
        params,
        policy: {
            simulateFirst: true,
            confirmBeforeSign: true,
            rejectIfSimulationFails: true,
            preferredExecutor: "AI Agent (Claude / Codex / Binance Agent / TWAK)"
        }
    };
}

function promptLocaleHint() {
    if (currentLang === "vi") {
        return "When explaining steps/risks to me, reply in Vietnamese. Keep INTENT_JSON keys, method names, and protocol IDs in English.";
    }
    if (currentLang === "zh") {
        return "When explaining steps/risks to me, reply in Chinese. Keep INTENT_JSON keys, method names, and protocol IDs in English.";
    }
    return "When explaining steps/risks to me, reply in English. Keep INTENT_JSON keys and method names unchanged.";
}

function buildAgentPrompt(intent, humanSummary) {
    const gate = getAgentGateAddress();
    const lines = [
        "You are my on-chain trading AI Agent for AgentGate on BNB Chain.",
        `Wallet: ${intent.wallet}`,
        `Agent ID: ${intent.agentId}`,
        `UI locale: ${currentLang || "en"}`,
        promptLocaleHint(),
        "",
        "TASK:",
        humanSummary,
        "",
        "RULES (mandatory):",
        "1) Parse the INTENT JSON below.",
        "2) Simulate / dry-run first. Do NOT sign or broadcast if simulation fails.",
        "3) Always require explicit user confirmation before any asset movement (transfer/trade/approve). Never bypass confirmation. Never auto-execute.",
        "4) Prefer BNB Smart Chain / BSC venues when available (Venus, Lista, PancakeSwap, etc.).",
        "5) After execution, return tx hash or clear failure reason.",
        "6) Show risk warnings for trading / leverage / prediction stakes / earn deposits. Do not promise passive income or guaranteed returns.",
        "7) For earn.deposit: use the named protocol's official contracts on BSC; never invent fake CEX Simple Earn APYs.",
        "8) Before ANY market/earn/transfer/launch execution (after simulate + user confirm): call AgentGate.logIntent then AgentGate.recordAction. Do not skip these when the contract address is set.",
        "9) For token.launch / nft.create: deploy on BNB Smart Chain only; verify bytecode; if logo/image is upload-only (no URL), ask user for IPFS/HTTPS before deploy; mint initial supply to the Agent wallet; clearly disclose mint/ownable/pause permissions; return contract address + explorer links.",
        "10) For token.approve / token.revoke: verify spender is an official contract; prefer exact allowance; only use MaxUint256/unlimited when the intent explicitly sets unlimited=true AND the user confirmed that risk; revoke sets allowance to 0.",
        "11) For bridge.transfer: only use reputable bridges; confirm source/dest chains + destination address; simulate quote/fee before sign.",
        "12) For earn.withdraw / earn.claim: use the named protocol's redeem/claim methods on BSC; never invent fake yields.",
        "13) For perp.cancel: cancel only the specified hanging Limit/Stop order(s); confirm market/side/order id or price before cancel.",
        "14) Never resolve, look up, or disclose third-party Agent ID / name.ai wallets. Operate only on the connected Agent wallet that already proved ownership in AgentGate."
    ];
    if (gate) {
        const actionTag = String(intent.type || "action").split(".")[0] || "action";
        lines.push(
            "",
            "ON-CHAIN AGENTGATE (MANDATORY before trading / earn / transfer):",
            `Contract: ${gate}`,
            "1) If not activated: call checkIn() (Agent ID only; no funds moved).",
            `2) REQUIRED: call logIntent(keccak256("${intent.type}"), keccak256(canonicalIntentJson), shortSummary).`,
            `3) REQUIRED: call recordAction("${actionTag}") after logIntent succeeds.`,
            "4) Only then proceed with the market / earn / transfer action.",
            "Return all related tx hashes (logIntent, recordAction, and the main action)."
        );
    } else {
        lines.push(
            "",
            "ON-CHAIN AGENTGATE:",
            "Contract address not set yet — proceed with intent simulation only; skip checkIn/logIntent until config.js is updated after deploy."
        );
    }
    lines.push("", "INTENT_JSON:", JSON.stringify(intent, null, 2));
    return lines.join("\n");
}

function renderIntentHistory() {
    const box = document.getElementById("intentHistoryList");
    if (!box) return;
    let prev = [];
    try { prev = JSON.parse(localStorage.getItem("agentgate_intents") || "[]"); } catch (_) {}
    if (!prev.length) {
        box.innerHTML = `<p class="history-empty">${t("noIntents")}</p>`;
        return;
    }
    box.innerHTML = prev.slice(0, 8).map((row, idx) => {
        const when = new Date(row.at || Date.now()).toLocaleString();
        return `
            <button type="button" class="intent-history-item" data-idx="${idx}">
                <div>
                    <b>${row.type || "intent"}</b>
                    <span>${when}</span>
                </div>
                <span>${t("reopen")}</span>
            </button>`;
    }).join("");
    box.querySelectorAll(".intent-history-item").forEach(btn => {
        btn.onclick = () => {
            const row = prev[Number(btn.dataset.idx)];
            if (!row?.intent) return;
            document.getElementById("intentTitle").innerText = row.type || "Intent";
            document.getElementById("intentPrompt").value = buildAgentPrompt(row.intent, row.type || "Replay intent");
            document.getElementById("intentJson").value = JSON.stringify(row.intent, null, 2);
            document.getElementById("intentModal").style.display = "flex";
        };
    });
}

function openIntentHandoff(title, intent, humanSummary) {
    // Cho phép checkIn khi chưa verified; mọi intent khác cần ownership (AI Agent hoặc ví chủ)
    const isGateCheckIn = intent?.type === "gate.checkIn";
    if (!isGateCheckIn && !isWeb3Mode && !agentOwnershipVerified) {
        showToast(t("toastNeedOwnership"), 4200);
        document.getElementById("activateGateBtn")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return "";
    }
    // Enrich intent with gate contract for agents
    const gate = getAgentGateAddress();
    if (gate) {
        intent.agentGate = {
            address: gate,
            methods: ["checkIn()", "logIntent(bytes32,bytes32,string)", "recordAction(string)"]
        };
    }
    const prompt = buildAgentPrompt(intent, humanSummary);
    document.getElementById("intentTitle").innerText = title;
    document.getElementById("intentPrompt").value = prompt;
    document.getElementById("intentJson").value = JSON.stringify(intent, null, 2);
    document.getElementById("intentModal").style.display = "flex";

    try {
        const key = "agentgate_intents";
        const prev = JSON.parse(localStorage.getItem(key) || "[]");
        prev.unshift({ at: Date.now(), type: intent.type, intent });
        localStorage.setItem(key, JSON.stringify(prev.slice(0, 20)));
    } catch (_) {}

    renderIntentHistory();

    // Best-effort on-chain log when EOA+AgentID is connected
    onChainLogIntent(intent, humanSummary);

    return prompt;
}

document.getElementById("closeIntent").onclick = () => {
    document.getElementById("intentModal").style.display = "none";
};
document.getElementById("copyIntentPrompt").onclick = () => {
    navigator.clipboard.writeText(document.getElementById("intentPrompt").value);
    showToast(t("toastCopiedPrompt"));
};
document.getElementById("copyIntentJson").onclick = () => {
    navigator.clipboard.writeText(document.getElementById("intentJson").value);
    showToast(t("toastCopiedJson"));
};

function parseMarkPrice() {
    const t = document.getElementById("markPrice")?.innerText || "";
    const n = Number(String(t).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
}

function updatePerpPreview() {
    const size = parseFloat(document.getElementById("perpSize")?.value) || 0;
    const lev = parseFloat(document.getElementById("leverageSlider")?.value) || 1;
    const mark = parseMarkPrice();
    const notional = size * lev;
    const margin = size;
    let liq = "--";
    if (mark > 0 && lev > 1) {
        const est = perpSide === "Long"
            ? mark * (1 - 0.9 / lev)
            : mark * (1 + 0.9 / lev);
        liq = "$" + fmtNum(est, 2);
    }
    const nEl = document.getElementById("prevNotional");
    const mEl = document.getElementById("prevMargin");
    const lEl = document.getElementById("prevLiq");
    if (nEl) nEl.innerText = size > 0 ? `$${fmtNum(notional, 2)}` : "--";
    if (mEl) mEl.innerText = size > 0 ? `$${fmtNum(margin, 2)}` : "--";
    if (lEl) lEl.innerText = size > 0 ? liq : "--";
}

let perpMarginMode = "Cross";
let perpOrderType = "market";

function syncPerpOrderTypeUi() {
    const limitBox = document.getElementById("perpLimitFields");
    const stopBox = document.getElementById("perpStopFields");
    if (limitBox) limitBox.hidden = perpOrderType !== "limit";
    if (stopBox) stopBox.hidden = perpOrderType !== "stop";
    document.querySelectorAll("#perpOrderTypes .perp-otype").forEach(b => {
        b.classList.toggle("active", (b.dataset.otype || "market") === perpOrderType);
    });
}

function buildPerpIntentFromForm() {
    const size = document.getElementById("perpSize").value.trim();
    const leverage = document.getElementById("leverageSlider").value;
    const tp = document.getElementById("tpPrice")?.value?.trim() || null;
    const sl = document.getElementById("slPrice")?.value?.trim() || null;
    const mark = parseMarkPrice();
    const limitPrice = document.getElementById("perpLimitPrice")?.value?.trim() || null;
    const stopTrigger = document.getElementById("perpStopTrigger")?.value?.trim() || null;
    const stopLimitPrice = document.getElementById("perpStopLimitPrice")?.value?.trim() || null;
    const params = {
        market: selectedPair,
        side: perpSide,
        sizeUsdt: Number(size),
        leverage: Number(leverage),
        orderType: perpOrderType || "market",
        marginMode: perpMarginMode || "Cross",
        takeProfit: tp ? Number(tp) : null,
        stopLoss: sl ? Number(sl) : null,
        markPrice: mark || null,
        marginUsdt: Number(size),
        notionalUsdt: Number(size) * Number(leverage),
        limitPrice: null,
        stopTrigger: null,
        stopLimitPrice: null
    };
    if (params.orderType === "limit" && limitPrice) params.limitPrice = Number(limitPrice);
    if (params.orderType === "stop") {
        if (stopTrigger) params.stopTrigger = Number(stopTrigger);
        if (stopLimitPrice) params.stopLimitPrice = Number(stopLimitPrice);
    }
    return buildAgentIntent("perp.open", params);
}

function estimateWeb3PerpAmount(route, sizeUsdt) {
    const size = parseFloat(sizeUsdt);
    if (!isFinite(size) || size <= 0) return "";
    if (route.from === "USDT" || route.from === "USDC") return size.toFixed(2);
    const mark = parseMarkPrice();
    if (route.from === "BNB") {
        const px = priceCache.BNB || mark || 0;
        return px > 0 ? (size / px).toFixed(6) : "0.01";
    }
    if (mark > 0) return (size / mark).toFixed(6);
    return "";
}

const WEB3_PERP_ORDERS_KEY = "agentgate_web3_perp_orders_v1";
let web3PerpOrders = [];
let web3PerpFilling = false;
let perpBottomTab = "positions";
window.__agWeb3PerpReady = true;

function loadWeb3PerpOrders() {
    try {
        const raw = JSON.parse(localStorage.getItem(WEB3_PERP_ORDERS_KEY) || "[]");
        web3PerpOrders = Array.isArray(raw) ? raw : [];
    } catch (_) {
        web3PerpOrders = [];
    }
}

function saveWeb3PerpOrders() {
    localStorage.setItem(WEB3_PERP_ORDERS_KEY, JSON.stringify(web3PerpOrders));
}

function limitFillable(side, mark, limitPrice) {
    if (!(mark > 0) || !(limitPrice > 0)) return false;
    return side === "Long" ? mark <= limitPrice : mark >= limitPrice;
}

function stopTriggerHit(side, mark, trigger) {
    if (!(mark > 0) || !(trigger > 0)) return false;
    return side === "Long" ? mark >= trigger : mark <= trigger;
}

async function fireWeb3PerpSwap(order) {
    const route = perpSpotRoute(order.side, order.market);
    const amount = estimateWeb3PerpAmount(route, order.sizeUsdt);
    await openWeb3Swap(route.from, route.to, amount);
}

function setPerpBottomTab(tab) {
    perpBottomTab = ["positions", "orders", "history", "trades"].includes(tab) ? tab : "positions";
    document.querySelectorAll(".perp-btab").forEach(b => {
        b.classList.toggle("active", (b.dataset.perpPanel || "") === perpBottomTab);
    });
    const pos = document.getElementById("perpPositionsEmpty");
    const orders = document.getElementById("perpOpenOrders");
    const hist = document.getElementById("perpHistoryEmpty");
    if (pos) pos.hidden = perpBottomTab !== "positions";
    if (orders) orders.hidden = perpBottomTab !== "orders";
    if (hist) hist.hidden = !(perpBottomTab === "history" || perpBottomTab === "trades");
    if (perpBottomTab === "orders") renderWeb3PerpOrders();
}

function renderWeb3PerpOrders() {
    const box = document.getElementById("perpOpenOrders");
    if (!box) return;
    loadWeb3PerpOrders();
    if (!web3PerpOrders.length) {
        box.innerHTML = `<div class="perp-bottom-empty">${t("perpOrdersEmpty")}</div>`;
        return;
    }
    box.innerHTML = web3PerpOrders.map(o => {
        const kind = o.orderType === "stop" ? "Stop Limit" : "Limit";
        const status = o.orderType === "stop"
            ? (o.armed ? t("armedLabel") : t("waitingLabel"))
            : t("waitingLabel");
        const px = o.orderType === "stop"
            ? `trig ${fmtNum(o.stopTrigger, 2)} → lim ${fmtNum(o.stopLimitPrice, 2)}`
            : `lim ${fmtNum(o.limitPrice, 2)}`;
        return `<div class="perp-order-row" data-oid="${o.id}">
            <div class="perp-order-main">
                <strong>${o.side} · ${o.market}</strong>
                <span>${kind} · ${status}</span>
                <em>${px} · $${fmtNum(o.sizeUsdt, 2)} · ${o.leverage || 1}x</em>
            </div>
            <button type="button" class="perp-order-cancel" data-cancel-oid="${o.id}">${t("cancelOrder")}</button>
        </div>`;
    }).join("");
    box.querySelectorAll("[data-cancel-oid]").forEach(btn => {
        btn.onclick = () => cancelWeb3PerpOrder(btn.dataset.cancelOid);
    });
}

function cancelWeb3PerpOrder(id) {
    loadWeb3PerpOrders();
    web3PerpOrders = web3PerpOrders.filter(o => o.id !== id);
    saveWeb3PerpOrders();
    renderWeb3PerpOrders();
    showToast(t("toastOrderCancelled"));
}

async function tickWeb3PerpOrders(markOverride) {
    if (!isWeb3TradeMode() || web3PerpFilling) return;
    loadWeb3PerpOrders();
    if (!web3PerpOrders.length) return;
    const mark = markOverride > 0 ? markOverride : parseMarkPrice();
    if (!(mark > 0)) return;
    let changed = false;
    for (const o of web3PerpOrders) {
        if (o.orderType === "stop" && !o.armed && stopTriggerHit(o.side, mark, o.stopTrigger)) {
            o.armed = true;
            changed = true;
        }
    }
    if (changed) {
        saveWeb3PerpOrders();
        if (perpBottomTab === "orders") renderWeb3PerpOrders();
    }
    const hit = web3PerpOrders.find(o => {
        if (o.orderType === "limit") return limitFillable(o.side, mark, o.limitPrice);
        if (o.orderType === "stop") return o.armed && limitFillable(o.side, mark, o.stopLimitPrice);
        return false;
    });
    if (!hit) return;
    web3PerpFilling = true;
    web3PerpOrders = web3PerpOrders.filter(o => o.id !== hit.id);
    saveWeb3PerpOrders();
    renderWeb3PerpOrders();
    setPerpBottomTab("orders");
    showToast(t("toastOrderTriggered"), 4200);
    try {
        await fireWeb3PerpSwap(hit);
    } finally {
        web3PerpFilling = false;
    }
}

async function placeOrFillWeb3PerpOrder() {
    const size = document.getElementById("perpSize").value;
    if (!size || isNaN(size) || parseFloat(size) <= 0) {
        showToast(t("invalidAmount"));
        return null;
    }
    const ot = perpOrderType || "market";
    if (ot === "market") {
        await fireWeb3PerpSwap({
            side: perpSide,
            market: selectedPair,
            sizeUsdt: parseFloat(size)
        });
        return null;
    }
    let limitPrice = null;
    let stopTrigger = null;
    let stopLimitPrice = null;
    if (ot === "limit") {
        limitPrice = parseFloat(document.getElementById("perpLimitPrice")?.value);
        if (!(limitPrice > 0)) {
            showToast(t("toastNeedLimitPrice"));
            return null;
        }
    }
    if (ot === "stop") {
        stopTrigger = parseFloat(document.getElementById("perpStopTrigger")?.value);
        stopLimitPrice = parseFloat(document.getElementById("perpStopLimitPrice")?.value);
        if (!(stopTrigger > 0) || !(stopLimitPrice > 0)) {
            showToast(t("toastNeedStopPrice"));
            return null;
        }
    }
    const mark = parseMarkPrice();
    const leverage = Number(document.getElementById("leverageSlider")?.value) || 1;
    const order = {
        id: `w3_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        orderType: ot,
        side: perpSide,
        market: selectedPair,
        sizeUsdt: parseFloat(size),
        leverage,
        marginMode: perpMarginMode || "Cross",
        limitPrice,
        stopTrigger,
        stopLimitPrice,
        armed: ot === "stop" ? stopTriggerHit(perpSide, mark, stopTrigger) : false,
        createdAt: Date.now()
    };
    const canFillNow = ot === "limit"
        ? limitFillable(order.side, mark, order.limitPrice)
        : (order.armed && limitFillable(order.side, mark, order.stopLimitPrice));
    if (canFillNow) {
        showToast(t("toastOrderTriggered"), 4200);
        await fireWeb3PerpSwap(order);
        return null;
    }
    loadWeb3PerpOrders();
    web3PerpOrders.unshift(order);
    saveWeb3PerpOrders();
    setPerpBottomTab("orders");
    renderWeb3PerpOrders();
    showToast(ot === "stop" ? t("toastStopQueued") : t("toastLimitQueued"), 4200);
    return order;
}

async function executeWeb3PerpOrder() {
    return placeOrFillWeb3PerpOrder();
}

function handoffPerpOrder() {
    const size = document.getElementById("perpSize").value;
    if (!size || isNaN(size) || parseFloat(size) <= 0) {
        showToast(t("invalidAmount"));
        return null;
    }
    if (perpOrderType === "limit") {
        const lp = parseFloat(document.getElementById("perpLimitPrice")?.value);
        if (!(lp > 0)) {
            showToast(t("toastNeedLimitPrice"));
            return null;
        }
    }
    if (perpOrderType === "stop") {
        const trig = parseFloat(document.getElementById("perpStopTrigger")?.value);
        const slp = parseFloat(document.getElementById("perpStopLimitPrice")?.value);
        if (!(trig > 0) || !(slp > 0)) {
            showToast(t("toastNeedStopPrice"));
            return null;
        }
    }
    if (isWeb3TradeMode()) {
        placeOrFillWeb3PerpOrder();
        return null;
    }
    const intent = buildPerpIntentFromForm();
    const ot = intent.params.orderType || "market";
    let summary = `Open a ${intent.params.side} ${ot} perpetual on ${intent.params.market} with margin ${intent.params.sizeUsdt} USDT at ${intent.params.leverage}x`;
    if (ot === "limit" && intent.params.limitPrice) summary += `, limit price ${intent.params.limitPrice}`;
    if (ot === "stop") {
        if (intent.params.stopTrigger) summary += `, stop trigger ${intent.params.stopTrigger}`;
        if (intent.params.stopLimitPrice) summary += `, stop-limit price ${intent.params.stopLimitPrice}`;
    }
    summary += (intent.params.takeProfit ? `, TP ${intent.params.takeProfit}` : "") +
        (intent.params.stopLoss ? `, SL ${intent.params.stopLoss}` : "") +
        `. Venue: BSC perp DEX if available, otherwise agent-compatible futures execution. Simulate first; confirm before place.`;
    const prompt = openIntentHandoff(`Perp ${ot} ${intent.params.side} · ${intent.params.market}`, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    trackAgentPerpOrder(intent);
    return intent;
}

// ===== PERP TERMINAL =====
let chart, candleSeries, volumeSeries;
let selectedPair = "BTCUSDT";
let selectedTf = "1h";
let perpWs = null;
let depthTimer = null;

function fmtNum(n, d = 2) {
    const x = Number(n);
    if (!isFinite(x)) return "--";
    return x.toLocaleString("en-US", { maximumFractionDigits: d });
}

function updateLeverageSlider(el) {
    if (!el) return;
    const min = Number(el.min) || 1;
    const max = Number(el.max) || 50;
    const val = Number(el.value);
    const pct = ((val - min) / (max - min)) * 100;
    el.style.background = `linear-gradient(to right, #f0b90b 0%, #f0b90b ${pct}%, #333 ${pct}%, #333 100%)`;
    const levEl = document.getElementById("levValue");
    if (levEl) levEl.innerText = val;
}

function initChart() {
    const container = document.getElementById("chartContainer");
    if (!container) return;
    if (chart) {
        try { chart.remove(); } catch (_) {}
        chart = null;
        candleSeries = null;
        volumeSeries = null;
    }
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight || 420,
        layout: { background: { color: "#000000" }, textColor: "#848e9c" },
        grid: { vertLines: { color: "#12161c" }, horzLines: { color: "#12161c" } },
        rightPriceScale: { borderColor: "#1e2329" },
        timeScale: { borderColor: "#1e2329", timeVisible: true },
        crosshair: { mode: 0 }
    });
    candleSeries = chart.addCandlestickSeries({
        upColor: "#0ecb81",
        downColor: "#f6465d",
        borderVisible: false,
        wickUpColor: "#0ecb81",
        wickDownColor: "#f6465d"
    });
    volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "",
        scaleMargins: { top: 0.8, bottom: 0 }
    });
    window.addEventListener("resize", () => {
        if (chart && container) chart.applyOptions({ width: container.clientWidth, height: container.clientHeight || 420 });
    });
}

async function loadChart(pair = selectedPair, tf = selectedTf) {
    try {
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${tf}&limit=120`;
        const data = await fetch(url).then(r => r.json());
        if (!Array.isArray(data)) {
            document.getElementById("markPrice").innerText = t("markErr");
            return;
        }
        const candles = data.map(d => ({
            time: d[0] / 1000,
            open: +d[1],
            high: +d[2],
            low: +d[3],
            close: +d[4]
        }));
        const volumes = data.map(d => ({
            time: d[0] / 1000,
            value: +d[5],
            color: +d[4] >= +d[1] ? "rgba(14,203,129,0.45)" : "rgba(246,70,93,0.45)"
        }));
        if (candleSeries) candleSeries.setData(candles);
        if (volumeSeries) volumeSeries.setData(volumes);
        await refreshTicker(pair);
        await refreshDepth(pair);
        connectPerpSocket(pair, tf);
    } catch (e) {
        console.error(e);
        document.getElementById("markPrice").innerText = t("markFail");
    }
}

function shortPrice(n) {
    const x = Number(n);
    if (!isFinite(x)) return "--";
    if (x >= 1000) return "$" + (x / 1000).toFixed(1).replace(".", ",") + "K";
    return "$" + x.toFixed(2);
}

async function refreshMarketList() {
    const items = document.querySelectorAll("#perpMarketList .pair-item");
    for (const item of items) {
        const pair = item.dataset.pair;
        try {
            const ticker = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`).then(r => r.json());
            const priceEl = item.querySelector("[data-price]");
            const chgEl = item.querySelector("[data-chg]");
            const ch = Number(ticker.priceChangePercent);
            const up = ch >= 0;
            if (priceEl) {
                priceEl.innerText = shortPrice(ticker.lastPrice);
                priceEl.className = "m-price " + (up ? "up" : "down");
            }
            if (chgEl) {
                chgEl.innerText = (up ? "+" : "") + ch.toFixed(2).replace(".", ",") + "%";
                chgEl.className = "m-chg " + (up ? "up" : "down");
            }
        } catch (_) {}
    }
}

async function refreshTicker(pair) {
    try {
        const [mark, ticker, oi] = await Promise.all([
            fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`).then(r => r.json()),
            fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`).then(r => r.json()),
            fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`).then(r => r.json())
        ]);
        document.getElementById("markPrice").innerText = "$" + fmtNum(mark.markPrice, 2);
        document.getElementById("oraclePrice").innerText = "$" + fmtNum(mark.indexPrice, 2);
        const lastEl = document.getElementById("lastPrice");
        const ch = Number(ticker.priceChangePercent);
        if (lastEl) {
            lastEl.innerText = fmtNum(ticker.lastPrice, 2);
            lastEl.className = "perp-last " + (ch >= 0 ? "up" : "down");
        }
        const chEl = document.getElementById("change24h");
        chEl.innerText = (ch >= 0 ? "+" : "") + ch.toFixed(2) + "%";
        chEl.className = ch >= 0 ? "up" : "down";
        const fr = Number(mark.lastFundingRate);
        const frEl = document.getElementById("fundingRate");
        if (frEl && Number.isFinite(fr)) {
            frEl.innerText = (fr >= 0 ? "+" : "") + (fr * 100).toFixed(4) + "%";
            frEl.className = fr >= 0 ? "up" : "down";
        }
        document.getElementById("volume24h").innerText = "$" + fmtNum(ticker.quoteVolume, 0);
        document.getElementById("openInterest").innerText = fmtNum(oi.openInterest, 2);
        refreshMarketList();
        updatePerpPreview();
        tickWeb3PerpOrders(Number(mark.markPrice));
    } catch (e) {
        console.error(e);
    }
}

async function refreshDepth(pair) {
    try {
        const depth = await fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${pair}&limit=10`).then(r => r.json());
        const asks = (depth.asks || []).slice(0, 8).reverse();
        const bids = (depth.bids || []).slice(0, 8);
        const maxQty = Math.max(...asks.map(a => +a[1]), ...bids.map(b => +b[1]), 1);

        let askSum = 0;
        document.getElementById("obAsks").innerHTML = asks.map(([p, q]) => {
            askSum += +p * +q;
            const w = (+q / maxQty) * 100;
            return `<div class="ob-row"><div class="bar" style="width:${w}%"></div><span class="price">${fmtNum(p, 2)}</span><span>${fmtNum(q, 4)}</span><span>${fmtNum(askSum, 2)}</span></div>`;
        }).join("");

        let bidSum = 0;
        document.getElementById("obBids").innerHTML = bids.map(([p, q]) => {
            bidSum += +p * +q;
            const w = (+q / maxQty) * 100;
            return `<div class="ob-row"><div class="bar" style="width:${w}%"></div><span class="price">${fmtNum(p, 2)}</span><span>${fmtNum(q, 4)}</span><span>${fmtNum(bidSum, 2)}</span></div>`;
        }).join("");

        if (asks.length && bids.length) {
            const bestAsk = +asks[asks.length - 1][0];
            const bestBid = +bids[0][0];
            const spread = bestAsk - bestBid;
            document.getElementById("obSpread").innerText = fmtNum(Math.abs(spread), 2);
            const midEl = document.getElementById("obMidPrice");
            if (midEl) midEl.innerText = fmtNum((bestAsk + bestBid) / 2, 2);
        }
    } catch (e) {
        console.error(e);
    }
}

function connectPerpSocket(pair, tf) {
    if (perpWs) {
        try { perpWs.close(); } catch (_) {}
        perpWs = null;
    }
    const stream = `${pair.toLowerCase()}@kline_${tf}`;
    perpWs = new WebSocket(`wss://fstream.binance.com/ws/${stream}`);
    perpWs.onmessage = (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            const k = msg.k;
            if (!k || !candleSeries) return;
            candleSeries.update({
                time: k.t / 1000,
                open: +k.o,
                high: +k.h,
                low: +k.l,
                close: +k.c
            });
            document.getElementById("markPrice").innerText = "$" + fmtNum(k.c, 2);
            const lastEl = document.getElementById("lastPrice");
            if (lastEl) lastEl.innerText = fmtNum(k.c, 2);
            tickWeb3PerpOrders(+k.c);
        } catch (_) {}
    };
}

let perpUiBound = false;

function applyPerpTpslPct(kind, pct) {
    const mark = parseMarkPrice();
    if (!mark) {
        showToast(t("toastNoMark"));
        return;
    }
    const p = Number(pct) / 100;
    if (kind === "tp") {
        const tp = perpSide === "Long" ? mark * (1 + p) : mark * (1 - p);
        document.getElementById("tpPrice").value = tp.toFixed(2);
    } else {
        const sl = perpSide === "Long" ? mark * (1 - p) : mark * (1 + p);
        document.getElementById("slPrice").value = sl.toFixed(2);
    }
    updatePerpPreview();
}

function setupPerp() {
    const longBtn = document.getElementById("longTab");
    const shortBtn = document.getElementById("shortTab");
    const openBtn = document.getElementById("openPerp");
    const lev = document.getElementById("leverageSlider");
    if (!longBtn || !shortBtn || !openBtn) return;

    if (lev) updateLeverageSlider(lev);
    updatePerpPreview();
    if (perpUiBound) return;
    perpUiBound = true;

    if (lev) {
        lev.oninput = (e) => {
            updateLeverageSlider(e.target);
            updatePerpPreview();
        };
    }

    const sizeInput = document.getElementById("perpSize");
    if (sizeInput) sizeInput.oninput = updatePerpPreview;
    document.getElementById("tpPrice").oninput = updatePerpPreview;
    document.getElementById("slPrice").oninput = updatePerpPreview;

    document.querySelectorAll(".perp-chip[data-size]").forEach(chip => {
        chip.onclick = () => {
            document.getElementById("perpSize").value = chip.dataset.size;
            updatePerpPreview();
        };
    });
    document.querySelectorAll(".perp-chip[data-tp-pct]").forEach(chip => {
        chip.onclick = () => applyPerpTpslPct("tp", chip.dataset.tpPct);
    });
    document.querySelectorAll(".perp-chip[data-sl-pct]").forEach(chip => {
        chip.onclick = () => applyPerpTpslPct("sl", chip.dataset.slPct);
    });

    longBtn.onclick = () => {
        perpSide = "Long";
        longBtn.classList.add("active");
        shortBtn.classList.remove("active");
        openBtn.className = "open-long";
        openBtn.innerText = isWeb3TradeMode() ? t("openLong") : t("sendLong");
        updatePerpPreview();
    };

    shortBtn.onclick = () => {
        perpSide = "Short";
        shortBtn.classList.add("active");
        longBtn.classList.remove("active");
        openBtn.className = "open-short";
        openBtn.innerText = isWeb3TradeMode() ? t("openShort") : t("sendShort");
        updatePerpPreview();
    };

    openBtn.onclick = () => handoffPerpOrder();
    document.getElementById("copyPerpIntent").onclick = () => {
        const size = document.getElementById("perpSize").value;
        if (!size || isNaN(size) || parseFloat(size) <= 0) {
            showToast(t("invalidAmount"));
            return;
        }
        const intent = buildPerpIntentFromForm();
        navigator.clipboard.writeText(JSON.stringify(intent, null, 2));
        showToast(t("toastCopiedJson"));
    };

    function selectPerpPair(el) {
        if (!el?.dataset?.pair) return;
        selectedPair = el.dataset.pair;
        document.getElementById("currentPair").innerText = selectedPair;
        const tradeLabel = document.getElementById("perpTradePairLabel");
        if (tradeLabel) tradeLabel.innerText = selectedPair;
        const icon = document.getElementById("currentPairIcon");
        if (icon && el.dataset.icon) icon.src = el.dataset.icon;
        document.querySelectorAll(".pair-item").forEach(i => {
            i.classList.toggle("active", i.dataset.pair === selectedPair);
        });
        const maxLev = el.dataset.lev;
        const levSlider = document.getElementById("leverageSlider");
        if (maxLev && levSlider) {
            levSlider.max = maxLev;
            if (Number(levSlider.value) > Number(maxLev)) levSlider.value = maxLev;
            updateLeverageSlider(levSlider);
        }
        loadChart(selectedPair, selectedTf);
        updatePerpPreview();
        closePerpPairSheet();
        if (window.matchMedia("(max-width: 900px)").matches) setPerpPane("chart");
    }

    document.querySelectorAll(".pair-item").forEach(el => {
        el.onclick = () => selectPerpPair(el);
    });

    function openPerpPairSheet() {
        const sheet = document.getElementById("perpPairSheet");
        const list = document.getElementById("perpPairSheetList");
        const src = document.getElementById("perpMarketList");
        if (!sheet || !list || !src) return;
        list.innerHTML = src.innerHTML;
        list.querySelectorAll(".pair-item").forEach(el => {
            el.onclick = () => selectPerpPair(el);
        });
        sheet.hidden = false;
        document.body.classList.add("sheet-open");
    }

    function closePerpPairSheet() {
        const sheet = document.getElementById("perpPairSheet");
        if (sheet) sheet.hidden = true;
        document.body.classList.remove("sheet-open");
    }

    document.getElementById("perpPairPickerBtn")?.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) openPerpPairSheet();
    });
    document.getElementById("closePerpPairSheet")?.addEventListener("click", closePerpPairSheet);
    document.getElementById("perpPairSheetBackdrop")?.addEventListener("click", closePerpPairSheet);

    document.querySelectorAll("#marginModeSeg .perp-seg-btn").forEach(btn => {
        btn.onclick = () => {
            perpMarginMode = btn.dataset.margin || "Cross";
            document.querySelectorAll("#marginModeSeg .perp-seg-btn").forEach(b => b.classList.toggle("active", b === btn));
        };
    });
    document.querySelectorAll("#perpOrderTypes .perp-otype").forEach(btn => {
        btn.onclick = () => {
            const next = btn.dataset.otype || "market";
            perpOrderType = next;
            syncPerpOrderTypeUi();
            const mark = parseMarkPrice();
            if (mark > 0) {
                if (next === "limit") {
                    const el = document.getElementById("perpLimitPrice");
                    if (el && !el.value) el.value = String(mark);
                }
                if (next === "stop") {
                    const trig = document.getElementById("perpStopTrigger");
                    const slp = document.getElementById("perpStopLimitPrice");
                    if (trig && !trig.value) trig.value = String(mark);
                    if (slp && !slp.value) slp.value = String(mark);
                }
            }
        };
    });
    syncPerpOrderTypeUi();
    const fillMark = (id) => {
        const mark = parseMarkPrice();
        if (!(mark > 0)) {
            showToast(t("toastNoMark"));
            return;
        }
        const el = document.getElementById(id);
        if (el) el.value = String(mark);
    };
    document.getElementById("perpLimitMarkBtn")?.addEventListener("click", () => fillMark("perpLimitPrice"));
    document.getElementById("perpStopMarkBtn")?.addEventListener("click", () => fillMark("perpStopTrigger"));
    document.getElementById("perpLevBtn").onclick = () => {
        document.getElementById("leverageSlider")?.focus();
    };
    loadWeb3PerpOrders();
    document.querySelectorAll(".perp-btab").forEach(tab => {
        tab.onclick = () => setPerpBottomTab(tab.dataset.perpPanel || "positions");
    });
    setPerpBottomTab(perpBottomTab);

    document.querySelectorAll(".tf-btn").forEach(btn => {
        btn.onclick = () => {
            selectedTf = btn.dataset.tf;
            document.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            loadChart(selectedPair, selectedTf);
        };
    });

    document.querySelectorAll(".perp-tab").forEach(tab => {
        tab.onclick = () => {
            const key = tab.dataset.perpTab;
            document.querySelectorAll(".perp-tab").forEach(t => t.classList.toggle("active", t === tab));
            if (key === "tokens" || key === "follows") {
                showToast(key === "tokens" ? "Tokens — demo Perps only" : "Follows — coming soon");
                document.querySelectorAll(".perp-tab").forEach(t => t.classList.toggle("active", t.dataset.perpTab === "perps"));
            }
        };
    });
}

let perpPane = "markets";

function setPerpPane(pane) {
    const page = document.getElementById("perpPage");
    if (!page) return;
    const next = ["markets", "chart", "trade"].includes(pane) ? pane : "markets";
    perpPane = next;
    page.dataset.perpPane = next;
    document.querySelectorAll(".perp-pane-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.pane === next);
    });
    const title = document.getElementById("perpPaneTitle");
    if (title) {
        title.innerText = next === "chart" ? t("perpChart")
            : next === "trade" ? t("perpTrade")
            : t("perpMarkets");
    }
    const back = document.getElementById("perpBackPane");
    if (back) back.style.visibility = next === "markets" ? "hidden" : "visible";
    if (next === "chart") {
        setTimeout(() => {
            const container = document.getElementById("chartContainer");
            if (chart && container) {
                chart.applyOptions({ width: container.clientWidth, height: container.clientHeight || 320 });
                try { chart.timeScale().fitContent(); } catch (_) {}
            }
        }, 80);
    }
}

function openPerpPage() {
    if (!requireAgentOwnership()) return;
    const page = document.getElementById("perpPage");
    page.style.display = "flex";
    setupPerp();
    setPerpAiOpen(false);
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    setPerpPane(mobile ? "markets" : "chart");
    setTimeout(() => {
        initChart();
        loadChart(selectedPair, selectedTf);
        refreshMarketList();
        if (depthTimer) clearInterval(depthTimer);
        depthTimer = setInterval(() => {
            refreshTicker(selectedPair);
            refreshDepth(selectedPair);
            refreshMarketList();
        }, 3000);
        const container = document.getElementById("chartContainer");
        if (chart && container) {
            chart.applyOptions({ width: container.clientWidth, height: container.clientHeight || 420 });
        }
    }, 120);
}

function closePerpPage() {
    document.getElementById("perpPage").style.display = "none";
    const sheet = document.getElementById("perpPairSheet");
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("sheet-open");
    setPerpAiOpen(false);
    if (perpWs) {
        try { perpWs.close(); } catch (_) {}
        perpWs = null;
    }
    if (depthTimer) {
        clearInterval(depthTimer);
        depthTimer = null;
    }
}

document.getElementById("perpBtn").onclick = openPerpPage;
document.getElementById("defiBtn")?.addEventListener("click", () => showToast(t("toastComingSoon"), 3200));
document.getElementById("closePerpPage").onclick = closePerpPage;

document.querySelectorAll(".perp-pane-tab").forEach(tab => {
    tab.addEventListener("click", () => setPerpPane(tab.dataset.pane));
});
document.getElementById("perpBackPane")?.addEventListener("click", () => {
    if (perpPane === "trade") setPerpPane("chart");
    else setPerpPane("markets");
});
document.getElementById("perpGoTradeLong")?.addEventListener("click", () => {
    document.getElementById("longTab")?.click();
    setPerpPane("trade");
});
document.getElementById("perpGoTradeShort")?.addEventListener("click", () => {
    document.getElementById("shortTab")?.click();
    setPerpPane("trade");
});
document.getElementById("perpMarketSearch")?.addEventListener("input", (e) => {
    const q = String(e.target.value || "").trim().toLowerCase();
    document.querySelectorAll("#perpMarketList .pair-item").forEach(item => {
        const pair = String(item.dataset.pair || "").toLowerCase();
        item.hidden = !!(q && !pair.includes(q));
    });
});

// ===== EARN (Web3 on-chain + AI Agent intent) =====
const VENUS_VBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
const VENUS_VUSDT = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";
const VENUS_VBNB_ABI = ["function mint() payable"];
const VENUS_VTOKEN_ABI = ["function mint(uint256 mintAmount) returns (uint256)"];
const EARN_PROTOCOLS = [
    {
        id: "venus",
        name: "Venus",
        product: "Flexible Supply",
        assets: ["BNB", "USDT"],
        note: "Supply → vBNB / vUSDT (lending)",
        web3: true,
        markets: { BNB: VENUS_VBNB, USDT: VENUS_VUSDT }
    },
    {
        id: "lista",
        name: "Lista DAO",
        product: "slisBNB staking",
        assets: ["BNB"],
        note: "Stake BNB → slisBNB (liquid staking)",
        web3: true,
        markets: { BNB: LISTA_STAKE_MANAGER }
    },
    {
        id: "pancake",
        name: "PancakeSwap",
        product: "BNB-USDT LP V2",
        assets: ["BNB", "USDT"],
        note: "Zap 50/50 → add BNB-USDT LP (fee earn)",
        web3: true,
        markets: { router: PCS_ROUTER }
    }
];
let earnProtocolId = "venus";
let earnAsset = "BNB";

function getEarnProtocol() {
    return EARN_PROTOCOLS.find(p => p.id === earnProtocolId) || EARN_PROTOCOLS[0];
}

function earnProtocolsForMode() {
    return EARN_PROTOCOLS;
}

function renderEarnProtocols() {
    const box = document.getElementById("earnProtocolList");
    if (!box) return;
    const list = earnProtocolsForMode();
    if (!list.some(p => p.id === earnProtocolId)) earnProtocolId = list[0]?.id || "venus";
    box.innerHTML = list.map(p => `
        <button type="button" class="earn-protocol-btn${p.id === earnProtocolId ? " active" : ""}" data-protocol="${p.id}" role="option" aria-selected="${p.id === earnProtocolId}">
            <strong>${p.name}${isWeb3TradeMode() && p.web3 ? " · Live" : ""}</strong>
            <span>${p.note}</span>
        </button>`).join("");
    box.querySelectorAll(".earn-protocol-btn").forEach(btn => {
        btn.onclick = () => {
            earnProtocolId = btn.dataset.protocol;
            const proto = getEarnProtocol();
            if (!proto.assets.includes(earnAsset)) earnAsset = proto.assets[0];
            syncEarnAssetUi();
            renderEarnProtocols();
            refreshEarnAvailable();
        };
    });
}

function syncEarnAssetUi() {
    document.querySelectorAll(".earn-asset-btn").forEach(btn => {
        const ok = getEarnProtocol().assets.includes(btn.dataset.asset);
        btn.hidden = !ok;
        btn.classList.toggle("active", btn.dataset.asset === earnAsset);
    });
    const unit = document.getElementById("earnAmountUnit");
    const availUnit = document.getElementById("earnAvailUnit");
    if (unit) unit.textContent = earnAsset;
    if (availUnit) availUnit.textContent = earnAsset;
    const product = document.getElementById("earnProductLabel");
    if (product) product.textContent = getEarnProtocol().product;
    const hint = document.querySelector("#earnModal [data-i18n='earnHint']");
    if (hint) hint.innerText = t("earnHint");
    syncEarnConfirm();
}

async function refreshEarnAvailable() {
    const el = document.getElementById("earnAvailable");
    if (!el) return;
    let bal = 0;
    try {
        const addr = userAddress || document.getElementById("agentAddress")?.dataset?.full;
        if (addr && window.ethers) {
            let rpc;
            if (isWeb3TradeMode() && signer?.provider) rpc = signer.provider;
            else rpc = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
            if (earnAsset === "BNB") {
                bal = Number(ethers.utils.formatEther(await rpc.getBalance(addr)));
            } else if (earnAsset === "USDT") {
                const c = new ethers.Contract(USDT_BSC, ERC20_MIN_ABI, rpc);
                const raw = await c.balanceOf(addr);
                const dec = await c.decimals().catch(() => 18);
                bal = Number(ethers.utils.formatUnits(raw, dec));
            }
        }
    } catch (_) {}
    el.textContent = bal > 0 ? bal.toFixed(6).replace(/\.?0+$/, "") : "0";
}

let earnAction = "deposit"; // deposit | withdraw | claim

function setEarnAction(action, skipConfirmSync) {
    earnAction = ["deposit", "withdraw", "claim"].includes(action) ? action : "deposit";
    document.querySelectorAll("#earnActionTabs .launch-tab").forEach(b => {
        b.classList.toggle("active", (b.dataset.earnAction || "") === earnAction);
    });
    const amountBox = document.getElementById("earnAmount")?.parentElement;
    const avail = document.querySelector("#earnModal .transfer-available");
    const hideAmt = earnAction === "claim";
    if (amountBox) amountBox.hidden = hideAmt;
    const amtLabel = [...document.querySelectorAll("#earnModal .transfer-field-label")].find(el => el.getAttribute("data-i18n") === "amount");
    if (amtLabel) amtLabel.hidden = hideAmt;
    if (avail) avail.hidden = hideAmt;
    if (!skipConfirmSync) syncEarnConfirm();
}

function syncEarnConfirm() {
    const btn = document.getElementById("confirmEarn");
    const amt = parseFloat(document.getElementById("earnAmount")?.value);
    if (!btn) return;
    if (isWeb3TradeMode()) {
        if (earnAction !== "deposit") setEarnAction("deposit", true);
        btn.disabled = !(amt > 0);
        btn.innerText = t("earnConfirmWeb3");
        return;
    }
    if (earnAction === "claim") {
        btn.disabled = false;
        btn.innerText = t("earnConfirmClaim");
        return;
    }
    btn.disabled = !(amt > 0);
    btn.innerText = earnAction === "withdraw" ? t("earnConfirmWithdraw") : t("earnConfirm");
}

async function openEarnModal() {
    if (!requireAgentOwnership()) return;
    if (isWeb3TradeMode()) {
        if (!getWalletProvider()) {
            showToast(t("earnNeedWallet"), 3600);
            return;
        }
    } else if (!currentAgentName && !userAddress) {
        showToast(t("toastEarnNeedAgent"), 3600);
        return;
    }
    if (isWeb3TradeMode() && !getEarnProtocol().web3) earnProtocolId = "venus";
    const tabs = document.getElementById("earnActionTabs");
    if (tabs) tabs.hidden = isWeb3TradeMode();
    if (!isWeb3TradeMode()) setEarnAction(earnAction || "deposit");
    else setEarnAction("deposit");
    renderEarnProtocols();
    syncEarnAssetUi();
    await refreshEarnAvailable();
    syncEarnConfirm();
    document.getElementById("earnModal").style.display = "flex";
}

async function ensureTokenApprove(token, spender, amount) {
    const c = new ethers.Contract(token, ERC20_MIN_ABI, signer);
    const allowance = await c.allowance(userAddress, spender);
    if (allowance.gte(amount)) return null;
    const tx = await c.approve(spender, ethers.constants.MaxUint256);
    showToast(`${t("txSent")}: approve…`);
    await tx.wait(1);
    return tx.hash;
}

async function executeVenusEarn(amount, gasBuf) {
    const market = getEarnProtocol().markets?.[earnAsset];
    if (!market) throw new Error("Unsupported Venus market");

    if (earnAsset === "BNB") {
        const value = ethers.utils.parseEther(String(amount));
        const bal = await signer.getBalance();
        if (bal.lt(value.add(gasBuf))) {
            throw new Error(tf("errInsufficient", {
                token: "BNB",
                need: amount,
                have: ethers.utils.formatEther(bal).slice(0, 10)
            }));
        }
        const vToken = new ethers.Contract(market, VENUS_VBNB_ABI, signer);
        const tx = await vToken.mint({ value });
        showToast(`${t("txSent")}: ${tx.hash.slice(0, 10)}…`);
        await tx.wait(1);
        return tx.hash;
    }

    if (earnAsset === "USDT") {
        const usdt = new ethers.Contract(USDT_BSC, ERC20_MIN_ABI, signer);
        const dec = await usdt.decimals().catch(() => 18);
        const raw = ethers.utils.parseUnits(String(amount), dec);
        const bal = await usdt.balanceOf(userAddress);
        if (bal.lt(raw)) {
            throw new Error(tf("errInsufficient", {
                token: "USDT",
                need: amount,
                have: ethers.utils.formatUnits(bal, dec).slice(0, 12)
            }));
        }
        const bnbBal = await signer.getBalance();
        if (bnbBal.lt(gasBuf)) {
            throw new Error(tf("errNeedGas", { have: ethers.utils.formatEther(bnbBal).slice(0, 10) }));
        }
        await ensureTokenApprove(USDT_BSC, market, raw);
        const vToken = new ethers.Contract(market, VENUS_VTOKEN_ABI, signer);
        const tx = await vToken.mint(raw);
        showToast(`${t("txSent")}: ${tx.hash.slice(0, 10)}…`);
        await tx.wait(1);
        return tx.hash;
    }
    throw new Error("Unsupported asset");
}

async function executeListaEarn(amount, gasBuf) {
    if (earnAsset !== "BNB") throw new Error("Lista: BNB only");
    const value = ethers.utils.parseEther(String(amount));
    const bal = await signer.getBalance();
    if (bal.lt(value.add(gasBuf))) {
        throw new Error(tf("errInsufficient", {
            token: "BNB",
            need: amount,
            have: ethers.utils.formatEther(bal).slice(0, 10)
        }));
    }
    const stake = new ethers.Contract(LISTA_STAKE_MANAGER, LISTA_STAKE_ABI, signer);
    const tx = await stake.deposit({ value });
    showToast(`${t("txSent")}: ${tx.hash.slice(0, 10)}…`);
    await tx.wait(1);
    return tx.hash;
}

async function executePancakeLpEarn(amount, gasBuf) {
    const router = new ethers.Contract(PCS_ROUTER, ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    const slip = 100 - Math.max(1, SWAP_SLIPPAGE); // e.g. 99 => 1%

    if (earnAsset === "BNB") {
        const total = ethers.utils.parseEther(String(amount));
        const half = total.div(2);
        const ethLp = total.sub(half);
        const bal = await signer.getBalance();
        if (bal.lt(total.add(gasBuf))) {
            throw new Error(tf("errInsufficient", {
                token: "BNB",
                need: amount,
                have: ethers.utils.formatEther(bal).slice(0, 10)
            }));
        }
        const usdt = new ethers.Contract(USDT_BSC, ERC20_MIN_ABI, signer);
        const usdtBefore = await usdt.balanceOf(userAddress);
        const path = [WBNB, USDT_BSC];
        const quoted = await router.getAmountsOut(half, path);
        const minUsdt = quoted[1].mul(slip).div(100);
        const swapTx = await router.swapExactETHForTokens(minUsdt, path, userAddress, deadline, { value: half });
        showToast(`${t("txSent")}: swap…`);
        await swapTx.wait(1);

        const usdtAfter = await usdt.balanceOf(userAddress);
        const usdtGained = usdtAfter.sub(usdtBefore);
        if (usdtGained.lte(0)) throw new Error(t("toastEarnFail"));
        await ensureTokenApprove(USDT_BSC, PCS_ROUTER, usdtGained);
        const amountTokenMin = usdtGained.mul(slip).div(100);
        const amountETHMin = ethLp.mul(slip).div(100);
        const lpTx = await router.addLiquidityETH(
            USDT_BSC,
            usdtGained,
            amountTokenMin,
            amountETHMin,
            userAddress,
            deadline,
            { value: ethLp }
        );
        showToast(`${t("txSent")}: ${lpTx.hash.slice(0, 10)}…`);
        await lpTx.wait(1);
        return lpTx.hash;
    }

    if (earnAsset === "USDT") {
        const usdt = new ethers.Contract(USDT_BSC, ERC20_MIN_ABI, signer);
        const dec = await usdt.decimals().catch(() => 18);
        const total = ethers.utils.parseUnits(String(amount), dec);
        const half = total.div(2);
        const usdtLp = total.sub(half);
        const bal = await usdt.balanceOf(userAddress);
        if (bal.lt(total)) {
            throw new Error(tf("errInsufficient", {
                token: "USDT",
                need: amount,
                have: ethers.utils.formatUnits(bal, dec).slice(0, 12)
            }));
        }
        const bnbBal = await signer.getBalance();
        if (bnbBal.lt(gasBuf.mul(2))) {
            throw new Error(tf("errNeedGas", { have: ethers.utils.formatEther(bnbBal).slice(0, 10) }));
        }
        await ensureTokenApprove(USDT_BSC, PCS_ROUTER, total);
        const path = [USDT_BSC, WBNB];
        const quoted = await router.getAmountsOut(half, path);
        const minBnb = quoted[1].mul(slip).div(100);
        const swapTx = await router.swapExactTokensForETH(half, minBnb, path, userAddress, deadline);
        showToast(`${t("txSent")}: swap…`);
        await swapTx.wait(1);

        const ethBal = await signer.getBalance();
        // keep gas buffer; use most of remaining for LP (capped by quote)
        const ethForLp = ethBal.sub(gasBuf);
        if (ethForLp.lte(0)) throw new Error(tf("errNeedGas", { have: ethers.utils.formatEther(ethBal).slice(0, 10) }));
        const usdtLeft = await usdt.balanceOf(userAddress);
        const useUsdt = usdtLeft.lt(usdtLp) ? usdtLeft : usdtLp;
        if (useUsdt.lte(0)) throw new Error(t("toastEarnFail"));
        const amountTokenMin = useUsdt.mul(slip).div(100);
        const amountETHMin = ethForLp.mul(slip).div(100);
        const lpTx = await router.addLiquidityETH(
            USDT_BSC,
            useUsdt,
            amountTokenMin,
            amountETHMin,
            userAddress,
            deadline,
            { value: ethForLp }
        );
        showToast(`${t("txSent")}: ${lpTx.hash.slice(0, 10)}…`);
        await lpTx.wait(1);
        return lpTx.hash;
    }
    throw new Error("Unsupported asset");
}

async function executeWeb3Earn(amount) {
    const proto = getEarnProtocol();
    if (!proto.web3) throw new Error(t("toastEarnFail"));
    await ensureWeb3Signer();
    const gasBuf = ethers.utils.parseEther("0.0005");
    if (proto.id === "venus") return executeVenusEarn(amount, gasBuf);
    if (proto.id === "lista") return executeListaEarn(amount, gasBuf);
    if (proto.id === "pancake") return executePancakeLpEarn(amount, gasBuf);
    throw new Error("Unsupported protocol");
}

function handoffEarnIntent(amount) {
    const proto = getEarnProtocol();
    const action = isWeb3TradeMode() ? "deposit" : (earnAction || "deposit");
    const type = action === "withdraw" ? "earn.withdraw" : action === "claim" ? "earn.claim" : "earn.deposit";
    const intent = buildAgentIntent(type, {
        protocol: proto.name,
        protocolId: proto.id,
        product: proto.product,
        asset: earnAsset,
        amount: action === "claim" ? null : amount,
        action,
        mode: "flexible",
        chain: "BNB Smart Chain",
        note: proto.note,
        venues: proto.markets || null
    });
    let summary;
    if (action === "withdraw") {
        summary = `Withdraw/redeem ${amount} ${earnAsset} from ${proto.name} (${proto.product}) on BNB Smart Chain. Simulate redeem path first; confirm before sign; return tx hash.`;
    } else if (action === "claim") {
        summary = `Claim available rewards/yield from ${proto.name} (${proto.product}) for ${earnAsset} on BNB Smart Chain. Simulate claim first; confirm before sign; return tx hash.`;
    } else {
        summary = tf("earnSummary", {
            amount,
            asset: earnAsset,
            protocol: proto.name,
            product: proto.product
        });
    }
    const prompt = openIntentHandoff(`Earn ${action} · ${proto.name}`, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
}

document.getElementById("earnBtn")?.addEventListener("click", () => { openEarnModal(); });
document.querySelectorAll("#earnActionTabs .launch-tab").forEach(tab => {
    tab.onclick = () => setEarnAction(tab.dataset.earnAction || "deposit");
});

// ===== AI AGENT TOOLS: Approve / Bridge / Cancel =====
const AGENT_PERP_ORDERS_KEY = "agentgate_agent_perp_orders_v1";
let agentPerpOrders = [];
let approveAction = "approve";
let cancelMode = "selected";
let selectedCancelOrderId = null;

const APPROVE_SPENDERS = {
    pcs: { id: "pcs", name: "PancakeSwap Router V2", address: "0x10ED43C718714eb63d5aA57B78B54704E256024E" },
    venus: { id: "venus", name: "Venus vUSDT", address: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" }
};

function loadAgentPerpOrders() {
    try {
        const raw = JSON.parse(localStorage.getItem(AGENT_PERP_ORDERS_KEY) || "[]");
        agentPerpOrders = Array.isArray(raw) ? raw : [];
    } catch (_) {
        agentPerpOrders = [];
    }
}

function saveAgentPerpOrders() {
    localStorage.setItem(AGENT_PERP_ORDERS_KEY, JSON.stringify(agentPerpOrders.slice(0, 40)));
}

function trackAgentPerpOrder(intent) {
    if (!intent || intent.type !== "perp.open") return;
    const ot = intent.params?.orderType || "market";
    if (ot !== "limit" && ot !== "stop") return;
    loadAgentPerpOrders();
    agentPerpOrders.unshift({
        id: `ag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        market: intent.params.market,
        side: intent.params.side,
        orderType: ot,
        sizeUsdt: intent.params.sizeUsdt,
        leverage: intent.params.leverage,
        limitPrice: intent.params.limitPrice || null,
        stopTrigger: intent.params.stopTrigger || null,
        stopLimitPrice: intent.params.stopLimitPrice || null,
        createdAt: Date.now(),
        status: "open"
    });
    saveAgentPerpOrders();
}

function fillApproveTokenSelect() {
    const sel = document.getElementById("approveToken");
    if (!sel) return;
    const tokens = getAllDashTokens().filter(t => !t.native);
    sel.innerHTML = tokens.map(t => `<option value="${t.id}">${t.symbol} — ${t.name}</option>`).join("");
}

function syncApproveUi() {
    document.querySelectorAll("#approveActionTabs .launch-tab").forEach(b => {
        b.classList.toggle("active", (b.dataset.approveAction || "") === approveAction);
    });
    const wrap = document.getElementById("approveAmountWrap");
    if (wrap) wrap.hidden = approveAction === "revoke";
    const preset = document.getElementById("approveSpenderPreset")?.value || "pcs";
    const custom = document.getElementById("approveSpenderCustom");
    if (custom) custom.hidden = preset !== "custom";
    const unlimited = document.querySelector('input[name="approveAmtMode"][value="unlimited"]')?.checked;
    const exact = !unlimited;
    const amt = document.getElementById("approveAmount");
    if (amt) amt.hidden = approveAction === "revoke" || !exact;
    const warn = document.getElementById("approveUnlimitedWarn");
    if (warn) warn.hidden = approveAction === "revoke" || !unlimited;
    const btn = document.getElementById("confirmApprove");
    if (btn) btn.innerText = approveAction === "revoke" ? t("revokeAction") + " → Prompt" : t("approvalsConfirm");
}

function openApproveModal() {
    if (isWeb3TradeMode()) {
        showToast(t("approvalsHint"), 4200);
        return;
    }
    if (!requireAgentOwnership()) return;
    fillApproveTokenSelect();
    approveAction = "approve";
    const exactRadio = document.querySelector('input[name="approveAmtMode"][value="exact"]');
    if (exactRadio) exactRadio.checked = true;
    const unlRadio = document.querySelector('input[name="approveAmtMode"][value="unlimited"]');
    if (unlRadio) unlRadio.checked = false;
    syncApproveUi();
    document.getElementById("approveModal").style.display = "flex";
}

function resolveApproveSpender() {
    const preset = document.getElementById("approveSpenderPreset")?.value || "pcs";
    if (preset === "custom") {
        const raw = document.getElementById("approveSpenderCustom")?.value?.trim() || "";
        if (!ethers.utils.isAddress(raw)) return null;
        return { id: "custom", name: "Custom", address: ethers.utils.getAddress(raw) };
    }
    return APPROVE_SPENDERS[preset] || APPROVE_SPENDERS.pcs;
}

function handoffApprove() {
    const tokenId = document.getElementById("approveToken")?.value;
    const token = getAllDashTokens().find(t => t.id === tokenId);
    if (!token || !token.address) {
        showToast(t("toastNeedSpender"));
        return;
    }
    const spender = resolveApproveSpender();
    if (!spender) {
        showToast(t("toastNeedSpender"));
        return;
    }
    const unlimited = document.querySelector('input[name="approveAmtMode"][value="unlimited"]')?.checked;
    let amount = null;
    if (approveAction === "approve") {
        if (!unlimited) {
            amount = parseFloat(document.getElementById("approveAmount")?.value);
            if (!(amount > 0)) {
                showToast(t("toastNeedApproveAmt"));
                return;
            }
        }
    } else {
        amount = 0;
    }
    const note = document.getElementById("approveNote")?.value?.trim() || "";
    const type = approveAction === "revoke" ? "token.revoke" : "token.approve";
    const intent = buildAgentIntent(type, {
        token: token.symbol,
        tokenAddress: token.address,
        decimals: token.decimals,
        spender: spender.address,
        spenderName: spender.name,
        amount,
        unlimited: approveAction === "approve" && !!unlimited,
        chain: "BNB Smart Chain",
        chainId: 56,
        note: note || null
    });
    const summary = approveAction === "revoke"
        ? `Revoke ${token.symbol} allowance for spender ${spender.name} (${spender.address}) on BNB Smart Chain. Set allowance to 0 after simulate + confirm.`
        : `Approve ${token.symbol} for spender ${spender.name} (${spender.address}) on BNB Smart Chain. Allowance: ${unlimited ? "UNLIMITED (MaxUint256) — user explicitly selected this; confirm risk before sign" : `exact ${amount}`}. Simulate first; confirm before sign.${note ? " Note: " + note : ""}`;
    const prompt = openIntentHandoff(`${approveAction === "revoke" ? "Revoke" : "Approve"} · ${token.symbol}`, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    document.getElementById("approveModal").style.display = "none";
}

function openBridgeModal() {
    if (isWeb3TradeMode()) {
        showToast(t("bridgeHint"), 4200);
        return;
    }
    if (!requireAgentOwnership()) return;
    const dest = document.getElementById("bridgeDest");
    if (dest && !dest.value) {
        const addr = userAddress || document.getElementById("agentAddress")?.dataset?.full || "";
        if (addr) dest.value = addr;
    }
    document.getElementById("bridgeModal").style.display = "flex";
}

function handoffBridge() {
    const fromChain = document.getElementById("bridgeFromChain")?.value;
    const toChain = document.getElementById("bridgeToChain")?.value;
    const token = document.getElementById("bridgeToken")?.value || "USDT";
    const amount = parseFloat(document.getElementById("bridgeAmount")?.value);
    const destRaw = document.getElementById("bridgeDest")?.value?.trim()
        || userAddress
        || document.getElementById("agentAddress")?.dataset?.full
        || "";
    const provider = document.getElementById("bridgeProvider")?.value || "auto";
    const slippage = parseFloat(document.getElementById("bridgeSlippage")?.value) || 0.5;
    const note = document.getElementById("bridgeNote")?.value?.trim() || "";
    if (!(amount > 0)) {
        showToast(t("toastNeedBridgeAmt"));
        return;
    }
    if (fromChain === toChain) {
        showToast(t("toastSameChain"));
        return;
    }
    if (destRaw && !ethers.utils.isAddress(destRaw)) {
        showToast(t("toastBadTokenAddr"));
        return;
    }
    const dest = destRaw ? ethers.utils.getAddress(destRaw) : null;
    const intent = buildAgentIntent("bridge.transfer", {
        fromChain,
        toChain,
        token,
        amount,
        destination: dest,
        provider,
        maxSlippagePct: slippage,
        preferOfficialBridge: true,
        note: note || null
    });
    const summary = `Bridge ${amount} ${token} from ${fromChain} to ${toChain} via ${provider}. Destination: ${dest || "Agent wallet"}. Max slippage ${slippage}%. Use a reputable bridge only; simulate quote/fees first; confirm before sign; return source + destination tx hashes.${note ? " Note: " + note : ""}`;
    const prompt = openIntentHandoff(`Bridge · ${token} ${fromChain} → ${toChain}`, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    document.getElementById("bridgeModal").style.display = "none";
}

function setCancelMode(mode) {
    cancelMode = mode === "manual" ? "manual" : "selected";
    document.querySelectorAll("#cancelModeTabs .launch-tab").forEach(b => {
        b.classList.toggle("active", (b.dataset.cancelMode || "") === cancelMode);
    });
    const panel = document.getElementById("cancelManualPanel");
    if (panel) panel.hidden = cancelMode !== "manual";
}

function renderAgentPendingOrders() {
    const box = document.getElementById("agentPendingOrders");
    if (!box) return;
    loadAgentPerpOrders();
    const open = agentPerpOrders.filter(o => o.status !== "cancelled");
    if (!open.length) {
        box.innerHTML = `<p class="history-empty">${t("noAgentOrders")}</p>`;
        selectedCancelOrderId = null;
        return;
    }
    if (!selectedCancelOrderId || !open.some(o => o.id === selectedCancelOrderId)) {
        selectedCancelOrderId = open[0].id;
    }
    box.innerHTML = open.map(o => {
        const px = o.orderType === "stop"
            ? `trig ${fmtNum(o.stopTrigger, 2)} → ${fmtNum(o.stopLimitPrice, 2)}`
            : `lim ${fmtNum(o.limitPrice, 2)}`;
        return `<button type="button" class="manage-token-row mm-row agent-order-pick${o.id === selectedCancelOrderId ? " active" : ""}" data-cancel-id="${o.id}">
            <div class="manage-token-left">
                <div>
                    <strong>${o.side} · ${o.market}</strong>
                    <span>${o.orderType} · ${px} · $${fmtNum(o.sizeUsdt, 2)}</span>
                </div>
            </div>
        </button>`;
    }).join("");
    box.querySelectorAll("[data-cancel-id]").forEach(btn => {
        btn.onclick = () => {
            selectedCancelOrderId = btn.dataset.cancelId;
            renderAgentPendingOrders();
        };
    });
}

function openCancelOrderModal() {
    if (isWeb3TradeMode()) {
        showToast(t("cancelHint"), 4200);
        return;
    }
    if (!requireAgentOwnership()) return;
    setCancelMode("selected");
    renderAgentPendingOrders();
    document.getElementById("cancelOrderModal").style.display = "flex";
}

function handoffCancelOrder() {
    loadAgentPerpOrders();
    let target = null;
    if (cancelMode === "selected") {
        target = agentPerpOrders.find(o => o.id === selectedCancelOrderId && o.status !== "cancelled");
        if (!target) {
            showToast(t("toastNeedCancelOrder"));
            return;
        }
    } else {
        target = {
            market: document.getElementById("cancelMarket")?.value || "BTCUSDT",
            side: document.getElementById("cancelSide")?.value || "Long",
            orderType: document.getElementById("cancelOrderType")?.value || "limit",
            limitPrice: parseFloat(document.getElementById("cancelPrice")?.value) || null,
            stopTrigger: parseFloat(document.getElementById("cancelPrice")?.value) || null,
            sizeUsdt: null
        };
    }
    const note = document.getElementById("cancelNote")?.value?.trim() || "";
    const intent = buildAgentIntent("perp.cancel", {
        market: target.market,
        side: target.side,
        orderType: target.orderType,
        limitPrice: target.limitPrice || null,
        stopTrigger: target.stopTrigger || null,
        stopLimitPrice: target.stopLimitPrice || null,
        sizeUsdt: target.sizeUsdt || null,
        orderId: target.id || null,
        note: note || null
    });
    const summary = `Cancel hanging ${target.orderType} ${target.side} order on ${target.market}` +
        (target.limitPrice ? ` at limit ${target.limitPrice}` : "") +
        (target.stopTrigger ? ` (trigger ${target.stopTrigger})` : "") +
        `. Simulate cancel first; confirm before submit; return cancel confirmation.${note ? " Note: " + note : ""}`;
    const prompt = openIntentHandoff(`Cancel · ${target.orderType} ${target.market}`, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    if (target.id) {
        agentPerpOrders = agentPerpOrders.map(o => o.id === target.id ? { ...o, status: "cancelled" } : o);
        saveAgentPerpOrders();
    }
    document.getElementById("cancelOrderModal").style.display = "none";
}

document.querySelectorAll("#dashWorkspaceSeg .dash-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => setDashWorkspace(btn.dataset.dashPanel || "trade"));
});
document.getElementById("approveBtn")?.addEventListener("click", () => openApproveModal());
document.getElementById("bridgeBtn")?.addEventListener("click", () => openBridgeModal());
document.getElementById("cancelOrderBtn")?.addEventListener("click", () => openCancelOrderModal());
document.getElementById("closeApprove")?.addEventListener("click", () => { document.getElementById("approveModal").style.display = "none"; });
document.getElementById("closeBridge")?.addEventListener("click", () => { document.getElementById("bridgeModal").style.display = "none"; });
document.getElementById("closeCancelOrder")?.addEventListener("click", () => { document.getElementById("cancelOrderModal").style.display = "none"; });
document.querySelectorAll("#approveActionTabs .launch-tab").forEach(tab => {
    tab.onclick = () => { approveAction = tab.dataset.approveAction || "approve"; syncApproveUi(); };
});
document.getElementById("approveSpenderPreset")?.addEventListener("change", syncApproveUi);
document.querySelectorAll('input[name="approveAmtMode"]').forEach(r => r.addEventListener("change", syncApproveUi));
document.getElementById("confirmApprove")?.addEventListener("click", () => handoffApprove());
document.getElementById("confirmBridge")?.addEventListener("click", () => handoffBridge());
document.querySelectorAll("#cancelModeTabs .launch-tab").forEach(tab => {
    tab.onclick = () => setCancelMode(tab.dataset.cancelMode || "selected");
});
document.getElementById("confirmCancelOrder")?.addEventListener("click", () => handoffCancelOrder());

// ===== LAUNCHPAD (AI Agent only) =====
let launchTab = "token";
let tokenLogoMeta = null;
let nftImageMeta = null;
const LAUNCH_EMBED_MAX = 90000; // ~90KB dataURL max in intent

function setLaunchTab(tab) {
    launchTab = tab === "nft" ? "nft" : "token";
    document.querySelectorAll("#launchTabs .launch-tab").forEach(b => {
        b.classList.toggle("active", (b.dataset.launchTab || "") === launchTab);
    });
    const tokenPanel = document.getElementById("launchTokenPanel");
    const nftPanel = document.getElementById("launchNftPanel");
    if (tokenPanel) {
        tokenPanel.hidden = launchTab !== "token";
        tokenPanel.setAttribute("aria-hidden", launchTab !== "token" ? "true" : "false");
    }
    if (nftPanel) {
        nftPanel.hidden = launchTab !== "nft";
        nftPanel.setAttribute("aria-hidden", launchTab !== "nft" ? "true" : "false");
    }
    const btn = document.getElementById("confirmLaunch");
    if (btn) {
        btn.innerText = launchTab === "nft"
            ? (t("launchConfirmNft") || t("launchConfirm"))
            : (t("launchConfirmToken") || t("launchConfirm"));
    }
}

function clearMediaPreview(kind) {
    if (kind === "token") {
        tokenLogoMeta = null;
        const img = document.getElementById("tokenLogoImg");
        const ph = document.querySelector("#tokenLogoPreview span");
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (ph) ph.hidden = false;
        const file = document.getElementById("tokenLogoFile");
        if (file) file.value = "";
        const url = document.getElementById("tokenLogoUrl");
        if (url) url.value = "";
    } else {
        nftImageMeta = null;
        const img = document.getElementById("nftImageImg");
        const ph = document.querySelector("#nftImagePreview span");
        if (img) { img.hidden = true; img.removeAttribute("src"); }
        if (ph) ph.hidden = false;
        const file = document.getElementById("nftImageFile");
        if (file) file.value = "";
        const url = document.getElementById("nftImageUrl");
        if (url) url.value = "";
    }
}

function applyMediaPreview(kind, src, meta) {
    const img = document.getElementById(kind === "token" ? "tokenLogoImg" : "nftImageImg");
    const ph = document.querySelector(kind === "token" ? "#tokenLogoPreview span" : "#nftImagePreview span");
    if (kind === "token") tokenLogoMeta = meta;
    else nftImageMeta = meta;
    if (img && src) {
        img.src = src;
        img.hidden = false;
        if (ph) ph.hidden = true;
    }
}

function readLaunchFile(file, kind) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const meta = {
            source: "upload",
            fileName: file.name,
            mime: file.type,
            sizeBytes: file.size,
            dataUrl: dataUrl.length <= LAUNCH_EMBED_MAX ? dataUrl : null,
            embedded: dataUrl.length <= LAUNCH_EMBED_MAX
        };
        applyMediaPreview(kind, dataUrl, meta);
        if (!meta.embedded) showToast(t("toastLogoTooBig"), 3800);
    };
    reader.readAsDataURL(file);
}

function openLaunchModal() {
    if (isWeb3TradeMode()) {
        showToast(t("launchHint"), 4200);
        return;
    }
    if (!requireAgentOwnership()) return;
    setLaunchTab(launchTab || "token");
    document.getElementById("launchModal").style.display = "flex";
}

function buildTokenLaunchIntent() {
    const name = document.getElementById("tokenName")?.value?.trim() || "";
    const symbol = (document.getElementById("tokenSymbol")?.value || "").trim().toUpperCase();
    const decimals = Number(document.getElementById("tokenDecimals")?.value);
    const supplyRaw = String(document.getElementById("tokenSupply")?.value || "").replace(/,/g, "").trim();
    const supply = Number(supplyRaw);
    const description = document.getElementById("tokenDesc")?.value?.trim() || "";
    const website = document.getElementById("tokenWebsite")?.value?.trim() || "";
    const twitter = document.getElementById("tokenTwitter")?.value?.trim() || "";
    const telegram = document.getElementById("tokenTelegram")?.value?.trim() || "";
    const logoUrl = document.getElementById("tokenLogoUrl")?.value?.trim() || "";
    if (!name || !symbol) {
        showToast(t("toastNeedTokenName"));
        return null;
    }
    if (!(supply > 0) || !isFinite(supply)) {
        showToast(t("toastNeedTokenSupply"));
        return null;
    }
    const logo = tokenLogoMeta
        ? { ...tokenLogoMeta, url: logoUrl || null }
        : (logoUrl ? { source: "url", url: logoUrl } : null);
    return buildAgentIntent("token.launch", {
        standard: "BEP-20",
        chain: "BNB Smart Chain",
        chainId: 56,
        name,
        symbol,
        decimals: Number.isFinite(decimals) ? Math.min(18, Math.max(0, Math.floor(decimals))) : 18,
        totalSupply: supply,
        totalSupplyRaw: supplyRaw,
        description: description || null,
        social: {
            website: website || null,
            twitter: twitter || null,
            telegram: telegram || null
        },
        features: {
            mintable: !!document.getElementById("tokenMintable")?.checked,
            burnable: !!document.getElementById("tokenBurnable")?.checked,
            ownable: !!document.getElementById("tokenOwnable")?.checked
        },
        logo,
        recipient: "agent_wallet",
        verifyOnBscScan: true
    });
}

function buildNftCreateIntent() {
    const name = document.getElementById("nftName")?.value?.trim() || "";
    const symbol = (document.getElementById("nftSymbol")?.value || "").trim().toUpperCase();
    const supply = Number(document.getElementById("nftSupply")?.value);
    const description = document.getElementById("nftDesc")?.value?.trim() || "";
    const external = document.getElementById("nftExternal")?.value?.trim() || "";
    const imageUrl = document.getElementById("nftImageUrl")?.value?.trim() || "";
    if (!name) {
        showToast(t("toastNeedNftName"));
        return null;
    }
    const image = nftImageMeta
        ? { ...nftImageMeta, url: imageUrl || null }
        : (imageUrl ? { source: "url", url: imageUrl } : null);
    if (!image) {
        showToast(t("toastNeedNftImage"));
        return null;
    }
    return buildAgentIntent("nft.create", {
        standard: "BEP-721",
        chain: "BNB Smart Chain",
        chainId: 56,
        name,
        symbol: symbol || "AGNFT",
        mintQuantity: Number.isFinite(supply) && supply > 0 ? Math.floor(supply) : 1,
        description: description || null,
        externalUrl: external || null,
        image,
        recipient: "agent_wallet",
        verifyOnBscScan: true
    });
}

function handoffLaunch() {
    if (isWeb3TradeMode()) {
        showToast(t("launchHint"), 4200);
        return;
    }
    const intent = launchTab === "nft" ? buildNftCreateIntent() : buildTokenLaunchIntent();
    if (!intent) return;
    let summary;
    if (intent.type === "token.launch") {
        const p = intent.params;
        summary = `Launch a BEP-20 token on BNB Smart Chain named "${p.name}" (${p.symbol}) with total supply ${p.totalSupplyRaw || p.totalSupply}, decimals ${p.decimals}. ` +
            `Features: mintable=${p.features.mintable}, burnable=${p.features.burnable}, ownable=${p.features.ownable}. ` +
            `Mint initial supply to the Agent wallet. ` +
            (p.logo?.url ? `Logo URL: ${p.logo.url}. ` : (p.logo?.fileName ? `Logo file uploaded: ${p.logo.fileName}${p.logo.embedded ? " (embedded dataUrl in INTENT_JSON)" : " (too large to embed — ask user for IPFS/HTTPS URL)"}. ` : "No logo provided. ")) +
            (p.description ? `Description: ${p.description}. ` : "") +
            `Social: website=${p.social.website || "-"}, twitter=${p.social.twitter || "-"}, telegram=${p.social.telegram || "-"}. ` +
            `Simulate deploy → confirm → deploy → verify on BscScan → return contract address.`;
    } else {
        const p = intent.params;
        summary = `Create a BEP-721 NFT collection on BNB Smart Chain named "${p.name}" (${p.symbol}), mint quantity ${p.mintQuantity} to the Agent wallet. ` +
            (p.image?.url ? `Image URL: ${p.image.url}. ` : (p.image?.fileName ? `Image uploaded: ${p.image.fileName}${p.image.embedded ? " (embedded)" : " (ask for IPFS/HTTPS)"}. ` : "")) +
            (p.description ? `Description: ${p.description}. ` : "") +
            `Simulate → confirm → deploy metadata + contract → return address & tokenIds.`;
    }
    const title = intent.type === "token.launch"
        ? `Launch Token · ${intent.params.symbol}`
        : `Create NFT · ${intent.params.name}`;
    const prompt = openIntentHandoff(title, intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
    document.getElementById("launchModal").style.display = "none";
}

document.getElementById("launchBtn")?.addEventListener("click", () => openLaunchModal());
document.getElementById("closeLaunch")?.addEventListener("click", () => {
    document.getElementById("launchModal").style.display = "none";
});
document.querySelectorAll("#launchTabs .launch-tab").forEach(tab => {
    tab.onclick = () => setLaunchTab(tab.dataset.launchTab || "token");
});
document.getElementById("tokenLogoFile")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) readLaunchFile(f, "token");
});
document.getElementById("nftImageFile")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) readLaunchFile(f, "nft");
});
document.getElementById("tokenLogoUrl")?.addEventListener("change", () => {
    const url = document.getElementById("tokenLogoUrl")?.value?.trim();
    if (url) applyMediaPreview("token", url, { source: "url", url, fileName: null, mime: null, embedded: false });
});
document.getElementById("nftImageUrl")?.addEventListener("change", () => {
    const url = document.getElementById("nftImageUrl")?.value?.trim();
    if (url) applyMediaPreview("nft", url, { source: "url", url, fileName: null, mime: null, embedded: false });
});
document.getElementById("tokenLogoClear")?.addEventListener("click", () => clearMediaPreview("token"));
document.getElementById("nftImageClear")?.addEventListener("click", () => clearMediaPreview("nft"));
document.getElementById("confirmLaunch")?.addEventListener("click", () => handoffLaunch());
document.getElementById("closeEarn")?.addEventListener("click", () => {
    document.getElementById("earnModal").style.display = "none";
});
document.getElementById("earnModal")?.addEventListener("click", (e) => {
    if (e.target.id === "earnModal") e.currentTarget.style.display = "none";
});
document.querySelectorAll(".earn-asset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (btn.hidden) return;
        earnAsset = btn.dataset.asset;
        syncEarnAssetUi();
        refreshEarnAvailable();
        syncEarnConfirm();
    });
});
document.getElementById("earnAmount")?.addEventListener("input", syncEarnConfirm);
document.getElementById("earnMaxBtn")?.addEventListener("click", () => {
    let avail = parseFloat(document.getElementById("earnAvailable")?.textContent || "0") || 0;
    if (earnAsset === "BNB" && avail > 0.001) avail = Math.max(0, avail - 0.001);
    const input = document.getElementById("earnAmount");
    if (input) input.value = avail > 0 ? String(Number(avail.toFixed(6))) : "0";
    syncEarnConfirm();
});
document.getElementById("confirmEarn")?.addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("earnAmount")?.value);
    const action = isWeb3TradeMode() ? "deposit" : (earnAction || "deposit");
    if (action !== "claim" && !(amount > 0)) {
        showToast(t("earnNeedAmount"));
        return;
    }
    if (isWeb3TradeMode()) {
        try {
            setLoading(true);
            const hash = await executeWeb3Earn(amount);
            document.getElementById("earnModal").style.display = "none";
            showToast(`${t("toastEarnOk")}: ${String(hash).slice(0, 10)}…`);
            await refreshPortfolio(userAddress);
            await refreshEarnAvailable();
        } catch (err) {
            showToast(`${t("toastEarnFail")}: ${formatTxError(err)}`);
        } finally {
            setLoading(false);
        }
        return;
    }
    handoffEarnIntent(amount);
    document.getElementById("earnModal").style.display = "none";
});

// ===== PREDICTION MARKETS (Binance Wallet style) =====
function pmBadge(label, bg, fg = "#fff") {
    const text = String(label).slice(0, 3);
    const size = text.length > 2 ? 18 : 26;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bg}"/><text x="32" y="40" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="700" fill="${fg}">${text}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function pmIconImg(m) {
    const fallback = m.fallbackIcon || pmBadge((m.title || "?").slice(0, 2).toUpperCase(), "#2b3139");
    return `<img src="${m.icon}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`;
}

const ICO = {
    btc: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
    eth: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
    bnb: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
    sol: "https://cryptologos.cc/logos/solana-sol-logo.png",
    nvda: "https://cdn.simpleicons.org/nvidia/76B900",
    aapl: "https://cdn.simpleicons.org/apple/A2AAAD",
    spacex: "https://cdn.simpleicons.org/spacex/FFFFFF",
    lol: "https://cdn.simpleicons.org/leagueoflegends/C89B3C",
    fed: pmBadge("FED", "#1a365d", "#f0b90b"),
    vote: pmBadge("VOTE", "#2d3748", "#f6e05e"),
    brazil: pmBadge("BR", "#009c3b", "#ffdf00"),
    lakers: pmBadge("LAL", "#552583", "#fdb927"),
    chiefs: pmBadge("KC", "#e31837", "#fff"),
    yankees: pmBadge("NYY", "#0c2340", "#fff"),
    t1: pmBadge("T1", "#e4002b", "#fff")
};

const PM_FALLBACK = {
    btc: pmBadge("BTC", "#f7931a"),
    eth: pmBadge("ETH", "#627eea"),
    bnb: pmBadge("BNB", "#f0b90b", "#1e2329"),
    sol: pmBadge("SOL", "#9945ff"),
    nvda: pmBadge("NVD", "#76b900", "#111"),
    aapl: pmBadge("AAPL", "#555", "#fff"),
    spacex: pmBadge("SPX", "#111", "#fff"),
    lol: pmBadge("LoL", "#c89b3c", "#111"),
    fed: ICO.fed,
    vote: ICO.vote,
    brazil: ICO.brazil,
    lakers: ICO.lakers,
    chiefs: ICO.chiefs,
    yankees: ICO.yankees,
    t1: ICO.t1
};

function pmMarket(iconKey, data) {
    return {
        ...data,
        icon: ICO[iconKey],
        fallbackIcon: PM_FALLBACK[iconKey] || pmBadge(String(data.title || "?").slice(0, 2).toUpperCase(), "#2b3139")
    };
}

const PREDICT_MARKETS = [
    pmMarket("btc", { id: "btc5m", cat: "crypto", tabs: ["live", "updown", "trending"], type: "updown", title: "BTC Up or Down 5m", up: 43, down: 57, beat: 63740.55, current: 63740.55, traders: 42, vol: "$12.94M", ends: "4m 12s", endsMin: 4, fav: true }),
    pmMarket("eth", { id: "eth15m", cat: "crypto", tabs: ["live", "updown", "trending"], type: "updown", title: "ETH Up or Down 15m", up: 51, down: 49, beat: 2140.20, current: 2142.80, traders: 128, vol: "$4.12M", ends: "11m", endsMin: 11, fav: false }),
    pmMarket("bnb", { id: "bnb1h", cat: "crypto", tabs: ["live", "updown"], type: "updown", title: "BNB Up or Down 1h", up: 46, down: 54, beat: 580.10, current: 579.40, traders: 89, vol: "$2.41M", ends: "38m", endsMin: 38, fav: false }),
    pmMarket("sol", { id: "sol5m", cat: "crypto", tabs: ["live", "updown", "new"], type: "updown", title: "SOL Up or Down 5m", up: 48, down: 52, beat: 148.20, current: 147.95, traders: 67, vol: "$1.08M", ends: "3m 40s", endsMin: 3, fav: false }),
    pmMarket("btc", { id: "btc100k", cat: "crypto", tabs: ["trending"], type: "binary", title: "Will Bitcoin hit $100k in July?", yes: 62, no: 38, traders: 2401, vol: "$8.22M", ends: "199d", endsMin: 199 * 1440, fav: true }),
    pmMarket("eth", { id: "eth5k", cat: "crypto", tabs: ["trending", "new"], type: "binary", title: "ETH above $5,000 in Q2 2026?", yes: 41, no: 59, traders: 1540, vol: "$3.90M", ends: "180d", endsMin: 180 * 1440, fav: false }),
    pmMarket("sol", { id: "solath", cat: "crypto", tabs: ["trending"], type: "binary", title: "SOL above $300 in 2026?", yes: 44, no: 56, traders: 988, vol: "$1.72M", ends: "220d", endsMin: 220 * 1440, fav: false }),
    pmMarket("fed", { id: "fedcuts", cat: "fed", tabs: ["trending", "ending"], type: "multi", title: "How many Fed rate cuts before June?", options: [
        { label: "0 cuts", pct: 28 }, { label: "1 cut", pct: 41 }, { label: "2+ cuts", pct: 31 }
    ], traders: 5120, vol: "$19.4M", ends: "160d", endsMin: 160 * 1440, fav: true }),
    pmMarket("nvda", { id: "nvda", cat: "stocks", tabs: ["trending"], type: "binary", title: "NVDA hits all-time high in Q2?", yes: 58, no: 42, traders: 1760, vol: "$3.31M", ends: "120d", endsMin: 120 * 1440, fav: false }),
    pmMarket("aapl", { id: "aapl", cat: "stocks", tabs: ["trending", "new"], type: "binary", title: "AAPL closes above $250 this quarter?", yes: 53, no: 47, traders: 920, vol: "$1.15M", ends: "72d", endsMin: 72 * 1440, fav: false }),
    pmMarket("spacex", { id: "spacexipo", cat: "ipo", tabs: ["trending", "new"], type: "binary", title: "SpaceX IPO announced in 2026?", yes: 33, no: 67, traders: 2100, vol: "$5.40M", ends: "250d", endsMin: 250 * 1440, fav: false }),
    pmMarket("brazil", { id: "worldcup", cat: "soccer", tabs: ["sports", "trending"], type: "binary", title: "Brazil wins World Cup 2026?", yes: 18, no: 82, traders: 6400, vol: "$11.0M", ends: "210d", endsMin: 210 * 1440, fav: false }),
    pmMarket("lakers", { id: "lakers", cat: "basketball", tabs: ["sports"], type: "binary", title: "Lakers make NBA Finals 2026?", yes: 29, no: 71, traders: 1880, vol: "$2.60M", ends: "140d", endsMin: 140 * 1440, fav: false }),
    pmMarket("chiefs", { id: "superbowl", cat: "football", tabs: ["sports"], type: "binary", title: "Chiefs win Super Bowl again?", yes: 22, no: 78, traders: 3010, vol: "$4.80M", ends: "95d", endsMin: 95 * 1440, fav: false }),
    pmMarket("yankees", { id: "yankees", cat: "baseball", tabs: ["sports"], type: "binary", title: "Yankees win World Series 2026?", yes: 16, no: 84, traders: 740, vol: "$890K", ends: "300d", endsMin: 300 * 1440, fav: false }),
    pmMarket("t1", { id: "lolmsi", cat: "lol", tabs: ["esports", "trending"], type: "binary", title: "T1 wins next LoL international?", yes: 37, no: 63, traders: 2210, vol: "$2.10M", ends: "45d", endsMin: 45 * 1440, fav: false }),
    pmMarket("lol", { id: "lolworlds", cat: "lol", tabs: ["esports"], type: "multi", title: "LoL Worlds 2026 region winner", options: [
        { label: "LCK", pct: 42 }, { label: "LPL", pct: 35 }, { label: "Other", pct: 23 }
    ], traders: 4100, vol: "$6.20M", ends: "320d", endsMin: 320 * 1440, fav: false }),
    pmMarket("vote", { id: "election", cat: "elections", tabs: ["trending"], type: "multi", title: "Major election outcome focus", options: [
        { label: "Incumbent", pct: 49 }, { label: "Opposition", pct: 40 }, { label: "Other", pct: 11 }
    ], traders: 890, vol: "$900K", ends: "300d", endsMin: 300 * 1440, fav: false })
];

let selectedPredict = null;
let predictSide = "Yes";
let predictCat = "all";
let predictTab = "trending";
let predictQuery = "";
let predictSort = "recommended";

function volNum(v) {
    const s = String(v || "");
    const n = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    if (/b/i.test(s)) return n * 1000;
    if (/m/i.test(s)) return n;
    if (/k/i.test(s)) return n / 1000;
    return n;
}

async function refreshPredictLivePrices() {
    try {
        const [btc, eth, bnb, sol] = await Promise.all([
            fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT").then(r => r.json()),
            fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT").then(r => r.json()),
            fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT").then(r => r.json()),
            fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT").then(r => r.json())
        ]);
        const map = { btc5m: +btc.price, eth15m: +eth.price, bnb1h: +bnb.price, sol5m: +sol.price };
        Object.entries(map).forEach(([id, price]) => {
            const m = PREDICT_MARKETS.find(x => x.id === id);
            if (m && price) {
                if (!m.beat) m.beat = price;
                m.current = price;
            }
        });
    } catch (_) {}
}

function filteredPredictMarkets() {
    let items = PREDICT_MARKETS.filter(m => {
        if (predictCat !== "all" && m.cat !== predictCat) return false;
        if (predictTab === "live" || predictTab === "updown") {
            if (m.type !== "updown") return false;
        } else if (predictTab === "esports") {
            if (m.cat !== "lol" && !(m.tabs || []).includes("esports")) return false;
        } else if (predictTab === "sports") {
            if (!["soccer", "basketball", "football", "baseball", "sports"].includes(m.cat) && !(m.tabs || []).includes("sports")) return false;
        } else if (predictTab === "new") {
            if (!(m.tabs || []).includes("new")) return false;
        } else if (predictTab === "ending") {
            // Ending Soon: up/down live windows or markets within ~100 days
            if (!(m.type === "updown" || (m.endsMin || 0) <= 100 * 1440)) return false;
        } else if (predictTab === "trending") {
            if (!(m.tabs || []).includes("trending") && m.type !== "updown") return false;
        }
        if (predictQuery) {
            const q = predictQuery.toLowerCase();
            if (!(`${m.title} ${m.cat}`.toLowerCase().includes(q))) return false;
        }
        return true;
    });
    if (predictSort === "volume") {
        items = items.slice().sort((a, b) => volNum(b.vol) - volNum(a.vol));
    } else if (predictSort === "ending") {
        items = items.slice().sort((a, b) => (a.endsMin || 0) - (b.endsMin || 0));
    }
    return items;
}

function renderUpDownCard(m) {
    const up = m.up || 50;
    const down = m.down || 50;
    return `
    <article class="pm-card" data-id="${m.id}">
        <div class="pm-card-top">
            <div class="pm-card-title">${pmIconImg(m)}<span>${m.title}</span></div>
            <button type="button" class="pm-star ${m.fav ? "on" : ""}" data-fav="${m.id}">★</button>
        </div>
        <div class="pm-split">
            <div class="pm-pct-col"><span class="pm-pct-up">${up}%</span><span class="pm-pct-label">Up</span></div>
            <div class="pm-pct-col right"><span class="pm-pct-down">${down}%</span><span class="pm-pct-label">Down</span></div>
        </div>
        <div class="pm-bar"><div class="pm-bar-up" style="width:${up}%"></div><div class="pm-bar-down" style="width:${down}%"></div></div>
        <div class="pm-meta"><span>Price to beat <b>$${fmtNum(m.beat, 2)}</b></span><span>Current <b>$${fmtNum(m.current, 2)}</b></span></div>
        <div class="pm-actions">
            <button type="button" class="pm-btn-up" data-side="Up">Up</button>
            <button type="button" class="pm-btn-down" data-side="Down">Down</button>
        </div>
        <div class="pm-footer"><span class="pm-fstat">${m.traders} traders</span><span class="pm-fstat">${m.vol}</span><span class="pm-fstat">${m.ends}</span></div>
    </article>`;
}

function renderBinaryCard(m) {
    const yes = m.yes || 50;
    const no = m.no || 50;
    return `
    <article class="pm-card" data-id="${m.id}">
        <div class="pm-card-top">
            <div class="pm-card-title">${pmIconImg(m)}<span>${m.title}</span></div>
            <button type="button" class="pm-star ${m.fav ? "on" : ""}" data-fav="${m.id}">★</button>
        </div>
        <div class="pm-split">
            <div class="pm-pct-col"><span class="pm-pct-up">${yes}%</span><span class="pm-pct-label">Yes</span></div>
            <div class="pm-pct-col right"><span class="pm-pct-down">${no}%</span><span class="pm-pct-label">No</span></div>
        </div>
        <div class="pm-bar"><div class="pm-bar-up" style="width:${yes}%"></div><div class="pm-bar-down" style="width:${no}%"></div></div>
        <div class="pm-actions">
            <button type="button" class="pm-btn-yes" data-side="Yes">Yes ${yes}c</button>
            <button type="button" class="pm-btn-no" data-side="No">No ${no}c</button>
        </div>
        <div class="pm-footer"><span class="pm-fstat">${m.traders} traders</span><span class="pm-fstat">${m.vol}</span><span class="pm-fstat">${m.ends}</span></div>
    </article>`;
}

function renderMultiCard(m) {
    const rows = (m.options || []).map((o, i) => `
        <div class="pm-opt-row" data-id="${m.id}" data-opt="${i}">
            <span>${o.label}</span>
            <b>${o.pct}%</b>
            <button type="button" class="pm-mini-yes" data-side="Yes">Yes</button>
            <button type="button" class="pm-mini-no" data-side="No">No</button>
        </div>`).join("");
    return `
    <article class="pm-card" data-id="${m.id}">
        <div class="pm-card-top">
            <div class="pm-card-title">${pmIconImg(m)}<span>${m.title}</span></div>
            <button type="button" class="pm-star ${m.fav ? "on" : ""}" data-fav="${m.id}">★</button>
        </div>
        <div class="pm-options">${rows}</div>
        <div class="pm-footer"><span class="pm-fstat">${m.traders} traders</span><span class="pm-fstat">${m.vol}</span><span class="pm-fstat">${m.ends}</span></div>
    </article>`;
}

function bindPredictCardEvents(list) {
    list.querySelectorAll(".pm-card").forEach(card => {
        card.onclick = (e) => {
            if (e.target.closest("button")) return;
            openPredictTrade(card.dataset.id);
        };
    });
    list.querySelectorAll(".pm-star").forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const m = PREDICT_MARKETS.find(x => x.id === btn.dataset.fav);
            if (!m) return;
            m.fav = !m.fav;
            try {
                const favs = JSON.parse(localStorage.getItem("agentgate_pm_favs") || "{}");
                favs[m.id] = !!m.fav;
                localStorage.setItem("agentgate_pm_favs", JSON.stringify(favs));
            } catch (_) {}
            renderPredictList();
        };
    });
    list.querySelectorAll(".pm-actions button").forEach(b => {
        b.onclick = (e) => {
            e.stopPropagation();
            openPredictTrade(b.closest(".pm-card").dataset.id, b.dataset.side);
        };
    });
    list.querySelectorAll(".pm-opt-row").forEach(row => {
        row.querySelectorAll("button").forEach(b => {
            b.onclick = (e) => {
                e.stopPropagation();
                openPredictTrade(row.dataset.id, b.dataset.side, Number(row.dataset.opt));
            };
        });
    });
}

function renderPredictList() {
    const list = document.getElementById("predictList");
    const items = filteredPredictMarkets();
    if (!items.length) {
        list.innerHTML = `<p class="history-empty">${t("noMarket")}</p>`;
        return;
    }
    list.innerHTML = items.map(m => {
        if (m.type === "updown") return renderUpDownCard(m);
        if (m.type === "multi") return renderMultiCard(m);
        return renderBinaryCard(m);
    }).join("");
    bindPredictCardEvents(list);
}

function openPredictTrade(id, side = "Yes", optIndex = null) {
    const base = PREDICT_MARKETS.find(m => m.id === id);
    if (!base) return;
    selectedPredict = { ...base };
    let title = base.title;
    let yes = base.yes || base.up || 50;
    let no = base.no || base.down || 50;
    if (base.type === "multi" && optIndex != null && base.options?.[optIndex]) {
        const opt = base.options[optIndex];
        title = `${base.title} · ${opt.label}`;
        yes = opt.pct;
        no = Math.max(0, 100 - opt.pct);
        selectedPredict.title = title;
        selectedPredict.yes = yes;
        selectedPredict.no = no;
        selectedPredict.selectedOption = opt.label;
    }
    if (base.type === "updown") {
        yes = base.up;
        no = base.down;
        predictSide = (side === "No" || side === "Down") ? "Down" : "Up";
    } else {
        predictSide = (side === "No" || side === "Down") ? "No" : "Yes";
    }
    document.getElementById("predictQuestion").innerText = title;
    document.getElementById("predictTrade").hidden = false;
    const leftLabel = base.type === "updown" ? "Up" : "Yes";
    const rightLabel = base.type === "updown" ? "Down" : "No";
    document.getElementById("predictYes").innerHTML = `${leftLabel} <b id="predictYesOdds">${yes}%</b>`;
    document.getElementById("predictNo").innerHTML = `${rightLabel} <b id="predictNoOdds">${no}%</b>`;
    document.getElementById("predictYes").classList.toggle("active", predictSide === "Yes" || predictSide === "Up");
    document.getElementById("predictNo").classList.toggle("active", predictSide === "No" || predictSide === "Down");
}

function hydratePredictFavorites() {
    try {
        const favs = JSON.parse(localStorage.getItem("agentgate_pm_favs") || "{}");
        PREDICT_MARKETS.forEach(m => {
            if (Object.prototype.hasOwnProperty.call(favs, m.id)) m.fav = !!favs[m.id];
        });
    } catch (_) {}
}

function openPredictPage() {
    document.getElementById("predictPage").style.display = "flex";
    document.getElementById("predictTrade").hidden = true;
    predictCat = "all";
    predictTab = "trending";
    predictQuery = "";
    const search = document.getElementById("predictSearch");
    if (search) search.value = "";
    document.querySelectorAll(".pm-nav").forEach(n => n.classList.toggle("active", n.dataset.cat === "all"));
    document.querySelectorAll(".pm-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "trending"));
    hydratePredictFavorites();
    setPredictAiOpen(false);
    renderPredictList();
    refreshPredictLivePrices().then(renderPredictList);
}

function closePredictPage() {
    document.getElementById("predictPage").style.display = "none";
    setPredictAiOpen(false);
}

document.getElementById("predictBtn").onclick = openPredictPage;
document.getElementById("closePredictPage").onclick = closePredictPage;
document.getElementById("closePredictTrade").onclick = () => {
    document.getElementById("predictTrade").hidden = true;
};
document.getElementById("pmLeaderboard").onclick = () => showToast(t("toastLeaderboard"));

document.querySelectorAll(".pm-nav").forEach(nav => {
    nav.onclick = () => {
        predictCat = nav.dataset.cat;
        document.querySelectorAll(".pm-nav").forEach(n => n.classList.remove("active"));
        nav.classList.add("active");
        document.getElementById("predictTrade").hidden = true;
        renderPredictList();
    };
});

document.querySelectorAll(".pm-tab").forEach(tab => {
    tab.onclick = () => {
        predictTab = tab.dataset.tab;
        document.querySelectorAll(".pm-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("predictTrade").hidden = true;
        renderPredictList();
    };
});

document.getElementById("predictSearch").oninput = (e) => {
    predictQuery = e.target.value.trim();
    renderPredictList();
};
document.getElementById("predictSort").onchange = (e) => {
    predictSort = e.target.value;
    renderPredictList();
};

document.querySelectorAll("[data-pamount]").forEach(btn => {
    btn.onclick = () => {
        document.getElementById("predictAmount").value = btn.dataset.pamount;
    };
});

document.getElementById("predictYes").onclick = () => {
    predictSide = selectedPredict?.type === "updown" ? "Up" : "Yes";
    document.getElementById("predictYes").classList.add("active");
    document.getElementById("predictNo").classList.remove("active");
};
document.getElementById("predictNo").onclick = () => {
    predictSide = selectedPredict?.type === "updown" ? "Down" : "No";
    document.getElementById("predictNo").classList.add("active");
    document.getElementById("predictYes").classList.remove("active");
};

document.getElementById("confirmPredict").onclick = async () => {
    if (!selectedPredict) return;
    const amount = document.getElementById("predictAmount").value.trim();
    if (!amount || parseFloat(amount) <= 0) {
        showToast(t("invalidAmount"));
        return;
    }

    if (isWeb3TradeMode()) {
        // Web3: mở Swap thật — Yes/Up ≈ mua CAKE, No/Down ≈ bán CAKE (hoặc USDT→BNB)
        const side = String(predictSide || "Yes");
        const isYes = /yes|up/i.test(side);
        if (isYes) await openWeb3Swap("USDT", "CAKE", amount);
        else await openWeb3Swap("USDT", "BNB", amount);
        return;
    }

    const yes = selectedPredict.yes || selectedPredict.up || 50;
    const no = selectedPredict.no || selectedPredict.down || 50;
    const intent = buildAgentIntent("predict.place", {
        marketId: selectedPredict.id,
        question: selectedPredict.title,
        category: selectedPredict.cat,
        side: predictSide,
        amountUsdt: Number(amount),
        oddsYesPercent: yes,
        oddsNoPercent: no,
        option: selectedPredict.selectedOption || null
    });
    const summary = `Place a ${predictSide} prediction of ${amount} USDT on "${selectedPredict.title}" on BNB Chain prediction market.`;
    const prompt = openIntentHandoff("Prediction Order", intent, summary);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
};

// ===== AI ADVISOR (Perp + Prediction) =====
let aiAdvisorMode = "perp"; // perp | predict
let aiAdvisorAdvice = null;

function parsePctText(txt) {
    const n = parseFloat(String(txt || "").replace(/[^0-9.+-]/g, ""));
    return isFinite(n) ? n : 0;
}

function pmAiWelcomeText() { return t("pmAiWelcome"); }
function perpAiWelcomeText() { return t("perpAiWelcome"); }

function setPredictAiOpen(open) {
    const wrap = document.getElementById("pmAiFloat");
    const panel = document.getElementById("pmAiDock");
    if (!wrap || !panel) return;
    wrap.classList.toggle("is-open", !!open);
    panel.hidden = !open;
}

function setPerpAiOpen(open) {
    const wrap = document.getElementById("perpAiFloat");
    const panel = document.getElementById("perpAiDock");
    if (!wrap || !panel) return;
    wrap.classList.toggle("is-open", !!open);
    panel.hidden = !open;
}

function focusPredictAiDock(prefill) {
    const input = document.getElementById("pmAiInput");
    setPredictAiOpen(true);
    if (prefill && input) input.value = prefill;
    setTimeout(() => input?.focus(), 50);
}

function focusPerpAiDock(prefill) {
    const input = document.getElementById("perpAiInput");
    setPerpAiOpen(true);
    if (prefill && input) input.value = prefill;
    setTimeout(() => input?.focus(), 50);
}

function appendAiBubble(boxId, text, kind = "bot") {
    const box = document.getElementById(boxId);
    if (!box) return;
    const el = document.createElement("div");
    el.className = `pm-ai-bubble ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
}

function appendPmAiBubble(text, kind = "bot") {
    appendAiBubble("pmAiMessages", text, kind);
}

function appendPerpAiBubble(text, kind = "bot") {
    appendAiBubble("perpAiMessages", text, kind);
}

function resetPmAiChat() {
    aiAdvisorAdvice = null;
    const box = document.getElementById("pmAiMessages");
    const foot = document.getElementById("pmAiDockFoot");
    if (box) box.innerHTML = `<div class="pm-ai-bubble bot">${pmAiWelcomeText()}</div>`;
    if (foot) foot.hidden = true;
    const input = document.getElementById("pmAiInput");
    if (input) input.value = "";
}

function resetPerpAiChat() {
    aiAdvisorAdvice = null;
    const box = document.getElementById("perpAiMessages");
    const foot = document.getElementById("perpAiDockFoot");
    if (box) box.innerHTML = `<div class="pm-ai-bubble bot">${perpAiWelcomeText()}</div>`;
    if (foot) foot.hidden = true;
    const input = document.getElementById("perpAiInput");
    if (input) input.value = "";
}

function openAiAdvisor(mode) {
    aiAdvisorMode = mode;
    aiAdvisorAdvice = null;

    if (mode === "predict") {
        const m = selectedPredict;
        const prefill = m
            ? tf("aiPrefillPredict", { title: m.title })
            : t("aiPrefillPredictNone");
        focusPredictAiDock(prefill);
        return;
    }

    const pair = (selectedPair || "BTCUSDT").replace("USDT", "/USDT");
    const ch = document.getElementById("change24h")?.innerText || "—";
    focusPerpAiDock(tf("aiPrefillPerp", { pair, ch }));
}

function closeAiAdvisor() {
    const modal = document.getElementById("aiAdvisorModal");
    if (modal) modal.style.display = "none";
    setPerpAiOpen(false);
}

function renderAiAdvice(advice) {
    aiAdvisorAdvice = advice;
    const topReasons = (advice.reasons || []).slice(0, 2).map(r => `• ${r}`).join("\n");
    const text = `${advice.side} · ${advice.confidence}%\n${advice.headline}\n${topReasons}`;

    if (advice.mode === "predict") {
        appendPmAiBubble(text, "bot rec");
        const foot = document.getElementById("pmAiDockFoot");
        if (foot) foot.hidden = !advice.action;
        return;
    }

    appendPerpAiBubble(text, "bot rec");
    const foot = document.getElementById("perpAiDockFoot");
    if (foot) foot.hidden = !advice.action;

    // Keep modal result in sync if still open
    const result = document.getElementById("aiAdvisorResult");
    if (result && document.getElementById("aiAdvisorModal")?.style.display === "flex") {
        result.hidden = false;
        const sideEl = document.getElementById("aiRecSide");
        if (sideEl) {
            sideEl.innerText = advice.side;
            sideEl.className = "ai-rec-side " + String(advice.side).toLowerCase();
        }
        const conf = document.getElementById("aiRecConf");
        if (conf) conf.innerText = tf("aiConfLabel", { n: advice.confidence });
        const head = document.getElementById("aiRecHeadline");
        if (head) head.innerText = advice.headline;
        const reasons = document.getElementById("aiRecReasons");
        if (reasons) reasons.innerHTML = (advice.reasons || []).map(r => `<li>${r}</li>`).join("");
        const risk = document.getElementById("aiRecRisk");
        if (risk) risk.innerText = advice.risk || "";
    }
}

async function analyzePerpAdvice(userQ) {
    const pair = selectedPair || "BTCUSDT";
    const mark = parseMarkPrice();
    const ch24 = parsePctText(document.getElementById("change24h")?.innerText);
    const maxLev = Number(document.getElementById("leverageSlider")?.max) || 20;
    let mom = 0;
    try {
        const kl = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=15m&limit=12`).then(r => r.json());
        if (Array.isArray(kl) && kl.length >= 3) {
            const first = +kl[0][4];
            const last = +kl[kl.length - 1][4];
            mom = first ? ((last - first) / first) * 100 : 0;
        }
    } catch (_) {}

    const q = (userQ || "").toLowerCase();
    let bias = 0;
    if (ch24 > 0) bias += Math.min(ch24, 8);
    if (ch24 < 0) bias += Math.max(ch24, -8);
    bias += Math.max(-6, Math.min(6, mom));
    if (/\bshort\b|bán|giảm|down/.test(q)) bias -= 2.5;
    if (/\blong\b|mua|tăng|up/.test(q)) bias += 2.5;

    const side = bias >= 0 ? "Long" : "Short";
    const strength = Math.min(Math.abs(bias), 12);
    const confidence = Math.round(48 + strength * 3.5);
    const size = Math.max(10, Math.min(50, Number(document.getElementById("perpSize")?.value) || 25));
    const leverage = Math.max(2, Math.min(8, Math.round(maxLev * 0.2) || 5));
    const tp = mark > 0 ? +(mark * (side === "Long" ? 1.012 : 0.988)).toFixed(2) : null;
    const sl = mark > 0 ? +(mark * (side === "Long" ? 0.992 : 1.008)).toFixed(2) : null;

    const fundingTxt = document.getElementById("fundingRate")?.innerText || "";
    const chStr = `${ch24 >= 0 ? "+" : ""}${ch24.toFixed(2)}%`;
    const momStr = `${mom >= 0 ? "+" : ""}${mom.toFixed(2)}%`;
    const pairLabel = pair.replace("USDT", "/USDT");
    const reasons = [
        tf("aiPerpCh24", { ch: chStr, pair }),
        tf("aiPerpMom", { mom: momStr }),
        tf("aiPerpLev", { lev: leverage, max: maxLev }),
        tf("aiPerpSize", { size })
    ];
    if (fundingTxt && fundingTxt !== "--") reasons.push(tf("aiPerpFunding", { funding: fundingTxt }));
    if (mark > 0) reasons.push(tf("aiPerpMark", { mark: fmtNum(mark, 2), tp: fmtNum(tp, 2), sl: fmtNum(sl, 2) }));

    return {
        mode: "perp",
        side,
        confidence: Math.min(88, confidence),
        headline: tf("aiPerpHeadline", { side, pair: pairLabel, size, lev: leverage }),
        reasons,
        risk: t("aiPerpRisk"),
        action: { side, size, leverage, tp, sl, market: pair, mark }
    };
}

function analyzePredictAdvice(userQ) {
    let m = selectedPredict;
    if (!m) {
        m = PREDICT_MARKETS.slice().sort((a, b) => volNum(b.vol) - volNum(a.vol))[0];
    }
    if (!m) {
        return {
            mode: "predict",
            side: "Yes",
            confidence: 40,
            headline: t("aiPredNoMarket"),
            reasons: [t("aiPredNoMarketReason")],
            risk: t("aiPredNoMarketRisk"),
            action: null
        };
    }

    const yes = m.yes || m.up || 50;
    const no = m.no || m.down || 50;
    const isUpDown = m.type === "updown";
    const left = isUpDown ? "Up" : "Yes";
    const right = isUpDown ? "Down" : "No";
    const spread = Math.abs(yes - no);
    const q = (userQ || "").toLowerCase();

    let pickLeft = yes >= no;
    if (isUpDown && m.current && m.beat) {
        pickLeft = m.current >= m.beat;
    }
    if (new RegExp(`\\b${right.toLowerCase()}\\b|no|down|giảm`).test(q)) pickLeft = false;
    if (new RegExp(`\\b${left.toLowerCase()}\\b|yes|up|tăng`).test(q)) pickLeft = true;

    // Mild mean-reversion when odds are extreme
    if (!isUpDown && yes >= 70) pickLeft = false;
    if (!isUpDown && no >= 70) pickLeft = true;

    const side = pickLeft ? left : right;
    const sidePct = pickLeft ? yes : no;
    const amount = Math.max(10, Math.min(50, Number(document.getElementById("predictAmount")?.value) || 25));
    const confidence = Math.round(50 + Math.min(spread, 30) * 0.9 + (isUpDown ? 5 : 0));

    const reasons = [
        tf("aiPredMarket", { title: m.title }),
        tf("aiPredOdds", { left, yes, right, no }),
        tf("aiPredVol", { vol: m.vol, traders: m.traders, ends: m.ends })
    ];
    if (isUpDown) {
        reasons.push(tf("aiPredBeat", { beat: fmtNum(m.beat, 2), cur: fmtNum(m.current, 2) }));
    } else if (spread >= 20) {
        reasons.push(tf("aiPredSkew", { spread }));
    } else {
        reasons.push(t("aiPredBalanced"));
    }

    return {
        mode: "predict",
        side,
        confidence: Math.min(86, confidence),
        headline: tf("aiPredHeadline", { side, title: m.title, amount, pct: sidePct }),
        reasons,
        risk: t("aiPredRisk"),
        action: {
            marketId: m.id,
            title: m.title,
            side,
            amount,
            yes,
            no,
            cat: m.cat,
            type: m.type,
            selectedOption: m.selectedOption || null
        }
    };
}

async function runAiAdvisorAnalyze() {
    const btn = document.getElementById("aiAdvisorAnalyze");
    const q = document.getElementById("aiAdvisorQuestion")?.value?.trim() || "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = t("toastAnalyzing");
    }
    try {
        const advice = await analyzePerpAdvice(q);
        renderAiAdvice(advice);
    } catch (e) {
        showToast(t("toastAnalyzeFail"));
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = t("analyzeMarket");
        }
    }
}

async function sendPredictAiChat(raw) {
    const input = document.getElementById("pmAiInput");
    const sendBtn = document.getElementById("pmAiSend");
    const q = (raw != null ? raw : input?.value || "").trim();
    if (!q) return;
    aiAdvisorMode = "predict";
    appendPmAiBubble(q, "user");
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;
    const pending = t("analyzingMarket");
    appendPmAiBubble(pending, "bot");
    try {
        const advice = analyzePredictAdvice(q);
        const box = document.getElementById("pmAiMessages");
        if (box?.lastElementChild?.textContent === pending) {
            box.lastElementChild.remove();
        }
        renderAiAdvice(advice);
    } catch (e) {
        appendPmAiBubble(t("analyzeFailShort"), "bot");
        console.error(e);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

async function sendPerpAiChat(raw) {
    const input = document.getElementById("perpAiInput");
    const sendBtn = document.getElementById("perpAiSend");
    const q = (raw != null ? raw : input?.value || "").trim();
    if (!q) return;
    aiAdvisorMode = "perp";
    appendPerpAiBubble(q, "user");
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;
    const pending = t("analyzingPerp");
    appendPerpAiBubble(pending, "bot");
    try {
        const advice = await analyzePerpAdvice(q);
        const box = document.getElementById("perpAiMessages");
        if (box?.lastElementChild?.textContent === pending) {
            box.lastElementChild.remove();
        }
        renderAiAdvice(advice);
    } catch (e) {
        appendPerpAiBubble(t("analyzeFailShort"), "bot");
        console.error(e);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function applyAiAdviceAndHandoff() {
    const advice = aiAdvisorAdvice;
    if (!advice?.action) {
        showToast(t("toastNoAdvice"));        return;
    }

    if (advice.mode === "perp") {
        const a = advice.action;
        perpSide = a.side;
        const longBtn = document.getElementById("longTab");
        const shortBtn = document.getElementById("shortTab");
        const openBtn = document.getElementById("openPerp");
        if (a.side === "Long") {
            longBtn?.classList.add("active");
            shortBtn?.classList.remove("active");
            if (openBtn) { openBtn.className = "open-long"; openBtn.innerText = t("sendLong"); }
        } else {
            shortBtn?.classList.add("active");
            longBtn?.classList.remove("active");
            if (openBtn) { openBtn.className = "open-short"; openBtn.innerText = t("sendShort"); }
        }
        document.getElementById("perpSize").value = a.size;
        const lev = document.getElementById("leverageSlider");
        if (lev) {
            lev.value = Math.min(Number(lev.max) || 50, a.leverage);
            if (typeof updateLeverageSlider === "function") updateLeverageSlider(lev);
            else document.getElementById("levValue").innerText = lev.value;
        }
        if (a.tp) document.getElementById("tpPrice").value = a.tp;
        if (a.sl) document.getElementById("slPrice").value = a.sl;
        updatePerpPreview();
        closeAiAdvisor();
        const intent = buildPerpIntentFromForm();
        intent.params.aiAdvisor = {
            confidence: advice.confidence,
            headline: advice.headline,
            reasons: advice.reasons
        };
        const summary = `Follow AI Advisor suggestion: Open a ${a.side} perpetual on ${a.market} with margin ${a.size} USDT at ${a.leverage}x` +
            (a.tp ? `, TP ${a.tp}` : "") + (a.sl ? `, SL ${a.sl}` : "") +
            `. Advisor confidence ${advice.confidence}%. Simulate first; confirm before any asset movement.`;
        const prompt = openIntentHandoff(`AI Advisor · Perp ${a.side}`, intent, summary);
        setPerpAiOpen(false);
        closeAiAdvisor();
        navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
        return;
    }

    const a = advice.action;
    const market = PREDICT_MARKETS.find(x => x.id === a.marketId);
    if (market) openPredictTrade(market.id, a.side);
    selectedPredict = {
        ...(market || {}),
        ...(selectedPredict || {}),
        id: a.marketId,
        title: a.title,
        cat: a.cat,
        type: a.type,
        yes: a.yes,
        no: a.no,
        up: market?.up,
        down: market?.down,
        selectedOption: a.selectedOption
    };
    predictSide = a.side;
    document.getElementById("predictAmount").value = a.amount;
    document.getElementById("predictTrade").hidden = false;
    closeAiAdvisor();
    const intent = buildAgentIntent("predict.place", {
        marketId: a.marketId,
        question: a.title,
        category: a.cat,
        side: a.side,
        amountUsdt: Number(a.amount),
        oddsYesPercent: a.yes,
        oddsNoPercent: a.no,
        option: a.selectedOption,
        aiAdvisor: {
            confidence: advice.confidence,
            headline: advice.headline,
            reasons: advice.reasons
        }
    });
    const summary = `Follow AI Advisor suggestion: Place a ${a.side} prediction of ${a.amount} USDT on "${a.title}" (confidence ${advice.confidence}%). Simulate first; confirm before any asset movement.`;
    const prompt = openIntentHandoff("AI Advisor · Prediction", intent, summary);
    setPredictAiOpen(false);
    navigator.clipboard.writeText(prompt).then(() => showToast(t("toastCopiedPrompt"))).catch(() => {});
}

document.getElementById("askAiPerp").onclick = () => openAiAdvisor("perp");
document.getElementById("askAiPredict").onclick = () => openAiAdvisor("predict");
document.getElementById("closeAiAdvisor").onclick = closeAiAdvisor;
document.getElementById("aiAdvisorDismiss").onclick = closeAiAdvisor;
document.getElementById("aiAdvisorAnalyze").onclick = runAiAdvisorAnalyze;
document.getElementById("aiAdvisorApply").onclick = applyAiAdviceAndHandoff;
document.getElementById("aiAdvisorModal")?.addEventListener("click", (e) => {
    if (e.target.id === "aiAdvisorModal") closeAiAdvisor();
});

document.getElementById("pmAiFab").onclick = () => {
    setPredictAiOpen(true);
    document.getElementById("pmAiInput")?.focus();
};
document.getElementById("pmAiMinimize").onclick = () => setPredictAiOpen(false);
document.getElementById("pmAiSend").onclick = () => sendPredictAiChat();
document.getElementById("pmAiClear").onclick = () => resetPmAiChat();
document.getElementById("pmAiApply").onclick = () => applyAiAdviceAndHandoff();
document.getElementById("pmAiInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendPredictAiChat();
    }
});
document.querySelectorAll("#pmAiChips button").forEach(btn => {
    btn.onclick = () => sendPredictAiChat(btn.dataset.chip || t(btn.getAttribute("data-chip-key") || "") || btn.innerText);
});

document.getElementById("perpAiFab").onclick = () => {
    setPerpAiOpen(true);
    document.getElementById("perpAiInput")?.focus();
};
document.getElementById("perpAiMinimize").onclick = () => setPerpAiOpen(false);
document.getElementById("perpAiSend").onclick = () => sendPerpAiChat();
document.getElementById("perpAiClear").onclick = () => resetPerpAiChat();
document.getElementById("perpAiApply").onclick = () => applyAiAdviceAndHandoff();
document.getElementById("perpAiInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendPerpAiChat();
    }
});
document.querySelectorAll("#perpAiChips button").forEach(btn => {
    btn.onclick = () => sendPerpAiChat(btn.dataset.chip || t(btn.getAttribute("data-chip-key") || "") || btn.innerText);
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const pred = document.getElementById("predictPage");
    const perp = document.getElementById("perpPage");
    if (pred && pred.style.display !== "none" && document.getElementById("pmAiFloat")?.classList.contains("is-open")) {
        setPredictAiOpen(false);
    }
    if (perp && perp.style.display !== "none" && document.getElementById("perpAiFloat")?.classList.contains("is-open")) {
        setPerpAiOpen(false);
    }
});
