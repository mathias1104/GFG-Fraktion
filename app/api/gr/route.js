import { NextResponse } from 'next/server';
import { leseSitzung, setzeSitzung, vergleiche, GR_BENUTZER, GR_PASSWORT, MK_PASSWORT, warte } from '@/lib/auth';

export async function POST(req) {
  const me = await leseSitzung();
  if (!me) return NextResponse.json({ fehler: 'Bitte zuerst anmelden.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.bereich === 'marketing') {
    if (b.sperren) { await setzeSitzung({ ...me, mk: false }); return NextResponse.json({ ok: true }); }
    if (!vergleiche(String(b.passwort || ''), MK_PASSWORT())) {
      await warte(600);
      return NextResponse.json({ fehler: 'Das Passwort stimmt nicht.' }, { status: 401 });
    }
    await setzeSitzung({ ...me, mk: true });
    return NextResponse.json({ ok: true });
  }
  if (b.sperren) {
    await setzeSitzung({ ...me, gr: false });
    return NextResponse.json({ ok: true });
  }
  const ok = vergleiche(String(b.benutzer || '').trim(), GR_BENUTZER()) && vergleiche(String(b.passwort || ''), GR_PASSWORT());
  if (!ok) {
    await warte(600);
    return NextResponse.json({ fehler: 'Benutzer oder Passwort stimmen nicht.' }, { status: 401 });
  }
  await setzeSitzung({ ...me, gr: true });
  return NextResponse.json({ ok: true });
}
