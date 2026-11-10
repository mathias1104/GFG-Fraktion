import { NextResponse } from 'next/server';
import { alle, hole, datenbankVorhanden } from '@/lib/db';
import { setzeSitzung, pruefePasswort, vergleiche, GR_BENUTZER, GR_PASSWORT, warte } from '@/lib/auth';
import { slug } from '@/lib/domain';

export async function POST(req) {
  if (!datenbankVorhanden()) return NextResponse.json({ fehler: 'Die Datenbank ist noch nicht verbunden.' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const cfg = (await hole('config', 'app')) || {};
  let gr = false;
  let ok = false;
  if (b.grBenutzer || b.grPasswort) {
    gr = vergleiche(String(b.grBenutzer || '').trim(), GR_BENUTZER()) && vergleiche(String(b.grPasswort || ''), GR_PASSWORT());
    ok = gr;
  } else {
    ok = pruefePasswort(String(b.passwort || ''), cfg.mitgliederPasswort);
  }
  if (!ok) {
    await warte(600);
    const hinweis = !b.grBenutzer && !cfg.mitgliederPasswort
      ? 'Das Fraktionspasswort ist noch nicht festgelegt. Ein Gemeinderat legt es im Reiter Gemeinderäte fest.'
      : 'Die Zugangsdaten stimmen nicht.';
    return NextResponse.json({ fehler: hinweis }, { status: 401 });
  }
  const { mitglieder } = await alle(['mitglieder']);
  const liste = mitglieder.map((m) => ({ id: m.id, name: m.name, rolle: m.rolle })).sort((a, c) => a.name.localeCompare(c.name, 'de'));
  if (b.schritt !== 2) return NextResponse.json({ ok: true, gr, mitglieder: liste });

  let name = '';
  let uid = '';
  if (b.mid) {
    const m = liste.find((x) => x.id === b.mid);
    if (!m) return NextResponse.json({ fehler: 'Dieses Mitglied gibt es nicht.' }, { status: 400 });
    name = m.name; uid = m.id;
  } else {
    name = String(b.name || '').trim().slice(0, 60);
    if (name.length < 2) return NextResponse.json({ fehler: 'Bitte gib deinen Namen ein.' }, { status: 400 });
    uid = 'n-' + slug(name);
  }
  await setzeSitzung({ uid, name, gr });
  return NextResponse.json({ ok: true });
}
