// Every supported language must translate every string, keep the {n} marker, and never be empty.
// Usage: node --test test/i18n.test.js   (or: node test/i18n.test.js <code> to check just one and print problems)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../public/schema.js');
const { keys } = require('../scripts/extract-strings.js');

function load(code) {
  const file = path.join(__dirname, '..', 'public', 'i18n', code + '.js');
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  return sandbox.window.I18N[code];
}
function problems(code) {
  const out = [];
  let d;
  try { d = load(code); } catch (e) { return ['cannot load: ' + e.message]; }
  if (!d) return ['no dictionary for ' + code];
  for (const k of keys) {
    const v = d[k];
    if (typeof v !== 'string' || v.trim() === '') { out.push('missing: ' + k); continue; }
    if (k.includes('{n}') && !v.includes('{n}')) out.push('lost {n}: ' + k);
    if (/<[^>]+>/.test(v)) out.push('has html: ' + k);
    if (k.includes('RKMAerial') && !v.includes('RKMAerial')) out.push('lost brand name: ' + k);
    if (/\n/.test(v)) out.push('newline: ' + k);
  }
  for (const k of Object.keys(d)) if (!keys.includes(k)) out.push('unknown key (typo?): ' + k);
  return out;
}

if (require.main === module && process.argv[2]) {
  const p = problems(process.argv[2]);
  console.log(p.length ? p.join('\n') : 'OK: all ' + keys.length + ' strings');
  process.exit(p.length ? 1 : 0);
}

for (const l of S.LANGS.filter(l => l.code !== 'en')) {
  test('translation complete: ' + l.name, () => assert.deepStrictEqual(problems(l.code), []));
}
test('every language has a native name and unique code', () => {
  assert.strictEqual(new Set(S.LANGS.map(l => l.code)).size, S.LANGS.length);
  S.LANGS.forEach(l => assert.ok(l.native && l.name));
});
