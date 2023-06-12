const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

//   const Token = await hre.ethers.getContractFactory("Token");
//   const token = await Token.deploy();
  
//   console.log("Token address:", token.address);

  const FlashLoaner = await hre.ethers.getContractFactory("FlashLoaner");
  const flashloaner = await FlashLoaner.deploy(
    "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // uniswap factory
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" // sushi router02
  );

  console.log("FlashLoaner address:", flashloaner.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
