'use client';
import { useState } from 'react';
import { useApp, Icon, Feld, DialogForm, Leer } from './ui';
import { ROLLEN, ORTSTEILE } from '@/lib/domain';

const GR = ['Gemeinderat', 'gf. Gemeinderat'];

/** Gleiche Regel wie auf dem Server: GFG + Anfangsbuchstaben von Vor- und Nachname */
export function startPasswort(name) {
  const t = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return '';
  return `GFG${t[0][0]}${t.length > 1 ? t[t.length - 1][0] : ''}`.toUpperCase();
}

function Rollen({ m }) {
  return (
    <span className="rollen">
      <span className={`etikett ${GR.includes(m.rolle) ? 'ton-gut' : 'ton-leise'}`}>{m.rolle}</span>
      {m.marketing && <span className="etikett ton-aktiv">Marketing</span>}
      {m.admin && <span className="etikett ton-offen">Admin</span>}
    </span>
  );
}

function MitgliedDialog({ m }) {
  const { mutate, schliesse, bestaetige, toast, me } = useApp();
  const [f, setF] = useState({
    name: m?.name || '', email: m?.email || '', rolle: m?.rolle || 'Vereinsmitglied', funktion: m?.funktion || '', ortsteil: m?.ortsteil || '',
    marketing: !!m?.marketing, admin: !!m?.admin, auch: (m?.auch || []).join(', '),
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const haken = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.checked }));
  return (
    <DialogForm titel={m ? m.name : 'Person hinzufügen'} onClose={schliesse}
      onSubmit={async () => {
        const r = await mutate('mitglied.speichern', { ...f, id: m?.id }, m ? 'Gespeichert' : null);
        if (!m) toast(`Angelegt. Startpasswort: ${r.passwort}`);
      }}
      gefahr={m && m.id !== me.uid && (
        <button type="button" className="knopf gefahr" style={{ marginRight: 'auto' }} onClick={async () => {
          if (await bestaetige('Person entfernen?', `${m.name} kann sich dann nicht mehr anmelden und bekommt keine Einladungen mehr.`, 'Entfernen')) {
            try { await mutate('mitglied.loeschen', { id: m.id }, 'Entfernt'); } catch (e) { toast(e.message, true); }
          }
        }}>Entfernen</button>
      )}>
      <Feld label="Vor- und Nachname" hinweis={`Damit meldet sich die Person an. Startpasswort: ${startPasswort(f.name) || 'GFG…'}`}>
        <input value={f.name} onChange={set('name')} required maxLength={80} />
      </Feld>
      <Feld label="E-Mail-Adresse" hinweis="Für Kalendereinladungen, Tagesordnung und Erinnerungen."><input type="email" value={f.email} onChange={set('email')} maxLength={120} /></Feld>
      <div className="feld">
        <span className="feld-label">Rollen</span>
        <div className="segment" style={{ marginBottom: 10 }}>
          {ROLLEN.map((r) => (
            <label key={r}><input type="radio" name="rolle" checked={f.rolle === r} onChange={() => setF((x) => ({ ...x, rolle: r }))} /><span>{r}</span></label>
          ))}
        </div>
        <label className="schalter-zeile" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={f.marketing} onChange={haken('marketing')} />
          <span>Marketing <span className="leise klein">sieht und bearbeitet den Marketing-Reiter</span></span>
        </label>
        <label className="schalter-zeile">
          <input type="checkbox" checked={f.admin} onChange={haken('admin')} />
          <span>Admin <span className="leise klein">verwaltet Personen, Rollen und Passwörter</span></span>
        </label>
      </div>
      <Feld label="Auch bekannt als (optional)" hinweis="Spitznamen, mit denen man sich ebenfalls anmelden kann, durch Komma getrennt.">
        <input value={f.auch} onChange={set('auch')} maxLength={200} placeholder="z. B. Hannes Bayer" />
      </Feld>
      <div className="feld-reihe">
        <Feld label="Ortsteil"><select value={f.ortsteil} onChange={set('ortsteil')}><option value="">keine Angabe</option>{ORTSTEILE.map((o) => <option key={o}>{o}</option>)}</select></Feld>
        <Feld label="Funktion (optional)"><input value={f.funktion} onChange={set('funktion')} maxLength={80} placeholder="z. B. Obmann, Kassier" /></Feld>
      </div>
      {m && (
        <div className="flaeche klein" style={{ padding: '12px 14px', marginBottom: 6 }}>
          {m.eigenesPasswort
            ? <>Hat ein eigenes Passwort gewählt. </>
            : <>Meldet sich mit dem Startpasswort <b>{startPasswort(m.name)}</b> an. </>}
          <button type="button" className="knopf still klein" onClick={async () => {
            if (await bestaetige('Passwort zurücksetzen?', `${m.name} wird auf allen Geräten abgemeldet und meldet sich danach wieder mit ${startPasswort(m.name)} an.`, 'Zurücksetzen')) {
              try { const r = await mutate('mitglied.passwortZuruecksetzen', { id: m.id }); toast(`Zurückgesetzt auf ${r.passwort}`); } catch (e) { toast(e.message, true); }
            }
          }}>Passwort zurücksetzen</button>
        </div>
      )}
    </DialogForm>
  );
}

