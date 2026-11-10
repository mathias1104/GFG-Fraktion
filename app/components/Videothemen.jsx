'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, Segment, DialogForm, Dialog, Leer, Dringlichkeit } from './ui';
import { VIDEO_STATUS, VIDEO_TON, ORTSTEILE, DRINGLICHKEIT, zeitpunkt } from '@/lib/domain';
import { Kommentare } from './Antraege';

export const stimmenZahl = (v) => Object.keys(v.stimmen || {}).length;

function VideoStatus({ status }) {
  return <span className={`etikett ton-${VIDEO_TON[status] || 'leise'}`}>{status}</span>;
}

/** Bild im Browser verkleinern (max. 1280 px, JPEG), damit es klein in die Datenbank passt */
function verkleinere(datei) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(datei);
    img.onload = () => {
      const max = 1280;
      const f = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * f);
      c.height = Math.round(img.height * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = 0.78;
      let d = c.toDataURL('image/jpeg', q);
      while (d.length > 650000 && q > 0.35) { q -= 0.12; d = c.toDataURL('image/jpeg', q); }
      resolve(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Das Bild konnte nicht gelesen werden.')); };
    img.src = url;
  });
}

const fotoSrc = (f) => (f.startsWith('data:') ? f : `/api/foto/${f}`);

export function VideoDialog({ v }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({
    titel: v?.titel || '', beschreibung: v?.beschreibung || '', ortsteil: v?.ortsteil || '',
    dringlichkeit: v?.dringlichkeit || 'mittel', links: v?.links?.length ? v.links : [''], fotos: v?.fotos || [],
  });
  const [fehler, setFehler] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  return (
    <DialogForm
      titel={v ? 'Videothema bearbeiten' : 'Videothema vorschlagen'}
      knopf={v ? 'Änderungen speichern' : 'Thema vorschlagen'}
      onClose={schliesse}
      onSubmit={() => mutate('video.speichern', { ...f, id: v?.id, links: f.links.filter(Boolean) }, v ? 'Videothema gespeichert' : 'Danke! Markus sieht dein Thema jetzt.')}
      gefahr={v && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Videothema löschen?', `„${v.titel}“ samt Fotos und Stimmen wird gelöscht.`)) {
            try { await mutate('video.loeschen', { id: v.id }, 'Videothema gelöscht'); } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}
    >
      <Feld label="Titel"><input value={f.titel} onChange={set('titel')} required maxLength={140} /></Feld>
      <Feld label="Beschreibung" hinweis="Was soll Markus zeigen oder erklären? Bitte keine sensiblen Daten von Bürgerinnen und Bürgern.">
        <textarea value={f.beschreibung} onChange={set('beschreibung')} maxLength={2000} />
      </Feld>
      <Feld label="Ortsteil">
        <select value={f.ortsteil} onChange={set('ortsteil')}>
          <option value="">keine Angabe</option>
          {[...ORTSTEILE, 'alle Ortsteile'].map((o) => <option key={o}>{o}</option>)}
        </select>
      </Feld>
      <Segment name="vdr" label="Dringlichkeit" werte={DRINGLICHKEIT} wert={f.dringlichkeit} onChange={set('dringlichkeit')} />
      <div className="feld">
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Fotos (höchstens 3)</span>
        {f.fotos.length > 0 && (
          <div className="fotos">
            {f.fotos.map((foto, i) => (
              <figure key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoSrc(foto)} alt={`Foto ${i + 1}`} />
                <button type="button" aria-label={`Foto ${i + 1} entfernen`} onClick={() => setF((x) => ({ ...x, fotos: x.fotos.filter((_, j) => j !== i) }))}><Icon n="x" size={16} /></button>
              </figure>
            ))}
          </div>
        )}
        {f.fotos.length < 3 && (
          <input type="file" accept="image/*" multiple className="eingabe" aria-label="Fotos auswählen" onChange={async (e) => {
            setFehler('');
            const dateien = [...e.target.files].slice(0, 3 - f.fotos.length);
            e.target.value = '';
            try {
              const neu = [];
              for (const d of dateien) neu.push(await verkleinere(d));
              setF((x) => ({ ...x, fotos: [...x.fotos, ...neu].slice(0, 3) }));
            } catch (err) { setFehler(err.message); }
          }} />
        )}
        {fehler && <small className="warn">{fehler}</small>}
      </div>
      <div className="feld">
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Links (optional)</span>
        {f.links.map((l, i) => (
          <input key={i} className="eingabe" type="url" placeholder="https://" value={l} style={{ marginBottom: 8 }} aria-label={`Link ${i + 1}`}
            onChange={(e) => setF((x) => ({ ...x, links: x.links.map((y, j) => (j === i ? e.target.value : y)) }))} />
        ))}
        {f.links.length < 5 && <button type="button" className="knopf still klein" onClick={() => setF((x) => ({ ...x, links: [...x.links, ''] }))}><Icon n="plus" size={16} />Weiterer Link</button>}
      </div>
    </DialogForm>
  );
}

