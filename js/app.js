import { ALPHABET, MIN_TRIES, MAX_TRIES, cleanWord, decodePuzzle, encodePuzzle, isValidWord } from './code.js';
import { FRANKEN, FRANKEN_SPERRE } from './words.js';
import { HOCHDEUTSCH, HOCHDEUTSCH_SPERRE } from './words-de.js';
import { createSchedule, dayFromDate } from './schedule.js';

const $ = (sel) => document.querySelector(sel);
// Tastatur auf einem Raster von 12 Einheiten: ⌫ rechts in der Mitte, OK breit rechts unten.
// Zahlen = Leerraum (in Einheiten), damit die Reihen versetzt wie eine echte Tastatur liegen.
const KEY_ROWS = [
  [0.5, ...'QWERTZUIOPÜ', 0.5],
  [...'ASDFGHJKLÖÄ', 'BACK'],
  [0.5, ...'YXCVBNMß', 'ENTER'],
];
const KEY_WIDTH = { ENTER: 3.5, BACK: 1 };

// ---------- Speicher (robust gegen gesperrten localStorage) ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* egal */ }
  },
};

// ---------- Hilfsfunktionen ----------
const todayNumber = () => dayFromDate();

const frankenForDay = createSchedule(FRANKEN, FRANKEN_SPERRE, 'franken', (it) => it[0]);
const hochdeutschForDay = createSchedule(HOCHDEUTSCH, HOCHDEUTSCH_SPERRE, 'hochdeutsch');

function evaluate(guess, answer) {
  const g = [...guess];
  const a = [...answer];
  const res = g.map(() => 'absent');
  const left = {};
  g.forEach((c, i) => {
    if (c === a[i]) res[i] = 'correct';
    else left[a[i]] = (left[a[i]] || 0) + 1;
  });
  g.forEach((c, i) => {
    if (res[i] !== 'correct' && left[c] > 0) { res[i] = 'present'; left[c]--; }
  });
  return res;
}

function baseUrl() {
  return location.origin + location.pathname;
}

function toast(msg, ms = 1600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').prepend(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
  toast('In die Zwischenablage kopiert');
}

async function shareText(text, title = 'Wärdl') {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  await copyText(text);
}

const canNativeShare = () => typeof navigator.share === 'function';

// ---------- Spielzustand ----------
let game = null;      // { mode, day, answer, tries, meaning, code, storageKey }
let guesses = [];     // bereits abgegebene Wörter
let current = [];     // Buchstaben der aktuellen Zeile ('' = leeres Feld)
let cursor = 0;       // Feld, in das der nächste Buchstabe kommt (= Länge: Zeile voll)
let busy = false;     // während der Aufdeck-Animation

function lettersOf(w) { return [...w]; }
const isOver = () => isWon() || guesses.length >= game.tries;
const isWon = () => guesses.includes(game.answer);

function setupGame() {
  const rawHash = decodeURIComponent(location.hash.slice(1));
  const code = rawHash.startsWith(BACKUP_PREFIX) ? '' : rawHash; // Sicherungslinks behandelt initBackup
  const custom = code ? decodePuzzle(code) : null;
  if (code && !custom) toast('Der Link ist ungültig – hier ist das Wort des Tages.', 2600);

  const day = todayNumber();
  let mode = custom ? 'custom' : store.get('waerdl:mode', 'franken');
  if (mode === 'custom' && !custom) mode = 'franken';

  if (mode === 'custom') {
    game = { mode, day, answer: custom.word, tries: custom.tries, code, storageKey: `waerdl:c:${code}` };
  } else if (mode === 'hochdeutsch') {
    game = { mode, day, answer: hochdeutschForDay(day), tries: 6, storageKey: `waerdl:hochdeutsch:${day}` };
  } else {
    const [answer, meaning, fromWbf] = frankenForDay(day);
    game = { mode, day, answer, meaning, wbf: !!fromWbf, tries: 6, storageKey: `waerdl:franken:${day}` };
  }

  const saved = store.get(game.storageKey, null);
  guesses = Array.isArray(saved?.guesses)
    ? saved.guesses.filter((g) => lettersOf(g).length === lettersOf(game.answer).length && isValidWord(g)).slice(0, game.tries)
    : [];
  resetCurrent();
  busy = false;

  document.querySelectorAll('.tab').forEach((t) => {
    t.setAttribute('aria-selected', String(t.dataset.mode === mode));
    if (t.dataset.mode === 'custom') t.hidden = mode !== 'custom';
  });
  renderBoard();
  renderCurrent();
  renderKeyboardState();
  updateInfo();
  if (isOver()) setTimeout(() => openResult(), 400);
}

