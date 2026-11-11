'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer } from './ui';
import { Ablage, DateiListe, dateiUrl, lesbar } from './Dateien';
import Bilanz from './Bilanz';

const ERGEBNIS_TON = { angenommen: 'gut', 'abgeändert angenommen': 'gut', abgelehnt: 'schlecht', abgesetzt: 'offen', vertagt: 'offen', 'zur Kenntnis genommen': 'leise' };
const STAND_TON = { Protokoll: 'gut', Protokollentwurf: 'offen', 'kein Protokoll': 'schlecht' };
import { zeitpunkt, LINIEN, LINIE_TON, GR_ERGEBNISSE, datumLang, datumKurz, wienTag } from '@/lib/domain';

function Freischalten() {
  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Gemeinderäte</h1>
      <p className="leise" style={{ margin: '8px 0 0' }}>Dieser Bereich ist für die Gemeinderäte der GFG. Wenn du Gemeinderat bist und ihn nicht siehst, bitte den Admin, dir die Rolle zu geben.</p>
    </div>
  );
}

export function Einstellungen() {
  const { config, mutate, toast } = useApp();
  const [frist, setFrist] = useState(config.fristTage ?? 3);
  const [ordner, setOrdner] = useState(config.driveFolderId || '');
  const [url, setUrl] = useState(config.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''));
  const [busy, setBusy] = useState(false);
  return (
    <form className="flaeche" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        const daten = { fristTage: frist, driveFolderId: ordner, appUrl: url };
        await mutate('config.speichern', daten, 'Einstellungen gespeichert');
      } catch (err) { toast(err.message, true); }
      setBusy(false);
    }}>
      <div className="feld-reihe">
        <Feld label="Standard-Einreichfrist">
          <select value={frist} onChange={(e) => setFrist(e.target.value)}>{[1, 2, 3, 4, 5, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'Tag' : 'Tage'} vor der Sitzung</option>)}</select>
        </Feld>
        <Feld label="Google-Drive-Ordner (ID)" hinweis="Ordner „GFG Fraktionssitzungen“ im geteilten GFG-Ordner."><input value={ordner} onChange={(e) => setOrdner(e.target.value)} /></Feld>
      </div>
      <Feld label="Adresse der App" hinweis="Wird in Einladungen und Mails verlinkt."><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Feld>
      <button className="knopf" disabled={busy}>Einstellungen speichern</button>
    </form>
  );
}

function Linie({ wert }) {
  return <span className={`etikett ton-${LINIE_TON[wert] || 'leise'}`}>{wert === 'offen' ? 'Linie offen' : wert}</span>;
}

