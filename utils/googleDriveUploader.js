const { google } = require('googleapis');
const fs = require('fs');

async function uploadToDrive(filePath, fileName) {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
  );

  const drive = google.drive({ version: 'v3', auth });

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      // 🔽 REMOVE this line for now
      // parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: 'image/png',
      body: fs.createReadStream(filePath),
    },
    supportsAllDrives: true,
    fields: 'id',
  });

  await drive.permissions.create({
    fileId: file.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  return `https://drive.google.com/file/d/${file.data.id}/view`;
}

module.exports = uploadToDrive;
