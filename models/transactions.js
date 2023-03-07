const mongoose = require("mongoose");
const { Schema } = mongoose;

const TransactionsSchema = new Schema(
  {
    merchant: {
      type: Object,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    tx_ref: {
      type: String,
      required: true,
    },
    customization: {
      title: {
        type: String,
        required: false,
      },
      description: {
        type: String,
        required: false,
      },
      logo: {
        type: String,
      },
    },
    callback_url: {
      type: String,
    },
    redirect_url: {
      type: String,
    },
    customer: {
      type: Object,
      required: false,
    },
    status: {
      type: String,
      required: true,
      default: "pending",
    },
    qrCode: {
      type: String,
      required: false,
    },
    debt: {
      type: Number,
      required: true,
    },
    token_name: String,
    network_name: String,
    address: String,
    pay_wallet_index: String,
    type: String, // payment made from customers or payment made from payment link
    mode: String,
    payout: Object,
    settled_amount: Number,
    fee: Number,
    initTime: Date,
  },
  { timestamps: true }
);
const Transactions = mongoose.model("Transactions", TransactionsSchema);
module.exports = Transactions;
