import { NextResponse } from 'next/server';
import { taeglicherLauf } from '@/lib/aktionen';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  const geheim = process.env.CRON_SECRET;
  if (geheim && req.headers.get('authorization') !== `Bearer ${geheim}`) {
    return NextResponse.json({ fehler: 'nicht erlaubt' }, { status: 401 });
  }
  const r = await taeglicherLauf();
  return NextResponse.json({ ok: true, ...r });
}
