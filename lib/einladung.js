// Erkennt Datum, Uhrzeit, Ort und Tagesordnungspunkte in einer Einladung (Kurrende) zur Gemeinderatssitzung.

const MONATE = { jänner: 1, januar: 1, jaenner: 1, februar: 2, feber: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
const pad = (n) => String(n).padStart(2, '0');

export function erkenneEinladung(roh) {
  let t = String(roh || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/\t/g, ' ');
  // Gesperrte Schrift wie "T A G E S O R D N U N G" zusammenziehen
  t = t.replace(/(?:^|(?<=\s))(?:[A-Za-zÄÖÜäöüß] ){3,}[A-Za-zÄÖÜäöüß](?=\s|$|:)/gm, (m) => m.replace(/ /g, ''));
  const zeilen = t.split('\n').map((z) => z.replace(/\s+/g, ' ').trim()).filter(Boolean);

  let start = zeilen.findIndex((z) => /tagesordnung/i.test(z));
  const kopf = (start >= 0 ? zeilen.slice(0, start + 1) : zeilen.slice(0, 15)).join('\n');

  // Datum: bevorzugt das Datum nach "am" (Sitzungstag), nicht das Briefdatum
  const funde = [];
  const reWort = /(\d{1,2})\.\s*(jänner|januar|jaenner|februar|feber|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})/gi;
  const reZahl = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/g;
  for (const m of kopf.matchAll(reWort)) funde.push({ i: m.index, wert: `${m[3]}-${pad(MONATE[m[2].toLowerCase()])}-${pad(m[1])}` });
  for (const m of kopf.matchAll(reZahl)) funde.push({ i: m.index, wert: `${m[3]}-${pad(m[2])}-${pad(m[1])}` });
  funde.sort((a, b) => a.i - b.i);
  const beiAm = funde.find((f) => /\b(am|vom)\b[^\n]{0,25}$/i.test(kopf.slice(Math.max(0, f.i - 30), f.i)) && !/vom/i.test(kopf.slice(Math.max(0, f.i - 12), f.i)));
  const datum = (beiAm || funde[funde.length - 1] || { wert: '' }).wert;
  // Uhrzeit
  let uhrzeit = '';
  const u = kopf.match(/(\d{1,2})[:.](\d{2})\s*uhr/i) || kopf.match(/um\s+(\d{1,2})\s*uhr/i);
  if (u) uhrzeit = `${pad(u[1])}:${u[2] && u[2].length === 2 ? u[2] : '00'}`;
  // Ort
  let ort = '';
  const o = kopf.match(/(?:^|[\s,])(?:im|in der|in den|im großen|im kleinen)\s+((?:Sitzungs|Gemeinde|Rat|Fest|Turn|Mehrzweck|Veranstaltungs|Feuerwehr|Pfarr|Kultur|Bürger)[^\n.,;]*)/i);
  if (o) ort = o[1].trim().replace(/\s*(statt|stattfindet)$/i, '');

  const ende = /^(der|die)\s+(bürgermeister|buergermeister|bürgermeisterin|vorsitzende)|^mit freundlichen|^hochachtungsvoll|^ergeht an|^hinweis|^anmerkung|^für den gemeinderat|^unterschrift|^gefertigt|^verteiler|^angeschlagen|^kundgemacht/i;
  const punkt = /^(?:top|pkt\.?|punkt)?\s*(\d{1,2})\s*[.):]\s*(.*)$/i;
  const tops = [];
  let nichtOeffentlich = false;
  for (let i = start >= 0 ? start + 1 : 0; i < zeilen.length; i += 1) {
    const z = zeilen[i];
    if (ende.test(z)) break;
    if (/^seite\s+\d+/i.test(z) || /^-\s*\d+\s*-$/.test(z)) continue;
    if (/nicht\s*öffentlich|vertraulich/i.test(z) && z.length < 70 && !punkt.test(z)) { nichtOeffentlich = true; continue; }
    if (/^öffentlich/i.test(z) && z.length < 50) continue;
    const m = z.match(punkt);
    const nr = m ? Number(m[1]) : 0;
    const letzte = tops[tops.length - 1];
    if (m && nr > 0 && (!letzte ? nr <= 3 : nr === Number(letzte.nr) + 1)) {
      tops.push({ nr: String(nr), titel: m[2] || '', nichtOeffentlich });
      continue;
    }
    if (letzte && letzte.titel.length < 400) letzte.titel = letzte.titel ? `${letzte.titel} ${z}` : z;
  }
  for (const x of tops) x.titel = x.titel.replace(/\s+/g, ' ').replace(/[;,]\s*$/, '').replace(/\s+\./g, '.').trim();
  return { datum, uhrzeit, ort, tops: tops.filter((x) => x.titel) };
}
