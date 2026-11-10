import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const COOKIE = 'gfg_sitzung';
const TAGE = 60;

function geheimnis() {
  const s = process.env.SESSION_SECRET
    || crypto.createHash('sha256').update('gfg-fraktion:' + (process.env.DATABASE_URL || process.env.POSTGRES_URL || 'lokal')).digest('hex');
  return new TextEncoder().encode(s);
}

export const GR_BENUTZER = () => process.env.GR_USER || 'Gemeinderat';
export const GR_PASSWORT = () => process.env.GR_PASSWORD || 'Gemeinde';
export const MK_PASSWORT = () => process.env.MARKETING_PASSWORD || 'Marketing';

export function vergleiche(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function hashPasswort(pw) {
  const salt = crypto.randomBytes(12).toString('hex');
  const h = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return `${salt}:${h}`;
}

export function pruefePasswort(pw, gespeichert) {
  if (!gespeichert || !pw) return false;
  const [salt, h] = String(gespeichert).split(':');
  const ist = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return vergleiche(ist, h);
}

export async function setzeSitzung(daten) {
  const token = await new SignJWT(daten)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TAGE}d`)
    .sign(geheimnis());
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TAGE * 86400,
  });
}

export async function leseSitzung() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, geheimnis());
    return { uid: payload.uid, name: payload.name, gr: !!payload.gr, mk: !!payload.mk };
  } catch {
    return null;
  }
}

export async function beendeSitzung() {
  const c = await cookies();
  c.delete(COOKIE);
}

export const warte = (ms) => new Promise((r) => setTimeout(r, ms));
