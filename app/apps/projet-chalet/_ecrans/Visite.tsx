'use client';

// VISITE 3D — liens vers les visites déjà publiées sur le site (pages statiques du
// dossier public/ : maquette Three.js, visite 360° Pannellum, galerie des rendus, VR Quest).
// Ces adresses sont des pages du site, pas des données : elles restent listées ici.
// Le « look final » (6 images) est affiché dans la tuile Pièces.

import { Entete, Icone, type EcranProps } from '../_kit/ui';

const VISITES = [
  { icone: 'cube', titre: 'Maquette 3D navigable', detail: 'Marcher dans le chalet, heure du soleil, luminaires', url: '/chalet-3d/' },
  { icone: 'street-view', titre: 'Visite 360°', detail: '15 panoramas pièce par pièce', url: '/chalet-3d/tour/' },
  { icone: 'images', titre: 'Galerie des rendus', detail: '29 rendus photoréalistes', url: '/chalet-3d/galerie/' },
  { icone: 'vr-cardboard', titre: 'Version VR (Quest)', detail: 'Casque de réalité virtuelle', url: '/chalet-vr/' },
];

export default function Visite(_: EcranProps) {
  return (
    <>
      <Entete titre="Visite 3D" />
      <div className="pc-liste">
        {VISITES.map((v) => (
          <a key={v.url} className="pc-ligne" href={v.url} target="_blank" rel="noopener">
            <span className="pc-pt pc-c-info"><Icone nom={v.icone} /></span>
            <span className="pc-txt"><b>{v.titre}</b><small>{v.detail}</small></span>
            <Icone nom="arrow-up-right-from-square" />
          </a>
        ))}
      </div>
    </>
  );
}
