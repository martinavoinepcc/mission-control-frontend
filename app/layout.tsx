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
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
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
