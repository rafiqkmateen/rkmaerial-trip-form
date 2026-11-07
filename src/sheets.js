// The ONLY place that talks to Google Sheets. If usage ever outgrows Sheets, replace this one file.
// Uses WebCrypto (works in Cloudflare Workers and in Node 18+), so no packages are needed.
// The service account key is passed in as a string (a Cloudflare secret in production). It is never logged.

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const enc = new TextEncoder();

async function importKey(pem) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function accessToken(keyJson) {
  const key = JSON.parse(keyJson);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc.encode(JSON.stringify({
    iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importKey(key.private_key), enc.encode(head + '.' + claim));
  const jwt = head + '.' + claim + '.' + b64url(new Uint8Array(sig));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwt),
  });
  const t = await r.json();
  if (!r.ok) throw new Error('token request failed: ' + (t.error || r.status));
  return t.access_token;
}

// Append ONE row as plain text (RAW). Returns the updated range.
async function appendRow({ keyJson, sheetId, tab, row }) {
  const token = await accessToken(keyJson);
  const range = encodeURIComponent("'" + tab + "'");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error('append failed: ' + r.status + ' ' + JSON.stringify(data.error && data.error.message));
  return data.updates && data.updates.updatedRange;
}

module.exports = { appendRow, accessToken };
