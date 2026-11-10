'use client';
import { useState } from 'react';
import { useApp, useJetzt, Icon, Status, Leer, Feld, DialogForm } from './ui';
import { ThemaDialog } from './Sitzungen';
import { AufgabeZeile } from './Aufgaben';
import { VideoZeile, VideoDialog, stimmenZahl } from './Videothemen';
import {
  sitzungStart, sitzungEnde, fristEnde, fristVorbei, fristText, datumLang, datumKurz, wienTag, zeitpunkt, ereignisse,
} from '@/lib/domain';

export function naechsteSitzung(sitzungen, jetzt = Date.now()) {
  return sitzungen
    .filter((s) => s.status !== 'abgeschlossen' && +sitzungEnde(s) > jetzt)
    .sort((a, b) => sitzungStart(a) - sitzungStart(b))[0];
}

function Countdown({ s }) {
  const jetzt = useJetzt(1000);
  const diff = +sitzungStart(s) - jetzt;
  if (diff <= 0) {
    return (
      <div className="countdown">
        <span className="countdown-zahl">Jetzt</span>
        <span className="countdown-rest"><b>läuft</b>die Sitzung</span>
      </div>
    );
  }
  const tage = Math.floor(diff / 86400000);
  const std = Math.floor((diff % 86400000) / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  const sek = Math.floor((diff % 60000) / 1000);
  if (tage >= 1) {
    return (
      <div className="countdown" aria-label={`Noch ${tage} Tage, ${std} Stunden`}>
        <span className="countdown-zahl">{tage}</span>
        <span className="countdown-rest"><b>{tage === 1 ? 'Tag' : 'Tage'}</b>und {std} Std. {min} Min.</span>
      </div>
    );
  }
  return (
    <div className="countdown" aria-label={`Noch ${std} Stunden ${min} Minuten`}>
      <span className="countdown-zahl">{std}:{String(min).padStart(2, '0')}</span>
      <span className="countdown-rest"><b>Stunden</b>{sek} Sek.</span>
    </div>
  );
}

function Fahrplan({ s }) {
  const jetzt = useJetzt(60000);
  const frist = +fristEnde(s);
  const stationen = [
    { label: 'Einladung', ts: s.eingeladenAm || s.erstelltAm || frist - 7 * 86400000 },
    { label: 'Themenfrist', ts: frist },
    { label: 'Tagesordnung', ts: s.tagesordnungVersendetAm || frist + 7 * 3600000 },
    { label: 'Sitzung', ts: +sitzungStart(s) },
  ];
  let anteil = 1;
  for (let i = 0; i < 3; i += 1) {
    const a = stationen[i].ts;
    const b = stationen[i + 1].ts;
    if (jetzt < b) { anteil = (i + Math.max(0, Math.min(1, (jetzt - a) / Math.max(1, b - a)))) / 3; break; }
  }
  if (jetzt < stationen[0].ts) anteil = 0;
  const naechste = stationen.findIndex((x) => jetzt < x.ts);
  return (
    <div className="fahrplan" aria-label="Ablauf bis zur Sitzung">
      <div className="fahrplan-spur"><div className="fahrplan-fuellung" style={{ width: `${anteil * 100}%` }} /></div>
      {stationen.map((st, i) => (
        <div key={st.label} className={`station${jetzt >= st.ts ? ' erreicht' : ''}${i === naechste ? ' jetzt' : ''}`}>
          <div className="station-punkt" />
          <b>{st.label}</b>
          <span>{datumKurz(wienTag(st.ts)).replace(/\.\d{4}$/, '.')}</span>
        </div>
      ))}
    </div>
  );
}

function NaechsteSitzung({ s }) {
  const { daten, oeffne, me } = useApp();
  const themen = (daten.themen || []).filter((t) => t.sitzungId === s.id);
  const offen = !fristVorbei(s);
  const laeuft = Date.now() >= +sitzungStart(s);
  return (
    <section className="naechste" aria-labelledby="naechste-titel">
      <div className="naechste-oben">
        <div className="naechste-wann">
          <p style={{ marginTop: 0, marginBottom: 6 }}>Nächste Fraktionssitzung</p>
          <h1 id="naechste-titel">{datumLang(s.datum)}</h1>
          <p>{s.uhrzeit || '19:00'} Uhr{s.ort ? `, ${s.ort}` : ''}</p>
        </div>
        <Countdown s={s} />
      </div>
      <Fahrplan s={s} />
      <div className="naechste-unten">
        {laeuft ? (
          <a className="knopf" href={`#modus-${s.id}`}>{me.gr ? 'Zum Sitzungsmodus' : 'Live mitverfolgen'}</a>
        ) : offen ? (
          <button className="knopf" onClick={() => oeffne(() => <ThemaDialog sitzung={s} />)}><Icon n="plus" />Thema einreichen</button>
        ) : null}
        <a className="knopf zweit" href={`#sitzung-${s.id}`}>{offen ? 'Themen und Vorschau' : 'Tagesordnung ansehen'}</a>
        <span style={{ color: '#CFE0D5', fontSize: 15 }}>
          {themen.length === 1 ? '1 Thema eingereicht' : `${themen.length} Themen eingereicht`}
          {offen ? `, Frist bis ${fristText(s)}` : ', Einreichfrist abgelaufen'}
        </span>
      </div>
    </section>
  );
}

function neuigkeiten(daten, me, seit) {
  return ereignisse(daten, me).filter((x) => x.ts > seit).slice(0, 8);
}

function InfoDialog({ info }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({ titel: info?.titel || '', text: info?.text || '', wichtig: info ? !!info.wichtig : true });
  return (
    <DialogForm titel={info ? 'Info bearbeiten' : 'Info an alle'} knopf={info ? 'Speichern' : 'Veröffentlichen'} onClose={schliesse}
      onSubmit={() => mutate('info.speichern', { ...f, id: info?.id }, info ? 'Info gespeichert' : 'Info veröffentlicht')}
      gefahr={info && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Info löschen?', info.titel)) { try { await mutate('info.loeschen', { id: info.id }, 'Info gelöscht'); } catch (e) { toast(e.message, true); } }
        }}>Löschen</button>
      )}>
      <Feld label="Titel"><input value={f.titel} onChange={(e) => setF({ ...f, titel: e.target.value })} required maxLength={160} /></Feld>
      <Feld label="Text"><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} maxLength={5000} style={{ minHeight: 130 }} /></Feld>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input type="checkbox" checked={f.wichtig} onChange={(e) => setF({ ...f, wichtig: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--gruen)' }} />
        <span>Wichtig: alle sollen das Lesen bestätigen</span>
      </label>
    </DialogForm>
  );
}

