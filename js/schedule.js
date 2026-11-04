// Auswahl des Wortes des Tages: "am längsten nicht dran gewesen" (LRU-Warteschlange).
//
// - Alle Wörter stehen in einer Warteschlange. Jeden Tag ist das vorderste Wort dran und
//   wandert danach ans Ende. So wiederholt sich ein Wort erst, wenn alle anderen dran waren.
// - Wörter kommen in Blöcken mit Startdatum ("ab"). Ein neuer Block wird an seinem Starttag
//   (gemischt) an den Anfang der Schlange gestellt – neue Wörter kommen also bald dran,
//   ohne dass kürzlich gespielte Wörter vorgezogen werden.
// - Gesperrte Wörter ("SPERRE": Wort → Datum) fallen ab diesem Tag aus der Schlange.
// - Die Schlange wird ab dem Starttag deterministisch nachgerechnet. Vergangene Tage bleiben
//   gleich, solange man Blöcke nur ANHÄNGT und Wörter SPERRT statt sie zu löschen.

export const EPOCH = Date.UTC(2026, 0, 1);

export function dayFromDate(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5);
}

export function dayFromIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 864e5);
}

function hashStr(s) {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return h;
}

function seededShuffle(list, seed) {
  const a = list.slice();
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Erstellt einen Planer für eine Wortliste.
 * @param {Array<{ab: string, woerter: Array}>} blocks  Wortblöcke mit Startdatum (JJJJ-MM-TT)
 * @param {Object<string,string>} sperre  Wort → Datum, ab dem es nicht mehr vorkommt
 * @param {string} salt  unterscheidet die Mischung verschiedener Listen
 * @param {(item:any)=>string} key  liefert das Wort eines Eintrags
 */
export function createSchedule(blocks, sperre = {}, salt = '', key = (x) => x) {
  const events = blocks
    .map((b) => ({ day: Math.max(0, dayFromIso(b.ab)), items: seededShuffle(b.woerter, hashStr(salt + b.ab)) }))
    .sort((a, b) => a.day - b.day);
  const blockedFrom = new Map(Object.entries(sperre).map(([w, d]) => [w, dayFromIso(d)]));
  const cache = [];
  let queue = [];
  let head = 0;
  let next = 0; // nächster noch nicht eingereihter Block
  const known = new Set();

  function step(d) {
    while (next < events.length && events[next].day <= d) {
      const fresh = events[next++].items.filter((it) => !known.has(key(it)));
      fresh.forEach((it) => known.add(key(it)));
      queue = fresh.concat(queue.slice(head));
      head = 0;
    }
    while (head < queue.length) {
      const item = queue[head++];
      const b = blockedFrom.get(key(item));
      if (b !== undefined && b <= d) continue; // gesperrt → fällt dauerhaft raus
      queue.push(item);
      return item;
    }
    return null;
  }

  return function wordForDay(day) {
    day = Math.max(0, day);
    while (cache.length <= day) cache.push(step(cache.length));
    return cache[day];
  };
}
