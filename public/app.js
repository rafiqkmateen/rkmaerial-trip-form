// Draws the form from schema.js, shows/hides sections, checks answers live, sends to /api/submit.
// Answers are only ever put into the page with textContent / value, never as HTML.
// Text shown to people goes through T(): the English text is the key, translations live in i18n/<code>.js.
// What is sent to the sheet is always the English value, whatever language the page shows.
(function () {
  'use strict';
  var S = window.SCHEMA;
  var I18N = window.I18N = window.I18N || {};
  var K = function (s) { return s; }; // marks a string for the translation extractor

  var lang = 'en';
  function T(s) { var d = I18N[lang]; return (d && d[s]) || s; }

  var MSG = {
    required: K('Please answer this.'),
    emailShape: K("That doesn't look like an email address."),
    emailMismatch: K("The emails don't match. Please retype."),
    badValue: K('Please choose one of the options.'),
    tooLong: K('That is too long.'),
    phoneShape: K('Please enter a phone number with the country code. Digits, spaces and + only.'),
    badDate: K('Please pick a valid date.'),
    datePast: K('This date is in the past.'),
    dateOrder: K('This date must come after the earlier one.'),
    badTime: K('Please enter a valid time.'),
    samePlace: K('The destination must be different from where you leave from.'),
    number: K('Please enter a valid number.'),
    consent: K('Please tick this box to continue.'),
    pickAirport: K('Please choose an airport for this city.')
  };
  var X = {
    select: K('Select...'), send: K('Send my request'), sending: K('Sending...'),
    one: K('1 answer still needed'), many: K('{n} answers still needed'), ready: K('Everything looks good.'),
    fail: K('Something went wrong and nothing was sent. Please try again in a minute.'),
    rate: K('Too many tries. Please wait a few minutes and try again.'),
    usual: K('Your usual'), honey: K('Leave this empty'), langLabel: K('Language'),
    pick: K('Choose an airport'), allAirports: K('All airports')
  };

  var form = document.getElementById('form');
  var startedAt = Date.now();
  var touched = {};
  var submitted = false;
  var sending = false;
  var statusError = null; // key of a sending error currently shown
  var els = {};          // field id -> { wrap, inputs[], err }
  var secEls = {};       // section id -> element
  var shown = {};        // section id -> was visible
  var prefillChoices = {}; // field id -> [values] shown first ("your usual")
  var pickers = {};        // From/To field id -> its airport picker (select)

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function localToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---- language ----
  function supported(code) { return S.LANGS.some(function (l) { return l.code === code; }); }
  function pickLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q && supported(q)) return q;
    try { var saved = localStorage.getItem('lang'); if (saved && supported(saved)) return saved; } catch (e) { /* storage blocked */ }
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i]).toLowerCase();
      var base = tag.split('-')[0];
      if (base === 'zh' && /hant|tw|hk|mo/.test(tag)) continue; // Traditional Chinese is not offered: try the next language, else English
      if (supported(base)) return base;
    }
    return 'en';
  }
  function loadLang(code) {
    return new Promise(function (resolve) {
      if (code === 'en' || I18N[code]) { resolve(); return; }
      var s = document.createElement('script');
      s.src = 'i18n/' + code + '.js';
      s.onload = resolve; s.onerror = function () { resolve(); }; // missing file: English shows
      document.head.appendChild(s);
    });
  }
  function optionText(f, o) {
    if (f.options === 'countries') return countryName(o);
    return T((f.labels && f.labels[o]) || o);
  }
  var dnCache = {};
  function countryName(englishName) {
    if (lang === 'en') return englishName;
    if (!dnCache.lang || dnCache.lang !== lang) {
      var map = {};
      try {
        var dn = new Intl.DisplayNames([lang === 'zh' ? 'zh-Hans' : lang], { type: 'region' });
        S.countryEntries().forEach(function (e) { map[e.name] = dn.of(e.code) || e.name; });
      } catch (e) { /* old browser: English names */ }
      dnCache = { lang: lang, map: map };
    }
    return dnCache.map[englishName] || englishName;
  }
  function applyStatic() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      if (!n.dataset.en) n.dataset.en = n.textContent;
      n.textContent = T(n.dataset.en);
    });
    document.title = T('RKMAerial | Trip request');
    var sel = document.getElementById('lang');
    if (sel) { sel.setAttribute('aria-label', T(X.langLabel)); sel.value = lang; }
  }
  function buildLangPicker() {
    var sel = document.getElementById('lang');
    S.LANGS.forEach(function (l) {
      var o = document.createElement('option'); o.value = l.code; o.textContent = l.native; sel.appendChild(o);
    });
    sel.addEventListener('change', function () { setLang(sel.value); });
  }
  function setLang(code) {
    try { localStorage.setItem('lang', code); } catch (e) { /* ignore */ }
    loadLang(code).then(function () {
      var vals = collect();
      lang = code;
      rebuild(vals);
    });
  }

  // ---- drawing ----
  function build() {
    S.sections.forEach(function (sec) {
      var card = el('section', 'card');
      card.appendChild(el('h2', null, T(sec.title)));
      var grid = el('div', 'grid two');
      card.appendChild(grid);
      sec.fields.forEach(function (f) { grid.appendChild(buildField(f)); });
      form.appendChild(card);
      secEls[sec.id] = card;
    });

    // honeypot: people never see or fill this
    var hp = el('div', 'hp'); hp.setAttribute('aria-hidden', 'true');
    var hpl = el('label', null, T(X.honey));
    var hpi = document.createElement('input');
    hpi.type = 'text'; hpi.name = 'website'; hpi.tabIndex = -1; hpi.autocomplete = 'off'; hpi.id = 'website';
    hpl.htmlFor = 'website'; hp.appendChild(hpl); hp.appendChild(hpi); form.appendChild(hp);

    var actions = el('div', 'actions');
    var ts = el('div', 'ts'); ts.id = 'ts'; actions.appendChild(ts); // Cloudflare Turnstile (bot check) draws here when switched on
    var btn = el('button', 'submit', T(X.send));
    btn.type = 'submit'; btn.id = 'send';
    var st = el('p', 'status'); st.id = 'status'; st.setAttribute('aria-live', 'polite');
    actions.appendChild(btn); actions.appendChild(st);
    form.appendChild(actions);
  }

  function buildField(f) {
    var wrap = el('div', 'field');
    var id = 'f_' + f.id;
    var wide = f.type === 'textarea' || f.type === 'checks' || f.type === 'radio' || f.type === 'consent' || f.id === 'services';
    if (wide) wrap.classList.add('wide');
    var inputs = [];
    var hintId = f.hint ? id + '_hint' : null;
    var errId = id + '_err';
    var err = el('p', 'err'); err.id = errId; err.hidden = true; err.setAttribute('role', 'alert');
    var labelText = T(f.label);

    if (f.type === 'note') {
      wrap.classList.add('wide');
      wrap.appendChild(el('p', 'hint note', labelText));
      els[f.id] = { wrap: wrap, inputs: [], err: err, f: f };
      return wrap;
    }
    if (f.type === 'radio' || f.type === 'checks') {
      var fs = el('fieldset');
      fs.appendChild(el('legend', 'lab', labelText));
      if (f.hint) { var h = el('p', 'hint', T(f.hint)); h.id = hintId; fs.appendChild(h); }
      var opts = el('div', 'opts');
      S.optionsOf(f).forEach(function (o) {
        var lab = el('label', 'opt');
        var inp = document.createElement('input');
        inp.type = f.type === 'radio' ? 'radio' : 'checkbox';
        inp.name = f.id; inp.value = o;
        lab.appendChild(inp);
        lab.appendChild(el('span', null, optionText(f, o)));
        opts.appendChild(lab); inputs.push(inp);
      });
      fs.appendChild(opts); wrap.appendChild(fs);
    } else if (f.type === 'consent') {
      var cl = el('label', 'consent');
      var ci = document.createElement('input'); ci.type = 'checkbox'; ci.id = id; ci.value = 'yes';
      cl.appendChild(ci); cl.appendChild(el('span', null, labelText));
      wrap.appendChild(cl); inputs.push(ci);
    } else {
      var lab2 = el('label', null, labelText); lab2.htmlFor = id; wrap.appendChild(lab2);
      var h2 = null; if (f.hint) { h2 = el('p', 'hint', T(f.hint)); h2.id = hintId; if (wide) wrap.appendChild(h2); }
      var inp2;
      if (f.type === 'select') {
        inp2 = document.createElement('select');
        var ph = document.createElement('option'); ph.value = ''; ph.textContent = T(X.select); inp2.appendChild(ph);
        var list = S.optionsOf(f).map(function (o) { return { v: o, t: optionText(f, o) }; });
        if (f.options === 'countries' && lang !== 'en') {
          var coll = new Intl.Collator(lang === 'zh' ? 'zh-Hans' : lang);
          list.sort(function (a, b) { return coll.compare(a.t, b.t); });
        }
        var usual = prefillChoices[f.id];
        if (usual) {
          var og = document.createElement('optgroup'); og.label = T(X.usual);
          usual.forEach(function (c) { var op = document.createElement('option'); op.value = c; op.textContent = optionText(f, c); og.appendChild(op); });
          inp2.appendChild(og);
        }
        list.forEach(function (o) { var op = document.createElement('option'); op.value = o.v; op.textContent = o.t; inp2.appendChild(op); });
        if (f.dflt) inp2.value = f.dflt;
      } else if (f.type === 'textarea') {
        inp2 = document.createElement('textarea'); inp2.maxLength = f.max || 500;
      } else {
        inp2 = document.createElement('input');
        inp2.type = f.type === 'number' || f.type === 'integer' ? 'text' : f.type; // text + inputmode: no browser spinners or "e"
        if (f.max && inp2.type !== 'date' && inp2.type !== 'time') inp2.maxLength = f.max;
        if (f.inputmode) inp2.inputMode = f.inputmode;
        if (f.type === 'date') inp2.min = localToday();
      }
      inp2.id = id; inp2.name = f.id;
      if (f.autocomplete) inp2.autocomplete = f.autocomplete;
      if (f.type === 'email') { inp2.autocapitalize = 'off'; inp2.spellcheck = false; }
      if (f.noPaste) blockPaste(inp2);
      wrap.appendChild(inp2); inputs.push(inp2); if (h2 && !wide) wrap.appendChild(h2); // hints sit under the box so side-by-side boxes line up
      if (f.id === 'from' || f.id === 'to') { // big city typed: the person must pick an airport (see schema.js METROS)
        var pk = document.createElement('select');
        pk.className = 'picker'; pk.hidden = true; pk.setAttribute('aria-label', T(X.pick));
        pk.addEventListener('change', function () { applyPick(inp2, pk); });
        wrap.appendChild(pk);
        pickers[f.id] = pk;
      }
    }
    var desc = [hintId, errId].filter(Boolean).join(' ');
    inputs.forEach(function (i) { i.setAttribute('aria-describedby', desc); if (f.req) i.setAttribute('aria-required', 'true'); });
    wrap.appendChild(err);
    els[f.id] = { wrap: wrap, inputs: inputs, err: err, f: f };
    return wrap;
  }

  // Airport picker under From / To. Shows when the text names a city with several airports; picking writes
  // "City (JFK)" or "City, all airports (JFK, LGA, EWR)" into the box, in English, whatever the page language.
  function applyPick(input, pk) {
    if (!pk.value) return;
    input.value = pk.value;
    pk.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function refreshPickers() {
    Object.keys(pickers).forEach(function (id) {
      var pk = pickers[id], e = els[id];
      var noAll = id === 'to' && (collect().services || []).indexOf('Car') >= 0; // the car needs one destination airport
      if (noAll && e && /, all airports \(/.test(e.inputs[0].value)) e.inputs[0].value = e.inputs[0].value.replace(/, all airports \(.*$/, ''); // back to the city so the person picks one
      var m = e && !e.wrap.hidden ? S.metroFor(e.inputs[0].value) : null;
      if (!m) { pk.hidden = true; pk.dataset.city = ''; return; }
      var tag = m.city + (noAll ? '|one' : '');
      if (pk.dataset.city !== tag) {
        pk.textContent = '';
        var ph = document.createElement('option'); ph.value = ''; ph.textContent = T(X.pick); pk.appendChild(ph);
        var codes = m.airports.map(function (a) { return a[0]; });
        var all = document.createElement('option');
        all.value = m.city + ', all airports (' + codes.join(', ') + ')';
        all.textContent = T(X.allAirports) + ' (' + codes.join(', ') + ')';
        if (!noAll) pk.appendChild(all);
        m.airports.forEach(function (a) {
          var o = document.createElement('option');
          o.value = m.city + ' (' + a[0] + ')';
          o.textContent = a[0] + ' - ' + a[1];
          pk.appendChild(o);
        });
        pk.dataset.city = tag;
      }
      pk.hidden = false;
    });
  }

  // Confirm email: no paste, no drop. The person has to type it again.
  function blockPaste(input) {
    ['paste', 'drop'].forEach(function (ev) {
      input.addEventListener(ev, function (e) { e.preventDefault(); });
    });
    input.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop' || e.inputType === 'insertFromPasteAsQuotation') e.preventDefault();
    });
    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) e.preventDefault();
      if (e.shiftKey && e.key === 'Insert') e.preventDefault();
    });
    input.setAttribute('autocomplete', 'off');
  }

  function collect() {
    var v = {};
    S.fieldList.forEach(function (f) {
      var e = els[f.id];
      if (!e || f.type === 'note') return;
      if (f.type === 'checks') v[f.id] = e.inputs.filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      else if (f.type === 'radio') { var c = e.inputs.filter(function (i) { return i.checked; })[0]; v[f.id] = c ? c.value : ''; }
      else if (f.type === 'consent') v[f.id] = e.inputs[0].checked ? 'yes' : '';
      else v[f.id] = e.inputs[0].value;
    });
    return v;
  }
  function setValues(values) {
    Object.keys(values).forEach(function (id) {
      var e = els[id]; if (!e || e.f.type === 'note') return;
      var val = values[id];
      if (e.f.type === 'checks') { var arr = Array.isArray(val) ? val : String(val || '').split(', '); e.inputs.forEach(function (i) { i.checked = arr.indexOf(i.value) >= 0; }); return; }
      if (typeof val !== 'string') return;
      if (e.f.type === 'radio') e.inputs.forEach(function (i) { i.checked = i.value === val; });
      else if (e.f.type === 'consent') e.inputs[0].checked = val === 'yes';
      else e.inputs[0].value = val;
    });
  }

  function showStatus(text, isError) {
    var st = document.getElementById('status');
    st.textContent = text; st.classList.toggle('error', !!isError);
  }

  function update() {
    var v = collect();
    var res = S.validate(v, localToday());
    var errors = res.errors;
    var dv = S.derive(v);

    // sections and fields that apply right now
    S.sections.forEach(function (sec) {
      var any = false;
      sec.fields.forEach(function (f) {
        var vis = S.isVisible(f, dv);
        els[f.id].wrap.hidden = !vis;
        els[f.id].inputs.forEach(function (i) { i.disabled = !vis; });
        if (vis) any = true;
      });
      var card = secEls[sec.id];
      card.hidden = !any;
      if (any && !shown[sec.id] && shown.__init) { card.classList.remove('reveal'); void card.offsetWidth; card.classList.add('reveal'); }
      shown[sec.id] = any;
    });
    shown.__init = true;

    // budget cover choices only offer what was picked above
    var cov = els.budgetCovers;
    if (cov) cov.inputs.forEach(function (i) {
      var ok = (v.services || []).indexOf(i.value) >= 0;
      i.parentNode.hidden = !ok;
      if (!ok) i.checked = false;
    });

    // return date can not be before departure
    if (els.return) els.return.inputs[0].min = v.depart || localToday();
    if (els.dropDate) {
      var earliest = [v.pickupDate, S.isVisible(els.depart.f, dv) ? v.depart : ''].filter(Boolean).sort().pop();
      els.dropDate.inputs[0].min = earliest || localToday();
    }
    refreshPickers();
    if (els.checkOut) els.checkOut.inputs[0].min = v.checkIn || localToday();

    var count = 0;
    S.fieldList.forEach(function (f) {
      var e = els[f.id];
      var code = errors[f.id];
      if (code) count++;
      var show = code && (touched[f.id] || submitted);
      e.wrap.classList.toggle('bad', !!show);
      e.err.hidden = !show;
      e.err.textContent = show ? T(MSG[code] || MSG.badValue) : '';
      e.inputs.forEach(function (i) { i.setAttribute('aria-invalid', show ? 'true' : 'false'); });
    });

    document.getElementById('send').disabled = sending; // stays clickable so a click can take them to what is missing
    if (statusError) showStatus(T(statusError), true);
    else showStatus(sending ? '' : (count === 0 ? T(X.ready) : count === 1 ? T(X.one) : T(X.many).replace('{n}', count)), false);
  }

  function touch(id) { touched[id] = true; }

  form.addEventListener('focusout', function (e) {
    var t = e.target; if (!t || !t.name || t.name === 'website') return;
    touch(t.name);
    // leaving Email while Confirm already has text: check the pair too
    if (t.name === 'email' && els.email2.inputs[0].value !== '') touch('email2');
    update();
  });
  form.addEventListener('input', function () { update(); });
  form.addEventListener('change', function (e) {
    var t = e.target; if (t && t.name && t.name !== 'website') touch(t.name);
    statusError = null;
    update();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    submitted = true;
    update();
    var bad = form.querySelector('.field.bad');
    if (bad) {
      bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      bad.classList.remove('flash'); void bad.offsetWidth; bad.classList.add('flash');
      var first = bad.querySelector('input,select,textarea'); if (first) first.focus({ preventScroll: true });
      return;
    }
    send();
  });

  function send() {
    sending = true; statusError = null;
    var btn = document.getElementById('send');
    btn.disabled = true; btn.textContent = T(X.sending); showStatus('', false);
    var body = {
      values: collect(), lang: lang,
      fillMs: Date.now() - startedAt,
      website: document.getElementById('website').value,
      turnstile: ''
    };
    function fail(key) { sending = false; btn.textContent = T(X.send); btn.disabled = false; statusError = key; update(); }
    withToken(function (token) {
      body.turnstile = token;
      fetch('/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (x) {
          if (x.d && x.d.ok) { done(); return; }
          resetTurnstile(); // a token works only once
          if (x.status === 400 && x.d && x.d.errors) {
            sending = false; btn.textContent = T(X.send);
            Object.keys(x.d.errors).forEach(function (id) { touch(id); });
            update();
            return;
          }
          fail(x.status === 429 ? X.rate : X.fail);
        })
        .catch(function () { resetTurnstile(); fail(X.fail); });
    });
  }

  // ---- bot check (Cloudflare Turnstile): only on the real site, only when a site key is set in config.js ----
  var siteKey = window.TURNSTILE_SITE_KEY || '';
  var tsOn = !!siteKey && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var tsWidget = null, tsToken = '', tsLoading = null;
  function loadTurnstile() {
    if (!tsLoading) tsLoading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
    return tsLoading;
  }
  function mountTurnstile() {
    if (!tsOn) return;
    tsToken = '';
    loadTurnstile().then(function () {
      var box = document.getElementById('ts');
      if (!window.turnstile || !box) return;
      if (tsWidget !== null) { try { window.turnstile.remove(tsWidget); } catch (e) { /* already gone */ } tsWidget = null; }
      var tl = { zh: 'zh-cn', pt: 'pt-br' }[lang] || lang;
      tsWidget = window.turnstile.render(box, {
        sitekey: siteKey, language: tl, theme: 'auto',
        callback: function (t) { tsToken = t; },
        'expired-callback': function () { tsToken = ''; },
        'error-callback': function () { tsToken = ''; }
      });
    });
  }
  function resetTurnstile() {
    if (!tsOn || tsWidget === null || !window.turnstile) return;
    tsToken = '';
    try { window.turnstile.reset(tsWidget); } catch (e) { /* ignore */ }
  }
  function withToken(cb) {
    if (!tsOn) { cb(''); return; }
    var n = 0;
    (function wait() { if (tsToken || n++ > 60) { cb(tsToken); return; } setTimeout(wait, 250); })();
  }

  function done() {
    form.hidden = true;
    var t = document.getElementById('thanks');
    t.hidden = false; t.focus(); window.scrollTo(0, 0);
    document.querySelector('.intro').hidden = true;
  }

  // Redraw everything in the current language, keeping what the person already typed.
  function rebuild(values) {
    form.textContent = '';
    els = {}; secEls = {}; shown = {}; pickers = {};
    build();
    if (values) setValues(values);
    applyStatic();
    update();
    mountTurnstile();
  }

  // Pre-fill from a short tag in the link, e.g. ?p=rafiq. The details themselves are fetched, never in the link.
  function applyPrefill(values) {
    var plain = {};
    Object.keys(values).forEach(function (id) {
      var val = values[id];
      if (val && typeof val === 'object' && Array.isArray(val.choices)) prefillChoices[id] = val.choices;
      else if (typeof val === 'string') plain[id] = val;
    });
    return plain;
  }

  buildLangPicker();
  lang = pickLang();
  var tag = new URLSearchParams(location.search).get('p');
  var prefillP = tag
    ? fetch('/api/prefill?p=' + encodeURIComponent(tag), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && d.values ? applyPrefill(d.values) : null; })
        .catch(function () { return null; })
    : Promise.resolve(null);
  Promise.all([loadLang(lang), prefillP]).then(function (r) {
    rebuild(r[1]);
    window.__formReady = true;
  });
})();
