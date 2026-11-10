'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm } from './ui';
import { ROLLEN, ORTSTEILE, zeitpunkt, STANDARD_AUSSCHUESSE } from '@/lib/domain';

function Freischalten() {
  const { laden, toast } = useApp();
  const [b, setB] = useState('');
  const [p, setP] = useState('');
  const [fehler, setFehler] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Gemeinderäte</h1>
      <p className="leise" style={{ margin: '8px 0 22px' }}>Dieser Bereich ist für die Gemeinderäte der GFG. Hier werden Anträge, Sitzungen und Protokolle bearbeitet.</p>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setFehler('');
        const r = await fetch('/api/gr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ benutzer: b, passwort: p }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) { setFehler(j.fehler || 'Das hat nicht geklappt.'); return; }
        await laden();
        toast('Gemeinderäte-Bereich freigeschaltet');
      }}>
        <Feld label="Benutzer"><input value={b} onChange={(e) => setB(e.target.value)} autoComplete="username" required /></Feld>
        <Feld label="Passwort"><input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></Feld>
        {fehler && <p className="hinweis fehler" role="alert" style={{ marginBottom: 14 }}>{fehler}</p>}
        <button className="knopf" disabled={busy}><Icon n="schloss" size={18} />Freischalten</button>
      </form>
    </div>
  );
}

function MitgliedDialog({ m }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({ name: m?.name || '', email: m?.email || '', rolle: m?.rolle || 'Vereinsmitglied', funktion: m?.funktion || '', ortsteil: m?.ortsteil || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={m ? 'Mitglied bearbeiten' : 'Mitglied hinzufügen'} onClose={schliesse}
      onSubmit={() => mutate('mitglied.speichern', { ...f, id: m?.id }, 'Mitglied gespeichert')}
      gefahr={m && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Mitglied entfernen?', `${m.name} bekommt dann keine Einladungen mehr.`, 'Entfernen')) {
            try { await mutate('mitglied.loeschen', { id: m.id }, 'Mitglied entfernt'); } catch (e) { toast(e.message, true); }
          }
        }}>Entfernen</button>
      )}>
      <Feld label="Name"><input value={f.name} onChange={set('name')} required maxLength={80} /></Feld>
      <Feld label="E-Mail-Adresse" hinweis="Für Kalendereinladungen, Tagesordnung und Erinnerungen."><input type="email" value={f.email} onChange={set('email')} maxLength={120} /></Feld>
      <div className="feld-reihe">
        <Feld label="Rolle"><select value={f.rolle} onChange={set('rolle')}>{ROLLEN.map((r) => <option key={r}>{r}</option>)}</select></Feld>
        <Feld label="Ortsteil"><select value={f.ortsteil} onChange={set('ortsteil')}><option value="">keine Angabe</option>{ORTSTEILE.map((o) => <option key={o}>{o}</option>)}</select></Feld>
      </div>
      <Feld label="Funktion (optional)"><input value={f.funktion} onChange={set('funktion')} maxLength={80} placeholder="z. B. Obmann, Kassier" /></Feld>
    </DialogForm>
  );
}

function Einstellungen() {
  const { config, mutate, toast } = useApp();
  const [pw, setPw] = useState('');
  const [frist, setFrist] = useState(config.fristTage ?? 3);
  const [aus, setAus] = useState((config.ausschuesse?.length ? config.ausschuesse : STANDARD_AUSSCHUESSE).join('\n'));
  const [ordner, setOrdner] = useState(config.driveFolderId || '');
  const [url, setUrl] = useState(config.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''));
  const [busy, setBusy] = useState(false);
  return (
    <form className="flaeche" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        const daten = { fristTage: frist, ausschuesse: aus.split('\n').map((x) => x.trim()).filter(Boolean), driveFolderId: ordner, appUrl: url };
        if (pw) daten.mitgliederPasswort = pw;
        await mutate('config.speichern', daten, 'Einstellungen gespeichert');
        setPw('');
      } catch (err) { toast(err.message, true); }
      setBusy(false);
    }}>
      <Feld label={config.mitgliederPasswortGesetzt ? 'Neues Fraktionspasswort' : 'Fraktionspasswort festlegen'}
        hinweis={config.mitgliederPasswortGesetzt ? 'Leer lassen, um das bisherige zu behalten. Mit diesem Passwort melden sich alle Vereinsmitglieder an.' : 'Noch nicht festgelegt. Ohne Passwort können sich Vereinsmitglieder nicht anmelden.'}>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} autoComplete="new-password" />
      </Feld>
      <div className="feld-reihe">
        <Feld label="Standard-Einreichfrist">
          <select value={frist} onChange={(e) => setFrist(e.target.value)}>{[1, 2, 3, 4, 5, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'Tag' : 'Tage'} vor der Sitzung</option>)}</select>
        </Feld>
        <Feld label="Google-Drive-Ordner (ID)" hinweis="Ordner „GFG Fraktionssitzungen“ im geteilten GFG-Ordner."><input value={ordner} onChange={(e) => setOrdner(e.target.value)} /></Feld>
      </div>
      <Feld label="Ausschüsse (einer pro Zeile)"><textarea value={aus} onChange={(e) => setAus(e.target.value)} /></Feld>
      <Feld label="Adresse der App" hinweis="Wird in Einladungen und Mails verlinkt."><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Feld>
      <button className="knopf" disabled={busy}>Einstellungen speichern</button>
    </form>
  );
}

