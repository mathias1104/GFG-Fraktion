'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer } from './ui';
import { ROLLEN, ORTSTEILE, zeitpunkt, LINIEN, LINIE_TON, GR_ERGEBNISSE, datumLang, datumKurz, wienTag } from '@/lib/domain';

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
  const [ordner, setOrdner] = useState(config.driveFolderId || '');
  const [url, setUrl] = useState(config.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''));
  const [busy, setBusy] = useState(false);
  return (
    <form className="flaeche" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        const daten = { fristTage: frist, driveFolderId: ordner, appUrl: url };
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
      <Feld label="Adresse der App" hinweis="Wird in Einladungen und Mails verlinkt."><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Feld>
      <button className="knopf" disabled={busy}>Einstellungen speichern</button>
    </form>
  );
}

function Linie({ wert }) {
  return <span className={`etikett ton-${LINIE_TON[wert] || 'leise'}`}>{wert === 'offen' ? 'Linie offen' : wert}</span>;
}

function GrSitzungDialog({ g }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({
    titel: g?.titel || 'Gemeinderatssitzung', datum: g?.datum || '', uhrzeit: g?.uhrzeit || '19:00', ort: g?.ort || '', notiz: g?.notiz || '',
    unterlagen: g?.unterlagen?.length ? g.unterlagen : [{ titel: '', url: '' }],
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={g ? 'Gemeinderatssitzung bearbeiten' : 'Gemeinderatssitzung anlegen'} onClose={schliesse}
      onSubmit={async () => {
        const r = await mutate('grsitzung.speichern', { ...f, id: g?.id, unterlagen: f.unterlagen.filter((u) => u.url) }, 'Gemeinderatssitzung gespeichert');
        if (!g) window.location.hash = `grsitzung-${r.id}`;
      }}
      gefahr={g && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Gemeinderatssitzung löschen?', 'Alle TOPs und Abstimmungslinien dieser Sitzung werden gelöscht, auch aus dem Archiv.')) {
            try { await mutate('grsitzung.loeschen', { id: g.id }, 'Gelöscht'); window.location.hash = 'gemeinderaete'; } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}>
      <Feld label="Bezeichnung"><input value={f.titel} onChange={set('titel')} maxLength={160} /></Feld>
      <div className="feld-reihe">
        <Feld label="Datum"><input type="date" value={f.datum} onChange={set('datum')} required /></Feld>
        <Feld label="Beginn"><input type="time" value={f.uhrzeit} onChange={set('uhrzeit')} /></Feld>
      </div>
      <Feld label="Ort"><input value={f.ort} onChange={set('ort')} maxLength={160} placeholder="z. B. Gemeindeamt Großebersdorf" /></Feld>
      <div className="feld">
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Unterlagen (Drive-Links)</span>
        {f.unterlagen.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8, marginBottom: 8 }}>
            <input className="eingabe" placeholder="Bezeichnung" value={d.titel} aria-label="Bezeichnung"
              onChange={(e) => setF((x) => ({ ...x, unterlagen: x.unterlagen.map((y, j) => (j === i ? { ...y, titel: e.target.value } : y)) }))} />
            <input className="eingabe" type="url" placeholder="https://" value={d.url} aria-label="Link"
              onChange={(e) => setF((x) => ({ ...x, unterlagen: x.unterlagen.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) }))} />
          </div>
        ))}
        <button type="button" className="knopf still klein" onClick={() => setF((x) => ({ ...x, unterlagen: [...x.unterlagen, { titel: '', url: '' }] }))}><Icon n="plus" size={16} />Weitere Unterlage</button>
      </div>
      <Feld label="Notizen zur Sitzung"><textarea value={f.notiz} onChange={set('notiz')} maxLength={4000} /></Feld>
    </DialogForm>
  );
}

