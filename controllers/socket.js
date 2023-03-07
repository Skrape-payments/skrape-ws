const io = require("socket.io-client");
const serverSocket = io("https://ws.skrape.io");

module.exports = { serverSocket };
