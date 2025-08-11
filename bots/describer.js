// bots/describer.js
// Generates a single-paragraph, professional vehicle description (no em dashes).
// Keep it ~1500–2200 chars; tuned for copy/paste.

function sanitize(s = '') {
  return String(s).replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim();
}

module.exports = function buildDescription(data = {}) {
  const {
    vin = '',
    stock = '',
    year = '',
    make = '',
    model = '',
    trim = '',
    engine = '',
    transmission = '',
    drivetrain = '',
    mpgCity,
    mpgHwy,
    colorExt = '',
    colorInt = '',
    mileage,
    packages = [],
    features = [],
    warranties = [],
  } = data;

  const name = [year, make, model, trim].filter(Boolean).join(' ');
  const mpgText = mpgCity && mpgHwy ? `Rated at approximately ${mpgCity} MPG city and ${mpgHwy} MPG highway,` : '';
  const warrantyText = warranties.length ? ` Backed by ${warranties.join(', ')},` : '';
  const pkgText = packages.length ? ` Key packages include ${packages.join(', ')}.` : '';
  const featCore = features.length ? ` Highlights include ${features.slice(0, 30).join(', ')}.` : '';

  // One tight paragraph for inventory systems
  const paragraph = `${name} ${stock ? `(Stock #${stock})` : ''} presents a confident blend of everyday comfort and real-world performance. ${mpgText} this ${drivetrain || 'well-equipped model'} pairs ${engine || 'a capable powertrain'} with ${transmission || 'a smooth-shifting transmission'} for steady response in city traffic and relaxed highway cruising. The exterior in ${colorExt || 'a clean finish'} is matched by a ${colorInt || 'neat, functional'} interior with intuitive controls, supportive seating, and useful storage. Condition reflects responsible prior use${typeof mileage === 'number' ? ` with approximately ${mileage.toLocaleString()} miles` : ''}, and it has been inspected to our store standards with a focus on safety, drivability, and appearance.${warrantyText} you get added peace of mind, plus straightforward ownership costs over time.${pkgText} ${featCore} This vehicle is front-line ready and easy to recommend if you want a solid, honest presentation without the fluff. VIN ${vin || 'available on request'}. Please reach out to confirm availability, review the service history, or schedule a drive today.`;

  return sanitize(paragraph);
};
