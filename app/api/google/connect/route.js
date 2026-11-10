import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { leseSitzung } from '@/lib/auth';
import { authUrl, googleEingerichtet } from '@/lib/google';

export async function GET(req) {
  const me = await leseSitzung();
  const origin = new URL(req.url).origin;
  if (!me?.gr) return NextResponse.redirect(`${origin}/#gemeinderaete`);
  if (!googleEingerichtet()) return NextResponse.redirect(`${origin}/?google=fehlt#gemeinderaete`);
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set('gfg_oauth', state, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 600 });
  return res;
}
