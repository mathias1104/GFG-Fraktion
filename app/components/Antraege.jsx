'use client';
import { useMemo, useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer, Status } from './ui';
import { ARTEN, STATUS, datumKurz, zeitpunkt, wienTag, STANDARD_AUSSCHUESSE, UMSETZUNG, letzteNeuigkeit } from '@/lib/domain';

function AntragDialog({ antrag }) {
  const { mutate, schliesse, config, bestaetige, toast, daten } = useApp();
  const [f, setF] = useState({
    titel: antrag?.titel || '', art: antrag?.art || 'Antrag', einbringer: antrag?.einbringer || '',
    datum: antrag?.datum || '', grSitzung: antrag?.grSitzung || '', top: antrag?.top || '', ausschuss: antrag?.ausschuss || '',
    notizen: antrag?.notizen || '', status: 'Idee', umsetzung: antrag?.umsetzung || '', grSitzungId: antrag?.grSitzungId || '',
    andere: !!antrag?.vonAnderen, vaDatum: antrag?.vonAnderen?.datum || '', vaWer: antrag?.vonAnderen?.wer || '', vaNotiz: antrag?.vonAnderen?.notiz || '',
    dokumente: antrag?.dokumente?.length ? antrag.dokumente : [{ titel: '', url: '' }],
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ausschuesse = [...new Set([...(daten.ausschuesse || []).map((a) => a.name), ...(config.ausschuesse?.length ? config.ausschuesse : STANDARD_AUSSCHUESSE)])];
  return (
    <DialogForm
      titel={antrag ? 'Antrag bearbeiten' : 'Neuer Antrag'}
      knopf={antrag ? 'Änderungen speichern' : 'Antrag anlegen'}
      onClose={schliesse}
      onSubmit={async () => {
        const vonAnderen = f.andere ? { datum: f.vaDatum, wer: f.vaWer, notiz: f.vaNotiz } : null;
        const r = await mutate('antrag.speichern', { ...f, id: antrag?.id, vonAnderen, dokumente: f.dokumente.filter((d) => d.url) }, 'Antrag gespeichert');
        if (!antrag) window.location.hash = `antrag-${r.id}`;
      }}
      gefahr={antrag && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Antrag löschen?', `„${antrag.titel}“ samt Verlauf wird endgültig gelöscht.`)) {
            try { await mutate('antrag.loeschen', { id: antrag.id }, 'Antrag gelöscht'); window.location.hash = 'antraege'; } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}
    >
      <Feld label="Titel"><input value={f.titel} onChange={set('titel')} required maxLength={200} /></Feld>
      <div className="feld-reihe">
        <Feld label="Art"><select value={f.art} onChange={set('art')}>{ARTEN.map((a) => <option key={a}>{a}</option>)}</select></Feld>
        {!antrag && <Feld label="Status"><select value={f.status} onChange={set('status')}>{STATUS.map((a) => <option key={a}>{a}</option>)}</select></Feld>}
        <Feld label="Datum"><input type="date" value={f.datum.length === 10 ? f.datum : ''} onChange={set('datum')} /></Feld>
      </div>
      <Feld label="Einbringer"><input value={f.einbringer} onChange={set('einbringer')} maxLength={200} placeholder="z. B. GR Vorname Nachname" /></Feld>
      <div className="feld-reihe">
        <Feld label="Gemeinderatssitzung"><input value={f.grSitzung} onChange={set('grSitzung')} maxLength={120} placeholder="z. B. GR-Sitzung 12.10.2026" /></Feld>
        <Feld label="TOP"><input value={f.top} onChange={set('top')} maxLength={20} /></Feld>
      </div>
      <Feld label="Zuständiger Ausschuss">
        <input value={f.ausschuss} onChange={set('ausschuss')} list="ausschuesse" maxLength={120} />
        <datalist id="ausschuesse">{ausschuesse.map((a) => <option key={a} value={a} />)}</datalist>
      </Feld>
      <div className="feld">
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Dokumente (Drive-Links)</span>
        {f.dokumente.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8, marginBottom: 8 }}>
            <input className="eingabe" placeholder="Bezeichnung" value={d.titel} aria-label="Bezeichnung des Dokuments"
              onChange={(e) => setF((x) => ({ ...x, dokumente: x.dokumente.map((y, j) => (j === i ? { ...y, titel: e.target.value } : y)) }))} />
            <input className="eingabe" type="url" placeholder="https://drive.google.com/…" value={d.url} aria-label="Link zum Dokument"
              onChange={(e) => setF((x) => ({ ...x, dokumente: x.dokumente.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) }))} />
          </div>
        ))}
        <button type="button" className="knopf still klein" onClick={() => setF((x) => ({ ...x, dokumente: [...x.dokumente, { titel: '', url: '' }] }))}><Icon n="plus" size={16} />Weiteres Dokument</button>
      </div>
      <Feld label="Umsetzung" hinweis="Für die Bilanz: Was ist nach dem Beschluss passiert?">
        <select value={f.umsetzung} onChange={set('umsetzung')}>{UMSETZUNG.map((u) => <option key={u} value={u}>{u || 'nicht erfasst'}</option>)}</select>
      </Feld>
      <label className="schalter-zeile" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={f.andere} onChange={(e) => setF((x) => ({ ...x, andere: e.target.checked }))} />
        <span>Von anderen umgesetzt <span className="leise klein">(unser Antrag wurde abgelehnt oder ersetzt, die Sache aber trotzdem gemacht)</span></span>
      </label>
      {f.andere && (
        <div className="flaeche" style={{ padding: 14, marginBottom: 16 }}>
          <div className="feld-reihe">
            <Feld label="Wann"><input type="date" value={f.vaDatum.length === 10 ? f.vaDatum : ''} onChange={set('vaDatum')} /></Feld>
            <Feld label="Von wem"><input value={f.vaWer} onChange={set('vaWer')} maxLength={120} placeholder="z. B. Bürgermeister (ÖVP)" /></Feld>
          </div>
          <Feld label="Was wurde gemacht"><textarea value={f.vaNotiz} onChange={set('vaNotiz')} maxLength={1000} style={{ minHeight: 70 }} /></Feld>
        </div>
      )}
      <Feld label="Notizen"><textarea value={f.notizen} onChange={set('notizen')} maxLength={4000} /></Feld>
    </DialogForm>
  );
}