function TopDialog({ g, top }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const vorbei = g.datum < wienTag();
  const [f, setF] = useState({
    key: top?.key || '', nr: top?.nr || String((g.tops?.length || 0) + 1), titel: top?.titel || '', unterlage: top?.unterlage || '',
    linie: top?.linie || 'offen', begruendung: top?.begruendung || '', sprecher: top?.sprecher || '', wortmeldung: top?.wortmeldung || '',
    ergebnis: top?.ergebnis || '', abgestimmt: top?.abgestimmt || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={top ? `TOP ${top.nr || ''} bearbeiten` : 'TOP hinzufügen'} onClose={schliesse} knopf="TOP speichern"
      onSubmit={() => mutate('grsitzung.top', { id: g.id, top: f }, 'TOP gespeichert')}
      gefahr={top && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('TOP entfernen?', top.titel, 'Entfernen')) { try { await mutate('grsitzung.top', { id: g.id, top: f, loeschen: true }, 'TOP entfernt'); } catch (e) { toast(e.message, true); } }
        }}>Entfernen</button>
      )}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
        <Feld label="Nr."><input value={f.nr} onChange={set('nr')} maxLength={10} /></Feld>
        <Feld label="Titel des TOP"><input value={f.titel} onChange={set('titel')} required maxLength={250} /></Feld>
      </div>
      <Feld label="Unterlage (Link, optional)"><input type="url" value={f.unterlage} onChange={set('unterlage')} placeholder="https://" /></Feld>
      <Feld label="Unsere Abstimmungslinie">
        <select value={f.linie} onChange={set('linie')}>{LINIEN.map((l) => <option key={l} value={l}>{l === 'offen' ? 'noch offen' : l === 'freigegeben' ? 'Abstimmung freigegeben' : l}</option>)}</select>
      </Feld>
      <Feld label="Begründung"><textarea value={f.begruendung} onChange={set('begruendung')} maxLength={3000} /></Feld>
      <Feld label="Wer spricht?"><input value={f.sprecher} onChange={set('sprecher')} maxLength={200} placeholder="z. B. GR Johannes Bayer" /></Feld>
      <Feld label="Kernaussagen der Wortmeldung"><textarea value={f.wortmeldung} onChange={set('wortmeldung')} maxLength={3000} style={{ minHeight: 80 }} /></Feld>
      <div className="feld-reihe">
        <Feld label={vorbei ? 'Ergebnis im Gemeinderat' : 'Ergebnis (nach der Sitzung)'}>
          <select value={f.ergebnis} onChange={set('ergebnis')}>{GR_ERGEBNISSE.map((e) => <option key={e} value={e}>{e || 'noch nicht bekannt'}</option>)}</select>
        </Feld>
        <Feld label="So hat die GFG abgestimmt">
          <select value={f.abgestimmt} onChange={set('abgestimmt')}>
            <option value="">noch nicht erfasst</option>
            {['dafür', 'dagegen', 'Enthaltung', 'uneinheitlich'].map((e) => <option key={e}>{e}</option>)}
          </select>
        </Feld>
      </div>
    </DialogForm>
  );
}

