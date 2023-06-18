const { providers } = require("ethers");
const { ethers } = require("hardhat");
require('dotenv').config();


const uniswapUsdtWethExchange = "0x7749dd3530a64aA1227522493fa02c63d00B0f80";
const sushiUsdtWethExchange = "0xeA2A56F7deC0D8CC07638A9880C15fD32Db955BC";
const uniswapRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const sushiswapRouterAddress = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
const usdtAddress = "0x227E9A3392676DA954133835Eaf139e25ED3e3EF";
const wethAddress = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
const UNISWAP_FEE = 0.03

const uniswapAbi = [
    "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
];
const routerAbi = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)"
];
const swapAbi = [
    {
        "name": "swapExactTokensForTokens",
        "type": "function",
        "inputs": [
            {
                "type": "uint256",
                "name": "amountIn"
            },
            {
                "type": "uint256",
                "name": "amountOutMin"
            },
            {
                "type": "address[]",
                "name": "path"
            },
            {
                "type": "address",
                "name": "to",
                "indexed": true
            },
            {
                "type": "uint256",
                "name": "deadline"
            }
        ],
        "outputs": [
            {
                "type": "uint256[]",
                "name": "amounts"
            }
        ],
        "stateMutability": "nonpayable",
        "constant": false,
        "payable": false
    }    
]
const swapETHabi = [
    {
      "constant": false,
      "inputs": [
        {
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "name": "path",
          "type": "address[]"
        },
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "deadline",
          "type": "uint256"
        }
      ],
      "name": "swapExactETHForTokens",
      "outputs": [
        {
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "payable": true,
      "stateMutability": "payable",
      "type": "function"
    }
]
  
let uniswapPrice, sushiswapPrice;
const PRICE_THRESHOLD = 0.01;

async function main() {
    const [wallet] = await ethers.getSigners();
    const signer = await ethers.getSigner();
    const provider = wallet.provider;

    function getAmountsFromSwapArgs(swapArgs) {
        const { amount0In, amount0Out, amount1In, amount1Out } = swapArgs;
      
        let token0AmountBigDecimal = amount0In;
        if (token0AmountBigDecimal.eq(0)) {
          token0AmountBigDecimal = amount0Out;
        }
      
        let token1AmountBigDecimal = amount1In;
        if (token1AmountBigDecimal.eq(0)) {
          token1AmountBigDecimal = amount1Out;
        }
      
        return { token0AmountBigDecimal, token1AmountBigDecimal };
      }
      
      function convertSwapEventToPrice({ swapArgs, token0Decimals, token1Decimals }) {
        const {
          token0AmountBigDecimal,
          token1AmountBigDecimal,
        } = getAmountsFromSwapArgs(swapArgs);
      
        const token0AmountFloat = parseFloat(
          ethers.utils.formatUnits(token0AmountBigDecimal, token0Decimals)
        );
        const token1AmounFloat = parseFloat(
          ethers.utils.formatUnits(token1AmountBigDecimal, token1Decimals)
        );
      
        if (token1AmounFloat > 0) {
          const priceOfToken0InTermsOfToken1 = token0AmountFloat / token1AmounFloat;
          return { price: priceOfToken0InTermsOfToken1, volume: token0AmountFloat };
        }
      
        return null;
      }
      
      const uniswapContract = new ethers.Contract(
        uniswapUsdtWethExchange,
        uniswapAbi,
        provider
      );
      const sushiswapContract = new ethers.Contract(
        sushiUsdtWethExchange,
        uniswapAbi,
        provider
      );
      
      const unifilter = uniswapContract.filters.Swap();
      const sushifilter = sushiswapContract.filters.Swap();
      
      // 监听价格并返回一个Promise，这样就可以在价格可用时解析这个Promise
      function watchPrice(contract, filter, decimals) {
          return new Promise((resolve, reject) => {
              contract.on(filter, (from, a0in, a0out, a1in, a1out, to, event) => {
              const { price, volume } = convertSwapEventToPrice({
                  swapArgs: event.args,
                  token0Decimals: decimals,
                  token1Decimals: decimals,
              });
              console.log({ price, volume });
              resolve(price);
              });
          });
      }
        
      function estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice) {
          const diff = Math.abs(sushiswapPrice - uniswapPrice);
          console.log(diff, "diff")
          const diffRatio = diff / Math.max(sushiswapPrice, uniswapPrice);
          console.log(diffRatio, "diffRatio");
          const fees = UNISWAP_FEE * 2; // multiply by 2 because we trade 2 times // (once on Uniswap and once on SushiSwap) 
          return Math.abs(diffRatio - fees);
      }
      
      async function watchAndExecuteArbitrage() {
          uniswapPrice = await watchPrice(uniswapContract, unifilter, 18);
          sushiswapPrice = await watchPrice(sushiswapContract, sushifilter, 18);
      
          return {
              uniswapPrice,
              sushiswapPrice
          }
          // console.log(estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice), "estimateProfitAfterTradingFees");
      
          // // 检查价格差异并执行操作
          // if (estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice) >= PRICE_THRESHOLD) {
          //     executeArbitrage();
          // }
      }
      
      
      // 获取 Uniswap 的价格
      async function getPriceFromUniswapWithSlippage(tokenIn, amountIn, tokenOut) {
          const uniswapRouter = new ethers.Contract(
              uniswapRouterAddress,
              routerAbi,
              provider
          );
      
          const amountsOut = await uniswapRouter.getAmountsOut(amountIn, [tokenIn, tokenOut]);
          const priceWithSlippage = ethers.utils.formatUnits(amountsOut[1], 18) / ethers.utils.formatUnits(amountIn, 18);
      
          return priceWithSlippage;
      }
      
      // 获取 Sushiswap 的价格
      async function getPriceFromSushiswapWithSlippage(tokenIn, amountIn, tokenOut) {
          const sushiswapRouter = new ethers.Contract(
              sushiswapRouterAddress,
              routerAbi,
              provider
          );
      
          const amountsOut = await sushiswapRouter.getAmountsOut(amountIn, [tokenIn, tokenOut]);
          const priceWithSlippage = ethers.utils.formatUnits(amountsOut[1], 18) / ethers.utils.formatUnits(amountIn, 18);
      
          return priceWithSlippage;
      }
      
      const amountIn = ethers.utils.parseUnits("0.01", 18); // 0.1 ETH，注意这里的 18 是 WETH 的小数位数
      
      // uniswapContract.on(unifilter, async (from, a0in, a0out, a1in, a1out, to, event) => {
      //     console.log("uniswap");
      //     const { price, volume } = convertSwapEventToPrice({
      //         swapArgs: event.args,
      //         token0Decimals: 18,
      //         token1Decimals: 18,
      //     });
      //     uniswapPrice = price;
      //     sushiswapPrice = await getPriceFromSushiswapWithSlippage(wethAddress, amountIn, usdtAddress);
      
      //     console.log(sushiswapPrice, uniswapPrice, "sushiswapPrice", "uniswapPrice");
      
      //     if (sushiswapPrice) {
      //         console.log(estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice), "estimateProfitAfterTradingFees");
      //         if (estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice) >= PRICE_THRESHOLD) {
      //             executeArbitrage(uniswapPrice, sushiswapPrice);
      //         }
      //     }
      
      //     console.log({ price: uniswapPrice, volume });
      // });
      
      // sushiswapContract.on(sushifilter, async (from, a0in, a0out, a1in, a1out, to, event) => {
      //     console.log("sushi");
      //     const { price, volume } = convertSwapEventToPrice({
      //         swapArgs: event.args,
      //         token0Decimals: 18,
      //         token1Decimals: 18,
      //     });
      //     sushiswapPrice = price;
      //     uniswapPrice = await getPriceFromUniswapWithSlippage(wethAddress, amountIn, usdtAddress).then(price => {
      //         console.log("Uniswap price with slippage:", price);
      //     });
      
      //     console.log(sushiswapPrice, uniswapPrice, "sushiswapPrice", "uniswapPrice");
      
      //     if (uniswapPrice) {
      //         console.log(estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice), "estimateProfitAfterTradingFees");
      //         if (estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice) >= PRICE_THRESHOLD) {
      //             executeArbitrage(uniswapPrice, sushiswapPrice);
      //         }
      //     }
      
      //     console.log({ price: sushiswapPrice, volume });
      // });
      
      const executeArbitrage = (uniswapPrice, sushiswapPrice) => {
          console.log("Executing arbitrage strategy...");
          const profitRate = estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice);
          console.log(profitRate, "profitRate");
          // const maxBet = findMaxBet(profitRate, uniReserves, sushiReserves);
          // const expectedProfit = maxBet * profitRate;
          // if (expectedProfit > 0) { executeTrade(maxBet);}
      
      };
      
      // const uniswapRouterAddress = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
      // const sushiswapRouterAdress = "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";
      // const usdcErc20Address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
      // const wethErc20Address = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      // approveSushiswap(usdcErc20Address, 1000.0);
      // approveSushiswap(wethErc20Address, 5.0);
      // const gasPriceGwei = "100";
      // const gasPriceWei = ethers.utils.parseUnits(gasPriceGwei, "gwei");
      // const wallet = new ethers.Wallet( Buffer.from( "",));
      // const signer = wallet.connect(provider);
      // function approveUniswap(erc20Address, amountToApproveInNativeUnitFloat) {
      //     const erc20Contract = new ethers.Contract(erc20Address, erc20Abi, signer);
      //     return erc20Contract.decimals().then((decimals) => {
      //         return erc20Contract.approve(uniswapRouterAddress, ethers.utils.parseUnits(`${amountToApproveInNativeUnitFloat}`, decimals),
      //         { gasLimit: 100000, gasPrice: gasPriceWei } ); });}
      // function getGasPrice(n = 1) {
      //     const fixedFee = 0.0001 * n;
      //     const gasPrice = (expectedProfit - fixedFee) / ESTIMATED_GAS_USAGE;
      // }
      // function executeTrade() {
      //     const uniswapRouterAbi = [ "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",];
      // }
      
      function createDeadline() {
          return Math.floor(Date.now() / 1000) + 15 * 60; // Current time + 15 minutes
      }
      
      // function buyEthWithUsdc(amountUsdcFloat) {
      //     const exchangeContract = new ethers.Contract(uniswapRouterAddress, uniswapRouterAbi, signer); // usdc uses 6 decimals 
      //       return exchangeContract.swapExactTokensForTokens(
      //         ethers.utils.parseUnits(`${amountUsdcFloat}`, 6),
      //         ethers.utils.parseUnits(`${amountUsdcFloat}`, 6),
      //         [usdcErc20Address, wethErc20Address],
      //         wallet.address,
      //         createDeadline(), // Math.floor(Date.now() / 1000) + 20 createGasOverrides() 
      //         { gasLimit: ethers.utils.hexlify(300000), gasPrice: gasPriceWei }
      //     );
      // }
      
      // const exchangeContract = new ethers.Contract(uniswapRouterAddress, swapAbi, signer);
      
      // function buyUsdcWithEth(amountEthFloat) {
      //     const exchangeContract = new ethers.Contract(uniswapRouterAddress, swapAbi, signer) // eth uses 18 decimals
      //       return exchangeContract.swapExactTokensForTokens(
      //         ethers.utils.parseUnits(`${amountEthFloat}`, 18),
      //         0,
      //         [wethAddress, usdtAddress],
      //         wallet.address,
      //         createDeadline(), // Math.floor(Date.now() / 1000) + 20 createGasOverrides() 
      //         { gasLimit: ethers.utils.hexlify(300000)}
      //       );
      // }
      
      function buyUsdcWithEth(amountEthFloat) {
          const exchangeContract = new ethers.Contract(sushiswapRouterAddress, swapETHabi, signer) // eth uses 18 decimals
            return exchangeContract.swapExactETHForTokens(
              // ethers.utils.parseUnits(`${amountEthFloat}`, 18),
              0,
              [wethAddress, usdtAddress],
              wallet.address,
              createDeadline(), // Math.floor(Date.now() / 1000) + 20 createGasOverrides() 
              {
                  value: ethers.utils.parseEther("0.01"),
                  gasLimit: ethers.utils.hexlify(300000)
              }
            );
      }

      buyUsdcWithEth(0.01);
}



main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

