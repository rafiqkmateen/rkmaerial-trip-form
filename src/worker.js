// Cloudflare Worker: serves the page (static assets) and handles POST /api/submit and GET /api/prefill.
// Every check is repeated here; the page's checks are only for convenience.
// Secrets/vars (Cloudflare secrets in production, in-memory in tests):
//   GOOGLE_SA_KEY (secret), SHEET_ID, SHEET_TAB, TIMEZONE, ALLOWED_ORIGIN (optional),
//   TURNSTILE_SECRET (optional until step 3), PREFILL (secret JSON: { "<tag>": { fieldId: value } }).
const SCHEMA = require('../public/schema.js');
const { clean, guardCell, looksSuspicious } = require('./safety');
const sheets = require('./sheets');

const MAX_BODY = 20000;          // bytes
const MIN_FILL_MS = 4000;        // faster than this is a bot
const RATE_MAX = 6, RATE_WINDOW = 10 * 60 * 1000; // per visitor per isolate; add a Cloudflare rate-limit rule in production
const hits = new Map();

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// Date as the sheet wants it: M/D/YYYY, timestamp M/D/YYYY HH:MM:SS, in the business time zone.
function zoneParts(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(x => [x.type, x.value]));
  return p;
}
const todayIso = (tz, now = new Date()) => {
  const p = zoneParts(now, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};
const stamp = (tz, now = new Date()) => {
  const p = zoneParts(now, tz);
  return `${+p.month}/${+p.day}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
};
const mdy = iso => { const [y, m, d] = iso.split('-'); return `${+m}/${+d}/${y}`; };

// Turn validated answers into one sheet row (array in COLUMNS order). Pure, so it is easy to test.
function buildRow(cleanAnswers, { lang = 'en', tz = 'America/New_York', now = new Date() } = {}) {
  const a = cleanAnswers;
  let flagged = false;
  const out = {};
  for (const f of SCHEMA.fieldList) {
    let v = a[f.id];
    if (v === undefined) v = f.id === 'children' || f.id === 'infants' ? '' : '';
    if (f.type === 'date' && v) v = mdy(v);
    if (f.free && v) {
      if (looksSuspicious(v)) flagged = true;
      v = guardCell(v);
    }
    out[f.col || f.id] = v;
  }
  const svc = (a.services || '').split(', ');
  out['Do you want flight prices?'] = svc.includes('Flights') ? 'Yes' : 'No';
  out['Do you need a rental car?'] = svc.includes('Car') ? 'Yes' : 'No';
  out['Do you want hotel prices?'] = svc.includes('Hotel') ? 'Yes' : 'No';
  out['Timestamp'] = stamp(tz, now);
  out['Language'] = (SCHEMA.LANGS.find(l => l.code === lang) || SCHEMA.LANGS[0]).name; // English name, so the report knows what to write in
  out['Looks suspicious?'] = flagged ? 'CHECK' : '';
  out['Handled'] = '';
  return SCHEMA.COLUMNS.map(h => out[h] === undefined ? '' : String(out[h]));
}

function originOk(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin form posts from some browsers omit it; other checks still apply
  if (origin === new URL(request.url).origin) return true; // the page and the Worker are the same site
  return !!env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN;
}

async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET) return true; // not switched on yet
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || '' }),
  });
  const d = await r.json().catch(() => ({}));
  return d.success === true;
}

async function submit(request, env) {
  if (!originOk(request, env)) return json({ ok: false, error: 'origin' }, 403);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (rateLimited(ip)) return json({ ok: false, error: 'rate' }, 429);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: 'size' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'json' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'json' }, 400);

  // Bots: a filled hidden field, or a form sent faster than a person could fill it. Pretend it worked, write nothing.
  if (clean(body.website, 50) !== '' || !(Number(body.fillMs) >= MIN_FILL_MS)) return json({ ok: true });

  if (!(await verifyTurnstile(body.turnstile, ip, env))) return json({ ok: false, error: 'bot' }, 403);

  const tz = env.TIMEZONE || 'America/New_York';
  const { errors, clean: answers } = SCHEMA.validate(body.values && typeof body.values === 'object' ? body.values : {}, todayIso(tz));
  if (Object.keys(errors).length) return json({ ok: false, error: 'invalid', errors }, 400);

  const lang = SCHEMA.LANGS.some(l => l.code === body.lang) ? body.lang : 'en';
  const row = buildRow(answers, { lang, tz });
  try {
    await sheets.appendRow({ keyJson: env.GOOGLE_SA_KEY, sheetId: env.SHEET_ID, tab: env.SHEET_TAB, row });
  } catch (e) {
    console.error('sheet write failed:', e.message); // never include the key or the answers
    return json({ ok: false, error: 'server' }, 502);
  }
  return json({ ok: true });
}

function prefill(url, env) {
  const tag = (url.searchParams.get('p') || '').slice(0, 64);
  let profiles = {};
  try { profiles = env.PREFILL ? JSON.parse(env.PREFILL) : {}; } catch { /* ignore */ }
  const p = Object.prototype.hasOwnProperty.call(profiles, tag) ? profiles[tag] : null;
  return p ? json({ ok: true, values: p }) : json({ ok: false }, 404);
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/submit') return request.method === 'POST' ? submit(request, env) : json({ ok: false }, 405);
  if (url.pathname === '/api/prefill') return request.method === 'GET' ? prefill(url, env) : json({ ok: false }, 405);
  if (url.pathname.startsWith('/api/')) return json({ ok: false }, 404);
  return env.ASSETS.fetch(request);
}

module.exports = { fetch: handle, buildRow, todayIso, stamp, _hits: hits };
