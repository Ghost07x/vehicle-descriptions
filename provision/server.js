// server.js
require('dotenv').config();
const express = require('express');
const { fetchProvisionData } = require('./provision');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/provision/fetch', async (req, res) => {
  try {
    const vin = req.body?.vin;
    if (!vin) return res.status(400).json({ error: 'Missing vin' });

    const data = await fetchProvisionData(vin);
    return res.json({ status: 'ok', vin, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: String(err?.message || err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Provision service listening on :${port}`));
