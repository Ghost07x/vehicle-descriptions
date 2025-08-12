const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');

const app = express();
const log = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ logger: log }));

// Load bots (case-sensitive on Linux)
const windowSticker = require(path.join(__dirname, 'bots', 'windowSticker.js'));
const carfax        = require(path.join(__dirname, 'bots', 'carfax.js'));

// Optional local save dir
const PICTURES_DIR = process.env.SCREENSHOT_DIR || path.join(process.cwd(), 'screenshots');

// API key middleware
const REQUIRED_API_KEY = process.env.API_KEY;
function requireApiKey(req, res, next) {
  if (!REQUIRED_API_KEY) return res.status(500).json({ error: 'Server missing API_KEY' });
  const key = req.get('X-API-Key');
  if (key !== REQUIRED_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// VIN helpers
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{11}[0-9X][A-HJ-NPR-Z0-9]{5}$/i; // basic ISO 3779 check
function normalizeVin(v) { return String(v || '').trim().toUpperCase(); }
function isVin(v) { return VIN_REGEX.test(normalizeVin(v)); }

// Simple in-process queue to cap concurrency
const MAX_CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 2));
let active = 0;
const q = [];
function next() {
  if (active >= MAX_CONCURRENCY) return;
  const task = q.shift();
  if (!task) return;
  active++;
  task().finally(() => { active--; next(); });
}
function enqueue(fn) {
  return new Promise((resolve, reject) => {
    q.push(async () => {
      try { resolve(await fn()); }
      catch (e) { reject(e); }
    });
    next();
  });
}

// Hydrate storage state from base64 if provided (good for Render)
(function hydrateStorageState() {
  const b64 = process.env.STORAGE_STATE_JSON_BASE64;
  const filePath = process.env.STORAGE_STATE_PATH;
  if (b64 && filePath && !fs.existsSync(filePath)) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(b64, 'base64').toString('utf8'), 'utf8');
      log.info({ filePath }, 'Hydrated CARFAX storageState from base64');
    } catch (e) {
      log.error({ e }, 'Failed to hydrate storage state');
    }
  }
})();

// Health
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Rate limit & auth
const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true });
app.use(limiter);
app.use(requireApiKey);

// Binary endpoints
async function handleBinary(req, res, runner, label) {
  res.setTimeout(180_000); // 3 min
  try {
    const vin = normalizeVin(req.body?.vin);
    if (!vin || !isVin(vin)) return res.status(400).json({ error: 'Valid 17‑char VIN required' });

    const result = await enqueue(() => runner(vin, { saveDir: PICTURES_DIR, returnBuffer: true }));
    if (result.status !== 'ok' || !result.buffer) {
      const code = result.status === 'auth_error' ? 401 : 502;
      return res.status(code).json(result);
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${label}_${vin}.png"`);
    return res.send(result.buffer);
  } catch (e) {
    req.log.error({ err: e }, 'binary endpoint error');
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

app.post('/window-sticker/binary', express.json(), (req, res) =>
  handleBinary(req, res, windowSticker, 'WindowSticker')
);

app.post('/carfax/binary', express.json(), (req, res) =>
  handleBinary(req, res, carfax, 'CARFAX')
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log.info({ PORT }, 'Vehicle-Descriptions listening'));
