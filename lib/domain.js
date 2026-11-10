// Fachlogik, die Server und Browser gemeinsam nutzen. Keine Node-Imports hier.

export const TZ = 'Europe/Vienna';
export const ORTSTEILE = ['Großebersdorf', 'Eibesbrunn', 'Manhartsbrunn', 'Putzing', 'Putzing am See'];
export const ARTEN = ['Antrag', 'Dringlichkeitsantrag', 'Anfrage', 'IFG-Begehren'];
export const STATUS = [
  'Idee',
  'in Ausarbeitung',
  'eingebracht',
  'auf der Tagesordnung',
  'angenommen',
  'abgelehnt',
  'abgeändert oder durch Gegenantrag ersetzt',
  'abgesetzt',
  'vertagt',
  'einem Ausschuss zugewiesen',
  'beantwortet',
  'Folgeschritte offen',
];
export const STATUS_TON = {
  'Idee': 'leise',
  'in Ausarbeitung': 'leise',
  'eingebracht': 'aktiv',
  'auf der Tagesordnung': 'aktiv',
  'einem Ausschuss zugewiesen': 'aktiv',
  'vertagt': 'offen',
  'angenommen': 'gut',
  'beantwortet': 'gut',
  'abgelehnt': 'schlecht',
  'abgesetzt': 'schlecht',
  'abgeändert oder durch Gegenantrag ersetzt': 'offen',
  'Folgeschritte offen': 'offen',
};
// Anträge mit diesen Status kommen automatisch auf die Tagesordnung der Fraktionssitzung
export const OFFENE_STATUS = ['Idee', 'in Ausarbeitung', 'eingebracht', 'auf der Tagesordnung', 'vertagt', 'einem Ausschuss zugewiesen', 'Folgeschritte offen'];
export const ZIELE = ['Info', 'Diskussion', 'Beschluss'];
export const DRINGLICHKEIT = ['hoch', 'mittel', 'niedrig'];
export const ROLLEN = ['Gemeinderat', 'gf. Gemeinderat', 'Vereinsmitglied'];
export const ERGEBNISSE = ['einstimmig angenommen', 'mehrheitlich angenommen', 'abgelehnt', 'vertagt', 'zur Kenntnis genommen'];
export const SITZUNGSARTEN = ['Fraktionssitzung', 'Vorstandssitzung', 'Klausur', 'Arbeitstreffen', 'Veranstaltung', 'Sonstiges'];
/** Anzeigename einer Sitzung: eigene Bezeichnung oder Art */
export const sitzungName = (s) => (s?.titel || s?.art || 'Fraktionssitzung');

export const STANDARD_AUSSCHUESSE = ['Kultur und Veranstaltungen', 'Generationen, Familien, Schule und Bildung'];

// ---------- Zeit ----------

function tzOffsetMin(ts) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - ts) / 60000);
}

