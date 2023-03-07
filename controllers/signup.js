const Users = require("../models/users");

const OTPs = require("../models/OTPs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const saltRounds = 10;
// eslint-disable-next-line no-undef
const secret = process.env.SECRET;
const { generateOTP } = require("../helpers/generateOTP");
const { sendEmail } = require("../helpers/sendMail");
const moment = require("moment");
const speakeasy = require("speakeasy");
const qrCode = require("qrcode");
const fs = require("fs");

const statusCode = require("../status_reponse/statusCode");
const deepEqual = require("deep-equal");
const { BlobServiceClient } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");
// eslint-disable-next-line no-undef
const AZURE_CONNECTION_STRING = process.env.AZURE_CONNECTION_STRING || "DefaultEndpointsProtocol=https;AccountName=csb10032001ef6ccd2d;AccountKey=PLk5RukYNyZViVVfZvD0s7zIyX6Kt2qm0lSU9MNU4p3P0iNuWpK+IYd/gnR+28YK4FRw3uLLM8AB+AStnDHmhA==;EndpointSuffix=core.windows.net";
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
// const cloudinary = require("cloudinary");
// const qrcode = require("qrcode");
// const { createSkrapeUserWallet } = require("./wallet");
const { mintDomain } = require("../controllers/skrapeDomain");
const otpExpTime = 10;
const Domains = require("../models/domains");

module.exports.uploadImage = async (req, res) => {
  try {
    const { files } = req;
    const containerName = "skrape-uploads";
    const containerClient = await blobServiceClient.getContainerClient(containerName);
    const fileList = [];
    files.forEach((file) => {
      const buffer = fs.readFileSync(file.path);
      const blockBlobClient = containerClient.getBlockBlobClient(file.filename);
      console.log("\nUploading to Azure storage as blob:\n\t", file.filename);
      const uploadBlobResponse = blockBlobClient.upload(buffer, buffer.length);
      fs.unlinkSync(file.path);
      console.log("Blob was uploaded successfully. requestId: ", uploadBlobResponse, blockBlobClient.url);
      fileList.push(blockBlobClient.url);
    });
    return res.status(200).json({
      statusCode: statusCode.OK,
      message: "uploaded files",
      urls: fileList,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "something went wrong", error: error.message });
  }
};
module.exports.KYC_uploads = async (req, res) => {
  try {
    const { means_of_identity, country, state, LGA, documents } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    console.log(user);
    if (!user) return res.status(204).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (!user.verifiedEmail)
      return res.status(400).json({
        message: "User not verified",
        statusCode: statusCode.BAD_REQUEST,
      });
    if (user.KYC.length < 1) return res.status(400).json({ message: "KYC already uploaded" });
    const KYC = { means_of_identity, country, state, LGA, documents };
    // push KYC to user
    const updatedUser = await Users.findOneAndUpdate({ email: user.email }, { $push: { KYC } }, { new: true });
    return res.status(200).json({
      message: "KYC uploaded successfully",
      statusCode: statusCode.OK,
      updatedUser,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message });
  }
};

module.exports.signup1 = async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;
  const lastUserIndex = await Users.find().countDocuments();
  const userIndex = lastUserIndex + 1;
  try {
    const existingUser = await Users.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(409).json({ message: "User already exists", statusCode: statusCode.CONFLICT });
    const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})");
    if (!strongRegex.test(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character", statusCode: statusCode.BAD_REQUEST });
    }
    const hashedPWD = bcrypt.hashSync(password, saltRounds);
    const { otp } = await generateOTP();
    // create live and test api keys for user
    const user = new Users({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPWD,
      index: userIndex,
      // wallet: wallet,
      test: `skr_test_${uuidv4()}`,
      live: `skr_live_${uuidv4()}`,
    });
    const savedUser = await user.save();
    const hashedOTP = bcrypt.hashSync(otp, saltRounds);
    const otpUser = new OTPs({ otp: hashedOTP, user: savedUser._id });
    await otpUser.save();
    const test_secret = jwt.sign({ _id: user._id, type: "test" }, secret);
    const live_secret = jwt.sign({ _id: user._id, type: "live" }, secret);
    const added_secret = await Users.findOneAndUpdate({ _id: savedUser._id }, { $set: { test_secret, live_secret } }, { new: true });
    console.log("added_secret", added_secret);
    const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "24hr" });
    const userResponse = {
      _id: savedUser._id,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      email: savedUser.email,
      phone: savedUser.phone,
      index: savedUser.index,
      // wallet: savedUser.wallet,
      token,
      keys: {
        test: savedUser.test,
        live: savedUser.live,
      },
      identifier: savedUser.identifier,
      portfolioWallet: savedUser.portfolioWallet,
      is_live: savedUser.is_live,
      secret: {
        test: test_secret,
        live: live_secret,
      },
    };
    const sendOTPCode = await sendEmail(email, "Skrape Registration", user, otp);
    console.log("email", sendOTPCode);
    if (!sendOTPCode) return res.status(500).json({ message: "something went wrong when sending otp code" });
    return res.status(201).json({ message: "User created successfully", userResponse, statusCode: statusCode.CREATED });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, statusCode: statusCode.INTERNAL_SERVER_ERROR });
  }
};