function PasswortSchnell() {
  const { mutate, toast } = useApp();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '4px 0 16px' }} onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { await mutate('config.speichern', { mitgliederPasswort: pw }, 'Fraktionspasswort gespeichert'); setPw(''); } catch (err) { toast(err.message, true); }
      setBusy(false);
    }}>
      <label className="feld" style={{ marginBottom: 0, flex: '1 1 240px' }}>
        <span>Fraktionspasswort (mind. 6 Zeichen)</span>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required autoComplete="new-password" />
      </label>
      <button className="knopf" disabled={busy}>Passwort speichern</button>
    </form>
  );
}

function Einrichtung() {
  const { me, config, daten } = useApp();
  if (!me.gr) return null;
  const mitglieder = daten.mitglieder || [];
  const ohneMail = mitglieder.filter((m) => !m.email).length;
  const schritte = [
    { fertig: !!config.mitgliederPasswortGesetzt, text: 'Fraktionspasswort für die Vereinsmitglieder festlegen' },
    { fertig: mitglieder.length > 0 && ohneMail === 0, text: ohneMail ? `E-Mail-Adressen eintragen (${ohneMail} fehlen noch)` : 'E-Mail-Adressen eintragen' },
  ];
  if (schritte.every((x) => x.fertig)) return null;
  return (
    <section className="flaeche" style={{ marginTop: 22, borderColor: 'var(--loess)' }}>
      <h2 style={{ marginBottom: 8 }}>Einrichtung abschließen</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
        {schritte.map((x) => (
          <li key={x.text} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0' }}>
            <span className={`abhaken${x.fertig ? ' an' : ''}`} aria-hidden="true" style={{ cursor: 'default' }}>{x.fertig && <Icon n="check" size={16} />}</span>
            <span style={x.fertig ? { color: 'var(--grau)', textDecoration: 'line-through' } : undefined}>{x.text}</span>
          </li>
        ))}
      </ul>
      {!config.mitgliederPasswortGesetzt && <PasswortSchnell />}
      <a className={config.mitgliederPasswortGesetzt ? 'knopf' : 'knopf zweit'} href="#einstellungen">Mitglieder und E-Mail-Adressen bearbeiten</a>
    </section>
  );
}

