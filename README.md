# GFG Fraktion

Interne Web-App der Fraktion „Gemeinsam für unsere Gemeinde“ (GFG) in der Marktgemeinde Großebersdorf.
Next.js auf Vercel, Daten in Neon Postgres, Google Kalender, Drive und Gmail über die Google-APIs.

## Stand: Etappe 1

- **Start:** nächste Fraktionssitzung mit Countdown und Ablauf (Einladung, Themenfrist, Tagesordnung, Sitzung), „Neu seit deinem letzten Besuch“, offene Aufgaben, zuletzt geänderte Anträge
- **Fraktionssitzungen:** anlegen, Kalendereinladung an alle, Themen einreichen bis zur Frist, automatische Tagesordnung mit Zeitbudget, Tagesordnung als Google Doc plus Mail, Sitzungsmodus mit Timer, Anwesenheit, Notizen, Beschlüssen und Aufgaben, Protokoll in der App und als Google Doc
- **Anträge und Anfragen:** Liste mit Suche und Filtern, Statusverlauf mit Datum und Name, Kommentare, vorbefüllt mit Festlbus und den sieben IFG-Begehren
- **Gemeinderäte:** geschützter Bereich (Benutzer „Gemeinderat“, Passwort „Gemeinde“), Mitglieder, Google-Verbindung, Einstellungen

Etappe 2: Videothemen für Markus, Aufgaben-Reiter, Ausschüsse und Berichte, Kalender, Vorbereitung der Gemeinderatssitzungen mit Abstimmungslinie und Archiv, Lesebestätigungen.

## Rollen und Schutz

- **Vereinsmitglieder** melden sich mit dem gemeinsamen Fraktionspasswort an und wählen ihren Namen. Sie lesen alles Allgemeine, reichen Themen ein, kommentieren und haken Aufgaben ab.
- **Gemeinderäte** melden sich zusätzlich mit Benutzer und Passwort an. Nur sie können Sitzungen, Anträge, Protokolle, Mitglieder und Einstellungen ändern. Das prüft der Server bei jeder Änderung.

## Einrichtung

1. **Vercel:** Add New, Project, dieses GitHub-Repo importieren, Deploy.
2. **Datenbank:** Im Vercel-Projekt unter Storage eine Neon-Postgres-Datenbank anlegen und mit dem Projekt verbinden. Dadurch wird `DATABASE_URL` gesetzt. Danach unter Deployments „Redeploy“. Tabelle und Startdaten legt die App beim ersten Aufruf selbst an.
3. **Erste Anmeldung:** App öffnen, „Als Gemeinderat anmelden“, dann im Reiter Gemeinderäte das Fraktionspasswort festlegen und bei den Mitgliedern die E-Mail-Adressen eintragen.
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
| `GR_USER`, `GR_PASSWORD` | Zugangsdaten für Gemeinderäte (Standard: Gemeinderat / Gemeinde). Empfehlung: ändern. |
| `SESSION_SECRET` | Schlüssel für Anmelde-Cookies. Ohne Angabe wird er aus `DATABASE_URL` abgeleitet. |
| `CRON_SECRET` | Schützt den täglichen Lauf. Vercel schickt ihn automatisch mit. |

## Automatik

Vercel Cron ruft täglich um 06:00 UTC `/api/cron` auf (siehe `vercel.json`):

- nach Ablauf der Einreichfrist: Tagesordnung festlegen, als Google Doc im Drive-Ordner speichern, per Mail an alle
- 7 Tage und 1 Tag vor der Sitzung: Erinnerung per Mail

Die Kalendereinladung enthält zusätzlich Erinnerungen 7 Tage und 1 Tag vorher.

## Entwicklung

```bash
npm install
npm run dev
```

Ohne `DATABASE_URL` speichert die App lokal in `/tmp/gfg-store.json`.

## Datenschutz

Keine sensiblen personenbezogenen Daten von Bürgerinnen und Bürgern eintragen. Gespeichert werden nur Namen und E-Mail-Adressen der Fraktionsmitglieder sowie die Inhalte der Fraktionsarbeit.
