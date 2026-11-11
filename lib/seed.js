// Startdaten beim allerersten Start (nur wenn die Datenbank leer ist).

const IFG_THEMEN = [
  ['Kläranlage', 'Fragen zu Überlastung, Geruchsbelastung, geplantem Ausbau und zur Studie aus 2020.'],
  ['Biogasanlage Hagenbrunn', ''],
  ['Gehsteigausbau in den Ortsteilen', ''],
  ['Kanalbefahrung', ''],
  ['Änderungen in der Amtsleitung', ''],
  ['Verkehrsverhandlung und Parkplatz Putzing', 'Verkehrsverhandlung, Parkplatz und Gehsteignutzung in Putzing.'],
  ['Infrastruktur NBG-Wohnhausanlage Salzstraße', ''],
];

export function seedDocs() {
  const jetzt = Date.now();
  const docs = [];
  const add = (col, id, data) => docs.push({ col, id, data });

  add('config', 'app', {
    fristTage: 3,
    driveFolderId: '1yqvnB8F_mE_1j1hwsgVOYCJYTwp_ui9K',
    ausschuesse: ['Kultur und Veranstaltungen', 'Generationen, Familien, Schule und Bildung'],
    jotformThemenUrl: 'https://form.jotform.com/263132406379053',
    appUrl: '',
    erstelltAm: jetzt,
  });

  add('antraege', 'festlbus', {
    titel: 'Beitritt zum Festlbus Weinviertel-Ost',
    art: 'Antrag',
    einbringer: 'GR Mathias Mayer (GFG)',
    datum: '2025-10',
    grSitzung: 'Gemeinderatssitzung Oktober 2025',
    top: '32',
    ausschuss: '',
    dokumente: [],
    notizen: 'Für 2026 war eine Teilnahme nicht mehr möglich. In der Gemeinderatssitzung am 12.10.2026 wurde der Beitritt zur ArGe Festlbus Weinviertel-Ost ab 2027 beschlossen.',
    status: 'abgeändert oder durch Gegenantrag ersetzt',
    geaendertAm: jetzt,
    verlauf: [
      { status: 'eingebracht', datum: '2025-10', notiz: 'GFG-Antrag zur Teilnahme am Festlbus eingebracht.', von: 'Übernahme', ts: jetzt },
      { status: 'auf der Tagesordnung', datum: '2025-10', notiz: 'Gemeinderatssitzung, TOP 32.', von: 'Übernahme', ts: jetzt },
      { status: 'abgeändert oder durch Gegenantrag ersetzt', datum: '2025-10', notiz: 'Antrag heruntergenommen und durch einen Gegenantrag des Bürgermeisters ersetzt.', von: 'Übernahme', ts: jetzt },
      { status: 'abgeändert oder durch Gegenantrag ersetzt', datum: '2026-10-12', notiz: 'Gemeinderat beschließt den Beitritt ab 2027.', von: 'Übernahme', ts: jetzt },
    ],
  });

  IFG_THEMEN.forEach(([thema, notiz], i) => {
    add('antraege', `ifg-${i + 1}`, {
      titel: `IFG-Informationsbegehren: ${thema}`,
      art: 'IFG-Begehren',
      einbringer: 'GR Johannes Bayer, GR Roman Beißer, GR Markus Haindl, GR Mathias Mayer',
      datum: '2026-09-25',
      grSitzung: '',
      top: '',
      ausschuss: '',
      dokumente: [],
      notizen: [notiz, 'Gestellt an die Marktgemeinde Großebersdorf, mit vorsorglichem Bescheidantrag nach § 11 Abs. 1 IFG.'].filter(Boolean).join(' '),
      status: 'Folgeschritte offen',
      geaendertAm: jetzt,
      verlauf: [
        { status: 'eingebracht', datum: '2026-09-25', notiz: 'Informationsbegehren nach dem IFG gestellt.', von: 'Übernahme', ts: jetzt },
        { status: 'beantwortet', datum: '2026-10-22', notiz: 'Vom Bürgermeister beantwortet.', von: 'Übernahme', ts: jetzt },
        { status: 'Folgeschritte offen', datum: '2026-10-22', notiz: 'Bescheidanträge nach § 11 IFG werden geprüft.', von: 'Übernahme', ts: jetzt },
      ],
    });
  });

  // Bekannte Gemeinderäte, E-Mail-Adressen werden in der App ergänzt
  ['Johannes Bayer', 'Roman Beißer', 'Michael Bernard', 'Alexander Gritsch', 'Markus Haindl', 'Mathias Mayer', 'Thomas Zeillinger']
    .forEach((name, i) => add('mitglieder', `m${i + 1}`, { name, email: '', rolle: 'Gemeinderat', funktion: '', ortsteil: '', erstelltAm: jetzt }));

  add('ausschuesse', 'kultur', {
    name: 'Kultur und Veranstaltungen', vorsitz: 'gf. GR Stefan Rohm', vertreter: 'GR Mathias Mayer', erstelltAm: jetzt,
  });
  add('ausschuesse', 'generationen', {
    name: 'Generationen, Familien, Schule und Bildung', vorsitz: 'GR Dr. Bettina Bauernfeind', vertreter: 'GR Mathias Mayer', erstelltAm: jetzt,
  });

  // Archiv des Abstimmungsverhaltens: erster Eintrag
  add('grsitzungen', 'gr-2026-10-12', {
    titel: 'Gemeinderatssitzung', datum: '2026-10-12', uhrzeit: '', ort: '', unterlagen: [], notiz: '', erstelltAm: jetzt,
    tops: [
      {
        key: 'feldgasse', nr: '', titel: 'Erweiterung der Feldgasse', linie: 'dagegen',
        begruendung: 'Die Glasfaserverlegung im Grünstreifen ist keine Begründung für die Asphaltierung der Straße. Bedenken wurden in der Sitzung vorgebracht.',
        sprecher: '', wortmeldung: '', ergebnis: '', abgestimmt: 'dagegen',
      },
      {
        key: 'festlbus', nr: '', titel: 'Beitritt zur ArGe Festlbus Weinviertel-Ost ab 2027', linie: 'offen',
        begruendung: 'Geht auf den GFG-Antrag vom Oktober 2025 zurück.', sprecher: '', wortmeldung: '', ergebnis: 'angenommen', abgestimmt: '',
      },
    ],
  });

  return docs;
}


