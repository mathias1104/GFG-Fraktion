'use client';
import { useState } from 'react';
import { Feld } from './ui';

async function post(body) {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fehler || 'Anmeldung fehlgeschlagen.');
  return j;
}

export default function Anmelden({ onFertig }) {
  const [art, setArt] = useState('mitglied');
  const [pw, setPw] = useState('');
  const [grB, setGrB] = useState('');
  const [grP, setGrP] = useState('');
  const [liste, setListe] = useState(null);
  const [eigenerName, setEigenerName] = useState('');
  const [fehler, setFehler] = useState('');
  const [busy, setBusy] = useState(false);

  const creds = art === 'gr' ? { grBenutzer: grB, grPasswort: grP } : { passwort: pw };

  async function schritt1(e) {
    e.preventDefault();
    setBusy(true); setFehler('');
    try {
      const j = await post({ ...creds, schritt: 1 });
      setListe(j.mitglieder);
    } catch (err) { setFehler(err.message); } finally { setBusy(false); }
  }

  async function waehle(mid, name) {
    setBusy(true); setFehler('');
    try {
      await post({ ...creds, schritt: 2, mid, name });
      onFertig();
    } catch (err) { setFehler(err.message); setBusy(false); }
  }

  return (
    <div className="anmelden">
      <div className="anmelden-karte">
        <div className="marke">
          <span className="marke-zeichen">GFG</span>
          <span className="marke-text">Fraktion<span>Gemeinsam für unsere Gemeinde</span></span>
        </div>

        {!liste ? (
          <form onSubmit={schritt1}>
            <h1>Anmelden</h1>
            <p className="leise" style={{ marginBottom: 22 }}>
              {art === 'gr' ? 'Mit den Zugangsdaten für Gemeinderäte.' : 'Mit dem Passwort, das alle in der Fraktion bekommen haben.'}
            </p>
            {art === 'mitglied' ? (
              <Feld label="Fraktionspasswort">
                <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
              </Feld>
            ) : (
              <>
                <Feld label="Benutzer">
                  <input autoComplete="username" value={grB} onChange={(e) => setGrB(e.target.value)} required />
                </Feld>
                <Feld label="Passwort">
                  <input type="password" autoComplete="current-password" value={grP} onChange={(e) => setGrP(e.target.value)} required />
                </Feld>
              </>
            )}
            {fehler && <p className="hinweis fehler" role="alert" style={{ marginBottom: 14 }}>{fehler}</p>}
            <div className="knopfreihe">
              <button className="knopf" disabled={busy}>Weiter</button>
              <button type="button" className="knopf still" onClick={() => { setArt(art === 'gr' ? 'mitglied' : 'gr'); setFehler(''); }}>
                {art === 'gr' ? 'Als Vereinsmitglied anmelden' : 'Als Gemeinderat anmelden'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h1>Wer bist du?</h1>
            <p className="leise">Dein Name steht bei deinen Themen und Kommentaren.</p>
            <div className="namen">
              {liste.map((m) => (
                <button key={m.id} onClick={() => waehle(m.id)} disabled={busy}>
                  {m.name}<span className="leise mini">{m.rolle}</span>
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); waehle(null, eigenerName); }}>
              <Feld label="Nicht in der Liste? Name eingeben">
                <input value={eigenerName} onChange={(e) => setEigenerName(e.target.value)} placeholder="Vor- und Nachname" />
              </Feld>
              {fehler && <p className="hinweis fehler" role="alert" style={{ marginBottom: 14 }}>{fehler}</p>}
              <div className="knopfreihe">
                <button className="knopf" disabled={busy || eigenerName.trim().length < 2}>Mit diesem Namen anmelden</button>
                <button type="button" className="knopf still" onClick={() => setListe(null)}>Zurück</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
