import { NextResponse } from 'next/server';
import { alle, datenbankVorhanden } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Einfacher Gesundheitscheck ohne Inhalte */
export async function GET() {
  if (!datenbankVorhanden()) return NextResponse.json({ ok: false, datenbank: 'fehlt' }, { status: 503 });
  try {
    const d = await alle(['config', 'antraege']);
    return NextResponse.json({ ok: true, datenbank: 'verbunden', eingerichtet: d.config.length > 0 });
  } catch (e) {
    console.error('health', e);
    return NextResponse.json({ ok: false, datenbank: 'fehler' }, { status: 500 });
  }
}
