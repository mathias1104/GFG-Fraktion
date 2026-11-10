import { NextResponse } from 'next/server';
import { hole, setze, ergaenze, loesche, alle, setzeEintrag } from '@/lib/db';
import { importiereJotform } from '@/lib/jotform';
import { leseSitzung, hashPasswort } from '@/lib/auth';
import { fixiereTagesordnung, sendeEinladung, speichereProtokoll } from '@/lib/aktionen';
import { googleStatus, kalenderAbsagen } from '@/lib/google';
import {
  ARTEN, STATUS, ZIELE, DRINGLICHKEIT, ROLLEN, ERGEBNISSE, ORTSTEILE, fristVorbei, neueId,
  VIDEO_STATUS, TERMIN_ARTEN, LINIEN, GR_ERGEBNISSE,
} from '@/lib/domain';

async function googleBereit() {
  try { const g = await googleStatus(); return g.eingerichtet && g.verbunden; } catch { return false; }
}

/** Führt eine Google-Aktion aus, ohne dass ein Fehler das Speichern verhindert */
async function versucheGoogle(f) {
  if (!(await googleBereit())) return { google: 'aus' };
  try { const r = await f(); return { google: 'ok', ...r }; } catch (e) { return { google: 'fehler', googleFehler: e.message }; }
}

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
    if (!/^(antrag|thema|sitzung|video):[\w-]+$/.test(bezug)) throw new Fehler('Bezug ist ungültig.');
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
    if (p.id) {
      const alt = await muss('sitzungen', p.id);
      await ergaenze('sitzungen', p.id, { ...daten, geaendertAm: Date.now() });
      const zeitGeaendert = alt.datum !== daten.datum || alt.uhrzeit !== daten.uhrzeit || alt.ort !== daten.ort || Number(alt.dauerMin) !== daten.dauerMin;
      const g = alt.kalenderEventId && zeitGeaendert ? await versucheGoogle(() => sendeEinladung(p.id)) : {};
      return { id: p.id, ...g };
    }
    const id = neueId('s');
    await setze('sitzungen', id, { ...daten, status: 'geplant', erstelltAm: Date.now(), erstelltVon: me.name });
    const g = await versucheGoogle(() => sendeEinladung(id));
    return { id, ...g };
  },
  async 'sitzung.loeschen'(me, p) {
    nurGR(me);
    const id = txt(p.id, 40);
    const s = await hole('sitzungen', id);
    if (s?.kalenderEventId && (await googleBereit())) { try { await kalenderAbsagen(s.kalenderEventId); } catch { /* Termin bleibt dann bestehen */ } }
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
    const g = await versucheGoogle(() => speichereProtokoll(s.id));
    return g;
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

  // ---------- Videothemen ----------
  async 'video.speichern'(me, p) {
    const daten = {
      titel: pflicht(p.titel, 'Titel', 140),
      beschreibung: txt(p.beschreibung, 2000),
      ortsteil: auswahl(p.ortsteil, [...ORTSTEILE, 'alle Ortsteile'], ''),
      dringlichkeit: auswahl(p.dringlichkeit, DRINGLICHKEIT, 'mittel'),
      links: (Array.isArray(p.links) ? p.links : []).map((l) => url(l)).filter(Boolean).slice(0, 5),
    };
    let alt = null;
    if (p.id) {
      alt = await muss('videothemen', p.id);
      if (!me.gr && alt.autorId !== me.uid) throw new Fehler('Du kannst nur eigene Videothemen ändern.', 403);
    }
    // Fotos: bestehende IDs behalten, neue Bilder (data:-URLs) speichern
    const behalten = (Array.isArray(p.fotos) ? p.fotos : []).filter((f) => typeof f === 'string' && !f.startsWith('data:') && (alt?.fotos || []).includes(f));
    const neue = (Array.isArray(p.fotos) ? p.fotos : []).filter((f) => typeof f === 'string' && f.startsWith('data:'));
    if (behalten.length + neue.length > 3) throw new Fehler('Höchstens 3 Fotos pro Thema.');
    const fotos = [...behalten];
    for (const f of neue) {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(f) || f.length > 700000) throw new Fehler('Ein Foto ist zu groß oder kein Bild.');
      const fid = neueId('f');
      await setze('fotos', fid, { daten: f, am: Date.now() });
      fotos.push(fid);
    }
    for (const f of (alt?.fotos || [])) if (!fotos.includes(f)) await loesche('fotos', f);
    if (alt) { await ergaenze('videothemen', alt.id, { ...daten, fotos, geaendertAm: Date.now() }); return { id: alt.id }; }
    const id = neueId('v');
    await setze('videothemen', id, { ...daten, fotos, status: 'Idee', postLink: '', stimmen: {}, autorId: me.uid, autorName: me.name, erstelltAm: Date.now() });
    return { id };
  },
  async 'video.status'(me, p) {
    nurGR(me);
    const v = await muss('videothemen', p.id);
    await ergaenze('videothemen', v.id, { status: auswahl(p.status, VIDEO_STATUS, v.status), postLink: url(p.postLink), statusAm: Date.now(), statusVon: me.name });
    return {};
  },
  async 'video.stimme'(me, p) {
    await muss('videothemen', p.id);
    await setzeEintrag('videothemen', String(p.id), 'stimmen', me.uid, p.an ? Date.now() : null);
    return {};
  },
  async 'video.loeschen'(me, p) {
    const v = await muss('videothemen', p.id);
    if (!me.gr && v.autorId !== me.uid) throw new Fehler('Du kannst nur eigene Videothemen löschen.', 403);
    for (const f of v.fotos || []) await loesche('fotos', f);
    await loesche('videothemen', v.id);
    return {};
  },

  // ---------- Kalender-Termine ----------
  async 'termin.speichern'(me, p) {
    nurGR(me);
    const daten = {
      titel: pflicht(p.titel, 'Titel', 160), art: auswahl(p.art, TERMIN_ARTEN, 'Sonstiges'),
      datum: datum(p.datum), uhrzeit: txt(p.uhrzeit, 5), ort: txt(p.ort, 160), notiz: txt(p.notiz, 1000),
    };
    if (daten.datum.length !== 10) throw new Fehler('Bitte ein vollständiges Datum wählen.');
    if (p.id) { await ergaenze('termine', p.id, daten); return { id: p.id }; }
    const id = neueId('e');
    await setze('termine', id, { ...daten, erstelltAm: Date.now(), erstelltVon: me.name });
    return { id };
  },
  async 'termin.loeschen'(me, p) { nurGR(me); await loesche('termine', txt(p.id, 40)); return {}; },

  // ---------- Ausschüsse und Berichte ----------
  async 'ausschuss.speichern'(me, p) {
    nurGR(me);
    const daten = { name: pflicht(p.name, 'Name', 120), vorsitz: txt(p.vorsitz, 120), vertreter: txt(p.vertreter, 200), naechsteSitzung: datum(p.naechsteSitzung) };
    if (p.id) { await ergaenze('ausschuesse', p.id, daten); return { id: p.id }; }
    const id = neueId('x');
    await setze('ausschuesse', id, { ...daten, erstelltAm: Date.now() });
    return { id };
  },
  async 'ausschuss.loeschen'(me, p) { nurGR(me); await loesche('ausschuesse', txt(p.id, 40)); return {}; },
  async 'bericht.speichern'(me, p) {
    nurGR(me);
    await muss('ausschuesse', p.ausschussId);
    const daten = { ausschussId: txt(p.ausschussId, 40), datum: datum(p.datum), titel: txt(p.titel, 160), text: pflicht(p.text, 'Bericht', 5000) };
    if (p.id) { await ergaenze('berichte', p.id, { ...daten, geaendertAm: Date.now() }); return { id: p.id }; }
    const id = neueId('y');
    await setze('berichte', id, { ...daten, autorId: me.uid, autorName: me.name, erstelltAm: Date.now() });
    return { id };
  },
  async 'bericht.loeschen'(me, p) { nurGR(me); await loesche('berichte', txt(p.id, 40)); return {}; },

  // ---------- Wichtige Infos mit Lesebestätigung ----------
  async 'info.speichern'(me, p) {
    nurGR(me);
    const daten = { titel: pflicht(p.titel, 'Titel', 160), text: txt(p.text, 5000), wichtig: !!p.wichtig };
    if (p.id) { await ergaenze('infos', p.id, { ...daten, geaendertAm: Date.now() }); return { id: p.id }; }
    const id = neueId('i');
    await setze('infos', id, { ...daten, gelesen: { [me.uid]: { ts: Date.now(), name: me.name } }, autorId: me.uid, autorName: me.name, erstelltAm: Date.now() });
    return { id };
  },
  async 'info.gelesen'(me, p) {
    await muss('infos', p.id);
    await setzeEintrag('infos', String(p.id), 'gelesen', me.uid, { ts: Date.now(), name: me.name });
    return {};
  },
  async 'info.loeschen'(me, p) { nurGR(me); await loesche('infos', txt(p.id, 40)); return {}; },

  // ---------- Gemeinderatssitzungen (nur Gemeinderäte) ----------
  async 'grsitzung.speichern'(me, p) {
    nurGR(me);
    const daten = {
      titel: txt(p.titel, 160) || 'Gemeinderatssitzung', datum: datum(p.datum), uhrzeit: txt(p.uhrzeit, 5), ort: txt(p.ort, 160),
      notiz: txt(p.notiz, 4000),
      unterlagen: (Array.isArray(p.unterlagen) ? p.unterlagen : []).slice(0, 20)
        .map((d) => ({ titel: txt(d.titel, 120) || 'Unterlage', url: url(d.url) })).filter((d) => d.url),
    };
    if (daten.datum.length !== 10) throw new Fehler('Bitte ein vollständiges Datum wählen.');
    if (p.id) { await ergaenze('grsitzungen', p.id, { ...daten, geaendertAm: Date.now() }); return { id: p.id }; }
    const id = neueId('g');
    await setze('grsitzungen', id, { ...daten, tops: [], erstelltAm: Date.now(), erstelltVon: me.name });
    return { id };
  },
  async 'grsitzung.top'(me, p) {
    nurGR(me);
    const g = await muss('grsitzungen', p.id);
    const t = p.top || {};
    const top = {
      key: txt(t.key, 40) || neueId('top'), nr: txt(t.nr, 10), titel: pflicht(t.titel, 'Titel des TOP', 250),
      unterlage: url(t.unterlage), linie: auswahl(t.linie, LINIEN, 'offen'), begruendung: txt(t.begruendung, 3000),
      sprecher: txt(t.sprecher, 200), wortmeldung: txt(t.wortmeldung, 3000),
      ergebnis: auswahl(t.ergebnis, GR_ERGEBNISSE, ''), abgestimmt: auswahl(t.abgestimmt, ['', ...LINIEN.filter((l) => l !== 'offen'), 'uneinheitlich'], ''),
      geaendertVon: me.name, geaendertAm: Date.now(),
    };
    const tops = [...(g.tops || [])];
    const i = tops.findIndex((x) => x.key === top.key);
    if (p.loeschen) { if (i >= 0) tops.splice(i, 1); } else if (i >= 0) tops[i] = top; else tops.push(top);
    tops.sort((a, b) => (Number(a.nr) || 999) - (Number(b.nr) || 999));
    await ergaenze('grsitzungen', g.id, { tops, geaendertAm: Date.now() });
    return { key: top.key };
  },
  async 'grsitzung.loeschen'(me, p) { nurGR(me); await loesche('grsitzungen', txt(p.id, 40)); return {}; },

  // ---------- Jotform ----------
  async 'jotform.abrufen'(me) {
    nurGR(me);
    const r = await importiereJotform();
    if (!r.aktiv) throw new Fehler('Der Jotform-Abruf ist noch nicht eingerichtet (JOTFORM_API_KEY fehlt).');
    return r;
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
