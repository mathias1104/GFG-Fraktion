'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm } from './ui';
import { datumKurz, wienTag } from '@/lib/domain';

export function AufgabeZeile({ a, heute = wienTag(), loeschbar }) {
  const { mutate, toast, me, bestaetige, daten } = useApp();
  const [busy, setBusy] = useState(false);
  const erledigt = a.status === 'erledigt';
  const ueber = !erledigt && a.frist && a.frist < heute;
  const sitzung = (daten.sitzungen || []).find((s) => s.id === a.sitzungId);
  return (
    <li>
      <div className="zeile">
        <button
          className={`abhaken${erledigt ? ' an' : ''}`}
          aria-label={erledigt ? `${a.titel} wieder öffnen` : `${a.titel} als erledigt markieren`}
          aria-pressed={erledigt}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await mutate('aufgabe.status', { id: a.id, status: erledigt ? 'offen' : 'erledigt' }, erledigt ? 'Aufgabe wieder offen' : 'Aufgabe erledigt'); } catch (e) { toast(e.message, true); }
            setBusy(false);
          }}
        >{erledigt && <Icon n="check" size={16} />}</button>
        <div className="zeile-haupt">
          <div className="zeile-titel" style={erledigt ? { textDecoration: 'line-through', color: 'var(--grau)' } : undefined}>{a.titel}</div>
          <div className="zeile-meta">
            <span>{a.zustaendigName || 'niemand zugeteilt'}</span>
            {a.frist && <span className={ueber ? 'ueberfaellig' : ''}>{ueber ? 'überfällig seit ' : 'bis '}{datumKurz(a.frist)}</span>}
            {sitzung && <a href={`#protokoll-${sitzung.id}`}>Sitzung {datumKurz(sitzung.datum)}</a>}
          </div>
        </div>
        {loeschbar && me.gr && (
          <button className="knopf still klein" aria-label={`${a.titel} löschen`} onClick={async () => {
            if (await bestaetige('Aufgabe löschen?', `„${a.titel}“ wird endgültig entfernt.`)) {
              try { await mutate('aufgabe.loeschen', { id: a.id }, 'Aufgabe gelöscht'); } catch (e) { toast(e.message, true); }
            }
          }}><Icon n="x" size={18} /></button>
        )}
      </div>
    </li>
  );
}

export function AufgabeDialog({ sitzungId, punkt }) {
  const { mutate, schliesse, daten } = useApp();
  const mitglieder = [...(daten.mitglieder || [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const [titel, setTitel] = useState('');
  const [wer, setWer] = useState('');
  const [frei, setFrei] = useState('');
  const [frist, setFrist] = useState('');
  return (
    <DialogForm
      titel="Aufgabe festhalten"
      knopf="Aufgabe speichern"
      onClose={schliesse}
      onSubmit={async () => {
        const m = mitglieder.find((x) => x.id === wer);
        await mutate('aufgabe.speichern', {
          titel, frist, sitzungId, punktKey: punkt?.key, punktTitel: punkt?.titel,
          zustaendigId: m?.id || '', zustaendigName: m ? m.name : frei,
        }, 'Aufgabe gespeichert');
      }}
    >
      <Feld label="Was ist zu tun?"><input value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={200} /></Feld>
      <Feld label="Zuständig">
        <select value={wer} onChange={(e) => setWer(e.target.value)}>
          <option value="">Andere Person eintragen</option>
          {mitglieder.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Feld>
      {!wer && <Feld label="Name"><input value={frei} onChange={(e) => setFrei(e.target.value)} maxLength={80} /></Feld>}
      <Feld label="Frist" hinweis="Überfällige Aufgaben kommen automatisch auf die nächste Tagesordnung."><input type="date" value={frist} onChange={(e) => setFrist(e.target.value)} /></Feld>
    </DialogForm>
  );
}
