# Banque webcam Kaz — émotions

Dossier des 10 visuels webcam de Kaz pour alimenter la bulle OBS-style dans les mockups Kaz & Moi.

## Convention de nommage

| Fichier | Émotion | Usage typique |
|---|---|---|
| `kaz-neutral.png` | Défaut / idle | Transitions, état calme |
| `kaz-focused.png` | Explication / leçon | Concept enseigné, panel code ouvert |
| `kaz-happy.png` | Encouragement | Petit succès de JaX |
| `kaz-hype.png` | Grande victoire / POG | Boss down, wave survie, gros win |
| `kaz-thinking.png` | Réflexion / pause | Avant un choix, moment suspendu |
| `kaz-surprised.png` | Plot twist | Potion qui drop, event inattendu |
| `kaz-stressed.png` | Mauvais call / danger | JaX fait erreur, zombie approche |
| `kaz-laughing.png` | Moment drôle | Vanne chat, punchline, fail comique |
| `kaz-teasing.png` | Ribbing JaX / playful | Petite pique affectueuse |
| `kaz-proud.png` | Approbation calme | JaX comprend, nod subtil |

## Specs

- Format : **PNG avec fond transparent**
- Résolution : **640×640**
- Cadrage : tête + épaules, centré, même distance/angle sur les 10
- Éclairage : RGB stream room identique sur les 10
- Base character à lock (seed / character reference) puis varier uniquement l'émotion

## Wire côté code

Une fois les fichiers déposés ici, le mockup S2 (et S1 en retro-fit) lit `kaz-{mood}.png` selon la bulle en cours.
Les moods utilisés dans `Kaz-S2-Cookie-Qui-Soigne-scenario.md` sont : happy · focused · stressed.
Les autres sont pour extension future.

Drop files here. Ne pas toucher à la structure sans mettre à jour `mockups/kaz-*-s*.html`.
