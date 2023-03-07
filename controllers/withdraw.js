const { ethers } = require("ethers");
const { getParsedEthersError } = require("@enzoferey/ethers-error-parser");
const { NonceManager } = require("@ethersproject/experimental");
require("dotenv").config();
const { createSkrapeAdminWallet } = require("./wallet");
const { config } = require("./transferConfig/config");
const routerAbi = require("./transferConfig/skrapePaymentAbi.json");
// eslint-disable-next-line no-unused-vars
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
  } else {
    new Error("Network not found");
  }
};

const getRouterAddress = async (networkName) => {
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
  } else {
    new Error("Network not found");
  }
};

/**
 *
 * @param {string} tokenName the name of the token to be used for the transaction
 * @param {string} networkName the network to be used for the transaction
 * @param {*} account the signer account to be used for the transaction
 * @returns {object} the token contract instance, the token address
 */
const getToken = async (tokenName, networkName) => {
  if (tokenName === "usdt") {
    const { ...tokenAddress } = await getTokenAddress(networkName);
    const token = tokenAddress.usdt;
    return token;
  } else if (tokenName === "busd") {
    const { ...tokenAddress } = await getTokenAddress(networkName);
    const token = tokenAddress.busd;
    return token;
  } else if (tokenName === "usdc") {
    const { ...tokenAddress } = await getTokenAddress(networkName);
    const token = tokenAddress.usdc;
    return token;
  } else {
    new Error("Token not found");
  }
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
 * @param {string} networkName name of the network to be used for the transaction
 * @param {*} adminGasWallet the admin wallet instance for sendin gas to the payment / user wallet
 * @returns {object} the admin gasTank wallet instance and the admin gasTank wallet provider
 */
const getGasTank = async (networkName, adminGasWallet) => {
  const endPoint = await getEndpoint(networkName);
  const wallet = new ethers.Wallet(adminGasWallet);
  const provider = new ethers.providers.JsonRpcProvider(endPoint);
  const account = wallet.connect(provider);
  return { account, provider };
};

const withdraw = async (address, tokenName, networkName, amount) => {
  try {
    const vaultAddress = await getSkrapeVault(tokenName);
    const gasTankWallet = (await createSkrapeAdminWallet(0)).wallet;
    const { ...gasDetail } = await getGasTank(networkName, gasTankWallet);
    const routerAddress = await getRouterAddress(networkName);
    const tokenAddress = await getToken(tokenName, networkName);
    const nonceManager = new NonceManager(gasDetail.account);
    const iface = new ethers.utils.Interface(routerAbi);
    const { chainId } = await gasDetail.provider.getNetwork();
    const formattedAmount = ethers.utils.parseEther(amount.toString(), "ether");

    let data = iface.encodeFunctionData("sendERC20", [address, vaultAddress, tokenAddress, formattedAmount]);

    const trx = {
      to: routerAddress,
      from: gasDetail.account.address,
      data: data,
      gasLimit: 1e6,
      chainId: chainId,
    };

    const withdrawTx = await nonceManager.sendTransaction(trx);
    const result = await withdrawTx.wait();
    if (result.status === 1) {
      console.log(`withdrawal successful: https://mumbai.polygonscan.com/tx/${withdrawTx.hash}`);
      return true;
    } else {
      console.log(`withdrawal failed: https://mumbai.polygonscan.com/tx/${withdrawTx.hash}`);
      return false;
    }
    // return result;
  } catch (error) {
    console.log(error);
    const parseError = getParsedEthersError(error);
    console.error(`Withdral failed: ${parseError.errorCode}`);
    console.log(`Error: ${parseError.context}`);
    return false;
  }
};

module.exports = { withdraw };

// withdraw(
//   "0x01cDEea72Ea0F33CfFf99a288D2d56d38b21e118",
//   "usdt",
//   "testnet",
//   ethers.utils.parseEther("100")
// );
