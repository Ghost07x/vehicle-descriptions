// bots/carfax.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LOGIN_ENTRY = 'https://www.carfaxonline.com';
const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || path.join('/tmp', 'carfax_storageState.json');

const VIN_INPUT_SELECTOR = 'input[name="vin"], input#vin, [placeholder*="VIN" i]';
const SUBMIT_SELECTOR = 'button:has-text("Get CARFAX Report"), [role="button"]:has-text("Get CARFAX Report")';
const REPORT_READY_TEXT = 'CARFAX Vehicle History Report';

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function ensureLoggedIn(page) {
  await page.goto(LOGIN_ENTRY, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (await page.$(VIN_INPUT_SELECTOR)) return;

  const emailSel = 'input[type="email"], input[name="username"], input#username';
  const passSel  = 'input[type="password"], input[name="password"], input#password';
  const submitSel = 'button[type="submit"], button:has-text("Sign in"), [data-testid*="login"]';

  const emailField = await page.$(emailSel);
  if (emailField) {
    await page.fill(emailSel, process.env.CARFAX_USER || '', { timeout: 30000 });
    await page.fill(passSel, process.env.CARFAX_PASS || '', { timeout: 30000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
      page.click(submitSel, { timeout: 30000 }),
    ]);
  }

  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  if (!(await page.$(VIN_INPUT_SELECTOR))) {
    fs.writeFileSync('carfax_debug_error.html', await page.content());
    await page.screenshot({ path: 'carfax_debug_error.png', fullPage: true }).catch(() => {});
    throw new Error('ERR_LOGIN_FAILED');
  }
}

/**
 * @param {string} vin
 * @param {object} opts
 *  - saveDir?: string   [default: process.env.SCREENSHOT_DIR or ./screenshots]
 *  - returnBuffer?: boolean
 */
module.exports = async function runCarfax(vin, opts = {}) {
  if (!vin) throw new Error('ERR_NO_VIN');

  const saveDir = opts.saveDir || process.env.SCREENSHOT_DIR || path.join(process.cwd(), 'screenshots');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const storageExists = fs.existsSync(STORAGE_STATE_PATH);
  const context = await browser.newContext({
    storageState: storageExists ? STORAGE_STATE_PATH : undefined,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page);
    await context.storageState({ path: STORAGE_STATE_PATH });

    await page.waitForSelector(VIN_INPUT_SELECTOR, { timeout: 30000 });
    await page.fill(VIN_INPUT_SELECTOR, vin, { timeout: 15000 });

    const [maybeNewPage] = await Promise.all([
      page.context().waitForEvent('page').catch(() => null),
      page.click(SUBMIT_SELECTOR, { timeout: 20000 }),
    ]);
    const reportPage = maybeNewPage || page;

    await reportPage.waitForLoadState('domcontentloaded', { timeout: 60000 });
    await reportPage.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    try {
  await reportPage.waitForSelector(`text=${REPORT_READY_TEXT}`, { timeout: 60000 });
} catch {
  // fallback signals if the report text isn't present but page is still ready
  await reportPage.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await reportPage.waitForTimeout(1000);
}

    const buf = await reportPage.screenshot({ type: 'png', fullPage: true });
    const filename = `CARFAX_${vin}_${ts()}.png`;

    fs.mkdirSync(saveDir, { recursive: true });
    const savedPath = path.join(saveDir, filename);
    fs.writeFileSync(savedPath, buf);

    return { status: 'ok', vin, filename, savedPath, buffer: opts.returnBuffer ? buf : undefined, usedStoredSession: storageExists };
  } catch (err) {
    fs.writeFileSync('carfax_debug_error.html', await page.content().catch(() => ''));
    await page.screenshot({ path: 'carfax_debug_error.png', fullPage: true }).catch(() => {});
    return { status: 'error', vin, error: String(err && err.message ? err.message : err) };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
};
