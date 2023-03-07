const Users = require("../models/users");

const Increase_tx_count = async (user_id) => {
  await Users.findById(user_id);
};
module.exports = { Increase_tx_count };
