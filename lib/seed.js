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
