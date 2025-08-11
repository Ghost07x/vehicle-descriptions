// scripts/carfax-capture-session.js
require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || path.join('/tmp', 'carfax_storageState.json');
const LOGIN_ENTRY = 'https://www.carfaxonline.com';
const VIN_INPUT_SELECTOR = 'input[name="vin"], input#vin, [placeholder*="VIN" i]';

(async () => {
  console.log('Launching headed browser… Log in manually if prompted.');
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_ENTRY, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // If a username/password form shows, auto-fill once (you can still edit)
    const emailSel = 'input[type="email"], input[name="username"], input#username';
    const passSel  = 'input[type="password"], input[name="password"], input#password';
    const submitSel = 'button[type="submit"], button:has-text("Sign in"), [data-testid*="login"]';

    if (await page.$(emailSel)) {
      if (process.env.CARFAX_USER) await page.fill(emailSel, process.env.CARFAX_USER);
      if (process.env.CARFAX_PASS) await page.fill(passSel, process.env.CARFAX_PASS);
      // You can click Sign in OR handle OTP manually if needed
      if (await page.$(submitSel)) await page.click(submitSel).catch(()=>{});
    }

    console.log('>> Complete any MFA/OTP if prompted…');
    // Wait until dashboard with VIN field appears
    await page.waitForSelector(VIN_INPUT_SELECTOR, { timeout: 180000 }); // 3 minutes for OTP
    console.log('VIN field detected — saving session…');

    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`Saved session to: ${STORAGE_STATE_PATH}`);
  } catch (e) {
    console.error('Failed to capture session:', e);
    try { fs.writeFileSync('carfax_login_debug.html', await page.content()); } catch {}
  } finally {
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
})();
