require("dotenv").config();

const { ethers } = require("hardhat");
const UniswapV2Pair = require("../artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json");
const UniswapV2Factory = require("../artifacts/contracts/interfaces/IUniswapV2Factory.sol/IUniswapV2Factory.json");
const FlashLoaner = require("../artifacts/contracts/FlashLoaner.sol/FlashLoaner.json");


const DAI_AMOUNT = 500;
console.log("DAI Amount:_", DAI_AMOUNT);

const flashLoanerAddress = process.env.FLASH_LOANER; // flashloanerContract address
console.log(flashLoanerAddress, "flashLoanerAddress");

async function main() {
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

    // const daiAddress = "0xdc31Ee1784292379Fbb2964b3B9C4124D8F89C60";
    const daiAddress = "0x227E9A3392676DA954133835Eaf139e25ED3e3EF";
    const wethAddress = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";

    let sushiEthDai;
    let uniswapEthDai;

    const loadPairs = async () => {
        sushiEthDai = new ethers.Contract(await sushiFactory.getPair(wethAddress, daiAddress), UniswapV2Pair.abi, wallet);
        uniswapEthDai = new ethers.Contract(await uniswapFactory.getPair(wethAddress, daiAddress), UniswapV2Pair.abi, wallet);
    };
    await loadPairs();

    const provider = wallet.provider;

    provider.on("block", async (blockNumber) => {
        try {
            console.log(blockNumber);

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

            // const shouldTrade = spread > (shouldStartEth ? ETH_AMOUNT : DAI_AMOUNT) * 0.003;
            const shouldTrade = true;
            console.log("SHOULD START WITH ETH? ", shouldStartEth);
            console.log("SHOULD TRADE? ", shouldTrade);

            if (shouldTrade) {
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
            }
        } catch (error) {
            console.error(error);
        }


    //     try {
    //         console.log(blockNumber);

    //         const sushiReserves = await sushiEthDai.getReserves();
    //         const uniswapReserves = await uniswapEthDai.getReserves();
      
    //         const reserve0Sushi = Number(
    //           ethers.utils.formatUnits(sushiReserves[0], 18)
    //         );
      
    //         const reserve1Sushi = Number(
    //           ethers.utils.formatUnits(sushiReserves[1], 18)
    //         );
      
    //         const reserve0Uni = Number(
    //           ethers.utils.formatUnits(uniswapReserves[0], 18)
    //         );
    //         const reserve1Uni = Number(
    //           ethers.utils.formatUnits(uniswapReserves[1], 18)
    //         );
      
    //         const priceUniswap = reserve0Uni / reserve1Uni;
    //         const priceSushiswap = reserve0Sushi / reserve1Sushi;
      
    //         const shouldStartEth = priceUniswap < priceSushiswap;
    //         const spread = Math.abs((priceSushiswap / priceUniswap - 1) * 100) - 0.6;
      
    //         /** +-If the Trade Starts with ETH, It will use ETH worth = DAI_AMOUNT:_
    //         (If "const DAI_AMOUNT = 1000;", it will use 1000 DAI in ETH):_ */
    //         const ETH_AMOUNT = DAI_AMOUNT / priceUniswap;
    //         console.log("ETH Amount:_", ETH_AMOUNT);
      
    //         const shouldTrade =
    //           spread >
    //           (shouldStartEth ? ETH_AMOUNT : DAI_AMOUNT) /
    //             Number(
    //               ethers.utils.formatEther(uniswapReserves[shouldStartEth ? 1 : 0])
    //             );
      
    //         console.log(`UNISWAP PRICE ${priceUniswap}`);
    //         console.log(`SUSHISWAP PRICE ${priceSushiswap}`);
    //         console.log(`PROFITABLE? ${shouldTrade}`);
    //         console.log(
    //           `CURRENT SPREAD: ${(priceSushiswap / priceUniswap - 1) * 100}%`
    //         );
    //         console.log(`ABSLUTE SPREAD: ${spread}`);
      
    //         if (!shouldTrade) return;
      
    //         const gasLimit = await sushiEthDai.estimateGas.swap(
    //           !shouldStartEth ? DAI_AMOUNT : 0,
    //           shouldStartEth ? ETH_AMOUNT : 0,
    //           flashLoanerAddress,
    //           ethers.utils.toUtf8Bytes("1")
    //         );
      
    //         const gasPrice = await wallet.getGasPrice();
      
    //         const gasCost = Number(ethers.utils.formatEther(gasPrice.mul(gasLimit)));
      
    //         /** +-DeFi transactions like this can be very expensive. There may appear to be a profitable arbitrage,
    //         but any profit margin may be eaten up by the cost of gas. An important check of our program is to make
    //         sure our gas costs don’t eat into our spread:_ */
    //         const shouldSendTx = shouldStartEth
    //           ? gasCost / ETH_AMOUNT < spread
    //           : gasCost / (DAI_AMOUNT / priceUniswap) < spread;
      
    //         // don't trade if gasCost is higher than the spread
    //         if (!shouldSendTx) return;
      
    //         const options = {
    //           gasPrice,
    //           gasLimit,
    //         };
    //         const tx = await sushiEthDai.swap(
    //           !shouldStartEth ? DAI_AMOUNT : 0,
    //           shouldStartEth ? ETH_AMOUNT : 0,
    //           flashLoanerAddress,
    //           ethers.utils.toUtf8Bytes("1"),
    //           options
    //         );
      
    //         console.log("ARBITRAGE EXECUTED! PENDING Transaction TO BE MINED");
    //         console.log(tx);
      
    //         await tx.wait();
      
    //         console.log("SUCCESS! Transaction MINED");
    //       } catch (err) {
    //         console.error(err);
    //       }
    });
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

