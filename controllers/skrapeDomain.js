const ethers = require("ethers");
const { getParsedEthersError } = require("@enzoferey/ethers-error-parser");
const { NonceManager } = require("@ethersproject/experimental");
require("dotenv").config();
// const minterAbi = require("./constants/minter.json");
const punksAbi = require("./constants/PunksTld.json");
const { createSkrapeUserWallet, createSkrapeAdminWallet } = require("./wallet");
const { config } = require("./transferConfig/config");

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

// const addMinter = async (minterAddress) => {
//   const gasTankWallet = (await createSkrapeAdminWallet(0)).wallet;
//   const { account, provider } = await getGasTank("testnet", gasTankWallet);
//   const punksTld = new ethers.Contract(
//     "0xf801aFa81EE31621364179376a8B508289dFC647",
//     punksAbi,
//     account
//   );
//   const nonceManager = new NonceManager(account);
//   let txCount = await nonceManager.getTransactionCount();
//   const tx = await punksTld.changeMinter(minterAddress, { nonce: txCount++ });
//   await tx.wait();
//   provider.once(tx.hash, (transaction) => {
//     console.log(transaction);
//   });
// };

// TODO: Add a return for if the requested domain already exists or taken by another user
const mintDomain = async (domainName, userWalletIndex) => {
  try {
    const gasTankWallet = (await createSkrapeAdminWallet(0)).wallet;
    const { account, provider } = await getGasTank("testnet", gasTankWallet);
    const nonceManager = new NonceManager(account);
    const { chainId } = await provider.getNetwork();
    const userAddress = (await createSkrapeUserWallet(userWalletIndex)).address;
    console.log(userAddress);
    const iface = new ethers.utils.Interface(punksAbi);
    const data = iface.encodeFunctionData("mint", [domainName, userAddress, account.address]);

    // this is a transaction object
    const trx = {
      to: "0xf801aFa81EE31621364179376a8B508289dFC647",
      from: account.address,
      data: data,
      gasLimit: 1e6,
      chainId: chainId,
      value: 0,
    };

    const tx = await nonceManager.sendTransaction(trx);
    const result = await tx.wait();
    if (result.status === 1) {
      return true;
    }
    return false;
  } catch (error) {
    const parsedError = getParsedEthersError(error);
    console.error(`mint domain error: ${parsedError.errorCode}`);
    console.log(`Error: ${parsedError.context}`);
    return { success: false, message: `Error: ${parsedError.context}` };
  }
};

module.exports = { mintDomain };

// mintDomain(".rose", 5);

// addMinter("0x686E9eAFd5BE687DD2898E1Bb543A87a539001f0");
