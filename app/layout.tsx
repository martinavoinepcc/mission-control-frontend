import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/push/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'My Mission Control',
  description: 'Le portail privé de la famille Avoine-Blanchette.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Mission Control',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    // Onglet navigateur (laptop) → logo BLANC
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    // Raccourci iPhone (home screen, iOS apple-touch-icon) → logo NOIR
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

// Adaptation mobile : viewport responsive + safe-area pour iPhone notch.
// user-scalable reste activé pour accessibilité.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#050814',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased overflow-x-hidden">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
