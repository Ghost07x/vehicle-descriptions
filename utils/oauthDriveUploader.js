const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
const open = (...args) => import('open').then(m => m.default(...args));

const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });

  console.log('🔑 Authorize this app by visiting this URL:\n', authUrl);
  await open(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise(resolve => rl.question('Paste the code from Google here: ', resolve));
  rl.close();

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✅ Token saved to', TOKEN_PATH);

  return oAuth2Client;
}

async function uploadToDrive(filePath, fileName) {
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
    },
    media: {
      mimeType: 'image/png',
      body: fs.createReadStream(filePath),
    },
    fields: 'id',
  });

  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return `https://drive.google.com/file/d/${res.data.id}/view`;
}

module.exports = uploadToDrive;

// 🔽 Only for manual testing
if (require.main === module) {
  const testPath = './test-image.png';
  const testName = 'TestUpload.png';

  uploadToDrive(testPath, testName)
    .then(link => console.log('✅ Uploaded to:', link))
    .catch(err => console.error('❌ Upload failed:', err.message));
}
