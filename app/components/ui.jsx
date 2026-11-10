'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { STATUS_TON } from '@/lib/domain';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function useJetzt(ms = 1000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return t;
}

const PFADE = {
  start: 'M3 11.5 12 4l9 7.5M5.5 9.8V20h5v-5.5h3V20h5V9.8',
  kalender: 'M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  antrag: 'M6 3.5h8l4 4V20.5H6zM14 3.5v4h4M9 12h6M9 15.5h6',
  schloss: 'M6.5 11h11v9.5h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  plus: 'M12 5v14M5 12h14',
  zurueck: 'M14.5 6 8.5 12l6 6',
  weiter: 'M9.5 6l6 6-6 6',
  check: 'M5 12.5 10 17l9-10',
  x: 'M6 6l12 12M18 6 6 18',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  stift: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  mail: 'M3.5 6h17v12h-17zM3.5 6l8.5 7 8.5-7',
  doc: 'M6 3.5h8l4 4V20.5H6zM14 3.5v4h4',
  uhr: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  sitzung: 'M4 19.5h16M6 19.5V14h12v5.5M9 14V9.5a3 3 0 0 1 6 0V14M12 3.5v1.5',
  video: 'M3.5 7h12v10h-12zM15.5 10.5 20.5 7.5v9l-5-3',
  gruppe: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M17.5 19.5h3a5 5 0 0 0-4-4.9',
  mehr: 'M5 12h.01M12 12h.01M19 12h.01',
  glocke: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0',
  zahnrad: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  daumen: 'M7.5 10.5v9h-3v-9zM7.5 10.5 11 4c1.7 0 2.5 1.2 2.2 2.8L12.7 9.5h5.1a2 2 0 0 1 2 2.4l-1.2 6a2 2 0 0 1-2 1.6H7.5',
  hochladen: 'M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15',
  papierkorb: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  funke: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  megafon: 'M4 10v4h3l7 4.5v-13L7 10zM17.5 9a4 4 0 0 1 0 6M8 14l1.2 5.5h2.6L10.8 15',
  bild: 'M4 5.5h16v13H4zM4 15.5l4.5-4.5 4 4 2.5-2.5 5 5M15.5 9.5h.01',
  balken: 'M5 20V12M10 20V6M15 20v-9M20 20V9M3.5 20.5h17',
  kopieren: 'M8.5 8.5h11v11h-11zM15.5 8.5V4.5h-11v11h4',
  auge: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export function Icon({ n, size = 20, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PFADE[n]} />
    </svg>
  );
}

export function Status({ status }) {
  return <span className={`etikett ton-${STATUS_TON[status] || 'leise'}`}>{status}</span>;
}

export function Ziel({ ziel }) {
  return <span className={`etikett ziel-${ziel}`}>{ziel}</span>;
}

export function Dringlichkeit({ wert }) {
  if (!wert) return null;
  return <span className={`etikett dr-${wert}`}>Dringlichkeit {wert}</span>;
}

export function Leer({ titel, text, children }) {
  return (
    <div className="leer">
      <h3>{titel}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function Feld({ label, hinweis, children }) {
  return (
    <label className="feld">
      <span>{label}</span>
      {children}
      {hinweis && <small>{hinweis}</small>}
    </label>
  );
}

export function Segment({ name, werte, wert, onChange, label }) {
  return (
    <div className="feld" role="group" aria-label={label}>
      <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{label}</span>
      <div className="segment">
        {werte.map((w) => (
          <label key={w}>
            <input type="radio" name={name} value={w} checked={wert === w} onChange={() => onChange(w)} />
            <span>{w}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function Dialog({ titel, onClose, children, breit }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const vorher = document.activeElement;
    const erstes = ref.current?.querySelector('input, select, textarea, button:not(.dialog-zu)');
    erstes?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = '';
      vorher?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="schleier" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog${breit ? ' breit' : ''}`} role="dialog" aria-modal="true" aria-label={titel} ref={ref}>
        <div className="dialog-kopf">
          <h2>{titel}</h2>
          <button className="knopf still dialog-zu" onClick={onClose} aria-label="Schließen"><Icon n="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Formular im Dialog mit Speichern-Knopf und Ladezustand */
export function DialogForm({ titel, onClose, onSubmit, knopf = 'Speichern', children, gefahr, breit }) {
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  return (
    <Dialog titel={titel} onClose={onClose} breit={breit}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setFehler('');
          try {
            await onSubmit();
            onClose();
          } catch (err) {
            setFehler(err.message || 'Das hat nicht geklappt.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
        {fehler && <p className="hinweis fehler" role="alert" style={{ marginBottom: 12 }}>{fehler}</p>}
        <div className="dialog-fuss">
          {gefahr}
          <button type="button" className="knopf zweit" onClick={onClose}>Abbrechen</button>
          <button className="knopf" disabled={busy}>{busy ? 'Speichert …' : knopf}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function initialen(name) {
  return String(name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}
