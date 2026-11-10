'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx, Icon, Dialog } from './ui';
import Anmelden from './Anmelden';
import Start from './Start';
import { SitzungenListe, SitzungDetail } from './Sitzungen';
import Modus from './Modus';
import Protokoll from './Protokoll';
import { AntraegeListe, AntragDetail } from './Antraege';
import Gemeinderaete from './Gemeinderaete';

const REITER = [
  { id: 'start', label: 'Start', icon: 'start' },
  { id: 'sitzungen', label: 'Sitzungen', icon: 'kalender' },
  { id: 'antraege', label: 'Anträge', icon: 'antrag' },
  { id: 'gemeinderaete', label: 'Gemeinderäte', icon: 'schloss' },
];

function leseRoute() {
  if (typeof window === 'undefined') return { seite: 'start' };
  const h = window.location.hash.replace(/^#/, '') || 'start';
  const m = h.match(/^(sitzung|modus|protokoll|antrag)-(.+)$/);
  if (m) return { seite: m[1], id: m[2] };
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
    const t = setTimeout(() => setToast(null), 4200);
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
          const zu = (v) => { setDialog(null); resolve(v); };
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

  const aktiverReiter = { sitzung: 'sitzungen', modus: 'sitzungen', protokoll: 'sitzungen', antrag: 'antraege' }[route.seite] || route.seite;
  let inhalt;
  switch (route.seite) {
    case 'sitzungen': inhalt = <SitzungenListe />; break;
    case 'sitzung': inhalt = <SitzungDetail id={route.id} />; break;
    case 'modus': inhalt = <Modus id={route.id} />; break;
    case 'protokoll': inhalt = <Protokoll id={route.id} />; break;
    case 'antraege': inhalt = <AntraegeListe />; break;
    case 'antrag': inhalt = <AntragDetail id={route.id} />; break;
    case 'gemeinderaete': inhalt = <Gemeinderaete />; break;
    default: inhalt = <Start />;
  }
  const Offen = dialog;

  return (
    <AppCtx.Provider value={ctx}>
      <header className="kopf">
        <div className="kopf-innen">
          <a href="#start" className="marke" aria-label="GFG Fraktion, zur Startseite">
            <span className="marke-zeichen">GFG</span>
            <span className="marke-text">Fraktion<span>Gemeinsam für unsere Gemeinde</span></span>
          </a>
          <nav className="reiter" aria-label="Hauptnavigation">
            {REITER.map((r) => (
              <a key={r.id} href={`#${r.id}`} aria-current={aktiverReiter === r.id ? 'page' : undefined}>
                {r.id === 'gemeinderaete' && <Icon n="schloss" size={16} />}{r.label}
              </a>
            ))}
          </nav>
          <div className="wer">
            <span className="name">{stand.me.name}</span>
            {stand.me.gr && <span className="gr-marke">Gemeinderat</span>}
            <button className="knopf still klein" onClick={ctx.abmelden}>Abmelden</button>
          </div>
        </div>
      </header>
      <main>{inhalt}</main>
      <nav className="unten-nav" aria-label="Hauptnavigation">
        {REITER.map((r) => (
          <a key={r.id} href={`#${r.id}`} aria-current={aktiverReiter === r.id ? 'page' : undefined}>
            <Icon n={r.icon} />{r.label}
          </a>
        ))}
      </nav>
      {Offen && <Offen />}
      {toast && <div className={`toast${toast.fehler ? ' fehler' : ''}`} role="status">{toast.text}</div>}
    </AppCtx.Provider>
  );
}
