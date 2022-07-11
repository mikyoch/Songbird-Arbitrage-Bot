const ethers = require("ethers");
const CoinGecko = require("coingecko-api");
require("dotenv").config();

const routerABI = require("./abis/uniswap-router.json");
const factoryABI = require("./abis/uniswap-factory.json");
const pairABI = require("./abis/uniswap-pair.json");
const erc20ABI = require("./abis/erc20.json");

const init = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.SONGBIRD);
  const uniswapRouter = new ethers.Contract(
    process.env.routerAddress,
    routerABI,
    provider
  );
  const uniswapFactory = new ethers.Contract(
    await uniswapRouter.factory(),
    factoryABI,
    provider
  );
  const pairLength = Number(await uniswapFactory.allPairsLength());
  console.log("Pair Length:", pairLength);
  for (let i = 59; i < pairLength; i++) {
    const currentPair = new ethers.Contract(
      await uniswapFactory.allPairs(i),
      pairABI,
      provider
    );
    const tokenA = new ethers.Contract(
      await currentPair.token0(),
      erc20ABI,
      provider
    );
    const tokenB = new ethers.Contract(
      await currentPair.token1(),
      erc20ABI,
      provider
    );
    const reserves = await currentPair.getReserves();
    console.log("<--->", "Pair", i + 1);
    console.log(await tokenA.symbol(), ":", await tokenB.symbol());
    console.log(await tokenA.name(), ":", await tokenB.name());
    console.log(tokenA.address, tokenB.address);
    console.log(Number(reserves._reserve0), ":", Number(reserves._reserve1));
    console.log("");
  }
};

init();