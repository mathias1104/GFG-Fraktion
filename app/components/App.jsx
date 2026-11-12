'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx, Icon, Dialog } from './ui';
import Fehlergrenze, { meldeFehler } from './Fehlergrenze';
import Anmelden from './Anmelden';
import Start from './Start';
import { SitzungenListe, SitzungDetail } from './Sitzungen';
import Modus from './Modus';
import Protokoll from './Protokoll';
import { AntraegeListe, AntragDetail } from './Antraege';
import Gemeinderaete, { GrSitzungDetail } from './Gemeinderaete';
import Videothemen from './Videothemen';
import { AufgabenSeite } from './Aufgaben';
import Ausschuesse from './Ausschuesse';
import Kalender from './Kalender';
import BenachrichtigungsSeite, { Glocke } from './Benachrichtigungen';
import Marketing, { BeitragDetail } from './Marketing';
import Verwaltung from './Verwaltung';

// Gruppen: Alltag für alle, Mitarbeit, geschützte Bereiche mit Passwort
const REITER = [
  { id: 'start', label: 'Start', icon: 'start', unten: true, gruppe: 'alltag' },
  { id: 'sitzungen', label: 'Sitzungen', icon: 'sitzung', unten: true, gruppe: 'alltag' },
  { id: 'aufgaben', label: 'Aufgaben', icon: 'check', unten: true, gruppe: 'alltag' },
  { id: 'kalender', label: 'Kalender', icon: 'kalender', unten: true, gruppe: 'alltag' },
  { id: 'antraege', label: 'Anträge', icon: 'antrag', gruppe: 'fraktion' },
  { id: 'videothemen', label: 'Videothemen', icon: 'video', gruppe: 'fraktion' },
  { id: 'ausschuesse', label: 'Ausschüsse', icon: 'gruppe', gruppe: 'fraktion' },
  { id: 'marketing', label: 'Marketing', icon: 'megafon', gruppe: 'geschuetzt' },
  { id: 'gemeinderaete', label: 'Gemeinderäte', icon: 'schloss', gruppe: 'geschuetzt' },
];
const GRUPPEN = [['alltag', 'Alltag'], ['fraktion', 'Fraktion'], ['geschuetzt', 'Mit Passwort']];

function leseRoute() {
  if (typeof window === 'undefined') return { seite: 'start' };
  const h = window.location.hash.replace(/^#/, '') || 'start';
  if (h === 'einstellungen') return { seite: 'gemeinderaete', unter: 'verwaltung' };
  const m = h.match(/^(sitzung|modus|protokoll|antrag|grsitzung|beitrag)-(.+)$/);
  if (m) return { seite: m[1], id: m[2] };
  if (h === 'benachrichtigungen' || h === 'verwaltung') return { seite: h };
  return { seite: REITER.some((r) => r.id === h) ? h : 'start' };
}

async function api(url, body) {
  const r = await fetch(url, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.fehler || 'Verbindung fehlgeschlagen.');
    e.status = r.status;
    throw e;
  }
  return j;
}

