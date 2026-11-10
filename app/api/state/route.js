import { NextResponse } from 'next/server';
import { alle, hole, datenbankVorhanden } from '@/lib/db';
import { leseSitzung } from '@/lib/auth';
import { googleStatus } from '@/lib/google';

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
  const cfg = (await hole('config', 'app')) || {};
  const besuch = await hole('besuche', me.uid);
  const { mitgliederPasswort, jotformIgnoriert, ...config } = cfg;
  config.mitgliederPasswortGesetzt = !!mitgliederPasswort;
  config.jotformAktiv = !!process.env.JOTFORM_API_KEY;
  if (!me.gr) d.mitglieder = d.mitglieder.map(({ email, ...m }) => m);
  const google = me.gr ? await googleStatus() : null;
  return NextResponse.json({ me, daten: d, config, google, letzterBesuch: besuch?.ts || null, jetzt: Date.now() });
}
