/* eslint-disable no-undef */
var Mailgen = require("mailgen");
const nodemailer = require("nodemailer");
require("dotenv").config();
// Configure mailgen by setting a theme and your product info
const sendResetPasswordEmail = async (user, exp, link) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "premium250-4.web-hosting.com",
      port: 465,
      auth: {
        user: "no-reply@skrape.io",
        pass: "rph3V{bwPg9G",
      },
      secure: true,
    });
    var mailGenerator = new Mailgen({
      theme: "default",
      product: {
        // Appears in header & footer of e-mails
        name: "Skrape",
        link: "https://skrape.io",
        // Optional logo
        logo: process.env.LOGO_URL || "https://csb10032001ef6ccd2d.blob.core.windows.net/skrape-uploads/2424073e-ffac-4807-8d31-1d62ea66084a-LogoIcon.png",
      },
    });

    var email = {
      body: {
        name: user.name,
        intro: "You have received this email because a password reset request for your account was received.",
        action: {
          instructions: `Click the button below to reset your password, valid for ${exp}:`,
          button: {
            color: process.env.COLOR_MAIN || "#b0d346",
            text: "Reset your password",
            link: link,
          },
        },
        outro: "If you did not request a password reset, no further action is required on your part.",
      },
    };

    // Generate an HTML email with the provided contents
    var emailBody = mailGenerator.generate(email);

    // Generate the plaintext version of the e-mail (for clients that do not support HTML)
    mailGenerator.generatePlaintext(email);

    // Optionally, preview the generated HTML e-mail by writing it to a local file
    // require("fs").writeFileSync("preview.html", emailBody, "utf8");
    // require("fs").writeFileSync("preview.txt", emailText, "utf8");
    const mailOptions = {
      from: "no-reply@skrape.io",
      to: user.email,
      subject: "Reset Password",
      html: emailBody,
    };
    console.log("sending email");
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.log(error);
    return error;
  }
};

module.exports = { sendResetPasswordEmail };