function save() {
  const prev = store.get(game.storageKey, {});
  store.set(game.storageKey, { ...prev, guesses });
}

function updateInfo() {
  const len = lettersOf(game.answer).length;
  const texts = {
    franken: `Fränkisches Wort des Tages #${game.day + 1} · ${len} Buchstaben`,
    hochdeutsch: `Wort des Tages #${game.day + 1} · ${len} Buchstaben`,
    custom: `Eigenes Rätsel · ${len} Buchstaben · ${game.tries} Versuche`,
  };
  $('#info-text').textContent = texts[game.mode];
}

// ---------- Darstellung ----------
function renderBoard() {
  const board = $('#board');
  const cols = lettersOf(game.answer).length;
  board.innerHTML = '';
  board.style.setProperty('--cols', cols);
  for (let r = 0; r < game.tries; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'row');
    const guess = guesses[r];
    const res = guess ? evaluate(guess, game.answer) : null;
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'gridcell');
      if (guess) {
        tile.textContent = lettersOf(guess)[c];
        tile.classList.add(res[c]);
      }
      row.append(tile);
    }
    board.append(row);
  }
  if (isWon()) board.children[guesses.indexOf(game.answer)]?.classList.add('done');
  fitBoard();
}

function fitBoard() {
  if (!game) return;
  const wrap = $('#board-wrap');
  const board = $('#board');
  const cols = lettersOf(game.answer).length;
  const rows = game.tries;
  const gap = cols > 7 ? 4 : 6;
  const w = wrap.clientWidth - 20;
  const h = wrap.clientHeight - 12;
  const size = Math.floor(Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows, 64));
  board.style.setProperty('--tile', `${Math.max(size, 20)}px`);
  board.style.setProperty('--gap', `${gap}px`);
}

function currentRow() {
  return $('#board').children[guesses.length];
}

function resetCurrent() {
  current = Array(lettersOf(game.answer).length).fill('');
  cursor = 0;
}

function renderCurrent() {
  const row = currentRow();
  if (!row) return;
  const active = !busy && !isOver();
  [...row.children].forEach((tile, i) => {
    const ch = current[i] || '';
    if (tile.textContent !== ch) {
      tile.textContent = ch;
      tile.classList.toggle('filled', !!ch);
    }
    tile.classList.toggle('cursor', active && i === cursor);
  });
  row.classList.toggle('editable', active);
}

/** Nächstes freies Feld hinter pos, sonst das erste freie davor, sonst "voll" (= Länge). */
function nextFree(pos) {
  let i = current.indexOf('', pos + 1);
  if (i < 0) i = current.indexOf('');
  return i < 0 ? current.length : i;
}

function initBoardTaps() {
  $('#board').addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    const row = currentRow();
    if (!tile || !row || tile.parentElement !== row || busy || isOver()) return;
    cursor = [...row.children].indexOf(tile);
    renderCurrent();
  });
}

function buildKeyboard() {
  const kb = $('#keyboard');
  kb.innerHTML = '';
  for (const keys of KEY_ROWS) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    for (const k of keys) {
      if (typeof k === 'number') {
        const gap = document.createElement('span');
        gap.className = 'kb-gap';
        gap.style.flexGrow = String(k);
        row.append(gap);
        continue;
      }
      const b = document.createElement('button');
      b.className = 'key';
      b.type = 'button';
      b.dataset.key = k;
      if (k === 'ENTER') { b.textContent = 'OK'; b.classList.add('wide'); b.setAttribute('aria-label', 'Wort abschicken'); }
      else if (k === 'BACK') { b.textContent = '⌫'; b.classList.add('back'); b.setAttribute('aria-label', 'Löschen'); }
      else b.textContent = k;
      if (KEY_WIDTH[k]) b.style.flexGrow = String(KEY_WIDTH[k]);
      row.append(b);
    }
    kb.append(row);
  }
  kb.addEventListener('click', (e) => {
    const b = e.target.closest('.key');
    if (!b) return;
    b.blur();
    handleKey(b.dataset.key);
  });
}

function renderKeyboardState() {
  const rank = { absent: 1, present: 2, correct: 3 };
  const best = {};
  for (const g of guesses) {
    const res = evaluate(g, game.answer);
    lettersOf(g).forEach((c, i) => {
      if (!best[c] || rank[res[i]] > rank[best[c]]) best[c] = res[i];
    });
  }
  document.querySelectorAll('.key').forEach((k) => {
    k.classList.remove('correct', 'present', 'absent');
    if (best[k.dataset.key]) k.classList.add(best[k.dataset.key]);
  });
}

