const { chromium } = require('playwright');

module.exports = async function runWindowStickerBot(vin) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`🧾 Running Window Sticker bot for VIN: ${vin}`);
  await page.goto(`https://example.com/window-sticker?vin=${vin}`);
  await page.screenshot({ path: `sticker_${vin}.png` });

  await browser.close();
  return `Screenshot saved as sticker_${vin}.png`;
};
