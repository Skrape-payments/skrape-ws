const User = require("../models/users");
const jwt = require("jsonwebtoken");
const { sendResetPasswordEmail } = require("../helpers/reset_password/reset_template");
const bcrypt = require("bcryptjs");
require("dotenv").config();
// eslint-disable-next-line no-undef
const PWD_SECRET = process.env.SECRET;

module.exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: "User does not exist", success: false });
    const USER_SECRET = user.password + PWD_SECRET;
    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, USER_SECRET, { expiresIn: "10m" });
    const link = `skrape.io/reset-password/?m=${user._id}&n=${token}`;
    const sendMail = await sendResetPasswordEmail(user, "10 minutes", link);
    if (!sendMail) return res.status(400).json({ message: "Error sending password reset email", success: false });
    return res.status(200).json({ message: `password reset link sent to ${email}`, success: true });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "Error sending password reset email", success: false, error: error });
  }
};

module.exports.resetPassword = async (req, res) => {
  try {
    const { id, token } = req.query;
    const { password, confirmPassword } = req.body;
    if (!id || !token) return res.status(400).json({ message: "Request params not provided", success: false });
    if (!password || !confirmPassword) return res.status(400).json({ message: "Password fields cannot be empty", success: false });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match", success: false });
    const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})");
    if (!strongRegex.test(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character", success: false });
    }
    const user = await User.findById(id);
    if (!user) return res.status(400).json({ message: "User does not exist", success: false });
    const USER_SECRET = user.password + PWD_SECRET;
    const payload = jwt.verify(token, USER_SECRET);

    const splicedId = payload.id.slice(0, 24);
    if (splicedId !== payload.id || payload.email !== user.email) return res.status(400).json({ message: "Invalid token request", success: false });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const update = await User.findByIdAndUpdate(id, { password: hashedPassword });
    if (!update) return res.status(400).json({ message: "Error updating password", success: false });
    return res.status(200).json({ message: "Password updated successfully", success: true });
  } catch (error) {
    console.log(error);
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") return res.status(400).json({ message: "Password reset link is invalid", success: false });
    return res.status(500).json({ message: "somethind went wrong", error: error, success: false });
  }
};
