'use client';
import { useState } from 'react';
import { Feld } from './ui';

export default function Anmelden({ onFertig }) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [fehler, setFehler] = useState('');
  const [busy, setBusy] = useState(false);

  async function anmelden(e) {
    e.preventDefault();
    setBusy(true); setFehler('');
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, passwort: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.fehler || 'Anmeldung fehlgeschlagen.');
      onFertig();
    } catch (err) { setFehler(err.message); setBusy(false); }
  }

  return (
    <div className="anmelden">
      <div className="anmelden-karte">
        <div style={{ marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="marke-logo" src="/logo.svg" alt="GFG Gemeinsam für unsere Gemeinde" />
          <p className="leise" style={{ marginTop: 10, fontWeight: 700 }}>Fraktions-App</p>
        </div>
        <form onSubmit={anmelden}>
          <h1>Anmelden</h1>
          <p className="leise" style={{ marginBottom: 22 }}>Mit deinem Namen und deinem persönlichen Passwort.</p>
          <Feld label="Vor- und Nachname">
            <input autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} required placeholder="z. B. Maria Muster" />
          </Feld>
          <Feld label="Passwort">
            <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </Feld>
          {fehler && <p className="hinweis fehler" role="alert" style={{ marginBottom: 14 }}>{fehler}</p>}
          <button className="knopf" disabled={busy}>{busy ? 'Meldet an …' : 'Anmelden'}</button>
          <p className="leise klein" style={{ marginTop: 18 }}>Passwort vergessen? Melde dich bei Mathias Mayer.</p>
        </form>
      </div>
    </div>
  );
}
