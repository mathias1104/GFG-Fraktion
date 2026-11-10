'use client';
import { useApp, useJetzt, Icon, Status, Leer } from './ui';
import { ThemaDialog } from './Sitzungen';
import { AufgabeZeile } from './Aufgaben';
import {
  sitzungStart, sitzungEnde, fristEnde, fristVorbei, fristText, datumLang, datumKurz, wienTag, zeitpunkt,
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
  const n = [];
  const fremd = (id, name) => id !== me.uid && name !== me.name;
  for (const s of daten.sitzungen || []) {
    if (s.erstelltAm > seit) n.push({ ts: s.erstelltAm, text: `Neue Fraktionssitzung am ${datumKurz(s.datum)}`, href: `#sitzung-${s.id}` });
    if (s.tagesordnungVersendetAm > seit) n.push({ ts: s.tagesordnungVersendetAm, text: `Tagesordnung für ${datumKurz(s.datum)} ist da`, href: `#sitzung-${s.id}` });
    else if (s.agendaAm > seit) n.push({ ts: s.agendaAm, text: `Tagesordnung für ${datumKurz(s.datum)} steht fest`, href: `#sitzung-${s.id}` });
    if (s.live?.beendetAm > seit) n.push({ ts: s.live.beendetAm, text: `Protokoll der Sitzung vom ${datumKurz(s.datum)}`, href: `#protokoll-${s.id}` });
  }
  for (const t of daten.themen || []) if (t.erstelltAm > seit && fremd(t.autorId, t.autorName)) n.push({ ts: t.erstelltAm, text: `Neues Thema: ${t.titel}`, wer: t.autorName, href: `#sitzung-${t.sitzungId}` });
  for (const a of daten.antraege || []) {
    for (const v of a.verlauf || []) if (v.ts > seit && v.von !== 'Übernahme' && fremd(v.vonId, v.von)) n.push({ ts: v.ts, text: `${a.titel}: ${v.status}`, wer: v.von, href: `#antrag-${a.id}` });
  }
  for (const a of daten.aufgaben || []) if (a.erstelltAm > seit) n.push({ ts: a.erstelltAm, text: `Neue Aufgabe: ${a.titel}`, wer: a.zustaendigName, href: '#start' });
  for (const b of daten.beschluesse || []) if (b.erstelltAm > seit) n.push({ ts: b.erstelltAm, text: `Beschluss: ${b.text}`, href: `#protokoll-${b.sitzungId}` });
  for (const k of daten.kommentare || []) {
    if (k.am > seit && fremd(k.autorId, k.autorName)) {
      const [art, id] = k.bezug.split(':');
      n.push({ ts: k.am, text: `Kommentar: ${k.text.slice(0, 90)}${k.text.length > 90 ? ' …' : ''}`, wer: k.autorName, href: art === 'antrag' ? `#antrag-${id}` : `#sitzung-${id}` });
    }
  }
  return n.sort((a, b) => b.ts - a.ts).slice(0, 8);
}

export default function Start() {
  const { daten, me, letzterBesuch } = useApp();
  const s = naechsteSitzung(daten.sitzungen || []);
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
          <div className="abschnitt-kopf"><h2>Neue Videothemen</h2></div>
          <Leer titel="Kommt in Etappe 2" text="Hier erscheinen die neuesten Themen für Markus' Facebook-Videos mit den meisten Daumen hoch." />
        </section>
      </div>
    </>
  );
}
