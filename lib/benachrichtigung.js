import 'server-only';
import * as webpush from 'web-push';
import { alle, loesche } from './db';
import { googleStatus, sendeMail } from './google';
import { BENACHRICHTIGUNG_TYP, einstellung, esc } from './domain';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
export const pushEingerichtet = () => !!(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushEingerichtet()) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:team@gfg.jetzt', VAPID_PUBLIC, VAPID_PRIVATE);
export const vapidPublic = () => VAPID_PUBLIC;

const istGR = (m) => /gemeinderat/i.test(m?.rolle || '');

/**
 * Alle Empfänger einer Art mit ihren Wegen.
 * nur: Liste von uids (z. B. die zuständige Person), ausser: uid, die nichts bekommt (meist der Auslöser).
 */
export async function empfaenger(typ, { nur, ausser } = {}) {
  const t = BENACHRICHTIGUNG_TYP[typ];
  if (!t) return [];
  const { mitglieder, prefs } = await alle(['mitglieder', 'prefs']);
  const pm = Object.fromEntries(prefs.map((p) => [p.id, p]));
  const mm = Object.fromEntries(mitglieder.map((m) => [m.id, m]));
  const uids = new Set([...mitglieder.map((m) => m.id), ...prefs.map((p) => p.id)]);
  const liste = [];
  for (const uid of uids) {
    if (nur && !nur.includes(uid)) continue;
    if (ausser && uid === ausser) continue;
    const p = pm[uid] || {};
    const m = mm[uid];
    if (t.nurGR && !istGR(m)) continue;
    if (t.nurMK && !m?.marketing) continue;
    const email = (p.email || m?.email || '').trim();
    liste.push({ uid, push: einstellung(p, typ, 'push'), mail: einstellung(p, typ, 'mail') && /.+@.+\..+/.test(email), email });
  }
  return liste;
}

export async function mailEmpfaenger(typ, opt) {
  return [...new Set((await empfaenger(typ, opt)).filter((e) => e.mail).map((e) => e.email))];
}

/** Push an bestimmte Personen (uids) senden; ungültige Geräte werden entfernt */
export async function sendePush(uids, { titel, text, url }) {
  if (!pushEingerichtet() || !uids.length) return 0;
  const { pushabos } = await alle(['pushabos']);
  const ziel = pushabos.filter((a) => uids.includes(a.uid));
  const nutzlast = JSON.stringify({ titel, text, url: url || '/', icon: '/icon-192.png' });
  let n = 0;
  await Promise.all(ziel.map(async (a) => {
    try {
      await webpush.sendNotification(a.abo, nutzlast, { TTL: 60 * 60 * 24 });
      n += 1;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await loesche('pushabos', a.id);
      else console.error('push', e.statusCode, e.body || e.message);
    }
  }));
  return n;
}

/**
 * Benachrichtigt alle, die diese Art eingeschaltet haben, per Push und optional per Mail.
 * mitMail: false, wenn die Mail schon von einem anderen Ablauf verschickt wird.
 */
export async function benachrichtige(typ, { titel, text = '', url = '/', nur, ausser, mitMail = true }) {
  try {
    const liste = await empfaenger(typ, { nur, ausser });
    const push = await sendePush(liste.filter((e) => e.push).map((e) => e.uid), { titel, text, url });
    let mails = 0;
    if (mitMail) {
      const an = [...new Set(liste.filter((e) => e.mail).map((e) => e.email))];
      const g = await googleStatus();
      if (an.length && g.eingerichtet && g.verbunden) {
        const basis = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
        const link = basis ? `${basis}/${url.startsWith('#') ? url : url.replace(/^\//, '')}` : '';
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18231D">
          <p style="font-size:16px;margin:0 0 8px"><b>${esc(titel)}</b></p>
          ${text ? `<p style="margin:0 0 12px;white-space:pre-wrap">${esc(text)}</p>` : ''}
          ${link ? `<p><a href="${esc(link)}">In der GFG-Fraktions-App öffnen</a></p>` : ''}
          <p style="color:#5B6A61;font-size:12px;margin-top:18px">Du bekommst diese Mail wegen deiner Einstellungen unter Benachrichtigungen in der App.</p>
        </div>`;
        await sendeMail({ an: g.email ? [g.email] : [an[0]], bcc: an, betreff: `GFG: ${titel}`, html, text: `${titel}\n\n${text}\n\n${link}` });
        mails = an.length;
      }
    }
    return { push, mails };
  } catch (e) {
    console.error('benachrichtige', typ, e);
    return { fehler: e.message };
  }
}
