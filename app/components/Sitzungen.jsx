'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, Segment, DialogForm, Leer, Ziel, Dringlichkeit } from './ui';
import { Kommentare } from './Antraege';
import {
  ZIELE, DRINGLICHKEIT, baueTagesordnung, summeMinuten, zeitplan, dauerText, datumLang, datumKurz,
  fristText, fristVorbei, sitzungStart, sitzungEnde, wienUhrzeit, zeitpunkt, sortiereThemen,
} from '@/lib/domain';

const DAUERN = [5, 10, 15, 20, 30, 45, 60];

// ---------- Dialoge ----------

export function ThemaDialog({ sitzung, thema }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({
    titel: thema?.titel || '', beschreibung: thema?.beschreibung || '', dauer: thema?.dauer || 10,
    ziel: thema?.ziel || 'Diskussion', dringlichkeit: thema?.dringlichkeit || 'mittel', link: thema?.link || '',
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  return (
    <DialogForm
      titel={thema ? 'Thema bearbeiten' : 'Thema einreichen'}
      knopf={thema ? 'Änderungen speichern' : 'Thema einreichen'}
      onClose={schliesse}
      onSubmit={() => mutate('thema.speichern', { ...f, id: thema?.id, sitzungId: sitzung.id }, thema ? 'Thema gespeichert' : 'Thema eingereicht')}
      gefahr={thema && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Thema löschen?', `„${thema.titel}“ wird von der Tagesordnung genommen.`)) {
            try { await mutate('thema.loeschen', { id: thema.id }, 'Thema gelöscht'); } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}
    >
      <p className="leise klein" style={{ marginTop: -8, marginBottom: 16 }}>
        Für die Sitzung am {datumKurz(sitzung.datum)}. Einreichen bis {fristText(sitzung)}.
      </p>
      <Feld label="Titel"><input value={f.titel} onChange={set('titel')} required maxLength={140} /></Feld>
      <Feld label="Kurzbeschreibung" hinweis="Worum geht es, was soll die Fraktion wissen oder entscheiden? Bitte keine sensiblen Daten von Bürgerinnen und Bürgern.">
        <textarea value={f.beschreibung} onChange={set('beschreibung')} maxLength={1500} />
      </Feld>
      <Segment name="ziel" label="Ziel" werte={ZIELE} wert={f.ziel} onChange={set('ziel')} />
      <Segment name="dringlichkeit" label="Dringlichkeit" werte={DRINGLICHKEIT} wert={f.dringlichkeit} onChange={set('dringlichkeit')} />
      <div className="feld-reihe">
        <Feld label="Geschätzte Dauer">
          <select value={f.dauer} onChange={(e) => set('dauer')(Number(e.target.value))}>
            {DAUERN.map((d) => <option key={d} value={d}>{d} Minuten</option>)}
          </select>
        </Feld>
        <Feld label="Link zu Unterlagen (optional)"><input type="url" value={f.link} onChange={set('link')} placeholder="https://" /></Feld>
      </div>
    </DialogForm>
  );
}

export function SitzungDialog({ sitzung }) {
  const { mutate, schliesse, config, toast } = useApp();
  const [f, setF] = useState({
    datum: sitzung?.datum || '', uhrzeit: sitzung?.uhrzeit || '19:00', dauerMin: sitzung?.dauerMin || 120,
    ort: sitzung?.ort || '', fristTage: sitzung?.fristTage ?? config.fristTage ?? 3, notiz: sitzung?.notiz || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm
      titel={sitzung ? 'Sitzung bearbeiten' : 'Fraktionssitzung anlegen'}
      knopf={sitzung ? 'Änderungen speichern' : 'Sitzung anlegen'}
      onClose={schliesse}
      onSubmit={async () => {
        const r = await mutate('sitzung.speichern', { ...f, id: sitzung?.id }, sitzung ? 'Sitzung gespeichert' : 'Sitzung angelegt');
        if (r.google === 'ok') toast('Gespeichert, Kalendereinladung ist raus');
        else if (r.google === 'fehler') toast(`Gespeichert, aber die Kalendereinladung ging nicht: ${r.googleFehler}`, true);
        if (!sitzung) window.location.hash = `sitzung-${r.id}`;
      }}
    >
      <div className="feld-reihe">
        <Feld label="Datum"><input type="date" value={f.datum} onChange={set('datum')} required /></Feld>
        <Feld label="Beginn"><input type="time" value={f.uhrzeit} onChange={set('uhrzeit')} required /></Feld>
      </div>
      <Feld label="Ort"><input value={f.ort} onChange={set('ort')} placeholder="z. B. Gasthaus, Vereinslokal, Online" maxLength={200} /></Feld>
      <div className="feld-reihe">
        <Feld label="Geplante Dauer">
          <select value={f.dauerMin} onChange={set('dauerMin')}>
            {[60, 90, 120, 150, 180].map((d) => <option key={d} value={d}>{dauerText(d)}</option>)}
          </select>
        </Feld>
        <Feld label="Einreichfrist">
          <select value={f.fristTage} onChange={set('fristTage')}>
            {[1, 2, 3, 4, 5, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'Tag' : 'Tage'} vorher</option>)}
          </select>
        </Feld>
      </div>
      <Feld label="Notiz (optional)"><textarea value={f.notiz} onChange={set('notiz')} maxLength={1000} style={{ minHeight: 70 }} /></Feld>
      {sitzung?.kalenderEventId && <p className="hinweis info" style={{ marginBottom: 12 }}>Ändern sich Datum, Uhrzeit oder Ort, wird der Kalendertermin bei allen automatisch aktualisiert.</p>}
    </DialogForm>
  );
}

function ZeitenDialog({ sitzung, items }) {
  const { mutate, schliesse } = useApp();
  const [liste, setListe] = useState(items.map((i) => ({ ...i })));
  const summe = summeMinuten(liste);
  return (
    <DialogForm titel="Zeiten anpassen" onClose={schliesse} knopf="Zeiten speichern"
      onSubmit={() => mutate('sitzung.agendaAnpassen', { id: sitzung.id, agenda: liste }, 'Zeiten gespeichert')}>
      {liste.map((it, i) => (
        <label key={it.key} style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span className="klein"><b>{i + 1}.</b> {it.titel}</span>
          <input className="eingabe" type="number" min="1" max="240" value={it.dauer} aria-label={`Minuten für ${it.titel}`}
            onChange={(e) => setListe((l) => l.map((x, j) => (j === i ? { ...x, dauer: Number(e.target.value) } : x)))} />
        </label>
      ))}
      <p style={{ margin: '14px 0' }}><b>Gesamt: {dauerText(summe)}</b> <span className="leise">(geplant {dauerText(Number(sitzung.dauerMin) || 120)})</span></p>
    </DialogForm>
  );
}

// ---------- Tagesordnung ----------

export function aktuelleTagesordnung(s, daten) {
  if (s.agenda?.length) return { items: s.agenda, fixiert: true };
  return { items: baueTagesordnung(s, daten), fixiert: false };
}

export function TagesordnungListe({ s, items }) {
  const plan = zeitplan(s, items);
  const summe = summeMinuten(items);
  const zuLang = summe > (Number(s.dauerMin) || 120);
  return (
    <>
      <ol className="to">
        {items.map((it, i) => (
          <li key={it.key}>
            <span className="to-nr">{i + 1}</span>
            <div>
              <div className="zeile-titel">{it.titel}</div>
              <div className="zeile-meta">
                <Ziel ziel={it.ziel} />
                {it.dringlichkeit && <Dringlichkeit wert={it.dringlichkeit} />}
                {it.einreicher && <span>von {it.einreicher}</span>}
                {it.nachtraeglich && <span className="etikett ton-offen">nachgereicht</span>}
                {it.link && <a href={it.link} target="_blank" rel="noreferrer">Unterlagen</a>}
              </div>
              {it.beschreibung && <p className="klein" style={{ marginTop: 6 }}>{it.beschreibung}</p>}
              {it.unter?.length > 0 && (
                <ul>{it.unter.map((u, j) => <li key={j} className={u.warn ? 'warn' : ''}>{u.text}</li>)}</ul>
              )}
            </div>
            <div className="to-zeit"><b>{wienUhrzeit(plan[i].von)}</b>{it.dauer} Min.</div>
          </li>
        ))}
      </ol>
      <div className="summe">
        <span>Gesamtdauer {dauerText(summe)}</span>
        <span className={zuLang ? 'warn' : 'leise'}>
          Ende voraussichtlich {wienUhrzeit(+sitzungStart(s) + summe * 60000)} Uhr
          {zuLang ? `, ${summe - (Number(s.dauerMin) || 120)} Min. über Plan` : ''}
        </span>
      </div>
    </>
  );
}

// ---------- Liste ----------

function SitzungZeile({ s }) {
  const { daten } = useApp();
  const n = (daten.themen || []).filter((t) => t.sitzungId === s.id).length;
  const status = s.status === 'abgeschlossen' ? 'Protokoll fertig' : s.status === 'laufend' ? 'läuft' : fristVorbei(s) ? 'Tagesordnung steht' : 'Themen sammeln';
  return (
    <li>
      <a className="zeile" href={`#sitzung-${s.id}`}>
        <div className="zeile-haupt">
          <div className="zeile-titel">{datumLang(s.datum)}, {s.uhrzeit} Uhr</div>
          <div className="zeile-meta">
            <span className={`etikett ${s.status === 'abgeschlossen' ? 'ton-gut' : 'ton-aktiv'}`}>{status}</span>
            {s.ort && <span>{s.ort}</span>}
            <span>{n === 1 ? '1 Thema' : `${n} Themen`}</span>
          </div>
        </div>
        <Icon n="weiter" />
      </a>
    </li>
  );
}

export function SitzungenListe() {
  const { daten, me, oeffne } = useApp();
  const jetzt = Date.now();
  const alle = [...(daten.sitzungen || [])];
  const kommend = alle.filter((s) => s.status !== 'abgeschlossen' && +sitzungEnde(s) > jetzt - 86400000).sort((a, b) => sitzungStart(a) - sitzungStart(b));
  const vergangen = alle.filter((s) => !kommend.includes(s)).sort((a, b) => sitzungStart(b) - sitzungStart(a));
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Fraktionssitzungen</h1>
        {me.gr && <button className="knopf" onClick={() => oeffne(() => <SitzungDialog />)}><Icon n="plus" />Sitzung anlegen</button>}
      </div>
      <section className="abschnitt" style={{ marginTop: 12 }}>
        <h2 style={{ marginBottom: 12 }}>Kommende</h2>
        {kommend.length ? <ul className="liste">{kommend.map((s) => <SitzungZeile key={s.id} s={s} />)}</ul> : (
          <Leer titel="Keine Sitzung geplant" text={me.gr ? 'Mit „Sitzung anlegen“ planst du die nächste Fraktionssitzung.' : 'Die nächste Sitzung legt ein Gemeinderat an.'} />
        )}
      </section>
      {vergangen.length > 0 && (
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Vergangene</h2>
          <ul className="liste">{vergangen.map((s) => <SitzungZeile key={s.id} s={s} />)}</ul>
        </section>
      )}
    </>
  );
}

// ---------- Detail ----------

function GoogleLeiste({ s }) {
  const { google, googleAktion, toast } = useApp();
  const [busy, setBusy] = useState('');
  if (!google?.eingerichtet || !google?.verbunden) {
    return <p className="hinweis info klein">Kalendereinladung, Google Doc und Mailversand gehen, sobald im Reiter <a href="#gemeinderaete">Gemeinderäte</a> ein Google-Konto verbunden ist.</p>;
  }
  const los = async (aktion, text) => {
    setBusy(aktion);
    const r = await googleAktion(aktion, s.id);
    setBusy('');
    if (r) toast(text(r));
  };
  return (
    <div className="knopfreihe">
      <button className="knopf zweit klein" disabled={!!busy} onClick={() => los('einladung', (r) => `Einladung an ${r.anzahl} Personen gesendet`)}>
        <Icon n="kalender" size={18} />{busy === 'einladung' ? 'Sendet …' : s.eingeladenAm ? 'Einladung aktualisieren' : 'Kalendereinladung senden'}
      </button>
      <button className="knopf zweit klein" disabled={!!busy} onClick={() => los('tagesordnung', (r) => `Tagesordnung gespeichert und an ${r.anzahl} Personen gesendet`)}>
        <Icon n="mail" size={18} />{busy === 'tagesordnung' ? 'Sendet …' : s.tagesordnungVersendetAm ? 'Tagesordnung erneut senden' : 'Tagesordnung als Doc speichern und senden'}
      </button>
    </div>
  );
}

export function SitzungDetail({ id }) {
  const { daten, me, oeffne, mutate, toast, bestaetige, config } = useApp();
  const s = (daten.sitzungen || []).find((x) => x.id === id);
  if (!s) return <><a className="zurueck" href="#sitzungen"><Icon n="zurueck" size={18} />Alle Sitzungen</a><Leer titel="Sitzung nicht gefunden" text="Vielleicht wurde sie gelöscht." /></>;
  const themen = (daten.themen || []).filter((t) => t.sitzungId === s.id).sort(sortiereThemen);
  const { items, fixiert } = aktuelleTagesordnung(s, daten);
  const offen = !fristVorbei(s) && s.status !== 'abgeschlossen';
  const kannAendern = (t) => me.gr || (t.autorId === me.uid && offen);

  return (
    <>
      <a className="zurueck" href="#sitzungen"><Icon n="zurueck" size={18} />Alle Sitzungen</a>
      <h1>Fraktionssitzung am {datumLang(s.datum)}</h1>
      <div className="kopfdaten">
        <div><span>Beginn</span><b>{s.uhrzeit} Uhr</b></div>
        <div><span>Ort</span><b>{s.ort || 'noch offen'}</b></div>
        <div><span>Geplante Dauer</span><b>{dauerText(Number(s.dauerMin) || 120)}</b></div>
        <div><span>Themen einreichen bis</span><b>{fristText(s)}</b></div>
      </div>
      {s.notiz && <p style={{ marginTop: 14 }}>{s.notiz}</p>}
      <div className="verweise">
        {s.kalenderLink && <a href={s.kalenderLink} target="_blank" rel="noreferrer"><Icon n="kalender" size={18} />Kalendertermin</a>}
        {s.tagesordnungDocUrl && <a href={s.tagesordnungDocUrl} target="_blank" rel="noreferrer"><Icon n="doc" size={18} />Tagesordnung als Google Doc</a>}
        {s.protokollDocUrl && <a href={s.protokollDocUrl} target="_blank" rel="noreferrer"><Icon n="doc" size={18} />Protokoll als Google Doc</a>}
        {(s.status === 'abgeschlossen' || s.live?.gestartetAm) && <a href={`#protokoll-${s.id}`}><Icon n="doc" size={18} />Protokoll in der App</a>}
      </div>

      {me.gr && (
        <section className="flaeche" style={{ marginTop: 22 }}>
          <div className="knopfreihe" style={{ marginBottom: 14 }}>
            <a className="knopf" href={`#modus-${s.id}`}><Icon n="play" size={18} />{s.status === 'abgeschlossen' ? 'Sitzungsmodus öffnen' : s.live?.gestartetAm ? 'Zurück in den Sitzungsmodus' : 'Sitzungsmodus starten'}</a>
            <button className="knopf zweit" onClick={() => oeffne(() => <SitzungDialog sitzung={s} />)}><Icon n="stift" size={18} />Bearbeiten</button>
            <button className="knopf still" onClick={async () => {
              if (await bestaetige('Sitzung löschen?', 'Die Sitzung und alle eingereichten Themen werden gelöscht. Ein bereits verschickter Kalendertermin bleibt bestehen.')) {
                try { await mutate('sitzung.loeschen', { id: s.id }, 'Sitzung gelöscht'); window.location.hash = 'sitzungen'; } catch (e) { toast(e.message, true); }
              }
            }}>Löschen</button>
          </div>
          <GoogleLeiste s={s} />
          <p className="leise mini" style={{ marginTop: 12 }}>
            {s.eingeladenAm ? `Eingeladen am ${zeitpunkt(s.eingeladenAm)} (${s.eingeladeneAnzahl || 0} Adressen). ` : 'Noch keine Kalendereinladung verschickt. '}
            {s.tagesordnungVersendetAm ? `Tagesordnung versendet am ${zeitpunkt(s.tagesordnungVersendetAm)}.` : 'Die Tagesordnung geht am Morgen nach der Frist automatisch an alle.'}
          </p>
        </section>
      )}

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Eingereichte Themen</h2>
          {(offen || me.gr) && s.status !== 'abgeschlossen' && (
            <button className="knopf klein" onClick={() => oeffne(() => <ThemaDialog sitzung={s} />)}><Icon n="plus" size={18} />{offen ? 'Thema einreichen' : 'Thema nachreichen'}</button>
          )}
        </div>
        {offen
          ? <p className="leise klein" style={{ marginBottom: 12 }}>Einreichen bis {fristText(s)}. Danach steht die Tagesordnung automatisch fest.{config.jotformThemenUrl && <> Wer sich nicht anmelden kann, nutzt das <a href={config.jotformThemenUrl} target="_blank" rel="noreferrer">Formular</a>.</>}</p>
          : <p className="leise klein" style={{ marginBottom: 12 }}>Die Einreichfrist ist abgelaufen.</p>}
        {themen.length === 0 ? <p className="leise">Noch keine Themen eingereicht.</p> : (
          <ul className="liste">
            {themen.map((t) => (
              <li key={t.id}>
                <div className="zeile">
                  <div className="zeile-haupt">
                    <div className="zeile-titel">{t.titel}</div>
                    <div className="zeile-meta">
                      <Ziel ziel={t.ziel} /><Dringlichkeit wert={t.dringlichkeit} /><span>{t.dauer} Min.</span><span>von {t.autorName}</span>
                      {t.link && <a href={t.link} target="_blank" rel="noreferrer">Unterlagen</a>}
                    </div>
                    {t.beschreibung && <p className="klein" style={{ marginTop: 6 }}>{t.beschreibung}</p>}
                  </div>
                  {kannAendern(t) && <button className="knopf still klein" onClick={() => oeffne(() => <ThemaDialog sitzung={s} thema={t} />)} aria-label={`${t.titel} bearbeiten`}><Icon n="stift" size={18} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Tagesordnung</h2>
          <span className={`etikett ${fixiert ? 'ton-gut' : 'ton-offen'}`}>{fixiert ? `steht fest seit ${zeitpunkt(s.agendaAm)}` : 'Vorschau, ändert sich bis zur Frist'}</span>
        </div>
        <TagesordnungListe s={s} items={items} />
        {me.gr && s.status !== 'abgeschlossen' && (
          <div className="knopfreihe" style={{ marginTop: 16 }}>
            <button className="knopf zweit klein" onClick={async () => {
              try { await mutate('sitzung.fixieren', { id: s.id }, fixiert ? 'Tagesordnung neu berechnet' : 'Tagesordnung festgelegt'); } catch (e) { toast(e.message, true); }
            }}>{fixiert ? 'Neu berechnen' : 'Jetzt festlegen'}</button>
            {fixiert && <button className="knopf zweit klein" onClick={() => oeffne(() => <ZeitenDialog sitzung={s} items={items} />)}><Icon n="uhr" size={18} />Zeiten anpassen</button>}
          </div>
        )}
      </section>

      <Kommentare bezug={`sitzung:${s.id}`} titel="Anmerkungen zur Sitzung" />
    </>
  );
}

