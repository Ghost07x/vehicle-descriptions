const path = require('path');
const fs = require('fs');
const { newPage, waitForPaint } = require('./browser');

const ENTRY = process.env.WINDOW_STICKER_ENTRY;

module.exports = async function windowSticker(vin, { saveDir, returnBuffer } = {}) {
  const safeVin = String(vin || '').trim().toUpperCase();
  const filename = `WindowSticker_${safeVin}.png`;
  const savedPath = saveDir ? path.join(saveDir, filename) : undefined;

  const { page, ctx, _ownedBrowser } = await newPage();
  try {
    if (!ENTRY) throw new Error('WINDOW_STICKER_ENTRY not set');
    const url = ENTRY.includes('{vin}') ? ENTRY.replace('{vin}', safeVin) : ENTRY;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // If your site needs a VIN form submit, add it here.

    const isPdfLike = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('embed,object,iframe'));
      return nodes.some(el => {
        const t = (el.type || el.getAttribute('type') || '').toLowerCase();
        const src = (el.src || el.data || '').toLowerCase();
        return t.includes('application/pdf') || /\.pdf(\b|[#?])/.test(src);
      });
    });

    await waitForPaint(page);

    const candidates = [
      'text=/Window\\s*Sticker|Monroney|MSRP/i',
      '#sticker',
      '.sticker',
      'canvas',
    ];
    let target = null;
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      const count = await loc.count().catch(() => 0);
      if (count > 0) { target = loc; break; }
    }

    let buffer = null;
    if (target) buffer = await target.screenshot({ path: savedPath }).catch(() => null);
    if (!buffer) buffer = await page.screenshot({ fullPage: false, path: savedPath });

    const out = { status: 'ok', vin: safeVin, filename };
    if (savedPath) out.savedPath = savedPath;
    if (returnBuffer) out.buffer = buffer;
    if (isPdfLike && (!buffer || buffer.length < 5000)) out.note = 'PDF viewer detected; headless screenshots can be blank.';
    return out;
  } catch (e) {
    return { status: 'error', vin: safeVin, filename, error: e?.message || String(e) };
  } finally {
    try { await ctx.close(); } catch {}
    if (_ownedBrowser) { try { await _ownedBrowser.close(); } catch {} }
  }
};
