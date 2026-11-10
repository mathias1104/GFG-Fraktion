'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer } from './ui';
import { datumKurz, wienTag, zeitpunkt } from '@/lib/domain';

function AusschussDialog({ a }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({ name: a?.name || '', vorsitz: a?.vorsitz || '', vertreter: a?.vertreter || '', naechsteSitzung: a?.naechsteSitzung || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={a ? 'Ausschuss bearbeiten' : 'Ausschuss hinzufügen'} onClose={schliesse}
      onSubmit={() => mutate('ausschuss.speichern', { ...f, id: a?.id }, 'Ausschuss gespeichert')}
      gefahr={a && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Ausschuss entfernen?', `${a.name} wird aus der Liste entfernt. Die Berichte bleiben gespeichert.`, 'Entfernen')) {
            try { await mutate('ausschuss.loeschen', { id: a.id }, 'Ausschuss entfernt'); } catch (e) { toast(e.message, true); }
          }
        }}>Entfernen</button>
      )}>
      <Feld label="Name des Ausschusses"><input value={f.name} onChange={set('name')} required maxLength={120} /></Feld>
      <Feld label="Vorsitz"><input value={f.vorsitz} onChange={set('vorsitz')} maxLength={120} /></Feld>
      <Feld label="GFG-Vertreter"><input value={f.vertreter} onChange={set('vertreter')} maxLength={200} placeholder="z. B. GR Vorname Nachname" /></Feld>
      <Feld label="Nächste Ausschusssitzung"><input type="date" value={f.naechsteSitzung} onChange={set('naechsteSitzung')} /></Feld>
    </DialogForm>
  );
}

function BerichtDialog({ ausschuss, b }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({ datum: b?.datum || wienTag(), titel: b?.titel || '', text: b?.text || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={b ? 'Bericht bearbeiten' : `Bericht: ${ausschuss.name}`} onClose={schliesse} knopf="Bericht speichern"
      onSubmit={() => mutate('bericht.speichern', { ...f, id: b?.id, ausschussId: ausschuss.id }, 'Bericht gespeichert')}
      gefahr={b && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Bericht löschen?', 'Der Bericht wird endgültig entfernt.')) {
            try { await mutate('bericht.loeschen', { id: b.id }, 'Bericht gelöscht'); } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}>
      <div className="feld-reihe">
        <Feld label="Datum der Ausschusssitzung"><input type="date" value={f.datum} onChange={set('datum')} /></Feld>
        <Feld label="Kurztitel (optional)"><input value={f.titel} onChange={set('titel')} maxLength={160} /></Feld>
      </div>
      <Feld label="Was läuft im Ausschuss?" hinweis="Kurz und verständlich für alle in der Fraktion. Keine sensiblen Daten von Bürgerinnen und Bürgern.">
        <textarea value={f.text} onChange={set('text')} required maxLength={5000} style={{ minHeight: 150 }} />
      </Feld>
    </DialogForm>
  );
}

export default function Ausschuesse() {
  const { daten, me, oeffne } = useApp();
  const ausschuesse = [...(daten.ausschuesse || [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const berichte = daten.berichte || [];
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Ausschüsse und Berichte</h1>
        {me.gr && <button className="knopf zweit" onClick={() => oeffne(() => <AusschussDialog />)}><Icon n="plus" />Ausschuss hinzufügen</button>}
      </div>
      <p className="leise">Kurze Berichte unserer Vertreterinnen und Vertreter, damit alle wissen, was in den Ausschüssen läuft.</p>
      {ausschuesse.length === 0 && <div style={{ marginTop: 20 }}><Leer titel="Noch keine Ausschüsse eingetragen" /></div>}
      {ausschuesse.map((a) => {
        const liste = berichte.filter((b) => b.ausschussId === a.id).sort((x, y) => (y.datum || '').localeCompare(x.datum || '') || (y.erstelltAm || 0) - (x.erstelltAm || 0));
        return (
          <section key={a.id} className="ausschuss" aria-labelledby={`aus-${a.id}`}>
            <div className="ausschuss-kopf">
              <div>
                <h2 id={`aus-${a.id}`}>{a.name}</h2>
                <div className="zeile-meta">
                  {a.vorsitz && <span>Vorsitz: {a.vorsitz}</span>}
                  {a.vertreter && <span>Für die GFG: {a.vertreter}</span>}
                  {a.naechsteSitzung && <span className="etikett art-Ausschusssitzung">Nächste Sitzung {datumKurz(a.naechsteSitzung)}</span>}
                </div>
              </div>
              {me.gr && (
                <div className="knopfreihe">
                  <button className="knopf klein" onClick={() => oeffne(() => <BerichtDialog ausschuss={a} />)}><Icon n="plus" size={18} />Bericht</button>
                  <button className="knopf still klein" aria-label={`${a.name} bearbeiten`} onClick={() => oeffne(() => <AusschussDialog a={a} />)}><Icon n="stift" size={18} /></button>
                </div>
              )}
            </div>
            {liste.length === 0 ? <p className="leise klein" style={{ marginTop: 12 }}>Noch kein Bericht.</p> : liste.map((b) => (
              <article key={b.id} className="bericht">
                <div className="zeile-meta" style={{ marginTop: 0 }}>
                  <b style={{ color: 'var(--tinte)' }}>{datumKurz(b.datum)}{b.titel ? `: ${b.titel}` : ''}</b>
                  <span>{b.autorName}</span>
                  {me.gr && <button className="knopf still klein" onClick={() => oeffne(() => <BerichtDialog ausschuss={a} b={b} />)}>Bearbeiten</button>}
                </div>
                <p>{b.text}</p>
                {b.geaendertAm && <p className="leise mini">geändert {zeitpunkt(b.geaendertAm)}</p>}
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}
