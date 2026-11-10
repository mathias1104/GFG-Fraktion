import { NextResponse } from 'next/server';
import { hole, setze, ergaenze, loesche, alle } from '@/lib/db';
import { leseSitzung, hashPasswort } from '@/lib/auth';
import { fixiereTagesordnung } from '@/lib/aktionen';
import {
  ARTEN, STATUS, ZIELE, DRINGLICHKEIT, ROLLEN, ERGEBNISSE, ORTSTEILE, fristVorbei, neueId,
} from '@/lib/domain';

class Fehler extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const txt = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const pflicht = (v, feld, max = 300) => { const t = txt(v, max); if (!t) throw new Fehler(`${feld} fehlt.`); return t; };
const auswahl = (v, liste, std) => (liste.includes(v) ? v : std);
const datum = (v) => { const t = txt(v, 10); if (t && !/^\d{4}-\d{2}(-\d{2})?$/.test(t)) throw new Fehler('Datum ist ungültig.'); return t; };
const uhrzeit = (v) => { const t = txt(v, 5) || '19:00'; if (!/^\d{2}:\d{2}$/.test(t)) throw new Fehler('Uhrzeit ist ungültig.'); return t; };
const zahl = (v, min, max, std) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : std; };
const url = (v) => { const t = txt(v, 500); if (t && !/^https?:\/\//i.test(t)) throw new Fehler('Links müssen mit http:// oder https:// beginnen.'); return t; };

function nurGR(me) { if (!me.gr) throw new Fehler('Das dürfen nur Gemeinderäte. Schalte dich im Reiter Gemeinderäte frei.', 403); }

async function muss(col, id) {
  const d = await hole(col, String(id || ''));
  if (!d) throw new Fehler('Eintrag nicht gefunden.', 404);
  return d;
}

const AKTIONEN = {
  // ---------- Themen ----------
  async 'thema.speichern'(me, p) {
    const s = await muss('sitzungen', p.sitzungId);
    const vorbei = fristVorbei(s) || s.status === 'abgeschlossen';
    const daten = {
      titel: pflicht(p.titel, 'Titel', 140),
      beschreibung: txt(p.beschreibung, 1500),
      dauer: zahl(p.dauer, 5, 120, 10),
      ziel: auswahl(p.ziel, ZIELE, 'Diskussion'),
      dringlichkeit: auswahl(p.dringlichkeit, DRINGLICHKEIT, 'mittel'),
      link: url(p.link),
    };
    if (p.id) {
      const t = await muss('themen', p.id);
      if (!me.gr && (t.autorId !== me.uid || vorbei)) throw new Fehler('Du kannst nur eigene Themen vor Ablauf der Frist ändern.', 403);
      await ergaenze('themen', p.id, { ...daten, geaendertAm: Date.now() });
      return { id: p.id };
    }
    if (vorbei && !me.gr) throw new Fehler('Die Einreichfrist für diese Sitzung ist abgelaufen.', 403);
    const id = neueId('t');
    await setze('themen', id, { ...daten, sitzungId: s.id, autorId: me.uid, autorName: me.name, erstelltAm: Date.now(), nachtraeglich: vorbei });
    return { id };
  },
  async 'thema.loeschen'(me, p) {
    const t = await muss('themen', p.id);
    const s = await hole('sitzungen', t.sitzungId);
    if (!me.gr && (t.autorId !== me.uid || (s && fristVorbei(s)))) throw new Fehler('Du kannst nur eigene Themen vor Ablauf der Frist löschen.', 403);
    await loesche('themen', p.id);
    return {};
  },

  // ---------- Kommentare ----------
  async 'kommentar.neu'(me, p) {
    const bezug = txt(p.bezug, 80);
    if (!/^(antrag|thema|sitzung):[\w-]+$/.test(bezug)) throw new Fehler('Bezug ist ungültig.');
    const id = neueId('k');
    await setze('kommentare', id, { bezug, text: pflicht(p.text, 'Kommentar', 2000), autorId: me.uid, autorName: me.name, am: Date.now() });
    return { id };
  },
  async 'kommentar.loeschen'(me, p) {
    const k = await muss('kommentare', p.id);
    if (!me.gr && k.autorId !== me.uid) throw new Fehler('Du kannst nur eigene Kommentare löschen.', 403);
    await loesche('kommentare', p.id);
    return {};
  },

  // ---------- Aufgaben ----------
  async 'aufgabe.speichern'(me, p) {
    nurGR(me);
    const daten = {
      titel: pflicht(p.titel, 'Aufgabe', 200),
      zustaendigId: txt(p.zustaendigId, 40),
      zustaendigName: txt(p.zustaendigName, 80),
      frist: datum(p.frist),
      sitzungId: txt(p.sitzungId, 40),
      punktKey: txt(p.punktKey, 60),
      punktTitel: txt(p.punktTitel, 200),
    };
    if (p.id) { await ergaenze('aufgaben', p.id, { ...daten, geaendertAm: Date.now() }); return { id: p.id }; }
    const id = neueId('a');
    await setze('aufgaben', id, { ...daten, status: 'offen', erstelltAm: Date.now(), erstelltVon: me.name });
    return { id };
  },
  async 'aufgabe.status'(me, p) {
    await muss('aufgaben', p.id);
    const status = p.status === 'erledigt' ? 'erledigt' : 'offen';
    await ergaenze('aufgaben', p.id, { status, erledigtAm: status === 'erledigt' ? Date.now() : null, erledigtVon: status === 'erledigt' ? me.name : '' });
    return {};
  },
  async 'aufgabe.loeschen'(me, p) { nurGR(me); await loesche('aufgaben', txt(p.id, 40)); return {}; },

  // ---------- Beschlüsse ----------
  async 'beschluss.neu'(me, p) {
    nurGR(me);
    const id = neueId('b');
    await setze('beschluesse', id, {
      sitzungId: pflicht(p.sitzungId, 'Sitzung', 40), punktKey: txt(p.punktKey, 60), punktTitel: txt(p.punktTitel, 200),
      text: pflicht(p.text, 'Beschlusstext', 1500), ergebnis: auswahl(p.ergebnis, ERGEBNISSE, 'einstimmig angenommen'),
      erstelltAm: Date.now(), erstelltVon: me.name,
    });
    return { id };
  },
  async 'beschluss.loeschen'(me, p) { nurGR(me); await loesche('beschluesse', txt(p.id, 40)); return {}; },

  // ---------- Sitzungen ----------
  async 'sitzung.speichern'(me, p) {
    nurGR(me);
    const daten = {
      datum: datum(p.datum) || (() => { throw new Fehler('Datum fehlt.'); })(),
      uhrzeit: uhrzeit(p.uhrzeit),
      dauerMin: zahl(p.dauerMin, 30, 360, 120),
      ort: txt(p.ort, 200),
      fristTage: zahl(p.fristTage, 0, 14, 3),
      notiz: txt(p.notiz, 1000),
    };
    if (daten.datum.length !== 10) throw new Fehler('Bitte ein vollständiges Datum wählen.');
    if (p.id) { await ergaenze('sitzungen', p.id, { ...daten, geaendertAm: Date.now() }); return { id: p.id }; }
    const id = neueId('s');
    await setze('sitzungen', id, { ...daten, status: 'geplant', erstelltAm: Date.now(), erstelltVon: me.name });
    return { id };
  },
  async 'sitzung.loeschen'(me, p) {
    nurGR(me);
    const id = txt(p.id, 40);
    const { themen } = await alle(['themen']);
    for (const t of themen.filter((x) => x.sitzungId === id)) await loesche('themen', t.id);
    await loesche('sitzungen', id);
    return {};
  },
  async 'sitzung.fixieren'(me, p) { nurGR(me); await muss('sitzungen', p.id); await fixiereTagesordnung(p.id); return {}; },
  async 'sitzung.live'(me, p) {
    nurGR(me);
    const s = await muss('sitzungen', p.id);
    const l = p.live || {};
    const live = {
      index: zahl(l.index, 0, 200, 0),
      laufend: !!l.laufend,
      punktStart: Number(l.punktStart) || null,
      gestartetAm: Number(l.gestartetAm) || null,
      beendetAm: Number(l.beendetAm) || null,
      verbraucht: Object.fromEntries(Object.entries(l.verbraucht || {}).slice(0, 200).map(([k, v]) => [txt(k, 60), zahl(v, 0, 86400, 0)])),
      anwesend: (Array.isArray(l.anwesend) ? l.anwesend : []).slice(0, 100).map((x) => txt(x, 40)),
      notizen: Object.fromEntries(Object.entries(l.notizen || {}).slice(0, 200).map(([k, v]) => [txt(k, 60), txt(v, 8000)])),
    };
    const teil = { live };
    if (!s.agenda?.length && p.agenda) teil.agenda = p.agenda;
    if (s.status === 'geplant' && live.gestartetAm) teil.status = 'laufend';
    await ergaenze('sitzungen', s.id, teil);
    return {};
  },
  async 'sitzung.agendaAnpassen'(me, p) {
    nurGR(me);
    await muss('sitzungen', p.id);
    const agenda = (Array.isArray(p.agenda) ? p.agenda : []).slice(0, 100).map((it) => ({
      ...it, titel: txt(it.titel, 200), dauer: zahl(it.dauer, 1, 240, 5),
    }));
    await ergaenze('sitzungen', p.id, { agenda, agendaAm: Date.now() });
    return {};
  },
  async 'sitzung.abschliessen'(me, p) {
    nurGR(me);
    const s = await muss('sitzungen', p.id);
    const live = { ...(s.live || {}), laufend: false, beendetAm: (s.live && s.live.beendetAm) || Date.now() };
    await ergaenze('sitzungen', s.id, { status: 'abgeschlossen', live });
    return {};
  },
  async 'sitzung.wiedereroeffnen'(me, p) {
    nurGR(me);
    const s = await muss('sitzungen', p.id);
    await ergaenze('sitzungen', s.id, { status: 'laufend', live: { ...(s.live || {}), beendetAm: null } });
    return {};
  },

  // ---------- Anträge ----------
  async 'antrag.speichern'(me, p) {
    nurGR(me);
    const daten = {
      titel: pflicht(p.titel, 'Titel', 200),
      art: auswahl(p.art, ARTEN, 'Antrag'),
      einbringer: txt(p.einbringer, 200),
      datum: datum(p.datum),
      grSitzung: txt(p.grSitzung, 120),
      top: txt(p.top, 20),
      ausschuss: txt(p.ausschuss, 120),
      dokumente: (Array.isArray(p.dokumente) ? p.dokumente : []).slice(0, 20)
        .map((d) => ({ titel: txt(d.titel, 120) || 'Dokument', url: url(d.url) })).filter((d) => d.url),
      notizen: txt(p.notizen, 4000),
    };
    const jetzt = Date.now();
    if (p.id) { await ergaenze('antraege', p.id, { ...daten, geaendertAm: jetzt }); return { id: p.id }; }
    const id = neueId('r');
    const status = auswahl(p.status, STATUS, 'Idee');
    await setze('antraege', id, { ...daten, status, geaendertAm: jetzt, erstelltAm: jetzt, verlauf: [{ status, datum: '', notiz: 'Angelegt', von: me.name, vonId: me.uid, ts: jetzt }] });
    return { id };
  },
  async 'antrag.status'(me, p) {
    nurGR(me);
    const a = await muss('antraege', p.id);
    const status = auswahl(p.status, STATUS, null);
    if (!status) throw new Fehler('Status ist ungültig.');
    const jetzt = Date.now();
    const verlauf = [...(a.verlauf || []), { status, datum: datum(p.datum), notiz: txt(p.notiz, 1000), von: me.name, vonId: me.uid, ts: jetzt }];
    await ergaenze('antraege', a.id, { status, verlauf, geaendertAm: jetzt });
    return {};
  },
  async 'antrag.loeschen'(me, p) { nurGR(me); await loesche('antraege', txt(p.id, 40)); return {}; },

  // ---------- Mitglieder ----------
  async 'mitglied.speichern'(me, p) {
    nurGR(me);
    const email = txt(p.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fehler('Die E-Mail-Adresse sieht ungültig aus.');
    const daten = {
      name: pflicht(p.name, 'Name', 80), email, rolle: auswahl(p.rolle, ROLLEN, 'Vereinsmitglied'),
      funktion: txt(p.funktion, 80), ortsteil: auswahl(p.ortsteil, ORTSTEILE, ''),
    };
    if (p.id) { await ergaenze('mitglieder', p.id, daten); return { id: p.id }; }
    const id = neueId('m');
    await setze('mitglieder', id, { ...daten, erstelltAm: Date.now() });
    return { id };
  },
  async 'mitglied.loeschen'(me, p) { nurGR(me); await loesche('mitglieder', txt(p.id, 40)); return {}; },

  // ---------- Einstellungen ----------
  async 'config.speichern'(me, p) {
    nurGR(me);
    const teil = {};
    if ('fristTage' in p) teil.fristTage = zahl(p.fristTage, 0, 14, 3);
    if ('driveFolderId' in p) teil.driveFolderId = txt(p.driveFolderId, 100);
    if ('appUrl' in p) teil.appUrl = url(p.appUrl);
    if ('ausschuesse' in p) teil.ausschuesse = (Array.isArray(p.ausschuesse) ? p.ausschuesse : []).map((x) => txt(x, 100)).filter(Boolean).slice(0, 30);
    if ('mitgliederPasswort' in p) {
      const pw = String(p.mitgliederPasswort || '');
      if (pw.length < 6) throw new Fehler('Das Fraktionspasswort braucht mindestens 6 Zeichen.');
      teil.mitgliederPasswort = hashPasswort(pw);
    }
    await ergaenze('config', 'app', teil);
    return {};
  },

  // ---------- Besuch ----------
  async 'besuch'(me) {
    await setze('besuche', me.uid, { ts: Date.now(), name: me.name });
    return {};
  },
};

export async function POST(req) {
  const me = await leseSitzung();
  if (!me) return NextResponse.json({ fehler: 'Bitte melde dich an.' }, { status: 401 });
  const { aktion, daten } = await req.json().catch(() => ({}));
  const f = AKTIONEN[aktion];
  if (!f) return NextResponse.json({ fehler: 'Unbekannte Aktion.' }, { status: 400 });
  try {
    const r = await f(me, daten || {});
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const status = e.status || (e.message === 'nicht_gefunden' ? 404 : 500);
    if (status === 500) console.error(aktion, e);
    return NextResponse.json({ fehler: status === 500 ? 'Speichern hat nicht geklappt. Bitte versuch es noch einmal.' : e.message }, { status });
  }
}
