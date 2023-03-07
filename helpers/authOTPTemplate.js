/* eslint-disable no-undef */
const Mailgen = require("mailgen");
require("dotenv").config();

const generateTemplate = (data, message, intro, exp) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      // Appears in header & footer of e-mails
      name: "Skrape",
      link: "https://google.com/",
      // eslint-disable-next-line no-undef
      logo: process.env.LOGO_URL || "https://csb10032001ef6ccd2d.blob.core.windows.net/skrape-uploads/2424073e-ffac-4807-8d31-1d62ea66084a-LogoIcon.png",
    },
  });
  const email = {
    body: {
      name: data.firstName,
      intro: intro,
      action: {
        instructions: `Please verify your account using the OTP code below, valid for ${exp} mins. Do not share this code with anyone.`,
        button: {
          color: process.env.COLOR_MAIN || "#b0d346",
          text: `OTP CODE: ${message}`,
        },
      },
      outro: "If you did not request this email, please ignore it. This email is only valid for the next ${exp} minutes.",
    },
  };
  // Generate an HTML email with the provided contents
  const emailBody = mailGenerator.generate(email);
  // require("fs").writeFileSync("preview.html", emailBody, "utf8");
  return emailBody;
};

module.exports = { generateTemplate };
