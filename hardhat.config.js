require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts
    }
  },
  // Etherscan API V2 — one key works for BSC (chainId 56) and other EVM chains
  etherscan: {
    apiKey: BSCSCAN_API_KEY
  },
  sourcify: {
    enabled: false
  }
};
