'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp, useJetzt, Icon, Feld, DialogForm, Leer, Ziel, Status } from './ui';
import { aktuelleTagesordnung } from './Sitzungen';
import { AufgabeZeile, AufgabeDialog } from './Aufgaben';
import { ERGEBNISSE, OFFENE_STATUS, datumLang, datumKurz, wienTag } from '@/lib/domain';

const LEER_LIVE = { index: 0, laufend: false, punktStart: null, gestartetAm: null, beendetAm: null, verbraucht: {}, anwesend: [], notizen: {} };

function mmss(sek) {
  const s = Math.max(0, Math.floor(sek));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function BeschlussDialog({ sitzungId, punkt }) {
  const { mutate, schliesse } = useApp();
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState(ERGEBNISSE[0]);
  return (
    <DialogForm titel="Beschluss festhalten" knopf="Beschluss speichern" onClose={schliesse}
      onSubmit={() => mutate('beschluss.neu', { sitzungId, punktKey: punkt.key, punktTitel: punkt.titel, text, ergebnis }, 'Beschluss gespeichert')}>
      <p className="leise klein" style={{ marginTop: -8, marginBottom: 14 }}>Zu Punkt: {punkt.titel}</p>
      <Feld label="Was wurde beschlossen?"><textarea value={text} onChange={(e) => setText(e.target.value)} required maxLength={1500} /></Feld>
      <Feld label="Ergebnis">
        <select value={ergebnis} onChange={(e) => setErgebnis(e.target.value)}>{ERGEBNISSE.map((x) => <option key={x}>{x}</option>)}</select>
      </Feld>
    </DialogForm>
  );
}

export default function Modus({ id }) {
  const { daten, me, mutate, toast, oeffne, bestaetige } = useApp();
  const jetzt = useJetzt(1000);
  const s = (daten.sitzungen || []).find((x) => x.id === id);
  const [lokal, setLokal] = useState(null);
  const [notiz, setNotiz] = useState('');
  const notizKey = useRef(null);
  const notizenRef = useRef({});
  const kette = useRef(Promise.resolve());
  const timer = useRef(null);

  const serverLive = { ...LEER_LIVE, ...(s?.live || {}) };
  const live = lokal || serverLive;
  const items = s ? aktuelleTagesordnung(s, daten).items : [];
  const index = Math.min(live.index || 0, Math.max(0, items.length - 1));
  const punkt = items[index];

  // Notizfeld beim Punktwechsel mit gespeichertem Stand füllen
  useEffect(() => {
    if (!punkt) return;
    if (notizKey.current !== punkt.key) {
      notizKey.current = punkt.key;
      setNotiz((live.notizen || {})[punkt.key] || '');
    }
    notizenRef.current = { ...(serverLive.notizen || {}), ...notizenRef.current };
  }, [punkt?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mitlesende sehen Notizen live
  useEffect(() => {
    if (!me.gr && punkt) setNotiz((serverLive.notizen || {})[punkt.key] || '');
  }, [s?.live, punkt?.key, me.gr]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <><a className="zurueck" href="#sitzungen"><Icon n="zurueck" size={18} />Alle Sitzungen</a><Leer titel="Sitzung nicht gefunden" /></>;

  const laufzeit = (l, key) => ((l.verbraucht || {})[key] || 0) + (l.laufend && l.punktStart && (l.index ?? 0) === items.findIndex((i) => i.key === key) ? (jetzt - l.punktStart) / 1000 : 0);
  const sek = punkt ? laufzeit(live, punkt.key) : 0;
  const budget = (Number(punkt?.dauer) || 5) * 60;
  const anteil = sek / budget;
  const ton = anteil > 1 ? 'drueber' : anteil >= 0.8 ? 'knapp' : '';
  const gesamtSek = live.gestartetAm ? ((live.beendetAm || jetzt) - live.gestartetAm) / 1000 : 0;
  const abgeschlossen = s.status === 'abgeschlossen';
  const steuern = me.gr && !abgeschlossen;

  function speichere(neu) {
    const mitNotizen = { ...neu, notizen: { ...(neu.notizen || {}), ...notizenRef.current } };
    setLokal(mitNotizen);
    kette.current = kette.current.then(async () => {
      try {
        await mutate('sitzung.live', { id: s.id, live: mitNotizen, agenda: s.agenda?.length ? undefined : items });
      } catch (e) { toast(e.message, true); }
      setLokal(null);
    });
    return kette.current;
  }

  function verbucht(l) {
    const v = { ...(l.verbraucht || {}) };
    const p = items[l.index || 0];
    if (l.laufend && l.punktStart && p) v[p.key] = Math.round((v[p.key] || 0) + (Date.now() - l.punktStart) / 1000);
    return v;
  }

  const starten = () => { const t = Date.now(); speichere({ ...live, gestartetAm: live.gestartetAm || t, laufend: true, punktStart: t }); };
  const pause = () => speichere({ ...live, verbraucht: verbucht(live), laufend: false, punktStart: null });
  const gehe = (i) => {
    if (i < 0 || i >= items.length || i === index) return;
    speichereNotiz();
    const t = Date.now();
    speichere({ ...live, verbraucht: verbucht(live), index: i, punktStart: live.laufend ? t : null });
  };
  const beenden = async () => {
    if (!(await bestaetige('Sitzung beenden?', 'Die Zeiten werden festgehalten und das Protokoll wird erstellt. Du kannst es danach noch ansehen und in Google Drive speichern.', 'Sitzung beenden'))) return;
    speichereNotiz();
    await speichere({ ...live, verbraucht: verbucht(live), laufend: false, punktStart: null, beendetAm: Date.now() });
    try {
      const r = await mutate('sitzung.abschliessen', { id: s.id }, 'Sitzung beendet');
      if (r.google === 'ok') toast('Sitzung beendet, Protokoll ist in Google Drive gespeichert');
      else if (r.google === 'fehler') toast(`Sitzung beendet, aber das Protokoll konnte nicht in Drive gespeichert werden: ${r.googleFehler}`, true);
      window.location.hash = `protokoll-${s.id}`;
    } catch (e) { toast(e.message, true); }
  };

  function speichereNotiz(text = notiz) {
    if (!punkt || !steuern) return;
    if ((notizenRef.current[punkt.key] || '') === text && (serverLive.notizen?.[punkt.key] || '') === text) return;
    notizenRef.current = { ...notizenRef.current, [punkt.key]: text };
    clearTimeout(timer.current);
    speichere({ ...live, notizen: { ...(live.notizen || {}), [punkt.key]: text } });
  }

  const anwesend = new Set(live.anwesend || []);
  const toggleAnwesend = (mid) => {
    const n = new Set(anwesend);
    if (n.has(mid)) n.delete(mid); else n.add(mid);
    speichere({ ...live, anwesend: [...n] });
  };

  const beschluesse = (daten.beschluesse || []).filter((b) => b.sitzungId === s.id && b.punktKey === punkt?.key);
  const aufgaben = (daten.aufgaben || []).filter((a) => a.sitzungId === s.id && a.punktKey === punkt?.key);
  const mitglieder = [...(daten.mitglieder || [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const heute = wienTag();

  return (
    <>
      <a className="zurueck" href={`#sitzung-${s.id}`}><Icon n="zurueck" size={18} />Zur Sitzung</a>
      <div className="abschnitt-kopf">
        <div>
          <h1>Sitzungsmodus</h1>
          <p className="leise">{datumLang(s.datum)}{s.ort ? `, ${s.ort}` : ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="leise mini">Sitzungsdauer</p>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 28, fontStretch: '75%' }}>{live.gestartetAm ? mmss(gesamtSek) : 'nicht gestartet'}</p>
        </div>
      </div>
      {!me.gr && !abgeschlossen && <p className="hinweis info" style={{ marginBottom: 18 }}>Du verfolgst die Sitzung live mit. Gesteuert wird sie von einem Gemeinderat.</p>}
      {abgeschlossen && <p className="hinweis" style={{ marginBottom: 18 }}>Diese Sitzung ist beendet. <a href={`#protokoll-${s.id}`}>Zum Protokoll</a></p>}

      <div className="modus">
        <ol className="modus-punkte" aria-label="Tagesordnungspunkte">
          {items.map((it, i) => {
            const t = laufzeit(live, it.key);
            return (
              <li key={it.key}>
                <button aria-current={i === index ? 'true' : undefined} onClick={() => steuern && gehe(i)} disabled={!steuern && i !== index} style={!steuern ? { cursor: 'default' } : undefined}>
                  <b>{i + 1}</b>
                  <span className={i < index && t ? 'fertig' : ''}>{it.titel}</span>
                  <span className="leise mini nowrap">{t ? `${Math.round(t / 60)}/` : ''}{it.dauer}′</span>
                </button>
              </li>
            );
          })}
        </ol>

        {punkt && (
          <section aria-live="polite">
            <p className="leise">Punkt {index + 1} von {items.length}</p>
            <h2 style={{ fontSize: 28, margin: '4px 0 10px' }}>{punkt.titel}</h2>
            <div className="zeile-meta" style={{ marginBottom: 16 }}>
              <Ziel ziel={punkt.ziel} />
              {punkt.einreicher && <span>eingereicht von {punkt.einreicher}</span>}
              {punkt.link && <a href={punkt.link} target="_blank" rel="noreferrer">Unterlagen</a>}
            </div>

            <div className={`uhr ${ton}`} aria-label={`${mmss(sek)} von ${punkt.dauer} Minuten`}>{mmss(sek)}</div>
            <div className={`balken ${ton}`}><div style={{ width: `${Math.min(100, anteil * 100)}%` }} /></div>
            <p className={ton === 'drueber' ? 'warn' : 'leise'}>
              Zeitbudget {punkt.dauer} Min.{anteil > 1 ? `, ${Math.ceil((sek - budget) / 60)} Min. drüber` : `, noch ${Math.ceil((budget - sek) / 60)} Min.`}
            </p>

            {steuern && (
              <div className="steuerung">
                <button className="knopf zweit" onClick={() => gehe(index - 1)} disabled={index === 0}><Icon n="zurueck" />Zurück</button>
                {live.laufend
                  ? <button className="knopf zweit" onClick={pause}><Icon n="pause" />Pause</button>
                  : <button className="knopf" onClick={starten}><Icon n="play" />{live.gestartetAm ? 'Fortsetzen' : 'Sitzung starten'}</button>}
                {index < items.length - 1
                  ? <button className="knopf" onClick={() => gehe(index + 1)}>Nächster Punkt<Icon n="weiter" /></button>
                  : <button className="knopf" onClick={beenden}>Sitzung beenden</button>}
              </div>
            )}

            {punkt.beschreibung && <p style={{ marginTop: 22 }}>{punkt.beschreibung}</p>}
            {punkt.unter?.length > 0 && punkt.key !== 'aufgaben' && (
              <ul style={{ marginTop: 14 }}>{punkt.unter.map((u, j) => <li key={j} className={u.warn ? 'warn' : ''}>{u.text}</li>)}</ul>
            )}

            {punkt.key === 'begruessung' && (
              <div className="abschnitt" style={{ marginTop: 26 }}>
                <h3 style={{ marginBottom: 10 }}>Anwesend ({anwesend.size})</h3>
                {mitglieder.length === 0 ? <p className="leise">Lege zuerst Mitglieder im Reiter Gemeinderäte an.</p> : (
                  <div className="anwesend">
                    {mitglieder.map((m) => (
                      <label key={m.id}>
                        <input type="checkbox" checked={anwesend.has(m.id)} disabled={!steuern} onChange={() => toggleAnwesend(m.id)} />{m.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {punkt.key === 'aufgaben' && (
              <div className="abschnitt" style={{ marginTop: 26 }}>
                <h3 style={{ marginBottom: 10 }}>Offene Aufgaben durchgehen</h3>
                {(daten.aufgaben || []).filter((a) => a.status !== 'erledigt').length === 0 ? <p className="leise">Keine offenen Aufgaben.</p> : (
                  <ul className="liste">{(daten.aufgaben || []).filter((a) => a.status !== 'erledigt').map((a) => <AufgabeZeile key={a.id} a={a} heute={heute} />)}</ul>
                )}
              </div>
            )}

            {punkt.key === 'antraege' && (
              <div className="abschnitt" style={{ marginTop: 26 }}>
                <ul className="liste">
                  {(daten.antraege || []).filter((a) => OFFENE_STATUS.includes(a.status)).map((a) => (
                    <li key={a.id}><a className="zeile" href={`#antrag-${a.id}`} target="_blank" rel="noreferrer"><span className="zeile-haupt"><span className="zeile-titel">{a.titel}</span><span className="zeile-meta"><Status status={a.status} /></span></span></a></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="abschnitt" style={{ marginTop: 28 }}>
              <h3 style={{ marginBottom: 8 }}>Notizen für das Protokoll</h3>
              {steuern ? (
                <textarea
                  className="eingabe" style={{ minHeight: 130 }} value={notiz}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNotiz(v);
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => speichereNotiz(v), 2500);
                  }}
                  onBlur={() => speichereNotiz()}
                  placeholder="Wichtigste Punkte der Diskussion"
                  aria-label="Notizen für das Protokoll"
                />
              ) : <p style={{ whiteSpace: 'pre-wrap' }} className={notiz ? '' : 'leise'}>{notiz || 'Noch keine Notizen.'}</p>}
            </div>

            <div className="raster2">
              <div className="abschnitt" style={{ marginTop: 28 }}>
                <div className="abschnitt-kopf">
                  <h3>Beschlüsse</h3>
                  {me.gr && <button className="knopf zweit klein" onClick={() => oeffne(() => <BeschlussDialog sitzungId={s.id} punkt={punkt} />)}><Icon n="plus" size={18} />Beschluss</button>}
                </div>
                {beschluesse.length === 0 ? <p className="leise klein">Noch kein Beschluss zu diesem Punkt.</p> : (
                  <ul className="liste">
                    {beschluesse.map((b) => (
                      <li key={b.id}><div className="zeile"><div className="zeile-haupt"><div className="zeile-titel">{b.text}</div><div className="zeile-meta"><span className="etikett ton-gut">{b.ergebnis}</span></div></div>
                        {me.gr && <button className="knopf still klein" aria-label="Beschluss löschen" onClick={async () => {
                          if (await bestaetige('Beschluss löschen?', b.text)) { try { await mutate('beschluss.loeschen', { id: b.id }, 'Beschluss gelöscht'); } catch (e) { toast(e.message, true); } }
                        }}><Icon n="x" size={18} /></button>}
                      </div></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="abschnitt" style={{ marginTop: 28 }}>
                <div className="abschnitt-kopf">
                  <h3>Aufgaben</h3>
                  {me.gr && <button className="knopf zweit klein" onClick={() => oeffne(() => <AufgabeDialog sitzungId={s.id} punkt={punkt} />)}><Icon n="plus" size={18} />Aufgabe</button>}
                </div>
                {aufgaben.length === 0 ? <p className="leise klein">Noch keine Aufgabe zu diesem Punkt.</p> : (
                  <ul className="liste">{aufgaben.map((a) => <AufgabeZeile key={a.id} a={a} heute={heute} loeschbar />)}</ul>
                )}
              </div>
            </div>
            {abgeschlossen && me.gr && (
              <button className="knopf still klein" style={{ marginTop: 24 }} onClick={() => mutate('sitzung.wiedereroeffnen', { id: s.id }, 'Sitzung wieder geöffnet').catch((e) => toast(e.message, true))}>
                Sitzung wieder öffnen, um nachzutragen
              </button>
            )}
            <p className="leise mini" style={{ marginTop: 24 }}>Vorige Sitzung: {(() => {
              const v = (daten.sitzungen || []).filter((x) => x.id !== s.id && x.datum < s.datum).sort((a, b) => (a.datum < b.datum ? 1 : -1))[0];
              return v ? <a href={`#protokoll-${v.id}`}>{datumKurz(v.datum)}</a> : 'keine';
            })()}</p>
          </section>
        )}
      </div>
    </>
  );
}
