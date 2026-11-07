// Lists every English text the page can show (the keys translators fill in). Writes i18n-src/keys.json.
const fs = require('fs');
const path = require('path');
const S = require('../public/schema.js');
const root = path.join(__dirname, '..');
const set = new Set();
const add = s => { if (s && /[A-Za-z]/.test(s)) set.add(s); };

for (const sec of S.sections) {
  add(sec.title);
  for (const f of sec.fields) {
    add(f.label); add(f.hint);
    if (f.labels) Object.values(f.labels).forEach(add);
    if (Array.isArray(f.options)) f.options.forEach(o => { if (!(f.labels && f.labels[o])) add(o); });
  }
}
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const re = /K\((?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\)/g;
for (const m of app.matchAll(re)) add((m[1] !== undefined ? m[1] : m[2]).replace(/\\(['"])/g, '$1'));
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const m of html.matchAll(/<(\w+)[^>]*data-i18n[^>]*>([^<]+)</g)) add(m[2].trim());
add('RKMAerial | Trip request');

const dropCodes = new Set(S.byId.budgetCurrency.options);
dropCodes.delete('Other');
const keys = [...set].filter(k => !dropCodes.has(k)).sort();
fs.mkdirSync(path.join(root, 'i18n-src'), { recursive: true });
fs.writeFileSync(path.join(root, 'i18n-src/keys.json'), JSON.stringify(keys, null, 1));
module.exports = { keys };
if (require.main === module) console.log(keys.length + ' strings');
