import { NextResponse, after } from 'next/server';
import crypto from 'node:crypto';
import { benachrichtige, sendePush, pushEingerichtet } from '@/lib/benachrichtigung';
import { hole, setze, ergaenze, loesche, alle, setzeEintrag } from '@/lib/db';
import { importiereJotform } from '@/lib/jotform';
import { leseSitzung, hashPasswort, passwortPasst, setzeSitzung, nameSchluessel, startPasswort } from '@/lib/auth';
import { fixiereTagesordnung, sendeEinladung, speichereProtokoll } from '@/lib/aktionen';
import { googleStatus, kalenderAbsagen } from '@/lib/google';
import { loescheDatei } from '@/lib/dateien';
import {
  ARTEN, STATUS, ZIELE, DRINGLICHKEIT, ROLLEN, ERGEBNISSE, ORTSTEILE, fristVorbei, neueId,
  VIDEO_STATUS, TERMIN_ARTEN, LINIEN, GR_ERGEBNISSE, BENACHRICHTIGUNG_TYP, datumKurz, SITZUNGSARTEN, sitzungName,
  KANAELE, BEITRAG_STATUS, BEITRAG_FORMATE,
} from '@/lib/domain';

async function googleBereit() {
  try { const g = await googleStatus(); return g.eingerichtet && g.verbunden; } catch { return false; }
}

/** Führt eine Google-Aktion aus, ohne dass ein Fehler das Speichern verhindert */
async function versucheGoogle(f) {
  if (!(await googleBereit())) return { google: 'aus' };
  try { const r = await f(); return { google: 'ok', ...r }; } catch (e) { return { google: 'fehler', googleFehler: e.message }; }
}

/** Benachrichtigung nach der Antwort verschicken, damit Speichern schnell bleibt */
function melde(typ, opt) { after(() => benachrichtige(typ, opt)); }

class Fehler extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const txt = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const pflicht = (v, feld, max = 300) => { const t = txt(v, max); if (!t) throw new Fehler(`${feld} fehlt.`); return t; };
const auswahl = (v, liste, std) => (liste.includes(v) ? v : std);
const datum = (v) => { const t = txt(v, 10); if (t && !/^\d{4}-\d{2}(-\d{2})?$/.test(t)) throw new Fehler('Datum ist ungültig.'); return t; };
const uhrzeit = (v) => { const t = txt(v, 5) || '19:00'; if (!/^\d{2}:\d{2}$/.test(t)) throw new Fehler('Uhrzeit ist ungültig.'); return t; };
const zahl = (v, min, max, std) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : std; };
/** Metadaten einer hochgeladenen Datei prüfen */
const dateiInfo = (d, bereich, me) => {
  const pfad = txt(d?.pfad, 300);
  if (!pfad.startsWith(`${bereich}/`) || pfad.includes('..')) throw new Fehler('Ungültige Datei.');
  return { pfad, name: txt(d.name, 160) || pfad.split('/').pop(), groesse: zahl(d.groesse, 0, 2e9, 0), typ: txt(d.typ, 120), am: Date.now(), von: me.name };
};
const topListe = (liste) => (Array.isArray(liste) ? liste : []).slice(0, 80)
  .map((t, i) => ({ nr: txt(t.nr, 10) || String(i + 1), titel: txt(t.titel, 250), nichtOeffentlich: !!t.nichtOeffentlich }))
  .filter((t) => t.titel);
