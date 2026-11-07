// Manual check, not part of the automatic tests: can the robot add a row to a sheet?
// Usage: node test/live-smoke.js <path-to-key.json> <sheetId> <tab>
// Prints only the range written. Never prints the key.
const fs = require('fs');
const { appendRow } = require('../src/sheets');

(async () => {
  const [keyPath, sheetId, tab] = process.argv.slice(2);
  if (!keyPath || !sheetId || !tab) throw new Error('Usage: node test/live-smoke.js <key.json> <sheetId> <tab>');
  // "-" means read the key from stdin, so it can be piped straight from a password vault without touching disk.
  const keyJson = keyPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(keyPath, 'utf8');
  const row = [new Date().toISOString(), 'SMOKE TEST robot write', "=1+1 should stay text", 'test@example.com'];
  const range = await appendRow({ keyJson, sheetId, tab, row });
  console.log('Wrote one row to:', range);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