function GrSitzungDialog({ g }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [f, setF] = useState({
    titel: g?.titel || 'Gemeinderatssitzung', datum: g?.datum || '', uhrzeit: g?.uhrzeit || '19:00', ort: g?.ort || '', notiz: g?.notiz || '',
    unterlagen: g?.unterlagen?.length ? g.unterlagen : [{ titel: '', url: '' }],
    // Dateien werden in der Sitzung selbst abgelegt
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={g ? 'Gemeinderatssitzung bearbeiten' : 'Gemeinderatssitzung anlegen'} onClose={schliesse}
      onSubmit={async () => {
        const r = await mutate('grsitzung.speichern', { ...f, id: g?.id, unterlagen: f.unterlagen.filter((u) => u.url) }, 'Gemeinderatssitzung gespeichert');
        if (!g) window.location.hash = `grsitzung-${r.id}`;
      }}
      gefahr={g && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Gemeinderatssitzung löschen?', 'Alle TOPs und Abstimmungslinien dieser Sitzung werden gelöscht, auch aus dem Archiv.')) {
            try { await mutate('grsitzung.loeschen', { id: g.id }, 'Gelöscht'); window.location.hash = 'gemeinderaete'; } catch (e) { toast(e.message, true); }
          }
        }}>Löschen</button>
      )}>
      <Feld label="Bezeichnung"><input value={f.titel} onChange={set('titel')} maxLength={160} /></Feld>
      <div className="feld-reihe">
        <Feld label="Datum"><input type="date" value={f.datum} onChange={set('datum')} required /></Feld>
        <Feld label="Beginn"><input type="time" value={f.uhrzeit} onChange={set('uhrzeit')} /></Feld>
      </div>
      <Feld label="Ort"><input value={f.ort} onChange={set('ort')} maxLength={160} placeholder="z. B. Gemeindeamt Großebersdorf" /></Feld>
      <div className="feld">
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Weitere Unterlagen als Link (optional)</span>
        {f.unterlagen.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 8, marginBottom: 8 }}>
            <input className="eingabe" placeholder="Bezeichnung" value={d.titel} aria-label="Bezeichnung"
              onChange={(e) => setF((x) => ({ ...x, unterlagen: x.unterlagen.map((y, j) => (j === i ? { ...y, titel: e.target.value } : y)) }))} />
            <input className="eingabe" type="url" placeholder="https://" value={d.url} aria-label="Link"
              onChange={(e) => setF((x) => ({ ...x, unterlagen: x.unterlagen.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)) }))} />
          </div>
        ))}
        <button type="button" className="knopf still klein" onClick={() => setF((x) => ({ ...x, unterlagen: [...x.unterlagen, { titel: '', url: '' }] }))}><Icon n="plus" size={16} />Weitere Unterlage</button>
      </div>
      <Feld label="Notizen zur Sitzung"><textarea value={f.notiz} onChange={set('notiz')} maxLength={4000} /></Feld>
    </DialogForm>
  );
}

function TopDialog({ g, top }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const vorbei = g.datum < wienTag();
  const [f, setF] = useState({
    key: top?.key || '', nr: top?.nr || String((g.tops?.length || 0) + 1), titel: top?.titel || '', unterlage: top?.unterlage || '',
    linie: top?.linie || 'offen', begruendung: top?.begruendung || '', sprecher: top?.sprecher || '', wortmeldung: top?.wortmeldung || '',
    ergebnis: top?.ergebnis || '', abgestimmt: top?.abgestimmt || '', datei: top?.datei || '', nichtOeffentlich: !!top?.nichtOeffentlich,
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <DialogForm titel={top ? `TOP ${top.nr || ''} bearbeiten` : 'TOP hinzufügen'} onClose={schliesse} knopf="TOP speichern"
      onSubmit={() => mutate('grsitzung.top', { id: g.id, top: f }, 'TOP gespeichert')}
      gefahr={top && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('TOP entfernen?', top.titel, 'Entfernen')) { try { await mutate('grsitzung.top', { id: g.id, top: f, loeschen: true }, 'TOP entfernt'); } catch (e) { toast(e.message, true); } }
        }}>Entfernen</button>
      )}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
        <Feld label="Nr."><input value={f.nr} onChange={set('nr')} maxLength={10} /></Feld>
        <Feld label="Titel des TOP"><input value={f.titel} onChange={set('titel')} required maxLength={250} /></Feld>
      </div>
      {(g.dateien || []).length > 0 && (
        <Feld label="Zugehörige Datei">
          <select value={f.datei} onChange={set('datei')}>
            <option value="">keine</option>
            {g.dateien.map((d) => <option key={d.pfad} value={d.pfad}>{d.name}</option>)}
          </select>
        </Feld>
      )}
      <Feld label="Unterlage als Link (optional)"><input type="url" value={f.unterlage} onChange={set('unterlage')} placeholder="https://" /></Feld>
      <label className="schalter-zeile" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={f.nichtOeffentlich} onChange={(e) => setF((x) => ({ ...x, nichtOeffentlich: e.target.checked }))} />
        <span>Nicht öffentlicher Teil</span>
      </label>
      <Feld label="Unsere Abstimmungslinie">
        <select value={f.linie} onChange={set('linie')}>{LINIEN.map((l) => <option key={l} value={l}>{l === 'offen' ? 'noch offen' : l === 'freigegeben' ? 'Abstimmung freigegeben' : l}</option>)}</select>
      </Feld>
      <Feld label="Begründung"><textarea value={f.begruendung} onChange={set('begruendung')} maxLength={3000} /></Feld>
      <Feld label="Wer spricht?"><input value={f.sprecher} onChange={set('sprecher')} maxLength={200} placeholder="z. B. GR Johannes Bayer" /></Feld>
      <Feld label="Kernaussagen der Wortmeldung"><textarea value={f.wortmeldung} onChange={set('wortmeldung')} maxLength={3000} style={{ minHeight: 80 }} /></Feld>
      <div className="feld-reihe">
        <Feld label={vorbei ? 'Ergebnis im Gemeinderat' : 'Ergebnis (nach der Sitzung)'}>
          <select value={f.ergebnis} onChange={set('ergebnis')}>{GR_ERGEBNISSE.map((e) => <option key={e} value={e}>{e || 'noch nicht bekannt'}</option>)}</select>
        </Feld>
        <Feld label="So hat die GFG abgestimmt">
          <select value={f.abgestimmt} onChange={set('abgestimmt')}>
            <option value="">noch nicht erfasst</option>
            {['dafür', 'dagegen', 'Enthaltung', 'uneinheitlich'].map((e) => <option key={e}>{e}</option>)}
          </select>
        </Feld>
      </div>
    </DialogForm>
  );
}


