// Erkennt Datum, Uhrzeit, Ort und Tagesordnungspunkte in einer Einladung (Kurrende) zur Gemeinderatssitzung.
// Funktioniert mit Textebene und mit gescanntem Text (OCR), auch mit Formaten wie "1.)" oder "TOP 1:".

const MONATE = { jänner: 1, januar: 1, jaenner: 1, jän: 1, jan: 1, februar: 2, feber: 2, feb: 2, märz: 3, maerz: 3, mär: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9, oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12 };
const MONAT_RE = 'jänner|januar|jaenner|jän|jan|februar|feber|feb|märz|maerz|mär|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez';
const pad = (n) => String(n).padStart(2, '0');

function findeDatum(kopf) {
  const funde = [];
  const reWort = new RegExp(`(\\d{1,2})\\.\\s*(${MONAT_RE})\\.?\\s*(\\d{4})`, 'gi');
  const reZahl = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/g;
  for (const m of kopf.matchAll(reWort)) funde.push({ i: m.index, wert: `${m[3]}-${pad(MONATE[m[2].toLowerCase()])}-${pad(m[1])}` });
  for (const m of kopf.matchAll(reZahl)) funde.push({ i: m.index, wert: `${m[3]}-${pad(m[2])}-${pad(m[1])}` });
  const bewerte = (f) => {
    const vor = kopf.slice(Math.max(0, f.i - 45), f.i);
    const zeile = vor.split('\n').pop();
    let p = 0;
    if (/\bdem\s*$/i.test(vor) || /(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\s*,?\s*(dem\s*)?$/i.test(vor)) p += 10; // Sitzungstag
    if (/\bam\s*$/i.test(vor)) p += 3;
    if (/\b(vom|protokoll|sitzung am)\b/i.test(zeile) && !/werden zu der am/i.test(vor)) p -= 6;
    if (/[A-ZÄÖÜ][a-zäöüß]+,\s*am\s*$/.test(zeile)) p -= 8; // "Großebersdorf, am 23.04.2026" ist das Briefdatum
    return p;
  };
  funde.sort((a, b) => bewerte(b) - bewerte(a) || b.i - a.i);
  return funde[0]?.wert || '';
}

export function erkenneEinladung(roh) {
  let t = String(roh || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/\t/g, ' ');
  // Gesperrte Schrift wie "T A G E S O R D N U N G" zusammenziehen
  t = t.replace(/(?:^|(?<=\s))(?:[A-Za-zÄÖÜäöüß] ){3,}[A-Za-zÄÖÜäöüß](?=\s|$|:)/gm, (m) => m.replace(/ /g, ''));
  const zeilen = t.split('\n').map((z) => z.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const start = zeilen.findIndex((z) => /^tagesordnung|^t\s*o\s*:|tagesordnung\s*:?$/i.test(z));
  // Kopf: alles bis zum ersten TOP (manchmal stehen Datum und Ort erst nach "Tagesordnung")
  const ersterTop = zeilen.findIndex((z, i) => i > start && /^(?:top|pkt\.?|punkt)?\s*1\s*(?:\.\)|[.):])/i.test(z));
  const kopf = zeilen.slice(0, ersterTop > 0 ? ersterTop : (start >= 0 ? start + 1 : 20)).join('\n');

  const datum = findeDatum(kopf);
  let uhrzeit = '';
  const u = kopf.match(/(\d{1,2})[:.](\d{2})\s*uhr/i) || kopf.match(/um\s+(\d{1,2})\s*uhr/i);
  if (u) uhrzeit = `${pad(u[1])}:${u[2] && u[2].length === 2 ? u[2] : '00'}`;
  let ort = '';
  const o = kopf.match(/^\s*Ort:\s*(.+)$/im)
    || kopf.match(/\b(?:im|in der|in den|im großen|im kleinen)\s+((?:Sitzungs|Gemeinde|Rat|Fest|Turn|Mehrzweck|Veranstaltungs|Feuerwehr|Pfarr|Kultur|Bürger|Amts)[^\n;]*?)(?=,?\s*stattfindend|\s+statt\b|\s+eingeladen|\.?\s*$)/im);
  if (o) ort = o[1].trim().replace(/,\s*$/, '').slice(0, 160);

  const ende = /^(der|die)\s+(bürgermeister|buergermeister|bürgermeisterin|vorsitzende)|^mit freundlichen|^hochachtungsvoll|^ergeht an|^hinweis|^anmerkung|^für den gemeinderat|^unterschrift|^gefertigt|^verteiler|^angeschlagen|^kundgemacht|^auf die teilnahmepflicht|^[e•·*]?\s*ist ein (geladenes )?mitglied|^sachbearbeiter/i;
  const punkt = /^(?:top|pkt\.?|punkt)?\s*(\d{1,2})\s*(?:\.\)|[.):])\s*(.*)$/i;
  const tops = [];
  let nichtOeffentlich = false;
  let noeZaehler = 0;
  for (let i = start >= 0 ? start + 1 : 0; i < zeilen.length; i += 1) {
    const z = zeilen[i];
    if (ende.test(z)) break;
    if (/^seite\s+\d+/i.test(z) || /^-\s*\d+\s*-$/.test(z)) continue;
    if (/^nicht[\s.-]*öffentlich|^vertraulich/i.test(z) && z.length < 60 && !punkt.test(z)) { nichtOeffentlich = true; continue; }
    if (/^öffentliche?\s*(sitzung|teil)?\s*:?\s*\|?$/i.test(z)) continue;
    const m = z.match(punkt);
    const nr = m ? Number(m[1]) : 0;
    const letzte = tops[tops.length - 1];
    const letzteNr = letzte ? Number(String(letzte.nr).replace(/\D/g, '')) : 0;
    // neuer TOP: fortlaufende Nummer, oder im nicht öffentlichen Teil ein Neubeginn bei 1
    const neu = m && nr > 0 && (!letzte ? nr <= 3 : (nr === letzteNr + 1 || (nichtOeffentlich && nr === 1 && !letzte.nichtOeffentlich)));
    if (neu) {
      const neuBeginn = nichtOeffentlich && (nr === 1 || (letzte?.nichtOeffentlich && /^n\.ö\./.test(letzte.nr)));
      if (neuBeginn) noeZaehler += 1;
      tops.push({ nr: neuBeginn ? `n.ö. ${noeZaehler}` : String(nr), titel: m[2] || '', nichtOeffentlich });
      continue;
    }
    if (letzte && letzte.titel.length < 300) letzte.titel = letzte.titel ? `${letzte.titel} ${z}` : z;
  }
  for (const x of tops) {
    x.titel = x.titel.replace(/\s+/g, ' ').replace(/(\w)- (?!und\b|oder\b|bzw\b)([a-zäöüß])/g, '$1$2')
      .replace(/^[)\].:]\s*/, '').replace(/[;,|]\s*$/, '').replace(/\s+\./g, '.').trim();
  }
  return { datum, uhrzeit, ort, tops: tops.filter((x) => x.titel) };
}
