import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { hole } from './db';

const COOKIE = 'gfg_sitzung';
const TAGE = 60;

function geheimnis() {
  const s = process.env.SESSION_SECRET
    || crypto.createHash('sha256').update('gfg-fraktion:' + (process.env.DATABASE_URL || process.env.POSTGRES_URL || 'lokal')).digest('hex');
  return new TextEncoder().encode(s);
}

export const GR_ROLLEN = ['Gemeinderat', 'gf. Gemeinderat'];
export const istGRRolle = (rolle) => GR_ROLLEN.includes(rolle);

/** Normalisierter Name zum Vergleichen: klein, ohne Akzente, ß als ss */
export const nameSchluessel = (n) => String(n || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();

/** Vorgegebenes Passwort: GFG + Anfangsbuchstabe Vorname + Anfangsbuchstabe Nachname */
export function startPasswort(name) {
  const teile = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return '';
  const a = teile[0][0];
  const b = teile.length > 1 ? teile[teile.length - 1][0] : '';
  return `GFG${a}${b}`.toUpperCase();
}

/** Prüft das Passwort einer Person: eigenes Passwort, sonst das vorgegebene (auch über Zweitnamen) */
export function passwortPasst(m, pw) {
  if (!m || !pw) return false;
  if (m.passwortHash) return pruefePasswort(pw, m.passwortHash);
  const eingabe = String(pw).trim().toUpperCase();
  return [m.name, ...(m.auch || [])].some((n) => vergleiche(eingabe, startPasswort(n)));
}

/** Rechte einer Person aus ihrem Mitgliedseintrag */
export const rechte = (m) => ({ gr: istGRRolle(m.rolle), mk: !!m.marketing, admin: !!m.admin });

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

/**
 * Liest die Anmeldung und holt die aktuellen Rollen aus dem Mitgliedseintrag.
 * Geänderte Rollen gelten sofort, ein geändertes Passwort meldet alte Geräte ab.
 */
export async function leseSitzung() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t) return null;
  let payload;
  try { ({ payload } = await jwtVerify(t, geheimnis())); } catch { return null; }
  const m = await hole('mitglieder', String(payload.uid || ''));
  if (!m) return null;
  if ((m.pwStand || 0) !== (payload.pv || 0)) return null;
  return { uid: m.id, name: m.name, ...rechte(m) };
}

export async function beendeSitzung() {
  const c = await cookies();
  c.delete(COOKIE);
}

export const warte = (ms) => new Promise((r) => setTimeout(r, ms));
