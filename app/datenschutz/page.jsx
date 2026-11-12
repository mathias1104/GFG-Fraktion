export const metadata = { title: 'Datenschutz | GFG Fraktion', robots: { index: false, follow: false } };

export default function Datenschutz() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 60px', lineHeight: 1.6 }}>
      <p><a href="/">Zur GFG Fraktion App</a></p>
      <h1 style={{ margin: '12px 0 20px' }}>Datenschutzerklärung der GFG Fraktion App</h1>

      <h2>Wer ist verantwortlich?</h2>
      <p>
        Verantwortlich ist der Verein „Gemeinsam für unsere Gemeinde“ (GFG), Großebersdorf.
        Kontakt: <a href="mailto:team@gfg.jetzt">team@gfg.jetzt</a>
      </p>

      <h2>Wofür ist die App da?</h2>
      <p>
        Die App ist ein internes Werkzeug für die Mitglieder des Vereins und die Gemeinderätinnen und Gemeinderäte der GFG.
        Sie dient der Vorbereitung von Fraktions- und Gemeinderatssitzungen, der Verwaltung von Anträgen und der Abstimmung
        der Öffentlichkeitsarbeit. Sie ist nicht öffentlich zugänglich, die Anmeldung ist nur für eingetragene Mitglieder möglich.
      </p>

      <h2>Welche Daten verarbeiten wir?</h2>
      <p>
        Name, Rolle und auf Wunsch die E-Mail-Adresse der Mitglieder, außerdem die Inhalte, die Mitglieder in der App
        eintragen (Themen, Anträge, Notizen, hochgeladene Unterlagen). Für die Anmeldung wird ein Cookie gesetzt.
        Es gibt keine Werbung, kein Tracking und keine Weitergabe an Dritte zu anderen Zwecken.
      </p>

      <h2>Verbindung mit Google</h2>
      <p>
        Die App kann mit genau einem Google-Konto des Vereins (team@gfg.jetzt) verbunden werden. Über diese Verbindung
        legt die App Termine im Google Kalender an, speichert Tagesordnungen und Protokolle als Dokumente in Google Drive
        und verschickt Einladungen und Erinnerungen per Gmail an die Mitglieder. Die App liest keine E-Mails und greift
        nur auf Dateien zu, die sie für diese Zwecke selbst anlegt oder die ausdrücklich verknüpft werden. Die Daten aus
        Google werden ausschließlich für diese Funktionen verwendet, nicht verkauft, nicht für Werbung genutzt und nicht
        an Dritte weitergegeben. Die Nutzung von Daten aus Google-APIs hält sich an die Google API Services User Data Policy,
        einschließlich der Anforderungen zur eingeschränkten Nutzung (Limited Use).
      </p>
      <p>
        Die Verbindung kann jederzeit in der App oder unter <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> getrennt werden.
        Der gespeicherte Zugangsschlüssel wird dann nicht mehr verwendet und auf Anfrage gelöscht.
      </p>

      <h2>Wo werden die Daten gespeichert?</h2>
      <p>
        Die App läuft bei Vercel, die Daten liegen in einer Datenbank von Neon und Dateien im Speicher von Vercel.
        Diese Anbieter verarbeiten die Daten als Auftragsverarbeiter in unserem Auftrag.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du kannst Auskunft über deine Daten verlangen sowie Berichtigung, Löschung oder Einschränkung der Verarbeitung.
        Schreib dazu an <a href="mailto:team@gfg.jetzt">team@gfg.jetzt</a>. Außerdem kannst du dich bei der
        österreichischen Datenschutzbehörde beschweren (<a href="https://www.dsb.gv.at">dsb.gv.at</a>).
      </p>

      <p style={{ marginTop: 32, color: 'var(--grau)' }}>Stand: November 2026</p>
    </main>
  );
}
