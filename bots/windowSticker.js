// windowSticker.js (do the same pattern in carfax.js)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function ts() {
  const d = new Date(), p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

module.exports = async function windowSticker(vin, opts = {}) {
  const saveDir = opts.saveDir || path.join(process.cwd(), 'screenshots');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    // ... navigate/login/load the sticker page for VIN ...

    const buf = await page.screenshot({ type: 'png', fullPage: true });
    const filename = `WindowSticker_${vin}_${ts()}.png`;

    fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(path.join(saveDir, filename), buf);

    return { status: 'ok', vin, filename, buffer: opts.returnBuffer ? buf : undefined };
  } catch (err) {
    return { status: 'error', vin, error: String(err?.message || err) };
  } finally {
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
};