// ---------- Eingabe ----------
function handleKey(key) {
  if (!game || busy || isOver()) return;
  const len = lettersOf(game.answer).length;
  if (key === 'ENTER') return submit();
  if (key === 'BACK') {
    if (cursor < len && current[cursor]) current[cursor] = '';     // markiertes Feld leeren
    else if (cursor > 0) { cursor--; current[cursor] = ''; }        // sonst links davon löschen
    return renderCurrent();
  }
  if (key === 'LEFT') { cursor = Math.max(0, Math.min(cursor, len) - 1); return renderCurrent(); }
  if (key === 'RIGHT') { cursor = Math.min(len - 1, cursor + 1); return renderCurrent(); }
  if (ALPHABET.includes(key) && cursor < len) {
    current[cursor] = key;
    cursor = nextFree(cursor);
    renderCurrent();
  }
}

function shakeRow() {
  const row = currentRow();
  row.classList.remove('shake');
  void row.offsetWidth;
  row.classList.add('shake');
}

const PRAISE = {
  franken: ['Allmächd, a Genie!', 'Subber!', 'Des hasd fei gud gmacht!', 'Bassd scho!', 'Gwies, des wor knapp!', 'Grad nu gschafft!'],
  default: ['Genial!', 'Großartig!', 'Super!', 'Sehr gut!', 'Gut gemacht!', 'Puh, geschafft!'],
};

function submit() {
  const len = lettersOf(game.answer).length;
  if (current.includes('')) {
    shakeRow();
    toast('Zu wenig Buchstaben');
    cursor = current.indexOf('');
    renderCurrent();
    return;
  }
  const guess = current.join('');
  const res = evaluate(guess, game.answer);
  const row = currentRow();
  const tiles = [...row.children];
  const step = Math.min(280, 1600 / len);
  busy = true;
  row.classList.remove('editable');
  tiles.forEach((t) => t.classList.remove('cursor'));

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('flip');
      setTimeout(() => { tile.classList.remove('filled'); tile.classList.add(res[i]); }, 250);
    }, i * step);
  });

  guesses.push(guess);
  resetCurrent();
  save();

  setTimeout(() => {
    busy = false;
    renderKeyboardState();
    updateInfo();
    renderCurrent(); // Schreibmarke in die nächste Zeile
    if (isWon()) {
      row.classList.add('win');
      const list = game.mode === 'franken' ? PRAISE.franken : PRAISE.default;
      const idx = Math.round(((guesses.length - 1) / Math.max(game.tries - 1, 1)) * (list.length - 1));
      toast(list[idx], 2000);
      finish(true);
    } else if (guesses.length >= game.tries) {
      toast(game.answer, 3000);
      finish(false);
    }
  }, (len - 1) * step + 520);
}

function finish(won) {
  if (game.mode !== 'custom') {
    const st = loadStats(game.mode);
    if (st.lastPlayed !== game.day) {
      st.played++;
      st.lastPlayed = game.day;
      if (won) {
        st.wins++;
        st.streak = st.lastWin === game.day - 1 ? st.streak + 1 : 1;
        st.lastWin = game.day;
        st.maxStreak = Math.max(st.maxStreak, st.streak);
        st.dist[guesses.length] = (st.dist[guesses.length] || 0) + 1;
      } else {
        st.streak = 0;
      }
      store.set(`waerdl:stats:${game.mode}`, st);
    }
  }
  setTimeout(openResult, won ? 1700 : 2200);
}

function loadStats(mode) {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: {}, lastPlayed: null, lastWin: null, ...store.get(`waerdl:stats:${mode}`, {}) };
}

// ---------- Ergebnis & Statistik ----------
function emojiGrid() {
  const map = { correct: '🟦', present: '🟧', absent: '⬛' };
  return guesses.map((g) => evaluate(g, game.answer).map((r) => map[r]).join('')).join('\n');
}

function resultShareText() {
  const score = isWon() ? guesses.length : 'X';
  const head = {
    franken: `Wärdl Fränggisch #${game.day + 1}`,
    hochdeutsch: `Wärdl #${game.day + 1}`,
    custom: 'Wärdl – eigenes Rätsel',
  }[game.mode];
  const url = game.mode === 'custom' ? `${baseUrl()}#${game.code}` : baseUrl();
  return `${head}  ${score}/${game.tries}\n\n${emojiGrid()}\n\n${url}`;
}

let countdownTimer = null;

