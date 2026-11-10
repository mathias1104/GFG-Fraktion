import { NextResponse } from 'next/server';
import { alle, hole, datenbankVorhanden } from '@/lib/db';
import { leseSitzung } from '@/lib/auth';
import { googleStatus } from '@/lib/google';
import { vapidPublic } from '@/lib/benachrichtigung';
import { blobAktiv } from '@/lib/dateien';

export const dynamic = 'force-dynamic';

const ALLGEMEIN = ['sitzungen', 'themen', 'antraege', 'aufgaben', 'beschluesse', 'kommentare', 'mitglieder',
  'videothemen', 'termine', 'ausschuesse', 'berichte', 'infos'];

export async function GET() {
  if (!datenbankVorhanden()) return NextResponse.json({ fehler: 'keine_datenbank' }, { status: 503 });
  const me = await leseSitzung();
  if (!me) return NextResponse.json({ fehler: 'nicht_angemeldet' }, { status: 401 });
  const d = await alle([...ALLGEMEIN, 'grsitzungen']);
  // Vereinsmitglieder sehen nur Termin und Ort der Gemeinderatssitzungen, keine Vorbereitung
  if (!me.gr) d.grsitzungen = d.grsitzungen.map(({ id, titel, datum, uhrzeit, ort }) => ({ id, titel, datum, uhrzeit, ort, nurTermin: true }));
  // Marketing nur mit eigener Freischaltung über das Marketing-Passwort
  if (me.mk) {
    Object.assign(d, await alle(['beitraege', 'kennzahlen']));
    d.marke = (await hole('config', 'marketing')) || {};
  }
  const cfg = (await hole('config', 'app')) || {};
  const besuch = await hole('besuche', me.uid);
  const prefs = (await hole('prefs', me.uid)) || {};
  const { pushabos } = await alle(['pushabos']);
  const meineGeraete = pushabos.filter((a) => a.uid === me.uid).map((a) => ({ endpoint: a.abo?.endpoint, geraet: a.geraet, am: a.am }));
  const { mitgliederPasswort, jotformIgnoriert, ...config } = cfg;
  config.jotformAktiv = !!process.env.JOTFORM_API_KEY;
  config.vapidPublic = vapidPublic();
  config.dateiModus = blobAktiv() ? 'blob' : 'lokal';
  // Passwörter nie ausliefern; E-Mails nur für Gemeinderäte und Admins
  d.mitglieder = d.mitglieder.map(({ passwortHash, pwStand, ...m }) => ({ ...m, eigenesPasswort: !!passwortHash }));
  if (!me.gr && !me.admin) d.mitglieder = d.mitglieder.map(({ email, eigenesPasswort, ...m }) => m);
  const google = me.gr ? await googleStatus() : null;
  const ich = d.mitglieder.find((m) => m.id === me.uid);
  const meinePrefs = { eigenesPasswort: !!ich?.eigenesPasswort, typen: prefs.typen || {}, email: prefs.email || '', gelesenBis: prefs.gelesenBis || null, mitgliedEmail: me.gr ? ich?.email || '' : (ich ? (await hole('mitglieder', me.uid))?.email || '' : '') };
  return NextResponse.json({ me, daten: d, config, google, prefs: meinePrefs, geraete: meineGeraete, letzterBesuch: besuch?.ts || null, jetzt: Date.now() });
}
