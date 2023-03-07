/* eslint-disable no-unused-vars */
const ethers = require("ethers");
const { getParsedEthersError } = require("@enzoferey/ethers-error-parser");
const { NonceManager } = require("@ethersproject/experimental");
require("dotenv").config();
const { createSkrapePaymentWallet, createSkrapeAdminWallet } = require("./wallet");
// const {
//   getRouterAddress,
//   getToken,
//   getTokenBalance,
//   getSkrapeVault,
//   payAccount,
//   getGasTank,
// } = require("./transferHelper");
const { config } = require("./transferConfig/config");
const routerAbi = require("./transferConfig/skrapePaymentAbi.json");
const erc20Abi = require("./transferConfig/erc20Abi.json");
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

const getRouterAddress = (networkName) => {
  if (networkName === "mainnet") {
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
// eslint-disable-next-line no-unused-vars
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

/**
 *
 * @param {string} toAddress address recieving the gas
 * @param {string} networkName name of the network to be used for the transaction
 * @param {string} tokenName name of the token to be used for the transaction
 * @param {*} adminGasWallet instance of the admin wallet for sending gas to the payment / user wallet
 * @param {number} amount amount of gas to be sent to the payment / user wallet
 * @returns string of the transaction hash
 */
const sendGas = async (toAddress, networkName, tokenName, adminGasWallet, amount) => {
  try {
    const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
    const routerAddress = getRouterAddress(networkName);
    const tokenAddress = await getToken(tokenName, networkName, gasDetails.account);
    const { chainId } = await gasDetails.provider.getNetwork();
    const gasAmount = ethers.utils.parseUnits("0.002");
    const iface = new ethers.utils.Interface(routerAbi);
    const data = iface.encodeFunctionData("check", [toAddress, tokenAddress, amount, gasAmount]);
    const nonceManager = new NonceManager(gasDetails.account);
    const trx = {
      to: routerAddress,
      from: gasDetails.account.address,
      data: data,
      gasLimit: 1e6,
      chainId: chainId,
    };

    const checkTx = await nonceManager.sendTransaction(trx);
    const result = await checkTx.wait(2);
    if (result.status === 1) {
      console.log("Gas sent successfully", `https://mumbai.polygonscan.com/tx/${result.transactionHash}`);
      return true;
    }
    return false;
  } catch (error) {
    const parseError = getParsedEthersError(error);
    console.log(`Gas Transaction failed: ${parseError.errorCode}`);
    console.log(`Error Message: ${parseError.context}`);
    return false;
  }
};

/**
 *  @dev this function is used to transfer tokens from the payment wallet to the skrape vault
 * @param {string} tokenName  name of the token to be used for the transaction
 * @param {string} networkName  name of the network to be used for the transaction
 * @param {*} wallet instance of the payment wallet
 * @param {number} amount amount of token to be sent to the merchant and vault for transaction fee
 * @returns string of the transaction hash
 */
const sendToken = async (tokenName, networkName, wallet, amount, merchentAddress) => {
  try {
    const { ...payDetails } = await payAccount(wallet, networkName);
    const tokenAddress = await getToken(tokenName, networkName, payDetails.account);
    const nonceManager = new NonceManager(payDetails.account);
    const routerAddress = getRouterAddress(networkName);
    const { chainId } = await payDetails.provider.getNetwork();
    const router = new ethers.Contract(routerAddress, routerAbi, payDetails.account);

    let formattedTxFee;
    const txFee = (1 / 100) * amount;
    const toAmount = amount - txFee;

    if (txFee < 1) {
      formattedTxFee = ethers.utils.parseEther("1", "ether");
    } else {
      formattedTxFee = ethers.utils.parseEther(txFee.toString(), "ether");
    }
    const formattedToAmount = ethers.utils.parseEther(toAmount.toString(), "ether");
    // this is the admin wallet that recieves the transaction fee based on the token
    const vault = await getSkrapeVault(tokenName);

    // const iface = new ethers.utils.Interface(routerAbi);
    // const data = iface.encodeFunctionData("handleTransfer", [
    //   merchentAddress,
    //   vault,
    //   tokenDetails.tokenAddress,
    //   formattedToAmount,
    //   formattedTxFee,
    // ]);

    // const trx = {
    //   from: await payDetails.account.address,
    //   to: routerAddress,
    //   data: data,
    //   chainId: chainId,
    //   gasLimit: 1e6,
    //   value: 0,
    // };

    // const tx = await nonceManager.sendTransaction(trx);

    console.log("Token Address:", tokenAddress);

    const token = new ethers.Contract(tokenAddress, erc20Abi, payDetails.account);

    //this should be changed to use the router to enable the transfer of transaction fee
    const sendTxFee = await token.transfer(vault, formattedTxFee, {
      gasLimit: 1e6,
    });
    await sendTxFee.wait();

    const sendToken = await token.transfer(merchentAddress, formattedToAmount, {
      gasLimit: 1e6,
    });

    // const sendToken = await router.handleTransfer(
    //   merchentAddress,
    //   vault,
    //   tokenDetails.tokenAddress,
    //   formattedToAmount,
    //   formattedTxFee,
    //   { gasLimit: 1e6 }
    // );

    const sent = await sendToken.wait(2);

    if (sent.status === 1) {
      console.log("Token sent successfully", `https://mumbai.polygonscan.com/tx/${sendToken.transactionHash}`);
      return true;
    }
    return false;
  } catch (error) {
    console.log(error);
    const parseError = getParsedEthersError(error);
    console.log(`Send Token Transaction failed: ${parseError.errorCode}`);
    console.log(`Error Message: ${parseError.context}`);
    return false;
  }
};

const refundUnused = async (paymentWallet, adminGasWallet, networkName) => {
  const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
  const { ...paymentDetails } = await payAccount(paymentWallet, networkName);
  const nonceManager = new NonceManager(paymentDetails.account);
  const { chainId } = await gasDetails.provider.getNetwork();

  const balance = await gasDetails.provider.getBalance(paymentDetails.account.address);
  // format balance
  const formattedBalance = ethers.utils.formatUnits(balance, "ether");
  console.log("balance", formattedBalance);
  const gas = ethers.utils.parseUnits("5", "gwei") * 21000;
  // convert gas to exponential
  //const gasExponential = ethers.utils.formatUnits(gas, "wei");
  const value = balance - gas;

  // convert value to exponential
  //console.log("gas", gas.toString());
  const trx = {
    value: value,
    gasPrice: ethers.utils.parseUnits("5", "gwei"),
    gasLimit: 21000,
    chainId: chainId,
    from: await paymentDetails.account.address,
    to: await gasDetails.account.address,
  };

  const tx = await nonceManager.sendTransaction(trx);
  const send = await tx.wait(2);
  if (send.status === 1) {
    console.log("refund successful");
    console.log(`https://mumbai.polygonscan.com/tx/${tx.hash}`);
    return true;
  } else {
    console.log("refund failed");
    return false;
  }
};

// /**
//  * @dev this function is called when a user funds their skrape wallet and send the funded token to the skrape vault
//  * @param {string} tokenName name of the token to be used for the transaction
//  * @param {string} networkName name of the network to be used for the transaction
//  * @param {*} Wallet instance of the user wallet
//  * @param {number} amount amount of token to be sent to the skrape vault
//  * @returns  string of the transaction hash
//  */
// const depositToken = async (tokenName, networkName, wallet, amount) => {
//   try {
//     const iface = new ethers.utils.Interface(erc20Abi);
//     const { ...userDetails } = await userAccount(wallet, networkName);
//     const { chainId } = await userDetails.provider.getNetwork();
//     const vault = await getSkrapeVault(tokenName);
//     const nonceManager = new NonceManager(userDetails.account);
//     const { ...tokenDetails } = await getToken(
//       tokenName,
//       networkName,
//       userDetails.account
//     );
//     const formattedAmount = ethers.utils.parseEther(amount.toString(), "ether");
//     const data = iface.encodeFunctionData("transfer", [vault, formattedAmount]);

//     const trx = {
//       to: tokenDetails.tokenAddress,
//       from: userDetails.account.address,
//       data: data,
//       gasLimit: 1e6,
//       chainId: chainId,
//     };

//     const sendTokenTx = await nonceManager.sendTransaction(trx);

//     const result = await sendTokenTx.wait();
//     if (result.status === 1) {
//       return true;
//     }
//     return false;
//   } catch (error) {
//     const parseError = getParsedEthersError(error);
//     console.log(`deposit Token Transaction failed: ${parseError.errorCode}`);
//     console.log(`Error: ${parseError.context}`);
//     return false;
//   }
// };

//This function checks that the gas got to the payment address before calling the withdraw function
const checkGasTrasfer = async (networkName, address) => {
  const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
  const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
  const balance = await gasDetails.provider.getBalance(address);
  const formattedBalance = ethers.utils.formatUnits(balance, "ether");
  console.log("t: ", formattedBalance);
  if (formattedBalance >= 0.002) {
    console.log("true");
    return true;
  } else {
    console.log("false");
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

const confimMerchantTransaction = async (tokenName, networkName, payWalletIndex, amount, merchantAddress, socketId) => {
  socket.on("connect", () => {
    socket.emit("status-response", { status: "staging", socketId });
  });
  console.table({
    tokenName,
    networkName,
    payWalletIndex,
    amount,
    merchantAddress,
  });
  try {
    const payWallet = (await createSkrapePaymentWallet(payWalletIndex)).wallet;
    const payAddress = (await createSkrapePaymentWallet(payWalletIndex)).address;
    const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
    const sentGas = await sendGas(payAddress, networkName, tokenName, adminGasWallet, amount);
    if (!sentGas) {
      console.log("Transaction failed");
      socket.emit("status-response", { status: "failed", socketId });
      return false;
    }
    socket.emit("status-response", { status: "processing", socketId });
    console.log("sentGas");
    const sentDeposit = await sendToken(tokenName, networkName, payWallet, amount, merchantAddress);
    if (!sentDeposit) {
      console.log("deposit failed");
      socket.emit("status-response", { status: "failed", socketId });
      return false;
    }
    console.log("sentDeposit");
    socket.emit("status-response", { status: "processing", socketId });
    const refunded = await refundUnused(payWallet, adminGasWallet, networkName);
    console.table({ sentGas, sentDeposit, refunded });
    if (sentGas && sentDeposit && refunded) {
      socket.emit("status-response", { status: "sending", socketId });
      socket.emit("status-response", { status: "completed", socketId });
      return true;
    }
    return false;
  } catch (error) {
    console.log(error);
  }
};

// /**
//  * @dev this function is called when a user funds their wallet. It does check via the
//  * router and sends sufficient gas to the user wallet for the transfer transaction
//  * @param {string} tokenName name of the token to be used for the transaction
//  * @param {string} networkName name of the network to be used for the transaction
//  * @param {number} userWalletIndex  instance of the user wallet
//  * @param {number} amount amount of token funded to the user wallet
//  */
// const confimUserTransaction = async (
//   tokenName,
//   networkName,
//   userWalletIndex,
//   amount
// ) => {
//   try {
//     const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
//     const userWallet = (await createSkrapeUserWallet(userWalletIndex)).wallet;
//     const userAddress = (await createSkrapeUserWallet(userWalletIndex)).address;
//     const sentGas = await sendGas(
//       userAddress,
//       networkName,
//       tokenName,
//       adminGasWallet,
//       amount
//     );
//     const sentDeposit = await depositToken(
//       tokenName,
//       networkName,
//       userWallet,
//       amount
//     );
//     console.table({ sentGas, sentDeposit });
//     if (sentGas && sentDeposit) {
//       return true;
//     }
//     return false;
//   } catch (error) {
//     console.log(error);
//   }
// };

module.exports = {
  confimMerchantTransaction,
  // confimUserTransaction,
  checkTransfer,
  getTokenBalance,
  getTokenAddress,
};

// confimMerchantTransaction(
//   "usdt",
//   "testnet",
//   18,
//   100,
//   "0x96e3a46cE3c38AB6a23428B60e3b73FeE8E5013B"
// );
//confimUserTransaction("usdt", "testnet", 4, ethers.utils.parseEther("100"));
// checkTransfer(
//   "usdt",
//   "testnet",
//   "0xab4c841df73c8d48c59c691e47d5f03cabe26c2f",
//   100
// );
