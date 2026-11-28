const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying AgentGateProof with:", deployer.address);
  console.log(
    "Balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  const Factory = await hre.ethers.getContractFactory("AgentGateProof");
  const proof = await Factory.deploy();
  await proof.waitForDeployment();
  const proofAddress = await proof.getAddress();
  console.log("AgentGateProof deployed:", proofAddress);

  const network = await hre.ethers.provider.getNetwork();
  const out = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    proofAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    bscscan: `https://bscscan.com/address/${proofAddress}`,
    method: "mintProof()"
  };

  const outPath = path.join(__dirname, "..", "deployments", `proof-${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved:", outPath);

  // Merge into frontend config (keep existing AgentGate address)
  const cfgPath = path.join(__dirname, "..", "frontend", "config.js");
  let gateAddress = "0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e";
  let agentId = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
  try {
    const prev = fs.readFileSync(cfgPath, "utf8");
    const mGate = prev.match(/"address"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
    const mId = prev.match(/"agentIdContract"\s*:\s*"(0x[a-fA-F0-9]{40})"/);
    if (mGate) gateAddress = mGate[1];
    if (mId) agentId = mId[1];
  } catch (_) {}

  const cfg = `// Auto-updated by scripts/deploy-proof.js — do not hand-edit after deploy
window.AGENT_GATE_CONFIG = ${JSON.stringify(
    {
      address: gateAddress,
      network: hre.network.name,
      chainId: Number(network.chainId),
      agentIdContract: agentId,
      proofAddress,
      proofMethod: "mintProof()"
    },
    null,
    2
  )};
`;
  fs.writeFileSync(cfgPath, cfg);
  console.log("Updated frontend/config.js proofAddress");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
