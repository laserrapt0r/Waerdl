# Wärdl

Ein Worträtsel für den Browser – mit fränkischem Wort des Tages.

**▶ Jetzt spielen: [laserrapt0r.github.io/Waerdl](https://laserrapt0r.github.io/Waerdl/)**

Errate das gesuchte Wort in wenigen Versuchen. Nach jedem Versuch zeigen die Farben, wie nah du
dran bist: **Blau** = richtiger Buchstabe an der richtigen Stelle, **Orange** = Buchstabe kommt
vor, aber woanders, **Grau** = kommt nicht vor.

## Spielarten

- **Fränggisch:** jeden Tag ein fränkisches Mundartwort mit 5 Buchstaben aus über 550 Wörtern,
  z. B. KÄRWA, GLUMP oder MÄDLA. Ab dem dritten Versuch gibt es auf Wunsch einen Tipp, nach dem Spiel die Bedeutung.
- **Hochdeutsch:** jeden Tag ein Wort mit 5 Buchstaben, ausgewählt aus über 1.500 Wörtern.
- **Eigenes Rätsel:** ein Wort mit 3–10 Buchstaben ausdenken, die Zahl der Versuche (3–9) wählen
  und den Link verschicken. Das Wort steht verschlüsselt im Link, und der Link bleibt kurz, z. B.
  `https://laserrapt0r.github.io/Waerdl/#84QjHx3`.

Erlaubt sind nur die Buchstaben A–Z, Ä, Ö, Ü und ß.

## Weitere Funktionen

- **Als App speichern:** Wärdl lässt sich auf dem Handy und am PC wie eine App installieren und
  funktioniert danach auch ohne Internet.
  - Android/Chrome: Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“
  - iPhone/iPad (Safari): „Teilen“ → „Zum Home-Bildschirm“
- **Teilen:** Ergebnis als Kästchen-Raster oder eigenes Rätsel über das Teilen-Menü des Geräts
  verschicken, sonst wird es in die Zwischenablage kopiert.
- **Statistik:** gespielte Runden, Gewinnquote, Serien und Verteilung der Versuche, getrennt für
  Fränggisch und Hochdeutsch.
- **Erinnerung an das neue Wort des Tages:** Beim ersten Start fragt Wärdl, ob es Bescheid geben
  soll. Ändern lässt sich das jederzeit unter ⚙ Einstellungen.

### Hinweis zu den Erinnerungen

Wärdl läuft ohne eigenen Server. Echte Push-Nachrichten sind deshalb nicht möglich. Stattdessen
weckt der Browser die installierte App gelegentlich im Hintergrund, und die zeigt dann höchstens
eine Erinnerung pro Tag (frühestens ab 7 Uhr), wenn man an dem Tag noch nicht reingeschaut hat.

- Das klappt nur mit Chrome oder Edge (vor allem auf Android) und nur bei installierter App.
- Den genauen Zeitpunkt bestimmt der Browser.
- Safari (iPhone/iPad) und Firefox unterstützen das nicht. Dort wird nicht gefragt.

## Technik

Reines HTML, CSS und JavaScript – ohne Bibliotheken und ohne Übersetzungsschritt. Beim ersten
Öffnen werden rund 25 KB übertragen; danach kommt alles aus dem Zwischenspeicher des Browsers.

### Lokal starten

```sh
python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen. (Über `file://` funktionieren Offline-Modus und
Teilen nicht.)

### Veröffentlichung

Die Seite wird über GitHub Pages direkt aus dem Zweig `main` (Hauptverzeichnis) ausgeliefert.
Alle Pfade sind relativ, Wärdl funktioniert also auch in jedem Unterverzeichnis.

**Wichtig nach Änderungen:** In `sw.js` die Versionsnummer `VERSION` erhöhen (z. B. `v5` → `v6`),
damit installierte Apps die neuen Dateien laden.

### Dateien

| Datei | Zweck |
|---|---|
| `index.html`, `style.css` | Oberfläche |
| `js/app.js` | Spiellogik, Statistik, Teilen, Installation, Erinnerungen |
| `js/code.js` | Verschlüsselung der Rätsel-Links |
| `js/schedule.js` | Reihenfolge des Wortes des Tages |
| `js/words.js` | fränkische Wortliste |
| `js/words-de.js` | hochdeutsche Wortliste |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline-Modus und Installation als App |

## Wörter pflegen

### Reihenfolge des Wortes des Tages

Die Wörter stehen in einer Warteschlange nach dem Prinzip „am längsten nicht dran gewesen“:
Jeden Tag ist das vorderste Wort dran und wandert danach ans Ende. Ein Wort wiederholt sich also
erst, wenn alle anderen dran waren. Die Reihenfolge wird ab dem 1.1.2026 Tag für Tag nachgerechnet,
sodass alle Geräte ohne Server dasselbe Wort bekommen.

