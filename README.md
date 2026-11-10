# GFG Fraktion

Interne Web-App der Fraktion „Gemeinsam für unsere Gemeinde“ (GFG) in der Marktgemeinde Großebersdorf.
Next.js auf Vercel, Daten in Neon Postgres, Google Kalender, Drive und Gmail über die Google-APIs.

## Funktionen

### Etappe 1

- **Start:** nächste Fraktionssitzung mit Countdown und Ablauf (Einladung, Themenfrist, Tagesordnung, Sitzung), „Neu seit deinem letzten Besuch“, offene Aufgaben, zuletzt geänderte Anträge
- **Fraktionssitzungen:** anlegen, Kalendereinladung an alle, Themen einreichen bis zur Frist, automatische Tagesordnung mit Zeitbudget, Tagesordnung als Google Doc plus Mail, Sitzungsmodus mit Timer, Anwesenheit, Notizen, Beschlüssen und Aufgaben, Protokoll in der App und als Google Doc
- **Anträge und Anfragen:** Liste mit Suche und Filtern, Statusverlauf mit Datum und Name, Kommentare, vorbefüllt mit Festlbus und den sieben IFG-Begehren
- **Gemeinderäte:** geschützter Bereich (Benutzer „Gemeinderat“, Passwort „Gemeinde“), Mitglieder, Google-Verbindung, Einstellungen

### Etappe 2

- **Infos an die Fraktion** auf der Startseite, bei wichtigen Infos mit Lesebestätigung („gelesen von 6 von 8“, Gemeinderäte sehen, wer noch fehlt)
- **Themen für Markus' Videos:** vorschlagen mit Beschreibung, Ortsteil, Dringlichkeit, bis zu 3 Fotos und Links, Daumen hoch, Status Idee bis veröffentlicht mit Link zum Post
- **Aufgaben:** alle Aufgaben mit Filter (offen, meine, überfällig, erledigt), überfällige rot
- **Ausschüsse und Berichte:** pro Ausschuss Vorsitz, GFG-Vertreter, nächste Sitzung und Berichte
- **Kalender:** Fraktionssitzungen, Gemeinderatssitzungen, Ausschusssitzungen, Veranstaltungen, Themenfristen und Aufgabenfristen
- **Gemeinderäte:** Vorbereitung der Gemeinderatssitzungen (Unterlagen, TOPs, Abstimmungslinie mit Begründung, wer spricht, Ergebnis) und Abstimmungsarchiv, vorbefüllt mit der Feldgasse vom 12.10.2026
- **Jotform:** Themen aus dem Formular für Leute ohne Login werden täglich übernommen

### Benachrichtigungen

- Glocke oben mit allem, was neu ist
- Push-Mitteilungen auf Handy und Computer (am iPhone erst nach „Zum Home-Bildschirm“)
- E-Mails über das verbundene Google-Konto (Empfänger als Bcc)
- Jede Person stellt unter Benachrichtigungen mit Schaltern ein, worüber sie auf welchem Weg informiert wird
- Benötigt `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT` in Vercel

## Rollen und Schutz

- **Anmeldung:** Jede Person meldet sich mit Vor- und Nachname und einem persönlichen Passwort an. Das Startpasswort ist GFG plus die Anfangsbuchstaben von Vor- und Nachname (z. B. GFGMM). Unter Benachrichtigungen kann jede Person ein eigenes Passwort festlegen; der Admin kann es zurücksetzen.
- **Rollen** stehen bei der Person und werden unter „Personen und Rollen“ vom Admin vergeben:
  - **Vereinsmitglied:** liest alles Allgemeine, reicht Themen ein, kommentiert, hakt Aufgaben ab.
  - **Gemeinderat:** zusätzlich Sitzungen, Anträge, Protokolle, Gemeinderäte-Bereich und Einstellungen.
  - **Marketing** (zusätzlich zu einer der beiden): Marketing-Reiter.
  - **Admin:** verwaltet Personen, Rollen und Passwörter.