/** Lässt eine abgelegte Einladung lesen und liefert Datum, Ort und TOPs */
async function erkenne(datei, fortschritt = () => {}) {
  const frage = async (body) => {
    const r = await fetch('/api/grsitzung/erkennen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.fehler || 'Die Datei konnte nicht gelesen werden.');
    return j;
  };
  fortschritt('Datei wird gelesen');
  const j = /^image\//.test(datei.typ || '') ? { scan: true, tops: [] } : await frage({ pfad: datei.pfad });
  if (!j.scan || j.tops?.length) return j;
  // Gescannte Einladung: Text im Browser erkennen, dann auswerten
  const { leseScan } = await import('./ocr');
  const text = await leseScan(dateiUrl(datei), fortschritt);
  return frage({ text });
}
const wieEinladung = (d) => /einladung|kurrende|tagesordnung|kundmachung/i.test(d.name || '');

/** Vorschau der erkannten TOPs: prüfen, ändern, übernehmen */
function TopVorschau({ g, erkannt, datei, dateien }) {
  const { mutate, schliesse } = useApp();
  const vorhanden = g?.tops?.length || 0;
  const [kopf, setKopf] = useState({
    titel: g?.titel || 'Gemeinderatssitzung', datum: erkannt.datum || g?.datum || '', uhrzeit: erkannt.uhrzeit || g?.uhrzeit || '19:00', ort: erkannt.ort || g?.ort || '',
  });
  const [tops, setTops] = useState((erkannt.tops || []).map((t) => ({ ...t, an: true })));
  const [ersetzen, setErsetzen] = useState(false);
  const setK = (k) => (e) => setKopf((x) => ({ ...x, [k]: e.target.value }));
  const setT = (i, k, v) => setTops((x) => x.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const gewaehlt = tops.filter((t) => t.an && t.titel.trim());
  const abweichend = g && ((erkannt.datum && erkannt.datum !== g.datum) || (erkannt.uhrzeit && erkannt.uhrzeit !== g.uhrzeit));
  return (
    <DialogForm titel={g ? 'Erkannte TOPs übernehmen' : 'Sitzung aus der Einladung anlegen'} onClose={schliesse}
      knopf={g ? `${gewaehlt.length} TOPs übernehmen` : 'Sitzung anlegen'}
      onSubmit={async () => {
        if (g) {
          await mutate('grsitzung.topsUebernehmen', { id: g.id, tops: gewaehlt, ersetzen, ...(abweichend || !g.ort ? { datum: kopf.datum, uhrzeit: kopf.uhrzeit, ort: kopf.ort } : {}) }, `${gewaehlt.length} TOPs übernommen`);
        } else {
          const r = await mutate('grsitzung.speichern', { ...kopf, tops: gewaehlt, dateien }, 'Gemeinderatssitzung angelegt');
          window.location.hash = `grsitzung-${r.id}`;
        }
      }}>
      <p className="hinweis info" style={{ marginBottom: 16 }}>
        Aus <b>{datei.name}</b> gelesen. Bitte kurz prüfen: Titel lassen sich direkt ändern, Häkchen entfernen schließt einen Punkt aus.
      </p>
      {(!g || abweichend || !g.ort) && (
        <>
          {!g && <Feld label="Bezeichnung"><input value={kopf.titel} onChange={setK('titel')} maxLength={160} /></Feld>}
          <div className="feld-reihe">
            <Feld label="Datum"><input type="date" value={kopf.datum} onChange={setK('datum')} required={!g} /></Feld>
            <Feld label="Beginn"><input type="time" value={kopf.uhrzeit} onChange={setK('uhrzeit')} /></Feld>
          </div>
          <Feld label="Ort"><input value={kopf.ort} onChange={setK('ort')} maxLength={160} /></Feld>
          {abweichend && <p className="leise klein" style={{ marginTop: -6, marginBottom: 14 }}>Datum oder Beginn weichen von der angelegten Sitzung ab und werden mit übernommen.</p>}
        </>
      )}
      {tops.length === 0 ? (
        <p className="hinweis fehler">In dieser Datei wurden keine nummerierten Tagesordnungspunkte gefunden. Du kannst die TOPs trotzdem händisch eintragen.</p>
      ) : (
        <ol className="top-vorschau">
          {tops.map((t, i) => (
            <li key={i} className={t.an ? '' : 'aus'}>
              <input type="checkbox" checked={t.an} onChange={(e) => setT(i, 'an', e.target.checked)} aria-label={`TOP ${t.nr} übernehmen`} />
              <input className="nr" value={t.nr} onChange={(e) => setT(i, 'nr', e.target.value)} aria-label="Nummer" maxLength={6} />
              <textarea rows={Math.min(5, Math.ceil(t.titel.length / 32) || 1)} value={t.titel} onChange={(e) => setT(i, 'titel', e.target.value)} aria-label={`Titel TOP ${t.nr}`} maxLength={250} />
              <label className="noe" title="Nicht öffentlicher Teil">
                <input type="checkbox" checked={!!t.nichtOeffentlich} onChange={(e) => setT(i, 'nichtOeffentlich', e.target.checked)} />n. ö.
              </label>
            </li>
          ))}
        </ol>
      )}
      {vorhanden > 0 && tops.length > 0 && (
        <label className="schalter-zeile" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} />
          <span>Bisherige {vorhanden} TOPs ersetzen <span className="leise klein">(TOPs mit Linie oder Begründung bleiben erhalten)</span></span>
        </label>
      )}
    </DialogForm>
  );
}

/** Unterlagen einer GR-Sitzung: ablegen, öffnen, TOPs daraus erkennen */
function Unterlagen({ g }) {
  const { mutate, oeffne, toast } = useApp();
  const [liest, setLiest] = useState('');
  const [schritt, setSchritt] = useState('');
  const lies = async (d) => {
    setLiest(d.pfad);
    try {
      const e = await erkenne(d, setSchritt);
      oeffne(() => <TopVorschau g={g} erkannt={e} datei={d} />);
    } catch (err) { toast(err.message, true); }
    setLiest(''); setSchritt('');
  };
  return (
    <section className="abschnitt">
      <div className="abschnitt-kopf">
        <h2>Einladung und Unterlagen</h2>
        <span className="leise klein">{(g.dateien || []).length} Dateien</span>
      </div>
      <DateiListe dateien={g.dateien}
        onEntfernen={async (d) => { try { await mutate('grsitzung.datei', { id: g.id, entfernen: d.pfad }, 'Datei entfernt'); } catch (e) { toast(e.message, true); } }}
        aktion={(d) => lesbar(d) && (
          <button type="button" className="knopf zweit klein" disabled={!!liest} onClick={() => lies(d)}>
            <Icon n="funke" size={16} />{liest === d.pfad ? 'Liest …' : 'TOPs erkennen'}
          </button>
        )} />
      {liest && <p className="hinweis info" aria-live="polite" style={{ marginBottom: 10 }}>{schritt || 'Wird gelesen'} … Bei gescannten Einladungen dauert das etwa eine halbe Minute.</p>}
      <Ablage bereich="gr" kompakt={(g.dateien || []).length > 0}
        text="Einladungskurrende und Unterlagen ablegen" hinweis="PDF, Word, Bilder. Aus der Einladung werden die TOPs automatisch gelesen."
        onFertig={async (neu) => {
          await mutate('grsitzung.datei', { id: g.id, dateien: neu }, neu.length > 1 ? `${neu.length} Dateien abgelegt` : 'Datei abgelegt');
          const einladung = neu.find((d) => lesbar(d) && wieEinladung(d)) || (!(g.tops || []).length && neu.find(lesbar));
          if (einladung) await lies(einladung);
        }} />
      {g.unterlagen?.length > 0 && <div className="verweise" style={{ marginTop: 12 }}>{g.unterlagen.map((u, i) => <a key={i} href={u.url} target="_blank" rel="noreferrer"><Icon n="link" size={18} />{u.titel}</a>)}</div>}
    </section>
  );
}

/** Neue GR-Sitzung direkt aus der hochgeladenen Einladung */
function AusEinladung() {
  const { oeffne, toast } = useApp();
  const [liest, setLiest] = useState(false);
  const [schritt, setSchritt] = useState('');
  return liest ? <p className="hinweis info" aria-live="polite">{schritt || 'Einladung wird gelesen'} … Bei gescannten Einladungen dauert das etwa eine halbe Minute.</p> : (
    <Ablage bereich="gr" mehrere={false} accept=".pdf,.docx,.txt,application/pdf,image/*"
      text="Neue Einladung ablegen" hinweis="Die Sitzung wird mit Datum, Ort und allen TOPs vorbereitet."
      onFertig={async ([d]) => {
        setLiest(true);
        try {
          const e = await erkenne(d, setSchritt);
          oeffne(() => <TopVorschau erkannt={e} datei={d} dateien={[d]} />);
        } catch (err) { toast(err.message, true); }
        setLiest(false);
      }} />
  );
}

export function GrSitzungDetail({ id }) {
  const { daten, me, oeffne } = useApp();
  if (!me.gr) return <Freischalten />;
  const g = (daten.grsitzungen || []).find((x) => x.id === id);
  if (!g) return <><a className="zurueck" href="#gemeinderaete"><Icon n="zurueck" size={18} />Gemeinderäte</a><Leer titel="Sitzung nicht gefunden" /></>;
  const tops = g.tops || [];
  const mitLinie = tops.filter((t) => t.linie && t.linie !== 'offen').length;
  const vorbei = g.datum < wienTag();
  return (
    <>
      <a className="zurueck" href="#gemeinderaete"><Icon n="zurueck" size={18} />Gemeinderäte</a>
      <div className="abschnitt-kopf">
        <div>
          <h1>{g.titel || 'Gemeinderatssitzung'}</h1>
          <p className="leise">{datumLang(g.datum)}{g.uhrzeit ? `, ${g.uhrzeit} Uhr` : ''}{g.ort ? `, ${g.ort}` : ''}</p>
          {g.stand && <p className="zeile-meta" style={{ marginTop: 6 }}><span className={`etikett ton-${STAND_TON[g.stand] || 'leise'}`}>{g.stand === 'kein Protokoll' ? 'Protokoll fehlt noch' : g.stand}</span>
            {(g.unterlagen || []).filter((u) => u.url).map((u, i) => <a key={i} href={u.url} target="_blank" rel="noreferrer">{u.titel}</a>)}</p>}
        </div>
        <button className="knopf zweit" onClick={() => oeffne(() => <GrSitzungDialog g={g} />)}><Icon n="stift" size={18} />Bearbeiten</button>
      </div>
      {g.notiz && <p style={{ whiteSpace: 'pre-wrap', marginTop: 14 }}>{g.notiz}</p>}

      <section className="abschnitt">
        <div className="abschnitt-kopf">
          <h2>Tagesordnung der Gemeinde</h2>
          <span className="leise klein">{tops.length} TOPs, {vorbei ? `${tops.filter((t) => t.ergebnis).length} mit Ergebnis` : `${mitLinie} mit Linie`}</span>
        </div>
        {tops.length === 0 ? <Leer titel="Noch keine TOPs" text="Leg unten die Einladung ab, dann werden die TOPs automatisch eingetragen. Oder trag sie händisch ein." /> : (
          <div>
            {tops.map((t) => (
              <article key={t.key} className="top">
                <span className="to-nr">{t.nr || '•'}</span>
                <div>
                  <div className="zeile-titel">{t.titel}</div>
                  <div className="zeile-meta">
                    {t.gfgAntrag && <span className="etikett ton-aktiv">GFG-Antrag</span>}
                    {!(t.ergebnis && t.linie === t.abgestimmt) && !(vorbei && (!t.linie || t.linie === 'offen')) && <Linie wert={t.linie} />}
                    {t.nichtOeffentlich && <span className="etikett ton-leise">nicht öffentlich</span>}
                    {t.ergebnis && <span className={`etikett ton-${ERGEBNIS_TON[t.ergebnis] || 'aktiv'}`}>{t.ergebnis}{t.stimmen ? `, ${t.stimmen}` : ''}</span>}
                    {t.abgestimmt && <span>GFG stimmte {t.abgestimmt === 'uneinheitlich' ? 'uneinheitlich' : t.abgestimmt}</span>}
                    {t.unterlage && <a href={t.unterlage} target="_blank" rel="noreferrer">Unterlage</a>}
                    {t.datei && <a href={dateiUrl({ pfad: t.datei, name: (g.dateien || []).find((d) => d.pfad === t.datei)?.name })} target="_blank" rel="noreferrer">{(g.dateien || []).find((d) => d.pfad === t.datei)?.name || 'Datei'}</a>}
                  </div>
                  {(t.begruendung || t.sprecher || t.wortmeldung) && (
                    <div className="top-linie">
                      {t.begruendung && <div><b>{t.geaendertVon === 'Übernahme' ? 'Aus dem Protokoll' : 'Begründung'}</b><br />{t.begruendung}</div>}
                      {t.sprecher && <div><b>Wortmeldung</b><br />{t.sprecher}{t.wortmeldung ? `: ${t.wortmeldung}` : ''}</div>}
                    </div>
                  )}
                  {t.geaendertVon && t.geaendertVon !== 'Übernahme' && <p className="leise mini" style={{ marginTop: 6 }}>Zuletzt {t.geaendertVon}, {zeitpunkt(t.geaendertAm)}</p>}
                </div>
                <button className="knopf still klein" aria-label={`TOP ${t.nr} bearbeiten`} onClick={() => oeffne(() => <TopDialog g={g} top={t} />)}><Icon n="stift" size={18} /></button>
              </article>
            ))}
          </div>
        )}
        <button className="knopf zweit" style={{ marginTop: 16 }} onClick={() => oeffne(() => <TopDialog g={g} />)}><Icon n="plus" size={18} />TOP händisch hinzufügen</button>
      </section>
      <Unterlagen g={g} />
    </>
  );
}

function Vorbereitung() {
  const { daten, oeffne } = useApp();
  const heute = wienTag();
  const alle = [...(daten.grsitzungen || [])];
  const kommend = alle.filter((g) => g.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum));
  const vergangen = alle.filter((g) => g.datum < heute).sort((a, b) => b.datum.localeCompare(a.datum));
  const zeile = (g) => {
    const tops = g.tops || [];
    const offen = tops.filter((t) => !t.linie || t.linie === 'offen').length;
    return (
      <li key={g.id}>
        <a className="zeile" href={`#grsitzung-${g.id}`}>
          <span className="zeile-haupt">
            <span className="zeile-titel">{g.titel || 'Gemeinderatssitzung'} am {datumKurz(g.datum)}</span>
            <span className="zeile-meta"><span>{tops.length} TOPs</span>{offen > 0 && g.datum >= heute && <span className="etikett ton-offen">{offen} ohne Linie</span>}
              {tops.some((t) => t.gfgAntrag) && <span className="etikett ton-aktiv">{tops.filter((t) => t.gfgAntrag).length} GFG-Anträge</span>}
              {g.stand && g.datum < heute && <span className={`etikett ton-${STAND_TON[g.stand] || 'leise'}`}>{g.stand === 'kein Protokoll' ? 'Protokoll fehlt' : g.stand}</span>}
              {g.ort && g.datum >= heute && <span>{g.ort}</span>}</span>
          </span>
          <Icon n="weiter" />
        </a>
      </li>
    );
  };
  return (
    <>
      <div className="abschnitt-kopf">
        <h2>Kommende Gemeinderatssitzungen</h2>
        <button className="knopf zweit" onClick={() => oeffne(() => <GrSitzungDialog />)}><Icon n="plus" />Händisch anlegen</button>
      </div>
      {kommend.length ? <ul className="liste">{kommend.map(zeile)}</ul> : <p className="leise" style={{ marginBottom: 14 }}>Keine kommende Gemeinderatssitzung angelegt.</p>}
      <div style={{ marginTop: 16 }}><AusEinladung /></div>
      {vergangen.length > 0 && (
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Vergangene</h2>
          <ul className="liste">{vergangen.map(zeile)}</ul>
        </section>
      )}
    </>
  );
}