### Wörter hinzufügen

Einen **neuen Block mit Startdatum anhängen** und bestehende Blöcke nicht verändern. Die neuen
Wörter kommen ab diesem Tag zuerst dran; vergangene Tage und das heutige Wort bleiben gleich, wenn
das Datum in der Zukunft liegt.

```js
export const FRANKEN = [
  { ab: '2026-01-01', woerter: [ ['GLUMP', 'Kram, Plunder, wertloses Zeug'], … ] },
  { ab: '2027-02-01', woerter: [ ['NEUES', 'Bedeutung'] ] },   // neu
];
```

Die fränkischen Wörter stehen in Mundart-Schreibweise. Da Fränkisch von Ort zu Ort anders
geschrieben wird, ist jeweils eine verbreitete Schreibweise gewählt.

### Wörter entfernen

Nicht löschen, sondern **sperren** – ab dem angegebenen Tag kommt das Wort nicht mehr vor:

```js
export const FRANKEN_SPERRE = { 'GEMMA': '2027-01-15' };
```

Für Hochdeutsch gilt dasselbe in `js/words-de.js` mit `HOCHDEUTSCH` und `HOCHDEUTSCH_SPERRE`.

## Lizenzen und Quellen

### Hochdeutsche Wortliste (`js/words-de.js`)

Die Datei steht unter der Lizenz
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de)** (Namensnennung –
Weitergabe unter gleichen Bedingungen). Wer sie verändert weitergibt, muss dieselbe Lizenz
verwenden. Sie wurde abgeleitet aus:

- **Wiktionary** – das freie Wörterbuch, deutschsprachige Ausgabe,
  [de.wiktionary.org](https://de.wiktionary.org/), © Wiktionary-Autorinnen und -Autoren,
  Lizenz [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
  Verwendet wurde der maschinenlesbare Auszug von [kaikki.org](https://kaikki.org/dewiktionary/)
  (erstellt mit [wiktextract](https://github.com/tatuylonen/wiktextract)).
  Übernommen: Wörter, Wortarten und Kennzeichnungen (z. B. „veraltet“).
- **DWDS-Lemmaliste** – Digitales Wörterbuch der deutschen Sprache, Berlin-Brandenburgische
  Akademie der Wissenschaften, [dwds.de/lemma/list](https://www.dwds.de/lemma/list),
  Lizenz [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).
  Übernommen: nur die Häufigkeitsklassen, um sehr seltene Wörter auszusortieren.

Bearbeitung: nur Wörter mit genau 5 Buchstaben; nur Substantive, Verben, Adjektive und Adverbien;
ohne Namen, Abkürzungen, gebeugte Formen sowie veraltete oder abwertende Wörter; nur neue
Rechtschreibung; ohne sehr seltene Wörter.

### Fränkische Wortliste (`js/words.js`)

Die Liste besteht aus zwei Blöcken:

1. **24 Wörter** (Block ab 1.1.2026), für dieses Projekt zusammengestellt. Wörter, Schreibweise
   und Erklärungen sind eigene Arbeit; die meisten davon sind auch im WBF als Mundartbeleg
   nachgewiesen.
2. **554 Wörter** (Block ab 5.11.2026) aus dem **Fränkischen Wörterbuch (WBF)**, bezogen über
   [Bayerns Dialekte Online (BDO)](https://bdo.badw.de/),
   © Bayerische Akademie der Wissenschaften (BAdW) und Friedrich-Alexander-Universität
   Erlangen-Nürnberg, Lizenz
   **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de)**.
   Übernommen wurden die Mundart-Belegformen und die zugehörigen Bedeutungen.
   Bearbeitung: nur Belegformen mit genau 5 Buchstaben, die an mindestens 3 Orten belegt sind,
   dazu 165 von Hand ausgewählte alltagsnahe Wörter mit 2 Belegorten (keine Fachbegriffe aus
   Landwirtschaft, Handwerk oder Wagenbau);
   je Wort und Bedeutung die verbreitetste Schreibweise; ohne Wörter, die auch Standarddeutsch
   sind, ohne gebeugte Verbformen, Namen, derbe oder abwertende Wörter und alemannisch bzw.
   schwäbisch wirkende Formen auf -LI; Fragezeichen in
   Bedeutungen entfernt, Bedeutungen sonst unverändert. Im Spiel wird bei diesen Wörtern die
   Quelle unter der Bedeutung angezeigt.

Fränkisch wird regional unterschiedlich gesprochen und geschrieben; Hinweise auf andere
Schreibweisen oder Bedeutungen sind willkommen.

### Übrige Inhalte

Programmcode, Gestaltung und Icons sind eigene Arbeit dieses Projekts. Es werden keine fremden
Bibliotheken, Schriftarten oder Bilder eingebunden.
