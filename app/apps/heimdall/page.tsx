// BIFROST — pont vers HEIMDALL.
// L'ancienne page hub HEIMDALL a 4 cards a disparu (2026-05-08) :
// l'utilisateur arrive directement dans le cockpit (HEIMDALL). Ce page.tsx
// fait juste la redirection. Le slug DB reste 'assistant', le tile dashboard
// s'appelle BIFROST, la destination s'appelle HEIMDALL.

import { redirect } from 'next/navigation';

export const metadata = {
  title: 'BIFROST → HEIMDALL — Mission Control',
};

export default function BifrostRedirect() {
  redirect('/apps/heimdall/cockpit/');
}
