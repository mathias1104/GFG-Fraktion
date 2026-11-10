import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { leseSitzung } from '@/lib/auth';
import { tauscheCode } from '@/lib/google';

export async function GET(req) {
  const u = new URL(req.url);
  const origin = u.origin;
  const me = await leseSitzung();
  const c = await cookies();
  const state = c.get('gfg_oauth')?.value;
  if (!me?.gr || !state || state !== u.searchParams.get('state')) {
    return NextResponse.redirect(`${origin}/?google=abgelehnt#gemeinderaete`);
  }
  try {
    await tauscheCode(u.searchParams.get('code'), origin);
    const res = NextResponse.redirect(`${origin}/?google=ok#gemeinderaete`);
    res.cookies.delete('gfg_oauth');
    return res;
  } catch (e) {
    console.error('google callback', e);
    return NextResponse.redirect(`${origin}/?google=fehler#gemeinderaete`);
  }
}
