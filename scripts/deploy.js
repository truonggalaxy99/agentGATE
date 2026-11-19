const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying AgentGate with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const AgentGate = await hre.ethers.getContractFactory("AgentGate");
  const gate = await AgentGate.deploy();
  await gate.waitForDeployment();
  const address = await gate.getAddress();
  console.log("AgentGate deployed:", address);

  const out = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    bscscan: `https://bscscan.com/address/${address}`
  };

  const outPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved:", outPath);

  // Patch frontend config if present
  const cfgPath = path.join(__dirname, "..", "frontend", "config.js");
  const cfg = `// Auto-updated by scripts/deploy.js — do not hand-edit address after deploy\nwindow.AGENT_GATE_CONFIG = ${JSON.stringify({
    address,
    network: hre.network.name,
    chainId: Number(out.chainId),
    agentIdContract: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"
  }, null, 2)};\n`;
  fs.writeFileSync(cfgPath, cfg);
  console.log("Updated frontend/config.js");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
