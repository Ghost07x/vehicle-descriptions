const express = require('express');
const dotenv = require('dotenv');
const runCarfaxBot = require('./bots/carfax');
const runWindowStickerBot = require('./bots/windowSticker');
const runDescriberBot = require('./bots/describer');

dotenv.config();
const app = express();
app.use(express.json());

app.post('/carfax', async (req, res) => {
  const vin = req.body.vin;
  if (!vin) return res.status(400).send({ error: 'VIN required' });

  try {
    const result = await runCarfaxBot(vin);
    res.send({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Carfax bot failed' });
  }
});

app.post('/window-sticker', async (req, res) => {
  const vin = req.body.vin;
  if (!vin) return res.status(400).send({ error: 'VIN required' });

  try {
    const result = await runWindowStickerBot(vin);
    res.send({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Window sticker bot failed' });
  }
});

app.post('/generate-description', async (req, res) => {
  const { vin, stock } = req.body;
  if (!vin || !stock) return res.status(400).send({ error: 'VIN and Stock # required' });

  try {
    const result = await runDescriberBot(vin, stock);
    res.send({ success: true, description: result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Description bot failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Vehicle Descriptions API running on port ${PORT}`));
