import { NextResponse } from 'next/server';
import { leseSitzung } from '@/lib/auth';
import { sendeMail, googleStatus } from '@/lib/google';
import { hole } from '@/lib/db';

export const maxDuration = 30;

// Schickt eine kurze Testmail an die eigene Adresse (oder an das Vereinspostfach), um den Mailversand zu prüfen
export async function POST() {
  const me = await leseSitzung();
  if (!me?.gr && !me?.admin) return NextResponse.json({ fehler: 'Das dürfen nur Gemeinderäte.' }, { status: 403 });
  const g = await googleStatus();
  if (!g.mail) return NextResponse.json({ fehler: 'Der Mailversand ist noch nicht eingerichtet.' }, { status: 400 });
  const m = await hole('mitglieder', me.uid);
  const an = (m?.email || '').trim() || g.mailAbsender;
  try {
    await sendeMail({
      an: [an],
      betreff: 'GFG Fraktion App: Testmail',
      text: `Hallo ${me.name || ''},\n\ndiese Testmail zeigt, dass der Mailversand der GFG Fraktion App funktioniert.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18231D"><p>Hallo ${me.name || ''},</p><p>diese Testmail zeigt, dass der Mailversand der GFG Fraktion App funktioniert.</p></div>`,
    });
    return NextResponse.json({ ok: true, an });
  } catch (e) {
    console.error('mailtest', e);
    return NextResponse.json({ fehler: e.message }, { status: 502 });
  }
}
