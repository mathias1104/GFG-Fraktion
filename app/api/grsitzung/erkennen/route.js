import { NextResponse } from 'next/server';
import { leseSitzung } from '@/lib/auth';
import { textAusDatei } from '@/lib/dateien';
import { erkenneEinladung } from '@/lib/einladung';

export const maxDuration = 60;

/** Liest eine hochgeladene Einladung und schlägt Datum, Uhrzeit, Ort und TOPs vor */
export async function POST(req) {
  const me = await leseSitzung();
  if (!me?.gr) return NextResponse.json({ fehler: 'Das dürfen nur Gemeinderäte.' }, { status: 403 });
  const { pfad, text: ocrText } = await req.json().catch(() => ({}));
  // Text aus der Texterkennung im Browser (bei Scans) direkt auswerten
  if (typeof ocrText === 'string' && ocrText.trim()) {
    const r = erkenneEinladung(ocrText.slice(0, 60000));
    return NextResponse.json({ ok: true, ...r, zeichen: ocrText.length, scan: true });
  }
  if (!String(pfad || '').startsWith('gr/')) return NextResponse.json({ fehler: 'Ungültige Datei.' }, { status: 400 });
  try {
    const text = await textAusDatei(pfad).catch(() => '');
    if (text.replace(/\s/g, '').length < 150) return NextResponse.json({ ok: true, scan: true, zeichen: text.length, datum: '', uhrzeit: '', ort: '', tops: [] });
    const r = erkenneEinladung(text);
    return NextResponse.json({ ok: true, ...r, zeichen: text.length });
  } catch (e) {
    console.error('erkennen', e);
    return NextResponse.json({ fehler: e.message || 'Die Datei konnte nicht gelesen werden.' }, { status: 422 });
  }
}