/**
 * Einmalige Ergänzungen an bestehenden Daten. Jede läuft genau einmal (vermerkt in config/migrationen).
 * IDs sind fest, damit gleichzeitige Starts keine Doppelten anlegen.
 */
import grArchiv from './gr-archiv.json';
import gfgAntraege from './gfg-antraege.json';

const titelSchluessel = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

/** Archiv-TOP aus der Übernahme in das App-Format */
const archivTop = (g, t) => ({
  key: `imp-${g.datum}-${t.nr}`.replace(/\s+/g, ''), nr: t.nr, titel: t.titel, nichtOeffentlich: !!t.nichtOeffentlich,
  linie: t.abgestimmt || 'offen', begruendung: t.notiz || '', sprecher: '', wortmeldung: '',
  ergebnis: t.ergebnis || '', abgestimmt: t.abgestimmt || '', stimmen: t.stimmen || '', gfgAntrag: !!t.gfgAntrag,
  unterlage: '', datei: '', geaendertVon: 'Übernahme', geaendertAm: Date.now(),
});

const slugName = (n) => n.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function archivSitzungen(lese) {
  const docs = [];
  const vorhanden = await lese('grsitzungen');
  for (const g of grArchiv) {
    const alt = vorhanden.find((x) => x.id === g.id) || vorhanden.find((x) => x.datum === g.datum && !x.nurTermin);
    const neueTops = g.tops.map((t) => archivTop(g, t));
    if (!alt) {
      docs.push({ col: 'grsitzungen', id: g.id, data: {
        titel: 'Gemeinderatssitzung', datum: g.datum, uhrzeit: g.uhrzeit, ort: g.ort, notiz: '', stand: g.stand,
        unterlagen: g.unterlagen, dateien: [], tops: neueTops, importiert: true, erstelltAm: Date.now(), erstelltVon: 'Übernahme',
      } });
      continue;
    }
    const { id, ...rest } = alt;
    const tops = [...(alt.tops || [])];
    for (const t of neueTops) {
      // gleicher TOP schon da (gleiche Nummer oder sehr ähnlicher Titel): Ergebnis ergänzen, Vorbereitung behalten
      const woerter = (x) => titelSchluessel(x.titel).split(' ').filter((w) => w.length > 5);
      const i = tops.findIndex((x) => (x.nr && x.nr === t.nr)
        || (!x.nr && woerter(x).length > 0 && woerter(x).every((w) => titelSchluessel(t.titel).includes(w))));
      if (i >= 0) {
        const x = tops[i];
        // noch unverändert aus einer früheren Übernahme: mit dem neuen Stand ersetzen
        if (x.geaendertVon === 'Übernahme') { tops[i] = { ...t, key: x.key }; continue; }
        tops[i] = { ...t, ...x, linie: x.linie && x.linie !== 'offen' ? x.linie : t.linie, nr: x.nr || t.nr, ergebnis: x.ergebnis || t.ergebnis, abgestimmt: x.abgestimmt || t.abgestimmt, stimmen: x.stimmen || t.stimmen, begruendung: x.begruendung || t.begruendung };
      } else tops.push(t);
    }
    tops.sort((a, b) => (a.nichtOeffentlich ? 1 : 0) - (b.nichtOeffentlich ? 1 : 0) || (Number(String(a.nr).replace(/\D/g, '')) || 999) - (Number(String(b.nr).replace(/\D/g, '')) || 999));
    const links = [...(alt.unterlagen || []).filter((u) => u.url)];
    for (const u of g.unterlagen) if (!links.some((x) => x.url === u.url)) links.push(u);
    docs.push({ col: 'grsitzungen', id, data: { ...rest, uhrzeit: rest.uhrzeit || g.uhrzeit, ort: rest.ort || g.ort, stand: g.stand, unterlagen: links, tops } });
  }
  return docs;
}

