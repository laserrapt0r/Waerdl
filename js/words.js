// Fränkische Wortliste für das Tagesrätsel (die hochdeutsche steht in words-de.js).
// Erlaubt sind nur die Buchstaben A–Z, Ä, Ö, Ü und ß (siehe js/code.js).

// Fränkisches Wort des Tages – handverlesen. Fränkisch wird von Ort zu Ort
// unterschiedlich geschrieben; hier steht jeweils eine verbreitete Schreibweise.
// Format: Blöcke mit Startdatum, darin [Wort, Bedeutung]. Genau 5 Buchstaben.
// Neue Wörter: einen NEUEN Block mit späterem Datum anhängen (bestehende nicht ändern).
// Wörter entfernen: nicht löschen, sondern in FRANKEN_SPERRE mit Datum eintragen.
// (Siehe js/schedule.js – so bleiben vergangene Tage und das heutige Wort stabil.)
export const FRANKEN = [{ ab: '2026-01-01', woerter: [
  ['GLUMP', 'Kram, Plunder, wertloses Zeug'],
  ['KÄRWA', 'Kirchweih, das große Dorffest'],
  ['MÄDLA', 'Mädchen'],
  ['SPEZL', 'guter Freund, Kumpel'],
  ['RANZN', 'Bauch'],
  ['GWAAF', 'dummes Gerede, Geschwätz'],
  ['EBBES', 'etwas'],
  ['ODDER', 'oder – gern als Rückfrage am Satzende'],
  ['SIMBL', 'einfältiger Mensch, Dummkopf (Simpel)'],
  ['WAAFN', 'Mund, freches Mundwerk – „Halt dei Waafn!“'],
  ['SCHEE', 'schön'],
  ['HEIER', 'heuer, dieses Jahr'],
  ['DAHAM', 'daheim, zu Hause'],
  ['BLEED', 'blöd'],
  ['LAAFN', 'laufen'],
  ['KAAFN', 'kaufen'],
  ['GLAAB', 'glaube – „Des glaab i ned!“'],
  ['BATZN', 'Klumpen, großes Stück'],
  ['AAMER', 'Eimer'],
  ['GEMMA', 'gehen wir – „Gemma!“'],
  ['HÄSLA', 'Häschen'],
  ['VÖGLA', 'Vögelchen'],
  ['BÄMLA', 'Bäumchen'],
  ['HÜTLA', 'Hütchen'],
] }];

// Wort → Datum (JJJJ-MM-TT), ab dem es nicht mehr als Wort des Tages vorkommt.
export const FRANKEN_SPERRE = {};

