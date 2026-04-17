'use client';

/**
 * /apps/educatif/minecraft/redstone-m1-decouverte/ — Module pilote des
 * Fondations Redstone (Module 1 du camp Silica : Découverte de la Redstone).
 *
 * Objectif pédagogique : Jackson comprend qu'un circuit Redstone a 3 briques
 *   SOURCE → FIL → CIBLE
 * et que le signal voyage de la source, passe par le fil, arrive à la cible.
 *
 * C'est le premier vrai concept de programmation du parcours : un ordre
 * qui part d'un endroit, voyage, et déclenche une action.
 *
 * Structure 5 scènes : hook → concept → examples → try-it → recap
 * Progression : localStorage via lib/educatif/progress.ts (clé module : rsm1)
 * Vidéos HeyGen : /public/videos/minecraft/redstone-m1/*.mp4
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

const MODULE_ID = 'rsm1';
const MODULE_TITLE = 'Fondations M1 — Découverte de la Redstone';
const ACCENT = '#DC2626'; // red-600, ton Redstone

const VIDEOS = {
  hook: {
    src: '/videos/minecraft/redstone-m1/hook.mp4',
    captions:
      "Regarde bien. J'appuie sur un bouton — et la lampe s'allume. Ce rouge qui brille dans le fil, c'est le cœur de la programmation en Minecraft. Aujourd'hui tu l'apprivoises.",
    duration: 20,
  },
  concept: {
    src: '/videos/minecraft/redstone-m1/concept.mp4',
    captions:
      "La Redstone, c'est de l'électricité en Minecraft. Pour qu'un circuit marche, il te faut TROIS morceaux. UN : une SOURCE — quelque chose qui décide si le courant part. Un bouton, un levier, une plaque de pression. DEUX : un FIL — la poussière rouge que tu poses par terre. Elle transporte le signal. TROIS : une CIBLE — ce qui s'allume ou bouge. Une lampe, une porte, un piston. Tu actives la source, le signal VOYAGE dans le fil, et la cible s'active. C'est ça, programmer : tu donnes un ordre, quelque chose se passe.",
    duration: 90,
  },
  example1: {
    src: '/videos/minecraft/redstone-m1/example-1-bouton-lampe.mp4',
    captions:
      "Le circuit le plus simple. Pose une lampe de Redstone. Colle un bouton directement dessus. Appuie : PAF, la lampe s'allume. T'as fait ton premier interrupteur.",
    duration: 35,
  },
  example2: {
    src: '/videos/minecraft/redstone-m1/example-2-levier-porte.mp4',
    captions:
      "Un levier, un long fil, une porte. Pose un levier. À partir de lui, pose une ligne de poussière rouge — 5 blocs. Au bout, pose une porte de fer. Tire le levier : la porte s'ouvre. Le signal a VOYAGÉ dans le fil.",
    duration: 40,
  },
  example3: {
    src: '/videos/minecraft/redstone-m1/example-3-plaque-piston.mp4',
    captions:
      "Une plaque de pression, connectée à un piston par un fil court. Marche sur la plaque : le piston SORT. Tu descends : il se rentre. Tu viens de créer une machine qui réagit à ta présence.",
    duration: 40,
  },
  tryIt: {
    src: '/videos/minecraft/redstone-m1/try-it-intro.mp4',
    captions:
      "Maintenant on vérifie. Quatre questions rapides. Zéro limite, tu peux réessayer autant de fois que tu veux.",
    duration: 15,
  },
  recap: {
    src: '/videos/minecraft/redstone-m1/recap.mp4',
    captions:
      "Bravo Jackson ! Tu viens de comprendre le cœur de la Redstone : SOURCE, FIL, CIBLE. Tout ce que tu vas construire au camp repose là-dessus. Ton premier badge : L'Électricien. Prochaine mission — on regarde à quelle distance le signal peut voyager.",
    duration: 20,
  },
};

const CONCEPTS = [
  {
    emoji: '⚡',
    title: 'SOURCE',
    backText:
      "Décide si le courant part. Bouton, levier, plaque de pression. C'est ton ON/OFF.",
  },
  {
    emoji: '🔗',
    title: 'FIL',
    backText:
      "La poussière rouge posée au sol. Elle transporte le signal. Rouge foncé = éteint. Rouge vif = allumé.",
  },
  {
    emoji: '💡',
    title: 'CIBLE',
    backText:
      "Ce qui s'allume ou bouge quand le signal arrive. Lampe, porte, piston, note block.",
  },
];

const EXAMPLES: ExampleItem[] = [
  {
    id: 'bouton-lampe',
    title: 'Bouton → Lampe',
    emoji: '💡',
    shortText: "Le circuit le plus simple : appuie, la lumière s'allume.",
    detailText:
      "Pose une lampe de Redstone. Colle un bouton directement dessus (sans fil, la source touche la cible). Appuie sur le bouton : la lampe s'allume pendant quelques secondes puis s'éteint. Tu viens de faire ta première commande en Minecraft. T'as programmé un interrupteur.",
    detailVideo: VIDEOS.example1,
  },
  {
    id: 'levier-porte',
    title: 'Levier + fil → Porte',
    emoji: '🚪',
    shortText: 'Le signal peut voyager loin dans un fil.',
    detailText:
      "Pose un levier. Au sol, à partir du levier, pose une ligne de poussière de Redstone — 5 blocs de long. Au bout du fil, pose une porte de fer. Tire le levier : la porte s'ouvre automatiquement. Tire encore : elle se ferme. Le signal a VOYAGÉ dans le fil jusqu'à la porte.",
    detailVideo: VIDEOS.example2,
  },
  {
    id: 'plaque-piston',
    title: 'Plaque de pression → Piston',
    emoji: '🦶',
    shortText: "Quand tu marches dessus, le piston bouge.",
    detailText:
      "Pose une plaque de pression en pierre. Connecte-la par un fil court à un piston (à 2-3 blocs de distance). Marche sur la plaque : le piston SORT. Descends de la plaque : le piston se rentre. Tu viens de créer une machine qui réagit à ta présence — comme une porte automatique ou un piège.",
    detailVideo: VIDEOS.example3,
  },
];

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'Dans un circuit Redstone, QUI décide si le courant part ?',
    choices: [
      {
        id: 'a',
        label: 'Le fil de poussière',
        isCorrect: false,
        hintIfWrong: 'Le fil TRANSPORTE le signal, il ne le décide pas.',
      },
      {
        id: 'b',
        label: 'La SOURCE — bouton, levier ou plaque',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'La cible, comme une lampe',
        isCorrect: false,
        hintIfWrong: 'La cible REÇOIT le signal, elle ne le crée pas.',
      },
    ],
    explanation:
      "La source, c'est ton interrupteur. Elle décide ON ou OFF. Sans source, rien ne part.",
  },
  {
    id: 'q2',
    prompt:
      "Tu as posé un bouton, un fil, et une lampe. Tu appuies — la lampe NE S'ALLUME PAS. Qu'est-ce que tu vérifies en premier ?",
    choices: [
      {
        id: 'a',
        label: 'Si Minecraft est à jour',
        isCorrect: false,
        hintIfWrong: "C'est un problème de circuit, pas de jeu.",
      },
      {
        id: 'b',
        label:
          'Que les 3 morceaux se TOUCHENT — que le fil va bien de la source à la cible',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'Ton compte Microsoft',
        isCorrect: false,
        hintIfWrong: "Ça n'a rien à voir avec le circuit.",
      },
    ],
    explanation:
      "90% des pannes Redstone = un fil qui ne touche pas la cible, ou une source trop loin. Suis le chemin du signal avec ton doigt.",
  },
  {
    id: 'q3',
    prompt:
      'La poussière de redstone posée au sol, qu\'est-ce qu\'elle fait quand le signal passe ?',
    choices: [
      {
        id: 'a',
        label: 'Elle disparaît',
        isCorrect: false,
        hintIfWrong: 'Regarde la COULEUR. Elle reste là.',
      },
      {
        id: 'b',
        label: 'Elle devient rouge vif — elle brille',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'Elle se transforme en diamant',
        isCorrect: false,
        hintIfWrong: "Ça serait beau, mais non.",
      },
    ],
    explanation:
      "Rouge foncé = signal OFF. Rouge vif = signal ON. Ta première astuce de débogage : regarde la couleur du fil.",
  },
  {
    id: 'q4',
    prompt: 'Dans la vraie vie, qu\'est-ce qui ressemble le plus à une SOURCE Redstone ?',
    choices: [
      {
        id: 'a',
        label: 'Une ampoule',
        isCorrect: false,
        hintIfWrong: "L'ampoule S'ALLUME — c'est une cible, pas une source.",
      },
      {
        id: 'b',
        label: 'Un interrupteur mural',
        isCorrect: true,
      },
      {
        id: 'c',
        label: 'Un fil électrique',
        isCorrect: false,
        hintIfWrong: 'Le fil transporte — comme la poussière rouge.',
      },
    ],
    explanation:
      "Interrupteur = source. Fil électrique = fil Redstone. Ampoule = cible. Même logique, un monde différent.",
  },
];

const BADGE: Badge = {
  id: 'electricien',
  name: "L'Électricien",
  emoji: '⚡',
  description:
    'Tu maîtrises les 3 briques de la Redstone : source, fil, cible. Le camp Silica commence pour vrai.',
  color: '#DC2626',
};

const SCENE_ORDER: SceneType[] = ['hook', 'concept', 'examples', 'try-it', 'recap'];

export default function RedstoneM1Page() {
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
              title="Le secret rouge de Minecraft"
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
              title="Les 3 briques d'un circuit"
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
              {"Tape sur chaque carte pour voir le circuit en détail. L'avatar t'explique, tu peux revoir autant de fois que tu veux."}
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
              title="4 questions éclair"
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
              title="Tu viens de faire ta première programmation"
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
