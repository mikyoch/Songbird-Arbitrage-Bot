const ethers = require("ethers");
const CoinGecko = require("coingecko-api");
require("dotenv").config();
const fs = require("fs");

const routerABI = require("./abis/uniswap-router.json");
const factoryABI = require("./abis/uniswap-factory.json");
const pairABI = require("./abis/uniswap-pair.json");
const erc20ABI = require("./abis/erc20.json");

const preparePairs = async () => {
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
  let pairs = [];
  for (let i = 0; i < pairLength; i++) {
    let curPair = {};
    const currentPair = new ethers.Contract(
      await uniswapFactory.allPairs(i),
      pairABI,
      provider
    );
    curPair.address = currentPair.address;
    curPair.token0 = {};
    curPair.token1 = {};
    const tokenA = new ethers.Contract(
      await currentPair.token0(),
      erc20ABI,
      provider
    );
    curPair.token0.address = tokenA.address;
    curPair.token0.symbol = await tokenA.symbol();
    curPair.token0.name = await tokenA.name();
    const tokenB = new ethers.Contract(
      await currentPair.token1(),
      erc20ABI,
      provider
    );
    curPair.token1.address = tokenB.address;
    curPair.token1.symbol = await tokenB.symbol();
    curPair.token1.name = await tokenB.name();
    const reserves = await currentPair.getReserves();
    console.log("<--->", "Pair", i + 1);
    console.log(await tokenA.symbol(), ":", await tokenB.symbol());
    console.log(await tokenA.name(), ":", await tokenB.name());
    console.log(tokenA.address, tokenB.address);
    console.log(Number(reserves._reserve0), ":", Number(reserves._reserve1));
    console.log("");
    pairs.push(curPair);
  }
  console.log(pairs);
  fs.writeFileSync("pair.json", JSON.stringify(pairs));
};

const init = async () => {
  await preparePairs();
};

init();