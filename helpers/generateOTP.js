const generateOTP = async () => {
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  console.log(otp);
  return { otp };
};
module.exports = { generateOTP };