function StatusForm({ v }) {
  const { mutate, toast } = useApp();
  const [status, setStatus] = useState(v.status);
  const [post, setPost] = useState(v.postLink || '');
  const [busy, setBusy] = useState(false);
  return (
    <form className="flaeche" style={{ marginTop: 18 }} onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await mutate('video.status', { id: v.id, status, postLink: post }, 'Status gespeichert'); } catch (err) { toast(err.message, true); }
      setBusy(false);
    }}>
      <Feld label="Status">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>{VIDEO_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
      </Feld>
      {status === 'veröffentlicht' && <Feld label="Link zum Facebook-Post"><input type="url" value={post} onChange={(e) => setPost(e.target.value)} placeholder="https://www.facebook.com/…" /></Feld>}
      <button className="knopf klein" disabled={busy}>Status speichern</button>
    </form>
  );
}

function VideoDetail({ id }) {
  const { daten, me, schliesse, oeffne } = useApp();
  const v = (daten.videothemen || []).find((x) => x.id === id);
  if (!v) return null;
  return (
    <Dialog titel={v.titel} onClose={schliesse}>
      <div className="zeile-meta" style={{ marginTop: -6 }}>
        <VideoStatus status={v.status} /><Dringlichkeit wert={v.dringlichkeit} />
        {v.ortsteil && <span>{v.ortsteil}</span>}<span>{stimmenZahl(v)} Daumen hoch</span>
      </div>
      {v.beschreibung && <p style={{ whiteSpace: 'pre-wrap', marginTop: 14 }}>{v.beschreibung}</p>}
      {v.fotos?.length > 0 && (
        <div className="fotos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v.fotos.map((f) => <a key={f} href={fotoSrc(f)} target="_blank" rel="noreferrer"><img src={fotoSrc(f)} alt="Foto zum Videothema" /></a>)}
        </div>
      )}
      {v.links?.length > 0 && <div className="verweise">{v.links.map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer"><Icon n="link" size={18} />Link {i + 1}</a>)}</div>}
      {v.postLink && <p style={{ marginTop: 14 }}><a className="knopf klein" href={v.postLink} target="_blank" rel="noreferrer">Zum Facebook-Post</a></p>}
      <p className="leise mini" style={{ marginTop: 14 }}>Vorgeschlagen von {v.autorName}, {zeitpunkt(v.erstelltAm)}{v.statusVon ? `. Status zuletzt von ${v.statusVon}` : ''}</p>
      {me.gr && <StatusForm v={v} />}
      {(me.gr || v.autorId === me.uid) && (
        <div className="dialog-fuss" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
          <button className="knopf zweit klein" onClick={() => oeffne(() => <VideoDialog v={v} />)}><Icon n="stift" size={16} />Bearbeiten</button>
        </div>
      )}
      <Kommentare bezug={`video:${v.id}`} />
    </Dialog>
  );
}

export function DaumenKnopf({ v }) {
  const { me, mutate, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const an = !!(v.stimmen || {})[me.uid];
  return (
    <button className="daumen" aria-pressed={an} disabled={busy} aria-label={`${an ? 'Daumen zurücknehmen' : 'Daumen hoch'} für ${v.titel}, bisher ${stimmenZahl(v)}`}
      onClick={async (e) => {
        e.stopPropagation(); setBusy(true);
        try { await mutate('video.stimme', { id: v.id, an: !an }); } catch (err) { toast(err.message, true); }
        setBusy(false);
      }}>
      <Icon n="daumen" size={20} />{stimmenZahl(v)}
    </button>
  );
}

export function VideoZeile({ v }) {
  const { oeffne } = useApp();
  return (
    <li>
      <div className="zeile">
        <DaumenKnopf v={v} />
        <button className="zeile-haupt" style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }} onClick={() => oeffne(() => <VideoDetail id={v.id} />)}>
          <span className="zeile-titel">{v.titel}</span>
          <span className="zeile-meta">
            <VideoStatus status={v.status} />
            {v.dringlichkeit === 'hoch' && <Dringlichkeit wert="hoch" />}
            {v.ortsteil && <span>{v.ortsteil}</span>}
            <span>von {v.autorName}</span>
          </span>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.fotos?.[0] && <img className="vorschau" src={fotoSrc(v.fotos[0])} alt="" />}
      </div>
    </li>
  );
}

export default function Videothemen() {
  const { daten, oeffne } = useApp();
  const [filter, setFilter] = useState('offen');
  const alle = daten.videothemen || [];
  const liste = alle
    .filter((v) => (filter === 'offen' ? v.status !== 'veröffentlicht' : filter === 'alle' ? true : v.status === filter))
    .sort((a, b) => stimmenZahl(b) - stimmenZahl(a) || (b.erstelltAm || 0) - (a.erstelltAm || 0));
  const filterListe = [['offen', 'Noch nicht veröffentlicht'], ...VIDEO_STATUS.map((s) => [s, s]), ['alle', 'Alle']];
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Themen für Markus' Videos</h1>
        <button className="knopf" onClick={() => oeffne(() => <VideoDialog />)}><Icon n="plus" />Thema vorschlagen</button>
      </div>
      <p className="leise" style={{ marginBottom: 18 }}>Vorschläge für die Facebook-Videos von Markus Haindl. Gib Daumen hoch, damit Markus sieht, was die Fraktion am meisten interessiert.</p>
      <div className="chips" role="group" aria-label="Nach Status filtern">
        {filterListe.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {liste.length === 0 ? (
        <Leer titel={alle.length ? 'Keine Themen in dieser Auswahl' : 'Noch keine Videothemen'} text={alle.length ? 'Wähle einen anderen Filter.' : 'Schlag das erste Thema vor.'} />
      ) : <ul className="liste">{liste.map((v) => <VideoZeile key={v.id} v={v} />)}</ul>}
    </>
  );
}
