const { expect } = require("chai");
const { ethers } = require("hardhat");
const UniswapV2Pair = require("../artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json");
const UniswapV2Factory = require("../artifacts/contracts/interfaces/IUniswapV2Factory.sol/IUniswapV2Factory.json");
const FlashLoaner = require("../artifacts/contracts/FlashLoaner.sol/FlashLoaner.json");
const flashLoanerAddress = process.env.FLASH_LOANER; // flashloanerContract address

const DAI_AMOUNT = 500;

describe("FlashLoaner", function () {
  it("Should execute arbitrage and make profit", async function () {

    // 1. Deploy your contract
    const FlashLoaner = await ethers.getContractFactory("FlashLoaner");
    const flashloaner = await FlashLoaner.deploy(
        "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // uniswap factory
        "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" // sushi router02
      );

    await flashloaner.deployed();

  });

  const daiAddress = "0x227E9A3392676DA954133835Eaf139e25ED3e3EF";
  const wethAddress = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
    // const token0 = wethAddress;  // the address of token0
    // const token1 = daiAddress;  // the address of token1
  it("Should execute arbitrage and make profit", async function () {
    const [wallet] = await ethers.getSigners();

    const sushiFactory = new ethers.Contract(
        "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        UniswapV2Factory.abi,
        wallet
    );

    const uniswapFactory = new ethers.Contract(
        "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        UniswapV2Factory.abi,
        wallet
    );

    const flashloanerContract = new ethers.Contract(
        flashLoanerAddress,
        FlashLoaner.abi,
        wallet
    );

    let sushiEthDai;
    let uniswapEthDai;

    const loadPairs = async () => {
        sushiEthDai = new ethers.Contract(await sushiFactory.getPair(wethAddress, daiAddress), UniswapV2Pair.abi, wallet);
        uniswapEthDai = new ethers.Contract(await uniswapFactory.getPair(wethAddress, daiAddress), UniswapV2Pair.abi, wallet);
    };
    await loadPairs();

    // // 2. Prepare tokens and amounts

    // const amount0 = ethers.utils.parseEther("1");  // amount of token0 to arbitrage
    // const amount1 = ethers.utils.parseEther("1");  // amount of token1 to arbitrage

    const sushiReserves = await sushiEthDai.getReserves();
    const uniswapReserves = await uniswapEthDai.getReserves();

    const reserve0Sushi = Number(ethers.utils.formatUnits(sushiReserves[0], 18));
    const reserve1Sushi = Number(ethers.utils.formatUnits(sushiReserves[1], 18));
    const reserve0Uni = Number(ethers.utils.formatUnits(uniswapReserves[0], 18));
    const reserve1Uni = Number(ethers.utils.formatUnits(uniswapReserves[1], 18));

    const priceUniswap = reserve0Uni / reserve1Uni;
    const priceSushiswap = reserve0Sushi / reserve1Sushi;

    const shouldStartEth = priceUniswap < priceSushiswap;
    const spread = Math.abs((priceSushiswap / priceUniswap - 1) * 100) - 0.6;

    const ETH_AMOUNT = DAI_AMOUNT / priceUniswap;
    console.log("ETH Amount:_", ETH_AMOUNT);

    const shouldTrade = spread > (shouldStartEth ? ETH_AMOUNT : DAI_AMOUNT) * 0.003;
    // const shouldTrade = true;
    console.log("SHOULD START WITH ETH? ", shouldStartEth);
    console.log("SHOULD TRADE? ", shouldTrade);
    // // 3. Execute the arbitrage
    // await flashloaner.startArbitrage(
    //     token0,
    //     token1,
    //     !shouldStartEth ? DAI_AMOUNT : 0,
    //     shouldStartEth ? ETH_AMOUNT : 0,
    // );
    const gasPrice = await wallet.getGasPrice();

    // const tx = await wallet.sendTransaction({
    //     to: flashloanerContractAddress,
    //     value: ethers.utils.parseEther("0.1"),
    //     gasPrice: gasPrice,
    //     gasLimit: ethers.utils.hexlify(1500000),
    // });

    const tx = await flashloanerContract.startArbitrage(
        wethAddress,
        daiAddress,
        !shouldStartEth ? DAI_AMOUNT : 0,
        shouldStartEth ? ETH_AMOUNT : 0,
    {
        value: ethers.utils.parseEther("0.1"), // You can still send ETH if needed
        gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(1500000),
    });

    console.log(`Tx Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Tx Receipt: ${receipt.transactionHash}`);

    // Add your checks here. For example, you might want to check whether the arbitrage profit is as expected.
    // This will depend on your business logic.

  });

});
