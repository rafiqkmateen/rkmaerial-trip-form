// Input safety helpers. Pure functions, no network, so they are easy to test.
// Used by the server step before anything is written to the sheet.

// Remove control characters (keep tab and newline) and trim.
function clean(value, maxLen) {
  let s = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// A sheet treats text starting with = + - @ (or tab/CR) as a formula. Guard it with a leading apostrophe.
// Cells are also written as RAW text, so Sheets never runs them; this guard protects later CSV/Excel exports.
// The apostrophe becomes a visible character in a RAW cell, so use this on free-text fields only,
// NOT on phone or email fields (a phone like +1470... must stay exactly as typed).
function guardCell(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

// Looks like it is trying to talk to an AI or carry code or links. Only a flag for a human, never a block.
const SUSPICIOUS = [
  /ignore (all |any |your |the )*(previous |prior |above )?instructions/i,
  /system prompt/i,
  /you are (now )?(an? )?(ai|assistant|claude|chatgpt)/i,
  /mark(ed)?\s+(this\s+)?(row\s+)?(as\s+)?(handled|done)/i,
  /<\s*\/?\s*(script|iframe|img|svg|object|embed)/i,
  /javascript:/i,
  /https?:\/\//i,
  /=\s*(IMPORT\w+|HYPERLINK|WEBSERVICE|IMAGE)\s*\(/i,
];
function looksSuspicious(s) {
  return SUSPICIOUS.some(re => re.test(s));
}

// Simple, forgiving email shape check. Accepts non-English letters. Not a deliverability test.
function normalizeEmail(s) {
  return clean(s, 254).toLowerCase();
}
function isEmailShape(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(s);
}
function emailsMatch(a, b) {
  const x = normalizeEmail(a), y = normalizeEmail(b);
  return x !== '' && x === y && isEmailShape(x);
}

module.exports = { clean, guardCell, looksSuspicious, normalizeEmail, isEmailShape, emailsMatch };