module.exports.verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(req.body);
    const userId = req._id;
    console.log(userId);
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.verifiedEmail) return res.status(400).json({ message: "User already verified" });
    const otpUser = await OTPs.findOne({ user: user._id });
    if (!otpUser) return res.status(400).json({ message: "OTP not found" });
    const createdAt = moment(otpUser.createdAt).format("YYYY-MM-DD HH:mm:ss");
    const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const timeDifference = moment(currentTime).diff(createdAt, "minutes");
    if (timeDifference > otpExpTime) return res.status(400).json({ message: "OTP expired", statusCode: statusCode.BAD_REQUEST });
    const decreptedOTP = bcrypt.compareSync(otp, otpUser.otp);
    console.log(timeDifference, otpExpTime);
    if (!decreptedOTP)
      return res.status(400).json({
        message: "OTP does not match",
        statusCode: statusCode.BAD_REQUEST,
      });
    const updatedUser = await Users.findOneAndUpdate({ _id: user._id }, { verifiedEmail: true }, { new: true });
    const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "24hr" });
    const userResponse = {
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      token,
    };
    // delete the otp from the database
    await OTPs.findOneAndDelete({ user: user._id });
    return res.status(200).json({
      message: "OTP verified",
      userResponse,
      statusCode: statusCode.OK,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      message: error.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR,
    });
  }
};

module.exports.resendOTP = async (req, res) => {
  try {
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    const email = user.email;
    if (!user) return res.status(200).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.verifiedEmail)
      return res.status(400).json({
        message: "User already verified",
        statusCode: statusCode.BAD_REQUEST,
      });
    const otpUser = await OTPs.findOne({ user: user._id });
    if (!otpUser)
      return res.status(404).json({
        message: "OTP not existing before",
        statusCode: statusCode.NOT_FOUND,
      });
    const promise = generateOTP();
    let { otp } = await promise;
    const hashedOTP = bcrypt.hashSync(otp, saltRounds);
    const updatedOTP = await OTPs.findOneAndUpdate({ user: user._id }, { otp: hashedOTP }, { new: true });
    // const message = `Your OTP is ${otp}`;
    // const subject = "OTP Verification";
    // const intro = "This is your new OTP code";
    // const exp = otpExpTime;
    const sendOTPCode = await sendEmail(email, "Skrape Registration", user, otp);
    if (!sendOTPCode) return res.status(500).json({ message: "something went wrong when sending otp code" });
    const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "24hr" });
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      otp: updatedOTP.otp,
      token,
    };
    return res.status(200).json({
      message: `OTP sent to ${userResponse.email}`,
      userResponse,
      statusCode: statusCode.OK,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports.setAccountType = async (req, res) => {
  try {
    const { accountType } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(204).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.accountType !== null)
      return res.status(409).json({
        message: "User already has an account type",
        statusCode: statusCode.CONFLICT,
      });
    if (user.accountType === accountType)
      return res.status(409).json({
        message: "User already has this account type",
        statusCode: statusCode.CONFLICT,
      });
    const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { accountType }, { new: true });
    return res.status(200).json({
      message: "Account type set",
      updatedUser,
      statusCode: statusCode.OK,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

// in progress
module.exports.completeIndividual = async (req, res) => {
  try {
    const { kyc, accountName, accountDomain, accountEmail } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(204).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.accountType !== "individual")
      return res.status(400).json({
        message: "User is not an individual",
        statusCode: statusCode.BAD_REQUEST,
      });
    //  set the individual account object
    const individualDetails = {
      kyc, // array of objects @type, @array of images, country, state, lga
      accountName,
      accountDomain,
      accountEmail,
    };
    // array of objects @type, @array of images, country, state, lga sample
    // const kyc = [
    //   {
    //     type: "id",
    //     images: ["image1", "image2"],
    //     country: "Nigeria",
    //     state: "Lagos",
    //     lga: "Ikeja"
    //   }
    // ]
    const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { individualDetails }, { new: true });
    return res.status(200).json({
      message: "Account type set",
      updatedUser,
      statusCode: statusCode.OK,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: err.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR,
    });
  }
};
// business setup
module.exports.completeBusiness = async (req, res) => {
  try {
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(204).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.accountType !== "business")
      return res.status(409).json({
        message: "User does not have a business account type",
        statusCode: statusCode.CONFLICT,
      });
    const { legalBusinessName, legalBusinessEmail, legalBusinessPhone, websiteOrBusinessProfile, businessCountry, businessState, businessEntityType, natureOfBusiness, additionalDetails } = req.body;
    // set the business details object
    const businessDetails = {
      legalBusinessName,
      legalBusinessEmail,
      legalBusinessPhone,
      websiteOrBusinessProfile,
      businessCountry,
      businessState,
      businessEntityType,
      natureOfBusiness,
      additionalDetails,
    };
    const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { businessDetails }, { new: true });
    return res.status(200).json({
      message: "User updated",
      updatedUser,
      statusCode: statusCode.OK,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: err.message,
      statusCode: statusCode.INTERNAL_SERVER_ERROR,
    });
  }
};