function StatusDialog({ antrag }) {
  const { mutate, schliesse } = useApp();
  const [status, setStatus] = useState(antrag.status);
  const [datum, setDatum] = useState(wienTag());
  const [notiz, setNotiz] = useState('');
  const [umsetzung, setUmsetzung] = useState(antrag.umsetzung || '');
  return (
    <DialogForm titel="Neuigkeit eintragen" knopf="Speichern" onClose={schliesse}
      onSubmit={() => mutate('antrag.status', { id: antrag.id, status, datum, notiz, umsetzung }, 'Neuigkeit gespeichert')}>
      <p className="leise klein" style={{ marginTop: -8, marginBottom: 14 }}>{antrag.titel}</p>
      <Feld label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map((a) => <option key={a}>{a}</option>)}</select></Feld>
      <Feld label="Umsetzung"><select value={umsetzung} onChange={(e) => setUmsetzung(e.target.value)}>{UMSETZUNG.map((u) => <option key={u} value={u}>{u || 'nicht erfasst'}</option>)}</select></Feld>
      <Feld label="Datum des Ereignisses"><input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></Feld>
      <Feld label="Was ist passiert?" hinweis="Kommt mit Datum in den Verlauf. Die Bilanz zählt ab hier neu, wie lange nichts passiert ist.">
        <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={1000} style={{ minHeight: 80 }} />
      </Feld>
    </DialogForm>
  );
}