export const MIGRATIONEN = [
  {
    id: 'vereinsmitglieder-2026-11',
    neu(mitglieder) {
      const da = new Set(mitglieder.map((m) => slugName(m.name || '')));
      return ['Christian Regner', 'Dirk Becker', 'Gabi Amtmann', 'Gerhard Gruber', 'Karin Eisenkirchner', 'Kuba Karcz', 'Radek Kowalczyk',
        'Rainer Fleckl', 'Rudolf Kau', 'Susi Ammerer', 'Tomek Karcz', 'Vanessa Gschwindl']
        .filter((name) => !da.has(slugName(name)))
        .map((name) => ({ col: 'mitglieder', id: `v-${slugName(name)}`, data: { name, email: '', rolle: 'Vereinsmitglied', funktion: '', ortsteil: '', erstelltAm: Date.now() } }));
    },
  },
  {
    // Persönliche Anmeldung: Marketing-Rolle, Admin und Zweitnamen (Spitznamen) vergeben
    id: 'rollen-2026-11',
    neu(mitglieder) {
      const MARKETING = ['gerhard gruber', 'kuba karcz', 'rainer fleckl', 'mathias mayer', 'harald mayer', 'vanessa gschwindl', 'johannes bayer', 'michael bernard'];
      const ADMIN = ['mathias mayer'];
      const AUCH = {
        'johannes bayer': ['Hannes Bayer'], 'alexander gritsch': ['Alex Gritsch'], 'markus haindl': ['Maki Haindl'],
        'thomas zeillinger': ['Tom Zeillinger', 'Tom Zeilinger', 'Thomas Zeilinger'], 'rudolf kau': ['Rudi Kau'],
        'kuba karcz': ['Jakub Karcz'], 'mathias mayer': ['Maki Mayer'],
      };
      const k = (n) => slugName(n).replace(/-/g, ' ');
      const liste = [...mitglieder];
      if (!liste.some((m) => k(m.name) === 'harald mayer')) {
        liste.push({ id: 'v-harald-mayer', name: 'Harald Mayer', email: '', rolle: 'Vereinsmitglied', funktion: 'Obmann', ortsteil: '', erstelltAm: Date.now() });
      }
      return liste.map(({ id, ...m }) => {
        const n = k(m.name);
        const auch = [...new Set([...(m.auch || []), ...(AUCH[n] || [])])];
        return { col: 'mitglieder', id, data: { ...m, auch, marketing: !!m.marketing || MARKETING.includes(n), admin: !!m.admin || ADMIN.includes(n) } };
      });
    },
  },
  {
    // Archiv: alle GR-Sitzungen seit 2025 mit TOPs, Ergebnissen und Links zu Einladung und Protokoll im GFG-Drive,
    // dazu die GFG-Anträge für die Bilanz. Bestehende Einträge werden ergänzt, nichts wird überschrieben.
    id: 'gr-archiv-2026-11',
    async neu(_m, lese) {
      const docs = await archivSitzungen(lese);
      const antraege = await lese('antraege');
      const jetzt = Date.now();
      for (const a of gfgAntraege.antraege) {
        if (antraege.some((x) => x.id === a.id)) continue;
        const { id, verlauf, ...rest } = a;
        docs.push({ col: 'antraege', id, data: {
          ...rest, erstelltAm: jetzt, geaendertAm: jetzt,
          verlauf: verlauf.map((v) => ({ ...v, von: 'Übernahme', ts: jetzt })),
        } });
      }
      const fb = antraege.find((x) => x.id === 'festlbus');
      if (fb) {
        const { id, ...rest } = fb;
        const { id: _i, ...extra } = gfgAntraege.festlbus;
        docs.push({ col: 'antraege', id, data: { ...rest, ...extra, dokumente: rest.dokumente?.length ? rest.dokumente : extra.dokumente } });
      }
      return docs;
    },
  },
  {
    // Protokoll 29.4.2026 und nicht öffentliche Teile (nur für Gemeinderäte sichtbar) nachgetragen
    id: 'gr-archiv-noe-2026-11',
    neu: (_m, lese) => archivSitzungen(lese),
  },
];
