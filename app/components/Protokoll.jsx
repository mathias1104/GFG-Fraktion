'use client';
import { useState } from 'react';
import { useApp, Icon, Leer } from './ui';
import { aktuelleTagesordnung } from './Sitzungen';
import { protokollHtml, htmlZuText, datumKurz, zeitpunkt } from '@/lib/domain';

export default function Protokoll({ id }) {
  const { daten, me, google, googleAktion, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const s = (daten.sitzungen || []).find((x) => x.id === id);
  if (!s) return <><a className="zurueck" href="#sitzungen"><Icon n="zurueck" size={18} />Alle Sitzungen</a><Leer titel="Sitzung nicht gefunden" /></>;
  const { items } = aktuelleTagesordnung(s, daten);
  const html = protokollHtml(s, items, daten);
  const googleBereit = google?.eingerichtet && google?.verbunden;

  return (
    <>
      <a className="zurueck" href={`#sitzung-${s.id}`}><Icon n="zurueck" size={18} />Zur Sitzung</a>
      <div className="abschnitt-kopf">
        <h1>Protokoll vom {datumKurz(s.datum)}</h1>
        <span className={`etikett ${s.status === 'abgeschlossen' ? 'ton-gut' : 'ton-offen'}`}>{s.status === 'abgeschlossen' ? 'Sitzung beendet' : 'Entwurf, Sitzung läuft noch'}</span>
      </div>
      <div className="knopfreihe" style={{ margin: '6px 0 20px' }}>
        {me.gr && googleBereit && (
          <button className="knopf" disabled={busy} onClick={async () => {
            setBusy(true);
            const r = await googleAktion('protokoll', s.id);
            setBusy(false);
            if (r) toast('Protokoll in Google Drive gespeichert');
          }}><Icon n="doc" size={18} />{busy ? 'Speichert …' : s.protokollDocUrl ? 'Neue Fassung in Drive speichern' : 'In Google Drive speichern'}</button>
        )}
        {s.protokollDocUrl && <a className="knopf zweit" href={s.protokollDocUrl} target="_blank" rel="noreferrer"><Icon n="link" size={18} />Google Doc öffnen</a>}
        <button className="knopf zweit" onClick={async () => {
          try { await navigator.clipboard.writeText(htmlZuText(html)); toast('Protokoll kopiert'); } catch { toast('Kopieren ging nicht. Bitte Text markieren.', true); }
        }}>Als Text kopieren</button>
        {me.gr && <a className="knopf still" href={`#modus-${s.id}`}>Im Sitzungsmodus nachtragen</a>}
      </div>
      {me.gr && !googleBereit && <p className="hinweis info klein" style={{ marginBottom: 16 }}>Zum Speichern in Google Drive im Reiter <a href="#gemeinderaete">Gemeinderäte</a> ein Google-Konto verbinden.</p>}
      {s.protokollAm && <p className="leise mini" style={{ marginBottom: 12 }}>Zuletzt in Drive gespeichert am {zeitpunkt(s.protokollAm)}.</p>}
      {/* eslint-disable-next-line react/no-danger */}
      <article className="protokoll" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
