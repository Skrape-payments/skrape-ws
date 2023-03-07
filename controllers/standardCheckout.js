// const transactionValidity = 5;
const MINIMUM_TRANSFER_AMOUNT = 10;
const Users = require("../models/users");
// const io = require("socket.io-client");
require("dotenv").config();
// eslint-disable-next-line no-undef
// const port = process.env.PORT || 3005;
// const socket = io(`http://localhost:${port}`);
const statusCodes = require("../status_reponse/statusCode");
const Transactions = require("../models/transactions");
const { checkTransfer, confimMerchantTransaction } = require("./transfer2");
const { createSkrapePaymentWallet } = require("./wallet2");
const PaymentWallet = require("../models/paymentWallets");
const generateQRcode = require("../helpers/generateQRcode");
const paymentLinks = require("../models/paymentLinks");
const { sendWebhook } = require("../helpers/webhook");
const { serverSocket } = require("../controllers/socket");
const socket = serverSocket;
// const { Increase_tx_count } = require("../helpers/increase_tx_count");

// eslint-disable-next-line no-unused-vars
const statusErrorCodes = [
  {
    code: "0000",
    message: "Transaction Successful",
  },
  {
    code: "0001",
    message: "Transaction Failed",
  },
  {
    code: "0002",
    message: "Transaction Pending",
  },
  {
    code: "0003",
    message: "Transaction Cancelled",
  },
  {
    code: "0004",
    message: "Transaction Expired",
  },
  {
    code: "0005",
    message: "Transaction Not Found",
  },
];

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

