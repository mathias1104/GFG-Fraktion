import 'server-only';
import { alle, hole, setze, ergaenze } from './db';
import { ZIELE, DRINGLICHKEIT, fristVorbei, sitzungStart, neueId } from './domain';

const FORM_ID = process.env.JOTFORM_THEMEN_FORM_ID || '263132406379053';

async function holeSubmissions(key) {
  let letzterFehler = null;
  for (const host of ['https://eu-api.jotform.com', 'https://api.jotform.com']) {
    try {
      const r = await fetch(`${host}/form/${FORM_ID}/submissions?apiKey=${encodeURIComponent(key)}&limit=100&orderby=created_at`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && Array.isArray(j.content)) return j.content;
      letzterFehler = new Error(j.message || `Jotform meldet ${r.status}`);
    } catch (e) { letzterFehler = e; }
  }
  throw letzterFehler || new Error('Jotform nicht erreichbar');
}

function antwort(sub, ...stichworte) {
  for (const a of Object.values(sub.answers || {})) {
    const label = String(a.text || a.name || '').toLowerCase();
    if (stichworte.some((s) => label.includes(s))) {
      const v = a.answer;
      if (v == null) return '';
      if (typeof v === 'object') return Object.values(v).filter(Boolean).join(' ');
      return String(v);
    }
  }
  return '';
}

/** Holt neue Formular-Einreichungen und legt sie als Themen der nächsten offenen Sitzung an. */
export async function importiereJotform() {
  const key = process.env.JOTFORM_API_KEY;
  if (!key) return { aktiv: false, neu: 0 };
  const subs = await holeSubmissions(key);
  const { themen, sitzungen } = await alle(['themen', 'sitzungen']);
  const schon = new Set(themen.map((t) => t.jotformId).filter(Boolean));
  const cfg = (await hole('config', 'app')) || {};
  const ignoriert = new Set(cfg.jotformIgnoriert || []);
  let neu = 0;
  for (const sub of subs) {
    if (schon.has(sub.id) || ignoriert.has(sub.id) || sub.status === 'DELETED') continue;
    const eingang = new Date(String(sub.created_at).replace(' ', 'T') + '-05:00').getTime() || Date.now();
    const ziel = sitzungen
      .filter((s) => s.status !== 'abgeschlossen' && +sitzungStart(s) > eingang)
      .sort((a, b) => sitzungStart(a) - sitzungStart(b))[0];
    if (!ziel) continue;
    const titel = antwort(sub, 'titel').trim();
    if (!titel) continue;
    const zielWert = antwort(sub, 'ziel').trim();
    const dr = antwort(sub, 'dringlich').trim().toLowerCase();
    const ortsteil = antwort(sub, 'ortsteil').trim();
    const beschreibung = [antwort(sub, 'beschreibung').trim(), ortsteil ? `Ortsteil: ${ortsteil}` : ''].filter(Boolean).join('\n');
    const link = antwort(sub, 'link', 'unterlagen').trim();
    await setze('themen', neueId('t'), {
      sitzungId: ziel.id,
      titel: titel.slice(0, 140),
      beschreibung: beschreibung.slice(0, 1500),
      dauer: Math.max(5, Math.min(120, Number(antwort(sub, 'dauer')) || 10)),
      ziel: ZIELE.includes(zielWert) ? zielWert : 'Diskussion',
      dringlichkeit: DRINGLICHKEIT.includes(dr) ? dr : 'mittel',
      link: /^https?:\/\//.test(link) ? link.slice(0, 500) : '',
      autorId: 'jotform',
      autorName: (antwort(sub, 'name').trim() || 'Formular').slice(0, 80) + ' (Formular)',
      erstelltAm: eingang,
      nachtraeglich: fristVorbei(ziel, eingang),
      jotformId: sub.id,
    });
    neu += 1;
  }
  await ergaenze('config', 'app', { jotformLetzterAbruf: Date.now() });
  return { aktiv: true, neu };
}
