const express = require('express');
const dotenv = require('dotenv');
const runCarfaxBot = require('./bots/carfax');
const runWindowStickerBot = require('./bots/windowSticker');
const runDescriberBot = require('./bots/describer');

dotenv.config();
const app = express();
app.use(express.json());

// 🧾 /carfax route
app.post('/carfax', async (req, res) => {
  const vin = req.body.vin;
  if (!vin) return res.status(400).send({ error: 'VIN required' });

  try {
    const result = await runCarfaxBot(vin);
    res.send({ success: true, result });
  } catch (err) {
    console.error('❌ Carfax bot failed:', err);
    res.status(500).send({ error: 'Carfax bot failed', message: err.message });
  }
});

// 🪪 /window-sticker route
app.post('/window-sticker', async (req, res) => {
  const vin = req.body.vin;
  if (!vin) return res.status(400).send({ error: 'VIN required' });

  try {
    const result = await runWindowStickerBot(vin);
    res.send({ success: true, result });
  } catch (err) {
    console.error('❌ Window Sticker bot failed:', err);
    res.status(500).send({ error: 'Window sticker bot failed', message: err.message });
  }
});

// ✍️ /generate-description route
app.post('/generate-description', async (req, res) => {
  const { vin, stock } = req.body;
  if (!vin || !stock) {
    return res.status(400).send({ error: 'VIN and Stock # required' });
  }

  try {
    const result = await runDescriberBot(vin, stock);
    res.send({ success: true, description: result });
  } catch (err) {
    console.error('❌ Description bot failed:', err);
    res.status(500).send({ error: 'Description bot failed', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Vehicle Descriptions API running on port ${PORT}`);
});
