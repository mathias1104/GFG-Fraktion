import { NextResponse } from 'next/server';
import { alle, datenbankVorhanden } from '@/lib/db';
import { setzeSitzung, passwortPasst, nameSchluessel, warte } from '@/lib/auth';

/** Anmeldung mit Name und persönlichem Passwort. Die Rollen kommen aus dem Mitgliedseintrag. */
export async function POST(req) {
  if (!datenbankVorhanden()) return NextResponse.json({ fehler: 'Die Datenbank ist noch nicht verbunden.' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const eingabe = nameSchluessel(b.name);
  const { mitglieder } = await alle(['mitglieder']);
  const treffer = eingabe.length >= 2
    ? mitglieder.filter((m) => [m.name, ...(m.auch || [])].some((n) => nameSchluessel(n) === eingabe))
    : [];
  const m = treffer.find((x) => passwortPasst(x, String(b.passwort || '')));
  if (!m) {
    await warte(700);
    return NextResponse.json({ fehler: 'Name oder Passwort stimmen nicht. Bitte Vor- und Nachname eingeben.' }, { status: 401 });
  }
  await setzeSitzung({ uid: m.id, pv: m.pwStand || 0 });
  return NextResponse.json({ ok: true, name: m.name });
}
