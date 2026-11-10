import { NextResponse } from 'next/server';
import { leseSitzung } from '@/lib/auth';
import { textAusDatei } from '@/lib/dateien';
import { erkenneEinladung } from '@/lib/einladung';

export const maxDuration = 60;

/** Liest eine hochgeladene Einladung und schlägt Datum, Uhrzeit, Ort und TOPs vor */
export async function POST(req) {
  const me = await leseSitzung();
  if (!me?.gr) return NextResponse.json({ fehler: 'Das dürfen nur Gemeinderäte.' }, { status: 403 });
  const { pfad } = await req.json().catch(() => ({}));
  if (!String(pfad || '').startsWith('gr/')) return NextResponse.json({ fehler: 'Ungültige Datei.' }, { status: 400 });
  try {
    const text = await textAusDatei(pfad);
    const r = erkenneEinladung(text);
    return NextResponse.json({ ok: true, ...r, zeichen: text.length });
  } catch (e) {
    console.error('erkennen', e);
    return NextResponse.json({ fehler: e.message || 'Die Datei konnte nicht gelesen werden.' }, { status: 422 });
  }
}
