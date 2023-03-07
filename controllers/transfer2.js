const ethers = require("ethers");
const { getParsedEthersError } = require("@enzoferey/ethers-error-parser");
const { NonceManager } = require("@ethersproject/experimental");
require("dotenv").config();
const erc20Abi = require("./transferConfig/erc20Abi.json");
const paymentAbi = require("./constants/paymentContract.json");
const { createSkrapeAdminWallet } = require("./wallet");
const { config } = require("./transferConfig/config");
// const io = require("socket.io-client");
// const socket = io("http://localhost:3005");
const { serverSocket } = require("../controllers/socket");
const socket = serverSocket;
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
  if (networkName === "mainnet") {
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

/**
 *
 * @param {string} tokenName the name of the token to be used for the transaction
 * @param {string} networkName the network to be used for the transaction
 * @param {*} account the signer account to be used for the transaction
 * @returns {object} the token contract instance, the token address
 */
const getToken = async (tokenName, networkName) => {
  if (tokenName === "usdt") {
    const { ...address } = await getTokenAddress(networkName);
    console.log(address.usdt);
    const tokenAddress = address.usdt;
    return tokenAddress;
  } else if (tokenName === "busd") {
    const { ...address } = await getTokenAddress(networkName);
    console.log(address.busd);
    const tokenAddress = address.busd;
    return tokenAddress;
  } else if (tokenName === "usdc") {
    const { ...address } = await getTokenAddress(networkName);
    console.log(address.usdc);
    const tokenAddress = address.usdc;
    return tokenAddress;
  }
};

const validateAddress = async (address) => {
  const isValid = ethers.utils.isAddress(address);
  if (isValid) {
    return true;
  } else {
    return false;
  }
};

//helper function to get token balance of an address
const getTokenBalance = async ({ tokenName, networkName, address }) => {
  console.table({ tokenName, networkName, address });
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
// eslint-disable-next-line no-unused-vars
const payAccount = async (paymentWallet, networkName) => {
  const endPoint = await getEndpoint(networkName);
  const provider = new ethers.providers.JsonRpcProvider(endPoint);
  const account = new ethers.Wallet(paymentWallet, provider).connect(provider);
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

/**
 *  @dev this function is used to transfer tokens from the payment wallet to the skrape vault
 * @param {string} tokenName  name of the token to be used for the transaction
 * @param {string} networkName  name of the network to be used for the transaction
 * @param {*} wallet instance of the payment wallet
 * @param {number} amount amount of token to be sent to the merchant and vault for transaction fee
 * @returns string of the transaction hash
 */
const sendToken = async (tokenName, networkName, paymentAddress, amount, merchentAddress) => {
  try {
    const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
    const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);

    const tokenAddress = await getToken(tokenName, networkName);
    const nonceManager = new NonceManager(gasDetails.account);
    const { chainId } = await gasDetails.provider.getNetwork();
    // let formattedTxFee;

    // const txFee = (1 / 100) * amount;
    // if (txFee < 1) {
    //   formattedTxFee = ethers.utils.parseEther("1", "ether");
    // } else {
    //   formattedTxFee = ethers.utils.parseEther(txFee.toString(), "ether");
    // }

    let txFee = 0;
    let formattedTxFee = 0;
    if (amount >= 100) {
      txFee = amount * 0.01;
      formattedTxFee = ethers.utils.parseEther(txFee.toString(), "ether");
    } else {
      txFee = 1;
      formattedTxFee = ethers.utils.parseEther(txFee.toString(), "ether");
    }

    // let fee;
    // let toAmount = 0;
    // if (amountValue >= 100) {
    //   fee = amountValue * 0.01;
    //   toAmount = amountValue - fee;
    // } else {
    //   fee = 1;
    //   toAmount = amountValue - fee;
    // }

    const formattedToAmount = ethers.utils.parseEther((amount + txFee).toString(), "ether");
    console.log("formattedToAmount: ", formattedToAmount);
    // this is the admin wallet that recieves the transaction fee based on the token
    const vault = await getSkrapeVault(tokenName);

    const iface = new ethers.utils.Interface(paymentAbi);
    const data = iface.encodeFunctionData("withdrawToken", [tokenAddress, vault, merchentAddress, formattedToAmount, formattedTxFee]);

    const tx = {
      to: paymentAddress,
      from: gasDetails.account.address,
      data: data,
      chainId: chainId,
      value: 0,
    };

    const trx = await nonceManager.sendTransaction(tx);
    const sent = await trx.wait();

    // const r_merchantAddress = await sent.events[0].args.merchantAddress;
    // const r_amount = await sent.events[0].args.amount;

    if (sent.status === 1) {
      console.log("Token sent successfully", `https://mumbai.polygonscan.com/tx/${sent.transactionHash}`);
      return true;
    }
    return false;
  } catch (error) {
    // console.log(error);
    const parseError = getParsedEthersError(error);
    console.log(`Send Token Transaction failed: ${parseError.errorCode}`);
    console.log(`Error Message: ${parseError.context}`);
    return false;
  }
};

const checkTransfer = async ({ tokenName, networkName, address, amount, socketId }) => {
  console.table({ tokenName, networkName, address, amount, socketId });
  const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
  const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
  const tokenAddress = await getToken(tokenName, networkName);
  console.log(tokenAddress);

  const token = new ethers.Contract(tokenAddress, erc20Abi, gasDetails.provider);
  const balance = await token.balanceOf(address);
  const formattedBalance = ethers.utils.formatUnits(balance, "ether");
  console.log("t: ", formattedBalance);
  if (formattedBalance >= amount) {
    console.log("true, has fund");
    socket.emit("wallet", {
      status: "payment link wallet funded",
      socketId,
      balance: formattedBalance,
    });
    return true;
  } else {
    socket.emit("wallet", {
      status: "payment link wallet not funded",
      socketId,
      balance: formattedBalance,
    });
    console.log("false, wallet empty");
    return false;
  }
};

/**
 * @dev this function is called when funds has been sent to the payment wallet. It does check via the
 * router and sends sufficient gas to the payment wallet for the transfer transaction
 * @param {string} tokenName
 * @param {string} networkName
 * @param {number} payWalletIndex
 * @param {number} amount
 */

const confimMerchantTransaction = async ({ tokenName, networkName, payAddress, amount, merchantAddress, socketId }) => {
  socket.on("connect", () => {
    socket.emit("status-response", { status: "staging", socketId });
  });
  console.table({
    tokenName,
    networkName,
    payAddress,
    amount,
    merchantAddress,
    socketId,
  });
  try {
    socket.emit("status-response", { status: "sending", socketId });
    const sentDeposit = await sendToken(tokenName, networkName, payAddress, amount, merchantAddress);
    if (!sentDeposit) {
      console.log("deposit failed");
      socket.emit("status-response", { status: "failed", socketId });
      return false;
    }
    socket.emit("status-response", { status: "processing", socketId });
    console.table({ sentDeposit });
    if (sentDeposit) {
      socket.emit("status-response", { status: "completed", socketId });
      return true;
    }
    socket.emit("status-response", { status: "failed", socketId });
    return false;
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  confimMerchantTransaction,
  checkTransfer,
  getTokenBalance,
  getTokenAddress,
  validateAddress,
};

// confimMerchantTransaction(
//   "usdt",
//   "testnet",
//   "0xdefbd9344C1e78e93098Ff29F3f44c0Ef128cB4e",
//   200,
//   "0x96e3a46cE3c38AB6a23428B60e3b73FeE8E5013B"
// );
