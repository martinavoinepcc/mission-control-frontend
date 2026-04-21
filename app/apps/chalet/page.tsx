'use client';

import { ChaletControl } from '@/lib/ChaletControl';

// URL Hubitat pour fallback (iframe "Vue classique" déployable en bas).
// Préférer une env var quand on aura rotate le token. Pour l'instant hardcoded —
// repo privé, URL déjà partagée famille.
const HUBITAT_URL =
  'https://cloud.hubitat.com/api/21cb82a9-7c1f-4a53-9dc4-c7cc780da564/apps/1/dashboard/20?access_token=e47971c9-a0e6-457c-b9f0-6d2282e54d62';

export default function ChaletPage() {
  return (
    <ChaletControl
      location="CHALET"
      title="Contrôle Chalet"
      subtitle="Thermostats, presets et météo · Lac Mékinac"
      accentColor="#F59E0B"
      hubitatDashboardUrl={HUBITAT_URL}
    />
  );
}
