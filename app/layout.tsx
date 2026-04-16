import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'My Mission Control',
  description: 'Le portail privé de la famille Avoine-Blanchette.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
