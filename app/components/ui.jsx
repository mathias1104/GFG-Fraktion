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

export function Dialog({ titel, onClose, children }) {
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
      <div className="dialog" role="dialog" aria-modal="true" aria-label={titel} ref={ref}>
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
export function DialogForm({ titel, onClose, onSubmit, knopf = 'Speichern', children, gefahr }) {
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  return (
    <Dialog titel={titel} onClose={onClose}>
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
