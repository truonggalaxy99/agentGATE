const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const GATE = "0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e";
const BASE_REWARD = hre.ethers.parseEther("1000"); // 1000 AGPULSE per share at epoch 0

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Agent Pulse with:", deployer.address);
  console.log(
    "Balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  const Token = await hre.ethers.getContractFactory("AgentPulseToken");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();
  const pulseToken = await token.getAddress();
  console.log("AgentPulseToken:", pulseToken);

  const Mine = await hre.ethers.getContractFactory("AgentPulseMine");
  const mine = await Mine.deploy(pulseToken, GATE, BASE_REWARD, deployer.address);
  await mine.waitForDeployment();
  const pulseMine = await mine.getAddress();
  console.log("AgentPulseMine:", pulseMine);

  const tx = await token.setMinter(pulseMine);
  await tx.wait();
  console.log("Minter set to PulseMine");

  const network = await hre.ethers.provider.getNetwork();
  const out = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    pulseToken,
    pulseMine,
    gate: GATE,
    shareCost: "0.002",
    shareCostWei: "2000000000000000",
    baseRewardPerShare: BASE_REWARD.toString(),
    lockSeconds: 86400,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    methods: {
      enter: "enterFree()",
      claim: "claimFree(uint256)",
      claimAll: "claimFreeAll()"
    },
    bscscanToken: `https://bscscan.com/address/${pulseToken}`,
    bscscanMine: `https://bscscan.com/address/${pulseMine}`
  };

  const outPath = path.join(__dirname, "..", "deployments", `pulse-${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved:", outPath);

  const cfgPath = path.join(__dirname, "..", "frontend", "config.js");
  let proofAddress = "0xb346d2705Ec8F8f863CBdfd3F0B78aB766AEA4c2";
  let agentId = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
  let gateAddress = GATE;
  try {
    const prev = fs.readFileSync(cfgPath, "utf8");
    const mProof = prev.match(/"proofAddress"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
    const mId = prev.match(/"agentIdContract"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
    const mGate = prev.match(/"address"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
    if (mProof) proofAddress = mProof[1];
    if (mId) agentId = mId[1];
    if (mGate) gateAddress = mGate[1];
  } catch (_) {}

  const cfg = `// Auto-updated by scripts/deploy-pulse.js — do not hand-edit after deploy
window.AGENT_GATE_CONFIG = ${JSON.stringify(
    {
      address: gateAddress,
      network: hre.network.name,
      chainId: Number(network.chainId),
      agentIdContract: agentId,
      proofAddress,
      proofMethod: "mintProof()",
      pulseMine,
      pulseToken,
      pulseShareCost: "0.002",
      pulseMethodEnter: "enterFree()",
      pulseMethodClaim: "claimFree(uint256)",
      pulseMethodClaimAll: "claimFreeAll()"
    },
    null,
    2
  )};
`;
  fs.writeFileSync(cfgPath, cfg);
  console.log("Updated frontend/config.js pulse addresses");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
