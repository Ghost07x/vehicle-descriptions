import dotenv from 'dotenv';
dotenv.config();

const { google } = await import('googleapis');

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/drive']
);

const drive = google.drive({ version: 'v3', auth });

const folderId = '1KwZna8X7yGG59xHqsB4Y3xR2NXqj_Dn1';

try {
  const result = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, driveId, parents',
    supportsAllDrives: true,
  });

  console.log('✅ Folder Info:', result.data);
} catch (err) {
  console.error('❌ Error fetching folder info:', err.message);
}
