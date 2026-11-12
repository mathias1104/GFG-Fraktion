'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, Segment, DialogForm, Leer, Ziel, Dringlichkeit } from './ui';
import { Kommentare } from './Antraege';
import {
  ZIELE, DRINGLICHKEIT, tagesordnungAktuell, summeMinuten, SITZUNGSARTEN, sitzungName, zeitplan, dauerText, datumLang, datumKurz,
  fristText, fristVorbei, sitzungStart, sitzungEnde, wienUhrzeit, zeitpunkt,
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
        Für: {sitzungName(sitzung)} am {datumKurz(sitzung.datum)}. Einreichen bis {fristText(sitzung)}.
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

export function SitzungDialog({ sitzung, vorschlag = {} }) {
  const { mutate, schliesse, config, toast } = useApp();
  const [f, setF] = useState({
    art: sitzung?.art || vorschlag.art || 'Fraktionssitzung', titel: sitzung?.titel || '',
    datum: sitzung?.datum || vorschlag.datum || '', uhrzeit: sitzung?.uhrzeit || '19:00', dauerMin: sitzung?.dauerMin || 120,
    ort: sitzung?.ort || '', fristTage: sitzung?.fristTage ?? config.fristTage ?? 3, notiz: sitzung?.notiz || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm
      titel={sitzung ? 'Sitzung bearbeiten' : 'Sitzung anlegen'}
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
        <Feld label="Art der Sitzung">
          <select value={f.art} onChange={set('art')}>{SITZUNGSARTEN.map((a) => <option key={a}>{a}</option>)}</select>
        </Feld>
        <Feld label="Bezeichnung (optional)"><input value={f.titel} onChange={set('titel')} maxLength={120} placeholder={f.art === 'Veranstaltung' ? 'z. B. Stand am Adventmarkt' : f.art} /></Feld>
      </div>
      <div className="feld-reihe">
        <Feld label="Datum"><input type="date" value={f.datum} onChange={set('datum')} required /></Feld>
        <Feld label="Beginn"><input type="time" value={f.uhrzeit} onChange={set('uhrzeit')} required /></Feld>
      </div>
      <Feld label="Ort"><input value={f.ort} onChange={set('ort')} placeholder="z. B. Gasthaus, Vereinslokal, Online" maxLength={200} /></Feld>
      <div className="feld-reihe">
        <Feld label="Geplante Dauer">
          <select value={f.dauerMin} onChange={set('dauerMin')}>
            {[30, 60, 90, 120, 150, 180, 240].map((d) => <option key={d} value={d}>{dauerText(d)}</option>)}
          </select>
        </Feld>
        <Feld label="Themen einreichen bis">
          <select value={f.fristTage} onChange={set('fristTage')}>
            {[0, 1, 2, 3, 4, 5, 7].map((d) => <option key={d} value={d}>{d === 0 ? 'Tag der Sitzung' : `${d} ${d === 1 ? 'Tag' : 'Tage'} vorher`}</option>)}
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
  return tagesordnungAktuell(s, daten);
}

/** Tagesordnung = eingereichte Themen. aktion(it) liefert z. B. einen Bearbeiten-Knopf. */
export function TagesordnungListe({ s, items, aktion }) {
  if (!items.length) return null;
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
                {it.dringlichkeit && it.dringlichkeit !== 'mittel' && <Dringlichkeit wert={it.dringlichkeit} />}
                {it.einreicher && <span>von {it.einreicher}</span>}
                {it.nachtraeglich && <span className="etikett ton-offen">nachgereicht</span>}
                {it.link && <a href={it.link} target="_blank" rel="noreferrer">Unterlagen</a>}
              </div>
              {it.beschreibung && <p className="klein" style={{ marginTop: 6 }}>{it.beschreibung}</p>}
            </div>
            <div className="to-zeit">
              <b>{wienUhrzeit(plan[i].von)}</b>{it.dauer} Min.
              {aktion && <div style={{ marginTop: 4 }}>{aktion(it)}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="summe">
        <span>{items.length} {items.length === 1 ? 'Thema' : 'Themen'}, {dauerText(summe)}</span>
        <span className={zuLang ? 'warn' : 'leise'}>
          Ende ca. {wienUhrzeit(+sitzungStart(s) + summe * 60000)} Uhr{zuLang ? `, ${summe - (Number(s.dauerMin) || 120)} Min. über Plan` : ''}
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
          <div className="zeile-titel">{sitzungName(s)}</div>
          <div className="zeile-meta">
            <b style={{ color: 'var(--tinte)' }}>{datumLang(s.datum)}, {s.uhrzeit} Uhr</b>
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
        <h1>Sitzungen</h1>
        {me.gr && <button className="knopf" onClick={() => oeffne(() => <SitzungDialog />)}><Icon n="plus" />Sitzung anlegen</button>}
      </div>
      <p className="leise" style={{ marginBottom: 6 }}>Fraktionssitzungen, Klausuren, Treffen und Veranstaltungen. Die Tagesordnung entsteht aus den eingereichten Themen.</p>
      <section className="abschnitt" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 12 }}>Kommende</h2>
        {kommend.length ? <ul className="liste">{kommend.map((s) => <SitzungZeile key={s.id} s={s} />)}</ul> : (
          <Leer titel="Keine Sitzung geplant" text={me.gr ? 'Mit „Sitzung anlegen“ planst du die nächste Sitzung.' : 'Die nächste Sitzung legt ein Gemeinderat an.'} />
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

function GoogleLeiste({ s, leer }) {
  const { google, googleAktion, toast } = useApp();
  const [busy, setBusy] = useState('');
  if (!google?.eingerichtet || !google?.verbunden) {
    return <p className="hinweis info klein">Kalendereinladung, Google Doc und Mailversand gehen, sobald unter Einstellungen ein Google-Konto verbunden ist.</p>;
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
      {!leer && (
        <button className="knopf zweit klein" disabled={!!busy} onClick={() => los('tagesordnung', (r) => (r.warnung ? `Tagesordnung als Google Doc gespeichert, Push verschickt. Mail nicht möglich: ${r.warnung}` : `Tagesordnung gespeichert und an ${r.anzahl} Personen gesendet`))}>
          <Icon n="mail" size={18} />{busy === 'tagesordnung' ? 'Sendet …' : s.tagesordnungVersendetAm ? 'Tagesordnung erneut senden' : 'Tagesordnung jetzt senden'}
        </button>
      )}
    </div>
  );
}

export function SitzungDetail({ id }) {
  const { daten, me, oeffne, mutate, toast, bestaetige, config } = useApp();
  const s = (daten.sitzungen || []).find((x) => x.id === id);
  if (!s) return <><a className="zurueck" href="#sitzungen"><Icon n="zurueck" size={18} />Alle Sitzungen</a><Leer titel="Sitzung nicht gefunden" text="Vielleicht wurde sie gelöscht." /></>;
  const themen = Object.fromEntries((daten.themen || []).filter((t) => t.sitzungId === s.id).map((t) => [t.id, t]));
  const { items, fixiert } = aktuelleTagesordnung(s, daten);
  const offen = !fristVorbei(s) && s.status !== 'abgeschlossen';
  const kannAendern = (t) => t && (me.gr || (t.autorId === me.uid && offen));
  const ueberfaellig = (daten.aufgaben || []).filter((a) => a.status !== 'erledigt' && a.frist && a.frist < s.datum).length;
  const offeneAufgaben = (daten.aufgaben || []).filter((a) => a.status !== 'erledigt').length;
  const einreichen = (offen || me.gr) && s.status !== 'abgeschlossen';

  return (
    <>
      <a className="zurueck" href="#sitzungen"><Icon n="zurueck" size={18} />Alle Sitzungen</a>
      <div className="zeile-meta" style={{ marginTop: 0, marginBottom: 6 }}><span className="etikett ton-aktiv">{s.art || 'Fraktionssitzung'}</span></div>
      <h1>{sitzungName(s)} am {datumLang(s.datum)}</h1>
      <div className="kopfdaten">
        <div><span>Beginn</span><b>{s.uhrzeit} Uhr</b></div>
        <div><span>Ort</span><b>{s.ort || 'noch offen'}</b></div>
        <div><span>Themen einreichen bis</span><b>{fristText(s)}</b></div>
      </div>
      {s.notiz && <p style={{ marginTop: 14 }}>{s.notiz}</p>}
      <div className="verweise">
        {s.kalenderLink && <a href={s.kalenderLink} target="_blank" rel="noreferrer"><Icon n="kalender" size={18} />Kalendertermin</a>}
        {s.tagesordnungDocUrl && <a href={s.tagesordnungDocUrl} target="_blank" rel="noreferrer"><Icon n="doc" size={18} />Tagesordnung als Google Doc</a>}
        {s.protokollDocUrl && <a href={s.protokollDocUrl} target="_blank" rel="noreferrer"><Icon n="doc" size={18} />Protokoll als Google Doc</a>}
        {(s.status === 'abgeschlossen' || s.live?.gestartetAm) && <a href={`#protokoll-${s.id}`}><Icon n="doc" size={18} />Protokoll in der App</a>}
      </div>

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Tagesordnung</h2>
          {einreichen && (
            <button className="knopf klein" onClick={() => oeffne(() => <ThemaDialog sitzung={s} />)}><Icon n="plus" size={18} />{offen ? 'Thema einreichen' : 'Thema nachreichen'}</button>
          )}
        </div>
        <p className="leise klein" style={{ marginBottom: 12 }}>
          {s.status === 'abgeschlossen' ? 'Die Sitzung ist beendet.' : offen
            ? <>Jedes eingereichte Thema wird ein Tagesordnungspunkt, dringende zuerst. Einreichen bis {fristText(s)}.{config.jotformThemenUrl && <> Ohne Anmeldung geht es auch über das <a href={config.jotformThemenUrl} target="_blank" rel="noreferrer">Formular</a>.</>}</>
            : <>Die Einreichfrist ist abgelaufen{fixiert ? `, die Tagesordnung steht seit ${zeitpunkt(s.agendaAm)} fest` : ''}.</>}
        </p>
        {items.length === 0
          ? <Leer titel="Noch keine Themen" text="Sobald jemand ein Thema einreicht, erscheint es hier als Tagesordnungspunkt." />
          : <TagesordnungListe s={s} items={items} aktion={(it) => kannAendern(themen[it.themaId]) && (
            <button className="knopf still klein" onClick={() => oeffne(() => <ThemaDialog sitzung={s} thema={themen[it.themaId]} />)} aria-label={`${it.titel} bearbeiten`}><Icon n="stift" size={16} /></button>
          )} />}
        {offeneAufgaben > 0 && (
          <p className="klein" style={{ marginTop: 14 }}>
            <a href="#aufgaben">{offeneAufgaben} offene {offeneAufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}</a>
            {ueberfaellig > 0 && <span className="ueberfaellig">, davon {ueberfaellig} überfällig</span>}
          </p>
        )}
      </section>

      {me.gr && (
        <section className="flaeche abschnitt">
          <h3 style={{ marginBottom: 12 }}>Für Gemeinderäte</h3>
          <div className="knopfreihe" style={{ marginBottom: 14 }}>
            <a className="knopf" href={`#modus-${s.id}`}><Icon n="play" size={18} />{s.status === 'abgeschlossen' ? 'Sitzungsmodus öffnen' : s.live?.gestartetAm ? 'Zurück in den Sitzungsmodus' : 'Sitzungsmodus starten'}</a>
            <button className="knopf zweit" onClick={() => oeffne(() => <SitzungDialog sitzung={s} />)}><Icon n="stift" size={18} />Bearbeiten</button>
            {items.length > 0 && s.status !== 'abgeschlossen' && (
              <button className="knopf zweit" onClick={async () => {
                if (!fixiert) { try { await mutate('sitzung.fixieren', { id: s.id }); } catch (e) { toast(e.message, true); return; } }
                oeffne(() => <ZeitenDialog sitzung={s} items={items} />);
              }}><Icon n="uhr" size={18} />Zeiten anpassen</button>
            )}
            <button className="knopf still" onClick={async () => {
              if (await bestaetige('Sitzung löschen?', 'Die Sitzung und alle eingereichten Themen werden gelöscht.')) {
                try { await mutate('sitzung.loeschen', { id: s.id }, 'Sitzung gelöscht'); window.location.hash = 'sitzungen'; } catch (e) { toast(e.message, true); }
              }
            }}>Löschen</button>
          </div>
          <GoogleLeiste s={s} leer={!items.length} />
          <p className="leise mini" style={{ marginTop: 12 }}>
            {s.eingeladenAm ? `Eingeladen am ${zeitpunkt(s.eingeladenAm)} (${s.eingeladeneAnzahl || 0} Adressen). ` : 'Noch keine Kalendereinladung verschickt. '}
            {s.tagesordnungVersendetAm ? `Tagesordnung versendet am ${zeitpunkt(s.tagesordnungVersendetAm)}.` : 'Die Tagesordnung geht am Morgen nach der Frist automatisch an alle.'}
          </p>
        </section>
      )}

      <Kommentare bezug={`sitzung:${s.id}`} titel="Anmerkungen zur Sitzung" />
    </>
  );
}
