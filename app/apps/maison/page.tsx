'use client';

import { HubitatControl } from '@/lib/HubitatControl';

// Maison — dashboard Hubitat intégré + scènes rapides Mission Control.
// TODO : déplacer l'URL vers une variable d'env (NEXT_PUBLIC_HUBITAT_MAISON_URL)
// quand Martin tournera l'access_token. Pour l'instant c'est OK en dur vu que
// c'est un portail privé famille et l'URL est déjà partagée en clair.
const HUBITAT_MAISON_URL =
  'https://cloud.hubitat.com/api/21cb82a9-7c1f-4a53-9dc4-c7cc780da564/apps/1/dashboard/20?access_token=e47971c9-a0e6-457c-b9f0-6d2282e54d62';

export default function MaisonPage() {
  return (
    <HubitatControl
      location="maison"
      dashboardUrl={HUBITAT_MAISON_URL}
      title="Contrôle Maison"
      subtitle="Hubitat · Température, éclairage, sécurité"
      accentColor="#3B82F6"
    />
  );
}