export function GrSitzungDetail({ id }) {
  const { daten, me, oeffne } = useApp();
  if (!me.gr) return <Freischalten />;
  const g = (daten.grsitzungen || []).find((x) => x.id === id);
  if (!g) return <><a className="zurueck" href="#gemeinderaete"><Icon n="zurueck" size={18} />Gemeinderäte</a><Leer titel="Sitzung nicht gefunden" /></>;
  const tops = g.tops || [];
  const mitLinie = tops.filter((t) => t.linie && t.linie !== 'offen').length;
  return (
    <>
      <a className="zurueck" href="#gemeinderaete"><Icon n="zurueck" size={18} />Gemeinderäte</a>
      <div className="abschnitt-kopf">
        <div>
          <h1>{g.titel || 'Gemeinderatssitzung'}</h1>
          <p className="leise">{datumLang(g.datum)}{g.uhrzeit ? `, ${g.uhrzeit} Uhr` : ''}{g.ort ? `, ${g.ort}` : ''}</p>
        </div>
        <button className="knopf zweit" onClick={() => oeffne(() => <GrSitzungDialog g={g} />)}><Icon n="stift" size={18} />Bearbeiten</button>
      </div>
      {g.unterlagen?.length > 0 && <div className="verweise">{g.unterlagen.map((u, i) => <a key={i} href={u.url} target="_blank" rel="noreferrer"><Icon n="doc" size={18} />{u.titel}</a>)}</div>}
      {g.notiz && <p style={{ whiteSpace: 'pre-wrap', marginTop: 14 }}>{g.notiz}</p>}

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Tagesordnung der Gemeinde</h2>
          <span className="leise klein">{tops.length} TOPs, {mitLinie} mit Linie</span>
        </div>
        {tops.length === 0 ? <Leer titel="Noch keine TOPs" text="Trage die Tagesordnungspunkte aus der Einladung der Gemeinde ein und legt pro Punkt die gemeinsame Linie fest." /> : (
          <div>
            {tops.map((t) => (
              <article key={t.key} className="top">
                <span className="to-nr">{t.nr || '•'}</span>
                <div>
                  <div className="zeile-titel">{t.titel}</div>
                  <div className="zeile-meta">
                    <Linie wert={t.linie} />
                    {t.ergebnis && <span className="etikett ton-aktiv">Ergebnis: {t.ergebnis}</span>}
                    {t.abgestimmt && <span>GFG stimmte {t.abgestimmt === 'uneinheitlich' ? 'uneinheitlich' : t.abgestimmt}</span>}
                    {t.unterlage && <a href={t.unterlage} target="_blank" rel="noreferrer">Unterlage</a>}
                  </div>
                  {(t.begruendung || t.sprecher || t.wortmeldung) && (
                    <div className="top-linie">
                      {t.begruendung && <div><b>Begründung</b><br />{t.begruendung}</div>}
                      {t.sprecher && <div><b>Wortmeldung</b><br />{t.sprecher}{t.wortmeldung ? `: ${t.wortmeldung}` : ''}</div>}
                    </div>
                  )}
                  {t.geaendertVon && <p className="leise mini" style={{ marginTop: 6 }}>Zuletzt {t.geaendertVon}, {zeitpunkt(t.geaendertAm)}</p>}
                </div>
                <button className="knopf still klein" aria-label={`TOP ${t.nr} bearbeiten`} onClick={() => oeffne(() => <TopDialog g={g} top={t} />)}><Icon n="stift" size={18} /></button>
              </article>
            ))}
          </div>
        )}
        <button className="knopf" style={{ marginTop: 16 }} onClick={() => oeffne(() => <TopDialog g={g} />)}><Icon n="plus" size={18} />TOP hinzufügen</button>
      </section>
    </>
  );
}

function Vorbereitung() {
  const { daten, oeffne } = useApp();
  const heute = wienTag();
  const alle = [...(daten.grsitzungen || [])];
  const kommend = alle.filter((g) => g.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum));
  const vergangen = alle.filter((g) => g.datum < heute).sort((a, b) => b.datum.localeCompare(a.datum));
  const zeile = (g) => {
    const tops = g.tops || [];
    const offen = tops.filter((t) => !t.linie || t.linie === 'offen').length;
    return (
      <li key={g.id}>
        <a className="zeile" href={`#grsitzung-${g.id}`}>
          <span className="zeile-haupt">
            <span className="zeile-titel">{g.titel || 'Gemeinderatssitzung'} am {datumKurz(g.datum)}</span>
            <span className="zeile-meta"><span>{tops.length} TOPs</span>{offen > 0 && g.datum >= heute && <span className="etikett ton-offen">{offen} ohne Linie</span>}{g.ort && <span>{g.ort}</span>}</span>
          </span>
          <Icon n="weiter" />
        </a>
      </li>
    );
  };
  return (
    <>
      <div className="abschnitt-kopf">
        <h2>Kommende Gemeinderatssitzungen</h2>
        <button className="knopf" onClick={() => oeffne(() => <GrSitzungDialog />)}><Icon n="plus" />Sitzung anlegen</button>
      </div>
      {kommend.length ? <ul className="liste">{kommend.map(zeile)}</ul> : <Leer titel="Keine kommende Gemeinderatssitzung" text="Sobald die Einladung der Gemeinde da ist: Sitzung anlegen, TOPs eintragen, Linie festlegen." />}
      {vergangen.length > 0 && (
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Vergangene</h2>
          <ul className="liste">{vergangen.map(zeile)}</ul>
        </section>
      )}
    </>
  );
}

