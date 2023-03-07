// const AZURE_STORAGE_CONNECTION_STRIN = "DefaultEndpointsProtocol=https;AccountName=csb10032001ef6ccd2d;AccountKey=PLk5RukYNyZViVVfZvD0s7zIyX6Kt2qm0lSU9MNU4p3P0iNuWpK+IYd/gnR+28YK4FRw3uLLM8AB+AStnDHmhA==;EndpointSuffix=core.windows.net";

// const AZURE_STORAGE_CONNECTION_STRING = {
//     DefaultEndpointsProtocol:"https",
//     AccountName:"csb10032001ef6ccd2d",
//     AccountKey:"PLk5RukYNyZViVVfZvD0s7zIyX6Kt2qm0lSU9MNU4p3P0iNuWpK+IYd/gnR+28YK4FRw3uLLM8AB+AStnDHmhA==",
//     EndpointSuffix:"core.windows.net"
// }
// module.exports = AZURE_STORAGE_CONNECTION_STRING;

// keys
// AZURE_STORAGE_CONNECTION_STRING = DefaultEndpointsProtocol=https;AccountName=csb10032001ef6ccd2d;AccountKey=PLk5RukYNyZViVVfZvD0s7zIyX6Kt2qm0lSU9MNU4p3P0iNuWpK+IYd/gnR+28YK4FRw3uLLM8AB+AStnDHmhA==;EndpointSuffix=core.windows.net
// DBURI = "mongodb+srv://skrape:InzZDSfjD7r6r3WO@cluster0.mkk3e.mongodb.net/skrape?retryWrites=true&w=majority"
// SECRET = "secret"
// SKRAPE_PAYMENT_KEY_PHARSE = monster lobster excuse daring whisper grit echo aim network lend autumn skirt
// SKRAPE_USER_KEY_PHARSE = shy virtual fat occur episode assault depth ill crater talk monitor target
// SKRAPR_ADMIN_KEY_PHARSE = shy virtual fat occur episode assault depth ill crater talk monitor target

const path = require("path");

const process = require("process");
// require("dotenv").config();

const currentDir = process.cwd();

// Get the name of the project folder from the absolute path
const projectName = path.basename(currentDir);
const devConfig = {
  PORT: "3030",
  DBURI: process.env.DBURI || "mongodb://localhost:27017/skrape",
  SKRAPE_ADMIN_KEY_PHARSE: "useless lake kiwi barely witness item ticket judge deny federal ivory cradle",
  env: "dev",
};

const prodConfig = {
  PORT: "3030",
  DBURI: process.env.DBURI || "mongodb://localhost:27017/skrape",
  SKRAPE_ADMIN_KEY_PHARSE: process.env.SKRAPE_ADMIN_KEY_PHRASE,
  env: "prod",
};

const localConfig = {
  PORT: "3030",
  DBURI: "mongodb://localhost:27017/skrape",
  // DBURI: process.env.DBURI,
  SKRAPE_ADMIN_KEY_PHARSE: "useless lake kiwi barely witness item ticket judge deny federal ivory cradle",
  env: "local",
};

const config = projectName === "skrape-socket" ? devConfig : projectName === "ws.skrape.io" ? prodConfig : localConfig;
console.log(`skrape is running on ${config.env} environment`);
module.exports = { config };
