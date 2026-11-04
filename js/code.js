// Kodierung eigener Rätsel in einen kurzen, URL-sicheren Code.
//
// Aufbau:  [1 Zeichen Meta] + [Nutzlast, Base62]
//  - Meta kodiert Wortlänge (3–10) und Anzahl Versuche (3–9).
//  - Nutzlast: Wort als Zahl zur Basis 30 (A–Z, Ä, Ö, Ü, ß) plus 8-Bit-Prüfsumme,
//    anschließend mit einer affinen Abbildung modulo M verwürfelt, damit ähnliche
//    Wörter völlig unterschiedliche Codes ergeben und das Wort nicht lesbar ist.
//  - Ein 5-Buchstaben-Wort ergibt 7 Zeichen, ein 10-Buchstaben-Wort 11 Zeichen.
//
// Das ist eine Verschleierung, keine echte Kryptografie – für ein Ratespiel genügt das.

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß';
export const MIN_LEN = 3;
export const MAX_LEN = 10;
export const MIN_TRIES = 3;
export const MAX_TRIES = 9;

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);
const MUL = 2654435761n; // Primzahl, teilerfremd zu 2, 3 und 5 → umkehrbar mod M
const ADD = 0x5deece66dn;
const META_COUNT = (MAX_LEN - MIN_LEN + 1) * (MAX_TRIES - MIN_TRIES + 1); // 56
const META_MUL = 9;  // teilerfremd zu 56
const META_INV = 25; // 9 * 25 ≡ 1 (mod 56)
const META_ADD = 23;

/** Wandelt Eingabe in die interne Schreibweise um (Großbuchstaben, ß bleibt ß). */
export function normalize(str) {
  let out = '';
  for (const ch of String(str).normalize('NFC')) {
    if (ch === 'ß' || ch === 'ẞ') out += 'ß';
    else out += ch.toLocaleUpperCase('de-DE');
  }
  return out;
}

/** Entfernt alles, was kein erlaubter Buchstabe ist. */
export function cleanWord(str) {
  return [...normalize(str)].filter((c) => ALPHABET.includes(c)).join('');
}

export function isValidWord(word) {
  const chars = [...word];
  return chars.length >= MIN_LEN && chars.length <= MAX_LEN && chars.every((c) => ALPHABET.includes(c));
}

function checksum(word, tries) {
  // FNV-1a über die Buchstabenindizes und die Versuchsanzahl
  let h = 0x811c9dc5;
  for (const c of [...word, String(tries)]) {
    h ^= ALPHABET.indexOf(c) + 1 + (c === String(tries) ? 100 : 0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return BigInt((h ^ (h >>> 8) ^ (h >>> 16) ^ (h >>> 24)) & 0xff);
}

function modulus(len) {
  return BASE ** BigInt(len) * 256n;
}

function digitsFor(m) {
  let w = 0;
  for (let x = m - 1n; x > 0n; x /= 62n) w++;
  return Math.max(w, 1);
}

function modInverse(a, m) {
  let [r0, r1] = [((a % m) + m) % m, m];
  let [s0, s1] = [1n, 0n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return ((s0 % m) + m) % m;
}

export function encodePuzzle(word, tries = 6) {
  word = normalize(word);
  if (!isValidWord(word)) throw new Error('Ungültiges Wort');
  if (!(tries >= MIN_TRIES && tries <= MAX_TRIES)) throw new Error('Ungültige Versuchsanzahl');
  const chars = [...word];
  const len = chars.length;
  const m = modulus(len);

  let v = 0n;
  for (let i = len - 1; i >= 0; i--) v = v * BASE + BigInt(ALPHABET.indexOf(chars[i]));
  const n = v * 256n + checksum(word, tries);
  let x = (n * MUL + ADD) % m;

  let payload = '';
  const width = digitsFor(m);
  for (let i = 0; i < width; i++) {
    payload = B62[Number(x % 62n)] + payload;
    x /= 62n;
  }
  const metaIdx = (len - MIN_LEN) * (MAX_TRIES - MIN_TRIES + 1) + (tries - MIN_TRIES);
  const meta = B62[(metaIdx * META_MUL + META_ADD) % META_COUNT];
  return meta + payload;
}

/** Liefert {word, tries} oder null, wenn der Code ungültig ist. */
export function decodePuzzle(code) {
  if (typeof code !== 'string' || code.length < 2 || code.length > 16) return null;
  const metaVal = B62.indexOf(code[0]);
  if (metaVal < 0 || metaVal >= META_COUNT) return null;
  const metaIdx = (((metaVal - META_ADD) * META_INV) % META_COUNT + META_COUNT) % META_COUNT;
  const span = MAX_TRIES - MIN_TRIES + 1;
  const len = Math.floor(metaIdx / span) + MIN_LEN;
  const tries = (metaIdx % span) + MIN_TRIES;

  const m = modulus(len);
  const payload = code.slice(1);
  if (payload.length !== digitsFor(m)) return null;
  let x = 0n;
  for (const c of payload) {
    const d = B62.indexOf(c);
    if (d < 0) return null;
    x = x * 62n + BigInt(d);
  }
  if (x >= m) return null;

  const n = ((((x - ADD) % m) + m) % m * modInverse(MUL, m)) % m;
  const sum = n % 256n;
  let v = n / 256n;
  let word = '';
  for (let i = 0; i < len; i++) {
    word += ALPHABET[Number(v % BASE)];
    v /= BASE;
  }
  if (checksum(word, tries) !== sum) return null;
  return { word, tries };
}
