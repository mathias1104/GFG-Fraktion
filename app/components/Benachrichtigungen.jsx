'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, Icon, Dialog } from './ui';
import { BENACHRICHTIGUNGEN, einstellung, ereignisse, zeitpunkt } from '@/lib/domain';

const WEGE = [['app', 'In der App'], ['push', 'Push'], ['mail', 'E-Mail']];

function b64ZuBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const roh = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...roh].map((c) => c.charCodeAt(0)));
}

export function useUngelesen() {
  const { daten, me, stand } = useApp();
  return useMemo(() => {
    if (!stand) return [];
    const prefs = stand.prefs || {};
    const seit = prefs.gelesenBis || Date.now() - 7 * 86400000;
    return ereignisse(daten, me).filter((e) => !e.nurNeu && e.ts > seit && einstellung(prefs, e.typ, 'app'));
  }, [daten, me, stand]);
}

function GlockenDialog() {
  const { daten, me, stand, schliesse, laden } = useApp();
  const prefs = stand?.prefs || {};
  const [seit] = useState(prefs.gelesenBis || Date.now() - 7 * 86400000);
  const liste = ereignisse(daten, me)
    .filter((e) => !e.nurNeu && einstellung(prefs, e.typ, 'app') && e.ts > Date.now() - 30 * 86400000)
    .slice(0, 30);
  useEffect(() => {
    fetch('/api/mutate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'glocke.gelesen' }) })
      .then(() => laden()).catch(() => {});
  }, [laden]);
  return (
    <Dialog titel="Benachrichtigungen" onClose={schliesse}>
      {liste.length === 0 ? <p className="leise">In den letzten 30 Tagen ist nichts passiert, worüber du informiert werden willst.</p> : (
        <ul className="liste glocke-liste">
          {liste.map((e, i) => (
            <li key={i}>
              <a className="zeile" href={e.href} onClick={schliesse}>
                <span className={e.ts > seit ? 'neu-punkt' : 'neu-punkt aus'} aria-hidden="true" />
                <span className="zeile-haupt">
                  <span className="zeile-titel" style={e.ts > seit ? undefined : { fontWeight: 400 }}>{e.text}</span>
                  <span className="zeile-meta">{e.wer && <span>{e.wer}</span>}<span>{zeitpunkt(e.ts)}</span>{e.ts > seit && <span className="etikett ton-offen">neu</span>}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="dialog-fuss" style={{ marginTop: 16 }}>
        <a className="knopf zweit" href="#benachrichtigungen" onClick={schliesse}><Icon n="zahnrad" size={18} />Einstellungen</a>
      </div>
    </Dialog>
  );
}

export function Glocke() {
  const { oeffne } = useApp();
  const neu = useUngelesen().length;
  return (
    <button type="button" className="knopf still klein glocke" onClick={() => oeffne(() => <GlockenDialog />)}
      aria-label={neu ? `Benachrichtigungen, ${neu} neu` : 'Benachrichtigungen'}>
      <Icon n="glocke" size={20} />
      {neu > 0 && <span className="glocke-zahl">{neu > 9 ? '9+' : neu}</span>}
    </button>
  );
}

function Schalter({ an, onChange, label, aus }) {
  return (
    <label className={`schalter${aus ? ' gesperrt' : ''}`}>
      <input type="checkbox" role="switch" checked={!!an} disabled={aus} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="schalter-spur" aria-hidden="true"><span className="schalter-knopf" /></span>
      <span className="schalter-text">{label.split(': ').pop()}</span>
    </label>
  );
}

function geraeteName() {
  const ua = navigator.userAgent;
  const geraet = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Gerät';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${geraet}, ${browser}`;
}

function DiesesGeraet() {
  const { config, mutate, toast, stand } = useApp();
  const [zustand, setZustand] = useState('pruefe'); // pruefe | nicht_moeglich | ios_installieren | blockiert | aus | an
  const [busy, setBusy] = useState(false);
  const abo = useRef(null);

  async function pruefe() {
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    const installiert = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setZustand(ios && !installiert ? 'ios_installieren' : 'nicht_moeglich'); return;
    }
    if (Notification.permission === 'denied') { setZustand('blockiert'); return; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    abo.current = await reg.pushManager.getSubscription();
    setZustand(abo.current ? 'an' : 'aus');
  }
  useEffect(() => { pruefe().catch(() => setZustand('nicht_moeglich')); }, []);

  async function einschalten() {
    setBusy(true);
    try {
      const erlaubt = await Notification.requestPermission();
      if (erlaubt !== 'granted') { setZustand(erlaubt === 'denied' ? 'blockiert' : 'aus'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const neu = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ZuBytes(config.vapidPublic) });
      await mutate('push.abo', { abo: neu.toJSON(), geraet: geraeteName() }, 'Mitteilungen auf diesem Gerät sind aktiv');
      abo.current = neu; setZustand('an');
    } catch (e) {
      const m = String(e?.message || '');
      toast(/permission|NotAllowed|denied/i.test(m + (e?.name || ''))
        ? 'Mitteilungen wurden nicht erlaubt. Erlaube sie im Browser für diese Seite. Im privaten Fenster geht es nicht.'
        : 'Mitteilungen konnten auf diesem Gerät nicht eingeschaltet werden.', true);
    } finally { setBusy(false); }
  }
  async function ausschalten() {
    setBusy(true);
    try {
      const a = abo.current;
      if (a) { await mutate('push.abmelden', { endpoint: a.endpoint }); await a.unsubscribe(); }
      abo.current = null; setZustand('aus'); toast('Mitteilungen auf diesem Gerät sind aus');
    } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try { await mutate('push.test', {}, 'Testmitteilung ist unterwegs'); } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }

  const andere = (stand?.geraete || []).length;
  if (!config.vapidPublic) return <p className="hinweis info klein">Push-Mitteilungen sind auf dem Server noch nicht eingerichtet.</p>;
  return (
    <div className="geraet">
      <div className="geraet-symbol" aria-hidden="true"><Icon n="glocke" size={26} /></div>
      <div style={{ flex: 1 }}>
        {zustand === 'pruefe' && <p className="leise">Prüfe dieses Gerät …</p>}
        {zustand === 'an' && <><p><b>Mitteilungen sind auf diesem Gerät aktiv.</b></p><p className="leise klein">Du bekommst Push-Mitteilungen für alles, wo unten „Push“ eingeschaltet ist.</p></>}
        {zustand === 'aus' && <><p><b>Push-Mitteilungen auf diesem Gerät</b></p><p className="leise klein">Damit bekommst du Hinweise aufs Handy oder den Computer, auch wenn die App geschlossen ist.</p></>}
        {zustand === 'blockiert' && <><p><b>Mitteilungen sind für diese Seite blockiert.</b></p><p className="leise klein">Erlaube Mitteilungen für gfg-fraktion.vercel.app in den Einstellungen deines Browsers bzw. am iPhone unter Einstellungen, Mitteilungen, GFG.</p></>}
        {zustand === 'ios_installieren' && <><p><b>Am iPhone zuerst zum Home-Bildschirm hinzufügen</b></p><p className="leise klein">In Safari auf Teilen tippen, dann „Zum Home-Bildschirm“. Danach die App über das neue Symbol öffnen und hier Mitteilungen einschalten.</p></>}
        {zustand === 'nicht_moeglich' && <><p><b>Dieser Browser kann keine Push-Mitteilungen.</b></p><p className="leise klein">Du bekommst trotzdem alles in der App (Glocke oben) und per E-Mail.</p></>}
        <div className="knopfreihe" style={{ marginTop: 12 }}>
          {zustand === 'aus' && <button className="knopf" disabled={busy} onClick={einschalten}>Mitteilungen einschalten</button>}
          {zustand === 'an' && <><button className="knopf zweit klein" disabled={busy} onClick={test}>Testmitteilung senden</button><button className="knopf still klein" disabled={busy} onClick={ausschalten}>Auf diesem Gerät ausschalten</button></>}
        </div>
        {andere > 0 && <p className="leise mini" style={{ marginTop: 10 }}>Aktiv auf {andere === 1 ? '1 Gerät' : `${andere} Geräten`}: {(stand.geraete || []).map((g) => g.geraet || 'Gerät').join(', ')}</p>}
      </div>
    </div>
  );
}

export default function BenachrichtigungsSeite() {
  const { stand, me, google, toast } = useApp();
  const server = stand?.prefs || {};
  const [typen, setTypen] = useState(server.typen || {});
  const [email, setEmail] = useState(server.email || '');
  const [status, setStatus] = useState('');
  const timer = useRef(null);
  const ersterLauf = useRef(true);

  async function speichere(daten) {
    setStatus('speichert');
    try {
      const r = await fetch('/api/mutate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'prefs.speichern', daten }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.fehler || 'Speichern ging nicht.');
      setStatus('gespeichert');
    } catch (e) { setStatus(''); toast(e.message, true); }
  }
  useEffect(() => {
    if (ersterLauf.current) { ersterLauf.current = false; return undefined; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => speichere({ typen }), 500);
    return () => clearTimeout(timer.current);
  }, [typen]); // eslint-disable-line react-hooks/exhaustive-deps

  const wert = (key, weg) => einstellung({ typen }, key, weg);
  const setze = (key, weg, v) => setTypen((t) => ({ ...t, [key]: { ...(t[key] || {}), [weg]: v } }));
  const adresse = email || server.mitgliedEmail;
  const gruppen = BENACHRICHTIGUNGEN.filter((g) => (!g.nurGR || me.gr) && (!g.nurMK || me.mk));

  function alles(v, weg) {
    const neu = { ...typen };
    for (const g of gruppen) for (const t of g.typen) neu[t.key] = { ...(neu[t.key] || {}), [weg]: v };
    setTypen(neu);
  }

  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Benachrichtigungen</h1>
        <span className="leise klein" aria-live="polite">{status === 'speichert' ? 'Speichert …' : status === 'gespeichert' ? 'Gespeichert' : ''}</span>
      </div>
      <p className="leise" style={{ marginBottom: 20 }}>Lege fest, worüber du informiert wirst und auf welchem Weg. Die Einstellungen gelten nur für dich.</p>

      <div className="raster2" style={{ gap: 16 }}>
        <section className="flaeche"><h2 style={{ marginBottom: 12 }}>Dieses Gerät</h2><DiesesGeraet /></section>
        <section className="flaeche">
          <h2 style={{ marginBottom: 12 }}>E-Mail</h2>
          <form onSubmit={(e) => { e.preventDefault(); speichere({ email }); }}>
            <label className="feld" style={{ marginBottom: 10 }}>
              <span>Adresse für Benachrichtigungen</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={server.mitgliedEmail || 'name@beispiel.at'} />
              <small>{server.mitgliedEmail && !email ? `Leer lassen, um ${server.mitgliedEmail} aus der Mitgliederliste zu verwenden.` : 'Wird nur für deine Benachrichtigungen verwendet.'}</small>
            </label>
            <button className="knopf zweit klein">Adresse speichern</button>
          </form>
          {!adresse && <p className="hinweis klein" style={{ marginTop: 12 }}>Ohne E-Mail-Adresse bekommst du keine Mails.</p>}
          {me.gr && google && !(google.eingerichtet && google.verbunden) && <p className="hinweis info klein" style={{ marginTop: 12 }}>Mails gehen erst raus, wenn unter Einstellungen ein Google-Konto verbunden ist.</p>}
        </section>
      </div>

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Worüber möchtest du informiert werden?</h2>
          <div className="knopfreihe">
            <button className="knopf still klein" onClick={() => alles(true, 'push')}>Push für alles</button>
            <button className="knopf still klein" onClick={() => setTypen({})}>Standard</button>
          </div>
        </div>
        <div className="praef">
          <div className="praef-kopf" aria-hidden="true"><span />{WEGE.map(([, l]) => <span key={l}>{l}</span>)}</div>
          {gruppen.map((g) => (
            <div key={g.gruppe} className="praef-gruppe">
              <h3>{g.gruppe}</h3>
              {g.typen.map((t) => (
                <div key={t.key} className="praef-zeile">
                  <div><b>{t.label}</b><span className="leise klein">{t.text}</span></div>
                  {WEGE.map(([w, l]) => (
                    <Schalter key={w} an={wert(t.key, w)} label={`${t.label}: ${l}`} aus={w === 'mail' && !adresse}
                      onChange={(v) => setze(t.key, w, v)} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
