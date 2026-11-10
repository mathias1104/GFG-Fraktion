import { NextResponse } from 'next/server';
import { leseSitzung } from '@/lib/auth';
import { darf, leseDatei, speichereDatei, sichererName, typVonName, ERLAUBTE_TYPEN, blobAktiv } from '@/lib/dateien';

export const maxDuration = 60;

/** Datei ansehen oder herunterladen: /api/datei?p=gr/... */
export async function GET(req) {
  const me = await leseSitzung();
  const u = new URL(req.url);
  const pfad = String(u.searchParams.get('p') || '');
  if (!darf(me, pfad) || pfad.includes('..')) return new Response('Kein Zugriff', { status: 403 });
  const d = await leseDatei(pfad);
  if (!d) return new Response('Nicht gefunden', { status: 404 });
  const name = u.searchParams.get('n') || pfad.split('/').pop();
  return new Response(d.buffer, {
    headers: {
      'Content-Type': d.contentType,
      'Content-Disposition': `${u.searchParams.get('dl') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

/** Hochladen über den Server (lokal, oder kleine Dateien ohne Blob-Client) */
export async function POST(req) {
  const me = await leseSitzung();
  const form = await req.formData().catch(() => null);
  const datei = form?.get('datei');
  const bereich = String(form?.get('bereich') || '');
  if (!datei || typeof datei === 'string') return NextResponse.json({ fehler: 'Keine Datei erhalten.' }, { status: 400 });
  if (!['gr', 'marketing'].includes(bereich) || !darf(me, `${bereich}/`)) return NextResponse.json({ fehler: 'Kein Zugriff auf diesen Bereich.' }, { status: 403 });
  if (blobAktiv() && datei.size > 4 * 1024 * 1024) return NextResponse.json({ fehler: 'Datei zu groß für diesen Weg.' }, { status: 413 });
  if (datei.size > 50 * 1024 * 1024) return NextResponse.json({ fehler: 'Die Datei ist größer als 50 MB.' }, { status: 413 });
  const typ = datei.type || typVonName(datei.name);
  if (!ERLAUBTE_TYPEN.includes(typ)) return NextResponse.json({ fehler: 'Dieser Dateityp ist nicht erlaubt.' }, { status: 415 });
  const pfad = await speichereDatei(`${bereich}/${Date.now()}-${sichererName(datei.name)}`, Buffer.from(await datei.arrayBuffer()), typ);
  return NextResponse.json({ ok: true, pfad, name: datei.name, groesse: datei.size, typ });
}
