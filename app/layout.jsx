import './globals.css';

export const metadata = {
  title: 'GFG Fraktion',
  description: 'Interne Organisation der Fraktion Gemeinsam für unsere Gemeinde, Großebersdorf',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'GFG Fraktion', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#245C43', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..100,500..800&family=Atkinson+Hyperlegible:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
