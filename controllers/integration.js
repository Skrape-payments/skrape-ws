const Transactions = require("../models/transactions");
const Users = require("../models/users");
const statusCodes = require("../status_reponse/statusCode");
const PaymentWallet = require("../models/paymentWallets");
const { checkTransfer, confimMerchantTransaction } = require("./transfer2");
const { createSkrapePaymentWallet } = require("../controllers/wallet2");
// const BalanceHistory = require("../models/balanceHistory");
// const merchantFee = 1;
const moment = require("moment");
require("dotenv").config();
const TRANSACTION_VALIDITY = 50;
const MINIMUM_TRANSFER_AMOUNT = 10;
// const io = require("socket.io-client");
// eslint-disable-next-line no-undef
// const URL = process.env.PORT || "3005";
// const socket = io(`http://localhost:${URL}`);
// const { Increase_tx_count } = require("../helpers/increase_tx_count");
const { serverSocket } = require("../controllers/socket");
const socket = serverSocket;
const merchantTokensImages = [
  {
    name: "Tether coin",
    symbol: "usdt",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether-logo.png?1598003707",
  },
  {
    name: "USD coin",
    symbol: "usdc",
    image: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042389",
  },
  {
    name: "BInance USD coin",
    symbol: "busd",
    image: "https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png?1547034615",
  },
];
const networkList = [
  {
    name: "binance",
    image: "https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png?1547034615",
  },
  {
    name: "mainnet",
    image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png?1595348880",
  },
  {
    name: "polygon",
    image: "https://assets.coingecko.com/coins/images/4713/large/matic___polygon.jpg?1616489452",
  },
  {
    name: "testnet",
    image: "https://assets.coingecko.com/coins/images/4713/large/matic___polygon.jpg?1616489452",
  },
];
const randomString = (length) => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
module.exports.validateApiKey = async (req, res) => {
  try {
    const { api_key } = req.query;
    if (!api_key) return res.status(200).json({ message: "Api key is required", statusCode: statusCodes.BAD_REQUEST, status: false });
    const user = await Users.findOne({ $or: [{ test: api_key }, { live: api_key }] });
    if (!user) return res.status(200).json({ message: "Api key is invalid", statusCode: statusCodes.NOT_FOUND, status: false });
    const supportedWallet = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const data = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      logo: user.logo,
      businessName: user.businessName,
      is_live: user.is_live,
      wallet: supportedWallet.map((wallet) => {
        return {
          name: wallet.tokenSlug,
          symbol: wallet.name,
          network: wallet.network,
        };
      }),
      networks: networkList,
    };
    const uniqueTokenNames = [...data.wallet.reduce((map, obj) => map.set(obj.symbol, obj), new Map()).values()].map((key) => key.symbol);
    const tokens = uniqueTokenNames.map((token) => {
      const coin = merchantTokensImages.filter((item) => item.symbol === token);
      return {
        name: coin[0].name,
        image: coin[0].image,
        symbol: coin[0].symbol,
      };
    });

    data.tokens = tokens;
    data.wallet = undefined;
    console.log(data);
    return res.status(200).json({ data, message: "Merchant found", statusCode: statusCodes.SUCCESS, status: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error", statusCode: statusCodes.INTERNAL_SERVER_ERROR, status: false });
  }
};
module.exports.getMerchantDetailsFromApiKey = async (req, res) => {
  try {
    const { tx_ref } = req.query;
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ message: "Transaction not found", statusCode: statusCodes.NOT_FOUND, status: false });
    const user = await Users.findOne({ _id: transaction.merchant.id });
    if (!user) return res.status(404).json({ message: "Merchant not found", statusCode: statusCodes.NOT_FOUND, status: false });
    console.log(user.testPortfolioWallet);
    const userSupportedTokens = user.portfolioWallet.map((wallet) => {
      return {
        symbol: wallet.name,
        name: wallet.tokenSlug,
        network: wallet.network,
      };
    });
    const data = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      id: user._id,
      logo: user.logo,
      supportedToken: user.is_live
        ? userSupportedTokens
        : user.testPortfolioWallet.map((wallet) => {
            return {
              symbol: wallet.name,
              name: wallet.tokenSlug,
              network: wallet.network,
            };
          }),
    };
    const message = `Merchant details received successfully ${user.is_live ? "!" : "(test mode)"}`;
    return res.status(200).json({ status: true, message, data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error", statusCode: statusCodes.INTERNAL_SERVER_ERROR, status: false });
  }
};