function Infos() {
  const { daten, me, mutate, toast, oeffne } = useApp();
  const [alleZeigen, setAlleZeigen] = useState(false);
  const anzahl = (daten.mitglieder || []).length;
  const grenze = Date.now() - 45 * 86400000;
  const sortiert = [...(daten.infos || [])].sort((a, b) => (b.erstelltAm || 0) - (a.erstelltAm || 0));
  const sichtbar = alleZeigen ? sortiert : sortiert.filter((i) => (i.wichtig && !(i.gelesen || {})[me.uid]) || i.erstelltAm > grenze).slice(0, 4);
  if (!sortiert.length && !me.gr) return null;
  return (
    <section className="abschnitt">
      <div className="abschnitt-kopf">
        <h2>Infos an die Fraktion</h2>
        <div className="knopfreihe">
          {sortiert.length > sichtbar.length && <button className="knopf still klein" onClick={() => setAlleZeigen(true)}>Alle {sortiert.length} anzeigen</button>}
          {me.gr && <button className="knopf zweit klein" onClick={() => oeffne(() => <InfoDialog />)}><Icon n="plus" size={18} />Info</button>}
        </div>
      </div>
      {sichtbar.length === 0 && <p className="leise">{me.gr ? 'Mit „Info“ erreichst du alle. Bei wichtigen Infos siehst du, wer sie gelesen hat.' : 'Keine aktuellen Infos.'}</p>}
      {sichtbar.map((i) => {
        const gelesen = Object.entries(i.gelesen || {});
        const ich = !!(i.gelesen || {})[me.uid];
        return (
          <article key={i.id} className={`info${ich || !i.wichtig ? ' gelesen' : ''}`}>
            <div className="abschnitt-kopf" style={{ marginBottom: 0 }}>
              <h3>{i.titel}</h3>
              {me.gr && <button className="knopf still klein" aria-label="Info bearbeiten" onClick={() => oeffne(() => <InfoDialog info={i} />)}><Icon n="stift" size={16} /></button>}
            </div>
            {i.text && <p style={{ whiteSpace: 'pre-wrap' }}>{i.text}</p>}
            <div className="zeile-meta">
              <span>{i.autorName}, {zeitpunkt(i.erstelltAm)}</span>
              {i.wichtig && <span className="etikett ton-offen"><Icon n="auge" size={14} />gelesen von {gelesen.length} von {anzahl}</span>}
            </div>
            {i.wichtig && !ich && (
              <button className="knopf klein" style={{ marginTop: 12 }} onClick={async () => {
                try { await mutate('info.gelesen', { id: i.id }, 'Danke, als gelesen bestätigt'); } catch (e) { toast(e.message, true); }
              }}><Icon n="check" size={16} />Gelesen</button>
            )}
            {i.wichtig && gelesen.length > 0 && (
              <details>
                <summary>Wer hat gelesen?</summary>
                <p style={{ marginTop: 6 }}>{gelesen.sort((a, b) => a[1].ts - b[1].ts).map(([, g]) => g.name).join(', ')}</p>
                {me.gr && (() => {
                  const namen = new Set(gelesen.map(([, g]) => g.name));
                  const fehlen = (daten.mitglieder || []).filter((m) => !namen.has(m.name)).map((m) => m.name);
                  return fehlen.length ? <p style={{ marginTop: 4 }}>Noch nicht: {fehlen.join(', ')}</p> : null;
                })()}
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}

export default function Start() {
  const { daten, me, letzterBesuch, oeffne } = useApp();
  const s = naechsteSitzung(daten.sitzungen || []);
  const videos = (daten.videothemen || []).filter((v) => v.status !== 'veröffentlicht')
    .sort((a, b) => (b.erstelltAm || 0) - (a.erstelltAm || 0)).slice(0, 4)
    .sort((a, b) => stimmenZahl(b) - stimmenZahl(a));
  const neu = letzterBesuch ? neuigkeiten(daten, me, letzterBesuch) : [];
  const heute = wienTag();
  const aufgaben = (daten.aufgaben || []).filter((a) => a.status !== 'erledigt')
    .sort((a, b) => (a.frist || '9999').localeCompare(b.frist || '9999'));
  const antraege = [...(daten.antraege || [])].sort((a, b) => (b.geaendertAm || 0) - (a.geaendertAm || 0)).slice(0, 5);

  return (
    <>
      {s ? <NaechsteSitzung s={s} /> : (
        <Leer titel="Noch keine Fraktionssitzung geplant" text={me.gr ? 'Lege die nächste Sitzung an. Alle bekommen dann eine Kalendereinladung.' : 'Sobald ein Gemeinderat die nächste Sitzung anlegt, siehst du sie hier.'}>
          {me.gr && <a className="knopf" href="#sitzungen">Sitzung anlegen</a>}
        </Leer>
      )}

      <Einrichtung />
      <Infos />

      <div className="raster2">
        <section className="abschnitt">
          <div className="abschnitt-kopf"><h2>Neu seit deinem letzten Besuch</h2></div>
          {!letzterBesuch ? (
            <p className="leise">Willkommen! Ab deinem nächsten Besuch siehst du hier, was sich inzwischen getan hat.</p>
          ) : neu.length === 0 ? (
            <p className="leise">Seit {zeitpunkt(letzterBesuch)} Uhr ist nichts Neues dazugekommen.</p>
          ) : (
            <ul className="liste">
              {neu.map((x, i) => (
                <li key={i}>
                  <a className="zeile" href={x.href}>
                    <span className="neu-punkt" aria-hidden="true" />
                    <span className="zeile-haupt">
                      <span className="zeile-titel">{x.text}</span>
                      <span className="zeile-meta">{x.wer && <span>{x.wer}</span>}<span>{zeitpunkt(x.ts)}</span></span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="abschnitt">
          <div className="abschnitt-kopf"><h2>Offene Aufgaben</h2><span className="leise klein">{aufgaben.length} offen</span></div>
          {aufgaben.length === 0 ? <p className="leise">Keine offenen Aufgaben. Aufgaben entstehen im Sitzungsmodus.</p> : (
            <ul className="liste">
              {aufgaben.slice(0, 6).map((a) => <AufgabeZeile key={a.id} a={a} heute={heute} />)}
            </ul>
          )}
        </section>
      </div>

      <div className="raster2">
        <section className="abschnitt">
          <div className="abschnitt-kopf"><h2>Zuletzt geänderte Anträge</h2><a href="#antraege" className="klein">Alle Anträge</a></div>
          <ul className="liste">
            {antraege.map((a) => (
              <li key={a.id}>
                <a className="zeile" href={`#antrag-${a.id}`}>
                  <span className="zeile-haupt">
                    <span className="zeile-titel">{a.titel}</span>
                    <span className="zeile-meta"><Status status={a.status} /><span>{a.art}</span><span>geändert {zeitpunkt(a.geaendertAm)}</span></span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="abschnitt">
          <div className="abschnitt-kopf"><h2>Neue Videothemen</h2><a href="#videothemen" className="klein">Alle Videothemen</a></div>
          {videos.length === 0 ? (
            <Leer titel="Noch keine Videothemen" text="Schlag Markus ein Thema für sein nächstes Facebook-Video vor.">
              <button className="knopf" onClick={() => oeffne(() => <VideoDialog />)}><Icon n="plus" />Thema vorschlagen</button>
            </Leer>
          ) : <ul className="liste">{videos.map((v) => <VideoZeile key={v.id} v={v} />)}</ul>}
        </section>
      </div>
    </>
  );
}
