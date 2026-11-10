'use client';
import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { useApp, Icon } from './ui';
import { zeitpunkt } from '@/lib/domain';

const NAME_SICHER = (n) => String(n || 'datei').normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'datei';

/** Lädt eine Datei hoch: auf Vercel direkt in den privaten Speicher, lokal über den Server */
export async function ladeHoch(datei, bereich, modus, fortschritt) {
  if (datei.size > 100 * 1024 * 1024) throw new Error(`${datei.name} ist größer als 100 MB.`);
  if (modus === 'blob') {
    const r = await upload(`${bereich}/${NAME_SICHER(datei.name)}`, datei, {
      access: 'private', handleUploadUrl: '/api/datei/token', multipart: datei.size > 5e6,
      contentType: datei.type || undefined,
      onUploadProgress: fortschritt ? (e) => fortschritt(e.percentage) : undefined,
    });
    return { pfad: r.pathname, name: datei.name, groesse: datei.size, typ: datei.type || r.contentType };
  }
  const fd = new FormData();
  fd.append('datei', datei);
  fd.append('bereich', bereich);
  const r = await fetch('/api/datei', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fehler || `${datei.name} konnte nicht hochgeladen werden.`);
  return { pfad: j.pfad, name: j.name, groesse: j.groesse, typ: j.typ };
}

export const dateiUrl = (d, download) => `/api/datei?p=${encodeURIComponent(d.pfad)}&n=${encodeURIComponent(d.name || '')}${download ? '&dl=1' : ''}`;
export const groesse = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);
export const istBild = (d) => /^image\//.test(d.typ || '') || /\.(jpe?g|png|webp|heic)$/i.test(d.name || '');
export const lesbar = (d) => /pdf|word|text\/plain/.test(d.typ || '') || /\.(pdf|docx|txt)$/i.test(d.name || '');

/** Ablagefläche: hineinziehen oder auswählen, mehrere Dateien auf einmal */
export function Ablage({ bereich, onFertig, text = 'Dateien hierher ziehen oder auswählen', hinweis, accept, mehrere = true, kompakt }) {
  const { config, toast } = useApp();
  const input = useRef(null);
  const [ueber, setUeber] = useState(false);
  const [laeuft, setLaeuft] = useState(null);
  const verarbeite = async (liste) => {
    const dateien = [...liste];
    if (!dateien.length) return;
    const fertig = [];
    for (const [i, d] of dateien.entries()) {
      setLaeuft({ name: d.name, nr: i + 1, von: dateien.length, prozent: 0 });
      try {
        fertig.push(await ladeHoch(d, bereich, config.dateiModus, (p) => setLaeuft((x) => ({ ...x, prozent: Math.round(p) }))));
      } catch (e) { toast(e.message || `${d.name} konnte nicht hochgeladen werden.`, true); }
    }
    setLaeuft(null);
    if (input.current) input.current.value = '';
    if (fertig.length) await onFertig(fertig);
  };
  return (
    <div className={`ablage${ueber ? ' ueber' : ''}${kompakt ? ' kompakt' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)}
      onDrop={(e) => { e.preventDefault(); setUeber(false); if (!laeuft) verarbeite(e.dataTransfer.files); }}>
      <input ref={input} type="file" multiple={mehrere} accept={accept} hidden onChange={(e) => verarbeite(e.target.files)} />
      {laeuft ? (
        <div className="ablage-lauf" aria-live="polite">
          <span>{laeuft.von > 1 ? `${laeuft.nr} von ${laeuft.von}: ` : ''}{laeuft.name}</span>
          <span className="balken"><span style={{ width: `${laeuft.prozent || 8}%` }} /></span>
        </div>
      ) : (
        <button type="button" className="ablage-knopf" onClick={() => input.current?.click()}>
          <Icon n="hochladen" size={kompakt ? 18 : 24} />
          <span><b>{text}</b>{hinweis && <span className="leise klein">{hinweis}</span>}</span>
        </button>
      )}
    </div>
  );
}

/** Liste abgelegter Dateien mit Öffnen, Entfernen und optionaler Zusatzaktion */
export function DateiListe({ dateien, onEntfernen, aktion }) {
  const { bestaetige } = useApp();
  if (!dateien?.length) return null;
  return (
    <ul className="dateien">
      {dateien.map((d) => (
        <li key={d.pfad}>
          <a href={dateiUrl(d)} target="_blank" rel="noreferrer" className="datei-name">
            <Icon n={istBild(d) ? 'bild' : 'doc'} size={20} />
            <span><b>{d.name}</b><span className="leise mini">{groesse(d.groesse || 0)}{d.von ? `, ${d.von}` : ''}{d.am ? `, ${zeitpunkt(d.am)}` : ''}</span></span>
          </a>
          {aktion?.(d)}
          {onEntfernen && (
            <button type="button" className="knopf still klein" aria-label={`${d.name} entfernen`} onClick={async () => {
              if (await bestaetige('Datei entfernen?', d.name, 'Entfernen')) onEntfernen(d);
            }}><Icon n="papierkorb" size={18} /></button>
          )}
        </li>
      ))}
    </ul>
  );
}
