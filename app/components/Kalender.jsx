'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer } from './ui';
import { TERMIN_ARTEN, SITZUNGSARTEN, kalenderEintraege, monatTitel, wochentagKurz, wienTag } from '@/lib/domain';

const SITZUNG = 'Sitzung der GFG';
const NEU_ARTEN = [SITZUNG, 'Gemeinderatssitzung', 'Ausschusssitzung', 'Veranstaltung', 'Frist', 'Sonstiges'];

function TerminDialog({ t, vorschlagArt }) {
  const { mutate, schliesse, bestaetige, toast, config } = useApp();
  const [f, setF] = useState({
    titel: t?.titel || '', art: t?.art || vorschlagArt || SITZUNG, sitzungsart: 'Fraktionssitzung', datum: t?.datum || '',
    uhrzeit: t?.uhrzeit || '', ort: t?.ort || '', notiz: t?.notiz || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fraktion = !t && f.art === SITZUNG;
  const gr = !t && f.art === 'Gemeinderatssitzung';
  const arten = t ? TERMIN_ARTEN : NEU_ARTEN;
  return (
    <DialogForm
      titel={t ? 'Termin bearbeiten' : 'Termin eintragen'}
      knopf={fraktion ? 'Sitzung anlegen' : gr ? 'Gemeinderatssitzung anlegen' : 'Termin speichern'}
      onClose={schliesse}
      onSubmit={async () => {
        if (fraktion) {
          const r = await mutate('sitzung.speichern', { art: f.sitzungsart, titel: f.titel, datum: f.datum, uhrzeit: f.uhrzeit || '19:00', ort: f.ort, notiz: f.notiz, fristTage: config.fristTage ?? 3, dauerMin: 120 }, 'Sitzung angelegt');
          if (r.google === 'ok') toast('Gespeichert, Kalendereinladung ist raus');
          else if (r.google === 'fehler') toast(`Gespeichert, aber die Kalendereinladung ging nicht: ${r.googleFehler}`, true);
          window.location.hash = `sitzung-${r.id}`;
        } else if (gr) {
          const r = await mutate('grsitzung.speichern', { titel: f.titel || 'Gemeinderatssitzung', datum: f.datum, uhrzeit: f.uhrzeit, ort: f.ort, notiz: f.notiz }, 'Gemeinderatssitzung angelegt');
          window.location.hash = `grsitzung-${r.id}`;
        } else {
          await mutate('termin.speichern', { ...f, id: t?.id }, 'Termin gespeichert');
        }
      }}
      gefahr={t && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Termin löschen?', t.titel)) { try { await mutate('termin.loeschen', { id: t.id }, 'Termin gelöscht'); } catch (e) { toast(e.message, true); } }
        }}>Löschen</button>
      )}>
      <Feld label="Art"><select value={f.art} onChange={set('art')}>{arten.map((a) => <option key={a}>{a}</option>)}</select></Feld>
      {fraktion && (
        <div className="feld-reihe">
          <Feld label="Art der Sitzung"><select value={f.sitzungsart} onChange={set('sitzungsart')}>{SITZUNGSARTEN.map((a) => <option key={a}>{a}</option>)}</select></Feld>
          <Feld label="Bezeichnung (optional)"><input value={f.titel} onChange={set('titel')} maxLength={120} placeholder={f.sitzungsart} /></Feld>
        </div>
      )}
      {!fraktion && (
        <Feld label={gr ? 'Bezeichnung' : 'Titel'}>
          <input value={f.titel} onChange={set('titel')} required={!gr} maxLength={160} placeholder={gr ? 'Gemeinderatssitzung' : 'z. B. Ausschuss Kultur und Veranstaltungen'} />
        </Feld>
      )}
      <div className="feld-reihe">
        <Feld label="Datum"><input type="date" value={f.datum} onChange={set('datum')} required /></Feld>
        <Feld label={fraktion ? 'Beginn' : 'Uhrzeit (optional)'}><input type="time" value={f.uhrzeit || (fraktion ? '19:00' : '')} onChange={set('uhrzeit')} required={fraktion} /></Feld>
      </div>
      <Feld label={fraktion ? 'Ort' : 'Ort (optional)'}><input value={f.ort} onChange={set('ort')} maxLength={160} /></Feld>
      <Feld label="Notiz (optional)"><textarea value={f.notiz} onChange={set('notiz')} maxLength={1000} style={{ minHeight: 70 }} /></Feld>
      {fraktion && <p className="hinweis info klein" style={{ marginBottom: 12 }}>Legt eine Sitzung an, zu der alle Themen einreichen können. Die Themen werden die Tagesordnung. Ist Google verbunden, bekommen alle Mitglieder sofort eine Kalendereinladung.</p>}
      {gr && <p className="hinweis info klein" style={{ marginBottom: 12 }}>Legt die Gemeinderatssitzung im Gemeinderäte-Bereich an. Dort tragt ihr danach die TOPs und die Abstimmungslinie ein. Vereinsmitglieder sehen im Kalender nur Datum und Ort.</p>}
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
