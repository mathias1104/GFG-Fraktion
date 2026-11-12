import 'server-only';
import { hole, setze } from './db';

export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.send',
];

export const googleEingerichtet = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export class GoogleFehler extends Error {
  constructor(code, msg) { super(msg || code); this.code = code; }
}

export function authUrl(origin, state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/google/callback`,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: SCOPES.join(' '),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function tauscheCode(code, origin) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) throw new GoogleFehler('oauth', j.error_description || j.error || 'Kein Refresh-Token erhalten');
  let email = '';
  try {
    const u = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${j.access_token}` } });
    email = (await u.json()).email || '';
  } catch { /* egal */ }
  await setze('secret', 'google', { refresh_token: j.refresh_token, email, verbundenAm: Date.now() });
  cache = { token: j.access_token, bis: Date.now() + (j.expires_in - 60) * 1000 };
  return email;
}

let cache = null;
async function accessToken() {
  if (cache && cache.bis > Date.now()) return cache.token;
  if (!googleEingerichtet()) throw new GoogleFehler('nicht_eingerichtet', 'Google ist noch nicht eingerichtet (GOOGLE_CLIENT_ID fehlt).');
  const s = await hole('secret', 'google');
  if (!s?.refresh_token) throw new GoogleFehler('nicht_verbunden', 'Google-Konto ist noch nicht verbunden.');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: s.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new GoogleFehler('neu_verbinden', 'Die Google-Verbindung ist abgelaufen. Bitte im Reiter Gemeinderäte neu verbinden.');
  cache = { token: j.access_token, bis: Date.now() + (j.expires_in - 60) * 1000 };
  return cache.token;
}

export async function googleStatus() {
  const s = await hole('secret', 'google');
  const verbunden = !!s?.refresh_token;
  const smtp = smtpMail();
  return {
    eingerichtet: googleEingerichtet(), verbunden, email: s?.email || '', verbundenAm: s?.verbundenAm || null,
    // Mails gehen über das eigene Postfach, weil das Google-Konto kein Gmail-Postfach hat
    mail: smtp ? 'postfach' : (googleEingerichtet() && verbunden ? 'gmail' : ''),
    mailAbsender: smtp ? SMTP().absender : (s?.email || ''),
  };
}

async function gfetch(url, opts = {}) {
  const t = await accessToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, ...(opts.headers || {}) } });
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
  if (!r.ok) throw new GoogleFehler('api', j?.error?.message || `Google meldet Fehler ${r.status}`);
  return j;
}

// ---------- Kalender ----------

export async function kalenderTermin({ eventId, summary, description, location, datum, uhrzeit, dauerMin, gaeste }) {
  const [h, m] = (uhrzeit || '19:00').split(':').map(Number);
  const startMin = h * 60 + m;
  const endMin = startMin + (Number(dauerMin) || 120);
  const pad = (n) => String(n).padStart(2, '0');
  let endDatum = datum;
  let em = endMin;
  if (em >= 24 * 60) { // über Mitternacht
    em -= 24 * 60;
    const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
    endDatum = d.toISOString().slice(0, 10);
  }
  const body = {
    summary,
    description,
    location,
    start: { dateTime: `${datum}T${pad(h)}:${pad(m)}:00`, timeZone: 'Europe/Vienna' },
    end: { dateTime: `${endDatum}T${pad(Math.floor(em / 60))}:${pad(em % 60)}:00`, timeZone: 'Europe/Vienna' },
    attendees: gaeste.map((email) => ({ email })),
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 7 * 24 * 60 }, { method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 24 * 60 }] },
    guestsCanModify: false,
  };
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  if (eventId) {
    return gfetch(`${base}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  return gfetch(`${base}?sendUpdates=all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function kalenderAbsagen(eventId) {
  const t = await accessToken();
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${t}` },
  });
}

// ---------- Drive ----------

export async function googleDoc(titel, html, ordnerId) {
  const boundary = 'gfg' + Date.now();
  const meta = { name: titel, mimeType: 'application/vnd.google-apps.document', ...(ordnerId ? { parents: [ordnerId] } : {}) };
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(meta),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', '', `<html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
    `--${boundary}--`, '',
  ].join('\r\n');
  return gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

// ---------- Gmail ----------

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
const kopf = (s) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;

// ---------- Mailversand: Postfach team@gfg.jetzt bei World4You (SMTP), sonst Gmail ----------

const SMTP = () => ({
  host: process.env.SMTP_HOST || 'smtp.world4you.com',
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER || process.env.MAIL_ABSENDER || 'team@gfg.jetzt',
  pass: process.env.SMTP_PASSWORT,
  absender: process.env.MAIL_ABSENDER || 'team@gfg.jetzt',
});
export const smtpMail = () => !!SMTP().pass;

async function sendeSmtp({ an, bcc = [], betreff, html, text }) {
  const c = SMTP();
  const { default: nodemailer } = await import('nodemailer');
  const t = nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.port === 465, requireTLS: c.port === 587,
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  });
  try {
    const info = await t.sendMail({ from: `"GFG Fraktion" <${c.absender}>`, to: an, bcc, subject: betreff, text, html: `<html><body>${html}</body></html>` });
    // Nur Anzahlen ins Protokoll, keine Adressen
    console.log('mail gesendet', JSON.stringify({ betreff, an: an.length + bcc.length, angenommen: info.accepted?.length, abgelehnt: info.rejected?.length }));
    return { ok: true };
  } catch (e) {
    console.error('smtp', c.host, c.port, e.code, e.responseCode, e.response);
    if (e.code === 'EAUTH') throw new GoogleFehler('smtp_anmeldung', `Das Postfach ${c.user} hat die Anmeldung abgelehnt (${(e.response || '').slice(0, 120)}). Bitte das Passwort prüfen.`);
    throw new GoogleFehler('smtp', `Mailversand über ${c.host} fehlgeschlagen: ${e.message}`);
  }
}

export async function sendeMail(mail) {
  if (!mail.an.length) throw new GoogleFehler('keine_empfaenger', 'Es sind noch keine E-Mail-Adressen bei den Mitgliedern eingetragen.');
  if (smtpMail()) return sendeSmtp(mail);
  return sendeGmail(mail);
}

async function sendeGmail({ an, bcc = [], betreff, html, text }) {
  if (!an.length) throw new GoogleFehler('keine_empfaenger', 'Es sind noch keine E-Mail-Adressen bei den Mitgliedern eingetragen.');
  const boundary = 'gfgmail' + Date.now();
  const roh = [
    `To: ${an.join(', ')}`,
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    `Subject: ${kopf(betreff)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    b64(`<html><body>${html}</body></html>`),
    `--${boundary}--`,
  ].join('\r\n');
  const raw = Buffer.from(roh, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try {
    return await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }),
    });
  } catch (e) {
    // Google-Konten ohne Gmail-Postfach (z. B. mit eigener Domain) dürfen über die Gmail-API nichts senden
    if (/precondition/i.test(e.message)) throw new GoogleFehler('kein_gmail', 'Das verbundene Google-Konto hat kein Gmail-Postfach, deshalb kann die App darüber keine Mails verschicken.');
    throw e;
  }
}
