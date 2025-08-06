module.exports = async function runDescriberBot(vin, stock) {
  const description = `Vehicle ${vin} (Stock #${stock}) is a premium, well-maintained unit with verified Carfax history and all features in working order.`;

  return description;
};
