const { chromium } = require('playwright');

module.exports = async function runCarfaxBot(vin) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`🔍 Running Carfax bot for VIN: ${vin}`);
  await page.goto(`https://www.carfax.com`);
  await page.screenshot({ path: `carfax_${vin}.png` });

  await browser.close();
  return `Screenshot saved as carfax_${vin}.png`;
};
