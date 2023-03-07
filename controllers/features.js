/* eslint-disable max-len */
const Users = require("../models/users");
const ethers = require("ethers");
const paymentLinks = require("../models/paymentLinks");
require("dotenv").config();
const generateQRcode = require("../helpers/generateQRcode");
const PaymentWallet = require("../models/paymentWallets");
const { createSkrapePaymentWallet } = require("../controllers/wallet2");
const Transactions = require("../models/transactions");
const { confimUserTransaction } = require("./transfer");
const { checkTransfer, confimMerchantTransaction, validateAddress } = require("./transfer2");
const statusCodes = require("../status_reponse/statusCode");
const { withdraw } = require("../controllers/withdraw");
const withdrawHistory = require("../models/withdrawHistory");
const BalanceHistory = require("../models/balanceHistory");
const Skrape2SkrapeTransactions = require("../models/s2sTransactions");
// const { getGasValue } = require("./gasValueHelper");
const bcrypt = require("bcryptjs");
const moment = require("moment");
// const exp = 2;
const axios = require("axios");
const SwapHistory = require("../models/swapHistory");
const FundHistory = require("../models/fundHistory");
const WaitList = require("../models/waitList");
const transactionValidity = 5;
const MINIMUM_TRANSFER_AMOUNT = 10;
// const { socketCaller } = require("../bin/www");
// const { Increase_tx_count } = require("../helpers/increase_tx_count");

// const io = require("socket.io-client");
// const socket = io("http://localhost:3005");
// const withdrawFee = 0.8;
// const socket = socketCaller;
const { serverSocket } = require("../controllers/socket");
const socket = serverSocket;
socket.emit("test-socket", "socket tested working from server");
socket.on("test-socket-response", (data) => {
  console.log(data);
});
const randomString = (length) => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
module.exports = { randomString };

module.exports.createPaymentLink_host = async (req, res, next) => {
  try {
    // create payment link for merchant
    const userId = req._id;
    let { link_name, description, amount, redirect_url, webhook_url } = req.body;
    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found", status: statusCodes.NOT_FOUND });
    let flexible_amount = false;
    if (amount == 0) flexible_amount = true;
    // get the base url
    const baseUrl = "www.skrape.io";
    const base_url = baseUrl;
    const randomID = randomString(10);
    const generatedPaymentLink = `${base_url}/payment/${randomID}`;
    const { hostedUrl } = await generateQRcode(generatedPaymentLink, userId);
    console.log(hostedUrl);
    console.log("generatedPaymentLink", generatedPaymentLink);
    const paymentLink = await paymentLinks.create({
      link_id: randomID,
      owner: userId,
      link_name,
      description,
      amount,
      redirect_url,
      webhook_url,
      flexible_amount,
      paymentLink: generatedPaymentLink,
      paymentLinkQR: hostedUrl.url,
    });
    console.log(paymentLink._id);
    return res.status(201).json({ message: "Payment link created successfully", paymentLink, status: statusCodes.CREATED });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ message: messages, status: statusCodes.BAD_REQUEST });
    }
    console.log(err);
    next(err);
  }
};

module.exports.getPaymentLinks = async (req, res) => {
  try {
    const userId = req._id;
    const link_id = req.query.link_id || null;
    console.log(link_id);
    if (!userId) return res.status(401).json({ message: "Unauthorized", status: statusCodes.UNAUTHORIZED, success: false });
    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found", status: statusCodes.NOT_FOUND, success: false });
    // sort payment link in decending order
    if (link_id) {
      const paymentLink = await paymentLinks.find({ owner: userId, link_id }).sort({ createdAt: -1 });
      return res.status(200).json({ message: "Payment link data fetched successfully", paymentLink, status: statusCodes.OK, success: true });
    }
    const paymentLink = await paymentLinks.find({ owner: userId }).sort({ createdAt: -1 });
    return res.status(200).json({ message: "Payment links fetched successfully", paymentLink, status: statusCodes.OK, success: true });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ message: messages, status: statusCodes.BAD_REQUEST, success: false });
    }
  }
};
module.exports.getPaymentLinkData = async (req, res) => {
  try {
    const link_id = req.query.link_id || null;
    console.log(link_id);
    if (!link_id) {
      const paymentLink = await paymentLinks.find().sort({ createdAt: -1 });
      if (!paymentLink) return res.status(404).json({ message: "Payment links not found", status: statusCodes.NOT_FOUND, success: false });
      return res.status(200).json({ message: "Payment links fetched successfully", paymentLink, status: statusCodes.OK, success: true });
    }
    const paymentLink = await paymentLinks.findOne({ link_id });
    const user = await Users.findById(paymentLink.owner);
    const data = {
      firstName: user.firstName,
      lastName: user.lastName,
      logo: user.logo,
    };
    console.log("not found");
    if (!paymentLink) return res.status(404).json({ message: "Payment link not found", status: statusCodes.NOT_FOUND, success: false });
    console.log("found");
    return res.status(200).json({ message: "Payment link data fetched successfully", paymentLink, merchant: data, status: statusCodes.OK, success: true });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({ message: messages, status: statusCodes.BAD_REQUEST, success: false });
    }
  }
};