function Gruppe({ titel, liste }) {
  const { oeffne } = useApp();
  if (!liste.length) return null;
  return (
    <section className="abschnitt">
      <div className="abschnitt-kopf"><h2>{titel}</h2><span className="leise klein">{liste.length}</span></div>
      <ul className="liste">
        {liste.map((m) => (
          <li key={m.id}>
            <button className="zeile zeile-knopf" onClick={() => oeffne(() => <MitgliedDialog m={m} />)}>
              <span className="zeile-haupt">
                <span className="zeile-titel">{m.name}</span>
                <span className="zeile-meta">
                  <Rollen m={m} />
                  {m.email ? <span>{m.email}</span> : <span className="warn">E-Mail fehlt</span>}
                  <span className="leise">{m.eigenesPasswort ? 'eigenes Passwort' : `Startpasswort ${startPasswort(m.name)}`}</span>
                </span>
              </span>
              <Icon n="stift" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Verwaltung() {
  const { me, daten, oeffne } = useApp();
  const [q, setQ] = useState('');
  if (!me.admin) return <Leer titel="Kein Zugriff" text="Personen und Rollen verwaltet der Admin." />;
  const alle = [...(daten.mitglieder || [])]
    .filter((m) => !q.trim() || `${m.name} ${(m.auch || []).join(' ')} ${m.email || ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const ohneMail = (daten.mitglieder || []).filter((m) => !m.email).length;
  return (
    <>
      <div className="abschnitt-kopf">
        <h1>Personen und Rollen</h1>
        <button className="knopf" onClick={() => oeffne(() => <MitgliedDialog />)}><Icon n="plus" />Person hinzufügen</button>
      </div>
      <div className="hinweis info" style={{ margin: '6px 0 18px' }}>
        Jede Person meldet sich mit Vor- und Nachname an. Das Startpasswort ist <b>GFG</b> plus die Anfangsbuchstaben, zum Beispiel GFGMM für Mathias Mayer.
        Unter Benachrichtigungen kann jede Person ein eigenes Passwort festlegen. Die Rollen bestimmen, was jemand sieht: Gemeinderäte den Gemeinderäte-Bereich, Marketing den Marketing-Reiter.
      </div>
      <div className="knopfreihe" style={{ marginBottom: 8 }}>
        <input className="eingabe" type="search" placeholder="Person suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Person suchen" style={{ maxWidth: 320 }} />
        {ohneMail > 0 && <span className="warn klein">{ohneMail} ohne E-Mail-Adresse</span>}
      </div>
      <Gruppe titel="Gemeinderäte" liste={alle.filter((m) => GR.includes(m.rolle))} />
      <Gruppe titel="Vereinsmitglieder" liste={alle.filter((m) => !GR.includes(m.rolle))} />
    </>
  );
}