export function AntraegeListe() {
  const { daten, me, oeffne, config } = useApp();
  const [q, setQ] = useState('');
  const [art, setArt] = useState('');
  const [status, setStatus] = useState('');
  const [ausschuss, setAusschuss] = useState('');
  const alle = daten.antraege || [];
  const ausschuesse = useMemo(() => [...new Set([...(daten.ausschuesse || []).map((a) => a.name), ...(config.ausschuesse || []), ...alle.map((a) => a.ausschuss).filter(Boolean)])], [alle, config.ausschuesse, daten.ausschuesse]);
  const treffer = alle
    .filter((a) => !art || a.art === art)
    .filter((a) => !status || a.status === status)
    .filter((a) => !ausschuss || a.ausschuss === ausschuss)
    .filter((a) => {
      if (!q.trim()) return true;
      const t = `${a.titel} ${a.einbringer} ${a.notizen} ${a.grSitzung} ${a.ausschuss}`.toLowerCase();
      return q.toLowerCase().split(/\s+/).every((w) => t.includes(w));
    })
    .sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')) || (b.geaendertAm || 0) - (a.geaendertAm || 0));

  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Anträge und Anfragen</h1>
        {me.gr && <button className="knopf" onClick={() => oeffne(() => <AntragDialog />)}><Icon n="plus" />Neuer Antrag</button>}
      </div>
      <p className="leise" style={{ marginBottom: 18 }}>Alle Anträge, Anfragen und IFG-Informationsbegehren der GFG mit ihrem aktuellen Stand.</p>
      <div className="filter">
        <input className="eingabe suche" type="search" placeholder="Suchen nach Titel, Einbringer, Notiz" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Anträge durchsuchen" />
        <select className="eingabe" value={art} onChange={(e) => setArt(e.target.value)} aria-label="Nach Art filtern">
          <option value="">Alle Arten</option>{ARTEN.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="eingabe" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Nach Status filtern">
          <option value="">Alle Status</option>{STATUS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="eingabe" value={ausschuss} onChange={(e) => setAusschuss(e.target.value)} aria-label="Nach Ausschuss filtern">
          <option value="">Alle Ausschüsse</option>{ausschuesse.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <p className="leise klein" style={{ marginBottom: 8 }}>{treffer.length} von {alle.length}</p>
      {treffer.length === 0 ? <Leer titel="Nichts gefunden" text="Ändere die Suche oder setze die Filter zurück." /> : (
        <ul className="liste">
          {treffer.map((a) => (
            <li key={a.id}>
              <a className="zeile" href={`#antrag-${a.id}`}>
                <div className="zeile-haupt">
                  <div className="zeile-titel">{a.titel}</div>
                  <div className="zeile-meta">
                    <Status status={a.status} />
                    <span>{a.art}</span>
                    {a.datum && <span>{datumKurz(a.datum)}</span>}
                    {a.grSitzung && <span>{a.grSitzung}{a.top ? `, TOP ${a.top}` : ''}</span>}
                  </div>
                </div>
                <Icon n="weiter" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Kommentare({ bezug, titel = 'Kommentare' }) {
  const { daten, me, mutate, toast, bestaetige } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const liste = (daten.kommentare || []).filter((k) => k.bezug === bezug).sort((a, b) => a.am - b.am);
  return (
    <section className="abschnitt">
      <h2 style={{ marginBottom: 10 }}>{titel}</h2>
      {liste.length === 0 && <p className="leise">Noch keine Kommentare.</p>}
      {liste.map((k) => (
        <div key={k.id} className="kommentar">
          <div className="zeile-meta" style={{ marginTop: 0 }}>
            <b style={{ color: 'var(--tinte)' }}>{k.autorName}</b><span>{zeitpunkt(k.am)}</span>
            {(me.gr || k.autorId === me.uid) && <button className="knopf still klein" onClick={async () => {
              if (await bestaetige('Kommentar löschen?', k.text)) { try { await mutate('kommentar.loeschen', { id: k.id }, 'Kommentar gelöscht'); } catch (e) { toast(e.message, true); } }
            }}>Löschen</button>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{k.text}</p>
        </div>
      ))}
      <form style={{ marginTop: 14 }} onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        try { await mutate('kommentar.neu', { bezug, text }, 'Kommentar gespeichert'); setText(''); } catch (err) { toast(err.message, true); }
        setBusy(false);
      }}>
        <Feld label="Dein Kommentar"><textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} style={{ minHeight: 80 }} /></Feld>
        <button className="knopf" disabled={busy || !text.trim()}>Kommentar senden</button>
      </form>
    </section>
  );
}

export function AntragDetail({ id }) {
  const { daten, me, oeffne } = useApp();
  const a = (daten.antraege || []).find((x) => x.id === id);
  if (!a) return <><a className="zurueck" href="#antraege"><Icon n="zurueck" size={18} />Alle Anträge</a><Leer titel="Antrag nicht gefunden" /></>;
  const verlauf = [...(a.verlauf || [])].reverse();
  return (
    <>
      <a className="zurueck" href="#antraege"><Icon n="zurueck" size={18} />Alle Anträge</a>
      <h1>{a.titel}</h1>
      <div className="zeile-meta" style={{ marginTop: 10 }}>
        <Status status={a.status} />{a.umsetzung && <span className={`etikett ton-${a.umsetzung === 'umgesetzt' ? 'gut' : a.umsetzung === 'in Umsetzung' ? 'aktiv' : 'offen'}`}>{a.umsetzung}</span>}
        <span>{a.art}</span><span>letzte Neuigkeit {datumKurz(letzteNeuigkeit(a))}</span>
      </div>
      {a.vonAnderen && (
        <div className="hinweis info" style={{ marginTop: 16 }}>
          <b>Von anderen umgesetzt{a.vonAnderen.wer ? `: ${a.vonAnderen.wer}` : ''}{a.vonAnderen.datum ? `, ${datumKurz(a.vonAnderen.datum)}` : ''}.</b> {a.vonAnderen.notiz}
        </div>
      )}
      {me.gr && (
        <div className="knopfreihe" style={{ marginTop: 18 }}>
          <button className="knopf" onClick={() => oeffne(() => <StatusDialog antrag={a} />)}><Icon n="plus" size={18} />Neuigkeit eintragen</button>
          <button className="knopf zweit" onClick={() => oeffne(() => <AntragDialog antrag={a} />)}><Icon n="stift" size={18} />Bearbeiten</button>
        </div>
      )}
      <section className="abschnitt flaeche">
        <div className="felder">
          <div><span>Einbringer</span><b>{a.einbringer || 'nicht angegeben'}</b></div>
          <div><span>Datum</span><b>{datumKurz(a.datum) || 'nicht angegeben'}</b></div>
          <div><span>Gemeinderatssitzung und TOP</span><b>{a.grSitzungId && (daten.grsitzungen || []).some((g) => g.id === a.grSitzungId)
            ? <a href={`#grsitzung-${a.grSitzungId}`}>{a.grSitzung}{a.top ? `, TOP ${a.top}` : ''}</a>
            : <>{a.grSitzung || 'noch keine'}{a.top ? `, TOP ${a.top}` : ''}</>}</b></div>
          <div><span>Zuständiger Ausschuss</span><b>{a.ausschuss || 'keiner'}</b></div>
        </div>
        {a.dokumente?.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <span className="leise klein">Dokumente</span>
            <div className="verweise" style={{ marginTop: 4 }}>
              {a.dokumente.map((d, i) => <a key={i} href={d.url} target="_blank" rel="noreferrer"><Icon n="doc" size={18} />{d.titel}</a>)}
            </div>
          </div>
        )}
        {a.notizen && <div style={{ marginTop: 18 }}><span className="leise klein">Notizen</span><p style={{ whiteSpace: 'pre-wrap' }}>{a.notizen}</p></div>}
      </section>

      <div className="raster2">
        <section className="abschnitt">
          <h2 style={{ marginBottom: 14 }}>Verlauf</h2>
          <ol className="verlauf">
            {verlauf.map((v, i) => (
              <li key={i}>
                <div className="zeile-meta" style={{ marginTop: 0 }}><Status status={v.status} />{v.datum && <b style={{ color: 'var(--tinte)' }}>{datumKurz(v.datum)}</b>}</div>
                {v.notiz && <p style={{ marginTop: 4 }}>{v.notiz}</p>}
                <p className="leise mini" style={{ marginTop: 2 }}>{v.von === 'Übernahme' ? 'Aus den Sitzungsprotokollen übernommen' : `${v.von}, ${zeitpunkt(v.ts)}`}</p>
              </li>
            ))}
          </ol>
        </section>
        <Kommentare bezug={`antrag:${a.id}`} />
      </div>
    </>
  );
}
