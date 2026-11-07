// Adds one new string's translations to every language file. Usage: edit T below, run once.
const fs = require('fs');
const path = require('path');
const KEY = 'The destination must be different from where you leave from.';
const T = {
  es: 'El destino debe ser distinto del lugar de salida.',
  pt: 'O destino deve ser diferente do local de partida.',
  it: 'La destinazione deve essere diversa dal luogo di partenza.',
  fr: 'La destination doit être différente du lieu de départ.',
  de: 'Das Ziel muss sich vom Abflugort unterscheiden.',
  ru: 'Пункт назначения должен отличаться от пункта отправления.',
  nl: 'De bestemming moet anders zijn dan de plaats van vertrek.',
  pl: 'Miejsce docelowe musi być inne niż miejsce wylotu.',
  tr: 'Varış yeri, kalkış yerinden farklı olmalı.',
  zh: '目的地不能与出发地相同。',
  ja: '目的地は出発地と異なる必要があります。',
  ko: '도착지는 출발지와 달라야 합니다.',
};
for (const [code, text] of Object.entries(T)) {
  const file = path.join(__dirname, '..', 'public', 'i18n', code + '.js');
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(JSON.stringify(KEY))) { console.log(code, 'already has it'); continue; }
  const end = s.lastIndexOf('}');
  let head = s.slice(0, end).replace(/\s+$/, '');
  if (!head.endsWith(',') && !head.endsWith('{')) head += ',';
  s = head + '\n  ' + JSON.stringify(KEY) + ': ' + JSON.stringify(text) + '\n' + s.slice(end);
  fs.writeFileSync(file, s);
  console.log(code, 'added');
}