const neuerTop = (t, me) => ({
  key: neueId('top'), nr: t.nr, titel: t.titel, nichtOeffentlich: t.nichtOeffentlich, unterlage: '', linie: 'offen', begruendung: '',
  sprecher: '', wortmeldung: '', ergebnis: '', abgestimmt: '', geaendertVon: me.name, geaendertAm: Date.now(),
});
const url = (v) => { const t = txt(v, 500); if (t && !/^https?:\/\//i.test(t)) throw new Fehler('Links müssen mit http:// oder https:// beginnen.'); return t; };

function nurMK(me) { if (!me.mk) throw new Fehler('Das geht nur im freigeschalteten Marketing-Bereich.', 403); }
function nurAdmin(me) { if (!me.admin) throw new Fehler('Das darf nur ein Admin.', 403); }
function nurGR(me) { if (!me.gr) throw new Fehler('Das dürfen nur Gemeinderäte.', 403); }

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
    melde('thema_neu', { titel: `Neues Thema: ${daten.titel}`, text: `Von ${me.name} für ${sitzungName(s)} am ${datumKurz(s.datum)}`, url: `#sitzung-${s.id}`, ausser: me.uid });
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
    const text = pflicht(p.text, 'Kommentar', 2000);
    await setze('kommentare', id, { bezug, text, autorId: me.uid, autorName: me.name, am: Date.now() });
    const [art, bid] = bezug.split(':');
    const url = art === 'antrag' ? `#antrag-${bid}` : art === 'sitzung' ? `#sitzung-${bid}` : '#videothemen';
    melde('kommentar', { titel: `${me.name} hat kommentiert`, text: text.slice(0, 200), url, ausser: me.uid });
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
    const meldeZuteilung = () => daten.zustaendigId && melde('aufgabe_mir', {
      titel: `Neue Aufgabe für dich: ${daten.titel}`, text: daten.frist ? `Bis ${datumKurz(daten.frist)}` : '', url: '#aufgaben', nur: [daten.zustaendigId], ausser: me.uid,
    });
    if (p.id) {
      const alt = await muss('aufgaben', p.id);
      await ergaenze('aufgaben', p.id, { ...daten, geaendertAm: Date.now(), ...(alt.frist !== daten.frist ? { ueberfaelligGemeldet: null } : {}) });
      if (alt.zustaendigId !== daten.zustaendigId) meldeZuteilung();
      return { id: p.id };
    }
    const id = neueId('a');
    await setze('aufgaben', id, { ...daten, status: 'offen', erstelltAm: Date.now(), erstelltVon: me.name });
    meldeZuteilung();
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
      art: auswahl(p.art, SITZUNGSARTEN, 'Fraktionssitzung'),
      titel: txt(p.titel, 120),
    };
    if (daten.datum.length !== 10) throw new Fehler('Bitte ein vollständiges Datum wählen.');
    if (p.id) {
      const alt = await muss('sitzungen', p.id);
      await ergaenze('sitzungen', p.id, { ...daten, geaendertAm: Date.now() });
      const zeitGeaendert = alt.datum !== daten.datum || alt.uhrzeit !== daten.uhrzeit || alt.ort !== daten.ort || Number(alt.dauerMin) !== daten.dauerMin;
      const g = alt.kalenderEventId && zeitGeaendert ? await versucheGoogle(() => sendeEinladung(p.id)) : {};
      if (zeitGeaendert) melde('sitzung_neu', { titel: `${sitzungName(daten)} geändert: ${datumKurz(daten.datum)}`, text: `${daten.uhrzeit} Uhr${daten.ort ? `, ${daten.ort}` : ''}`, url: `#sitzung-${p.id}`, ausser: me.uid });
      return { id: p.id, ...g };
    }
    const id = neueId('s');
    await setze('sitzungen', id, { ...daten, status: 'geplant', erstelltAm: Date.now(), erstelltVon: me.name });
    const g = await versucheGoogle(() => sendeEinladung(id));
    melde('sitzung_neu', { titel: `Neu: ${sitzungName(daten)} am ${datumKurz(daten.datum)}`, text: `${daten.uhrzeit} Uhr${daten.ort ? `, ${daten.ort}` : ''}. Themen bis ${daten.fristTage} Tage vorher einreichen.`, url: `#sitzung-${id}`, ausser: me.uid });
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
    if (!s.agendaAm && Array.isArray(p.agenda)) { teil.agenda = p.agenda.slice(0, 100); teil.agendaAm = Date.now(); }
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
    melde('protokoll', { titel: `Protokoll: ${sitzungName(s)} vom ${datumKurz(s.datum)}`, text: 'Beschlüsse und Aufgaben stehen in der App.', url: `#protokoll-${s.id}`, ausser: me.uid });
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
    melde('antrag_status', { titel: `${a.titel}: ${status}`, text: txt(p.notiz, 300), url: `#antrag-${a.id}`, ausser: me.uid });
    return {};
  },
  async 'antrag.loeschen'(me, p) { nurGR(me); await loesche('antraege', txt(p.id, 40)); return {}; },

  // ---------- Mitglieder ----------
  // ---------- Mitglieder und Rollen (nur Admin) ----------
  async 'mitglied.speichern'(me, p) {
    nurAdmin(me);
    const email = txt(p.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fehler('Die E-Mail-Adresse sieht ungültig aus.');
    const name = pflicht(p.name, 'Name', 80);
    if (name.trim().split(/\s+/).length < 2) throw new Fehler('Bitte Vor- und Nachname eingeben, daraus entsteht das Passwort.');
    const daten = {
      name, email, rolle: auswahl(p.rolle, ROLLEN, 'Vereinsmitglied'),
      funktion: txt(p.funktion, 80), ortsteil: auswahl(p.ortsteil, ORTSTEILE, ''),
      marketing: !!p.marketing, admin: !!p.admin,
      auch: (Array.isArray(p.auch) ? p.auch : String(p.auch || '').split(',')).map((x) => txt(x, 80)).filter(Boolean).slice(0, 5),
    };
    const { mitglieder } = await alle(['mitglieder']);
    const schluessel = [daten.name, ...daten.auch].map(nameSchluessel);
    if (mitglieder.some((m) => m.id !== p.id && [m.name, ...(m.auch || [])].some((n) => schluessel.includes(nameSchluessel(n))))) {
      throw new Fehler('Diesen Namen gibt es schon. Zum Anmelden muss jeder Name eindeutig sein.');
    }
    if (p.id === me.uid && !daten.admin && !mitglieder.some((m) => m.id !== me.uid && m.admin)) {
      throw new Fehler('Du bist der einzige Admin. Mach zuerst jemand anderen zum Admin.');
    }
    if (p.id) { await muss('mitglieder', p.id); await ergaenze('mitglieder', p.id, daten); return { id: p.id }; }
    const id = neueId('m');
    await setze('mitglieder', id, { ...daten, erstelltAm: Date.now() });
    return { id, passwort: startPasswort(daten.name) };
  },
  async 'mitglied.loeschen'(me, p) {
    nurAdmin(me);
    if (p.id === me.uid) throw new Fehler('Du kannst dich nicht selbst entfernen.');
    await loesche('mitglieder', txt(p.id, 40));
    return {};
  },
  async 'mitglied.passwortZuruecksetzen'(me, p) {
    nurAdmin(me);
    const m = await muss('mitglieder', p.id);
    await setze('mitglieder', m.id, { ...Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'id' && k !== 'passwortHash')), pwStand: (m.pwStand || 0) + 1 });
    return { passwort: startPasswort(m.name) };
  },
  async 'passwort.aendern'(me, p) {
    const m = await muss('mitglieder', me.uid);
    if (!passwortPasst(m, String(p.alt || ''))) throw new Fehler('Das bisherige Passwort stimmt nicht.', 403);
    const neu = String(p.neu || '');
    if (neu.length < 8) throw new Fehler('Das neue Passwort braucht mindestens 8 Zeichen.');
    const pwStand = (m.pwStand || 0) + 1;
    await ergaenze('mitglieder', m.id, { passwortHash: hashPasswort(neu), pwStand });
    await setzeSitzung({ uid: m.id, pv: pwStand });
    return {};
  },

  // ---------- Einstellungen ----------
  async 'config.speichern'(me, p) {
    nurGR(me);
    const teil = {};
    if ('fristTage' in p) teil.fristTage = zahl(p.fristTage, 0, 14, 3);
    if ('driveFolderId' in p) teil.driveFolderId = txt(p.driveFolderId, 100);
    if ('appUrl' in p) teil.appUrl = url(p.appUrl);
    if ('ausschuesse' in p) teil.ausschuesse = (Array.isArray(p.ausschuesse) ? p.ausschuesse : []).map((x) => txt(x, 100)).filter(Boolean).slice(0, 30);
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
    melde('video', { titel: `Neues Videothema: ${daten.titel}`, text: `Vorgeschlagen von ${me.name}`, url: '#videothemen', ausser: me.uid });
    return { id };
  },
  async 'video.status'(me, p) {
    nurGR(me);
    const v = await muss('videothemen', p.id);
    const status = auswahl(p.status, VIDEO_STATUS, v.status);
    await ergaenze('videothemen', v.id, { status, postLink: url(p.postLink), statusAm: Date.now(), statusVon: me.name });
    if (status !== v.status) melde('video', { titel: `Videothema ${status}: ${v.titel}`, url: '#videothemen', ausser: me.uid });
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
    melde('termin', { titel: `Neuer Termin: ${daten.titel}`, text: `${datumKurz(daten.datum)}${daten.uhrzeit ? `, ${daten.uhrzeit} Uhr` : ''}${daten.ort ? `, ${daten.ort}` : ''}`, url: '#kalender', ausser: me.uid });
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
    const aus = await hole('ausschuesse', daten.ausschussId);
    melde('bericht', { titel: `Bericht aus dem Ausschuss ${aus?.name || ''}`, text: daten.text.slice(0, 200), url: '#ausschuesse', ausser: me.uid });
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
    melde('info', { titel: daten.wichtig ? `Wichtig: ${daten.titel}` : daten.titel, text: daten.text.slice(0, 300), url: '#start', ausser: me.uid });
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
    const dateien = (Array.isArray(p.dateien) ? p.dateien : []).slice(0, 40).map((d) => dateiInfo(d, 'gr', me));
    const tops = topListe(p.tops).map((t) => neuerTop(t, me));
    await setze('grsitzungen', id, { ...daten, tops, dateien, erstelltAm: Date.now(), erstelltVon: me.name });
    melde('gr_sitzung', { titel: `Gemeinderatssitzung am ${datumKurz(daten.datum)} vorbereiten`, text: 'TOPs und Abstimmungslinie eintragen', url: `#grsitzung-${id}`, ausser: me.uid });
    return { id };
  },
  async 'grsitzung.top'(me, p) {
    nurGR(me);
    const g = await muss('grsitzungen', p.id);
    const t = p.top || {};
    const top = {
      key: txt(t.key, 40) || neueId('top'), nr: txt(t.nr, 10), titel: pflicht(t.titel, 'Titel des TOP', 250),
      unterlage: url(t.unterlage), nichtOeffentlich: !!t.nichtOeffentlich,
      datei: String(t.datei || '').startsWith('gr/') ? txt(t.datei, 300) : '', linie: auswahl(t.linie, LINIEN, 'offen'), begruendung: txt(t.begruendung, 3000),
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
  async 'grsitzung.loeschen'(me, p) {
    nurGR(me);
    const g = await hole('grsitzungen', txt(p.id, 40));
    for (const d of g?.dateien || []) await loescheDatei(d.pfad).catch(() => {});
    await loesche('grsitzungen', txt(p.id, 40));
    return {};
  },
  async 'grsitzung.datei'(me, p) {
    nurGR(me);
    const g = await muss('grsitzungen', p.id);
    let dateien = [...(g.dateien || [])];
    if (p.entfernen) {
      const pfad = txt(p.entfernen, 300);
      if (dateien.some((d) => d.pfad === pfad)) await loescheDatei(pfad).catch(() => {});
      dateien = dateien.filter((d) => d.pfad !== pfad);
    } else {
      const neu = (Array.isArray(p.dateien) ? p.dateien : [p.datei]).filter(Boolean).map((d) => dateiInfo(d, 'gr', me));
      dateien = [...dateien, ...neu].slice(0, 60);
    }
    await ergaenze('grsitzungen', g.id, { dateien, geaendertAm: Date.now() });
    return {};
  },
  async 'grsitzung.topsUebernehmen'(me, p) {
    nurGR(me);
    const g = await muss('grsitzungen', p.id);
    const neu = topListe(p.tops);
    if (!neu.length) throw new Fehler('Keine TOPs ausgewählt.');
    const alt = p.ersetzen ? (g.tops || []).filter((t) => t.linie !== 'offen' || t.begruendung || t.wortmeldung) : (g.tops || []);
    // Bestehende TOPs mit gleicher Nummer und Vorbereitung behalten, Titel aktualisieren
    const tops = [...alt];
    for (const t of neu) {
      const i = tops.findIndex((x) => x.nr === t.nr);
      if (i >= 0) tops[i] = { ...tops[i], titel: t.titel, nichtOeffentlich: t.nichtOeffentlich };
      else tops.push(neuerTop(t, me));
    }
    tops.sort((a, b) => (Number(a.nr) || 999) - (Number(b.nr) || 999));
    const kopf = {};
    if (p.datum && /^\d{4}-\d{2}-\d{2}$/.test(p.datum)) kopf.datum = p.datum;
    if (p.uhrzeit && /^\d{2}:\d{2}$/.test(p.uhrzeit)) kopf.uhrzeit = p.uhrzeit;
    if (p.ort) kopf.ort = txt(p.ort, 160);
    await ergaenze('grsitzungen', g.id, { ...kopf, tops, geaendertAm: Date.now() });
    return { anzahl: neu.length };
  },


  // ---------- Marketing (Freischaltung Marketing oder Gemeinderat) ----------
  async 'beitrag.speichern'(me, p) {
    nurMK(me);
    const alt = p.id ? await muss('beitraege', p.id) : null;
    const kanaele = (Array.isArray(p.kanaele) ? p.kanaele : []).filter((k) => KANAELE.some((x) => x.key === k));
    const daten = {
      titel: pflicht(p.titel, 'Arbeitstitel', 140),
      text: txt(p.text, 8000),
      kanaele,
      format: auswahl(p.format, BEITRAG_FORMATE, 'Foto'),
      datum: datum(p.datum), uhrzeit: p.uhrzeit ? uhrzeit(p.uhrzeit) : '',
      absender: auswahl(p.absender, ['wir', 'ich'], 'wir'),
      absenderName: txt(p.absenderName, 80),
      zustaendigId: txt(p.zustaendigId, 40), zustaendigName: txt(p.zustaendigName, 80),
      link: url(p.link),
      notiz: txt(p.notiz, 2000),
      medien: (Array.isArray(p.medien) ? p.medien : []).slice(0, 20).map((d) => dateiInfo(d, 'marketing', me)).map((d, i) => ({ ...d, am: p.medien[i]?.am || d.am, von: p.medien[i]?.von || d.von })),
      videoId: txt(p.videoId, 40),
    };
    let status = auswahl(p.status, BEITRAG_STATUS, alt?.status || 'Idee');
    const extra = {};
    // Vier-Augen-Prinzip: Freigeben nur durch jemand anderen als den Autor
    if (alt && status !== alt.status) {
      if (['Freigegeben', 'Veröffentlicht'].includes(status) && !alt.freigabe && alt.autorId === me.uid) throw new Fehler('Freigeben muss jemand anderer. Stell den Beitrag auf Zur Freigabe.', 403);
      if (status === 'Zur Freigabe') Object.assign(extra, { freigabeAngefragtAm: Date.now(), freigabeAngefragtVon: me.name, freigabe: null });
      if (status === 'Freigegeben' && !alt.freigabe) extra.freigabe = { von: me.name, vonId: me.uid, am: Date.now() };
      if (status === 'Veröffentlicht') extra.veroeffentlichtAm = Date.now();
      if (['Idee', 'In Arbeit'].includes(status)) extra.freigabe = null;
    }
    // Inhalt nach der Freigabe geändert: neue Freigabe nötig
    if (alt?.freigabe && status === 'Freigegeben' && alt.text !== daten.text && alt.freigabe.vonId !== me.uid) {
      status = 'Zur Freigabe';
      Object.assign(extra, { freigabe: null, freigabeAngefragtAm: Date.now(), freigabeAngefragtVon: me.name });
    }
    if (!alt && status === 'Freigegeben') status = 'Zur Freigabe';
    if (!alt && status === 'Zur Freigabe') Object.assign(extra, { freigabeAngefragtAm: Date.now(), freigabeAngefragtVon: me.name });
    if (alt) {
      // Entfernte Medien auch aus dem Speicher löschen
      for (const d of alt.medien || []) if (!daten.medien.some((x) => x.pfad === d.pfad)) await loescheDatei(d.pfad).catch(() => {});
      await ergaenze('beitraege', alt.id, { ...daten, ...extra, status, geaendertAm: Date.now(), geaendertVon: me.name });
    }
    const id = alt?.id || neueId('b');
    if (!alt) await setze('beitraege', id, { ...daten, ...extra, status, autorId: me.uid, autorName: me.name, erstelltAm: Date.now() });
    if (extra.freigabeAngefragtAm) melde('beitrag_freigabe', { titel: `Freigabe gebraucht: ${daten.titel}`, text: `${me.name} bittet um ein zweites Augenpaar`, url: `#beitrag-${id}`, ausser: me.uid });
    if (extra.freigabe?.am && alt?.autorId && alt.autorId !== me.uid) melde('beitrag_mir', { titel: `Freigegeben: ${daten.titel}`, text: `${me.name} hat deinen Beitrag freigegeben`, url: `#beitrag-${id}`, nur: [alt.autorId] });
    return { id, status };
  },
  async 'beitrag.status'(me, p) {
    nurMK(me);
    const b = await muss('beitraege', p.id);
    return AKTIONEN['beitrag.speichern'](me, { ...b, status: p.status, id: b.id });
  },
  async 'beitrag.notiz'(me, p) {
    nurMK(me);
    const b = await muss('beitraege', p.id);
    const text = pflicht(p.text, 'Anmerkung', 1000);
    const notizen = [...(b.notizen || []), { text, von: me.name, vonId: me.uid, am: Date.now(), zurueck: !!p.zurueck }].slice(-50);
    const extra = p.zurueck && b.status === 'Zur Freigabe' ? { status: 'In Arbeit', freigabe: null } : {};
    await ergaenze('beitraege', b.id, { notizen, ...extra });
    const an = [...new Set([b.autorId, b.zustaendigId].filter((x) => x && x !== me.uid))];
    if (an.length) melde('beitrag_mir', { titel: p.zurueck ? `Zurück zur Überarbeitung: ${b.titel}` : `Anmerkung zu ${b.titel}`, text: `${me.name}: ${text.slice(0, 160)}`, url: `#beitrag-${b.id}`, nur: an });
    return {};
  },
  async 'beitrag.loeschen'(me, p) {
    nurMK(me);
    const b = await muss('beitraege', p.id);
    for (const d of b.medien || []) await loescheDatei(d.pfad).catch(() => {});
    await loesche('beitraege', b.id);
    return {};
  },
  async 'kennzahl.speichern'(me, p) {
    nurMK(me);
    const monat = txt(p.monat, 7);
    if (!/^\d{4}-\d{2}$/.test(monat)) throw new Fehler('Bitte einen Monat wählen.');
    const werte = {};
    for (const k of KANAELE.filter((x) => x.kennzahl)) {
      const v = p.werte?.[k.key];
      if (v !== '' && v != null && Number.isFinite(Number(v))) werte[k.key] = Math.max(0, Math.round(Number(v)));
    }
    if (p.loeschen) { await loesche('kennzahlen', monat); return {}; }
    await setze('kennzahlen', monat, { monat, werte, von: me.name, am: Date.now() });
    return {};
  },
  async 'marke.speichern'(me, p) {
    nurMK(me);
    const daten = {};
    if (Array.isArray(p.hashtags)) daten.hashtags = p.hashtags.slice(0, 20).map((h) => ({ name: txt(h.name, 40), tags: txt(h.tags, 600) })).filter((h) => h.name && h.tags);
    if (Array.isArray(p.bausteine)) daten.bausteine = p.bausteine.slice(0, 40).map((h) => ({ titel: txt(h.titel, 80), text: txt(h.text, 1500) })).filter((h) => h.titel && h.text);
    if (p.kanaele && typeof p.kanaele === 'object') daten.kanaele = Object.fromEntries(KANAELE.map((k) => [k.key, url(p.kanaele[k.key])]).filter(([, v]) => v));
    if ('regeln' in p) daten.regeln = txt(p.regeln, 2000);
    const alt = (await hole('config', 'marketing')) || {};
    await setze('config', 'marketing', { ...alt, ...daten, geaendertVon: me.name, geaendertAm: Date.now() });
    return {};
  },

  // ---------- Jotform ----------
  async 'jotform.abrufen'(me) {
    nurGR(me);
    const r = await importiereJotform();
    if (!r.aktiv) throw new Fehler('Der Jotform-Abruf ist noch nicht eingerichtet (JOTFORM_API_KEY fehlt).');
    return r;
  },

  // ---------- Benachrichtigungen ----------
  async 'prefs.speichern'(me, p) {
    const alt = (await hole('prefs', me.uid)) || {};
    const typen = { ...(alt.typen || {}) };
    for (const [k, v] of Object.entries(p.typen || {})) {
      if (!BENACHRICHTIGUNG_TYP[k] || typeof v !== 'object') continue;
      typen[k] = {};
      for (const w of ['app', 'push', 'mail']) if (typeof v[w] === 'boolean') typen[k][w] = v[w];
    }
    const neu = { ...alt, typen, name: me.name, gr: !!me.gr || !!alt.gr, geaendertAm: Date.now() };
    if ('email' in p) {
      const email = txt(p.email, 120);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fehler('Die E-Mail-Adresse sieht ungültig aus.');
      neu.email = email;
    }
    await setze('prefs', me.uid, neu);
    return {};
  },
  async 'glocke.gelesen'(me) {
    const alt = (await hole('prefs', me.uid)) || {};
    await setze('prefs', me.uid, { ...alt, name: me.name, gelesenBis: Date.now() });
    return {};
  },
  async 'push.abo'(me, p) {
    if (!pushEingerichtet()) throw new Fehler('Push-Mitteilungen sind auf dem Server noch nicht eingerichtet.');
    const abo = p.abo || {};
    if (!/^https:\/\//.test(abo.endpoint || '') || !abo.keys?.p256dh || !abo.keys?.auth) throw new Fehler('Das Gerät hat keine gültige Anmeldung für Mitteilungen geliefert.');
    const id = crypto.createHash('sha256').update(abo.endpoint).digest('hex').slice(0, 40);
    await setze('pushabos', id, {
      uid: me.uid, name: me.name, am: Date.now(), geraet: txt(p.geraet, 120),
      abo: { endpoint: txt(abo.endpoint, 1000), keys: { p256dh: txt(abo.keys.p256dh, 200), auth: txt(abo.keys.auth, 100) } },
    });
    return { id };
  },
  async 'push.abmelden'(me, p) {
    const id = crypto.createHash('sha256').update(String(p.endpoint || '')).digest('hex').slice(0, 40);
    const a = await hole('pushabos', id);
    if (a && (a.uid === me.uid || me.gr)) await loesche('pushabos', id);
    return {};
  },
  async 'push.test'(me) {
    const n = await sendePush([me.uid], { titel: 'Test von der GFG-Fraktions-App', text: 'So sehen Mitteilungen aus. Alles funktioniert.', url: '#benachrichtigungen' });
    if (!n) throw new Fehler('Auf keinem deiner Geräte sind Mitteilungen aktiv.');
    return { anzahl: n };
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
