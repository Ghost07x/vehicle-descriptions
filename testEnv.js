require('dotenv').config();

console.log('🔐 Private Key (first 50 chars):', process.env.GOOGLE_PRIVATE_KEY?.substring(0, 50));
console.log('📧 CARFAX_USER:', process.env.CARFAX_USER);
console.log('🔑 CARFAX_PASS:', process.env.CARFAX_PASS);
console.log('📧 VELOCITY_USER:', process.env.VELOCITY_USER);
console.log('🔑 VELOCITY_PASS:', process.env.VELOCITY_PASS);