function Archiv() {
  const { daten } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('alle');
  const FILTER = [['alle', 'Alle'], ['gfg', 'GFG-Anträge'], ['dagegen', 'GFG dagegen'], ['abgelehnt', 'Abgelehnt']];
  const zeilen = (daten.grsitzungen || [])
    .flatMap((g) => (g.tops || []).map((t) => ({ ...t, g })))
    .filter((t) => !t.nichtOeffentlich || t.ergebnis)
    .filter((t) => filter === 'alle' || (filter === 'gfg' && t.gfgAntrag) || (filter === 'dagegen' && t.abgestimmt === 'dagegen') || (filter === 'abgelehnt' && t.ergebnis === 'abgelehnt'))
    .filter((t) => !q.trim() || `${t.titel} ${t.begruendung} ${t.ergebnis}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.g.datum.localeCompare(a.g.datum) || (Number(a.nr) || 999) - (Number(b.nr) || 999));
  return (
    <>
      <p className="leise" style={{ marginBottom: 14 }}>Alle Tagesordnungspunkte seit 2025 mit Ergebnis und unserem Abstimmungsverhalten, aus Einladungen und Protokollen.</p>
      <div className="archiv-filter">
        <input className="eingabe" type="search" placeholder="Suchen, z. B. Kläranlage" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Archiv durchsuchen" />
        <div className="chips" role="group" aria-label="Filter">
          {FILTER.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </div>
      <p className="leise klein" style={{ margin: '0 0 10px' }}>{zeilen.length} Einträge</p>
      {zeilen.length === 0 ? <p className="leise">Keine Einträge.</p> : (
        <table className="tabelle archiv-tabelle">
          <thead><tr><th>Sitzung</th><th>TOP</th><th>GFG stimmte</th><th>Ergebnis</th></tr></thead>
          <tbody>
            {zeilen.map((t) => (
              <tr key={t.g.id + t.key}>
                <td className="nowrap"><a href={`#grsitzung-${t.g.id}`}>{datumKurz(t.g.datum)}</a></td>
                <td>
                  <b>{t.nr ? `${t.nr}. ` : ''}{t.titel}</b>{t.gfgAntrag && <span className="etikett ton-aktiv" style={{ marginLeft: 6 }}>GFG-Antrag</span>}
                  {t.begruendung && <div className="leise klein">{t.begruendung}</div>}
                </td>
                <td>{t.abgestimmt ? <Linie wert={t.abgestimmt} /> : <span className="leise">nicht erfasst</span>}</td>
                <td>{t.ergebnis ? <span className={`etikett ton-${ERGEBNIS_TON[t.ergebnis] || 'aktiv'}`}>{t.ergebnis}{t.stimmen ? `, ${t.stimmen}` : ''}</span> : <span className="leise">offen</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Verwaltung() {
  const { google, config, mutate, toast, me } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <section>
        <h2 style={{ marginBottom: 12 }}>Einstellungen</h2>
        <Einstellungen />
      </section>

      {me.admin && <p className="klein" style={{ marginTop: 14 }}>Personen, Rollen und E-Mail-Adressen pflegst du unter <a href="#verwaltung">Personen und Rollen</a>.</p>}

      <div className="raster2">
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Google-Verbindung</h2>
          <div className="flaeche">
            {!google?.eingerichtet ? (
              <p className="klein">Noch nicht eingerichtet. Damit Kalendereinladungen, Google Docs und Mails funktionieren, müssen <b>GOOGLE_CLIENT_ID</b> und <b>GOOGLE_CLIENT_SECRET</b> im Vercel-Projekt hinterlegt sein. Die Anleitung steht in der README des GitHub-Repos.</p>
            ) : google.verbunden ? (
              <>
                <p><b>Verbunden</b> mit {google.email || 'einem Google-Konto'}.</p>
                <p className="leise klein" style={{ margin: '4px 0 14px' }}>Seit {zeitpunkt(google.verbundenAm)}. Einladungen, Docs und Mails laufen über dieses Konto.</p>
                <a className="knopf zweit klein" href="/api/google/connect">Anderes Konto verbinden</a>
              </>
            ) : (
              <>
                <p className="klein" style={{ marginBottom: 14 }}>Verbinde das Google-Konto, über das Einladungen, Tagesordnungen und Protokolle laufen sollen.</p>
                <a className="knopf" href="/api/google/connect">Google-Konto verbinden</a>
              </>
            )}
          </div>
        </section>
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Automatik</h2>
          <div className="flaeche klein">
            <p>Jeden Morgen um ca. 7 Uhr prüft die App alle kommenden Sitzungen:</p>
            <ul style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
              <li>Nach Ablauf der Einreichfrist wird die Tagesordnung festgelegt, als Google Doc gespeichert und an alle gemailt.</li>
              <li>7 Tage und 1 Tag vorher geht eine Erinnerung per Mail raus.</li>
              <li>Themen aus dem <a href={config.jotformThemenUrl} target="_blank" rel="noreferrer">Jotform-Formular</a> werden übernommen{config.jotformAktiv ? '' : ', sobald JOTFORM_API_KEY eingetragen ist'}.</li>
            </ul>
            {config.jotformAktiv && (
              <button className="knopf zweit klein" disabled={busy} onClick={async () => {
                setBusy(true);
                try { const r = await mutate('jotform.abrufen', {}); toast(r.neu ? `${r.neu} neue Themen übernommen` : 'Keine neuen Formular-Einreichungen'); } catch (e) { toast(e.message, true); }
                setBusy(false);
              }}>Formular jetzt abrufen</button>
            )}
            {config.jotformLetzterAbruf && <p className="leise mini" style={{ marginTop: 8 }}>Zuletzt abgerufen {zeitpunkt(config.jotformLetzterAbruf)}</p>}
          </div>
        </section>
      </div>

    </>
  );
}

export default function Gemeinderaete({ unter }) {
  const { me } = useApp();
  const [reiter, setReiter] = useState(unter || 'vorbereitung');
  if (!me.gr) return <Freischalten />;
  const REITER = [['vorbereitung', 'GR-Sitzungen'], ['bilanz', 'Bilanz'], ['archiv', 'Archiv'], ['verwaltung', 'Einstellungen']];
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Gemeinderäte</h1>

      </div>
      <div className="unterreiter" role="tablist">
        {REITER.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={reiter === k} onClick={() => setReiter(k)}>{l}</button>)}
      </div>
      {reiter === 'vorbereitung' && <Vorbereitung />}
      {reiter === 'bilanz' && <Bilanz />}
      {reiter === 'archiv' && <Archiv />}
      {reiter === 'verwaltung' && <Verwaltung />}
    </>
  );
}
