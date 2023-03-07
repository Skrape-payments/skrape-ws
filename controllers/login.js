const Users = require("../models/users");
const bcrypt = require("bcryptjs");
const statusCode = require("../status_reponse/statusCode");
const { sendEmail } = require("../helpers/sendMail");
const { generateOTP } = require("../helpers/generateOTP");
const OTPs = require("../models/OTPs");
const jwt = require("jsonwebtoken");
// const process = require("process");
const Transactions = require("../models/transactions");
require("dotenv").config();
// eslint-disable-next-line no-undef
const secret = process.env.SECRET;

module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Users.findOne({ email });
    if (!user) return res.status(statusCode.NOT_FOUND).json({ status: statusCode.NOT_FOUND, message: "User not found" });
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(statusCode.UNAUTHORIZED).json({ status: statusCode.UNAUTHORIZED, message: "Invalid password" });
    if (!user.verifiedEmail) {
      const promisedOTP = await generateOTP();
      const { otp } = await promisedOTP;
      const hashedOTP = bcrypt.hashSync(otp, 10);
      const subject = "Email Verification";
      const intro = "Setup incomplete, please verify your account";
      // create otp in db
      const otpData = new OTPs({ otp: hashedOTP, user: user._id });
      await otpData.save();
      sendEmail(email, subject, user, otp, intro);
      return res.status(statusCode.UNAUTHORIZED).json({ status: statusCode.UNAUTHORIZED, message: `Please verify your email. We have sent an email to ${email}`, email });
    }
    const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "3d" });
    user.password = undefined;
    user.pin = undefined;
    return res.status(statusCode.OK).json({ status: statusCode.OK, message: "login successful", user, token });
  } catch (err) {
    console.log(err);
    return res.status(statusCode.INTERNAL_SERVER_ERROR).json({ status: statusCode.INTERNAL_SERVER_ERROR, message: "Internal server error!", err });
  }
};

// module.exports.verifyOTP = async (req, res) => {
//     try{
//         const {otp, userId} = req.body;
//         const user = await Users.findById(userId);
//         if(!user) return res.status(statusCode.NOT_FOUND).json({status: statusCode.NOT_FOUND,message: 'User not found'});
//         const otpData = await OTPs.findOne({user: user._id});
//         if(!otpData) return res.status(statusCode.NOT_FOUND).json({status: statusCode.NOT_FOUND,message: 'OTP not found'});
//         const isMatch = bcrypt.compareSync(otp, otpData.otp);
//         if(!isMatch) return res.status(statusCode.UNAUTHORIZED).json({status: statusCode.UNAUTHORIZED,message: 'Invalid OTP'});
//         // check if otp is expired
//         const now = moment();
//         const otpExpired = moment(otpData.createdAt).add(10, 'minutes');
//         if(now > otpExpired) return res.status(statusCode.UNAUTHORIZED).json({status: statusCode.UNAUTHORIZED,message: 'OTP expired'});
//         const token = jwt.sign({userId: user._id}, secret, {expiresIn: '3d'});
//         // delete otp from db
//         await OTPs.findByIdAndDelete(otpData._id);
//         return res.status(statusCode.OK).json({status: statusCode.OK,message: 'OTP verified',token, user});
//     }catch(err){
//         console.log(err);
//         return res.status(statusCode.INTERNAL_SERVER_ERROR).json({status: statusCode.INTERNAL_SERVER_ERROR,message: 'Internal server error'});
//     }
// }

// const getUsers = async () => {
//   try {
//     const users = await Users.find();

//     console.log(users);
//   } catch (err) {
//     console.log(err);
//   }
// };

// getUsers();

const getTx = async () => {
  try {
    const tx = await Transactions.find({ address: "0x9B814289C7cff205a2478Fe53e50C3065DE3bA0c" });
    console.log(tx);
  } catch (err) {
    console.log(err);
  }
};

getTx();
