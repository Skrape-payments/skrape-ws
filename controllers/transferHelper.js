const ethers = require("ethers");
require("dotenv").config();
const { createSkrapeAdminWallet } = require("./wallet");
const { config } = require("./transferConfig/config");
const erc20Abi = require("./transferConfig/erc20Abi.json");

/**
 *
 * @param {string} networkName The network name to be used for the transaction
 * @returns {object} The token address for the network, the skrape router address and the node endpoint
 */
const getTokenAddress = async (networkName) => {
  if (networkName === "mainnet") {
    const usdt = config.network.mainnet.tokenAddress.usdt;
    const busd = config.network.mainnet.tokenAddress.busd;
    const usdc = config.network.mainnet.tokenAddress.usdc;
    return { usdt, busd, usdc };
  } else if (networkName === "polygon") {
    const usdt = config.network.polygon.tokenAddress.usdt;
    const busd = config.network.polygon.tokenAddress.busd;
    const usdc = config.network.polygon.tokenAddress.usdc;
    return { usdt, busd, usdc };
  } else if (networkName === "binance") {
    const usdt = config.network.binance.tokenAddress.usdt;
    const busd = config.network.binance.tokenAddress.busd;
    const usdc = config.network.binance.tokenAddress.usdc;
    return { usdt, busd, usdc };
  } else if (networkName === "testnet") {
    const usdt = config.network.testnet.tokenAddress.usdt;
    const busd = config.network.testnet.tokenAddress.busd;
    const usdc = config.network.testnet.tokenAddress.usdc;
    return { usdt, busd, usdc };
  } else {
    new Error("Network not found");
  }
};

const getEndpoint = async (networkName) => {
  if (networkName === "mannet") {
    const endPoint = config.network.mainnet.nodeEndpoint;
    return endPoint;
  } else if (networkName === "testnet") {
    const endpoint = config.network.testnet.nodeEndpoint;
    return endpoint;
  } else if (networkName === "binance") {
    const endpoint = config.network.binance.nodeEndpoint;
    return endpoint;
  } else if (networkName === "polygon") {
    const endpoint = config.network.polygon.nodeEndpoint;
    return endpoint;
  }
};

const getRouterAddress = (networkName) => {
  if (networkName === "mannet") {
    const routerAddress = config.network.mainnet.skrapePaymentRouterAddress;
    return routerAddress;
  } else if (networkName === "testnet") {
    const routerAddress = config.network.testnet.skrapePaymentRouterAddress;
    return routerAddress;
  } else if (networkName === "binance") {
    const routerAddress = config.network.binance.skrapePaymentRouterAddress;
    return routerAddress;
  } else if (networkName === "polygon") {
    const routerAddress = config.network.polygon.skrapePaymentRouterAddress;
    return routerAddress;
  }
};

/**
 *
 * @param {string} tokenName the name of the token to be used for the transaction
 * @param {string} networkName the network to be used for the transaction
 * @param {*} account the signer account to be used for the transaction
 * @returns {object} the token contract instance, the token address
 */
const getToken = async (tokenName, networkName, account) => {
  if (tokenName === "usdt") {
    const { ...tokenAddress } = await getTokenAddress(networkName);
    const token = new ethers.Contract(tokenAddress.usdt, erc20Abi, account);
    return { token, tokenAddress: tokenAddress.usdt };
  } else if (tokenName === "busd") {
    const { ...tokenAddress } = await getTokenAddress(networkName);
    const token = new ethers.Contract(tokenAddress.busd, erc20Abi, account);
    return { token, tokenAddress: tokenAddress.busd };
  } else if (tokenName === "usdc") {
    const { ...tokenAddress } = await getTokenAddress(networkName);
    const token = new ethers.Contract(tokenAddress.usdc, erc20Abi, account);
    return { token, tokenAddress: tokenAddress.usdc };
  }
};

//helper function to get token balance of an address
const getTokenBalance = async ({ tokenName, networkName, address }) => {
  const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
  const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
  const { ...tokenDetails } = await getToken(tokenName, networkName, gasDetails.account);

  const token = new ethers.Contract(tokenDetails.tokenAddress, erc20Abi, gasDetails.provider);
  const balance = await token.balanceOf(address);
  const formattedBalance = ethers.utils.formatUnits(balance, "ether");
  console.log("t: ", formattedBalance);
  return formattedBalance;
};

/**
 *
 * @param {string} tokenName
 * @returns the admin vault address where the token will be sent to
 */
const getSkrapeVault = async (tokenName) => {
  if (tokenName === "usdt") {
    const vaultAddress = config.skrapeVault.usdt;
    return vaultAddress;
  } else if (tokenName === "busd") {
    const vaultAddress = config.skrapeVault.busd;
    return vaultAddress;
  } else if (tokenName === "usdc") {
    const vaultAddress = config.skrapeVault.usdc;
    return vaultAddress;
  } else {
    console.error("Token not found");
  }
};

/**
 *
 * @param {*} paymentWallet instance of the payment wallet
 * @param {string} networkName the network to be used for the transaction
 * @param {string} payAddress the address of the payment wallet
 * @returns {object} the payment wallet instance and the payment wallet address and the payment wallet provider
 */
const payAccount = async (paymentWallet, networkName) => {
  const endPoint = await getEndpoint(networkName);
  const provider = new ethers.providers.JsonRpcProvider(endPoint);
  const account = new ethers.Wallet(paymentWallet, provider).connect(provider);
  return { account, provider };
};

/**
 *
 * @param {*} userWallet instance of the user wallet
 * @param {string} networkName the network to be used for the transaction
 * @param {string} userAddress address of the user wallet
 * @returns {object} the user wallet instance and the user wallet address and the user wallet provider
 */
const userAccount = async (userWallet, networkName) => {
  const endPoint = await getEndpoint(networkName);
  const provider = new ethers.providers.JsonRpcProvider(endPoint);
  const account = new ethers.Wallet(userWallet, provider).connect(provider);
  return { account, provider };
};

/**
 *
 * @param {string} networkName name of the network to be used for the transaction
 * @param {*} adminGasWallet the admin wallet instance for sendin gas to the payment / user wallet
 * @returns {object} the admin gasTank wallet instance and the admin gasTank wallet provider
 */
const getGasTank = async (networkName, adminGasWallet) => {
  const endpoint = await getEndpoint(networkName);
  const wallet = new ethers.Wallet(adminGasWallet);
  const provider = new ethers.providers.JsonRpcProvider(endpoint);
  const account = wallet.connect(provider);
  return { account, provider };
};

module.exports = {
  getTokenAddress,
  getEndpoint,
  getRouterAddress,
  getToken,
  getTokenBalance,
  getSkrapeVault,
  payAccount,
  userAccount,
  getGasTank,
};
