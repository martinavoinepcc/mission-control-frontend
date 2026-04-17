'use client';

/**
 * <Quiz> — questions à choix multiples avec :
 *  - feedback instantané
 *  - indices progressifs sur erreur (pas de "mauvaise réponse" brutale)
 *  - re-essai illimité
 *  - avatar qui peut lire la question (promptVideo optionnelle)
 *
 * Jackson-friendly : zéro punition sur erreur, animation douce, encouragement.
 */

import { useState } from 'react';
import type { QuizQuestion } from '@/lib/educatif/types';
import AvatarScene from './AvatarScene';

interface Props {
  questions: QuizQuestion[];
  onComplete?: () => void;
  accentColor?: string;
}

export default function Quiz({
  questions,
  onComplete,
  accentColor = '#10B981',
}: Props) {
  const [idx, setIdx] = useState(0);
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  const q = questions[idx];
  if (!q) return null;

  const handleChoice = (choiceId: string) => {
    const choice = q.choices.find(c => c.id === choiceId);
    if (!choice) return;
    setAnsweredId(choiceId);
    if (choice.isCorrect) {
      setShowExplanation(true);
    } else {
      setAttempts(attempts + 1);
    }
  };

  const handleNext = () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      setAnsweredId(null);
      setAttempts(0);
      setShowExplanation(false);
    } else {
      onComplete?.();
    }
  };

  const selected = q.choices.find(c => c.id === answeredId);
  const isWrong = selected && !selected.isCorrect;

  return (
    <div className="flex flex-col gap-5">
      {/* Compteur questions */}
      <div className="text-center text-sm font-semibold text-white/70">
        Question {idx + 1} / {questions.length}
      </div>

      {/* Avatar lit la question si fournie */}
      {q.promptVideo && (
        <AvatarScene
          video={q.promptVideo}
          accentColor={accentColor}
          autoPlay={true}
        />
      )}

      {/* Prompt */}
      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: `2px solid ${accentColor}`,
        }}
      >
        <p className="text-lg sm:text-xl font-bold text-white leading-snug">
          {q.prompt}
        </p>
      </div>

      {/* Choices */}
      <div className="flex flex-col gap-3">
        {q.choices.map(c => {
          const chosen = answeredId === c.id;
          const shouldHighlightCorrect = showExplanation && c.isCorrect;
          const shouldHighlightWrong = chosen && !c.isCorrect;

          let bg = 'bg-slate-800';
          let border = 'border-white/10';
          if (shouldHighlightCorrect) {
            bg = '';
            border = 'border-green-400';
          } else if (shouldHighlightWrong) {
            bg = '';
            border = 'border-red-400';
          }

          return (
            <button
              key={c.id}
              onClick={() => handleChoice(c.id)}
              disabled={showExplanation}
              className={`min-h-[56px] p-4 rounded-2xl border-2 text-left text-base sm:text-lg text-white touch-manipulation transition-all ${bg} ${border} ${
                showExplanation ? 'cursor-default' : 'hover:bg-slate-700'
              }`}
              style={
                shouldHighlightCorrect
                  ? { backgroundColor: 'rgba(16, 185, 129, 0.25)' }
                  : shouldHighlightWrong
                  ? { backgroundColor: 'rgba(239, 68, 68, 0.18)' }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-3">
                <span>{c.label}</span>
                {shouldHighlightCorrect && <span className="text-2xl">✅</span>}
                {shouldHighlightWrong && <span className="text-2xl">🔁</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Feedback indice sur erreur */}
      {isWrong && !showExplanation && (
        <div
          className="rounded-2xl p-4 border-2"
          style={{
            borderColor: '#f59e0b',
            background: 'rgba(245, 158, 11, 0.12)',
          }}
        >
          <p className="text-base text-white leading-snug">
            <span className="font-bold">💡 Indice :</span>{' '}
            {selected?.hintIfWrong ||
              'Essaie encore, tu peux y arriver ! Relis la question et choisis une autre réponse.'}
          </p>
          <p className="text-sm text-white/60 mt-2">
            Essai {attempts} — aucune limite, prends ton temps.
          </p>
        </div>
      )}

      {/* Explanation + CTA suivant */}
      {showExplanation && (
        <div
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: `2px solid ${accentColor}`,
          }}
        >
          <p className="text-base sm:text-lg text-white font-semibold">
            🎉 Bravo ! {q.explanation}
          </p>
          <button
            onClick={handleNext}
            className="min-h-[48px] px-6 rounded-full font-bold text-white text-base touch-manipulation self-end"
            style={{ backgroundColor: accentColor }}
          >
            {idx < questions.length - 1 ? 'Question suivante →' : 'Terminer ✓'}
          </button>
        </div>
      )}
    </div>
  );
}