// $push: { twoFactor: { enabled: false, securityType, saveAscii } } }, { new: true });
// return res.status(200).json({ statusCode: statusCode.OK, message: "Security type of TOTP set successfully, please Scan the qr code with your auth app to sync", updatedUser, qr_code, success: true });
// });
// } else if (securityType == "question") {
// const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { securityType, $push: { twoFactor: { enabled: false, securityType, Question_Answer } } }, { new: true });
// return res.status(200).json({ statusCode: statusCode.OK, message: "Security type of question set successfully", updatedUser, success: true });

module.exports.set2FASecurity = async (req, res) => {
  const _2FA = speakeasy.generateSecret({ name: "Skrape", issuer: "Skrape", algorithm: "sha256" });
  try {
    const { securityType, Question_Answer } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found", statusCode: statusCode.NOT_FOUND, success: false });
    if (user.securityType === securityType && user.twoFactor[0].enabled) return res.status(409).json({ message: "User already has this security type", statusCode: statusCode.CONFLICT });
    if (securityType == "TOTP") {
      qrCode.toDataURL(_2FA.otpauth_url, async (err, qr_code) => {
        if (err) return res.status(500).json({ message: err.message, statusCode: statusCode.INTERNAL_SERVER_ERROR });
        const saveAscii = _2FA.ascii;
        const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { securityType, twoFactor: { enabled: false, securityType, saveAscii } }, { new: true });
        return res.status(200).json({ statusCode: statusCode.OK, message: "Security type of TOTP set successfully, please Scan the qr code with your auth app to sync", updatedUser, qr_code, success: true });
      });
    } else if (securityType == "question") {
      const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { securityType, twoFactor: { enabled: false, securityType, Question_Answer } }, { new: true });
      return res.status(200).json({ statusCode: statusCode.OK, message: "Security type of question set successfully", updatedUser, success: true });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message, success: false, statusCode: statusCode.INTERNAL_SERVER_ERROR });
  }
};

module.exports.verify2FA_TOTP = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.securityType === null) return res.status(204).json({ message: "User has no security type", statusCode: statusCode.NO_CONTENT, success: false });
    if (user.securityType !== "TOTP") return res.status(409).json({ message: "User does not have TOTP security type", statusCode: statusCode.CONFLICT, success: false });
    const secret = user.twoFactor[0].saveAscii;
    const verified = speakeasy.totp.verify({ secret, encoding: "ascii", token });
    console.log(verified);
    if (!verified) return res.status(400).json({ message: "Invalid token", valid: false, statusCode: statusCode.BAD_REQUEST });
    const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { "twoFactor.0.enabled": true }, { new: true });
    return res.status(200).json({ message: "Security verified", valid: true, statusCode: statusCode.OK, data: updatedUser, success: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message, statusCode: statusCode.INTERNAL_SERVER_ERROR, success: false });
  }
};

