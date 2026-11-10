import { NextResponse } from 'next/server';
import { beendeSitzung } from '@/lib/auth';

export async function POST() {
  await beendeSitzung();
  return NextResponse.json({ ok: true });
}