const randomString = (length) => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
module.exports.assembleAndGenerateLink = async (req, res, next) => {
  try {
    console.log("workign on link");
    const user = req._user;
    let { tx_ref, amount, redirect_url, customer, customization, callback_url } = req.body;
    if (!customer) customer = {};
    if (!customer.first_name || !customer.last_name || !customer.email)
      return res.status(400).json({
        message: `The following fields are required from the customers object: first_name, last_name, email`,
        status: statusCodes.BAD_REQUEST,
      });
    if (!customer.email.includes("@"))
      return res.status(400).json({
        message: `The email address provided is invalid`,
        status: statusCodes.BAD_REQUEST,
      });
    if (amount < MINIMUM_TRANSFER_AMOUNT)
      return res.status(400).json({
        message: `The minimum amount allowed for a transfer is ${MINIMUM_TRANSFER_AMOUNT}`,
        status: statusCodes.BAD_REQUEST,
      });
    if (!customization) customization = {};
    if (!customization.title || !customization.description) {
      return res.status(400).json({ message: `The following fields are required from the customization object: title, description`, status: statusCodes.BAD_REQUEST });
    }
    const existingTransaction = await Transactions.findOne({ tx_ref });
    if (existingTransaction) return res.status(400).json({ message: `Transaction with reference ${tx_ref} already exists`, status: statusCodes.BAD_REQUEST });
    if (!tx_ref) tx_ref = randomString(19);

    const link = `https://skrape.io/transaction/initialize/${tx_ref}`;

    const { hostedUrl } = await generateQRcode(link, user._id);
    console.log(hostedUrl);
    console.log("link", link);
    const paymentLink = await paymentLinks.create({
      link_id: tx_ref,
      owner: user._id,
      link_name: customization.title,
      description: customization.description,
      amount,
      redirect_url,
      webhook_url: callback_url,
      flexible_amount: false,
      paymentLink: link,
      paymentLinkQR: hostedUrl.url,
      customer,
    });

    console.log(paymentLink, "transaction");
    // get the query string from the link
    const queryString = link.split("initialize/")[1];
    console.log(queryString, "queryString");
    return res.status(200).json({
      message: "Transaction created successfully",
      status: statusCodes.SUCCESS,
      data: {
        link,
        link_id: tx_ref,
      },
    });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};

module.exports.getSupportedTokens = async (req, res, next) => {
  try {
    const { link_id } = req.query;
    const payment_link = await paymentLinks.findOne({ link_id });
    if (!payment_link) return res.status(400).json({ message: `Transaction with reference ${link_id} does not exist`, status: statusCodes.BAD_REQUEST });
    const user = await Users.findById(payment_link.owner);
    if (!user) return res.status(400).json({ message: `Merchant does not exist`, status: statusCodes.BAD_REQUEST });
    const { is_live } = user;
    const supportedTokens = is_live ? user.portfolioWallet : user.testPortfolioWallet;
    console.log(supportedTokens, "supportedTokens");
    return res.status(200).json({
      message: "Supported tokens retrieved successfully",
      status: statusCodes.SUCCESS,
      data: supportedTokens.map((token) => {
        return {
          token_name: token.name,
          network_name: token.network,
          token_slug: token.tokenSlug,
        };
      }),
    });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};

module.exports.generateWallet = async (req, res, next) => {
  try {
    const { networkName, tokenName, link_id } = req.body;
    if (!link_id) return res.status(400).json({ message: `The following fields are required: link_id`, status: statusCodes.BAD_REQUEST });
    const payment_link = await paymentLinks.findOne({ link_id }).lean();
    if (!payment_link) return res.status(400).json({ message: `Payment Link ${link_id} does not exist`, status: statusCodes.BAD_REQUEST });
    const user = await Users.findById(payment_link.owner).lean();
    if (!user) return res.status(400).json({ message: `Merchant does not exist`, status: statusCodes.BAD_REQUEST });
    const { is_live } = user;
    // check if merchant supports the token
    const merchantTokens = is_live ? user.portfolioWallet : user.testPortfolioWallet;
    const token = merchantTokens.find((token) => token.name.toLowerCase() === tokenName.toLowerCase() && token.network.toLowerCase() === networkName.toLowerCase());
    if (!token) return res.status(400).json({ message: `Merchant does not support ${tokenName} token on the ${networkName} network`, status: statusCodes.BAD_REQUEST });
    const paymentWallet = await generatePaymentWallet(user, networkName);
    if (!paymentWallet) return res.status(400).json({ message: `An error occured while generating payment wallet`, status: statusCodes.BAD_REQUEST });
    const tx_ref = randomString(19);
    const { amount, link_name, description, customer, redirect_url, webhook_url } = payment_link;
    // let feeAmount = 0;
    // const txFee = (1 / 100) * amount;
    // if (txFee < 1) {
    //   feeAmount = 1;
    // } else {
    //   feeAmount = txFee;
    // }

    let fee = 0;
    if (amount >= 100) {
      fee = amount * 0.01;
    } else {
      fee = 1;
    }

    const transaction = await new Transactions({
      tx_ref,
      amount,
      redirect_url,
      customer,
      customization: {
        title: link_name,
        description,
      },
      callback_url: webhook_url,
      debt: amount + fee,
      merchant: {
        id: user._id,
        name: user.firstName + " " + user.lastName,
        email: user.email,
        phone_number: user.phone_number,
        is_live: user.is_live,
      },
      fee: fee,
      settled_amount: 0,
      status: "initialized",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: user.is_live ? "live" : "test",
      address: paymentWallet.address,
      qrCode: paymentWallet.qrCode,
      index: paymentWallet.index,
      network_name: networkName.toLowerCase(),
      token_name: tokenName.toLowerCase(),
    }).save();

    if (!transaction) return res.status(400).json({ message: `An error occured while initializing transaction`, status: statusCodes.BAD_REQUEST });
    transaction.merchant.id = undefined;
    paymentWallet.index = undefined;
    return res.status(200).json({ message: `Payment wallet generated successfully`, status: statusCodes.SUCCESS, data: paymentWallet, transaction });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { tx_ref } = req.query;
    if (!tx_ref) return res.status(400).json({ message: `The following fields are required: tx_ref`, status: statusCodes.BAD_REQUEST });
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(400).json({ message: `Transaction with reference ${tx_ref} does not exist`, status: statusCodes.BAD_REQUEST });
    const user = await Users.findById(transaction.merchant.id);
    if (!user) return res.status(400).json({ message: `Merchant with id ${transaction.merchant.id} does not exist`, status: statusCodes.BAD_REQUEST });

    return res.status(200).json({
      message: "Transaction status retrieved successfully",
      status: statusCodes.SUCCESS,
      data: transaction.status,
    });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};
module.exports.verifyPayment = async (req, res, next) => {
  try {
    const { tx_ref, socketId } = req.body;
    socket.emit("incomming-verification", { status: "processing...", socketId });

    if (!tx_ref) return res.status(400).json({ message: `The following fields are required: tx_ref`, status: statusCodes.BAD_REQUEST });
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(400).json({ message: `Transaction with reference ${tx_ref} does not exist`, status: statusCodes.BAD_REQUEST });
    if (transaction.status === "completed") return res.status(200).json({ message: `Transaction with reference ${tx_ref} has already been completed`, status: statusCodes.SUCCESS, data: transaction });
    const user = await Users.findById(transaction.merchant.id);
    if (!user) return res.status(400).json({ message: `Merchant with id ${transaction.merchant.id} does not exist`, status: statusCodes.BAD_REQUEST });
    const { address, network_name, token_name, amount } = transaction;
    socket.emit("incomming-verification", { status: "checking if transfer was made...", socketId });

    const hasMadePayment = await checkTransfer({
      tokenName: token_name.toLowerCase(),
      networkName: network_name.toLowerCase(),
      address,
      amount,
      socketId,
    });

    if (!hasMadePayment) return res.status(400).json({ message: `Payment has not been made for Transaction: ${tx_ref} with address : ${address} `, status: statusCodes.BAD_REQUEST });
    const payAddress = transaction.address;
    const { is_live } = user;
    const payoutAddress = is_live ? user.portfolioWallet.find((token) => token.name === token_name && token.network === network_name) : user.testPortfolioWallet.find((token) => token.name === token_name && token.network === network_name);
    const finalisePayment = await confimMerchantTransaction({
      tokenName: token_name.toLowerCase(),
      networkName: network_name.toLowerCase(),
      payAddress,
      amount,
      merchantAddress: payoutAddress.address,
      socketId,
    });
    if (!finalisePayment) return res.status(400).json({ message: `Transaction with reference ${tx_ref} could not be completed`, status: statusCodes.BAD_REQUEST });
    const updatedTransaction = await Transactions.findOneAndUpdate(
      { tx_ref },
      {
        $set: {
          status: "completed",
          settled_amount: transaction.amount,
          payout: {
            sent: transaction.amount,
            address: payoutAddress.address,
            netork: payoutAddress.network,
            token: payoutAddress.tokenSlug,
            symbol: payoutAddress.name,
          },
        },
      },
      { new: true }
    );
    // await Increase_tx_count(updatedTransaction.merchant.id);
    updatedTransaction.merchant.id = undefined;
    const requestData = {
      tx_ref: updatedTransaction.tx_ref,
      status: updatedTransaction.status,
      amount: updatedTransaction.amount,
      settled_amount: updatedTransaction.settled_amount,
      payout: updatedTransaction.payout,
      customer: updatedTransaction.customer,
      customization: updatedTransaction.customization,
      address: updatedTransaction.address,
      network_name: updatedTransaction.network_name,
      token_name: updatedTransaction.token_name,
      mode: updatedTransaction.mode,
      total: updatedTransaction.total,
      fee: updatedTransaction.fee,
    };
    await sendWebhook(updatedTransaction.callback_url, requestData);
    return res.status(200).json({
      message: "Transaction completed successfully",
      status: statusCodes.SUCCESS,
      data: updatedTransaction,
    });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};

module.exports.getTransactionStatus = async (req, res, next) => {
  try {
    const { tx_ref } = req.query;
    if (!tx_ref) return res.status(400).json({ message: `The following fields are required: tx_ref`, status: statusCodes.BAD_REQUEST });
    const transaction = await Transactions.findOne({ tx_ref });
    if (!transaction) return res.status(400).json({ message: `Transaction with reference ${tx_ref} does not exist`, status: statusCodes.BAD_REQUEST });
    transaction.merchant.id = undefined;
    return res.status(200).json({
      message: "Transaction status retrieved successfully",
      status: statusCodes.SUCCESS,
      data: transaction.status,
    });
  } catch (err) {
    console.log(err.message);
    next(err);
  }
};