/** Wiener Ortszeit (YYYY-MM-DD, HH:MM) als Zeitpunkt */
export function zoned(datum, uhrzeit = '00:00') {
  const [y, m, d] = String(datum).split('-').map(Number);
  const [hh, mm] = String(uhrzeit || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  let t = guess - tzOffsetMin(guess) * 60000;
  const off2 = tzOffsetMin(t);
  t = guess - off2 * 60000;
  return new Date(t);
}

/** Kalendertag in Wien als YYYY-MM-DD */
export function wienTag(ts = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}

export function wienUhrzeit(ts) {
  return new Intl.DateTimeFormat('de-AT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export const sitzungStart = (s) => zoned(s.datum, s.uhrzeit || '19:00');
export const sitzungEnde = (s) => new Date(+sitzungStart(s) + (Number(s.dauerMin) || 120) * 60000);

/** Ende der Einreichfrist: 23:59 am Tag (Sitzung minus fristTage) */
export function fristEnde(s) {
  const mittag = zoned(s.datum, '12:00');
  const tag = wienTag(+mittag - (Number(s.fristTage ?? 3)) * 86400000);
  return zoned(tag, '23:59');
}

/** Kalendertage von heute (Wien) bis zur Sitzung */
export function tageBis(s, now = Date.now()) {
  const a = zoned(wienTag(now), '12:00');
  const b = zoned(s.datum, '12:00');
  return Math.round((b - a) / 86400000);
}

export const fristVorbei = (s, now = Date.now()) => now > +fristEnde(s);

const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_KURZ = ['Jän.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function datumLang(datum) {
  if (!datum) return '';
  const [y, m, t] = datum.split('-').map(Number);
  const wt = WOCHENTAGE[new Date(Date.UTC(y, m - 1, t)).getUTCDay()];
  return `${wt}, ${t}. ${MONATE[m - 1]} ${y}`;
}

/** 2026-10-12 → 12.10.2026, 2025-10 → Okt. 2025 */
export function datumKurz(x) {
  if (!x) return '';
  const s = String(x);
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    return `${MONATE_KURZ[m - 1]} ${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return `${d}.${m}.${y}`;
  }
  return s;
}

export function zeitpunkt(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts));
}

export function fristText(s) {
  const f = fristEnde(s);
  return `${datumKurz(wienTag(+f))}, 23:59 Uhr`;
}

// ---------- Tagesordnung ----------

const RANG_DRINGLICHKEIT = { hoch: 0, mittel: 1, niedrig: 2 };
const RANG_ZIEL = { Beschluss: 0, Diskussion: 1, Info: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function sortiereThemen(a, b) {
  return (RANG_DRINGLICHKEIT[a.dringlichkeit] ?? 1) - (RANG_DRINGLICHKEIT[b.dringlichkeit] ?? 1)
    || (RANG_ZIEL[a.ziel] ?? 1) - (RANG_ZIEL[b.ziel] ?? 1)
    || (a.erstelltAm || 0) - (b.erstelltAm || 0);
}

/** Tagesordnung = eingereichte Themen, sortiert nach Dringlichkeit und Ziel */
export function baueTagesordnung(s, { themen = [] }) {
  return themen
    .filter((t) => t.sitzungId === s.id)
    .sort(sortiereThemen)
    .map((t) => ({
      key: `t-${t.id}`, typ: 'thema', themaId: t.id, titel: t.titel, dauer: Number(t.dauer) || 10,
      ziel: ZIELE.includes(t.ziel) ? t.ziel : 'Diskussion', dringlichkeit: t.dringlichkeit,
      einreicher: t.autorName || '', beschreibung: t.beschreibung || '', link: t.link || '',
      nachtraeglich: !!t.nachtraeglich, unter: [],
    }));
}

/** Aktuelle Tagesordnung: festgelegte Liste, ergänzt um später nachgereichte Themen; gelöschte Themen fallen weg */
export function tagesordnungAktuell(s, daten) {
  const frisch = baueTagesordnung(s, daten);
  if (!s.agendaAm) return { items: frisch, fixiert: false };
  const vorhanden = new Set(frisch.map((i) => i.key));
  const fest = (s.agenda || []).filter((i) => i.typ !== 'thema' ? false : vorhanden.has(i.key));
  const keys = new Set(fest.map((i) => i.key));
  return { items: [...fest, ...frisch.filter((i) => !keys.has(i.key))], fixiert: true };
}

export const summeMinuten = (items) => items.reduce((n, i) => n + (Number(i.dauer) || 0), 0);

/** Uhrzeiten pro Punkt ab Sitzungsbeginn */
export function zeitplan(s, items) {
  let t = +sitzungStart(s);
  return items.map((i) => {
    const von = t;
    t += (Number(i.dauer) || 0) * 60000;
    return { von, bis: t };
  });
}

export function dauerText(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} Min.`;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

// ---------- HTML für Google Docs und Mails ----------

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GRUEN = '#007A3D';

export function tagesordnungHtml(s, items, { appUrl = '', mitLink = '' } = {}) {
  const plan = zeitplan(s, items);
  const summe = summeMinuten(items);
  const rows = items.map((it, i) => {
    const unter = (it.unter || []).map((u) => `<li style="color:${u.warn ? '#A3261B' : '#33413A'}">${esc(u.text)}</li>`).join('');
    const extra = [
      it.einreicher ? `Eingereicht von ${esc(it.einreicher)}` : '',
      it.dringlichkeit ? `Dringlichkeit ${esc(it.dringlichkeit)}` : '',
    ].filter(Boolean).join(', ');
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #D9DFD8;vertical-align:top;font-weight:bold;color:${GRUEN}">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #D9DFD8;vertical-align:top">
        <b>${esc(it.titel)}</b>${extra ? `<br><span style="color:#5B6A61;font-size:13px">${extra}</span>` : ''}
        ${it.beschreibung ? `<br><span style="font-size:13px">${esc(it.beschreibung)}</span>` : ''}
        ${unter ? `<ul style="margin:6px 0 0 18px;padding:0;font-size:13px">${unter}</ul>` : ''}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #D9DFD8;vertical-align:top">${esc(it.ziel)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #D9DFD8;vertical-align:top;white-space:nowrap">${wienUhrzeit(plan[i].von)} bis ${wienUhrzeit(plan[i].bis)}<br><span style="color:#5B6A61;font-size:13px">${it.dauer} Min.</span></td>
    </tr>`;
  }).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#18231D;font-size:14px;line-height:1.45">
  <h1 style="color:${GRUEN};font-size:22px;margin:0 0 4px">Tagesordnung: GFG-${esc(sitzungName(s))}</h1>
  <p style="margin:0 0 14px">${esc(datumLang(s.datum))}, ${esc(s.uhrzeit || '19:00')} Uhr${s.ort ? `, ${esc(s.ort)}` : ''}</p>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr style="text-align:left;background:#DFF3E7">
      <th style="padding:8px 10px">Nr.</th><th style="padding:8px 10px">Punkt</th><th style="padding:8px 10px">Ziel</th><th style="padding:8px 10px">Zeit</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin:14px 0 0"><b>Gesamtdauer:</b> ${dauerText(summe)}, voraussichtliches Ende ${wienUhrzeit(+sitzungStart(s) + summe * 60000)} Uhr.</p>
  ${mitLink ? `<p style="margin:10px 0 0"><a href="${esc(mitLink)}">Tagesordnung als Google Doc öffnen</a></p>` : ''}
  ${appUrl ? `<p style="margin:10px 0 0;color:#5B6A61;font-size:13px">Alle Unterlagen und Themen findest du in der <a href="${esc(appUrl)}">GFG-Fraktions-App</a>.</p>` : ''}
</div>`;
}

export function protokollHtml(s, items, { beschluesse = [], aufgaben = [], mitglieder = [] } = {}) {
  const live = s.live || {};
  const anwesend = (live.anwesend || []).map((id) => mitglieder.find((m) => m.id === id)?.name).filter(Boolean);
  const notizen = live.notizen || {};
  const verbraucht = live.verbraucht || {};
  const beginn = live.gestartetAm ? wienUhrzeit(live.gestartetAm) : (s.uhrzeit || '');
  const ende = live.beendetAm ? wienUhrzeit(live.beendetAm) : '';
  const teile = items.map((it, i) => {
    const b = beschluesse.filter((x) => x.sitzungId === s.id && x.punktKey === it.key);
    const a = aufgaben.filter((x) => x.sitzungId === s.id && x.punktKey === it.key);
    const min = Math.round((verbraucht[it.key] || 0) / 60);
    const notiz = (notizen[it.key] || '').trim();
    return `<h3 style="color:${GRUEN};font-size:16px;margin:18px 0 4px">${i + 1}. ${esc(it.titel)}</h3>
      <p style="margin:0;color:#5B6A61;font-size:13px">Geplant ${it.dauer} Min.${min ? `, tatsächlich ${min} Min.` : ''}${it.einreicher ? `, eingereicht von ${esc(it.einreicher)}` : ''}</p>
      ${notiz ? `<p style="margin:6px 0 0;white-space:pre-wrap">${esc(notiz)}</p>` : ''}
      ${b.length ? `<p style="margin:8px 0 2px"><b>Beschlüsse</b></p><ul style="margin:0 0 0 18px;padding:0">${b.map((x) => `<li>${esc(x.text)} <i>(${esc(x.ergebnis || '')})</i></li>`).join('')}</ul>` : ''}
      ${a.length ? `<p style="margin:8px 0 2px"><b>Aufgaben</b></p><ul style="margin:0 0 0 18px;padding:0">${a.map((x) => `<li>${esc(x.titel)}: ${esc(x.zustaendigName || 'niemand zugeteilt')}${x.frist ? `, bis ${datumKurz(x.frist)}` : ''}</li>`).join('')}</ul>` : ''}`;
  }).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#18231D;font-size:14px;line-height:1.45">
  <h1 style="color:${GRUEN};font-size:22px;margin:0 0 4px">Protokoll: GFG-${esc(sitzungName(s))}</h1>
  <p style="margin:0">${esc(datumLang(s.datum))}${s.ort ? `, ${esc(s.ort)}` : ''}</p>
  <p style="margin:4px 0 0">Beginn ${esc(beginn)} Uhr${ende ? `, Ende ${esc(ende)} Uhr` : ''}</p>
  <p style="margin:4px 0 0"><b>Anwesend:</b> ${anwesend.length ? esc(anwesend.join(', ')) : 'nicht erfasst'}</p>
  ${teile}
</div>`;
}

/** Klartext aus HTML (für Mails und Zwischenablage) */
export function htmlZuText(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|tr|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  • ')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export function slug(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
}

export const neueId = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Etappe 2 ----------

export const VIDEO_STATUS = ['Idee', 'ausgewählt', 'in Arbeit', 'gedreht', 'veröffentlicht'];
export const VIDEO_TON = { 'Idee': 'leise', 'ausgewählt': 'aktiv', 'in Arbeit': 'offen', 'gedreht': 'offen', 'veröffentlicht': 'gut' };
export const TERMIN_ARTEN = ['Gemeinderatssitzung', 'Ausschusssitzung', 'Veranstaltung', 'Frist', 'Sonstiges'];
export const LINIEN = ['offen', 'dafür', 'dagegen', 'Enthaltung', 'freigegeben'];
export const LINIE_TON = { 'offen': 'leise', 'dafür': 'gut', 'dagegen': 'schlecht', 'Enthaltung': 'offen', 'freigegeben': 'aktiv' };
export const GR_ERGEBNISSE = ['', 'angenommen', 'abgelehnt', 'abgeändert angenommen', 'abgesetzt', 'vertagt', 'zur Kenntnis genommen'];

export function monatTitel(tag) {
  const [y, m] = String(tag).split('-').map(Number);
  return `${MONATE[m - 1]} ${y}`;
}

export function wochentagKurz(tag) {
  const [y, m, d] = String(tag).split('-').map(Number);
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Alle Termine für den gemeinsamen Kalender */
export function kalenderEintraege({ sitzungen = [], termine = [], aufgaben = [], grsitzungen = [], ausschuesse = [] }) {
  const e = [];
  for (const s of sitzungen) {
    e.push({ id: `s-${s.id}`, tag: s.datum, zeit: s.uhrzeit, art: 'Fraktionssitzung', titel: `GFG: ${sitzungName(s)}`, ort: s.ort, href: `#sitzung-${s.id}` });
    if (s.status !== 'abgeschlossen') e.push({ id: `f-${s.id}`, tag: wienTag(+fristEnde(s)), zeit: '23:59', art: 'Frist', titel: `Themenfrist: ${sitzungName(s)} am ${datumKurz(s.datum)}`, href: `#sitzung-${s.id}` });
  }
  for (const t of termine) e.push({ id: `t-${t.id}`, tag: t.datum, zeit: t.uhrzeit, art: t.art, titel: t.titel, ort: t.ort, notiz: t.notiz, termin: t });
  for (const a of aufgaben) if (a.frist && a.status !== 'erledigt') e.push({ id: `a-${a.id}`, tag: a.frist, art: 'Frist', titel: `Aufgabe: ${a.titel}`, notiz: a.zustaendigName, href: '#aufgaben' });
  for (const g of grsitzungen) e.push({ id: `g-${g.id}`, tag: g.datum, zeit: g.uhrzeit, art: 'Gemeinderatssitzung', titel: g.titel || 'Gemeinderatssitzung', ort: g.ort, href: g.nurTermin ? undefined : `#grsitzung-${g.id}` });
  for (const a of ausschuesse) {
    if (a.naechsteSitzung && !termine.some((t) => t.datum === a.naechsteSitzung && t.art === 'Ausschusssitzung' && t.titel.includes(a.name))) {
      e.push({ id: `x-${a.id}`, tag: a.naechsteSitzung, art: 'Ausschusssitzung', titel: `Ausschuss ${a.name}`, href: '#ausschuesse' });
    }
  }
  return e.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.tag || '')).sort((a, b) => (a.tag + (a.zeit || '')).localeCompare(b.tag + (b.zeit || '')));
}

// ---------- Benachrichtigungen ----------

/** Arten von Benachrichtigungen mit Standard-Einstellung je Weg (App, Push, E-Mail) */
export const BENACHRICHTIGUNGEN = [
  { gruppe: 'Sitzungen', typen: [
    { key: 'sitzung_neu', label: 'Neue Sitzung', text: 'Eine Sitzung wurde angelegt oder verschoben', std: { app: true, push: true, mail: false } },
    { key: 'erinnerung', label: 'Erinnerung an die Sitzung', text: '7 Tage und 1 Tag vorher', std: { app: true, push: true, mail: true } },
    { key: 'tagesordnung', label: 'Tagesordnung ist fertig', text: 'Nach Ablauf der Einreichfrist', std: { app: true, push: true, mail: true } },
    { key: 'protokoll', label: 'Protokoll ist da', text: 'Wenn eine Sitzung beendet wurde', std: { app: true, push: true, mail: false } },
  ] },
  { gruppe: 'Mitarbeit', typen: [
    { key: 'aufgabe_mir', label: 'Aufgabe für mich', text: 'Neu zugeteilt oder überfällig', std: { app: true, push: true, mail: true } },
    { key: 'thema_neu', label: 'Neues Thema eingereicht', text: 'Für die nächste Sitzung', std: { app: true, push: false, mail: false } },
    { key: 'kommentar', label: 'Neue Kommentare', text: 'Zu Sitzungen, Anträgen und Videothemen', std: { app: true, push: false, mail: false } },
  ] },
  { gruppe: 'Infos und Anträge', typen: [
    { key: 'info', label: 'Infos an die Fraktion', text: 'Auch wichtige Infos mit Lesebestätigung', std: { app: true, push: true, mail: true } },
    { key: 'antrag_status', label: 'Antrag hat neuen Status', text: 'Zum Beispiel angenommen oder beantwortet', std: { app: true, push: true, mail: false } },
    { key: 'bericht', label: 'Neuer Ausschussbericht', text: 'Was in den Ausschüssen läuft', std: { app: true, push: false, mail: false } },
    { key: 'termin', label: 'Neuer Termin im Kalender', text: 'Veranstaltungen, Ausschusssitzungen, Fristen', std: { app: true, push: false, mail: false } },
  ] },
  { gruppe: 'Videothemen', typen: [
    { key: 'video', label: 'Videothemen', text: 'Neue Vorschläge und neuer Status', std: { app: true, push: false, mail: false } },
  ] },
  { gruppe: 'Marketing', nurMK: true, typen: [
    { key: 'beitrag_freigabe', label: 'Beitrag wartet auf Freigabe', text: 'Vier-Augen-Prinzip vor dem Posten', std: { app: true, push: true, mail: false } },
    { key: 'beitrag_mir', label: 'Mein Beitrag', text: 'Freigegeben, zurückgegeben oder kommentiert', std: { app: true, push: true, mail: false } },
  ] },
  { gruppe: 'Gemeinderäte', nurGR: true, typen: [
    { key: 'gr_sitzung', label: 'Gemeinderatssitzung vorbereiten', text: 'Neue Sitzung im Gemeinderäte-Bereich', std: { app: true, push: true, mail: false } },
  ] },
];

export const BENACHRICHTIGUNG_TYP = Object.fromEntries(
  BENACHRICHTIGUNGEN.flatMap((g) => g.typen.map((t) => [t.key, { ...t, gruppe: g.gruppe, nurGR: !!g.nurGR, nurMK: !!g.nurMK }])),
);

/** Wirksame Einstellung einer Person für eine Art und einen Weg */
export function einstellung(prefs, key, weg) {
  const t = BENACHRICHTIGUNG_TYP[key];
  if (!t) return false;
  const eigen = prefs?.typen?.[key]?.[weg];
  return typeof eigen === 'boolean' ? eigen : !!t.std[weg];
}

/**
 * Alles, was in der Fraktion passiert ist, als Liste von Ereignissen mit Art.
 * Grundlage für "Neu seit deinem letzten Besuch" und die Glocke.
 */
export function ereignisse(daten, me) {
  const n = [];
  const fremd = (id, name) => id !== me.uid && name !== me.name;
  for (const s of daten.sitzungen || []) {
    if (s.erstelltAm && s.erstelltVon !== me.name) n.push({ typ: 'sitzung_neu', ts: s.erstelltAm, text: `Neu: ${sitzungName(s)} am ${datumKurz(s.datum)}`, href: `#sitzung-${s.id}` });
    if (s.tagesordnungVersendetAm) n.push({ typ: 'tagesordnung', ts: s.tagesordnungVersendetAm, text: `Tagesordnung für ${datumKurz(s.datum)} ist da`, href: `#sitzung-${s.id}` });
    else if (s.agendaAm) n.push({ typ: 'tagesordnung', ts: s.agendaAm, text: `Tagesordnung für ${datumKurz(s.datum)} steht fest`, href: `#sitzung-${s.id}` });
    if (s.live?.beendetAm) n.push({ typ: 'protokoll', ts: s.live.beendetAm, text: `Protokoll der Sitzung vom ${datumKurz(s.datum)}`, href: `#protokoll-${s.id}` });
  }
  for (const t of daten.themen || []) if (fremd(t.autorId, t.autorName)) n.push({ typ: 'thema_neu', ts: t.erstelltAm, text: `Neues Thema: ${t.titel}`, wer: t.autorName, href: `#sitzung-${t.sitzungId}` });
  for (const a of daten.antraege || []) {
    for (const v of a.verlauf || []) if (v.von !== 'Übernahme' && fremd(v.vonId, v.von)) n.push({ typ: 'antrag_status', ts: v.ts, text: `${a.titel}: ${v.status}`, wer: v.von, href: `#antrag-${a.id}` });
  }
  for (const a of daten.aufgaben || []) {
    const mir = a.zustaendigId === me.uid || a.zustaendigName === me.name;
    n.push({ typ: mir ? 'aufgabe_mir' : 'aufgabe', ts: a.erstelltAm, text: mir ? `Neue Aufgabe für dich: ${a.titel}` : `Neue Aufgabe: ${a.titel}`, wer: mir ? '' : a.zustaendigName, href: '#aufgaben' });
  }
  for (const b of daten.beschluesse || []) n.push({ typ: 'protokoll', ts: b.erstelltAm, text: `Beschluss: ${b.text}`, href: `#protokoll-${b.sitzungId}`, nurNeu: true });
  for (const k of daten.kommentare || []) {
    if (!fremd(k.autorId, k.autorName)) continue;
    const [art, id] = String(k.bezug).split(':');
    const href = art === 'antrag' ? `#antrag-${id}` : art === 'video' ? '#videothemen' : `#sitzung-${id}`;
    n.push({ typ: 'kommentar', ts: k.am, text: `Kommentar: ${k.text.slice(0, 90)}${k.text.length > 90 ? ' …' : ''}`, wer: k.autorName, href });
  }
  for (const v of daten.videothemen || []) {
    if (fremd(v.autorId, v.autorName)) n.push({ typ: 'video', ts: v.erstelltAm, text: `Neues Videothema: ${v.titel}`, wer: v.autorName, href: '#videothemen' });
    if (v.statusAm && v.statusVon !== me.name) n.push({ typ: 'video', ts: v.statusAm, text: `Videothema ${v.titel}: ${v.status}`, wer: v.statusVon, href: '#videothemen' });
  }
  for (const b of daten.berichte || []) {
    if (!fremd(b.autorId, b.autorName)) continue;
    const a = (daten.ausschuesse || []).find((x) => x.id === b.ausschussId);
    n.push({ typ: 'bericht', ts: b.erstelltAm, text: `Bericht aus dem Ausschuss ${a?.name || ''}`, wer: b.autorName, href: '#ausschuesse' });
  }
  for (const t of daten.termine || []) if (t.erstelltVon !== me.name) n.push({ typ: 'termin', ts: t.erstelltAm, text: `Neuer Termin: ${t.titel} am ${datumKurz(t.datum)}`, href: '#kalender' });
  for (const i of daten.infos || []) if (fremd(i.autorId, i.autorName)) n.push({ typ: 'info', ts: i.erstelltAm, text: i.wichtig ? `Wichtig: ${i.titel}` : `Info: ${i.titel}`, wer: i.autorName, href: '#start' });
  for (const b of daten.beitraege || []) {
    const meins = b.autorId === me.uid || b.zustaendigId === me.uid;
    if (b.status === 'Zur Freigabe' && !meins && b.freigabeAngefragtAm) n.push({ typ: 'beitrag_freigabe', ts: b.freigabeAngefragtAm, text: `Freigabe gebraucht: ${b.titel}`, wer: b.freigabeAngefragtVon, href: `#beitrag-${b.id}` });
    if (meins && b.freigabe?.am && b.freigabe.vonId !== me.uid) n.push({ typ: 'beitrag_mir', ts: b.freigabe.am, text: `Freigegeben: ${b.titel}`, wer: b.freigabe.von, href: `#beitrag-${b.id}` });
    for (const k of b.notizen || []) if (meins && k.vonId !== me.uid) n.push({ typ: 'beitrag_mir', ts: k.am, text: `Zu ${b.titel}: ${k.text.slice(0, 80)}`, wer: k.von, href: `#beitrag-${b.id}` });
  }
  for (const g of daten.grsitzungen || []) if (!g.nurTermin && g.erstelltAm && g.erstelltVon !== me.name) n.push({ typ: 'gr_sitzung', ts: g.erstelltAm, text: `Gemeinderatssitzung am ${datumKurz(g.datum)} vorbereiten`, href: `#grsitzung-${g.id}` });
  return n.filter((x) => x.ts).sort((a, b) => b.ts - a.ts);
}


// ---------- Marketing ----------
export const KANAELE = [
  { key: 'facebook', name: 'Facebook', kurz: 'FB', farbe: '#1877F2', limit: 63206, ideal: 400, kennzahl: 'Follower' },
  { key: 'instagram', name: 'Instagram', kurz: 'IG', farbe: '#C13584', limit: 2200, ideal: 300, kennzahl: 'Follower', hashtagLimit: 30 },
  { key: 'whatsapp', name: 'WhatsApp-Kanal', kurz: 'WA', farbe: '#128C4A', limit: 4096, ideal: 500, kennzahl: 'Abonnenten' },
  { key: 'website', name: 'Website', kurz: 'Web', farbe: '#00552A', limit: 0, ideal: 0 },
  { key: 'zeitung', name: 'Gemeindezeitung', kurz: 'Ztg', farbe: '#B07E14', limit: 0, ideal: 0 },
];
export const KANAL = Object.fromEntries(KANAELE.map((k) => [k.key, k]));
export const BEITRAG_STATUS = ['Idee', 'In Arbeit', 'Zur Freigabe', 'Freigegeben', 'Veröffentlicht'];
export const BEITRAG_TON = { Idee: 'leise', 'In Arbeit': 'aktiv', 'Zur Freigabe': 'offen', Freigegeben: 'gut', Veröffentlicht: 'gut' };
export const BEITRAG_FORMATE = ['Foto', 'Video', 'Reel', 'Text', 'Story', 'Umfrage', 'Veranstaltung'];
export const STANDARD_MARKE = {
  hashtags: [
    { name: 'Allgemein', tags: '#GFG #GemeinsamFürUnsereGemeinde #Großebersdorf' },
    { name: 'Ortsteile', tags: '#Großebersdorf #Eibesbrunn #Manhartsbrunn #Putzing #PutzingAmSee' },
    { name: 'Gemeinderat', tags: '#Gemeinderat #Gemeindepolitik #Transparenz' },
  ],
  bausteine: [
    { titel: 'Schluss mit Einladung', text: 'Was meint ihr dazu? Schreibt uns in die Kommentare oder direkt an uns.' },
    { titel: 'Sitzungsbericht', text: 'Aus der Gemeinderatssitzung: Das wurde heute beschlossen und so haben wir abgestimmt.' },
  ],
  kanaele: {},
  regeln: 'Offizielle GFG-Beiträge in der Wir-Form. Persönliche Beiträge einzelner Mitglieder in der Ich-Form. Keine Namen oder Fotos von Bürgerinnen und Bürgern ohne Einverständnis.',
};
/** Zählt Hashtags in einem Text */
export const hashtags = (t) => (String(t || '').match(/#[\p{L}\p{N}_]+/gu) || []);
