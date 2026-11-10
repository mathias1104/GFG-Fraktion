import { NextResponse } from 'next/server';
import { leseSitzung } from '@/lib/auth';

/** Nimmt Fehlermeldungen aus dem Browser entgegen und schreibt sie ins Server-Log */
export async function POST(req) {
  const me = await leseSitzung();
  const b = await req.json().catch(() => ({}));
  console.error('[client-fehler]', JSON.stringify({
    wer: me?.name || 'unbekannt', gr: !!me?.gr,
    meldung: String(b.meldung || '').slice(0, 500), stack: String(b.stack || '').slice(0, 1500),
    ort: String(b.ort || '').slice(0, 200), browser: String(req.headers.get('user-agent') || '').slice(0, 200),
  }));
  return NextResponse.json({ ok: true });
}
