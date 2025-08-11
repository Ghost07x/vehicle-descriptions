// utils/oauthDriveUploader.js
// Upload buffers or local files to Google Drive using a SERVICE ACCOUNT.
// Env:
//   GOOGLE_CLIENT_EMAIL
//   GOOGLE_PRIVATE_KEY            // paste with literal \n in Render; this code fixes it
//   GOOGLE_DRIVE_FOLDER_ID        // default target folder (optional)
// Optional alt:
//   GOOGLE_PRIVATE_KEY_BASE64     // base64 version of the full private key

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const mime = require('mime');

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY_BASE64
  ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
  : (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const DEFAULT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.warn('[Drive Uploader] Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY');
}

function makeAuth() {
  return new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

function safeFileName(name) {
  return String(name || 'upload')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// Helper: convert Buffer -> Readable stream
function bufferToStream(buffer) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Verify the service account can see the folder
 * Returns folder metadata if accessible
 */
async function verifyDriveFolder(folderId = DEFAULT_FOLDER_ID) {
  if (!folderId) throw new Error('No folderId provided');
  const auth = makeAuth();
  const drive = google.drive({ version: 'v3', auth });

  const { data } = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, mimeType, driveId, parents',
    supportsAllDrives: true,
  });

  if (data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`Item is not a folder (mimeType=${data.mimeType})`);
  }
  return data;
}

/**
 * Upload a Buffer to Google Drive
 */
async function uploadBufferToDrive(buffer, name, folderId = DEFAULT_FOLDER_ID, opts = {}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('uploadBufferToDrive: buffer must be a Buffer');
  }
  const auth = makeAuth();
  const drive = google.drive({ version: 'v3', auth });

  const finalName = safeFileName(name || `upload_${timestamp()}.bin`);
  const mimeType = opts.mimeType || mime.getType(finalName) || 'application/octet-stream';

  const requestBody = {
    name: finalName,
    parents: folderId ? [folderId] : undefined,
  };

  const file = await drive.files.create({
    requestBody,
    media: { mimeType, body: bufferToStream(buffer) },
    fields: 'id, name, webViewLink, webContentLink, parents',
    supportsAllDrives: true,          // <-- important for Shared Drives
  });

  if (opts.makePublic) {
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  }

  return file.data;
}

/**
 * Upload a local file path to Google Drive
 */
async function uploadLocalFileToDrive(filePath, name, folderId = DEFAULT_FOLDER_ID, opts = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`uploadLocalFileToDrive: file not found: ${filePath}`);
  }
  const auth = makeAuth();
  const drive = google.drive({ version: 'v3', auth });

  const finalName = safeFileName(name || path.basename(filePath));
  const mimeType = opts.mimeType || mime.getType(finalName) || 'application/octet-stream';

  const file = await drive.files.create({
    requestBody: { name: finalName, parents: folderId ? [folderId] : undefined },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id, name, webViewLink, webContentLink, parents',
    supportsAllDrives: true,          // <-- important for Shared Drives
  });

  if (opts.makePublic) {
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  }

  return file.data;
}

module.exports = {
  uploadBufferToDrive,
  uploadLocalFileToDrive,
  verifyDriveFolder,
  // utilities
  safeFileName,
  timestamp,
};