function Archiv() {
  const { daten } = useApp();
  const [q, setQ] = useState('');
  const zeilen = (daten.grsitzungen || [])
    .flatMap((g) => (g.tops || []).map((t) => ({ ...t, g })))
    .filter((t) => !q.trim() || `${t.titel} ${t.begruendung} ${t.ergebnis}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.g.datum.localeCompare(a.g.datum) || (Number(a.nr) || 0) - (Number(b.nr) || 0));
  return (
    <>
      <p className="leise" style={{ marginBottom: 14 }}>Unser bisheriges Abstimmungsverhalten im Gemeinderat, aus allen erfassten TOPs.</p>
      <input className="eingabe" type="search" placeholder="Suchen, z. B. Feldgasse" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Archiv durchsuchen" style={{ marginBottom: 16 }} />
      {zeilen.length === 0 ? <p className="leise">Keine Einträge.</p> : (
        <table className="tabelle">
          <thead><tr><th>Sitzung</th><th>TOP</th><th>Linie</th><th>GFG stimmte</th><th>Ergebnis</th></tr></thead>
          <tbody>
            {zeilen.map((t) => (
              <tr key={t.g.id + t.key}>
                <td className="nowrap"><a href={`#grsitzung-${t.g.id}`}>{datumKurz(t.g.datum)}</a></td>
                <td><b>{t.nr ? `${t.nr}. ` : ''}{t.titel}</b>{t.begruendung && <div className="leise klein">{t.begruendung}</div>}</td>
                <td><Linie wert={t.linie} /></td>
                <td>{t.abgestimmt || <span className="leise">nicht erfasst</span>}</td>
                <td>{t.ergebnis || <span className="leise">offen</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Verwaltung() {
  const { daten, google, oeffne, config, mutate, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const mitglieder = [...(daten.mitglieder || [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const mitMail = mitglieder.filter((m) => m.email).length;
  return (
    <>
      <section>
        <h2 style={{ marginBottom: 12 }}>Einstellungen</h2>
        <Einstellungen />
      </section>

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
            <ul style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
              <li>Nach Ablauf der Einreichfrist wird die Tagesordnung festgelegt, als Google Doc gespeichert und an alle gemailt.</li>
              <li>7 Tage und 1 Tag vorher geht eine Erinnerung per Mail raus.</li>
              <li>Themen aus dem <a href={config.jotformThemenUrl} target="_blank" rel="noreferrer">Jotform-Formular</a> werden übernommen{config.jotformAktiv ? '' : ', sobald JOTFORM_API_KEY eingetragen ist'}.</li>
            </ul>
            {config.jotformAktiv && (
              <button className="knopf zweit klein" disabled={busy} onClick={async () => {
                setBusy(true);
                try { const r = await mutate('jotform.abrufen', {}); toast(r.neu ? `${r.neu} neue Themen übernommen` : 'Keine neuen Formular-Einreichungen'); } catch (e) { toast(e.message, true); }
                setBusy(false);
              }}>Formular jetzt abrufen</button>
            )}
            {config.jotformLetzterAbruf && <p className="leise mini" style={{ marginTop: 8 }}>Zuletzt abgerufen {zeitpunkt(config.jotformLetzterAbruf)}</p>}
          </div>
        </section>
      </div>

    </>
  );
}

export default function Gemeinderaete({ unter }) {
  const { me, laden, toast } = useApp();
  const [reiter, setReiter] = useState(unter || 'vorbereitung');
  if (!me.gr) return <Freischalten />;
  const REITER = [['vorbereitung', 'GR-Sitzungen'], ['archiv', 'Archiv'], ['verwaltung', 'Mitglieder und Einstellungen']];
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Gemeinderäte</h1>
        <button className="knopf still klein" onClick={async () => {
          await fetch('/api/gr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sperren: true }) });
          await laden(); toast('Gemeinderäte-Bereich gesperrt');
        }}><Icon n="schloss" size={16} />Bereich sperren</button>
      </div>
      <div className="unterreiter" role="tablist">
        {REITER.map(([k, l]) => <button key={k} role="tab" aria-selected={reiter === k} onClick={() => setReiter(k)}>{l}</button>)}
      </div>
      {reiter === 'vorbereitung' && <Vorbereitung />}
      {reiter === 'archiv' && <Archiv />}
      {reiter === 'verwaltung' && <Verwaltung />}
    </>
  );
}
