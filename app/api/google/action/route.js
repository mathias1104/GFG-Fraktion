import { NextResponse } from 'next/server';
import { leseSitzung } from '@/lib/auth';
import { sendeEinladung, versendeTagesordnung, speichereProtokoll } from '@/lib/aktionen';

export const maxDuration = 60;

export async function POST(req) {
  const me = await leseSitzung();
  if (!me?.gr) return NextResponse.json({ fehler: 'Das dürfen nur Gemeinderäte.' }, { status: 403 });
  const { aktion, sitzungId } = await req.json().catch(() => ({}));
  const origin = new URL(req.url).origin;
  try {
    let r;
    if (aktion === 'einladung') r = await sendeEinladung(sitzungId, origin);
    else if (aktion === 'tagesordnung') r = await versendeTagesordnung(sitzungId, origin);
    else if (aktion === 'protokoll') r = await speichereProtokoll(sitzungId);
    else return NextResponse.json({ fehler: 'Unbekannte Aktion.' }, { status: 400 });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('google action', aktion, e);
    return NextResponse.json({ fehler: e.message || 'Google-Aktion fehlgeschlagen.', code: e.code || '' }, { status: 502 });
  }
}
