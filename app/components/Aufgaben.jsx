'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm } from './ui';
import { datumKurz, wienTag } from '@/lib/domain';

export function AufgabeZeile({ a, heute = wienTag(), loeschbar, bearbeitbar }) {
  const { mutate, toast, me, bestaetige, daten, oeffne } = useApp();
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
        {bearbeitbar && me.gr && (
          <button className="knopf still klein" aria-label={`${a.titel} bearbeiten`} onClick={() => oeffne(() => <AufgabeDialog aufgabe={a} />)}><Icon n="stift" size={18} /></button>
        )}
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

export function AufgabeDialog({ sitzungId, punkt, aufgabe }) {
  const { mutate, schliesse, daten, bestaetige, toast } = useApp();
  const mitglieder = [...(daten.mitglieder || [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const [titel, setTitel] = useState(aufgabe?.titel || '');
  const [wer, setWer] = useState(aufgabe?.zustaendigId || '');
  const [frei, setFrei] = useState(aufgabe && !aufgabe.zustaendigId ? aufgabe.zustaendigName || '' : '');
  const [frist, setFrist] = useState(aufgabe?.frist || '');
  return (
    <DialogForm
      titel={aufgabe ? 'Aufgabe bearbeiten' : 'Aufgabe festhalten'}
      knopf="Aufgabe speichern"
      onClose={schliesse}
      onSubmit={async () => {
        const m = mitglieder.find((x) => x.id === wer);
        await mutate('aufgabe.speichern', {
          id: aufgabe?.id, titel, frist,
          sitzungId: aufgabe ? aufgabe.sitzungId : sitzungId,
          punktKey: aufgabe ? aufgabe.punktKey : punkt?.key, punktTitel: aufgabe ? aufgabe.punktTitel : punkt?.titel,
          zustaendigId: m?.id || '', zustaendigName: m ? m.name : frei,
        }, 'Aufgabe gespeichert');
      }}
      gefahr={aufgabe && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Aufgabe löschen?', `„${aufgabe.titel}“ wird endgültig entfernt.`)) {
            try { await mutate('aufgabe.loeschen', { id: aufgabe.id }, 'Aufgabe gelöscht'); } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}
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

export function AufgabenSeite() {
  const { daten, me, oeffne } = useApp();
  const [filter, setFilter] = useState('offen');
  const heute = wienTag();
  const alle = daten.aufgaben || [];
  const meine = (a) => a.zustaendigId === me.uid || a.zustaendigName === me.name;
  const liste = alle
    .filter((a) => (filter === 'offen' ? a.status !== 'erledigt' : filter === 'meine' ? meine(a) && a.status !== 'erledigt' : filter === 'ueberfaellig' ? a.status !== 'erledigt' && a.frist && a.frist < heute : a.status === 'erledigt'))
    .sort((a, b) => (filter === 'erledigt' ? (b.erledigtAm || 0) - (a.erledigtAm || 0) : (a.frist || '9999').localeCompare(b.frist || '9999')));
  const zahl = {
    offen: alle.filter((a) => a.status !== 'erledigt').length,
    meine: alle.filter((a) => meine(a) && a.status !== 'erledigt').length,
    ueberfaellig: alle.filter((a) => a.status !== 'erledigt' && a.frist && a.frist < heute).length,
    erledigt: alle.filter((a) => a.status === 'erledigt').length,
  };
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Aufgaben</h1>
        {me.gr && <button className="knopf" onClick={() => oeffne(() => <AufgabeDialog />)}><Icon n="plus" />Aufgabe anlegen</button>}
      </div>
      <p className="leise" style={{ marginBottom: 18 }}>Alle Aufgaben aus den Fraktionssitzungen. Überfällige kommen automatisch auf die nächste Tagesordnung.</p>
      <div className="chips" role="group" aria-label="Aufgaben filtern">
        {[['offen', 'Offen'], ['meine', 'Meine'], ['ueberfaellig', 'Überfällig'], ['erledigt', 'Erledigt']].map(([k, l]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} ({zahl[k]})</button>
        ))}
      </div>
      {liste.length === 0 ? <p className="leise">Keine Aufgaben in dieser Auswahl.</p> : (
        <ul className="liste">{liste.map((a) => <AufgabeZeile key={a.id} a={a} heute={heute} bearbeitbar />)}</ul>
      )}
    </>
  );
}
