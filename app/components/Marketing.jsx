'use client';
import { useMemo, useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer, initialen } from './ui';
import { Ablage, dateiUrl, istBild, groesse } from './Dateien';
import {
  KANAELE, KANAL, BEITRAG_STATUS, BEITRAG_TON, BEITRAG_FORMATE, STANDARD_MARKE, hashtags,
  wienTag, datumKurz, datumLang, zeitpunkt,
} from '@/lib/domain';

const KREIS = ['In Arbeit', 'Zur Freigabe', 'Freigegeben', 'Veröffentlicht'];
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function useMarke() {
  const { daten } = useApp();
  const m = daten.marke || {};
  return {
    hashtags: m.hashtags?.length ? m.hashtags : STANDARD_MARKE.hashtags,
    bausteine: m.bausteine?.length ? m.bausteine : STANDARD_MARKE.bausteine,
    kanaele: m.kanaele || {},
    regeln: m.regeln ?? STANDARD_MARKE.regeln,
  };
}

const tagPlus = (tag, n) => {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function kopiere(text, toast, was = 'Text') {
  try { await navigator.clipboard.writeText(text); toast(`${was} kopiert`); } catch { toast('Kopieren hat nicht geklappt.', true); }
}

export function BeitragStatus({ status }) {
  return <span className={`etikett ton-${BEITRAG_TON[status] || 'leise'}`}>{status}</span>;
}

function KanalMarken({ kanaele }) {
  return (
    <span className="kanal-marken">
      {(kanaele || []).map((k) => <span key={k} className={`kanal-marke k-${k}`} title={KANAL[k]?.name}>{KANAL[k]?.kurz}</span>)}
    </span>
  );
}

/** Text mit hervorgehobenen Hashtags */
function MitHashtags({ text }) {
  const teile = String(text || '').split(/(#[\p{L}\p{N}_]+)/u);
  return teile.map((t, i) => (t.startsWith('#') ? <span key={i} className="tag">{t}</span> : t));
}

/** So ungefähr sieht der Beitrag im jeweiligen Kanal aus */
export function Vorschau({ b, kanal }) {
  const bilder = (b.medien || []).filter(istBild);
  const video = (b.medien || []).find((d) => /^video\//.test(d.typ || ''));
  const name = b.absender === 'ich' && b.absenderName ? b.absenderName : 'Gemeinsam für unsere Gemeinde';
  const wann = b.datum ? `${datumKurz(b.datum)}${b.uhrzeit ? `, ${b.uhrzeit}` : ''}` : 'noch nicht geplant';
  const kopf = (
    <div className="vs-kopf">
      {b.absender === 'ich' && b.absenderName
        ? <span className="vs-avatar person">{initialen(b.absenderName)}</span>
        : <img className="vs-avatar" src="/logo-zeichen.svg" alt="" />}
      <span><b>{name}</b><span className="vs-zeit">{wann}</span></span>
    </div>
  );
  const medien = (bilder.length > 0 || video) && (
    <div className={`vs-medien n${Math.min(bilder.length || 1, 4)}${kanal === 'instagram' ? ' quadrat' : ''}`}>
      {bilder.length ? bilder.slice(0, kanal === 'instagram' ? 1 : 4).map((d) => <img key={d.pfad} src={dateiUrl(d)} alt="" loading="lazy" />)
        : <div className="vs-video"><Icon n="play" size={34} /><span>{video.name}</span></div>}
    </div>
  );
  if (kanal === 'whatsapp') {
    return (
      <div className="vs vs-wa">
        <div className="vs-wa-kopf"><img src="/logo-zeichen.svg" alt="" /><b>GFG Großebersdorf</b><span>Kanal</span></div>
        <div className="vs-blase">
          {medien}
          <p><MitHashtags text={b.text || 'Noch kein Text'} /></p>
          <span className="vs-zeit">{b.uhrzeit || ''}</span>
        </div>
      </div>
    );
  }
  if (kanal === 'instagram') {
    return (
      <div className="vs vs-ig">
        {kopf}
        {medien || <div className="vs-leer quadrat">Instagram braucht ein Bild oder Video</div>}
        <p><b>{b.absender === 'ich' && b.absenderName ? b.absenderName : 'gfg.grossebersdorf'}</b> <MitHashtags text={b.text || 'Noch kein Text'} /></p>
      </div>
    );
  }
  return (
    <div className="vs vs-fb">
      {kopf}
      <p><MitHashtags text={b.text || 'Noch kein Text'} /></p>
      {medien}
    </div>
  );
}

/** Zeichen und Hashtags je gewähltem Kanal */
function Zaehler({ text, kanaele }) {
  const n = [...String(text || '')].length;
  const h = hashtags(text).length;
  const relevant = kanaele.map((k) => KANAL[k]).filter((k) => k?.limit);
  if (!relevant.length) return <span className="leise mini">{n} Zeichen</span>;
  return (
    <span className="zaehler">
      {relevant.map((k) => {
        const zuviel = n > k.limit || (k.hashtagLimit && h > k.hashtagLimit);
        const lang = !zuviel && n > k.ideal;
        return (
          <span key={k.key} className={zuviel ? 'zuviel' : lang ? 'lang' : ''} title={lang ? `Für ${k.name} eher lang. Gut lesbar bis etwa ${k.ideal} Zeichen.` : undefined}>
            {k.name} {n}/{k.limit.toLocaleString('de-AT')}{k.hashtagLimit ? `, ${h}/${k.hashtagLimit} #` : ''}
          </span>
        );
      })}
    </span>
  );
}

/** Kleine Stilprüfung: passt die Form zum Absender? */
function formHinweis(text, absender) {
  const t = ` ${String(text || '').toLowerCase()} `;
  if (absender === 'wir' && /[\s,.!?(](ich|mein|meine|meinen|mir|mich)[\s,.!?)]/.test(t)) return 'Offizielle GFG-Beiträge schreiben wir in der Wir-Form. Der Text enthält Ich-Form.';
  if (absender === 'ich' && /[\s,.!?(](wir|unser|unsere|uns)[\s,.!?)]/.test(t)) return 'Persönliche Beiträge in der Ich-Form. Der Text enthält Wir-Form, passt das so?';
  return '';
}

export function BeitragDialog({ b, vorlage }) {
  const { mutate, schliesse, daten, me, toast } = useApp();
  const marke = useMarke();
  const basis = b || vorlage || {};
  const [f, setF] = useState({
    titel: basis.titel || '', text: basis.text || '', kanaele: basis.kanaele || ['facebook', 'instagram'], format: basis.format || 'Foto',
    datum: basis.datum || '', uhrzeit: basis.uhrzeit || '', absender: basis.absender || 'wir', absenderName: basis.absenderName || me.name,
    zustaendigId: basis.zustaendigId || me.uid, status: basis.status || 'In Arbeit', link: basis.link || '', notiz: basis.notiz || '',
    medien: basis.medien || [], videoId: basis.videoId || '',
  });
  const [ansicht, setAnsicht] = useState(f.kanaele[0] || 'facebook');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fuege = (t) => setF((x) => ({ ...x, text: x.text ? `${x.text.replace(/\s+$/, '')}\n\n${t}` : t }));
  const kanalUm = (k) => setF((x) => ({ ...x, kanaele: x.kanaele.includes(k) ? x.kanaele.filter((y) => y !== k) : [...x.kanaele, k] }));
  const mitglieder = [...(daten.mitglieder || [])].sort((a, c) => a.name.localeCompare(c.name, 'de'));
  const hinweis = formHinweis(f.text, f.absender);
  // Freigeben darf nur jemand anderer
  const eigen = !b || b.autorId === me.uid;
  const statusWahl = BEITRAG_STATUS.filter((s) => !(eigen && !b?.freigabe && ['Freigegeben', 'Veröffentlicht'].includes(s)) || s === b?.status);
  const vorschauKanaele = f.kanaele.filter((k) => ['facebook', 'instagram', 'whatsapp'].includes(k));
  return (
    <DialogForm breit titel={b ? 'Beitrag bearbeiten' : 'Neuer Beitrag'} onClose={schliesse}
      onSubmit={async () => {
        const z = mitglieder.find((m) => m.id === f.zustaendigId);
        const r = await mutate('beitrag.speichern', { ...f, id: b?.id, zustaendigName: z?.name || '' }, 'Beitrag gespeichert');
        if (r.status !== f.status) toast(`Gespeichert. Status: ${r.status}`);
        if (!b) window.location.hash = `beitrag-${r.id}`;
      }}>
      <div className="editor">
        <div className="editor-form">
          <Feld label="Arbeitstitel" hinweis="Nur intern, erscheint nicht im Beitrag"><input value={f.titel} onChange={set('titel')} required maxLength={140} placeholder="z. B. Rückblick Gemeinderat Dezember" /></Feld>
          <div className="feld">
            <span className="feld-label">Kanäle</span>
            <div className="chips">
              {KANAELE.map((k) => (
                <button key={k.key} type="button" className={`chip k-${k.key}`} aria-pressed={f.kanaele.includes(k.key)} onClick={() => kanalUm(k.key)}>{k.name}</button>
              ))}
            </div>
          </div>
          <div className="feld">
            <span className="feld-label">Absender</span>
            <div className="segment">
              <label><input type="radio" name="abs" checked={f.absender === 'wir'} onChange={() => setF((x) => ({ ...x, absender: 'wir' }))} /><span>GFG offiziell (Wir-Form)</span></label>
              <label><input type="radio" name="abs" checked={f.absender === 'ich'} onChange={() => setF((x) => ({ ...x, absender: 'ich' }))} /><span>Persönlich (Ich-Form)</span></label>
            </div>
          </div>
          {f.absender === 'ich' && <Feld label="Wer postet?"><input value={f.absenderName} onChange={set('absenderName')} maxLength={80} /></Feld>}
          <div className="feld">
            <label className="feld-label" htmlFor="beitrag-text">Text</label>
            <textarea id="beitrag-text" className="eingabe beitrag-text" value={f.text} onChange={set('text')} maxLength={8000} placeholder="Was wollen wir sagen?" />
            <div className="text-fuss">
              <Zaehler text={f.text} kanaele={f.kanaele} />
            </div>
            {hinweis && <p className="hinweis klein" style={{ marginTop: 8 }}>{hinweis}</p>}
            <div className="bausteine">
              {marke.hashtags.map((h) => <button key={h.name} type="button" className="knopf still klein" onClick={() => fuege(h.tags)} title={h.tags}>#{h.name}</button>)}
              {marke.bausteine.map((h) => <button key={h.titel} type="button" className="knopf still klein" onClick={() => fuege(h.text)} title={h.text}><Icon n="plus" size={14} />{h.titel}</button>)}
            </div>
          </div>
          <div className="feld">
            <span className="feld-label">Bilder und Videos</span>
            {f.medien.length > 0 && (
              <div className="medien-raster">
                {f.medien.map((d) => (
                  <figure key={d.pfad}>
                    {istBild(d) ? <img src={dateiUrl(d)} alt={d.name} /> : <div className="medien-datei"><Icon n="video" size={26} /><span>{d.name}</span></div>}
                    <button type="button" className="medien-weg" aria-label={`${d.name} entfernen`} onClick={() => setF((x) => ({ ...x, medien: x.medien.filter((y) => y.pfad !== d.pfad) }))}><Icon n="x" size={14} /></button>
                  </figure>
                ))}
              </div>
            )}
            <Ablage bereich="marketing" kompakt accept="image/*,video/mp4,video/quicktime" text="Bilder oder Videos ablegen" hinweis="Fotos von Bürgerinnen und Bürgern nur mit deren Einverständnis"
              onFertig={async (neu) => setF((x) => ({ ...x, medien: [...x.medien, ...neu.map((d) => ({ ...d, am: Date.now(), von: me.name }))] }))} />
          </div>
          <div className="feld-reihe">
            <Feld label="Format"><select value={f.format} onChange={set('format')}>{BEITRAG_FORMATE.map((x) => <option key={x}>{x}</option>)}</select></Feld>
            <Feld label="Zuständig">
              <select value={f.zustaendigId} onChange={set('zustaendigId')}>
                <option value="">niemand</option>
                {mitglieder.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Feld>
          </div>
          <div className="feld-reihe">
            <Feld label="Geplant für"><input type="date" value={f.datum} onChange={set('datum')} /></Feld>
            <Feld label="Uhrzeit"><input type="time" value={f.uhrzeit} onChange={set('uhrzeit')} /></Feld>
          </div>
          <Feld label="Status" hinweis={eigen && !b?.freigabe ? 'Freigeben muss jemand anderer (Vier-Augen-Prinzip).' : undefined}>
            <select value={f.status} onChange={set('status')}>{statusWahl.map((s) => <option key={s}>{s}</option>)}</select>
          </Feld>
          {f.status === 'Veröffentlicht' && <Feld label="Link zum Beitrag"><input type="url" value={f.link} onChange={set('link')} placeholder="https://" /></Feld>}
          <Feld label="Interne Notiz"><textarea value={f.notiz} onChange={set('notiz')} maxLength={2000} style={{ minHeight: 60 }} placeholder="Ideen zur Bildauswahl, wer fotografiert, …" /></Feld>
        </div>
        {vorschauKanaele.length > 0 && (
          <aside className="editor-vorschau" aria-label="Vorschau">
            <div className="vorschau-reiter">
              {vorschauKanaele.map((k) => <button key={k} type="button" aria-pressed={ansicht === k || (!vorschauKanaele.includes(ansicht) && k === vorschauKanaele[0])} onClick={() => setAnsicht(k)}>{KANAL[k].name}</button>)}
            </div>
            <Vorschau b={f} kanal={vorschauKanaele.includes(ansicht) ? ansicht : vorschauKanaele[0]} />
          </aside>
        )}
      </div>
    </DialogForm>
  );
}

function ZurueckDialog({ b }) {
  const { mutate, schliesse } = useApp();
  const [text, setText] = useState('');
  return (
    <DialogForm titel="Zur Überarbeitung zurückgeben" onClose={schliesse} knopf="Zurückgeben"
      onSubmit={() => mutate('beitrag.notiz', { id: b.id, text, zurueck: true }, 'Zurückgegeben')}>
      <Feld label="Was soll geändert werden?"><textarea value={text} onChange={(e) => setText(e.target.value)} required maxLength={1000} /></Feld>
    </DialogForm>
  );
}

export function BeitragDetail({ id }) {
  const { daten, me, mutate, oeffne, toast, bestaetige } = useApp();
  const [kanal, setKanal] = useState(null);
  const [notiz, setNotiz] = useState('');
  if (!me.mk) return <MarketingFreischalten />;
  const b = (daten.beitraege || []).find((x) => x.id === id);
  if (!b) return <><a className="zurueck" href="#marketing"><Icon n="zurueck" size={18} />Marketing</a><Leer titel="Beitrag nicht gefunden" /></>;
  const eigen = b.autorId === me.uid;
  const vk = (b.kanaele || []).filter((k) => ['facebook', 'instagram', 'whatsapp'].includes(k));
  const aktiv = vk.includes(kanal) ? kanal : vk[0];
  const status = async (s, msg) => { try { await mutate('beitrag.status', { id: b.id, status: s }, msg); } catch (e) { toast(e.message, true); } };
  return (
    <>
      <a className="zurueck" href="#marketing"><Icon n="zurueck" size={18} />Marketing</a>
      <div className="abschnitt-kopf">
        <div>
          <h1>{b.titel}</h1>
          <p className="zeile-meta" style={{ marginTop: 6 }}>
            <BeitragStatus status={b.status} /><KanalMarken kanaele={b.kanaele} /><span>{b.format}</span>
            <span>{b.datum ? `geplant ${datumLang(b.datum)}${b.uhrzeit ? `, ${b.uhrzeit} Uhr` : ''}` : 'noch ohne Termin'}</span>
          </p>
        </div>
        <button className="knopf zweit" onClick={() => oeffne(() => <BeitragDialog b={b} />)}><Icon n="stift" size={18} />Bearbeiten</button>
      </div>

      {b.status === 'Zur Freigabe' && (
        <div className={`freigabe-box${eigen ? '' : ' aktiv'}`}>
          {eigen ? (
            <p><b>Wartet auf Freigabe.</b> Jemand anderer aus dem Team schaut drüber, bevor der Beitrag online geht.</p>
          ) : (
            <>
              <p><b>{b.freigabeAngefragtVon || b.autorName} bittet um Freigabe.</b> Passt Text, Bild und Ton?</p>
              <div className="knopf-reihe">
                <button className="knopf" onClick={() => status('Freigegeben', 'Beitrag freigegeben')}><Icon n="check" size={18} />Freigeben</button>
                <button className="knopf zweit" onClick={() => oeffne(() => <ZurueckDialog b={b} />)}>Zurückgeben</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="beitrag-raster">
        <div>
          {vk.length > 1 && (
            <div className="vorschau-reiter">
              {vk.map((k) => <button key={k} type="button" aria-pressed={aktiv === k} onClick={() => setKanal(k)}>{KANAL[k].name}</button>)}
            </div>
          )}
          {vk.length ? <Vorschau b={b} kanal={aktiv} /> : (
            <div className="flaeche"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}><MitHashtags text={b.text || 'Noch kein Text'} /></p></div>
          )}
        </div>
        <div>
          <div className="knopf-reihe" style={{ marginBottom: 18 }}>
            {b.text && <button className="knopf zweit klein" onClick={() => kopiere(b.text, toast)}><Icon n="kopieren" size={16} />Text kopieren</button>}
            {b.status === 'In Arbeit' && <button className="knopf klein" onClick={() => status('Zur Freigabe', 'Zur Freigabe geschickt')}>Zur Freigabe schicken</button>}
            {b.status === 'Idee' && <button className="knopf klein" onClick={() => status('In Arbeit', 'In Arbeit')}>Ausarbeiten</button>}
            {b.status === 'Freigegeben' && <button className="knopf klein" onClick={() => status('Veröffentlicht', 'Als veröffentlicht markiert')}><Icon n="check" size={16} />Ist online</button>}
            {b.link && <a className="knopf zweit klein" href={b.link} target="_blank" rel="noreferrer"><Icon n="link" size={16} />Ansehen</a>}
          </div>
          <dl className="fakten">
            <dt>Zuständig</dt><dd>{b.zustaendigName || 'niemand'}</dd>
            <dt>Absender</dt><dd>{b.absender === 'ich' ? `${b.absenderName || b.autorName} (Ich-Form)` : 'GFG offiziell (Wir-Form)'}</dd>
            <dt>Angelegt</dt><dd>{b.autorName}, {zeitpunkt(b.erstelltAm)}</dd>
            {b.freigabe && <><dt>Freigegeben</dt><dd>{b.freigabe.von}, {zeitpunkt(b.freigabe.am)}</dd></>}
            {b.veroeffentlichtAm && <><dt>Online seit</dt><dd>{zeitpunkt(b.veroeffentlichtAm)}</dd></>}
          </dl>
          {b.notiz && <p className="leise" style={{ whiteSpace: 'pre-wrap' }}>{b.notiz}</p>}
          {(b.medien || []).length > 0 && (
            <>
              <h3 className="mini-titel">Dateien zum Posten</h3>
              <ul className="dateien">
                {b.medien.map((d) => (
                  <li key={d.pfad}>
                    <a className="datei-name" href={dateiUrl(d)} target="_blank" rel="noreferrer"><Icon n={istBild(d) ? 'bild' : 'video'} size={20} /><span><b>{d.name}</b><span className="leise mini">{groesse(d.groesse || 0)}</span></span></a>
                    <a className="knopf still klein" href={dateiUrl(d, true)} aria-label={`${d.name} herunterladen`}><Icon n="hochladen" size={18} style={{ transform: 'rotate(180deg)' }} /></a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="mini-titel">Anmerkungen</h3>
          {(b.notizen || []).length === 0 ? <p className="leise klein">Noch keine Anmerkungen.</p> : (
            <ul className="notizen">
              {b.notizen.map((n, i) => <li key={i} className={n.zurueck ? 'zurueck-notiz' : ''}><b>{n.von}</b> <span className="leise mini">{zeitpunkt(n.am)}{n.zurueck ? ', zurückgegeben' : ''}</span><p>{n.text}</p></li>)}
            </ul>
          )}
          <form className="notiz-form" onSubmit={async (e) => {
            e.preventDefault();
            try { await mutate('beitrag.notiz', { id: b.id, text: notiz }); setNotiz(''); } catch (err) { toast(err.message, true); }
          }}>
            <input className="eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Anmerkung schreiben" maxLength={1000} required aria-label="Anmerkung" />
            <button className="knopf zweit">Senden</button>
          </form>
          <button className="knopf still klein gefahr-text" style={{ marginTop: 26 }} onClick={async () => {
            if (await bestaetige('Beitrag löschen?', `${b.titel} und alle abgelegten Bilder werden gelöscht.`)) {
              try { await mutate('beitrag.loeschen', { id: b.id }, 'Beitrag gelöscht'); window.location.hash = 'marketing'; } catch (e) { toast(e.message, true); }
            }
          }}><Icon n="papierkorb" size={16} />Beitrag löschen</button>
        </div>
      </div>
    </>
  );
}

function BeitragKarte({ b }) {
  const bild = (b.medien || []).find(istBild);
  return (
    <a className="bkarte" href={`#beitrag-${b.id}`}>
      {bild && <img src={dateiUrl(bild)} alt="" loading="lazy" />}
      <span className="bkarte-text">
        <b>{b.titel}</b>
        <span className="zeile-meta"><KanalMarken kanaele={b.kanaele} />{b.datum && <span>{datumKurz(b.datum)}{b.uhrzeit ? ` ${b.uhrzeit}` : ''}</span>}</span>
        {b.zustaendigName && <span className="leise mini">{b.zustaendigName}</span>}
      </span>
    </a>
  );
}

/** Die nächsten 14 Tage auf einen Blick */
function Wochen({ beitraege }) {
  const heute = wienTag();
  const tage = Array.from({ length: 14 }, (_, i) => tagPlus(heute, i));
  return (
    <div className="wochen" role="list" aria-label="Die nächsten 14 Tage">
      {tage.map((t) => {
        const an = beitraege.filter((b) => b.datum === t && b.status !== 'Idee').sort((a, c) => (a.uhrzeit || '').localeCompare(c.uhrzeit || ''));
        const d = new Date(`${t}T12:00:00Z`);
        return (
          <div key={t} role="listitem" className={`wtag${t === heute ? ' heute' : ''}${d.getUTCDay() === 0 || d.getUTCDay() === 6 ? ' we' : ''}`}>
            <span className="wtag-kopf">{WOCHENTAG[d.getUTCDay()]} <b>{d.getUTCDate()}.</b></span>
            {an.map((b) => (
              <a key={b.id} href={`#beitrag-${b.id}`} className={`wpost s-${BEITRAG_TON[b.status]}`} title={`${b.titel} (${b.status})`}>
                <KanalMarken kanaele={b.kanaele} /><span>{b.titel}</span>
              </a>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Redaktionsplan() {
  const { daten, me, oeffne } = useApp();
  const alle = daten.beitraege || [];
  const vor30 = Date.now() - 30 * 864e5;
  const warten = alle.filter((b) => b.status === 'Zur Freigabe' && b.autorId !== me.uid);
  const spalten = KREIS.map((s) => ({
    s,
    liste: alle.filter((b) => b.status === s && (s !== 'Veröffentlicht' || (b.veroeffentlichtAm || b.erstelltAm) > vor30))
      .sort((a, c) => (a.datum || '9999').localeCompare(c.datum || '9999')),
  }));
  return (
    <>
      {warten.length > 0 && (
        <div className="freigabe-box aktiv" style={{ marginBottom: 22 }}>
          <p><b>{warten.length === 1 ? 'Ein Beitrag wartet' : `${warten.length} Beiträge warten`} auf deine Freigabe</b></p>
          <ul className="freigabe-liste">{warten.map((b) => <li key={b.id}><a href={`#beitrag-${b.id}`}>{b.titel}</a> <span className="leise mini">von {b.freigabeAngefragtVon || b.autorName}</span></li>)}</ul>
        </div>
      )}
      <div className="abschnitt-kopf">
        <h2>Die nächsten 14 Tage</h2>
        <button className="knopf" onClick={() => oeffne(() => <BeitragDialog />)}><Icon n="plus" />Neuer Beitrag</button>
      </div>
      <Wochen beitraege={alle} />
      <section className="abschnitt">
        <h2 style={{ marginBottom: 12 }}>Alle Beiträge nach Stand</h2>
        <div className="brett">
          {spalten.map(({ s, liste }) => (
            <div key={s} className="brett-spalte">
              <div className="brett-kopf"><BeitragStatus status={s} /><span className="leise mini">{liste.length}</span></div>
              {liste.length ? liste.map((b) => <BeitragKarte key={b.id} b={b} />) : <p className="leise mini brett-leer">{s === 'Veröffentlicht' ? 'In den letzten 30 Tagen nichts' : 'Nichts'}</p>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Ideen() {
  const { daten, mutate, oeffne, toast } = useApp();
  const [titel, setTitel] = useState('');
  const ideen = (daten.beitraege || []).filter((b) => b.status === 'Idee').sort((a, c) => c.erstelltAm - a.erstelltAm);
  const verplant = new Set((daten.beitraege || []).map((b) => b.videoId).filter(Boolean));
  const videos = (daten.videothemen || []).filter((v) => !verplant.has(v.id))
    .sort((a, c) => Object.keys(c.stimmen || {}).length - Object.keys(a.stimmen || {}).length).slice(0, 8);
  return (
    <div className="raster2">
      <section>
        <h2 style={{ marginBottom: 12 }}>Ideensammlung</h2>
        <form className="notiz-form" style={{ marginBottom: 16 }} onSubmit={async (e) => {
          e.preventDefault();
          try { await mutate('beitrag.speichern', { titel, status: 'Idee', kanaele: [] }, 'Idee notiert'); setTitel(''); } catch (err) { toast(err.message, true); }
        }}>
          <input className="eingabe" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Idee in einem Satz" required maxLength={140} aria-label="Neue Idee" />
          <button className="knopf"><Icon n="plus" size={18} />Notieren</button>
        </form>
        {ideen.length === 0 ? <Leer titel="Noch keine Ideen" text="Alles, was ein guter Beitrag werden könnte: ein Foto vom Spielplatz, ein Danke an Ehrenamtliche, ein Thema aus dem Gemeinderat." /> : (
          <ul className="liste">
            {ideen.map((b) => (
              <li key={b.id} className="zeile">
                <span className="zeile-haupt"><a className="zeile-titel" href={`#beitrag-${b.id}`}>{b.titel}</a><span className="zeile-meta"><span>{b.autorName}, {zeitpunkt(b.erstelltAm)}</span></span></span>
                <button className="knopf zweit klein" onClick={() => oeffne(() => <BeitragDialog b={{ ...b, status: 'In Arbeit' }} />)}>Ausarbeiten</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 style={{ marginBottom: 6 }}>Aus den Videothemen</h2>
        <p className="leise klein" style={{ marginBottom: 12 }}>Die beliebtesten Vorschläge, die noch nicht verplant sind.</p>
        {videos.length === 0 ? <p className="leise">Alle Videothemen sind schon verplant.</p> : (
          <ul className="liste">
            {videos.map((v) => (
              <li key={v.id} className="zeile">
                <span className="zeile-haupt"><span className="zeile-titel">{v.titel}</span><span className="zeile-meta"><span><Icon n="daumen" size={14} /> {Object.keys(v.stimmen || {}).length}</span><span>{v.status}</span></span></span>
                <button className="knopf zweit klein" onClick={() => oeffne(() => <BeitragDialog vorlage={{ titel: v.titel, format: 'Video', videoId: v.id, kanaele: ['facebook', 'instagram'], notiz: v.beschreibung || '' }} />)}>Als Beitrag planen</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KennzahlDialog({ k }) {
  const { mutate, schliesse, bestaetige, toast } = useApp();
  const [monat, setMonat] = useState(k?.monat || wienTag().slice(0, 7));
  const [werte, setWerte] = useState(Object.fromEntries(KANAELE.filter((x) => x.kennzahl).map((x) => [x.key, k?.werte?.[x.key] ?? ''])));
  return (
    <DialogForm titel={k ? `Werte für ${monatName(k.monat)}` : 'Werte eintragen'} onClose={schliesse}
      onSubmit={() => mutate('kennzahl.speichern', { monat, werte }, 'Werte gespeichert')}
      gefahr={k && <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
        if (await bestaetige('Werte löschen?', monatName(k.monat))) { try { await mutate('kennzahl.speichern', { monat: k.monat, loeschen: true }, 'Gelöscht'); } catch (e) { toast(e.message, true); } }
      }}>Löschen</button>}>
      {!k && <Feld label="Monat"><input type="month" value={monat} onChange={(e) => setMonat(e.target.value)} required /></Feld>}
      {KANAELE.filter((x) => x.kennzahl).map((x) => (
        <Feld key={x.key} label={`${x.name}: ${x.kennzahl}`}>
          <input type="number" min="0" inputMode="numeric" value={werte[x.key]} onChange={(e) => setWerte((w) => ({ ...w, [x.key]: e.target.value }))} />
        </Feld>
      ))}
      <p className="leise klein">Die Zahl steht im jeweiligen Profil. Am besten immer am Monatsanfang eintragen.</p>
    </DialogForm>
  );
}

const MONATE = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const monatName = (m) => `${MONATE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const zahl = (n) => Number(n).toLocaleString('de-AT');

/** Verlauf eines Kanals als kleine Linie mit Punkten, Werte beim Darüberfahren */
function Verlauf({ punkte, farbe }) {
  const [hover, setHover] = useState(null);
  if (punkte.length < 2) return <div className="verlauf-leer leise mini">Ab dem zweiten Monat gibt es hier einen Verlauf.</div>;
  const B = 280; const H = 72; const R = 6;
  const werte = punkte.map((p) => p.wert);
  const min = Math.min(...werte); const max = Math.max(...werte);
  const spanne = max - min || 1;
  const x = (i) => R + (i * (B - 2 * R)) / (punkte.length - 1);
  const y = (v) => H - R - ((v - min) / spanne) * (H - 2 * R);
  const d = punkte.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.wert).toFixed(1)}`).join(' ');
  const h = hover != null ? punkte[hover] : null;
  return (
    <div className="verlauf-chart">
      <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label={punkte.map((p) => `${monatName(p.monat)}: ${zahl(p.wert)}`).join(', ')} onMouseLeave={() => setHover(null)}>
        <line x1={R} x2={B - R} y1={H - R} y2={H - R} stroke="var(--linie)" strokeWidth="1" />
        <path d={d} fill="none" stroke={farbe} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {punkte.map((p, i) => (
          <g key={p.monat}>
            <circle cx={x(i)} cy={y(p.wert)} r={hover === i ? 5 : 4} fill={farbe} stroke="var(--flaeche)" strokeWidth="2" />
            <rect x={Math.max(0, x(i) - B / punkte.length / 2)} y="0" width={Math.min(B, x(i) + B / punkte.length / 2) - Math.max(0, x(i) - B / punkte.length / 2)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} />
          </g>
        ))}
      </svg>
      <span className="verlauf-tip" aria-live="polite">{h ? `${monatName(h.monat)}: ${zahl(h.wert)}` : `${monatName(punkte[0].monat)} bis ${monatName(punkte[punkte.length - 1].monat)}`}</span>
    </div>
  );
}

function Kennzahlen() {
  const { daten, oeffne } = useApp();
  const marke = useMarke();
  const liste = [...(daten.kennzahlen || [])].sort((a, c) => a.monat.localeCompare(c.monat));
  const veroeff = (daten.beitraege || []).filter((b) => b.status === 'Veröffentlicht');
  const dieserMonat = wienTag().slice(0, 7);
  const imMonat = veroeff.filter((b) => new Date(b.veroeffentlichtAm || b.erstelltAm).toISOString().slice(0, 7) === dieserMonat).length;
  return (
    <>
      <div className="abschnitt-kopf">
        <h2>Reichweite</h2>
        <button className="knopf" onClick={() => oeffne(() => <KennzahlDialog />)}><Icon n="plus" />Werte eintragen</button>
      </div>
      <div className="kz-raster">
        {KANAELE.filter((k) => k.kennzahl).map((k) => {
          const punkte = liste.filter((e) => e.werte?.[k.key] != null).map((e) => ({ monat: e.monat, wert: e.werte[k.key] }));
          const jetzt = punkte[punkte.length - 1];
          const vorher = punkte[punkte.length - 2];
          const diff = jetzt && vorher ? jetzt.wert - vorher.wert : null;
          return (
            <div key={k.key} className="kz-karte">
              <div className="kz-kopf"><span className={`kanal-marke k-${k.key}`}>{k.kurz}</span><span>{k.name}</span>
                {marke.kanaele[k.key] && <a href={marke.kanaele[k.key]} target="_blank" rel="noreferrer" className="leise mini" style={{ marginLeft: 'auto' }}>Profil öffnen</a>}
              </div>
              <div className="kz-zahl">{jetzt ? zahl(jetzt.wert) : <span className="leise">noch keine Zahl</span>}</div>
              <div className="leise mini">{k.kennzahl}{jetzt ? `, Stand ${monatName(jetzt.monat)}` : ''}
                {diff != null && <span className={`kz-diff ${diff >= 0 ? 'plus' : 'minus'}`}> {diff >= 0 ? '+' : '−'}{zahl(Math.abs(diff))} zum Vormonat</span>}
              </div>
              <Verlauf punkte={punkte.slice(-12)} farbe={k.farbe} />
            </div>
          );
        })}
        <div className="kz-karte">
          <div className="kz-kopf"><Icon n="megafon" size={18} /><span>Veröffentlicht</span></div>
          <div className="kz-zahl">{imMonat}</div>
          <div className="leise mini">Beiträge in diesem Monat, {veroeff.length} insgesamt</div>
        </div>
      </div>
      {liste.length > 0 && (
        <section className="abschnitt">
          <h2 style={{ marginBottom: 12 }}>Alle Werte</h2>
          <table className="tabelle">
            <thead><tr><th>Monat</th>{KANAELE.filter((k) => k.kennzahl).map((k) => <th key={k.key} className="zahl">{k.name}</th>)}<th /></tr></thead>
            <tbody>
              {[...liste].reverse().map((e) => (
                <tr key={e.monat}>
                  <td className="nowrap">{monatName(e.monat)}</td>
                  {KANAELE.filter((k) => k.kennzahl).map((k) => <td key={k.key} className="zahl">{e.werte?.[k.key] != null ? zahl(e.werte[k.key]) : ''}</td>)}
                  <td><button className="knopf still klein" aria-label={`${monatName(e.monat)} bearbeiten`} onClick={() => oeffne(() => <KennzahlDialog k={e} />)}><Icon n="stift" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

const FARBEN = [
  ['GFG-Grün', '#00A258'], ['Dunkelgrün', '#007A3D'], ['Tannengrün', '#00552A'], ['Gelb', '#FFD300'], ['Papier', '#F3F6F2'], ['Tinte', '#17241D'],
];

function ListenDialog({ titel, eintraege, felder, speichern }) {
  const { schliesse } = useApp();
  const [liste, setListe] = useState(eintraege.length ? eintraege : [Object.fromEntries(felder.map((f) => [f.key, '']))]);
  return (
    <DialogForm titel={titel} onClose={schliesse} onSubmit={() => speichern(liste.filter((e) => felder.every((f) => String(e[f.key] || '').trim())))}>
      {liste.map((e, i) => (
        <div key={i} className="listen-eintrag">
          {felder.map((f) => (
            f.lang
              ? <textarea key={f.key} className="eingabe" placeholder={f.label} aria-label={f.label} value={e[f.key]} maxLength={1500} onChange={(ev) => setListe((l) => l.map((x, j) => (j === i ? { ...x, [f.key]: ev.target.value } : x)))} />
              : <input key={f.key} className="eingabe" placeholder={f.label} aria-label={f.label} value={e[f.key]} maxLength={80} onChange={(ev) => setListe((l) => l.map((x, j) => (j === i ? { ...x, [f.key]: ev.target.value } : x)))} />
          ))}
          <button type="button" className="knopf still klein" aria-label="Entfernen" onClick={() => setListe((l) => l.filter((_, j) => j !== i))}><Icon n="papierkorb" size={16} /></button>
        </div>
      ))}
      <button type="button" className="knopf still klein" onClick={() => setListe((l) => [...l, Object.fromEntries(felder.map((f) => [f.key, '']))])}><Icon n="plus" size={16} />Hinzufügen</button>
    </DialogForm>
  );
}

function KanaeleDialog() {
  const { mutate, schliesse } = useApp();
  const marke = useMarke();
  const [k, setK] = useState(Object.fromEntries(KANAELE.map((x) => [x.key, marke.kanaele[x.key] || ''])));
  const [regeln, setRegeln] = useState(marke.regeln);
  return (
    <DialogForm titel="Kanäle und Schreibregeln" onClose={schliesse} onSubmit={() => mutate('marke.speichern', { kanaele: k, regeln }, 'Gespeichert')}>
      {KANAELE.map((x) => <Feld key={x.key} label={x.name}><input type="url" value={k[x.key]} onChange={(e) => setK((v) => ({ ...v, [x.key]: e.target.value }))} placeholder="https://" /></Feld>)}
      <Feld label="Schreibregeln"><textarea value={regeln} onChange={(e) => setRegeln(e.target.value)} maxLength={2000} /></Feld>
    </DialogForm>
  );
}

function Baukasten() {
  const { oeffne, mutate, toast } = useApp();
  const marke = useMarke();
  return (
    <>
      <div className="baukasten">
        <section className="flaeche">
          <div className="abschnitt-kopf"><h2>Logo</h2></div>
          <div className="logo-flaechen">
            <div className="logo-hell"><img src="/logo.svg" alt="GFG Logo" /></div>
            <div className="logo-dunkel"><img src="/logo-zeichen.svg" alt="GFG Zeichen" /></div>
          </div>
          <div className="knopf-reihe">
            <a className="knopf zweit klein" href="/logo.svg" download="GFG-Logo.svg">Logo (SVG)</a>
            <a className="knopf zweit klein" href="/logo-zeichen.svg" download="GFG-Zeichen.svg">Zeichen (SVG)</a>
            <a className="knopf zweit klein" href="/icon-512.png" download="GFG-Profilbild.png">Profilbild (PNG)</a>
          </div>
        </section>
        <section className="flaeche">
          <div className="abschnitt-kopf"><h2>Farben</h2><span className="leise mini">Antippen kopiert den Farbcode</span></div>
          <div className="farben">
            {FARBEN.map(([n, hex]) => (
              <button key={hex} type="button" className="farbe" onClick={() => kopiere(hex, toast, hex)}>
                <span style={{ background: hex }} /><b>{n}</b><code>{hex}</code>
              </button>
            ))}
          </div>
        </section>
        <section className="flaeche">
          <div className="abschnitt-kopf"><h2>So schreiben wir</h2><button className="knopf still klein" onClick={() => oeffne(() => <KanaeleDialog />)}><Icon n="stift" size={16} />Ändern</button></div>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{marke.regeln}</p>
          <div className="verweise">
            {KANAELE.filter((k) => marke.kanaele[k.key]).map((k) => <a key={k.key} href={marke.kanaele[k.key]} target="_blank" rel="noreferrer"><span className={`kanal-marke k-${k.key}`}>{k.kurz}</span>{k.name}</a>)}
            {!KANAELE.some((k) => marke.kanaele[k.key]) && <span className="leise klein">Links zu unseren Profilen unter Ändern eintragen.</span>}
          </div>
        </section>
        <section className="flaeche">
          <div className="abschnitt-kopf"><h2>Hashtags</h2>
            <button className="knopf still klein" onClick={() => oeffne(() => <ListenDialog titel="Hashtag-Sets" eintraege={marke.hashtags} felder={[{ key: 'name', label: 'Name' }, { key: 'tags', label: '#Hashtags', lang: true }]} speichern={(l) => mutate('marke.speichern', { hashtags: l }, 'Hashtags gespeichert')} />)}><Icon n="stift" size={16} />Ändern</button>
          </div>
          {marke.hashtags.map((h) => (
            <div key={h.name} className="baustein">
              <div><b>{h.name}</b><p className="tags"><MitHashtags text={h.tags} /></p></div>
              <button className="knopf still klein" aria-label={`${h.name} kopieren`} onClick={() => kopiere(h.tags, toast, 'Hashtags')}><Icon n="kopieren" size={16} /></button>
            </div>
          ))}
        </section>
        <section className="flaeche breit">
          <div className="abschnitt-kopf"><h2>Textbausteine</h2>
            <button className="knopf still klein" onClick={() => oeffne(() => <ListenDialog titel="Textbausteine" eintraege={marke.bausteine} felder={[{ key: 'titel', label: 'Titel' }, { key: 'text', label: 'Text', lang: true }]} speichern={(l) => mutate('marke.speichern', { bausteine: l }, 'Textbausteine gespeichert')} />)}><Icon n="stift" size={16} />Ändern</button>
          </div>
          {marke.bausteine.map((h) => (
            <div key={h.titel} className="baustein">
              <div><b>{h.titel}</b><p>{h.text}</p></div>
              <button className="knopf still klein" aria-label={`${h.titel} kopieren`} onClick={() => kopiere(h.text, toast)}><Icon n="kopieren" size={16} /></button>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

export function MarketingFreischalten() {
  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Marketing</h1>
      <p className="leise" style={{ margin: '8px 0 0' }}>Redaktionsplan, Beiträge mit Freigabe und Reichweite für unseren Auftritt auf Facebook, Instagram und WhatsApp. Diesen Bereich sieht das Marketing-Team. Wenn du dabei sein willst, bitte den Admin, dir die Rolle zu geben.</p>
    </div>
  );
}

export default function Marketing() {
  const { me, daten } = useApp();
  const [reiter, setReiter] = useState('plan');
  const ideen = useMemo(() => (daten.beitraege || []).filter((b) => b.status === 'Idee').length, [daten.beitraege]);
  if (!me.mk) return <MarketingFreischalten />;
  const REITER = [['plan', 'Redaktionsplan'], ['ideen', `Ideen${ideen ? ` (${ideen})` : ''}`], ['zahlen', 'Reichweite'], ['marke', 'Markenbaukasten']];
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Marketing</h1>

      </div>
      <div className="unterreiter" role="tablist">
        {REITER.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={reiter === k} onClick={() => setReiter(k)}>{l}</button>)}
      </div>
      {reiter === 'plan' && <Redaktionsplan />}
      {reiter === 'ideen' && <Ideen />}
      {reiter === 'zahlen' && <Kennzahlen />}
      {reiter === 'marke' && <Baukasten />}
    </>
  );
}