module.exports.setLinkStatus = async (req, res, next) => {
  try {
    const { active } = req.body;
    const paymentLink = await paymentLinks.findById(req.params.id);
    if (!paymentLink) return res.status(404).json({ message: "Payment link not found", status: statusCodes.NOT_FOUND });
    // update payment link status
    paymentLink.active = active;
    await paymentLink.save();
    return res.status(200).json({ message: "Payment link status updated successfully", paymentLink, status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};

module.exports.deletePaymentLink = async (req, res, next) => {
  try {
    const paymentLink = await paymentLinks.findById(req.params.id);
    if (!paymentLink) return res.status(404).json({ message: "Payment link not found", status: statusCodes.NOT_FOUND });
    await paymentLink.remove();
    return res.status(200).json({ message: "Payment link deleted successfully", status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};

// this is for only payment link addres generation not for third party integration
module.exports.generatePaymentWallet = async (req, res, next) => {
  try {
    const { link_id, networkName } = req.query;
    console.log(link_id, networkName);
    if (!networkName) return res.status(400).json({ message: "Network name is required", status: statusCodes.BAD_REQUEST });
    if (!link_id) return res.status(400).json({ message: "Payment link id is required", status: statusCodes.BAD_REQUEST });
    const paymentLink = await paymentLinks.findOne({ link_id });
    if (!paymentLink) return res.status(404).json({ message: "Payment link not found", status: statusCodes.NOT_FOUND });
    const id = paymentLink.owner;
    console.log("id", id);
    const user = await Users.findById(id);
    if (!user) return res.status(404).json({ message: "User not found", status: statusCodes.NOT_FOUND });
    const userId = user._id;
    const { address, qrc, index } = await createSkrapePaymentWallet(networkName);
    const paymentWallet = new PaymentWallet({
      index,
      address,
      qrCode: qrc,
      merchant: userId,
    });
    const result = await paymentWallet.save();
    const list = ["mainnet", "binance", "polygon", "testnet"];
    const data = { ...result._doc, networks: list };
    return res.status(201).json({ message: "Payment wallet created successfully", data, success: true, status: statusCodes.CREATED });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

const PAYMENT_TIMEOUT = 50;

module.exports.proceedToPayment = async (req, res, next) => {
  try {
    const { tokenName, networkName, address } = req.body;
    const { tx_ref } = req.query;
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ message: `Transaction with reference ${tx_ref} not found`, status: statusCodes.NOT_FOUND, success: false });
    if (transaction.status.toLowerCase() !== "initialized") return res.status(400).json({ message: "Transaction is not in initialized state", status: statusCodes.BAD_REQUEST, success: false });
    const owner = transaction.merchant.id;
    const user = await Users.findById(owner);
    if (!user) return res.status(404).json({ message: "The merchant with this address doesn't exist", status: statusCodes.NOT_FOUND, success: false });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const existingTokenNameInArray = portfolio.find((token) => token.name.toUpperCase() === tokenName.toUpperCase());

    if (!existingTokenNameInArray) return res.status(404).json({ message: `${tokenName} not found in ${user.is_live ? "live" : "test"} portfolio`, status: statusCodes.NOT_FOUND, success: false });
    const findPaymentWallet = await PaymentWallet.findOne({ address: address });
    if (!findPaymentWallet) return res.status(404).json({ message: "Payment wallet not found", status: statusCodes.NOT_FOUND, success: false });
    // const payWalletIndex = findPaymentWallet.index;
    console.log(existingTokenNameInArray);
    const updateTransaction = await Transactions.findOneAndUpdate({ tx_ref }, { status: "pending", network_name: networkName, address, token_name: tokenName }, { new: true });
    // get the time left for the transaction to be completed
    const initTime = moment(updateTransaction.createdAt);
    const currentTime = moment();
    const diff = currentTime.diff(initTime, "minutes");
    const timeLeft = PAYMENT_TIMEOUT - diff;
    return res.status(200).json({ message: `Transaction with reference ${tx_ref} is now pending`, status: statusCodes.OK, success: true, timeLeft });
  } catch (err) {
    next(err);
  }
};
// Create a provider object

module.exports.checkTransferStatusOnBlockChain = async (req, res, next) => {
  try {
    const { tx_ref, socketId } = req.body;
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ message: `Transaction with reference ${tx_ref} not found`, status: statusCodes.NOT_FOUND, success: false });
    const { address, debt } = transaction;
    const provider = new ethers.providers.JsonRpcBatchProvider();
    const walletAddress = address;
    const currentBalance = await provider.getBalance(walletAddress);
    console.log(currentBalance);
    if (currentBalance >= debt) {
      return socket.emit("checking-transfer", { status: "success", socketId, currentBalance });
    }
    return socket.emit("checking-transfer", { status: "unsuccessful", socketId, currentBalance });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.verifyMerchantTransfer = async (req, res, next) => {
  try {
    let { tx_ref, socketId } = req.body;
    socket.emit("incomming-verification", { status: "processing...", socketId });

    // get the owner of the transaction
    const transactionRefOwner = await Transactions.findOne({ tx_ref });
    if (!transactionRefOwner) return res.status(404).json({ message: `Transaction with reference ${tx_ref} not found`, status: statusCodes.NOT_FOUND, success: false });
    // if init time is greater than 5 minutes with moment
    const initTime = moment(transactionRefOwner.createdAt);
    const currentTime = moment();
    const diff = currentTime.diff(initTime, "minutes");
    if (diff > PAYMENT_TIMEOUT) {
      const updateTransaction = await Transactions.findOne({ tx_ref });
      updateTransaction.status = "abandoned";
      const updatedTransaction = await updateTransaction.save();
      return res.status(400).json({ message: "Transaction has expired", data: updatedTransaction, status: statusCodes.BAD_REQUEST, success: false });
    }
    if (transactionRefOwner.status.toLowerCase() !== "pending") return res.status(400).json({ message: "Transaction is not in pending state", status: statusCodes.BAD_REQUEST, success: false });
    if (transactionRefOwner.status.toLowerCase() == "abandoned") return res.status(200).json({ message: "transaction already abandoned", status: statusCodes.CONFLICT, success: false });
    if (transactionRefOwner.status.toLowerCase() == "completed") return res.status(200).json({ message: "transaction already completed", status: statusCodes.CONFLICT, success: false });
    // console.log(transactionRefOwner);
    const tokenName = transactionRefOwner.token_name;
    const networkName = transactionRefOwner.network_name;
    const amount = transactionRefOwner.debt ? transactionRefOwner.debt : transactionRefOwner.amount + transactionRefOwner.fee;
    const address = transactionRefOwner.address;

    const owner = transactionRefOwner.merchant.id;
    const user = await Users.findById(owner);
    if (!user) return res.status(404).json({ message: "The merchant with this address doesn't exist", status: statusCodes.NOT_FOUND, success: false });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const existingTokenNameInArray = portfolio.find((token) => token.name.toUpperCase() === tokenName.toUpperCase());

    if (!existingTokenNameInArray) return res.status(404).json({ message: `${tokenName} not found in ${user.is_live ? "live" : "test"} portfolio`, status: statusCodes.NOT_FOUND, success: false });
    const findPaymentWallet = await PaymentWallet.findOne({ address: address });
    if (!findPaymentWallet) return res.status(404).json({ message: "Payment wallet not found", status: statusCodes.NOT_FOUND, success: false });
    const payAddress = findPaymentWallet.address;
    const payWalletIndex = findPaymentWallet.index;

    // console.log(existingTokenNameInArray);

    socket.emit("incomming-verification", { status: "checking if transfer was made...", socketId });

    const checkTransferStatus = await checkTransfer({ tokenName, networkName, address, amount, socketId });

    if (checkTransferStatus) {
      const amount = parseInt(transactionRefOwner.amount);
      const payoutAddress = existingTokenNameInArray.address;
      console.log("amount:>", amount);

      const confirm = await confimMerchantTransaction({ tokenName: tokenName.toLowerCase(), networkName: networkName.toLowerCase(), payAddress, amount, merchantAddress: payoutAddress, socketId });
      if (!confirm) return res.status(400).json({ message: "Transfer has not been completed", status: statusCodes.BAD_REQUEST, success: false });
      const transacted = {
        status: "completed",
        pay_wallet_index: payWalletIndex,
        settled_amount: transactionRefOwner.amount,
        payout: {
          sent: transactionRefOwner.amount,
          address: payoutAddress,
          network: existingTokenNameInArray.network,
          token: existingTokenNameInArray.tokenSlug,
          symbol: existingTokenNameInArray.name,
        },
      };
      const transaction = await Transactions.findOneAndUpdate({ tx_ref }, transacted, { new: true });
      // await Increase_tx_count(owner);
      return res.status(200).json({ message: "Transfer completed", data: transaction, success: true, status: statusCodes.OK });
    }
    return res.status(200).json({ message: "Transaction is still pending!", success: false, status: statusCodes.OK });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};
module.exports.cancelTransaction = async (req, res, next) => {
  try {
    const { tx_ref } = req.body;
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ message: "Transaction not found", status: statusCodes.NOT_FOUND, success: false });
    if (transaction.status.toLowerCase() == "completed") return res.status(400).json({ message: "Transaction already completed", status: statusCodes.BAD_REQUEST, success: false });
    if (transaction.status.toLowerCase() == "abandoned") return res.status(400).json({ message: "Transaction already abandoned", status: statusCodes.BAD_REQUEST, success: false });
    if (transaction.status.toLowerCase() == "cancelled") return res.status(400).json({ message: "Transaction already cancelled", status: statusCodes.BAD_REQUEST, success: false });
    transaction.status = "cancelled";
    const updatedTransaction = await transaction.save();
    return res.status(200).json({ message: "Transaction cancelled", data: updatedTransaction, status: statusCodes.OK, success: true });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};
module.exports.initFromPaymentLink = async (req, res, next) => {
  try {
    let { link_id, amount, customer } = req.body;
    const tx_ref = randomString(10);
    const tx = await Transactions.findOne({ tx_ref });
    if (tx) return res.status(400).json({ message: "Transaction reference already exists", status: false });
    const userRef = await paymentLinks.findOne({ link_id });
    const user = await Users.findById(userRef.owner);
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    // const merchantFee = 1;
    let amountValue = userRef.amount > 0 ? userRef.amount : amount;
    amountValue = parseFloat(amountValue);
    if (amountValue < MINIMUM_TRANSFER_AMOUNT) return res.status(400).json({ message: `Minimum transfer amount is ${MINIMUM_TRANSFER_AMOUNT}`, status: statusCodes.BAD_REQUEST, success: false });
    // let feeAmount = ((merchantFee / 100) * amountValue).toFixed(decimal);
    // let feeAmount = 0;
    // const txFee = (1 / 100) * amountValue;
    // let toAmount = 0;
    // if (txFee < 1) {
    //   feeAmount = 1;
    //   toAmount = amountValue - 1;
    // } else {
    //   feeAmount = txFee;
    //   toAmount = amountValue - txFee;
    // }

    let fee;
    if (amountValue >= 100) {
      fee = amountValue * 0.01;
    } else {
      fee = 1;
    }

    console.log(fee);

    const transaction = await Transactions.create({
      merchant: {
        email: user.email,
        fName: user.firstName,
        lName: user.lastName,
        id: user._id,
        logo: user.logo,
      },
      amount: amountValue,
      debt: amountValue + fee,
      fee: fee,
      customization: {
        title: userRef.link_name,
        description: userRef.description,
        logo: user.logo,
      },
      settled_amount: 0,
      callback_url: userRef.webhook_url,
      customer: customer,
      tx_ref: "lnk" + tx_ref,
      ip,
      status: "initialized",
      qrCode: userRef.paymentLinkQR,
      mode: user.is_live ? "live" : "test",
      initTime: Date.now(),
    });
    return res.status(200).json({ message: `Transaction initialized successfully, please complete transaction within ${transactionValidity} mins(s) `, data: transaction, status: true });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
// client api key
module.exports.submitCustomer = async (req, res, next) => {
  let { customer, amount, tx_ref } = req.body;
  let payAmount = parseInt(amount);
  try {
    // check if tx_ref is unique
    const tx = await Transactions.findOne({ tx_ref });
    if (!tx) return res.status(400).json({ message: "Transaction reference doesn't exists", status: false });
    if (tx.amount == 0) payAmount = parseInt(amount);
    if (customer.email === undefined || customer.email === null || customer.email === "") {
      return res.status(400).json({ message: "Customer email is required", status: false });
    }
    if (customer.first_name === undefined || customer.first_name === null || customer.first_name === "") {
      return res.status(400).json({ message: "Customer first name is required", status: false });
    }
    if (customer.last_name === undefined || customer.last_name === null || customer.last_name === "") {
      return res.status(400).json({ message: "Customer last name is required", status: false });
    }
    if (customer.phone_number === undefined || customer.phone_number === null || customer.phone_number === "") {
      return res.status(400).json({ message: "Customer phone number is required", status: false });
    }
    if (payAmount === undefined || payAmount === null || payAmount === "") {
      return res.status(400).json({ message: "Amount is required", status: false });
    }
    // update Transactions customer
    const updatedTransaction = await Transactions.findOneAndUpdate({ tx_ref }, { customer, amount: payAmount }, { new: true });
    return res.status(201).json({ message: "Transaction initialized successfully", success: true, data: updatedTransaction, status: statusCodes.CREATED });
  } catch (err) {
    next(err);
  }
};
// get all transactions for a merchant
module.exports.getMerchantTransactions = async (req, res, next) => {
  try {
    const merchant = req._id;
    // get the transactions whose merchant.id is equal to the merchant id
    const transactions = await Transactions.find({ "merchant.id": merchant });
    console.log(transactions);
    if (!transactions) return res.status(404).json({ message: "No transaction found", success: false, status: statusCodes.NOT_FOUND });
    if (transactions.length === 0) return res.status(404).json({ message: "No transaction found", success: false, status: statusCodes.NOT_FOUND });
    return res.status(200).json({ message: "Transactions found", success: true, data: transactions, status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};

module.exports.fetchMerchantTransactionsForChart = async (req, res, next) => {
  try {
    const merchant = req._id;
    // query transactions based on createdAt from the frontend charts request
    // const { startDate, endDate } = req.body;
    const { startDate, endDate } = req.query;
    const transactions = await Transactions.find({ merchant: merchant.id, createdAt: { $gte: startDate, $lte: endDate } });
    if (!transactions) return res.status(404).json({ message: "No transaction found", success: false, status: statusCodes.NOT_FOUND });
    const chart = transactions.map((transaction) => {
      return {
        date: transaction.createdAt,
        amount: transaction.amount,
        status: transaction.status,
        tokenName: transaction.token_name,
        networkName: transaction.network_name,
        type: transaction.type,
        mode: transaction.mode,
      };
    });
    return res.status(200).json({ message: "Transactions found", success: true, data: chart, status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};

module.exports.withdrawToken = async (req, res, next) => {
  try {
    let { address, tokenName, networkName, amount, pin } = req.body;
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "Merchant not found", success: false, status: statusCodes.NOT_FOUND });
    if (!user.hasPin) return res.status(400).json({ message: "You have not set a pin", success: false, requirePin: true, status: statusCodes.BAD_GATEWAY });
    const verifyPin = await bcrypt.compareSync(pin, user.pin);

    if (!verifyPin) return res.status(400).json({ message: "Invalid pin", success: false, status: statusCodes.BAD_REQUEST });
    // check if merchant has enough balance to withdraw
    const balance = user.portfolioWallet[tokenName.toUpperCase()];
    console.log(balance);
    if (!balance) return res.status(400).json({ message: "You do not have such token in portfolio", success: false, status: statusCodes.BAD_REQUEST });
    // 1 percent fee
    const fee = 0.8;
    console.log("fee", amount + fee);
    if (balance < amount) return res.status(400).json({ message: "Insufficient balance", success: false, status: statusCodes.BAD_REQUEST });
    amount = amount - fee;
    console.log(amount);
    const withdrawFunds = await withdraw(address, tokenName, networkName, amount);
    const newBalance = balance - (amount + fee);
    if (withdrawFunds) {
      // update portfolio balance
      const previousPortfolioBalance = user.portfolioWallet;
      const newPortfolioBalance = { ...previousPortfolioBalance, [tokenName.toUpperCase()]: newBalance };
      console.log(newPortfolioBalance);
      const updatedUser = await Users.findByIdAndUpdate(merchant, { portfolioWallet: newPortfolioBalance }, { new: true });
      updatedUser.password = undefined;
      updatedUser.twoFactor = undefined;
      updatedUser.test = undefined;
      updatedUser.live = undefined;
      updatedUser.pin = undefined;
      amount = amount + fee;
      const history = { merchant, amount, address, tokenName, networkName, status: "success" };
      const withdraw_History = await withdrawHistory.create(history);
      return res.status(200).json({ message: "Withdrawal successful", success: true, data: updatedUser, withdraw_History, status: statusCodes.OK });
    }
    const history = { merchant, amount, address, tokenName, networkName, status: "failed" };
    const withdraw_History = await withdrawHistory.create(history);
    return res.status(400).json({ message: "Withdrawal failed", success: false, withdraw_History, status: statusCodes.BAD_REQUEST });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.getWithdrawHistory = async (req, res, next) => {
  try {
    const merchant = req._id;
    const history = await withdrawHistory.find({ merchant });
    if (!history) return res.status(404).json({ message: "No withdraw history found", success: false, status: statusCodes.NOT_FOUND });
    return res.status(200).json({ message: "Withdraw history found", success: true, data: history, status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};
module.exports.getMerchantBalance = async (req, res, next) => {
  try {
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "Merchant not found", success: false, status: statusCodes.NOT_FOUND });
    const balance = user.wallet;
    return res.status(200).json({ message: "Merchant balance found", success: true, data: balance, status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};
// still in progress
module.exports.getBalanceHistory = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from === undefined || from === null || from === "") {
      return res.status(400).json({ message: "From date is required", success: false, status: statusCodes.BAD_REQUEST });
    }
    // convert from and to to date
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const merchant = req._id;
    const history = await BalanceHistory.find({ merchant, createdAt: { $gte: fromDate, $lte: toDate } });
    if (!history) return res.status(404).json({ message: "No balance history found", success: false, status: statusCodes.NOT_FOUND });
    // const sampleData = [
    //   { date: "2020-01-01", balance: 100 },
    //   { date: "2020-01-02", balance: 200 },
    //   { date: "2020-01-03", balance: 300 },
    //   { date: "2020-01-04", balance: 400 },
    //   { date: "2020-01-05", balance: 500 },
    // ];
    const data = history.map((item) => {
      return { date: item.createdAt, balance: item.newBalance };
    });
    return res.status(200).json({ message: "Balance history found", success: true, data, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.setupMerchantPin = async (req, res, next) => {
  const merchant = req._id;
  const user = req._user;
  const { pin } = req.body;
  // if pin is not a string
  if (typeof pin !== "string") return res.status(400).json({ message: "Pin must be a string", hasPin: false, success: false, status: statusCodes.BAD_REQUEST });
  if (pin.length !== 6) return res.status(400).json({ message: "Pin must be 6 digits", success: false, hasPin: false, status: statusCodes.BAD_REQUEST });
  const hashedPin = await bcrypt.hash(pin, 8);
  // check if user has pin already
  if (user.hasPin) return res.status(400).json({ message: "You already have pin setup on your account", hasPin: true, success: false, status: statusCodes.BAD_REQUEST });
  Promise.all([Users.findOneAndUpdate({ _id: merchant }, { hasPin: true, pin: hashedPin }, { new: true }), Users.findOne({ _id: merchant })])
    .then((data) => {
      let [userWithPin, userNewPin] = data;
      console.log(userWithPin);
      userNewPin.password = undefined;
      userNewPin.pin = undefined;
      return res.status(200).json({ msg: "Pin created", success: true, data: userNewPin, hasPin: true, status: statusCodes.OK });
    })
    .catch((err) => next(err));
};
module.exports.verifyMerchantPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    // const merchant = req._id;
    const user = req._user;
    const isCorrectPin = await bcrypt.compare(pin, user.pin);
    if (!isCorrectPin) return res.status(400).json({ message: "Incorrect pin", success: false, status: statusCodes.BAD_REQUEST });
    return res.status(200).json({ message: "Correct pin", success: true, status: statusCodes.OK });
  } catch (err) {
    next(err);
  }
};
module.exports.getDomainOwner = async (req, res, next) => {
  try {
    const { domain } = req.query;
    const user = await Users.findOne({ identifier: domain });
    if (!user) return res.status(404).json({ message: "domain owner not found", success: false, status: statusCodes.NOT_FOUND });
    const { email, identifier, firstName, lastName } = user;
    const data = { email, identifier, firstName, lastName };
    return res.status(200).json({ message: "domain owner found", success: true, data, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
// skrape to skrape features
module.exports.initialize_S2S_Transfer = async (req, res, next) => {
  try {
    const merchant = req._id;
    let { to, amount, narration, tokenName } = req.body;
    amount = parseFloat(amount);
    const sender = await Users.findById(merchant);
    if (!sender) return res.status(404).json({ message: "sender does not exist", success: false, status: statusCodes.NOT_FOUND });
    if (sender.identifier === to) return res.status(400).json({ message: "You cannot transfer to yourself", success: false, status: statusCodes.BAD_REQUEST });
    if (!sender.hasPin) return res.status(200).json({ message: "You need to setup pin on your account", requirePin: true, success: true, status: statusCodes.OK });
    const senderPortfolioBalance = sender.portfolioWallet[tokenName];
    if (amount == 0) return res.status(400).json({ message: "Amount cannot be zero", success: false, status: statusCodes.BAD_REQUEST });
    if (senderPortfolioBalance < amount) return res.status(400).json({ message: `Insufficient balance ${senderPortfolioBalance} available`, success: false, status: statusCodes.BAD_REQUEST });
    const receiver = await Users.findOne({ $or: [{ identifier: to }, { email: to }] });
    if (!receiver) return res.status(404).json({ message: "receiver does not exist", success: false, status: statusCodes.NOT_FOUND });
    const tx_ref = randomString(10);
    const initializedTransfer = await Skrape2SkrapeTransactions.create({ from: merchant, to: receiver._id, amount, narration, tx_ref, tokenName });
    if (!initializedTransfer) return res.status(500).json({ message: "Transfer could not be initialized", success: false, status: statusCodes.INTERNAL_SERVER_ERROR });
    return res.status(200).json({ message: "Transfer initialized", success: true, data: initializedTransfer, requirePin: false, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.confirm_S2S_Transfer = async (req, res, next) => {
  try {
    const { tx_ref, pin } = req.body;
    // const merchant = req._id;
    // check if the transaction exists
    const transaction = await Skrape2SkrapeTransactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ message: "Transaction not found", success: false, status: statusCodes.NOT_FOUND });
    if (transaction.status.toLowerCase() !== "pending") return res.status(400).json({ message: "Transaction is not pending", success: false, status: statusCodes.BAD_REQUEST });
    const sender = await Users.findById(transaction.from);
    if (!sender) return res.status(404).json({ message: "sender does not exist", success: false, status: statusCodes.NOT_FOUND });
    const isCorrectPin = await bcrypt.compare(pin, sender.pin);
    if (!isCorrectPin) return res.status(400).json({ message: "Incorrect pin", success: false, status: statusCodes.BAD_REQUEST });
    // check if the sender has enough balance in their portfolioWallet of the token
    const senderPortfolioBalance = sender.portfolioWallet[transaction.tokenName];
    // if the balance is less than the amount to be sent
    if (senderPortfolioBalance < transaction.amount) return res.status(400).json({ message: `Insufficient balance ${senderPortfolioBalance.balance} available`, success: false, status: statusCodes.BAD_REQUEST });
    // check if the receiver exists

    const receiver = await Users.findById(transaction.to);
    if (!receiver) return res.status(404).json({ message: "receiver does not exist", success: false, status: statusCodes.NOT_FOUND });
    // update the sender portfolioWallet and the receiver portfolioWallet
    sender.portfolioWallet[transaction.tokenName] -= transaction.amount;
    receiver.portfolioWallet[transaction.tokenName] += transaction.amount;
    // update the sender and receiver
    const updatedSender = await Users.findByIdAndUpdate(sender._id, { portfolioWallet: sender.portfolioWallet }, { new: true });
    const updatedReceiver = await Users.findByIdAndUpdate(receiver._id, { portfolioWallet: receiver.portfolioWallet }, { new: true });
    const updatedUsers = { updatedSender, updatedReceiver };
    // update the transaction status
    const updatedTransaction = await Skrape2SkrapeTransactions.findOneAndUpdate({ tx_ref }, { status: "completed", authorized: true }, { new: true });
    return res.status(200).json({ message: "Transfer completed", success: true, data: updatedTransaction, updatedUsers, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getPortfolioBalance = async (req, res, next) => {
  try {
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "user does not exist", success: false, status: statusCodes.NOT_FOUND });
    const { portfolioWallet } = user;
    return res.status(200).json({ message: "Portfolio balance", success: true, data: portfolioWallet, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.get_S2_history = async (req, res, next) => {
  try {
    const merchant = req._id;
    const history = await Skrape2SkrapeTransactions.find({ $or: [{ from: merchant }, { receiver: merchant }] });
    if (!history) return res.status(404).json({ message: "No history found", success: false, status: statusCodes.NOT_FOUND });
    const data = history.map((item) => {
      return { date: item.createdAt, amount: item.amount, status: item.status, narration: item.narration, tx_ref: item.tx_ref };
    });
    return res.status(200).json({ message: "History found", success: true, data, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getMerchantData = async (req, res, next) => {
  try {
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const data = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      wallet: user.wallet,
      identifier: user.identifier,
      phone: user.phone,
      accountType: user.accountType,
    };
    return res.status(200).json({ message: "User found", success: true, data, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getS2STransactionStatus = async (req, res, next) => {
  const { tx_ref } = req.query;
  try {
    const transaction = await Skrape2SkrapeTransactions.findOne({ tx_ref });
    if (!transaction) return res.status(404).json({ message: "Transaction does not exist", success: false, status: statusCodes.NOT_FOUND });
    return res.status(200).json({ message: "Transaction found", success: true, data: transaction, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.swapTokens = async (req, res, next) => {
  try {
    const merchant = req._id;
    const { from, amount, to } = req.body;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    if (from === to) return res.status(400).json({ message: "Cannot swap same token", success: false, status: statusCodes.BAD_REQUEST });
    const { portfolioWallet } = user;
    const fromBalance = portfolioWallet[from];
    console.log(fromBalance);
    // check if the from and to exist in the portfolioWallet
    if (fromBalance == null || fromBalance == undefined) return res.status(400).json({ message: "Input Token not found in portfolio balance", success: false, status: statusCodes.BAD_REQUEST });
    const toBalance = portfolioWallet[to];
    console.log(toBalance);
    if (toBalance == null || toBalance == undefined) return res.status(400).json({ message: "Output Token not found in portfolio balance", success: false, status: statusCodes.BAD_REQUEST });
    if (fromBalance < amount) return res.status(400).json({ message: "Insufficient balance", success: false, status: statusCodes.BAD_REQUEST });
    const rate = await getRate(from, to);
    const newFromBalance = fromBalance - amount;
    const newToBalance = toBalance + amount * rate;
    portfolioWallet[from] = newFromBalance;
    portfolioWallet[to] = newToBalance;
    const updatedUser = await Users.findByIdAndUpdate(merchant, { portfolioWallet }, { new: true });
    const tx_ref = randomString(10);
    const data = {
      from: from,
      to: to,
      amount: amount,
      rate: rate,
      tx_ref: tx_ref,
      user: updatedUser._id,
    };
    const swap = await SwapHistory.create(data);
    return res.status(200).json({ message: "Swap successful", success: true, data: updatedUser.portfolioWallet, swap, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getExchangeRate = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rate = await getRate(from, to);
    return res.status(200).json({ message: "Rate found", success: true, data: rate, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
const getRate = async (from, to) => {
  try {
    const response = await axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest", {
      headers: {
        "X-CMC_PRO_API_KEY": "ca8e6b1e-ac96-4ee9-a7a4-fc19debb7df1",
      },
    });
    const json = response.data;
    const from_token = json.data.filter((item) => item.symbol === from)[0].quote.USD.price;
    const to_token = json.data.filter((item) => item.symbol === to)[0].quote.USD.price;
    const rate = to_token / from_token;
    return rate;
  } catch (error) {
    console.log(error);
    return error;
  }
};
module.exports.getSwapHistory = async (req, res, next) => {
  const merchant = req._id;
  try {
    const reqTxRef = req.query.tx_ref || null;
    if (reqTxRef) {
      const swap = await SwapHistory.findOne({ tx_ref: reqTxRef });
      if (!swap) return res.status(404).json({ message: "Swap not found", success: false, status: statusCodes.NOT_FOUND });
      return res.status(200).json({ message: "Swap found", success: true, data: swap, status: statusCodes.OK });
    }
    const swaps = await SwapHistory.find({ user: merchant });
    if (!swaps) return res.status(404).json({ message: "Swap not found", success: false, status: statusCodes.NOT_FOUND });
    return res.status(200).json({ message: "Swap found", success: true, data: swaps, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getTransferDesc = async (req, res, next) => {
  try {
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const s2sHistory = await Skrape2SkrapeTransactions.find({ to: merchant }).exec();
    const from = s2sHistory.map((item) => item.from);
    const sender = await Users.findById(from);
    const creditHistory = s2sHistory.map((item) => {
      return {
        firstName: sender.firstName,
        lastName: sender.lastName,
        amount: item.amount,
        date: moment(item.createdAt).format("DD-MM-YYYY"),
        time: moment(item.createdAt).format("hh:mm:ss"),
        tokenName: item.tokenName,
      };
    });
    const normalTransaction = await Transactions.find({ "merchant.id": merchant }).exec();
    const [customerArray] = normalTransaction.map((item) => item.customer);
    const creditHistory2 = normalTransaction.map((item) => {
      return {
        firstN_ame: customerArray.first_name,
        last_Name: customerArray.last_name,
        amount: item.amount,
        date: moment(item.createdAt).format("DD-MM-YYYY"),
        time: moment(item.createdAt).format("hh:mm:ss"),
        tokenName: item.token_name,
      };
    });
    const creditHistory3 = [...creditHistory, ...creditHistory2];
    // sort by date and time in descending order
    const sortedCreditHistory = creditHistory3.sort((a, b) => {
      return new Date(b.date + " " + b.time) - new Date(a.date + " " + a.time);
    });
    return res.status(200).json({ message: "Credit history found", success: true, data: sortedCreditHistory, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.initFundingPortfolio = async (req, res, next) => {
  const { tokenName, amount, networkName } = req.body;
  const merchant = req._id;
  try {
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const userWalletIndex = user.index;
    const tx_ref = randomString(10);
    const newFundHistory = new FundHistory({
      tokenName: tokenName,
      amount: amount,
      networkName: networkName,
      merchant: merchant,
      type: "funding",
      status: "pending",
      address: user.wallet.address,
      qrCode: user.wallet.qrCode,
      userIndex: userWalletIndex,
      txRef: tx_ref,
    });
    const fundHistory = await newFundHistory.save();
    return res.status(200).json({ message: "Funding initiated", success: true, data: fundHistory, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.verifyPortfolioFunding = async (req, res, next) => {
  try {
    const { txRef } = req.body;
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const fundTransaction = await FundHistory.findOne({ txRef: txRef });
    if (!fundTransaction) return res.status(404).json({ message: "Fund transaction not found", success: false, status: statusCodes.NOT_FOUND });
    if (fundTransaction.status !== "pending") return res.status(400).json({ message: "Transaction not pending", success: false, status: statusCodes.BAD_REQUEST });
    const { portfolioWallet } = user;
    const { tokenName, address, amount, networkName } = fundTransaction;
    const userWalletIndex = user.index;
    const fundPortfolio = await checkTransfer(tokenName, networkName, address, amount);
    if (!fundPortfolio) return res.status(400).json({ message: "wallet hasn't been funded", funded: false, success: false, transaction: fundTransaction, status: statusCodes.BAD_REQUEST });
    const confirmTransaction = await confimUserTransaction(tokenName, networkName, userWalletIndex, amount);
    if (!confirmTransaction) return res.status(400).json({ message: "wallet hasn't been funded", funded: false, success: false, transaction: fundTransaction, status: statusCodes.BAD_REQUEST });
    const upperCaseToken = tokenName.toUpperCase();
    const newTokenBalance = portfolioWallet[upperCaseToken] + amount;
    const newPortfolioBalance = { ...portfolioWallet, [upperCaseToken]: newTokenBalance };
    const updateTransaction = await FundHistory.findOneAndUpdate({ txRef: txRef }, { status: "completed" }, { new: true });
    if (!updateTransaction) return res.status(400).json({ message: "Transaction not updated", success: false, status: statusCodes.BAD_REQUEST });
    const updatedUser = await Users.findByIdAndUpdate(merchant, { portfolioWallet: newPortfolioBalance }, { new: true });
    if (!updatedUser) return res.status(400).json({ message: "User wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
    return res.status(200).json({ message: "Wallet funded", funded: true, success: true, transaction: updateTransaction, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getFundHistory = async (req, res, next) => {
  try {
    const merchant = req._id;
    const tx_ref = req.query.tx_ref || null;
    if (tx_ref) {
      const fundHistory = await FundHistory.findOne({ txRef: tx_ref });
      if (!fundHistory) return res.status(404).json({ message: "Fund history not found", success: false, status: statusCodes.NOT_FOUND });
      return res.status(200).json({ message: "Fund history found", success: true, data: fundHistory, status: statusCodes.OK });
    }
    const fundHistory = await FundHistory.find({ merchant: merchant });
    if (!fundHistory) return res.status(404).json({ message: "Fund history not found", success: false, status: statusCodes.NOT_FOUND });
    return res.status(200).json({ message: "Fund history found", success: true, data: fundHistory, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getFundHistoryByEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    const user = await Users.findOne({ email: email });
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const tx_ref = req.query.tx_ref || null;
    if (tx_ref) {
      const fundHistory = await FundHistory.findOne({ txRef: tx_ref });
      if (!fundHistory) return res.status(404).json({ message: "Fund history not found", success: false, status: statusCodes.NOT_FOUND });
      return res.status(200).json({ message: "Fund history found", success: true, data: fundHistory, status: statusCodes.OK });
    }

    const fundHistory = await FundHistory.find({ merchant: user._id });
    if (!fundHistory) return res.status(404).json({ message: "Fund history not found", success: false, status: statusCodes.NOT_FOUND });
    return res.status(200).json({ message: "Fund history found", success: true, data: fundHistory, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.createWaitList = async (req, res, next) => {
  try {
    const { email, phone, name } = req.body;
    const newWaitList = new WaitList({
      email: email,
      phone: phone,
      name: name,
    });
    const waitList = await newWaitList.save();
    return res.status(200).json({ message: "Wait list created", success: true, data: waitList, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.getNetworkList = async (req, res, next) => {
  const { isLive } = req.query;
  try {
    if (isLive) {
      const list = ["mainnet", "binance", "polygon"];
      const tokens = [
        {
          name: "TetherUS",
          symbol: "USDT",
          networks: ["mainnet", "binance", "polygon"],
        },
        {
          name: "USD Coin",
          symbol: "USDC",
          networks: ["mainnet", "binance", "polygon"],
        },
        {
          name: "Binance USD",
          symbol: "BUSD",
          networks: ["mainnet", "binance", "polygon"],
        },
      ];
      return res.status(200).json({ message: "Network list fetched successfully", list, tokens, success: true, status: statusCodes.OK });
    }
    const list = ["testnet"];
    const tokens = [
      {
        name: "TetherUS",
        symbol: "USDT",
        networks: ["testnet"],
      },
      {
        name: "USD Coin",
        symbol: "USDC",
        networks: ["testnet"],
      },
      {
        name: "Binance USD",
        symbol: "BUSD",
        networks: ["testnet"],
      },
    ];
    return res.status(200).json({ message: "Network list fetched successfully", list, tokens, success: true, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.addCoinsToPortfolio = async (req, res, next) => {
  try {
    const { tokenName, network, address, tokenSlug } = req.body;
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const existingTokenNameInArray = portfolio.find((token) => token.name.toLowerCase() === tokenName.toLowerCase() && token.network === network);
    console.log("existing", existingTokenNameInArray);
    const validAddres = await validateAddress(address);
    if (!validAddres) return res.status(400).json({ message: `${address} is not a valid wallet address`, success: false, status: statusCodes.BAD_REQUEST });
    if (existingTokenNameInArray) return res.status(400).json({ message: `Token ${tokenName} on the ${network} network already exist's in ${user.is_live ? "Live" : "Test"} mode!`, success: false, status: statusCodes.BAD_REQUEST });
    const newPortfolio = [...portfolio, { name: tokenName.toLowerCase(), network: network.toLowerCase(), address: address, tokenSlug }];
    if (user.is_live) {
      const updatedUser = await Users.findByIdAndUpdate(merchant, { portfolioWallet: newPortfolio }, { new: true });
      if (!updatedUser) return res.status(400).json({ message: "User Live wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
      return res.status(200).json({ message: "Live Wallet updated", success: true, data: updatedUser, status: statusCodes.OK });
    }
    const updatedUser = await Users.findByIdAndUpdate(merchant, { testPortfolioWallet: newPortfolio }, { new: true });
    if (!updatedUser) return res.status(400).json({ message: "User Test wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
    return res.status(200).json({ message: "Test Wallet updated", success: true, data: updatedUser, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
module.exports.updatePortfolioWalletAddress = async (req, res, next) => {
  try {
    const { tokenName, network, address } = req.body;
    if (!tokenName || !network || !address) return res.status(400).json({ message: "Token name, network and address are required", success: false, status: statusCodes.BAD_REQUEST });
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const existingTokenNameInArray = portfolio.find((token) => token.name.toUpperCase() === tokenName.toUpperCase() && token.network === network);
    const validWalletAddress = await validateAddress(address);
    if (!validWalletAddress) return res.status(400).json({ message: `${address} is not a valid wallet address`, success: false, status: statusCodes.BAD_REQUEST });
    if (!existingTokenNameInArray) return res.status(400).json({ message: `Token ${tokenName} on the ${network} network does not exist in ${user.is_live ? "Live" : "Test"} mode!`, success: false, status: statusCodes.BAD_REQUEST });
    const newPortfolio = portfolio.map((token) => {
      if (token.name.toUpperCase() === tokenName.toUpperCase() && token.network === network) {
        return { ...token, network, address };
      }
      return token;
    });
    if (user.is_live) {
      const updatedUser = await Users.findByIdAndUpdate(merchant, { portfolioWallet: newPortfolio }, { new: true });
      if (!updatedUser) return res.status(400).json({ message: "User Live wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
      return res.status(200).json({ message: "Live Wallet updated", success: true, data: updatedUser, status: statusCodes.OK });
    }
    const updatedUser = await Users.findByIdAndUpdate(merchant, { testPortfolioWallet: newPortfolio }, { new: true });
    if (!updatedUser) return res.status(400).json({ message: "User Test wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
    return res.status(200).json({ message: "Test Wallet updated", success: true, data: updatedUser, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.deletePortfolioWalletAddress = async (req, res, next) => {
  try {
    let { tokenName, network } = req.body;
    tokenName = tokenName.toLowerCase();
    network = network.toLowerCase();

    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    // get the token to be deleted from the portfolio array
    const existingTokenNameInArray = portfolio.find((token) => {
      const value = token.name.toLowerCase() === tokenName && token.network.toLowerCase() === network;
      return value;
    });
    console.log(existingTokenNameInArray);
    if (!existingTokenNameInArray) return res.status(400).json({ message: `Token ${tokenName} on the ${network} network does not exist in ${user.is_live ? "Live" : "Test"} mode!`, success: false, status: statusCodes.BAD_REQUEST });
    // using the $pull operator to delete the token from the portfolio array
    if (user.is_live) {
      const updatedUser = await Users.findByIdAndUpdate(merchant, { $pull: { portfolioWallet: { name: tokenName.toLowerCase(), network } } }, { new: true });
      if (!updatedUser) return res.status(400).json({ message: "User Live wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
      return res.status(200).json({ message: "Live Wallet updated", success: true, data: updatedUser, status: statusCodes.OK });
    }
    const updatedUser = await Users.findByIdAndUpdate(merchant, { $pull: { testPortfolioWallet: { name: tokenName.toLowerCase(), network } } }, { new: true });
    if (!updatedUser) return res.status(400).json({ message: "User Test wallet not updated", success: false, status: statusCodes.BAD_REQUEST });
    return res.status(200).json({ message: "Test Wallet updated", success: true, data: updatedUser, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.getPortfolioWallet = async (req, res, next) => {
  try {
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });

    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;

    const mapfetchBalance = portfolio.map(async (token) => {
      return token;
    });
    const updatedPortfolio = await Promise.all(mapfetchBalance);
    console.log("updatedPortfolio", updatedPortfolio);
    return res.status(200).json({ message: `${user.is_live ? "Live" : "Test"} Portfolio Wallet fetched`, success: true, data: updatedPortfolio, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.getMerchantsTokenNames = async (req, res, next) => {
  try {
    const { link_id } = req.query;
    if (!link_id) return res.status(400).json({ message: "Link id is required", success: false, status: statusCodes.BAD_REQUEST });
    const paymentLink = await paymentLinks.findOne({ link_id });
    if (!paymentLink) return res.status(404).json({ message: "Payment link not found", success: false, status: statusCodes.NOT_FOUND });
    const { owner } = paymentLink;
    const user = await Users.findById(owner);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    console.log(portfolio);

    const tokens = portfolio.map((token) => {
      const { name, network, address, tokenSlug } = token;
      return { tokenName: name, network, address, tokenSlug };
    });
    return res.status(200).json({ message: `${user.is_live ? "Live" : "Test"} Portfolio Wallet fetched`, success: true, data: tokens, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

module.exports.toggleLiveOrTest = async (req, res, next) => {
  try {
    const merchant = req._id;
    const user = await Users.findById(merchant);
    if (!user) return res.status(404).json({ message: "User not found", success: false, status: statusCodes.NOT_FOUND });
    const is_live = !user.is_live;
    const updatedUser = await Users.findByIdAndUpdate(merchant, { is_live }, { new: true });
    if (!updatedUser) return res.status(400).json({ message: "User not updated", success: false, status: statusCodes.BAD_REQUEST });
    return res.status(200).json({ message: "User updated", success: true, data: updatedUser, status: statusCodes.OK });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// const getAddressTransactionRef = async () => {
//   const existingTransaction = await Transactions.find({ address: "0x08Ba8881A27135861F90fdC220adB4FFE865edb5" });
//   console.log(existingTransaction);
// };
// getAddressTransactionRef();

// handle disput transactions

module.exports.repushVerifyMerchantTransfer = async (req, res, next) => {
  try {
    let { tx_ref, socketId } = req.body;
    socket.emit("incomming-verification", { status: "processing...", socketId });
    // get the owner of the transaction
    const transactionRefOwner = await Transactions.findOne({ tx_ref });
    if (!transactionRefOwner) return res.status(404).json({ message: `Transaction with reference ${tx_ref} not found`, status: statusCodes.NOT_FOUND, success: false });
    if (transactionRefOwner.status.toLowerCase() === "completed") return res.status(400).json({ message: "Transaction is already completed", status: statusCodes.BAD_REQUEST, success: false });
    // console.log(transactionRefOwner);
    const tokenName = transactionRefOwner.token_name;
    const networkName = transactionRefOwner.network_name;
    const amount = transactionRefOwner.debt ? transactionRefOwner.debt : transactionRefOwner.amount + transactionRefOwner.fee;
    const address = transactionRefOwner.address;

    const owner = transactionRefOwner.merchant.id;
    const user = await Users.findById(owner);
    if (!user) return res.status(404).json({ message: "The merchant with this address doesn't exist", status: statusCodes.NOT_FOUND, success: false });
    const portfolio = user.is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const existingTokenNameInArray = portfolio.find((token) => token.name.toUpperCase() === tokenName.toUpperCase());

    if (!existingTokenNameInArray) return res.status(404).json({ message: `${tokenName} not found in ${user.is_live ? "live" : "test"} portfolio`, status: statusCodes.NOT_FOUND, success: false });
    const findPaymentWallet = await PaymentWallet.findOne({ address: address });
    if (!findPaymentWallet) return res.status(404).json({ message: "Payment wallet not found", status: statusCodes.NOT_FOUND, success: false });
    const payAddress = findPaymentWallet.address;
    const payWalletIndex = findPaymentWallet.index;

    const checkTransferStatus = await checkTransfer({ tokenName, networkName, address, amount, socketId });

    if (checkTransferStatus) {
      const amount = parseInt(transactionRefOwner.amount);
      const payoutAddress = existingTokenNameInArray.address;
      console.log("amount:>", amount);

      const confirm = await confimMerchantTransaction({ tokenName: tokenName.toLowerCase(), networkName: networkName.toLowerCase(), payAddress, amount, merchantAddress: payoutAddress, socketId });
      if (!confirm) return res.status(400).json({ message: "Transfer has not been completed", status: statusCodes.BAD_REQUEST, success: false });
      const transacted = {
        status: "completed",
        pay_wallet_index: payWalletIndex,
        settled_amount: transactionRefOwner.amount,
        payout: {
          sent: transactionRefOwner.amount,
          address: payoutAddress,
          network: existingTokenNameInArray.network,
          token: existingTokenNameInArray.tokenSlug,
          symbol: existingTokenNameInArray.name,
        },
      };
      const transaction = await Transactions.findOneAndUpdate({ tx_ref }, transacted, { new: true });
      return res.status(200).json({ message: "Transfer completed", data: transaction, success: true, status: statusCodes.OK });
    }
    return res.status(200).json({ message: "Transaction is still pending!", success: false, status: statusCodes.OK });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};
