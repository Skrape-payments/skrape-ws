const cluster = require("cluster");
const http = require("http");
const { Server } = require("socket.io");
const numCPUs = require("os").cpus().length;
const Transactions = require("./models/transactions");
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const networkConfigUrl = {
  mainnet: "https://eth-mainnet.g.alchemy.com/v2/Oj_CY9H3jCVyjLhAFLCYFGaXkzTfLBQ4",
  testnet: "https://polygon-mumbai.g.alchemy.com/v2/glVlKDVRhvPLkgRZsFauFxrC1meoWFxm",
  binance: "https://rpc.ankr.com/bsc",
  polygon: "https://polygon-mainnet.g.alchemy.com/v2/oVuR-NAY5z5tQdXKjC1eyq4bFzmifzrQ",
};

const erc20Abi = require("./transferConfig/erc20Abi.json");

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  const httpServer = http.createServer();
  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection", // either "random", "round-robin" or "least-connection"
  });
  setupPrimary();
  httpServer.listen(3030, () => {
    console.log("listening on *:3030");
  });

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker) => {
    console.log(`socket Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  console.log(`socket Worker ${process.pid} started`);
  const httpServer = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("Hello, socket!\n");
  });
  const ioServer = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "x-access-token", "Access-Control-Allow-Origin"],
      exposedHeaders: ["Content-Type", "Authorization", "x-access-token", "Access-Control-Allow-Origin"],
      credentials: true,
    },
  });
  ioServer.adapter(createAdapter());
  setupWorker(ioServer);

  const startSocket = () => {
    ioServer.on("connection", (data) => handleSocketConnection(data));
    const handleSocketConnection = function (clientSocket) {
      console.log("a user connected to the server", clientSocket.id);
      ioServer.to(clientSocket.id).emit("test-socket-response", "socket working fine");

      clientSocket.on("incomming-verification", (data) => handleIncomingVerification(data));
      clientSocket.on("wallet-verification", (data) => handleWalletVerification(data));
      clientSocket.on("status-request", (data) => handleStatusRequest(data));
      clientSocket.on("checking-block-change", (data) => handleCheckingBlockChange(data));
      clientSocket.on("checking-block-change-status", (data) => handleCheckingBlockChangeStatus(data));
      clientSocket.on("checking-transfer", (data) => handleCheckingTransfer(data));
      clientSocket.on("status-response", (data) => handleStatusResponse(data));
      clientSocket.on("disconnect", (data) => handleClientDisconnect(data));

      clientSocket.on("test-socket", () => {
        console.log("io", clientSocket.id);
        ioServer.to(clientSocket.id).emit("test-socket-response", "socket working fine");
      });

      const handleClientDisconnect = async function () {
        console.log("user disconnected", clientSocket.id);
        clientSocket.disconnect();
      };
      const handleStatusResponse = async function (data) {
        console.log("responding => ", data);
        ioServer.to(data.socketId).emit("status", data);
      };
      const handleCheckingTransfer = async function (data) {
        console.log("checking-transfer:> ", data);
        ioServer.to(data.socketId).emit("checking-transfer-status", data);
      };
      const handleIncomingVerification = async function (data) {
        console.log("incomming-verification", data);
        ioServer.to(data.socketId).emit("verification", data);
      };

      const handleWalletVerification = async function (data) {
        console.log("wallet-verification", data);
        ioServer.to(data.socketId).emit("wallet-verification", data);
      };

      const handleStatusRequest = async function (data) {
        console.log("requesting:> ", data);
        ioServer.to(data.socketId).emit("processing", data);
      };

      const handleCheckingBlockChange = async function (data) {
        // this is listening for the event from the browser
        console.log("checking-block-change:> ", data);
        clientSocket.emit("checking-block-change-status", data);
      };

      const handleCheckingBlockChangeStatus = async function (data) {
        console.log("checking-block-change-status:> ", data);
        try {
          const { address, socketId, token, network, tx_ref } = data;
          if (!address || !socketId || !token || !network || !tx_ref)
            return ioServer.to(socketId).emit("checking-transfer", {
              socketId,
              status: "invalid data request",
            });
          console.log("checking", data);
          const transaction = await Transactions.findOne({ tx_ref });
          if (!transaction) {
            return ioServer.to(socketId).emit("checking-transfer", {
              socketId,
              status: "invalid tx_ref",
            });
          }
          if (transaction.status == "completed") {
            return ioServer.to(socketId).emit("checking-transfer", {
              socketId,
              status: "transaction already completed",
            });
          }
          const amount = transaction.debt;
          const provider = new ethers.providers.JsonRpcProvider(networkConfigUrl[network]);
          const walletAddress = address;
          const gettoken = await getTokenAddress(network);
          const tokenAddress = gettoken[token];
          const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
          provider.on("block", async () => {
            const currentBalance = await tokenContract.balanceOf(walletAddress);
            const balance = ethers.utils.formatUnits(currentBalance, 18);
            console.log(balance);
            if (balance >= amount) {
              return ioServer.to(socketId).emit("checking-transfer", { status: "success", socketId, currentBalance: balance }) && provider.removeListener("block", listener);
              // turn off the provider block listener
              // provider.removeListener("block", listener);
              // socket.disconnect();
            }
          });
          const listener = (blockNumber) => {
            console.log(`checking block ${blockNumber}`);
          };
          provider.on("block", listener);
        } catch (error) {
          console.log(error);
        }
      };
    };
  };
  startSocket();
}
