// index.js
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Import your bots (adjust paths to match your repo)
const windowSticker = require('./windowSticker');     // or './bots/windowSticker'
const carfax        = require('./bots/carfax');       // or './bots/carfax'

// Local save dir if you still want files on disk (also fine on Render temp fs)
const PICTURES_DIR = process.env.SCREENSHOT_DIR
  || path.join(process.cwd(), 'screenshots');

// Return the window sticker as PNG
app.post('/window-sticker/binary', async (req, res) => {
  try {
    const { vin } = req.body || {};
    if (!vin) return res.status(400).json({ error: 'VIN required' });

    const result = await windowSticker(vin, {
      saveDir: PICTURES_DIR,
      returnBuffer: true, // <— important
    });

    if (result.status !== 'ok' || !result.buffer) {
      return res.status(500).json(result);
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="WindowSticker_${vin}.png"`);
    res.send(result.buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Return the CARFAX as PNG
app.post('/carfax/binary', async (req, res) => {
  try {
    const { vin } = req.body || {};
    if (!vin) return res.status(400).json({ error: 'VIN required' });

    const result = await carfax(vin, {
      saveDir: PICTURES_DIR,
      returnBuffer: true, // <— important
    });

    if (result.status !== 'ok' || !result.buffer) {
      return res.status(500).json(result);
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="CARFAX_${vin}.png"`);
    res.send(result.buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Vehicle-Descriptions listening on', PORT));