function openResult() {
  const body = $('#result-body');
  body.innerHTML = '';
  const over = isOver();
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };

  if (over) {
    body.append(h('h2', null, isWon()
      ? (game.mode === 'franken' ? 'Gwunna! 🎉' : 'Gewonnen! 🎉')
      : (game.mode === 'franken' ? 'Ach du ärmer Wurm …' : 'Schade!')));
    const word = h('div', 'result-word');
    for (const c of lettersOf(game.answer)) word.append(h('span', 'tile correct', c));
    body.append(word);
    if (game.meaning) body.append(h('p', 'meaning', game.meaning));
    if (game.wbf) {
      const src = h('p', 'small source');
      const a = h('a', null, 'Fränkisches Wörterbuch (WBF)');
      a.href = 'https://bdo.badw.de/';
      a.target = '_blank';
      a.rel = 'noopener';
      src.append('Quelle: ', a, ', BAdW, CC BY 4.0');
      body.append(src);
    }
  } else {
    body.append(h('h2', null, 'Statistik'));
  }

  if (game.mode !== 'custom') {
    const st = loadStats(game.mode);
    const streak = st.lastWin != null && st.lastWin >= game.day - 1 ? st.streak : 0;
    const stats = h('div', 'stats');
    for (const [val, label] of [
      [st.played, 'Gespielt'],
      [st.played ? Math.round((st.wins / st.played) * 100) : 0, '% Gewonnen'],
      [streak, 'Serie'],
      [st.maxStreak, 'Beste Serie'],
    ]) {
      const cell = h('div');
      cell.append(h('b', null, String(val)), h('span', null, label));
      stats.append(cell);
    }
    body.append(h('p', 'small', game.mode === 'franken' ? 'Fränggisch' : 'Hochdeutsch'), stats);

    body.append(h('h3', null, 'Verteilung'));
    const dist = h('div', 'dist');
    const max = Math.max(1, ...Object.values(st.dist));
    for (let i = 1; i <= 6; i++) {
      const n = st.dist[i] || 0;
      const row = h('div', 'dist-row');
      const bar = h('div', 'dist-bar', String(n));
      bar.style.setProperty('--w', `${Math.max(7, (n / max) * 100)}%`);
      if (over && isWon() && guesses.length === i) bar.classList.add('current');
      row.append(h('span', null, String(i)), bar);
      dist.append(row);
    }
    body.append(dist);

    const cd = h('div', 'countdown', 'Nächstes Wort in');
    const time = h('b');
    cd.append(time);
    body.append(cd);
    const tick = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const s = Math.max(0, Math.floor((next - now) / 1000));
      time.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, '0')).join(':');
      if (s === 0 && todayNumber() !== game.day) { $('#dlg-result').close(); setupGame(); }
    };
    tick();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
  }

  if (over) {
    const row = h('div', 'btn-row');
    const share = h('button', 'btn primary', canNativeShare() ? 'Ergebnis teilen' : 'Ergebnis kopieren');
    share.onclick = () => shareText(resultShareText());
    row.append(share);
    if (canNativeShare()) {
      const copy = h('button', 'btn', 'Kopieren');
      copy.onclick = () => copyText(resultShareText());
      row.append(copy);
    }
    body.append(row);
  }
  const create = h('button', 'btn', '＋ Eigenes Rätsel erstellen');
  create.onclick = () => { $('#dlg-result').close(); openCreate(); };
  body.append(create);

  openDialog('#dlg-result');
}

// ---------- Eigenes Rätsel ----------
function openCreate() {
  $('#create-result').hidden = true;
  $('#create-word').value = '';
  setCreateHint();
  openDialog('#dlg-create');
  setTimeout(() => $('#create-word').focus(), 50);
}

function setCreateHint(msg, error = false) {
  const el = $('#create-hint');
  const n = [...$('#create-word').value].length;
  el.textContent = msg || (n ? `${n} Buchstaben` : 'Nur Buchstaben A–Z, Ä, Ö, Ü, ß');
  el.classList.toggle('error', error);
}

