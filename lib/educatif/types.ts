/**
 * Mission Control — Éducatif : types partagés
 *
 * Toute la structure de données qui sert aux modules pédagogiques
 * (Jackson Minecraft, Alizée lecture, etc.).
 */

export type SceneType =
  | 'hook'
  | 'concept'
  | 'examples'
  | 'try-it'
  | 'recap';

export interface AvatarVideo {
  /** Chemin relatif dans /public, ex: /videos/minecraft/p01/hook.mp4 */
  src: string;
  /** Texte complet à afficher en sous-titres synchronisés (timing simple) */
  captions: string;
  /** Durée approximative en secondes (pour progress bar) */
  duration: number;
}

export interface ExampleItem {
  id: string;
  title: string;
  emoji: string;
  shortText: string;
  /** Texte long révélé au clic — aussi lu par l'avatar si fourni */
  detailText: string;
  /** Vidéo avatar optionnelle — si absente, seulement le texte */
  detailVideo?: AvatarVideo;
}

export interface QuizChoice {
  id: string;
  label: string;
  isCorrect: boolean;
  /** Indice progressif si l'élève se trompe */
  hintIfWrong?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  /** Optionnel : question lue par l'avatar */
  promptVideo?: AvatarVideo;
  choices: QuizChoice[];
  /** Explication révélée après la bonne réponse */
  explanation: string;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Couleur d'accent Tailwind-safe (hex) */
  color: string;
}

export interface Level {
  id: number;
  name: string;
  minXp: number;
  emoji: string;
}

export interface ModuleProgress {
  moduleId: string;
  completedScenes: SceneType[];
  xpEarned: number;
  badgesEarned: string[]; // badge ids
  /** ISO datetime de la complétion */
  completedAt?: string;
}

export interface EducatifState {
  /** version du schéma pour migration future */
  version: 1;
  /** clé = username, valeur = progression par module */
  users: Record<string, { modules: Record<string, ModuleProgress> }>;
}
