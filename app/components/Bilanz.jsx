'use client';
import { useApp, Icon, Leer } from './ui';
import { bilanzGruppe, letzteNeuigkeit, monateZwischen, datumKurz, wienTag } from '@/lib/domain';

const stimmenAus = (a) => {
  for (const v of [...(a.verlauf || [])].reverse()) {
    const m = String(v.notiz || '').match(/(\d{1,2}):(\d{1,2})/);
    if (m && ['abgelehnt', 'abgesetzt', 'angenommen'].includes(v.status)) return `${m[1]}:${m[2]}`;
  }
  return '';
};
const datumVon = (a, status) => (a.verlauf || []).find((v) => v.status === status)?.datum || a.datum;
const monateText = (m) => (m < 1 ? 'weniger als einem Monat' : m === 1 ? 'einem Monat' : `${m} Monaten`);

function Zeile({ a, rechts, unter }) {
  return (
    <li>
      <a className="zeile bilanz-zeile" href={`#antrag-${a.id}`}>
        <span className="zeile-haupt">
          <span className="zeile-titel">{a.titel}</span>
          <span className="zeile-meta">{unter}</span>
        </span>
        {rechts}
        <Icon n="weiter" />
      </a>
    </li>
  );
}

export default function Bilanz() {
  const { daten } = useApp();
  const heute = wienTag();
  const alle = (daten.antraege || []).map((a) => ({ ...a, gruppe: bilanzGruppe(a) })).filter((a) => a.gruppe);
  if (!alle.length) return <Leer titel="Noch keine Anträge erfasst" text="Sobald Anträge im Reiter Anträge eingetragen sind, entsteht hier die Bilanz." />;

  const angenommen = alle.filter((a) => a.gruppe === 'angenommen');
  const behandlung = alle.filter((a) => a.gruppe === 'behandlung');
  const abgelehnt = alle.filter((a) => a.gruppe === 'abgelehnt');
  const vonAnderen = alle.filter((a) => a.vonAnderen);
  const stillstand = [...angenommen, ...behandlung]
    .filter((a) => !a.umsetzung || a.umsetzung === 'noch nichts passiert')
    .map((a) => ({ ...a, seit: letzteNeuigkeit(a), monate: monateZwischen(letzteNeuigkeit(a), heute) }))
    .sort((a, b) => b.monate - a.monate || a.seit.localeCompare(b.seit));
  const inUmsetzung = [...angenommen, ...behandlung].filter((a) => a.umsetzung === 'in Umsetzung')
    .sort((a, b) => letzteNeuigkeit(b).localeCompare(letzteNeuigkeit(a)));
  const umgesetzt = angenommen.filter((a) => a.umsetzung === 'umgesetzt');
  const seit = alle.map((a) => String(a.datum || '')).filter(Boolean).sort()[0];
  const max = Math.max(12, ...stillstand.map((a) => a.monate));

  const teile = [
    { key: 'angenommen', label: 'Angenommen', klein: 'angenommen', n: angenommen.length, ton: 'gut' },
    { key: 'behandlung', label: 'In Behandlung', klein: 'in Behandlung', n: behandlung.length, ton: 'aktiv' },
    { key: 'abgelehnt', label: 'Abgelehnt oder abgesetzt', klein: 'abgelehnt oder abgesetzt', n: abgelehnt.length, ton: 'schlecht' },
  ];

  return (
    <>
      <p className="leise" style={{ marginBottom: 18 }}>
        Alle Anträge der GFG im Gemeinderat{seit ? ` seit ${datumKurz(seit)}` : ''}, aus den Sitzungsprotokollen.
        Neuigkeiten trägst du direkt beim Antrag ein, dann stimmt auch die Zeit seit der letzten Bewegung.
      </p>

      <div className="bilanz-kacheln">
        <div className="bilanz-kachel gesamt"><span className="bilanz-zahl">{alle.length}</span><span>eingebracht</span></div>
        {teile.map((t) => (
          <div key={t.key} className={`bilanz-kachel k-${t.ton}`}>
            <span className="bilanz-zahl">{t.n}</span><span>{t.klein}</span>
            {t.key === 'angenommen' && <span className="leise mini">{umgesetzt.length} umgesetzt, {angenommen.filter((a) => a.umsetzung === 'in Umsetzung').length} in Umsetzung</span>}
            {t.key === 'behandlung' && <span className="leise mini">in Ausschuss oder Vorstand</span>}
            {t.key === 'abgelehnt' && <span className="leise mini">davon {vonAnderen.length} später von anderen umgesetzt</span>}
          </div>
        ))}
      </div>
      <div className="bilanz-balken" role="img" aria-label={teile.map((t) => `${t.label}: ${t.n}`).join(', ')}>
        {teile.filter((t) => t.n).map((t) => <span key={t.key} className={`b-${t.ton}`} style={{ flexGrow: t.n }} title={`${t.label}: ${t.n}`} />)}
      </div>

      {vonAnderen.length > 0 && (
        <section className="abschnitt">
          <h2>Abgelehnt, dann von anderen umgesetzt</h2>
          <p className="leise klein" style={{ margin: '4px 0 12px' }}>Unser Antrag bekam keine Mehrheit, die Idee wurde später trotzdem umgesetzt.</p>
          <div className="andere-karten">
            {vonAnderen.map((a) => {
              const ab = datumVon(a, a.status);
              const m = monateZwischen(String(ab).slice(0, 10), String(a.vonAnderen.datum || '').slice(0, 10));
              return (
                <a key={a.id} className="andere-karte" href={`#antrag-${a.id}`}>
                  <b>{a.titel}</b>
                  <ol className="andere-weg">
                    <li><span className="punkt p-schlecht" /><span><b>{datumKurz(ab)}</b> Unser Antrag {a.status === 'abgelehnt' ? 'abgelehnt' : 'abgesetzt oder ersetzt'}{stimmenAus(a) ? ` (${stimmenAus(a)})` : ''}</span></li>
                    <li><span className="punkt p-gut" /><span><b>{a.vonAnderen.datum ? datumKurz(a.vonAnderen.datum) : 'später'}</b> Umgesetzt durch {a.vonAnderen.wer || 'andere'}{a.vonAnderen.datum && m > 0 ? `, ${m} ${m === 1 ? 'Monat' : 'Monate'} später` : ''}</span></li>
                  </ol>
                  {a.vonAnderen.notiz && <span className="leise klein">{a.vonAnderen.notiz}</span>}
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="abschnitt">
        <h2>Beschlossen oder zugewiesen, aber es tut sich nichts</h2>
        <p className="leise klein" style={{ margin: '4px 0 12px' }}>Seit der letzten bekannten Neuigkeit. Ab sechs Monaten gelb, ab einem Jahr rot.</p>
        {stillstand.length === 0 ? <p className="leise">Bei allen beschlossenen Anträgen gibt es Bewegung.</p> : (
          <ul className="liste stillstand">
            {stillstand.map((a) => {
              const stufe = a.monate >= 12 ? 'rot' : a.monate >= 6 ? 'gelb' : 'ruhig';
              return (
                <Zeile key={a.id} a={a}
                  unter={<>
                    <span className={`etikett ton-${a.gruppe === 'angenommen' ? 'gut' : 'aktiv'}`}>{a.gruppe === 'angenommen' ? 'beschlossen' : (a.ausschuss ? `bei ${a.ausschuss}` : 'zugewiesen')}</span>
                    <span>letzte Neuigkeit {datumKurz(a.seit)}</span>
                  </>}
                  rechts={(
                    <span className={`still-dauer s-${stufe}`}>
                      <span className="still-balken"><span style={{ width: `${Math.max(4, (a.monate / max) * 100)}%` }} /></span>
                      <b>seit {monateText(a.monate)}</b>
                    </span>
                  )} />
              );
            })}
          </ul>
        )}
      </section>

      <div className="raster2">
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>In Umsetzung</h2>
          {inUmsetzung.length === 0 ? <p className="leise">Nichts.</p> : (
            <ul className="liste">{inUmsetzung.map((a) => <Zeile key={a.id} a={a} unter={<span>letzte Neuigkeit {datumKurz(letzteNeuigkeit(a))}</span>} />)}</ul>
          )}
          <h2 style={{ margin: '26px 0 12px' }}>Umgesetzt</h2>
          {umgesetzt.length === 0 ? <p className="leise">Noch nichts als umgesetzt markiert.</p> : (
            <ul className="liste">{umgesetzt.map((a) => <Zeile key={a.id} a={a} unter={<span>{datumKurz(letzteNeuigkeit(a))}</span>} />)}</ul>
          )}
        </section>
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Abgelehnt oder abgesetzt</h2>
          <ul className="liste">
            {abgelehnt.sort((a, b) => String(b.datum).localeCompare(String(a.datum))).map((a) => (
              <Zeile key={a.id} a={a} unter={<>
                <span>{datumKurz(datumVon(a, a.status))}</span>
                {stimmenAus(a) && <span>{stimmenAus(a)}</span>}
                {a.vonAnderen && <span className="etikett ton-gut">später umgesetzt</span>}
              </>} />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
