'use client';

/**
 * /apps/educatif/minecraft/p01-telechargement/ — Module P01 (pilote).
 *
 * Structure 5 scènes :
 *   hook → concept → examples → try-it → recap
 *
 * Scripts HeyGen + MP4 dans public/videos/minecraft/p01/.
 * Progression sauvée en localStorage via lib/educatif/progress.ts.
 */

import { useEffect, useState } from 'react';
import LessonShell from '@/components/educatif/LessonShell';
import AvatarScene from '@/components/educatif/AvatarScene';
import ConceptCard from '@/components/educatif/ConceptCard';
import ExampleGallery from '@/components/educatif/ExampleGallery';
import Quiz from '@/components/educatif/Quiz';
import BadgeReveal from '@/components/educatif/BadgeReveal';
import XPCounter from '@/components/educatif/XPCounter';
import {
  getCurrentUsername,
  getModuleProgress,
  markSceneComplete,
  awardBadge,
} from '@/lib/educatif/progress';
import type {
  SceneType,
  ExampleItem,
  QuizQuestion,
  Badge,
} from '@/lib/educatif/types';

const MODULE_ID = 'p01';
const MODULE_TITLE = 'P01 — Télécharger Minecraft';
const ACCENT = '#10B981';

const VIDEOS = {
  hook: {
    src: '/videos/minecraft/p01/hook.mp4',
    captions:
      'Salut Jackson ! On installe Minecraft Java Edition ensemble. C\'est ta première mission.',
    duration: 20,
  },
  concept: {
    src: '/videos/minecraft/p01/concept.mp4',
    captions:
      'Java Edition, c\'est la version qui accepte les mods et les outils comme Silica Studio. Tu as besoin de trois choses : un compte Microsoft, le launcher officiel, et Java Edition.',
    duration: 90,
  },
  example1: {
    src: '/videos/minecraft/p01/example-1-microsoft.mp4',
    captions:
      'Le compte Microsoft, c\'est ton passe-partout : tu vas sur microsoft.com, tu crées un compte avec un courriel et un mot de passe.',
    duration: 35,
  },
  example2: {
    src: '/videos/minecraft/p01/example-2-launcher.mp4',
    captions:
      'Le launcher est l\'app qui lance Minecraft. Tu le télécharges sur minecraft.net/download puis tu te connectes avec ton compte Microsoft.',
    duration: 35,
  },
  example3: {
    src: '/videos/minecraft/p01/example-3-premier-monde.mp4',
    captions:
      'Dans le launcher, choisis Minecraft Java Edition à gauche, clique sur Jouer, puis Solo puis Créer un nouveau monde. T\'es dedans !',
    duration: 40,
  },
  tryIt: {
    src: '/videos/minecraft/p01/try-it-intro.mp4',
    captions:
      'Maintenant on vérifie avec un mini-jeu. Zéro limite, tu peux réessayer autant que tu veux.',
    duration: 15,
  },
  recap: {
    src: '/videos/minecraft/p01/recap.mp4',
    captions:
      'Bravo Jackson ! Tu viens de débloquer ton premier badge : L\'Installateur. Ton aventure de Codeur Minecraft commence maintenant.',
    duration: 20,
  },
};

const CONCEPTS = [
  {
    emoji: '☕',
    title: 'Java Edition',
    backText:
      'C\'est la version de Minecraft qui accepte les mods et les outils de programmation. C\'est celle qu\'on utilise au camp.',
  },
  {
    emoji: '🪪',
    title: 'Compte Microsoft',
    backText:
      'Ton identité dans Minecraft. Sans compte, pas de jeu — c\'est ton passe-partout.',
  },
  {
    emoji: '🚀',
    title: 'Launcher',
    backText:
      'L\'application qui lance Minecraft. C\'est le tableau de bord : là où on choisit la version et on démarre.',
  },
];

