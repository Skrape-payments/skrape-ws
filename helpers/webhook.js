const axios = require("axios");

const sendWebhook = async (url, data) => {
  const response = await axios.post(url, data);
  console.log(response.status);
  console.log(response.data);
  return response;
};
// sendWebhook("http://localhost:3020/", {
//   name: "John Doe",
//   age: 25,
// });
module.exports = {
  sendWebhook,
};
