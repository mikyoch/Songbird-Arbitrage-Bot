const ethers = require("ethers");
const BigNumber = require("ethers").BigNumber;
require("dotenv").config();
const fs = require("fs");

const routerABI = require("./abis/uniswap-router.json");
const factoryABI = require("./abis/uniswap-factory.json");
const pairABI = require("./abis/uniswap-pair.json");
const erc20ABI = require("./abis/erc20.json");
const WSGB = "0x02f0826ef6aD107Cfc861152B32B52fD11BaB9ED";

let circles = [];
let tokens = [];
let pairs = [];

const provider = new ethers.providers.JsonRpcProvider(process.env.SONGBIRD);
const uniswapRouter = new ethers.Contract(
  process.env.routerAddress,
  routerABI,
  provider
);

const loadPairsFromNetwork = async () => {
  const uniswapFactory = new ethers.Contract(
    await uniswapRouter.factory(),
    factoryABI,
    provider
  );
  const pairLength = Number(await uniswapFactory.allPairsLength());
  const threshold = BigNumber.from("500000000000000000000");
  console.log("Pair Length:", pairLength);
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
    curPair.token0.decimals = await tokenA.decimals();
    const tokenB = new ethers.Contract(
      await currentPair.token1(),
      erc20ABI,
      provider
    );
    curPair.token1.address = tokenB.address;
    curPair.token1.symbol = await tokenB.symbol();
    curPair.token1.name = await tokenB.name();
    curPair.token1.decimals = await tokenB.decimals();
    const reserves = await currentPair.getReserves();
    if (!reserves._reserve0.gt(threshold)) continue;
    if (!reserves._reserve1.gt(threshold)) continue;
    console.log("<--->", "Pair", i + 1);
    console.log(await tokenA.symbol(), ":", await tokenB.symbol());
    console.log(await tokenA.name(), ":", await tokenB.name());
    console.log(tokenA.address, tokenB.address);
    console.log(Number(reserves._reserve0) / 10 ** curPair.token0.decimals, ":", Number(reserves._reserve1) / 10 ** curPair.token1.decimals);
    console.log(curPair.token0.decimals, ":", curPair.token1.decimals);
    console.log("");
    pairs.push(curPair);
  }
  fs.writeFileSync("pair.json", JSON.stringify(pairs));
};

const loadPairsFromFile = () => {
  pairs = JSON.parse(fs.readFileSync("pair.json"));
}

const findCircle = async (src) => {
  console.info("Loading trading pairs ...");
  await (src == "file" ? loadPairsFromFile() : loadPairsFromNetwork());
  console.info("Finding Circles ...");
  let addressToSymbol = [];
  let G = [];
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    addressToSymbol[pair.token0.address] = pair.token0.symbol;
    addressToSymbol[pair.token1.address] = pair.token1.symbol;
    if (!G[pair.token0.address]) G[pair.token0.address] = [];
    if (!G[pair.token1.address]) G[pair.token1.address] = [];
    G[pair.token0.address].push({v: pair.token1.address, pairIndex: i});
    G[pair.token1.address].push({v: pair.token0.address, pairIndex: i});
  }
  // console.log(Object.keys(addressToSymbol).length);
  tokens = Object.keys(addressToSymbol);
  // Object.keys(G).forEach(u => {
  //   console.log(addressToSymbol[u]);
  //   console.log(G[u].map(v => addressToSymbol[v]));
  // })
  let vis = [];
  let path = [];
  const dfs = (u, depth) => {
    if (depth > 6) return;
    if (vis[u]) {
      if (u == WSGB && depth > 2) {
        circles.push(path.slice());
      }
      return;
    }
    vis[u] = true;
    for (const e of G[u]) {
      path.push(e.pairIndex);
      dfs(e.v, depth + 1);
      path.pop();
    }
    vis[u] = false;
  };
  dfs(WSGB, 0, -1);
  console.log(circles.length);
}

const init = async () => {
  await findCircle("network");
};

const getAmountOut = (amountIn, A, B) => {
  let amountInWithFee = amountIn.mul(BigNumber.from(997));
  let num = amountInWithFee.mul(B);
  let den = A.mul(BigNumber.from(1000)).add(amountInWithFee);
  return num.div(den);
}

const getReserves = async () => {
  console.log("Fetching reserves for pairs ...");
  for (let pair of pairs) {
    const currentPair = new ethers.Contract(
      pair.address,
      pairABI,
      provider
    );
    pair.reserves = await currentPair.getReserves();
  }
}

const run = async () => {
  await getReserves();
  // 1e18 = 1000000000000000000
  const investAmount = BigNumber.from("500000000000000000000");
  let maxEarning = 0;
  let bestPath = [];
  let tmpPath = [];
  for (const path of circles) {
    let currentAddress = WSGB;
    let balance = investAmount;

    let curPath = [];
    for (const index of path) {
      const pair = pairs[index];
      const revFlag = pair.token0.address == currentAddress;
      curPath.push(currentAddress);
      balance = getAmountOut(
        balance,
        revFlag ? pair.reserves._reserve1 : pair.reserves._reserve0,
        revFlag ? pair.reserves._reserve0 : pair.reserves._reserve1,
      );
      currentAddress = revFlag ? pair.token1.address : pair.token0.address;
    }
    if (balance.gt(maxEarning)) maxEarning = balance, bestPath = curPath.slice(), tmpPath = path.slice();
  }
  console.log(Number(maxEarning) / 10 ** 18);
  console.log(bestPath);
  for (const index of tmpPath) {
    const pair = pairs[index];
    let r0 = pair.reserves._reserve0;
    let r1 = pair.reserves._reserve1;
    console.log(Number(r0) / 10 ** 18);
    console.log(Number(r1) / 10 ** 18);
  }
  let realValue = await uniswapRouter.getAmountsOut(investAmount, bestPath);
  console.log(realValue);
  // console.log(Number(realValue) / 10 ** 18);
  // const tx = uniswapRouter.swapExactTokensForTokens(investAmount, 0, bestPath, )
}

(async() => {
  await init();
  run();
})();
