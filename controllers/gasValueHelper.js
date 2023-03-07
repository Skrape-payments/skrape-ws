const axios = require("axios");
require("dotenv").config();
const { ethers } = require("ethers");
const { config } = require("./transferConfig/config");
const transactionGas = config.transactionGas;

const getEndpoint = async (networkName) => {
  if (networkName === "mainnet") {
    const endpoint = config.network.mainnet.nodeEndpoint;
    const symbol = "eth";
    return { endpoint, symbol };
  } else if (networkName === "testnet") {
    const endpoint = config.network.testnet.nodeEndpoint;
    return endpoint;
  } else if (networkName === "binance") {
    const endpoint = config.network.binance.nodeEndpoint;
    const symbol = "bnb";
    return { endpoint, symbol };
  } else if (networkName === "polygon") {
    const endpoint = config.network.polygon.nodeEndpoint;
    const symbol = "matic";
    return { endpoint, symbol };
  }
};

const coinListUrl = `https://api.coingecko.com/api/v3/coins/list`;
const coinUrl = "https://api.coingecko.com/api/v3/coins";

async function getCoinId(symbol) {
  const headers = {
    Accept: "application/json text/plain */*",
  };
  try {
    const response = await axios.get(coinListUrl, { headers: headers });
    const coinlist = response.data;
    const coin = coinlist.find((coin) => coin.symbol === symbol);
    console.log(coin.id);
    return coin.id;
  } catch (error) {
    console.log(error);
  }
}

const getCoinPrice = async (id) => {
  console.log(id);
  const url = `${coinUrl}/${id}`;
  const headers = {
    Accept: "application/json text/plain */*",
  };
  try {
    const response = await axios.get(url, { headers: headers });
    const coinPrice = response.data.market_data.current_price.usd;
    console.log(coinPrice);
    return coinPrice;
  } catch (error) {
    console.error("error message::", error.response.data.error);
  }
};

async function getGasPrice(networkName) {
  const { endpoint } = await getEndpoint(networkName);
  const provider = new ethers.providers.JsonRpcProvider(endpoint);
  try {
    const gasPrice = await provider.getGasPrice("latest");
    const gasPriceInEth = ethers.utils.formatEther(gasPrice);
    console.log(`Current gas price: ${gasPriceInEth.toString()}`);
    return gasPriceInEth;
  } catch (error) {
    console.error(error);
  }
}

const getGasValue = async (networkName) => {
  try {
    const { symbol } = await getEndpoint(networkName);
    const coinId = await getCoinId(symbol);
    console.log(`coin id, gas price: ${coinId}`);
    const gasPrice = await getGasPrice(networkName);
    console.log(networkName);
    const coinPrice = await getCoinPrice(coinId);
    const gasValue = transactionGas * gasPrice;

    const gasValueInUsd = gasValue * coinPrice;
    console.table({ gasValue, coinPrice, gasValueInUsd });
    return gasValueInUsd;
  } catch (error) {
    console.error(error);
  }
};

getGasValue("binance");
module.exports = {
  getGasValue,
};

//getGasValue("polygon");
