const ethers = require("ethers");
// const { getParsedEthersError } = require("@enzoferey/ethers-error-parser");
const { NonceManager } = require("@ethersproject/experimental");
require("dotenv").config();
const QRCode = require("qrcode");
const fs = require("fs");
const { uploadToAzure } = require("../helpers/file_upload");
const factoryAbi = require("./constants/paymentContractFactory.json");
const { config } = require("./transferConfig/config");
const { createSkrapeAdminWallet } = require("./wallet");

const getFactroyAddress = (networkName) => {
  if (networkName === "mainnet") {
    const factroyAddress = config.network.mainnet.paymentContractFactory;
    return factroyAddress;
  } else if (networkName === "testnet") {
    const factroyAddress = config.network.testnet.paymentContractFactory;
    return factroyAddress;
  } else if (networkName === "binance") {
    const factroyAddress = config.network.binance.paymentContractFactory;
    return factroyAddress;
  } else if (networkName === "polygon") {
    const factroyAddress = config.network.polygon.paymentContractFactory;
    return factroyAddress;
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

const createQrcode = async (address) => {
  /**
         @dev this method creates a qr code of the wallet address
        @param {string} address - the address of the wallet
        @returns {string} - the path to the qr code of the wallet address
    */
  const qrCode = await QRCode.toDataURL(address);
  const base64Data = qrCode.replace(/^data:image\/png;base64,/, "");
  // make directory if it does not exist
  if (!fs.existsSync("./qrCodes")) {
    fs.mkdirSync("./qrCodes");
  }
  const path = `./qrCodes/${address}.png`;
  fs.writeFileSync(path, base64Data, "base64");
  const container = "wallet-qr-codes";
  const { url } = await uploadToAzure(path, container);
  return url;
};

const createSkrapePaymentWallet = async (networkName) => {
  console.log(networkName);
  const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
  console.log("admin", adminGasWallet);
  const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
  const { chainId } = await gasDetails.provider.getNetwork();
  const factoryAddress = getFactroyAddress(networkName);

  const factoryContract = new ethers.Contract(factoryAddress, factoryAbi, gasDetails.provider);

  const addressId = await factoryContract.paymentAddressCounter();
  // fizx big number issue
  const formatedAddressId = ethers.BigNumber.from(addressId).toString();

  const iface = new ethers.utils.Interface(factoryAbi);
  const data = iface.encodeFunctionData("createPaymentWallet", [formatedAddressId]);

  const nonceManager = new NonceManager(gasDetails.account);
  const tx = {
    to: factoryAddress,
    from: gasDetails.account.address,
    data: data,
    gasLimit: 1e6,
    chainId: chainId,
  };

  const walletTx = await nonceManager.sendTransaction(tx);
  await walletTx.wait();

  const paymentAddress = await factoryContract.getPaymentAddress(formatedAddressId);
  const qrCodeUrl = await createQrcode(paymentAddress);
  console.table({ payAddress: paymentAddress, addressId: formatedAddressId, qrCodeUrl });

  return { address: paymentAddress, index: formatedAddressId, qrc: qrCodeUrl };
};

// createSkrapePaymentWallet("testnet");

// eslint-disable-next-line no-unused-vars
const walletListener = async (networkName) => {
  const adminGasWallet = (await createSkrapeAdminWallet(0)).wallet;
  const { ...gasDetails } = await getGasTank(networkName, adminGasWallet);
  const factoryAddress = getFactroyAddress(networkName);

  const contract = new ethers.Contract(factoryAddress, factoryAbi, gasDetails.provider);

  contract.on("NewPaymentAddress", (paymentAddress, addressId, event) => {
    console.log(paymentAddress, addressId, event);
  });
};

module.exports = {
  createSkrapePaymentWallet,
  createSkrapeAdminWallet,
};

// createSkrapePaymentWallet("testnet");
//eventlst("testnet");