module.exports.initialiseTransaction = async (req, res, next) => {
  try {
    let { amount, tx_ref, customization, callback_url, customer, api_key } = req.body;
    console.log(req.body);
    if (!amount || !customization || !customer || !api_key) return res.status(400).json({ status: false, message: "All fields are required" });
    if (!customer) customer = {};
    if (!customer.first_name || !customer.last_name || !customer.email)
      return res.status(400).json({
        message: `The following fields are required from the customers object: first_name, last_name, email`,
        status: false,
      });
    if (!customer.email.includes("@"))
      return res.status(400).json({
        message: `The email address provided is invalid`,
        status: false,
      });

    if (amount < MINIMUM_TRANSFER_AMOUNT)
      return res.status(400).json({
        message: `The minimum amount allowed for a transfer is ${MINIMUM_TRANSFER_AMOUNT}`,
        status: false,
      });
    if (!customization) customization = {};
    if (!customization.title || !customization.description) {
      return res.status(400).json({ message: `The following fields are required from the customization object: title, description`, status: statusCodes.BAD_REQUEST });
    }
    //   amount must be a number
    if (isNaN(amount)) return res.status(400).json({ status: false, message: "Amount must be a number" });
    // if amount is a string
    if (typeof amount === "string") amount = parseInt(amount);
    if (amount < MINIMUM_TRANSFER_AMOUNT) return res.status(400).json({ message: `Minimum transfer amount is ${MINIMUM_TRANSFER_AMOUNT}`, status: false, statusCode: statusCodes.BAD_REQUEST });
    const user = await Users.findOne({ $or: [{ test: api_key }, { live: api_key }] });
    if (!user) return res.status(404).json({ message: "User not found", statusCode: statusCodes.NOT_FOUND, status: false });
    //   check if user is live and if api key is live
    if (user.is_live && api_key === user.test) return res.status(400).json({ message: "You are live, use live api key", statusCode: statusCodes.BAD_REQUEST, status: false });
    if (!user.is_live && api_key === user.live) return res.status(400).json({ message: "You are not live, use test api key", statusCode: statusCodes.BAD_REQUEST, status: false });
    //   generate tx_ref if not provided
    if (!tx_ref) tx_ref = randomString(10);
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    // let feeAmount;
    // const txFee = (1 / 100) * amount;
    // let toAmount = 0;
    // if (txFee < 1) {
    //   feeAmount = 1;
    //   toAmount = amount - 1;
    // } else {
    //   feeAmount = txFee;
    //   toAmount = amount - txFee;
    // }
    // console.log(amount + feeAmount, amount, feeAmount);
    let fee;
    if (amount >= 100) {
      fee = amount * 0.01;
    } else {
      fee = 1;
    }

    console.log(fee);
    const Transaction = await Transactions.create({
      merchant: {
        email: user.email,
        fName: user.firstName,
        lName: user.lastName,
        id: user._id,
        logo: user.logo,
      },
      amount,
      debt: amount + fee,
      fee: fee,
      customization,
      settled_amount: 0,
      customer: customer,
      tx_ref: "3r-int" + tx_ref,
      ip,
      status: "pending",
      mode: user.is_live ? "live" : "test",
      callback_url,
      initTime: Date.now(),
    });
    if (!Transaction) return res.status(500).json({ message: "Error initialising transaction", statusCode: statusCodes.SERVER_ERROR, status: false });
    Transaction.merchant.id = undefined;
    console.log(Transaction);
    return res.status(200).json({ message: `Transaction initialised successfully, please compelete the transaction within ${TRANSACTION_VALIDITY} minutes`, statusCode: statusCodes.SUCCESS, data: Transaction, status: true });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

const generatePaymentWallet = async (user, networkName) => {
  try {
    const userId = user._id;

    const { address, qrc, index } = await createSkrapePaymentWallet(networkName);
    const paymentWallet = new PaymentWallet({
      index,
      address,
      qrCode: qrc,
      merchant: userId,
    });
    await paymentWallet.save();
    const data = { address, qrCode: qrc, index };
    console.table(data);
    return data;
  } catch (err) {
    console.log(err);
    return null;
  }
};
module.exports.generatePayWalletAddress = async (req, res, next) => {
  try {
    const { networkName, tokenName, tx_ref } = req.body;
    if (!networkName || !tokenName || !tx_ref) return res.status(400).json({ status: false, message: `All fields are required [networkName] [tokenName] [tx_ref]` });
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ status: false, message: `Transaction with tx_ref ${tx_ref} not found` });

    if (transaction.status.toLowerCase() !== "pending") return res.status(400).json({ status: false, message: "Transaction is not pending" });
    const user = await Users.findOne({ _id: transaction.merchant.id });
    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    const token = user.is_live
      ? user.portfolioWallet.find((wallet) => wallet.name.toLowerCase() === tokenName.toLowerCase() && wallet.network.toLowerCase() === networkName.toLowerCase())
      : user.testPortfolioWallet.find((wallet) => wallet.name.toLowerCase() === tokenName.toLowerCase() && wallet.network.toLowerCase() === networkName.toLowerCase());
    if (!token) return res.status(400).json({ status: false, message: `Token ${tokenName} on the ${networkName} network is not supported by merchant` });
    console.log("token", token);
    console.log(networkName);
    const createPayWallet = await generatePaymentWallet(user, networkName);
    // update transaction with pay wallet address
    if (createPayWallet) {
      transaction.pay_wallet_index = createPayWallet.index;
      transaction.address = createPayWallet.address;
      transaction.qrCode = createPayWallet.qrCode;
      transaction.network_name = networkName;
      transaction.token_name = tokenName;
      transaction.status = "pending";
      transaction.payout = {
        address: token.address,
        network: token.network,
        token: token.tokenSlug,
        symbol: token.name,
        sent: 0,
      };
    }

    const saved = await transaction.save();
    if (!createPayWallet) return res.status(500).json({ status: false, message: "Error generating payment wallet", statusCodes: statusCodes.SERVER_ERROR });
    return res.status(200).json({ status: true, message: "Payment wallet generated successfully", data: createPayWallet, transaction: saved, success: true, statusCode: statusCodes.SUCCESS });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.confirmTransaction = async (req, res, next) => {
  const { tx_ref, socketId } = req.body;
  try {
    socket.emit("incomming-verification", { status: "processing...", socketId });

    if (!tx_ref) return res.status(400).json({ status: false, message: "tx_ref is required" });
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ status: false, message: "Transaction not found" });
    console.log(transaction.status.toLowerCase());
    // check if transaction has token name and network name
    if (!transaction.token_name || !transaction.network_name) return res.status(400).json({ status: false, message: `Transaction is not yet ready for confirmation, please generate payment wallet address` });
    if (transaction.status.toLowerCase() !== "pending") return res.status(400).json({ status: false, message: "Transaction is not pending" });
    const initTime = moment(transaction.createdAt);
    const currentTime = moment();
    const diff = currentTime.diff(initTime, "minutes");
    if (diff > TRANSACTION_VALIDITY) {
      const updateTransaction = await Transactions.findOne({ tx_ref });
      updateTransaction.status = "abandoned";
      const updatedTransaction = await updateTransaction.save();
      return res.status(400).json({ message: "Transaction has expired", data: updatedTransaction, status: false, success: false });
    }
    let { debt, token_name, network_name, merchant, amount } = transaction;
    const { id } = merchant;
    const user = await Users.findById(id);
    if (!user) return res.status(404).json({ status: false, message: "User not found" });
    const tokenName = token_name.toLowerCase();
    // check if user has the token in his portfolio either in test or live mode
    const hasToken = user.is_live
      ? user.portfolioWallet.find((wallet) => wallet.name.toLowerCase() === tokenName && wallet.network.toLowerCase() === network_name.toLowerCase())
      : user.testPortfolioWallet.find((wallet) => wallet.name.toLowerCase() === tokenName && wallet.network.toLowerCase() === network_name.toLowerCase());
    if (!hasToken) return res.status(400).json({ message: "Token or network not supported by merchant", statusCode: statusCodes.BAD_REQUEST });
    const networkName = network_name.toLowerCase();
    // const payWalletIndex = pay_wallet_index;
    const merchantAddress = transaction.payout.address;
    const payAddress = transaction.address;

    socket.emit("incomming-verification", { status: "checking if transfer was made...", socketId });
    const checkTransferStatus = await checkTransfer({ tokenName, networkName, address: payAddress, amount: debt, socketId });
    if (checkTransferStatus) {
      console.log("checkTransferStatus", checkTransferStatus);

      const confirm = await confimMerchantTransaction({ tokenName: tokenName.toLowerCase(), networkName: networkName.toLowerCase(), payAddress, amount, merchantAddress, socketId });
      console.log(confirm);
      if (!confirm) return res.status(400).json({ message: "Transfer has not been completed", status: false, success: false });
      const settled_amount = amount;

      const transacted = {
        status: "completed",
        settled_amount,
        payout: { ...transaction.payout, sent: settled_amount },
      };
      const transactionDone = await Transactions.findOneAndUpdate({ tx_ref }, transacted, { new: true });
      socket.emit("incomming-verification", { status: "Done...", socketId });
      // await Increase_tx_count(id);
      return res.status(200).json({ message: "Transfer completed", data: transactionDone, success: true, status: statusCodes.OK });
    }
    return res.status(400).json({ message: "Transfer has not been completed", status: false, success: false });
  } catch (err) {
    socket.emit("incomming-verification", { status: "Error...", socketId });
    console.log(err);
    next(err);
  }
};
