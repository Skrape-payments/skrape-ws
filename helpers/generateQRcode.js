// Refactored code:
const qrCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { uploadToAzure } = require("./file_upload");

const generateQRcode = async (paymentLink, id) => {
  const opts = {
    errorCorrectionLevel: "H",
    type: "image/jpeg",
    quality: 0.3,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  };

  const qrCodeName = id; // renamed variable to be more descriptive
  const containerName = "qrcodes";

  // check if the folder exists and create it if it doesn't exist
  // eslint-disable-next-line no-undef
  const folderPath = path.join(__dirname, "../public/qr-codes");

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  // generate qr code and convert to base64 data for storage in file system
  // eslint-disable-next-line no-undef
  const qrCodePath = path.join(__dirname, `../public/qr-codes/${qrCodeName}.png`);

  const result = await qrCode.toDataURL(paymentLink, opts).then((url) => url.toString()); // removed unnecessary console log and added await keyword for asynchronous operations

  const base64Data = result.replace(/^data:image\/png;base64,/, "");

  fs.writeFileSync(qrCodePath, base64Data, "base64");

  // upload file to Azure and return the hosted URL
  const hostedUrl = await uploadToAzure(qrCodePath, containerName);

  return { hostedUrl }; // removed unnecessary brackets around hostedUrl variable
};

module.exports = generateQRcode;
