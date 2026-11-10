import 'server-only';
import { alle, hole, ergaenze } from './db';
import { kalenderTermin, googleDoc, sendeMail, googleStatus } from './google';
import { importiereJotform } from './jotform';
import {
  baueTagesordnung, tagesordnungHtml, protokollHtml, htmlZuText, datumKurz, datumLang,
  fristEnde, fristText, fristVorbei, tageBis, sitzungStart,
} from './domain';

async function kontext() {
  const d = await alle(['sitzungen', 'themen', 'aufgaben', 'antraege', 'beschluesse', 'mitglieder']);
  const config = (await hole('config', 'app')) || {};
  const emails = d.mitglieder.map((m) => (m.email || '').trim()).filter((e) => /.+@.+\..+/.test(e));
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  config.appUrl = config.appUrl || (prod ? `https://${prod}` : '');
  return { ...d, config, emails };
}

export async function fixiereTagesordnung(id) {
  const k = await kontext();
  const s = k.sitzungen.find((x) => x.id === id);
  if (!s) throw new Error('Sitzung nicht gefunden');
  const agenda = baueTagesordnung(s, k);
  await ergaenze('sitzungen', id, { agenda, agendaAm: Date.now() });
  return agenda;
}

export async function sendeEinladung(id, appUrl) {
  const k = await kontext();
  const s = k.sitzungen.find((x) => x.id === id);
  if (!s) throw new Error('Sitzung nicht gefunden');
  const url = appUrl || k.config.appUrl || '';
  const ev = await kalenderTermin({
    eventId: s.kalenderEventId,
    summary: 'GFG-Fraktionssitzung',
    location: s.ort || '',
    description: [
      `Fraktionssitzung der GFG am ${datumLang(s.datum)}.`,
      `Themen für die Tagesordnung bitte bis ${fristText(s)} einreichen.`,
      url ? `Zur Fraktions-App: ${url}` : '',
    ].filter(Boolean).join('\n\n'),
    datum: s.datum, uhrzeit: s.uhrzeit, dauerMin: s.dauerMin, gaeste: k.emails,
  });
  await ergaenze('sitzungen', id, { kalenderEventId: ev.id, kalenderLink: ev.htmlLink || '', eingeladenAm: Date.now(), eingeladeneAnzahl: k.emails.length });
  return { link: ev.htmlLink, anzahl: k.emails.length };
}

export async function versendeTagesordnung(id, appUrl) {
  const k = await kontext();
  const s = k.sitzungen.find((x) => x.id === id);
  if (!s) throw new Error('Sitzung nicht gefunden');
  const agenda = s.agenda?.length ? s.agenda : baueTagesordnung(s, k);
  const url = appUrl || k.config.appUrl || '';
  const titel = `Tagesordnung GFG-Fraktionssitzung ${datumKurz(s.datum)}`;
  const doc = await googleDoc(titel, tagesordnungHtml(s, agenda, { appUrl: url }), k.config.driveFolderId);
  const html = `<p>Liebe Fraktion,</p><p>hier ist die Tagesordnung für unsere nächste Sitzung.</p>${tagesordnungHtml(s, agenda, { appUrl: url, mitLink: doc.webViewLink })}`;
  await sendeMail({ an: k.emails, betreff: titel, html, text: htmlZuText(html) });
  await ergaenze('sitzungen', id, { agenda, agendaAm: s.agendaAm || Date.now(), tagesordnungDocUrl: doc.webViewLink, tagesordnungVersendetAm: Date.now() });
  return { link: doc.webViewLink, anzahl: k.emails.length };
}

export async function speichereProtokoll(id) {
  const k = await kontext();
  const s = k.sitzungen.find((x) => x.id === id);
  if (!s) throw new Error('Sitzung nicht gefunden');
  const agenda = s.agenda?.length ? s.agenda : baueTagesordnung(s, k);
  const html = protokollHtml(s, agenda, k);
  const doc = await googleDoc(`Protokoll GFG-Fraktionssitzung ${datumKurz(s.datum)}`, html, k.config.driveFolderId);
  await ergaenze('sitzungen', id, { protokollDocUrl: doc.webViewLink, protokollAm: Date.now() });
  return { link: doc.webViewLink };
}

async function erinnerung(s, k, tage) {
  const url = k.config.appUrl || '';
  const wann = tage <= 1 ? 'morgen' : `in ${tage} Tagen`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18231D">
    <p>Liebe Fraktion,</p>
    <p>${wann} ist unsere Fraktionssitzung: <b>${datumLang(s.datum)}, ${s.uhrzeit || '19:00'} Uhr</b>${s.ort ? `, ${s.ort}` : ''}.</p>
    ${!fristVorbei(s) ? `<p>Themen für die Tagesordnung können noch bis ${fristText(s)} eingereicht werden.</p>` : ''}
    ${s.tagesordnungDocUrl ? `<p><a href="${s.tagesordnungDocUrl}">Zur Tagesordnung</a></p>` : ''}
    ${url ? `<p><a href="${url}">Zur Fraktions-App</a></p>` : ''}
  </div>`;
  await sendeMail({ an: k.emails, betreff: `Erinnerung: GFG-Fraktionssitzung ${wann}`, html, text: htmlZuText(html) });
}

/** Täglicher Lauf (Vercel Cron) */
export async function taeglicherLauf() {
  const log = [];
  try {
    const j = await importiereJotform();
    if (j.aktiv) log.push(`Jotform: ${j.neu} neue Themen übernommen`);
  } catch (e) { log.push(`Jotform: Fehler ${e.message}`); }
  const k = await kontext();
  const g = await googleStatus();
  const google = g.eingerichtet && g.verbunden;
  const jetzt = Date.now();
  for (const s of k.sitzungen) {
    if (s.status === 'abgeschlossen' || +sitzungStart(s) < jetzt) continue;
    const tage = tageBis(s, jetzt);
    try {
      if (jetzt > +fristEnde(s) && !s.agenda?.length) {
        await fixiereTagesordnung(s.id);
        log.push(`${s.datum}: Tagesordnung fixiert`);
      }
      if (!google) continue;
      if (jetzt > +fristEnde(s) && !s.tagesordnungVersendetAm) {
        await versendeTagesordnung(s.id);
        log.push(`${s.datum}: Tagesordnung als Doc gespeichert und versendet`);
      }
      if (tage <= 7 && tage >= 2 && !s.erinnerung7Am && (jetzt - (s.erstelltAm || 0)) > 86400000) {
        await erinnerung(s, k, tage);
        await ergaenze('sitzungen', s.id, { erinnerung7Am: jetzt });
        log.push(`${s.datum}: Erinnerung ${tage} Tage vorher`);
      }
      if (tage <= 1 && tage >= 0 && !s.erinnerung1Am) {
        await erinnerung(s, k, tage);
        await ergaenze('sitzungen', s.id, { erinnerung1Am: jetzt });
        log.push(`${s.datum}: Erinnerung 1 Tag vorher`);
      }
    } catch (e) {
      log.push(`${s.datum}: Fehler ${e.message}`);
    }
  }
  return { google, log };
}
