# Sons Kaz — banque SFX

Dossier des fichiers sons réels utilisés par `lib/kaz-sounds.ts`.

## Convention

Chaque son a 2 couches possibles :
- **Web Audio généré** : codé dans `lib/kaz-sounds.ts`, pas de fichier (sons UI simples)
- **Fichier MP3** : ici, pour les moments dramatiques

## Fichiers attendus (pattern hybride)

| Fichier | Moment jeu | Source |
|---|---|---|
| `cookie-eaten.mp3` | JaX mange cookie, +HP anim | Kenney / Pixabay CC0 |
| `potion-drink.mp3` | Potion bue, gold regen | Kenney / Pixabay CC0 |
| `boss-spawn.mp3` | Boss apparaît, dark sting | Kenney / Pixabay CC0 |
| `boss-die.mp3` | Boss down, triumphant | Kenney / Pixabay CC0 |
| `boss-drop.mp3` | Item rare drop au sol | Kenney / Pixabay CC0 |
| `wave-spawn.mp3` | Zombies spawn | Kenney / Pixabay CC0 |
| `badge-reveal.mp3` | Fanfare fin de leçon | Kenney / Pixabay CC0 |

## Specs

- Format : **MP3 128 kbps**
- Durée : **< 2 s** chacun (sauf fanfare qui peut aller ~2.5 s)
- Volume : normalisé (~-6 dB peak)
- License : **CC0 uniquement** (pas d'attribution requise)

## Sons générés (PAS dans ce dossier)

Les sons UI suivants sont codés en Web Audio dans `lib/kaz-sounds.ts`, pas de fichier :
- `ui.click`, `countdown.tick`
- `branch.if_taken`, `branch.else_taken`
- `wasted` (error buzzer)
