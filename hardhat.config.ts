require('dotenv').config();
require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");

const privateKey = process.env.PRIVATE_KEY;
const apiKey = process.env.APIKEY;
const infuraKey = process.env.INFURAKEY

module.exports = {
  defaultNetwork: "goerli",
  networks: {
    hardhat: {
    },
    goerli: {
      url: `"https://goerli.infura.io/v3/"${infuraKey}`,
      accounts: [privateKey]
    }
  },
  etherscan: {
    apiKey: apiKey  // replace with your Etherscan API key
  },
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        },
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
}