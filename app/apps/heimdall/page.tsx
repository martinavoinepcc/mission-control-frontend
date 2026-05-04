import { Suspense } from 'react';
import HeimdallHub from './HeimdallHub';

export const metadata = {
  title: 'HEIMDALL — Mission Control',
  description: 'Holistic Environmental Intelligence & Monitoring, Decision And Link Layer.',
};

export default function HeimdallPage() {
  return (
    <Suspense fallback={
      <main className="relative flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    }>
      <HeimdallHub />
    </Suspense>
  );
}