export default function App() {
  const [zustand, setZustand] = useState('laden'); // laden | anmelden | bereit | keine_db | fehler
  const [stand, setStand] = useState(null);
  const [route, setRoute] = useState({ seite: 'start' });
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current = dialog; }, [dialog]);
  const [letzterBesuch, setLetzterBesuch] = useState(undefined);
  const besuchGemeldet = useRef(false);

  const laden = useCallback(async () => {
    try {
      const j = await api('/api/state');
      setStand(j);
      setZustand('bereit');
      setLetzterBesuch((v) => (v === undefined ? j.letzterBesuch : v));
      return j;
    } catch (e) {
      if (e.status === 401) setZustand('anmelden');
      else if (e.status === 503) setZustand('keine_db');
      else setZustand((z) => (z === 'bereit' ? z : 'fehler'));
      return null;
    }
  }, []);

  useEffect(() => {
    const f1 = (e) => meldeFehler(e.error || e.message, 'window');
    const f2 = (e) => meldeFehler(e.reason, 'promise');
    window.addEventListener('error', f1);
    window.addEventListener('unhandledrejection', f2);
    return () => { window.removeEventListener('error', f1); window.removeEventListener('unhandledrejection', f2); };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    const f = (e) => { if (e.data?.typ === 'oeffne' && String(e.data.url).startsWith('#')) window.location.hash = e.data.url.slice(1); };
    navigator.serviceWorker.addEventListener('message', f);
    return () => navigator.serviceWorker.removeEventListener('message', f);
  }, []);

  useEffect(() => {
    setRoute(leseRoute());
    const f = () => { setRoute(leseRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    laden();
    return () => window.removeEventListener('hashchange', f);
  }, [laden]);

  // Regelmäßig aktualisieren, im Sitzungsmodus öfter
  useEffect(() => {
    if (zustand !== 'bereit') return undefined;
    const ms = route.seite === 'modus' ? 4000 : 20000;
    const i = setInterval(() => { if (!document.hidden) laden(); }, ms);
    const sichtbar = () => { if (!document.hidden) laden(); };
    document.addEventListener('visibilitychange', sichtbar);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', sichtbar); };
  }, [zustand, route.seite, laden]);

  // Besuch nach kurzer Zeit vermerken (für "Neu seit deinem letzten Besuch")
  useEffect(() => {
    if (zustand !== 'bereit' || besuchGemeldet.current) return undefined;
    besuchGemeldet.current = true;
    const t = setTimeout(() => { api('/api/mutate', { aktion: 'besuch' }).catch(() => {}); }, 5000);
    return () => clearTimeout(t);
  }, [zustand]);

  // Rückmeldung nach Google-Verbindung
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('google');
    if (!q) return;
    const texte = { ok: 'Google-Konto verbunden.', fehler: 'Google-Verbindung fehlgeschlagen.', abgelehnt: 'Google-Verbindung abgebrochen.', fehlt: 'Google ist noch nicht eingerichtet.' };
    setToast({ text: texte[q] || q, fehler: q !== 'ok' });
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    // Längere Meldungen bleiben länger stehen
    const t = setTimeout(() => setToast(null), Math.min(12000, 4200 + String(toast.text || '').length * 40));
    return () => clearTimeout(t);
  }, [toast]);

  const ctx = useMemo(() => {
    const zeige = (text, fehler = false) => setToast({ text, fehler });
    return {
      stand,
      me: stand?.me,
      daten: stand?.daten || {},
      config: stand?.config || {},
      google: stand?.google,
      letzterBesuch,
      jetztServer: stand?.jetzt,
      toast: zeige,
      laden,
      oeffne: (d) => setDialog(() => d),
      schliesse: () => setDialog(null),
      async mutate(aktion, daten, meldung) {
        const r = await api('/api/mutate', { aktion, daten });
        await laden();
        if (meldung) zeige(meldung);
        return r;
      },
      async googleAktion(aktion, sitzungId) {
        try {
          const r = await api('/api/google/action', { aktion, sitzungId });
          await laden();
          return r;
        } catch (e) {
          zeige(e.message, true);
          return null;
        }
      },
      bestaetige(titel, text, knopf = 'Löschen') {
        return new Promise((resolve) => {
          // Beim Abbrechen kehrt der vorherige Dialog (z. B. ein Bearbeiten-Formular) zurück
          const vorher = dialogRef.current;
          const zu = (v) => { setDialog(v || !vorher ? null : () => vorher); resolve(v); };
          setDialog(() => () => (
            <Dialog titel={titel} onClose={() => zu(false)}>
              <p>{text}</p>
              <div className="dialog-fuss" style={{ marginTop: 20 }}>
                <button className="knopf zweit" onClick={() => zu(false)}>Abbrechen</button>
                <button className="knopf gefahr" onClick={() => zu(true)}>{knopf}</button>
              </div>
            </Dialog>
          ));
        });
      },
      async abmelden() {
        await api('/api/logout', {});
        setStand(null);
        setZustand('anmelden');
      },
    };
  }, [stand, letzterBesuch, laden]);

  if (zustand === 'laden') return <div className="laden">Lädt …</div>;
  if (zustand === 'keine_db') {
    return (
      <div className="anmelden"><div className="anmelden-karte">
        <h1>Datenbank fehlt</h1>
        <p className="leise" style={{ marginTop: 8 }}>Verbinde im Vercel-Projekt unter Storage eine Neon-Postgres-Datenbank und stelle die App danach neu bereit.</p>
      </div></div>
    );
  }
  if (zustand === 'anmelden') return <Anmelden onFertig={() => { besuchGemeldet.current = false; setLetzterBesuch(undefined); laden(); }} />;
  if (zustand === 'fehler' || !stand) {
    return (
      <div className="anmelden"><div className="anmelden-karte">
        <h1>Keine Verbindung</h1>
        <p className="leise" style={{ margin: '8px 0 16px' }}>Die App erreicht den Server gerade nicht.</p>
        <button className="knopf" onClick={() => { setZustand('laden'); laden(); }}>Erneut versuchen</button>
      </div></div>
    );
  }

  const aktiverReiter = { sitzung: 'sitzungen', modus: 'sitzungen', protokoll: 'sitzungen', antrag: 'antraege', grsitzung: 'gemeinderaete', beitrag: 'marketing' }[route.seite] || route.seite;
  const imMehr = !REITER.find((r) => r.id === aktiverReiter)?.unten;
  let inhalt;
  switch (route.seite) {
    case 'sitzungen': inhalt = <SitzungenListe />; break;
    case 'sitzung': inhalt = <SitzungDetail id={route.id} />; break;
    case 'modus': inhalt = <Modus id={route.id} />; break;
    case 'protokoll': inhalt = <Protokoll id={route.id} />; break;
    case 'antraege': inhalt = <AntraegeListe />; break;
    case 'antrag': inhalt = <AntragDetail id={route.id} />; break;
    case 'gemeinderaete': inhalt = <Gemeinderaete key={route.unter || 'gr'} unter={route.unter} />; break;
    case 'grsitzung': inhalt = <GrSitzungDetail id={route.id} />; break;
    case 'aufgaben': inhalt = <AufgabenSeite />; break;
    case 'videothemen': inhalt = <Videothemen />; break;
    case 'ausschuesse': inhalt = <Ausschuesse />; break;
    case 'kalender': inhalt = <Kalender />; break;
    case 'benachrichtigungen': inhalt = <BenachrichtigungsSeite />; break;
    case 'marketing': inhalt = <Marketing />; break;
    case 'verwaltung': inhalt = <Verwaltung />; break;
    case 'beitrag': inhalt = <BeitragDetail id={route.id} />; break;
    default: inhalt = <Start />;
  }
  const Offen = dialog;

  return (
    <AppCtx.Provider value={ctx}>
      <header className="kopf">
        <div className="kopf-innen">
          <a href="#start" className="marke" aria-label="GFG Fraktion, zur Startseite">
            <img className="marke-zeichen" src="/logo-zeichen.svg" alt="GFG" />
            <span className="marke-text">Fraktion<span>Gemeinsam für unsere Gemeinde</span></span>
          </a>
          <div className="wer">
            <span className="name">{stand.me.name}</span>
            {stand.me.gr && <span className="gr-marke">Gemeinderat</span>}
            {stand.me.admin && <a className="knopf still klein nur-breit-flex" href="#verwaltung" aria-label="Personen und Rollen"><Icon n="gruppe" size={18} /><span className="nur-breit">Personen</span></a>}
            <Glocke />
            {stand.me.gr && <a className="knopf still klein nur-breit-flex" href="#einstellungen" aria-label="Einstellungen"><Icon n="zahnrad" size={18} /><span className="nur-breit">Einstellungen</span></a>}
            <button className="knopf still klein nur-breit-flex" onClick={ctx.abmelden}>Abmelden</button>
          </div>
        </div>
        <nav className="reiter" aria-label="Hauptnavigation">
          <div className="reiter-innen">
            {GRUPPEN.map(([g]) => (
              <div key={g} className={`reiter-gruppe g-${g}`}>
                {REITER.filter((r) => r.gruppe === g).map((r) => {
                  const offen = g === 'geschuetzt' && (r.id === 'gemeinderaete' ? stand.me.gr : stand.me.mk);
                  return (
                    <a key={r.id} href={`#${r.id}`} aria-current={aktiverReiter === r.id ? 'page' : undefined}>
                      {g === 'geschuetzt' && <Icon n={offen ? r.icon : 'schloss'} size={16} />}{r.label}
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
      </header>
      <main><Fehlergrenze ort={`${route.seite}-${route.id || ''}`}>{inhalt}</Fehlergrenze></main>
      <nav className="unten-nav" aria-label="Hauptnavigation">
        {REITER.filter((r) => r.unten).map((r) => (
          <a key={r.id} href={`#${r.id}`} aria-current={aktiverReiter === r.id ? 'page' : undefined}>
            <Icon n={r.icon} />{r.label}
          </a>
        ))}
        <button type="button" aria-current={imMehr ? 'page' : undefined} aria-haspopup="dialog" onClick={() => ctx.oeffne(() => (
          <Dialog titel="Mehr" onClose={ctx.schliesse}>
            {[['fraktion', 'Fraktion'], ['geschuetzt', 'Mit Passwort']].map(([g, titel]) => (
              <div key={g} className="mehr-gruppe">
                <h3>{titel}</h3>
                <ul className="mehr-liste">
                  {REITER.filter((r) => r.gruppe === g).map((r) => (
                    <li key={r.id}><a href={`#${r.id}`} onClick={ctx.schliesse}><Icon n={r.icon} />{r.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mehr-gruppe">
              <h3>Für mich: {stand.me.name}</h3>
              <ul className="mehr-liste">
                <li><a href="#benachrichtigungen" onClick={ctx.schliesse}><Icon n="glocke" />Benachrichtigungen</a></li>
                {stand.me.admin && <li><a href="#verwaltung" onClick={ctx.schliesse}><Icon n="gruppe" />Personen und Rollen</a></li>}
                {stand.me.gr && <li><a href="#einstellungen" onClick={ctx.schliesse}><Icon n="zahnrad" />Einstellungen</a></li>}
                <li><button type="button" onClick={() => { ctx.schliesse(); ctx.abmelden(); }}><Icon n="zurueck" />Abmelden</button></li>
              </ul>
            </div>
          </Dialog>
        ))}>
          <Icon n="mehr" />Mehr
        </button>
      </nav>
      {Offen && <Fehlergrenze ort="dialog"><Offen /></Fehlergrenze>}
      {toast && <div className={`toast${toast.fehler ? ' fehler' : ''}`} role="status">{toast.text}</div>}
    </AppCtx.Provider>
  );
}
