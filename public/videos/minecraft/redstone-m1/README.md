# Vidéos HeyGen — Fondations M1 : Découverte de la Redstone

Déposer ici les 7 MP4 générés via HeyGen à partir des scripts du fichier
`Redstone-M1-Decouverte-HeyGen-Scripts.md` (à la racine de MY-MISSION-CONTROL.COM).

## Fichiers attendus

| Fichier | Scène | Durée cible |
|---|---|---|
| `hook.mp4` | Scène 1 — Le secret rouge | ~20 s |
| `concept.mp4` | Scène 2 — Les 3 briques | ~90 s |
| `example-1-bouton-lampe.mp4` | Scène 3 · Exemple 1 | ~35 s |
| `example-2-levier-porte.mp4` | Scène 3 · Exemple 2 | ~40 s |
| `example-3-plaque-piston.mp4` | Scène 3 · Exemple 3 | ~40 s |
| `try-it-intro.mp4` | Scène 4 — Intro quiz | ~15 s |
| `recap.mp4` | Scène 5 — Récap + badge | ~20 s |

## Contraintes techniques

- Format : MP4 H.264, audio AAC stéréo
- Résolution : 1080x1920 (vertical) ou 1920x1080 (horizontal)
- Poids max : ~20 MB par fichier (pour loading rapide sur iPad/mobile)
- Sous-titres : gérés côté app via `captions` dans `page.tsx` — pas besoin de burn-in

## Sans vidéos, ça marche quand même ?

Oui. Le module entier est jouable sans les MP4 :
- Les sous-titres s'affichent toujours (via `captions`)
- Le quiz fonctionne
- Le badge se débloque
- Seul le `<video>` affichera une erreur de chargement — Jackson peut lire et cliquer

Idéal pour valider la formule avec Jackson AVANT de générer les vidéos HeyGen.