const EXAMPLES: ExampleItem[] = [
  {
    id: 'microsoft',
    title: 'Crée ton compte Microsoft',
    emoji: '🪪',
    shortText: 'Ton passeport pour entrer dans Minecraft.',
    detailText:
      'Va sur microsoft.com, clique sur « Se connecter » en haut à droite puis « Créer un compte ». Entre un courriel que tu connais, un mot de passe solide. Vérification par courriel — papa ou maman peut t\'aider. Une fois fait, garde ce compte bien précieux : tu en auras besoin partout.',
    detailVideo: VIDEOS.example1,
  },
  {
    id: 'launcher',
    title: 'Télécharge le launcher',
    emoji: '🚀',
    shortText: 'L\'app qui lance Minecraft.',
    detailText:
      'Va sur minecraft.net/download. Clique sur le bouton pour ton système (Windows ou Mac). Un fichier se télécharge : double-clique pour installer. Ouvre le launcher, connecte-toi avec ton compte Microsoft. Tu es prêt à choisir ta version.',
    detailVideo: VIDEOS.example2,
  },
  {
    id: 'premier-monde',
    title: 'Lance ton premier monde',
    emoji: '🌍',
    shortText: 'Ton tout premier monde Java.',
    detailText:
      'Dans le launcher, choisis « Minecraft Java Edition » à gauche. Gros bouton vert « Jouer ». Le jeu télécharge ses fichiers — 2 à 5 minutes, c\'est normal. Quand le menu apparaît : Solo → Créer un nouveau monde → nomme-le « Mon-Premier-Monde ». Bienvenue !',
    detailVideo: VIDEOS.example3,
  },
];

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'Pourquoi on installe Minecraft Java Edition et pas Bedrock ?',
    choices: [
      {
        id: 'a',
        label: 'Parce que Java Edition est plus jolie',
        isCorrect: false,
        hintIfWrong: 'La raison est technique, pas graphique. Pense à ce qu\'on fait au camp.',
      },
      {
        id: 'b',
        label:
          'Parce que Java Edition accepte les mods et les outils comme Silica Studio',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'Parce que Bedrock est payant et Java est gratuit',
        isCorrect: false,
        hintIfWrong:
          'Les deux coûtent de l\'argent. La vraie raison concerne le camp de codage.',
      },
    ],
    explanation:
      'Java Edition, c\'est LA version pour les codeurs. C\'est celle qui ouvre la porte aux mods, aux serveurs spéciaux et aux outils de programmation.',
  },
  {
    id: 'q2',
    prompt: 'De quoi tu as besoin pour installer Minecraft Java Edition ?',
    choices: [
      {
        id: 'a',
        label: 'Juste le jeu',
        isCorrect: false,
        hintIfWrong: 'Il te manque un compte pour t\'identifier.',
      },
      {
        id: 'b',
        label: 'Un compte Microsoft + le launcher officiel + Java Edition',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'Une manette et une Nintendo Switch',
        isCorrect: false,
        hintIfWrong:
          'Java Edition est sur ordinateur (PC/Mac), pas sur console.',
      },
    ],
    explanation:
      'Les trois pièces ensemble forment ta clé : le compte pour t\'identifier, le launcher pour lancer, Java Edition pour jouer.',
  },
  {
    id: 'q3',
    prompt: 'Dans le launcher, où tu choisis quelle version jouer ?',
    choices: [
      {
        id: 'a',
        label: 'Dans un menu en haut à droite',
        isCorrect: false,
        hintIfWrong: 'Regarde plutôt la colonne de gauche du launcher.',
      },
      {
        id: 'b',
        label: 'Dans la liste à gauche, en choisissant « Minecraft Java Edition »',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'Dans les paramètres Windows',
        isCorrect: false,
        hintIfWrong:
          'Windows ne gère pas Minecraft. Le launcher fait tout le travail.',
      },
    ],
    explanation:
      'La liste à gauche, c\'est le menu principal du launcher : c\'est là que tu choisis Java Edition, puis tu cliques sur Jouer.',
  },
];

const BADGE: Badge = {
  id: 'installateur',
  name: 'L\'Installateur',
  emoji: '📥',
  description: 'Tu as installé Minecraft Java Edition. Ton aventure commence !',
  color: '#10B981',
};

const SCENE_ORDER: SceneType[] = ['hook', 'concept', 'examples', 'try-it', 'recap'];

