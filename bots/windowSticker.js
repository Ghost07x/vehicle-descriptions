const { chromium } = require('playwright');
const uploadToDrive = require('../utils/googleDriveUploader');

module.exports = async function runWindowStickerBot(vin) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://velocitywindowstickers.com/login');
  await page.fill('input[type=\"email\"]', process.env.VELOCITY_USERNAME);
  await page.fill('input[type=\"password\"]', process.env.VELOCITY_PASSWORD);
  await page.click('button[type=\"submit\"]');
  await page.waitForNavigation();

  await page.goto(`https://velocitywindowstickers.com/search?vin=${vin}`);
  await page.waitForLoadState('networkidle');

  const fileName = `sticker_${vin}.png`;
  const filePath = `/tmp/${fileName}`;
  await page.screenshot({ path: filePath });

  await browser.close();
  return await uploadToDrive(filePath, fileName);
};