module.exports.getSecurityQuestions = async (req, res) => {
  try {
    return res.status(200).json({
      statusCode: statusCode.OK,
      message: "Security questions retrieved",
      questions: [
        "What is your favorite color?",
        "What is your favorite animal?",
        "What is your favorite food?",
        "What is your favorite sport?",
        "What is your favorite movie?",
        "What is your favorite book?",
        "What is your favorite song?",
        "What School did you attend?",
        "Childhood nickname?",
        "What Town did your parents meet?",
      ],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};
module.exports.setSecurityQuestions = async (req, res) => {
  try {
    const { securityType, Question_Answer } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.securityType === securityType && user.twoFactor[0].enabled) return res.status(409).json({ message: "User already has this security type", statusCode: statusCode.CONFLICT });
    if (securityType == "question") {
      // update the user security type and the question answer
      const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { "twoFactor.0.enabled": true, "twoFactor.0.Question_Answer": Question_Answer }, { new: true });
      return res.status(200).json({ statusCode: statusCode.OK, message: "Security type of question set successfully", updatedUser, success: true });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message, success: false, statusCode: statusCode.INTERNAL_SERVER_ERROR });
  }
};
module.exports.verify2FA_question = async (req, res) => {
  try {
    const { payload } = req.body;
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.securityType === null) return res.status(204).json({ message: "User has no security type" });
    // eslint-disable-next-line no-unused-vars
    const hashedQuestion = user.twoFactor[0].Question_Answer;
    const validate = deepEqual(user.twoFactor[0].Question_Answer, payload);
    if (!validate) return res.status(400).json({ message: "Invalid Answers", valid: false });
    return res.status(200).json({ message: "Security Question verified", valid: true });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports.getDomain = async (req, res) => {
  try {
    const { domainName } = req.body;
    // check if domain contains special characters
    const regex = new RegExp("^[a-zA-Z0-9]+$");
    if (!regex.test(domainName))
      return res.status(400).json({
        message: "Domain name contains special characters or whitespace",
        statusCode: statusCode.BAD_REQUEST,
        status: false,
      });
    if (domainName.length > 140) return res.status(400).json({ message: "Domain name is too long, max length allowed: 140", statusCode: statusCode.BAD_REQUEST, status: false });
    const existingDomain = await Domains.findOne({ domain: domainName });
    if (existingDomain) return res.status(409).json({ message: "Domain already taken", statusCode: statusCode.CONFLICT });
    const userId = req._id;
    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ message: "User not found", statusCode: statusCode.NOT_FOUND });
    if (user.identifier !== null) return res.status(400).json({ message: "User already has a master domain", statusCode: statusCode.BAD_REQUEST, status: false });
    const userWalletIndex = user.index;
    const getDomain = await mintDomain(domainName, userWalletIndex);
    if (!getDomain) return res.status(500).json({ message: "Error minting domain", statusCode: statusCode.INTERNAL_SERVER_ERROR });
    const updatedUser = await Users.findOneAndUpdate({ _id: userId }, { identifier: domainName.toLowerCase() + ".skrape" }, { new: true });
    const newDomain = new Domains({ domain: domainName.toLowerCase() + ".skrape", user: userId, walletIndex: userWalletIndex });
    await newDomain.save();
    return res.status(200).json({ statusCode: statusCode.OK, message: "Domain minted successfully", updatedUser, status: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err, status: false });
  }
};

// const checkanswer = async () => {
//   const test = "Who";
//   console.dir([
//     deepEqual([{ a: 1, b: 2 }], [{ a: 1, b: 2 }]),
//     deepEqual({ a: "1", b: "2" }, { b: "2", a: "1" }),
//   ]);
// };
// checkanswer();

// This code u see below here was how we made the qrcode work

// const createQrcode = async () => {
//   qrCode.toDataURL("wallet adress", async (err, qr_code) => {
//     if (err)
//       return console.log(err);
//     // make a folder called qrcodes and put the qrcode in there
//     if (!fs.existsSync("./qrcodes")) {
//       fs.mkdirSync("./qrcodes");
//     }
//     // create the file and get the path
//     const path = `./qrcodes/${Date.now()}.png`;
//     // create buffer of the qrcode to base64
//     const buffer = Buffer.from(qr_code.replace(/^data:image\/png;base64,/, ""), "base64");
//     // write the buffer to the file
//     fs.writeFileSync(path, buffer);
//     console.log(path);
//   });
// }
// createQrcode();
