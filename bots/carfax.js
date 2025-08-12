const path = require('path');
const fs = require('fs');
const { newPage, waitForPaint } = require('./browser');

const STORAGE_STATE_PATH = process.env.STORAGE_STATE_PATH || '/tmp/carfax_storageState.json';

module.exports = async function carfax(vin, { saveDir, returnBuffer } = {}) {
  const safeVin = String(vin || '').trim().toUpperCase();
  const filename = `CARFAX_${safeVin}.png`;
  const savedPath = saveDir ? path.join(saveDir, filename) : undefined;

  const ctxOpts = { acceptDownloads: false };
  if (fs.existsSync(STORAGE_STATE_PATH)) ctxOpts.storageState = STORAGE_STATE_PATH;

  const { page, ctx, _ownedBrowser } = await newPage(ctxOpts);
  try {
    await page.goto('https://www.carfaxonline.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

    const looksLikeLogin = await page.$('input[type="password"], [name="password"], text=/Sign[ -]?In/i');
    if (looksLikeLogin) {
      return { status: 'auth_error', vin: safeVin, filename, error: 'CARFAX session expired or missing' };
    }

    const vinInput = await page.$('input[name="vin"], input#vin, [placeholder*="VIN" i]');
    if (vinInput) {
      await vinInput.fill(safeVin);
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForLoadState('networkidle', { timeout: 120000 }),
      ]);
    } else {
      await page.goto(`https://www.carfaxonline.com/vhrs/report/${safeVin}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
    }

    const reportEl = await page.waitForSelector('text=/Vehicle\\s*History\\s*Report|CARFAX\\s*Report/i', { timeout: 15000 }).catch(() => null);
    await waitForPaint(page);

    let buffer = null;
    if (reportEl) buffer = await reportEl.screenshot({ path: savedPath }).catch(() => null);
    if (!buffer) buffer = await page.screenshot({ fullPage: false, path: savedPath });

    const out = { status: 'ok', vin: safeVin, filename };
    if (savedPath) out.savedPath = savedPath;
    if (returnBuffer) out.buffer = buffer;
    if (!reportEl) out.note = 'Did not detect report marker; screenshot may not be the report.';
    return out;
  } catch (e) {
    return { status: 'error', vin: safeVin, filename, error: e?.message || String(e) };
  } finally {
    try { await ctx.close(); } catch {}
    if (_ownedBrowser) { try { await _ownedBrowser.close(); } catch {} }
  }
};