export default function Gemeinderaete() {
  const { me, daten, google, oeffne, laden, toast } = useApp();
  if (!me.gr) return <Freischalten />;
  const mitglieder = [...(daten.mitglieder || [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const mitMail = mitglieder.filter((m) => m.email).length;
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Gemeinderäte</h1>
        <button className="knopf still klein" onClick={async () => {
          await fetch('/api/gr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sperren: true }) });
          await laden(); toast('Gemeinderäte-Bereich gesperrt');
        }}><Icon n="schloss" size={16} />Bereich sperren</button>
      </div>
      <p className="hinweis info" style={{ marginTop: 6 }}>
        In Etappe 2 kommt hier die Vorbereitung der Gemeinderatssitzungen dazu: Tagesordnung der Gemeinde, Unterlagen, gemeinsame Abstimmungslinie pro TOP, Wortmeldungen und das Archiv unseres Abstimmungsverhaltens.
      </p>

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Mitglieder</h2>
          <button className="knopf klein" onClick={() => oeffne(() => <MitgliedDialog />)}><Icon n="plus" size={18} />Mitglied hinzufügen</button>
        </div>
        <p className={mitMail < mitglieder.length ? 'warn klein' : 'leise klein'} style={{ marginBottom: 10 }}>
          {mitMail} von {mitglieder.length} haben eine E-Mail-Adresse. Nur sie bekommen Einladungen und Erinnerungen.
        </p>
        <ul className="liste">
          {mitglieder.map((m) => (
            <li key={m.id}>
              <button className="zeile" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => oeffne(() => <MitgliedDialog m={m} />)}>
                <span className="zeile-haupt">
                  <span className="zeile-titel">{m.name}</span>
                  <span className="zeile-meta">
                    <span>{m.rolle}{m.funktion ? `, ${m.funktion}` : ''}</span>
                    {m.email ? <span>{m.email}</span> : <span className="warn">E-Mail fehlt</span>}
                    {m.ortsteil && <span>{m.ortsteil}</span>}
                  </span>
                </span>
                <Icon n="stift" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="raster2">
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Google-Verbindung</h2>
          <div className="flaeche">
            {!google?.eingerichtet ? (
              <p className="klein">Noch nicht eingerichtet. Damit Kalendereinladungen, Google Docs und Mails funktionieren, müssen <b>GOOGLE_CLIENT_ID</b> und <b>GOOGLE_CLIENT_SECRET</b> im Vercel-Projekt hinterlegt sein. Die Anleitung steht in der README des GitHub-Repos.</p>
            ) : google.verbunden ? (
              <>
                <p><b>Verbunden</b> mit {google.email || 'einem Google-Konto'}.</p>
                <p className="leise klein" style={{ margin: '4px 0 14px' }}>Seit {zeitpunkt(google.verbundenAm)}. Einladungen, Docs und Mails laufen über dieses Konto.</p>
                <a className="knopf zweit klein" href="/api/google/connect">Anderes Konto verbinden</a>
              </>
            ) : (
              <>
                <p className="klein" style={{ marginBottom: 14 }}>Verbinde das Google-Konto, über das Einladungen, Tagesordnungen und Protokolle laufen sollen.</p>
                <a className="knopf" href="/api/google/connect">Google-Konto verbinden</a>
              </>
            )}
          </div>
        </section>
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Automatik</h2>
          <div className="flaeche klein">
            <p>Jeden Morgen um ca. 7 Uhr prüft die App alle kommenden Sitzungen:</p>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>Nach Ablauf der Einreichfrist wird die Tagesordnung festgelegt, als Google Doc gespeichert und an alle gemailt.</li>
              <li>7 Tage und 1 Tag vorher geht eine Erinnerung per Mail raus.</li>
            </ul>
          </div>
        </section>
      </div>

      <section className="abschnitt">
        <h2 style={{ marginBottom: 12 }}>Einstellungen</h2>
        <Einstellungen />
      </section>
    </>
  );
}
