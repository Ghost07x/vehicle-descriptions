const { chromium } = require('playwright');

let sharedBrowser;
const HEADLESS = String(process.env.HEADLESS || 'true').toLowerCase() !== 'false';
const ONE_OFF = String(process.env.ONE_OFF_BROWSER || 'false').toLowerCase() === 'true';
const isMac = process.platform === 'darwin';

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--hide-scrollbars',
  ...(isMac ? [] : ['--use-gl=angle', '--use-angle=swiftshader']),
];

async function launch() {
  return chromium.launch({ headless: HEADLESS, args: CHROME_ARGS });
}

async function getBrowser() {
  if (ONE_OFF) return launch();
  if (!sharedBrowser) sharedBrowser = await launch();
  return sharedBrowser;
}

async function newPage(contextOpts = {}) {
  let owned = ONE_OFF;
  let b = await getBrowser();
  try {
    const ctx = await b.newContext({ ...contextOpts });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1366, height: 768 });
    return { page, ctx, _ownedBrowser: owned ? b : null };
  } catch (e) {
    const msg = String(e?.message || e);
    if (!owned && /has been closed/i.test(msg)) {
      try { await sharedBrowser?.close(); } catch {}
      sharedBrowser = null;
      b = await getBrowser();
      const ctx = await b.newContext({ ...contextOpts });
      const page = await ctx.newPage();
      await page.setViewportSize({ width: 1366, height: 768 });
      return { page, ctx, _ownedBrowser: null };
    }
    if (owned) { try { await b.close(); } catch {} }
    throw e;
  }
}

async function waitForPaint(page) {
  await page.waitForSelector('body', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 120000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => {
    const b = document.body; if (!b) return false;
    const rect = b.getBoundingClientRect();
    const hasSize = rect.width > 0 && rect.height > 0;
    const hasText = (b.innerText || '').trim().length > 0;
    return hasSize && hasText;
  }, { timeout: 15000 }).catch(() => {});
}

module.exports = { newPage, waitForPaint };

