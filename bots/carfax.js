const { chromium } = require('playwright');
const uploadToDrive = require('../utils/oauthDriveUploader');

module.exports = async function runCarfaxBot(vin) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`🔍 Running Carfax bot for VIN: ${vin}`);
  await page.goto('https://www.carfax.com');

  const fileName = `carfax_${vin}.png`;
  const filePath = `/tmp/${fileName}`;
  await page.screenshot({ path: filePath });

  await browser.close();

  const driveLink = await uploadToDrive(filePath, fileName);
  return driveLink;
};