- Der Server prüft die Rollen bei jeder Anfrage. Geänderte Rollen gelten sofort, ein geändertes Passwort meldet alte Geräte ab.

## Einrichtung

1. **Vercel:** Add New, Project, dieses GitHub-Repo importieren, Deploy.
2. **Datenbank:** Im Vercel-Projekt unter Storage eine Neon-Postgres-Datenbank anlegen und mit dem Projekt verbinden. Dadurch wird `DATABASE_URL` gesetzt. Danach unter Deployments „Redeploy“. Tabelle und Startdaten legt die App beim ersten Aufruf selbst an.
3. **Erste Anmeldung:** Als Admin mit Name und Startpasswort anmelden und unter „Personen und Rollen“ die E-Mail-Adressen eintragen.
4. **Google (Kalender, Docs, Mail):**
   1. In der Google Cloud Console ein Projekt anlegen.
   2. Unter „APIs und Dienste“ die Google Calendar API, Google Drive API und Gmail API aktivieren.
   3. OAuth-Zustimmungsbildschirm einrichten. Bei einem Google-Workspace-Konto (z. B. team@gfg.jetzt) Typ „Intern“ wählen. Bei einem privaten Gmail-Konto „Extern“ wählen und die App auf „In Produktion“ stellen, sonst läuft die Verbindung nach 7 Tagen ab. Die Warnung „nicht verifiziert“ kann man für den eigenen Gebrauch bestätigen.
   4. Anmeldedaten, OAuth-Client-ID, Typ Webanwendung. Autorisierte Weiterleitungs-URI: `https://DEINE-ADRESSE.vercel.app/api/google/callback`
   5. Client-ID und Clientschlüssel in Vercel unter Settings, Environment Variables als `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` eintragen, dann Redeploy.
   6. In der App unter Gemeinderäte „Google-Konto verbinden“ mit dem Konto, über das Einladungen und Mails laufen sollen. Dieses Konto braucht Schreibrechte im Drive-Ordner „GFG Fraktionssitzungen“.

### Optionale Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `SESSION_SECRET` | Schlüssel für Anmelde-Cookies. Ohne Angabe wird er aus `DATABASE_URL` abgeleitet. |
| `CRON_SECRET` | Schützt den täglichen Lauf. Vercel schickt ihn automatisch mit. |
| `JOTFORM_API_KEY` | Jotform-API-Schlüssel (Jotform, Einstellungen, API). Damit übernimmt die App Formular-Einreichungen als Themen. |

## Automatik

Sobald ein Google-Konto verbunden ist:

- neue Fraktionssitzung (im Reiter Sitzungen oder im Kalender): Kalendereinladung an alle Mitglieder mit E-Mail-Adresse
- Datum, Uhrzeit oder Ort geändert: Kalendertermin wird bei allen aktualisiert
- Sitzung gelöscht: Kalendertermin wird abgesagt
- Sitzung im Sitzungsmodus beendet: Protokoll wird als Google Doc gespeichert

Täglicher Lauf:

Vercel Cron ruft täglich um 06:00 UTC `/api/cron` auf (siehe `vercel.json`):

- nach Ablauf der Einreichfrist: Tagesordnung festlegen, als Google Doc im Drive-Ordner speichern, per Mail an alle
- 7 Tage und 1 Tag vor der Sitzung: Erinnerung per Mail
- Formular-Einreichungen aus Jotform als Themen übernehmen (wenn `JOTFORM_API_KEY` gesetzt ist)

Die Kalendereinladung enthält zusätzlich Erinnerungen 7 Tage und 1 Tag vorher.

## Entwicklung

```bash
npm install
npm run dev
```

Ohne `DATABASE_URL` speichert die App lokal in `/tmp/gfg-store.json`.

## Datenschutz

Keine sensiblen personenbezogenen Daten von Bürgerinnen und Bürgern eintragen. Gespeichert werden nur Namen und E-Mail-Adressen der Fraktionsmitglieder sowie die Inhalte der Fraktionsarbeit. Fotos für Videothemen werden verkleinert in der Datenbank gespeichert und sind nur nach Anmeldung abrufbar.
