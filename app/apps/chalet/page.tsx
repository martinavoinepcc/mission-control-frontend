'use client';

import { HubitatControl } from '@/lib/HubitatControl';

// Chalet — dashboard Hubitat intégré + scènes rapides Mission Control.
// TODO : Martin, remplace HUBITAT_CHALET_URL par la vraie URL du chalet quand
// tu l'auras. Pour l'instant pointe sur le même dashboard que Maison — le module
// est prêt, il ne manque que l'URL.
const HUBITAT_CHALET_URL =
  'https://cloud.hubitat.com/api/21cb82a9-7c1f-4a53-9dc4-c7cc780da564/apps/1/dashboard/20?access_token=e47971c9-a0e6-457c-b9f0-6d2282e54d62';

export default function ChaletPage() {
  return (
    <HubitatControl
      location="chalet"
      dashboardUrl={HUBITAT_CHALET_URL}
      title="Contrôle Chalet"
      subtitle="Hubitat · Préchauffe ton chalet avant d'arriver"
      accentColor="#F59E0B"
    />
  );
}