function initCreate() {
  const sel = $('#create-tries');
  for (let i = MIN_TRIES; i <= MAX_TRIES; i++) sel.add(new Option(String(i), String(i), i === 6, i === 6));

  const input = $('#create-word');
  input.addEventListener('input', () => {
    const raw = input.value;
    const clean = cleanWord(raw);
    let removed = [...raw.normalize('NFC')].some((c) => !cleanWord(c));
    let val = clean;
    if ([...val].length > 10) { val = [...val].slice(0, 10).join(''); removed = true; }
    if (val !== raw) input.value = val;
    $('#create-result').hidden = true;
    setCreateHint(removed ? 'Nur Buchstaben erlaubt (max. 10)' : '', removed);
  });

  $('#create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const word = cleanWord(input.value);
    if (!isValidWord(word)) {
      setCreateHint('Das Wort braucht 3 bis 10 Buchstaben.', true);
      return;
    }
    const tries = Number(sel.value);
    const link = `${baseUrl()}#${encodePuzzle(word, tries)}`;
    $('#create-link').value = link;
    $('#create-result').hidden = false;
    $('#create-share').textContent = canNativeShare() ? 'Teilen' : 'Öffnen';
    input.blur();
  });

  const inviteText = () => {
    const link = $('#create-link').value;
    const d = decodePuzzle(link.split('#')[1]);
    return `Kannst du mein Wärdl lösen? 🤔 (${[...d.word].length} Buchstaben, ${d.tries} Versuche)\n${link}`;
  };
  $('#create-share').addEventListener('click', () => {
    if (canNativeShare()) shareText(inviteText());
    else window.open($('#create-link').value, '_blank', 'noopener');
  });
  $('#create-copy').addEventListener('click', () => copyText($('#create-link').value));
  $('#create-link').addEventListener('focus', (e) => e.target.select());
}

// ---------- Dialoge ----------
function openDialog(sel) {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  $(sel).showModal();
}

function initDialogs() {
  document.querySelectorAll('dialog').forEach((d) => {
    d.querySelector('.dlg-close')?.addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // Klick auf Hintergrund
    d.addEventListener('close', () => {
      if (d.id === 'dlg-result') clearInterval(countdownTimer);
      setTimeout(maybeAskNotify, 300);
    });
  });
  $('#btn-help').addEventListener('click', () => openDialog('#dlg-help'));
  $('#btn-stats').addEventListener('click', openResult);
  $('#btn-create').addEventListener('click', openCreate);
  $('#btn-settings').addEventListener('click', openSettings);
}


// ---------- Benachrichtigungen bei neuem Wort des Tages ----------
// Ohne eigenen Server geht das nur über "Periodic Background Sync": Der Browser weckt
// den Service Worker ab und zu, der zeigt dann ggf. die Erinnerung an (siehe sw.js).
// Unterstützt von Chrome/Edge (v. a. Android), nur wenn Wärdl als App installiert ist.
const SYNC_TAG = 'daily-word';
const META_CACHE = 'waerdl-meta';
const notifyPref = () => store.get('waerdl:notify', null); // null = noch nicht gefragt, 'on', 'off'
const notifySupported = () => 'Notification' in window && 'serviceWorker' in navigator && location.protocol !== 'file:';
const periodicSupported = () => notifySupported() && 'periodicSync' in ServiceWorkerRegistration.prototype;
let askPending = false;

function swReady(ms = 4000) {
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), ms))]);
}

