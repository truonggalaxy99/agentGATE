/**
 * Prepare CREATE2 (Nick factory) payloads for AgentPulseToken + AgentPulseMine.
 * Usage: node scripts/prepare-pulse-create2.js
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const FACTORY = ethers.getAddress("0x4e59b44847b379578588920cA78FbF26c0B4956C");
const GATE = ethers.getAddress("0xf61C2A65F66E4a5aFe357C2EC8c3851D396c530e");
const OWNER = ethers.getAddress("0xB58f2CF5Ef62684F2270E8DB8C2Eb5957A5dd8a9");
const BASE_REWARD = ethers.parseEther("1000");
const SALT_TOKEN = ethers.zeroPadValue(ethers.toBeHex(0x1352910), 32);
const SALT_MINE = ethers.zeroPadValue(ethers.toBeHex(0x1352911), 32);

function loadArtifact(name) {
  const p = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    `${name}.sol`,
    `${name}.json`
  );
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function predict(salt, initCode) {
  const initHash = ethers.keccak256(initCode);
  return ethers.getCreate2Address(FACTORY, salt, initHash);
}

function main() {
  const tokenArt = loadArtifact("AgentPulseToken");
  const mineArt = loadArtifact("AgentPulseMine");

  const tokenIface = new ethers.Interface(tokenArt.abi);
  const tokenInit = ethers.concat([
    tokenArt.bytecode,
    tokenIface.encodeDeploy([OWNER])
  ]);
  const pulseToken = predict(SALT_TOKEN, tokenInit);

  const mineIface = new ethers.Interface(mineArt.abi);
  const mineInit = ethers.concat([
    mineArt.bytecode,
    mineIface.encodeDeploy([pulseToken, GATE, BASE_REWARD, OWNER])
  ]);
  const pulseMine = predict(SALT_MINE, mineInit);

  const tokenInput = ethers.concat([SALT_TOKEN, tokenInit]);
  const mineInput = ethers.concat([SALT_MINE, mineInit]);

  const setMinterData = tokenIface.encodeFunctionData("setMinter", [pulseMine]);

  const out = {
    factory: FACTORY,
    owner: OWNER,
    gate: GATE,
    baseRewardPerShare: BASE_REWARD.toString(),
    saltToken: SALT_TOKEN,
    saltMine: SALT_MINE,
    pulseToken,
    pulseMine,
    tokenInputData: tokenInput,
    mineInputData: mineInput,
    setMinterInputData: setMinterData,
    shareCost: "0.002",
    note: "Send each CREATE2 tx: to=factory, value=0, inputData=tokenInputData then mineInputData. Then setMinter on token."
  };

  const outPath = path.join(__dirname, "..", "deployments", "pulse-create2.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pulseToken, pulseMine, outPath }, null, 2));
}

main();
