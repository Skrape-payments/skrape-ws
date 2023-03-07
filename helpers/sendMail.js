const nodemailer = require("nodemailer");
// const { generateTemplate } = require("./authOTPTemplate");
const { signupTemplate } = require("./signupTemplate");
const transporter = nodemailer.createTransport({
  host: "premium250-4.web-hosting.com",
  port: 465,
  auth: {
    user: "no-reply@skrape.io",
    pass: "rph3V{bwPg9G",
  },
  secure: true,
  // host: "send.smtp.mailtrap.io",
  // port: 2525,
  // auth: {
  //   user: "api",
  //   pass: "3351165f330b3feab1151a77775a994f",
  // },
});
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: "scottlexium@gmail.com",
//     pass: "rcaaplzqlnyfhhow",
//   },
// });
const sendEmail = async (email, subject, data, otp) => {
  // const generateEmailTemplate = generateTemplate(data, otp, intro, exp);
  const mailOptions = {
    from: "no-reply@skrape.io",
    to: email,
    subject: `${subject}`,
    html: signupTemplate(data, otp),
  };
  try {
    console.log("sending email");
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.log(error);
    return error;
  }
};
module.exports = { sendEmail };

// transporter.sendMail(mailOptions, function (error, info) {
//   if (error) {
//     console.log("error", error);
//     return false;
//   } else {
//     console.log("Email sent: " + info.response);
//     return true;
//   }
// });