async function writeMeta(patch) {
  try {
    const cache = await caches.open(META_CACHE);
    const url = new URL('__meta', location.href).href;
    const old = await cache.match(url).then((r) => (r ? r.json() : {})).catch(() => ({}));
    await cache.put(url, new Response(JSON.stringify({ ...old, ...patch }), { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* Cache nicht verfügbar */ }
}

async function registerSync() {
  const reg = await swReady();
  if (!reg?.periodicSync) return false;
  try {
    const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (perm.state !== 'granted') return false;
  } catch { /* Abfrage nicht unterstützt – Registrierung trotzdem versuchen */ }
  try {
    await reg.periodicSync.register(SYNC_TAG, { minInterval: 6 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

async function unregisterSync() {
  const reg = await swReady();
  try { await reg?.periodicSync?.unregister(SYNC_TAG); } catch { /* egal */ }
}

/** Schaltet die Erinnerung ein (muss aus einem Klick heraus aufgerufen werden). */
async function enableNotify() {
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    store.set('waerdl:notify', 'off');
    await writeMeta({ notify: 'off' });
    toast('Benachrichtigungen wurden nicht erlaubt.', 2600);
    return false;
  }
  store.set('waerdl:notify', 'on');
  await writeMeta({ notify: 'on' });
  const ok = await registerSync();
  toast(ok ? '🔔 Erinnerung ist an' : '🔔 Wird aktiv, sobald Wärdl als App installiert ist', 2800);
  return true;
}

async function disableNotify() {
  store.set('waerdl:notify', 'off');
  await writeMeta({ notify: 'off' });
  await unregisterSync();
}

/** Beim Start: Zustand an den Service Worker melden, Registrierung auffrischen. */
async function syncNotifyState() {
  if (!notifySupported()) return;
  await writeMeta({ seenDay: todayNumber(), notify: notifyPref() || 'off' });
  const reg = await swReady();
  try {
    (await reg?.getNotifications({ tag: SYNC_TAG }))?.forEach((n) => n.close());
  } catch { /* egal */ }
  if (notifyPref() === 'on' && Notification.permission === 'granted') registerSync();
}

function maybeAskNotify() {
  if (!askPending || document.querySelector('dialog[open]')) return;
  askPending = false;
  $('#dlg-notify').showModal();
}

async function updateSettingsUi() {
  const box = $('#set-notify');
  const status = $('#notify-status');
  const on = notifyPref() === 'on';
  box.checked = on;
  box.disabled = false;
  if (!notifySupported() || !periodicSupported()) {
    box.checked = false;
    box.disabled = true;
    status.textContent = 'Dein Browser kann ohne eigenen Server keine Erinnerungen im Hintergrund anzeigen. '
      + 'Das klappt derzeit nur mit Chrome oder Edge (z. B. auf Android), wenn Wärdl als App installiert ist.';
    return;
  }
  if (Notification.permission === 'denied') {
    box.checked = false;
    status.textContent = 'Benachrichtigungen sind für diese Seite im Browser blockiert. Erlaube sie in den Website-Einstellungen des Browsers und schalte die Erinnerung dann hier ein.';
    return;
  }
  if (!on) {
    status.textContent = 'Aus.';
    return;
  }
  const reg = await swReady();
  const tags = await reg?.periodicSync?.getTags().catch(() => []) || [];
  status.textContent = tags.includes(SYNC_TAG)
    ? 'An. Du bekommst höchstens eine Erinnerung pro Tag (frühestens ab 7 Uhr), wenn du noch nicht reingeschaut hast. Den genauen Zeitpunkt bestimmt der Browser.'
    : 'An, aber noch nicht aktiv: Installiere Wärdl als App (Browser-Menü → „App installieren“ bzw. „Zum Startbildschirm“), dann starte es einmal von dort.';
}

function openSettings() {
  openDialog('#dlg-settings');
  updateSettingsUi();
}

function initNotify() {
  $('#notify-yes').addEventListener('click', async () => {
    $('#dlg-notify').close();
    await enableNotify();
  });
  $('#notify-no').addEventListener('click', async () => {
    $('#dlg-notify').close();
    await disableNotify();
    toast('Alles klar – änderbar unter ⚙ Einstellungen', 2600);
  });
  $('#set-notify').addEventListener('change', async (e) => {
    if (e.target.checked) await enableNotify();
    else await disableNotify();
    updateSettingsUi();
  });
  // Nur fragen, wenn es auf diesem Gerät auch funktionieren kann.
  askPending = notifyPref() === null && periodicSupported() && Notification.permission !== 'denied';
  syncNotifyState();
}

// ---------- Installation (PWA) ----------
let installEvent = null;
function initInstall() {
  const ua = navigator.userAgent;
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ipad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const macSafari = !ios && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(ua);
  const androidFirefox = /Android/.test(ua) && /Firefox\//.test(ua);
  const guide = $('#install-guide');
  const shareIcon = '<svg class="ios-share" viewBox="0 0 24 24" aria-label="Teilen-Symbol"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 11v9h14v-9"/></svg>';

  // Der Knopf erscheint NUR, wenn der Browser die Installation per Knopf anbietet
  // (Ereignis "beforeinstallprompt": Chrome, Edge, Samsung Internet …).
  // Auf allen anderen Systemen gibt es stattdessen eine kurze Anleitung.
  if (!isStandalone) {
    if (ios) {
      guide.innerHTML = `<b>Als App auf dem ${ipad ? 'iPad' : 'iPhone'} speichern:</b>
        <ol>
          <li>Unten${ipad ? ' bzw. oben' : ''} auf <b>Teilen</b> ${shareIcon} tippen</li>
          <li><b>„Zum Home-Bildschirm“</b> wählen (ggf. in der Liste nach unten scrollen)</li>
          <li>Oben rechts auf <b>„Hinzufügen“</b> tippen</li>
        </ol>
        <span class="small">Fehlt der Eintrag, öffne die Seite in Safari.</span>`;
      guide.hidden = false;
    } else if (macSafari) {
      guide.innerHTML = '<b>Als App speichern:</b> in der Menüleiste <b>Ablage → „Zum Dock hinzufügen“</b> wählen.';
      guide.hidden = false;
    } else if (androidFirefox) {
      guide.innerHTML = '<b>Als App speichern:</b> Menü <b>⋮</b> öffnen und <b>„Installieren“</b> bzw. „Zum Startbildschirm hinzufügen“ wählen.';
      guide.hidden = false;
    }
  }
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    guide.hidden = true;
    $('#btn-install').hidden = false;
  });
  addEventListener('appinstalled', () => {
    installEvent = null;
    $('#btn-install').hidden = true;
    guide.hidden = true;
  });
  $('#btn-install').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null;
    $('#btn-install').hidden = true;
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // War schon ein Service Worker aktiv, bedeutet ein Wechsel: neue Version installiert.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) $('#update-banner').hidden = false;
    });
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Beim Start aktiv nach einer neuen Version fragen (Browser tun das sonst nur verzögert).
      if (hadController) reg.update().catch(() => {});
      // Installierte Apps laufen oft tagelang – auch beim Zurückholen nach Updates suchen.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
    $('#update-reload').addEventListener('click', () => location.reload());
  }
}


// ---------- Sicherung der Statistik ----------
// Format: Link …/#sicherung=<Code>. Code = 'z' + base64url(deflate(JSON)) bzw. 'j' + base64url(JSON),
// falls der Browser keine Kompression kann. Enthalten: Statistik beider Modi + heutiges Spiel.
const BACKUP_PREFIX = 'sicherung=';
const DAILY_MODES = ['franken', 'hochdeutsch'];

const b64url = {
  enc(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};

async function pipeBytes(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function buildBackupCode() {
  const day = todayNumber();
  const data = { v: 1, day, s: {}, g: {} };
  for (const m of DAILY_MODES) {
    data.s[m] = loadStats(m);
    const g = store.get(`waerdl:${m}:${day}`, null);
    if (g?.guesses?.length) data.g[m] = { guesses: g.guesses };
  }
  const json = new TextEncoder().encode(JSON.stringify(data));
  if (typeof CompressionStream === 'function') {
    try { return 'z' + b64url.enc(await pipeBytes(json, new CompressionStream('deflate-raw'))); } catch { /* weiter ohne */ }
  }
  return 'j' + b64url.enc(json);
}

const intOr = (x, d = 0) => (Number.isInteger(x) && x >= 0 && x < 1e6 ? x : d);
const dayOr = (x) => (Number.isInteger(x) && x >= 0 && x < 1e5 ? x : null);

/** Liest einen Code ein und prüft jeden Wert. Liefert bereinigte Daten oder null. */
async function parseBackupCode(input) {
  try {
    let code = String(input).trim();
    const i = code.indexOf(BACKUP_PREFIX);
    if (i >= 0) code = code.slice(i + BACKUP_PREFIX.length);
    code = decodeURIComponent(code).replace(/\s+/g, '');
    let bytes = b64url.dec(code.slice(1));
    if (code[0] === 'z') bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    else if (code[0] !== 'j') return null;
    const d = JSON.parse(new TextDecoder().decode(bytes));
    if (d?.v !== 1 || typeof d.s !== 'object') return null;
    const clean = { day: dayOr(d.day), s: {}, g: {} };
    for (const m of DAILY_MODES) {
      const st = d.s[m] || {};
      const dist = {};
      for (const [k, v] of Object.entries(st.dist || {})) if (/^[1-9]$/.test(k)) dist[k] = intOr(v);
      const played = intOr(st.played);
      clean.s[m] = {
        played, wins: Math.min(intOr(st.wins), played), streak: intOr(st.streak), maxStreak: intOr(st.maxStreak),
        dist, lastPlayed: dayOr(st.lastPlayed), lastWin: dayOr(st.lastWin),
      };
      const g = d.g?.[m];
      if (g && Array.isArray(g.guesses)) {
        const guesses = g.guesses.filter((w) => typeof w === 'string' && isValidWord(w) && [...w].length === 5).slice(0, 6);
        if (guesses.length) clean.g[m] = { guesses };
      }
    }
    return clean;
  } catch {
    return null;
  }
}

let pendingRestore = null;

function showRestoreDialog(data) {
  pendingRestore = data;
  const box = $('#restore-summary');
  box.innerHTML = '';
  const t = document.createElement('table');
  t.className = 'restore-table';
  const row = (cells, tag = 'td') => {
    const tr = document.createElement('tr');
    cells.forEach((c) => { const el = document.createElement(tag); el.textContent = c; tr.append(el); });
    t.append(tr);
  };
  row(['', 'Gespielt', 'Gewonnen', 'Beste Serie'], 'th');
  const label = { franken: 'Fränggisch', hochdeutsch: 'Hochdeutsch' };
  for (const m of DAILY_MODES) {
    const now = loadStats(m);
    const b = data.s[m];
    row([`${label[m]} – Sicherung`, b.played, b.wins, b.maxStreak]);
    row([`${label[m]} – dieses Gerät`, now.played, now.wins, now.maxStreak]);
  }
  box.append(t);
  openDialog('#dlg-restore');
}

function applyRestore(data) {
  for (const m of DAILY_MODES) store.set(`waerdl:stats:${m}`, data.s[m]);
  // Das heutige Spiel nur übernehmen, wenn es vom selben Tag ist und hier nicht schon weiter gespielt wurde.
  if (data.day === todayNumber()) {
    for (const [m, g] of Object.entries(data.g)) {
      const key = `waerdl:${m}:${data.day}`;
      const here = store.get(key, null);
      if (!here?.guesses || here.guesses.length < g.guesses.length) store.set(key, g);
    }
  }
}

function initBackup() {
  $('#backup-create').addEventListener('click', async () => {
    const code = await buildBackupCode();
    $('#backup-link').value = `${baseUrl()}#${BACKUP_PREFIX}${code}`;
    $('#backup-result').hidden = false;
    $('#backup-share').textContent = canNativeShare() ? 'Teilen' : 'Kopieren';
    $('#backup-copy').hidden = !canNativeShare();
  });
  $('#backup-share').addEventListener('click', () => {
    const link = $('#backup-link').value;
    if (canNativeShare()) shareText(`Meine Wärdl-Sicherung (Statistik):\n${link}`, 'Wärdl-Sicherung');
    else copyText(link);
  });
  $('#backup-copy').addEventListener('click', () => copyText($('#backup-link').value));
  $('#backup-link').addEventListener('focus', (e) => e.target.select());
  $('#backup-load').addEventListener('click', async () => {
    const data = await parseBackupCode($('#backup-input').value);
    if (!data) { toast('Diese Sicherung ist ungültig oder unvollständig.', 2600); return; }
    showRestoreDialog(data);
  });
  $('#restore-yes').addEventListener('click', () => {
    if (pendingRestore) applyRestore(pendingRestore);
    pendingRestore = null;
    $('#dlg-restore').close();
    toast('✅ Sicherung eingelesen', 2200);
    setupGame();
  });
  $('#restore-no').addEventListener('click', () => { pendingRestore = null; $('#dlg-restore').close(); });

  // Sicherungslink geöffnet? (Erstprüfung am Ende von init, nach den Startdialogen)
  addEventListener('hashchange', checkBackupHash);
}

async function checkBackupHash() {
  const raw = decodeURIComponent(location.hash.slice(1));
  if (!raw.startsWith(BACKUP_PREFIX)) return;
  history.replaceState(null, '', location.pathname + location.search); // Link nicht im Verlauf stehen lassen
  const data = await parseBackupCode(raw);
  if (!data) { toast('Diese Sicherung ist ungültig oder unvollständig.', 2600); return; }
  askPending = false; // keine Benachrichtigungsfrage dazwischen
  showRestoreDialog(data);
}

// ---------- Speicher dauerhaft machen ----------
// Bittet den Browser, Statistik und Spielstände nicht bei Speichermangel zu löschen.
// Chrome gewährt das bei installierten Apps meist still, Safari ab Version 17.
async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* nicht unterstützt – egal */ }
}

// ---------- Start ----------
function init() {
  buildKeyboard();
  initBoardTaps();
  initDialogs();
  initCreate();
  initInstall();
  initNotify();
  initBackup();
  requestPersistentStorage();

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    const mode = t.dataset.mode;
    if (mode === 'custom') return;
    store.set('waerdl:mode', mode);
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
    setupGame();
  }));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest?.('input, select, textarea')) return;
    if (e.key === 'Enter') { e.preventDefault(); handleKey('ENTER'); return; }
    if (e.key === 'Backspace') { e.preventDefault(); handleKey('BACK'); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); handleKey('LEFT'); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); handleKey('RIGHT'); return; }
    if (e.key.length === 1) {
      const c = cleanWord(e.key);
      if ([...c].length === 1) handleKey(c);
    }
  });

  addEventListener('hashchange', setupGame);
  addEventListener('popstate', setupGame);
  addEventListener('resize', fitBoard);
  new ResizeObserver(fitBoard).observe($('#board-wrap'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && game && game.mode !== 'custom' && todayNumber() !== game.day) setupGame();
  });

  setupGame();
  if (!store.get('waerdl:seenHelp', false)) {
    store.set('waerdl:seenHelp', true);
    if (!isOver()) openDialog('#dlg-help');
  }
  setTimeout(checkBackupHash, 700); // nach Ergebnis-/Anleitungsfenster, damit die Rückfrage oben liegt
  setTimeout(maybeAskNotify, 900); // wartet, bis andere Dialoge geschlossen sind
}

init();
