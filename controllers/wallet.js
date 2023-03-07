const { Wallet, utils } = require("ethers");
const QRCode = require("qrcode");
require("dotenv").config();
const { config } = require("../config/index");
const fs = require("fs");
const { uploadToAzure } = require("../helpers/file_upload");
// eslint-disable-next-line no-undef
const SKRAPE_USER_KEY_PHARSE = process.env.SKRAPE_USER_KEY_PHARSE;
// eslint-disable-next-line no-undef
const SKRAPE_ADMIN_KEY_PHARSE = config.SKRAPE_ADMIN_KEY_PHARSE;
// eslint-disable-next-line no-undef
const SKRAPE_PAYMENT_KEY_PHARSE = process.env.SKRAPE_PAYMENT_KEY_PHARSE;
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

const createSkrapeUserWallet = async (walletIndex) => {
  /**
          @dev this method gets the instance of the scrape user wallet that can recieve funds and make payments to the merchant
          @param {number} req - the index of the wallet in the HD wallet  
          @returns {Wallet} - the instance of the wallet
          @returns {string} - the address of the wallet
          @returns {string} - the private key of the wallet
          @returns {string} - the path to the qr code of the wallet address
  
      */
  //   const walletIndex = req.index;
  const mnemonic = SKRAPE_USER_KEY_PHARSE;
  const hdNode = utils.HDNode.fromMnemonic(mnemonic);
  const address = hdNode.derivePath(`m/44'/60'/0'/0/${walletIndex}`).address;
  const wallet = Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${walletIndex}`);
  //console.log("3");

  const qrc = await createQrcode(address);

  return { wallet, qrc, address };
};

const createSkrapePaymentWallet = async (walletIndex) => {
  /**
          @dev this method gets the instance of the scrape payment wallet that recieves payment on behalf of the merchant
          @param {number} req - the index of the wallet in the HD wallet  
          @returns {Wallet} - the instance of the wallet
          @returns {string} - the address of the wallet
          @returns {string} - the private key of the wallet
          @returns {string} - the path to the qr code of the wallet address
  
      */
  const mnemonic = SKRAPE_PAYMENT_KEY_PHARSE;
  const hdNode = utils.HDNode.fromMnemonic(mnemonic);
  const address = hdNode.derivePath(`m/44'/60'/0'/0/${walletIndex}`).address;
  const wallet = Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${walletIndex}`);
  //console.log("2");

  const qrc = await createQrcode(address);
  return { wallet, address, qrc };
};

const createSkrapeAdminWallet = async (walletIndex) => {
  /**
          @dev this method gets the instance of the scrape admin wallet that holds the payments made ot the merchants
          @param {number} req - the index of the wallet in the HD wallet  
          @returns {Wallet} - the instance of the wallet
          @returns {string} - the address of the wallet
          @returns {string} - the private key of the wallet
          @returns {string} - the path to the qr code of the wallet address
      */

  const mnemonic = SKRAPE_ADMIN_KEY_PHARSE;
  const hdNode = utils.HDNode.fromMnemonic(mnemonic);
  const address = hdNode.derivePath(`m/44'/60'/0'/0/${walletIndex}`).address;
  const wallet = Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${walletIndex}`);
  //console.log("1");
  // const qrc = await createQrcode(address);
  return { wallet, address };
};

// exports
module.exports = {
  createSkrapeUserWallet,
  createSkrapePaymentWallet,
  createSkrapeAdminWallet,
};
