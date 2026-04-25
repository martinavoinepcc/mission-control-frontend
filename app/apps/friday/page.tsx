import { Suspense } from 'react';
import FridayChat from './FridayChat';

export const metadata = {
  title: 'FRIDAY — Mission Control',
};

export default function FridayPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    }>
      <FridayChat />
    </Suspense>
  );
}