export default function P01Page() {
  const [scene, setScene] = useState<SceneType>('hook');
  const [username, setUsername] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [examplesDone, setExamplesDone] = useState(false);
  const [badgeShown, setBadgeShown] = useState(false);
  const [hookDone, setHookDone] = useState(false);
  const [conceptDone, setConceptDone] = useState(false);

  useEffect(() => {
    const u = getCurrentUsername();
    if (!u) {
      window.location.href = '/';
      return;
    }
    setUsername(u);

    // Restaurer progression
    const p = getModuleProgress(u, MODULE_ID);
    if (p.completedScenes.includes('recap')) {
      setScene('recap');
      setHookDone(true);
      setConceptDone(true);
      setExamplesDone(true);
      setQuizDone(true);
    }
  }, []);

  const idx = SCENE_ORDER.indexOf(scene);

  const canAdvance = (() => {
    if (scene === 'hook') return hookDone;
    if (scene === 'concept') return conceptDone;
    if (scene === 'examples') return examplesDone;
    if (scene === 'try-it') return quizDone;
    if (scene === 'recap') return false;
    return false;
  })();

  const handleNext = () => {
    if (!username) return;
    if (!canAdvance) return;

    const xpMap: Record<SceneType, number> = {
      hook: 10,
      concept: 20,
      examples: 30,
      'try-it': 40,
      recap: 50,
    };
    markSceneComplete(username, MODULE_ID, scene, xpMap[scene]);

    if (idx < SCENE_ORDER.length - 1) {
      setScene(SCENE_ORDER[idx + 1]);
      setRefreshKey(k => k + 1);
    }
  };

  const handlePrev = () => {
    if (idx > 0) setScene(SCENE_ORDER[idx - 1]);
  };

  const handleFinish = () => {
    if (!username) return;
    markSceneComplete(username, MODULE_ID, 'recap', 50);
    awardBadge(username, MODULE_ID, BADGE.id);
    setBadgeShown(true);
    setRefreshKey(k => k + 1);
  };

  if (!username) return null;

  return (
    <>
      <LessonShell
        moduleTitle={MODULE_TITLE}
        currentScene={scene}
        onPrev={idx > 0 ? handlePrev : undefined}
        onNext={canAdvance && idx < SCENE_ORDER.length - 1 ? handleNext : undefined}
        canPrev={idx > 0}
        canNext={canAdvance}
        accentColor={ACCENT}
      >
        {/* ==== SCÈNE 1 : HOOK ==== */}
        {scene === 'hook' && (
          <section className="flex flex-col gap-5">
            <AvatarScene
              video={VIDEOS.hook}
              title="Prêt à devenir Codeur Minecraft ?"
              accentColor={ACCENT}
              onEnded={() => setHookDone(true)}
            />
            <button
              onClick={() => setHookDone(true)}
              className="self-center text-sm text-white/60 underline touch-manipulation min-h-[44px]"
            >
              Continuer sans attendre
            </button>
          </section>
        )}

        {/* ==== SCÈNE 2 : CONCEPT ==== */}
        {scene === 'concept' && (
          <section className="flex flex-col gap-6">
            <AvatarScene
              video={VIDEOS.concept}
              title="Les 3 pièces de la clé"
              accentColor={ACCENT}
              onEnded={() => setConceptDone(true)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CONCEPTS.map(c => (
                <ConceptCard
                  key={c.title}
                  emoji={c.emoji}
                  title={c.title}
                  backText={c.backText}
                  accentColor={ACCENT}
                />
              ))}
            </div>
            <button
              onClick={() => setConceptDone(true)}
              className="self-center text-sm text-white/60 underline touch-manipulation min-h-[44px]"
            >
              {"J'ai compris, on continue"}
            </button>
          </section>
        )}

        {/* ==== SCÈNE 3 : EXEMPLES ==== */}
        {scene === 'examples' && (
          <section className="flex flex-col gap-4">
            <p className="text-base sm:text-lg text-white/80">
              {"Tape sur chaque carte pour voir l'étape en détail. L'avatar t'explique tout — tu peux rejouer autant de fois que tu veux."}
            </p>
            <ExampleGallery
              items={EXAMPLES}
              accentColor={ACCENT}
              onAllOpened={() => setExamplesDone(true)}
            />
          </section>
        )}

        {/* ==== SCÈNE 4 : TRY-IT (Quiz) ==== */}
        {scene === 'try-it' && (
          <section className="flex flex-col gap-5">
            <AvatarScene
              video={VIDEOS.tryIt}
              title="Mini-jeu de vérification"
              accentColor={ACCENT}
            />
            <Quiz
              questions={QUESTIONS}
              accentColor={ACCENT}
              onComplete={() => setQuizDone(true)}
            />
          </section>
        )}

        {/* ==== SCÈNE 5 : RÉCAP + BADGE ==== */}
        {scene === 'recap' && (
          <section className="flex flex-col gap-5">
            <AvatarScene
              video={VIDEOS.recap}
              title="Bravo, Codeur !"
              accentColor={ACCENT}
            />
            <XPCounter refreshKey={refreshKey} />
            {!badgeShown && (
              <button
                onClick={handleFinish}
                className="min-h-[56px] rounded-full font-bold text-white text-base sm:text-lg touch-manipulation"
                style={{ backgroundColor: ACCENT }}
              >
                🎁 Récupérer mon badge
              </button>
            )}
            <a
              href="/apps/educatif/minecraft/"
              className="min-h-[48px] flex items-center justify-center rounded-full bg-white/10 text-white font-semibold touch-manipulation hover:bg-white/20"
            >
              ← Retour au parcours Minecraft
            </a>
          </section>
        )}
      </LessonShell>

      <BadgeReveal
        badge={BADGE}
        show={badgeShown}
        onDone={() => {
          setBadgeShown(false);
          window.location.href = '/apps/educatif/minecraft/';
        }}
      />
    </>
  );
}
