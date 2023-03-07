const config = {
  network: {
    mainnet: {
      nodeEndpoint:
        process.env.MAINNET_NODE_ENDPOINT ||
        `https://rpc.ankr.com/eth/ea3ce74b7302afdf3d439112e30fffc5fd2769f12c4267378bc85b8c0df788a0`,
      tokenAddress: {
        usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        busd: "0x4Fabb145d64652a948d72533023f6E7A623C7C53",
        usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      },
      skrapePaymentRouterAddress: "",
      forwarderAddress: "",
      paymentContractFactory: "0x78Bf43335c055E127F6deAC77848ed0d388B6324",
    },

    testnet: {
      nodeEndpoint: `https://polygon-mumbai.g.alchemy.com/v2/glVlKDVRhvPLkgRZsFauFxrC1meoWFxm`,
      tokenAddress: {
        usdt: "0xdE7bF653558254E8E2230dd9F5dAFd1aB4A312a3",
        busd: "0x9737c71e7D61a0b0017Cd8804A05c85ec60805d4",
        usdc: "0x352DC8A09D9d70724eDF551377EBf0d8457e6aFa",
      },
      skrapePaymentRouterAddress: "0xf7e0F12d8E7dd35eA3A42230f381cD377a950709",
      forwarderAddress: "0xeefCc2066e52A5535adEdb840fEd5d7B02B6248B",
      paymentContractFactory: "0xE580f64310FBc3Daa7D0A96eD7bA7eF5c8306F4f",
    },

    polygon: {
      nodeEndpoint:
        process.env.POLYGON_NODE_ENDPOINT ||
        `https://rpc.ankr.com/polygon/ea3ce74b7302afdf3d439112e30fffc5fd2769f12c4267378bc85b8c0df788a0`,
      tokenAddress: {
        usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        busd: "0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7",
        usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      },
      skrapePaymentRouterAddress: "0xE0bE7D01E2Ce8a0c3c25662c73Dc0c9d4d014DFe",
      forwarderAddress: "",
      paymentContractFactory: "0xf8Fb25Ed4F933e08f0D0C80c84d7855D90184D69",
    },

    binance: {
      nodeEndpoint:
        process.env.BINANCE_NODE_ENDPOINT ||
        "https://rpc.ankr.com/bsc/ea3ce74b7302afdf3d439112e30fffc5fd2769f12c4267378bc85b8c0df788a0",
      tokenAddress: {
        usdt: "0x55d398326f99059ff775485246999027b3197955",
        busd: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
        usdc: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      },
      skrapePaymentRouterAddress: "0xD1aF4Fa18FCC7472190FdA68ecB260d18B3E2aEF",
      forwarderAddress: "",
      paymentContractFactory: "0xf7e0F12d8E7dd35eA3A42230f381cD377a950709",
    },
  },

  skrapeVault: {
    usdc: "0x5c5f650Fab28D9E84E451c4c7dCb1b31636B1F39",
    usdt: "0x5c5f650Fab28D9E84E451c4c7dCb1b31636B1F39",
    busd: "0x5c5f650Fab28D9E84E451c4c7dCb1b31636B1F39",
  },

  transactionGas: 259681,
};

module.exports = { config };
