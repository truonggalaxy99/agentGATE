const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Deploy first.`);
  const { address } = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log("Verifying", address, "on", hre.network.name);
  await hre.run("verify:verify", {
    address,
    constructorArguments: []
  });
  console.log("Verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
