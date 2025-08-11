require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'storage', 'provision.json');
const SELECTORS_PATH = path.join(__dirname, 'selectors.json');

const BASE_URL = process.env.PROVISION_BASE_URL;
const HEADLESS = String(process.env.HEADLESS || 'true') === 'true';
const TIMEOUT = parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS || '45000', 10);

function readSelectors() {
  if (!fs.existsSync(SELECTORS_PATH)) {
    throw new Error(`selectors.json not found at ${SELECTORS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(SELECTORS_PATH, 'utf8'));
}

async function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function loginIfNeeded(page, selectors) {
  await page.goto(BASE_URL, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });

  try {
    await page.waitForSelector(selectors.login.postLoginAnchor, { timeout: 5000 });
    return;
  } catch (_) {}

  console.log("Logging in through SSO...");

  await page.fill(selectors.login.username, process.env.V_AUTO_USER, { timeout: TIMEOUT });
  await page.click(selectors.login.nextButton, { timeout: TIMEOUT });
  await page.fill(selectors.login.password, process.env.V_AUTO_PASS, { timeout: TIMEOUT });
  await page.click(selectors.login.signInButton, { timeout: TIMEOUT });

  // Handle SMS verification on first run
  try {
    await page.click(selectors.login.verifyBySms, { timeout: 5000 });
    console.log("Waiting for OTP input...");
    // Pause here so you can manually type OTP the first time
    await page.pause();
    await page.click(selectors.login.verifyButton, { timeout: TIMEOUT });
  } catch {
    console.log("No SMS verification prompt this run.");
  }

  await page.waitForSelector(selectors.login.postLoginAnchor, { timeout: TIMEOUT });
  await page.context().storageState({ path: STORAGE_PATH });
}

async function fetchProvisionData(vin) {
  const selectors = readSelectors();
  await ensureDir(path.join(__dirname, 'storage'));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    storageState: fs.existsSync(STORAGE_PATH) ? STORAGE_PATH : undefined
  });
  const page = await context.newPage();

  try {
    await loginIfNeeded(page, selectors);

    // Navigate to store inventory
    await page.click(selectors.inventory.hqLink, { timeout: TIMEOUT });
    await page.click(selectors.inventory.storeLink, { timeout: TIMEOUT });
    await page.click(selectors.inventory.pricingTab, { timeout: TIMEOUT });

    // Switch to desired report
    await page.click(selectors.inventory.reportsCustomize, { timeout: TIMEOUT });
    await page.click(selectors.inventory.switchReportLink, { timeout: TIMEOUT });
    await page.click(selectors.inventory.vehicleInventoryLink, { timeout: TIMEOUT });

    // Filter for Retail vehicles
    await page.click(selectors.inventory.filtersButton, { timeout: TIMEOUT });
    await page.check(selectors.inventory.retailCheckbox, { timeout: TIMEOUT });
    await page.click(selectors.inventory.searchButton, { timeout: TIMEOUT });

    // Search for VIN
    await page.fill(selectors.inventory.vinSearchBox, vin, { timeout: TIMEOUT });
    await page.click(selectors.inventory.goButton, { timeout: TIMEOUT });

    // Open first matching vehicle
    await page.click(selectors.inventory.firstVehicleLink, { timeout: TIMEOUT });

    // Click Carfax (opens popup)
    const popupPromise = page.waitForEvent('popup');
    const frame = await page.frameLocator('#GaugePageIFrame');
    await frame.locator('#carfax').click();
    const carfaxPage = await popupPromise;

    console.log(`Carfax page URL for ${vin}: ${carfaxPage.url()}`);

    return { vin, carfaxUrl: carfaxPage.url() };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const vin = process.argv[2];
  if (!vin) {
    console.error('Usage: node provision.js <VIN>');
    process.exit(1);
  }
  fetchProvisionData(vin)
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));
}

module.exports = { fetchProvisionData };
