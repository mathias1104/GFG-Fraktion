import { NextResponse } from 'next/server';
import { leseSitzung, setzeSitzung, vergleiche, GR_BENUTZER, GR_PASSWORT, warte } from '@/lib/auth';

export async function POST(req) {
  const me = await leseSitzung();
  if (!me) return NextResponse.json({ fehler: 'Bitte zuerst anmelden.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.sperren) {
    await setzeSitzung({ uid: me.uid, name: me.name, gr: false });
    return NextResponse.json({ ok: true });
  }
  const ok = vergleiche(String(b.benutzer || '').trim(), GR_BENUTZER()) && vergleiche(String(b.passwort || ''), GR_PASSWORT());
  if (!ok) {
    await warte(600);
    return NextResponse.json({ fehler: 'Benutzer oder Passwort stimmen nicht.' }, { status: 401 });
  }
  await setzeSitzung({ uid: me.uid, name: me.name, gr: true });
  return NextResponse.json({ ok: true });
}
