const ethers = require("ethers");
const CoinGecko = require("coingecko-api");
require("dotenv").config();
const fs = require("fs");

const routerABI = require("./abis/uniswap-router.json");
const factoryABI = require("./abis/uniswap-factory.json");
const pairABI = require("./abis/uniswap-pair.json");
const erc20ABI = require("./abis/erc20.json");
const { deflateSync } = require("zlib");
const { runInContext } = require("vm");

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
};

const loadPairsFromFile = () => {
  pairs = JSON.parse(fs.readFileSync("pair.json"));
}

const findCircle = async (src) => {
  src == "file" ? loadPairsFromFile() : loadPairsFromNetwork();
  const WSGB = "0x02f0826ef6aD107Cfc861152B32B52fD11BaB9ED";
  let addressToSymbol = [];
  let G = [];
  for (const pair of pairs) {
    addressToSymbol[pair.token0.address] = pair.token0.symbol;
    addressToSymbol[pair.token1.address] = pair.token1.symbol;
    if (!G[pair.token0.address]) G[pair.token0.address] = [];
    if (!G[pair.token1.address]) G[pair.token1.address] = [];
    G[pair.token0.address].push(pair.token1.address);
    G[pair.token1.address].push(pair.token0.address);
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
    path.push(u);
    for (const v of G[u]) dfs(v, depth + 1);
    path.pop(u);
    vis[u] = false;
  };
  dfs(WSGB, 0);
}

const init = async () => {
  findCircle("file");
};

const getReserves = async () => {
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
  getReserves();
}

init();
run();
