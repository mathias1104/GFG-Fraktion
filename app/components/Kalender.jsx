'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer } from './ui';
import { TERMIN_ARTEN, kalenderEintraege, monatTitel, wochentagKurz, wienTag } from '@/lib/domain';

function TerminDialog({ t }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({ titel: t?.titel || '', art: t?.art || 'Gemeinderatssitzung', datum: t?.datum || '', uhrzeit: t?.uhrzeit || '', ort: t?.ort || '', notiz: t?.notiz || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={t ? 'Termin bearbeiten' : 'Termin eintragen'} onClose={schliesse}
      onSubmit={() => mutate('termin.speichern', { ...f, id: t?.id }, 'Termin gespeichert')}
      gefahr={t && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Termin löschen?', t.titel)) { try { await mutate('termin.loeschen', { id: t.id }, 'Termin gelöscht'); } catch (e) { toast(e.message, true); } }
        }}>Löschen</button>
      )}>
      <Feld label="Titel"><input value={f.titel} onChange={set('titel')} required maxLength={160} placeholder="z. B. Ausschuss Kultur und Veranstaltungen" /></Feld>
      <Feld label="Art"><select value={f.art} onChange={set('art')}>{TERMIN_ARTEN.map((a) => <option key={a}>{a}</option>)}</select></Feld>
      <div className="feld-reihe">
        <Feld label="Datum"><input type="date" value={f.datum} onChange={set('datum')} required /></Feld>
        <Feld label="Uhrzeit (optional)"><input type="time" value={f.uhrzeit} onChange={set('uhrzeit')} /></Feld>
      </div>
      <Feld label="Ort (optional)"><input value={f.ort} onChange={set('ort')} maxLength={160} /></Feld>
      <Feld label="Notiz (optional)"><textarea value={f.notiz} onChange={set('notiz')} maxLength={1000} style={{ minHeight: 70 }} /></Feld>
      {f.art === 'Gemeinderatssitzung' && <p className="hinweis info klein" style={{ marginBottom: 12 }}>Tipp: Für die Vorbereitung mit Tagesordnung und Abstimmungslinie legst du die Gemeinderatssitzung im Reiter Gemeinderäte an. Sie erscheint dann automatisch hier.</p>}
    </DialogForm>
  );
}

export default function Kalender() {
  const { daten, me, oeffne } = useApp();
  const [vergangen, setVergangen] = useState(false);
  const [art, setArt] = useState('');
  const heute = wienTag();
  const alle = kalenderEintraege(daten).filter((e) => !art || e.art === art);
  const liste = vergangen ? alle.filter((e) => e.tag < heute).reverse() : alle.filter((e) => e.tag >= heute);
  const monate = [];
  for (const e of liste) {
    const m = e.tag.slice(0, 7);
    if (!monate.length || monate[monate.length - 1].m !== m) monate.push({ m, eintraege: [] });
    monate[monate.length - 1].eintraege.push(e);
  }
  const arten = ['Fraktionssitzung', ...TERMIN_ARTEN];
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Kalender</h1>
        {me.gr && <button className="knopf" onClick={() => oeffne(() => <TerminDialog />)}><Icon n="plus" />Termin eintragen</button>}
      </div>
      <p className="leise" style={{ marginBottom: 18 }}>Gemeinderatssitzungen, Ausschusssitzungen, Fraktionssitzungen, Veranstaltungen und Fristen auf einen Blick.</p>
      <div className="chips" role="group" aria-label="Termine filtern">
        <button aria-pressed={!vergangen} onClick={() => setVergangen(false)}>Kommende</button>
        <button aria-pressed={vergangen} onClick={() => setVergangen(true)}>Vergangene</button>
        <span style={{ width: 10 }} />
        <button aria-pressed={!art} onClick={() => setArt('')}>Alle Arten</button>
        {arten.map((a) => <button key={a} aria-pressed={art === a} onClick={() => setArt(a)}>{a}</button>)}
      </div>
      {monate.length === 0 && <Leer titel={vergangen ? 'Keine vergangenen Termine' : 'Keine kommenden Termine'} text={me.gr ? 'Mit „Termin eintragen“ füllst du den Kalender.' : 'Termine tragen die Gemeinderäte ein.'} />}
      {monate.map(({ m, eintraege }) => (
        <section key={m} className="kal-monat">
          <h2>{monatTitel(m)}</h2>
          {eintraege.map((e) => {
            const inhalt = (
              <>
                <span className={`kal-tag${e.tag === heute ? ' heute' : ''}`}><span>{wochentagKurz(e.tag)}</span><b>{Number(e.tag.slice(8))}</b></span>
                <span>
                  <span className="zeile-titel" style={{ display: 'block' }}>{e.titel}</span>
                  <span className="zeile-meta">
                    <span className={`etikett art-${e.art}`}>{e.art}</span>
                    {e.zeit && <span>{e.zeit} Uhr</span>}
                    {e.ort && <span>{e.ort}</span>}
                    {e.notiz && <span>{e.notiz}</span>}
                  </span>
                </span>
              </>
            );
            if (e.href) return <a key={e.id} className="kal-eintrag" href={e.href}>{inhalt}</a>;
            if (e.termin && me.gr) return <button key={e.id} className="kal-eintrag" onClick={() => oeffne(() => <TerminDialog t={e.termin} />)}>{inhalt}</button>;
            return <div key={e.id} className="kal-eintrag" style={{ cursor: 'default' }}>{inhalt}</div>;
          })}
        </section>
      ))}
    </>
  );
}
