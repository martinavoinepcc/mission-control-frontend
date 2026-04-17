'use client';

// Carte des missions d'un module.
// Affichage style "level map" façon Candy Crush / Duolingo : missions enchaînées verticalement,
// verrouillées si la précédente n'est pas COMPLETED.
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getEduModule, clearToken, type EduModuleDetail, type EduLessonSummary } from '@/lib/api';
import { UI } from '@/lib/icons';

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ModuleMapInner />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 cosmic-grid" />
      <FontAwesomeIcon icon={UI.spinner} className="text-neon-cyan text-3xl animate-spin" />
    </main>
  );
}

function ModuleMapInner() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get('slug');
  const [data, setData] = useState<EduModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      router.push('/apps/educatif/');
      return;
    }
    (async () => {
      try {
        const d = await getEduModule(slug);
        setData(d);
      } catch (err: any) {
        if (err.message.includes('Session') || err.message.includes('Authentification')) {
          clearToken();
          router.push('/');
          return;
        }
        setError(err.message || 'Erreur lors du chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, router]);

  if (loading) return <LoadingScreen />;
  if (error || !data) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <div className="relative glass rounded-xl p-6 text-red-300">
          <FontAwesomeIcon icon={UI.warning} className="mr-2" />
          {error || 'Module introuvable.'}
          <button onClick={() => router.push('/apps/educatif/')} className="ml-4 text-cyan-300 underline">
            Retour
          </button>
        </div>
      </main>
    );
  }

  const color = data.module.coverColor || '#4ADE80';
  const lessons = data.lessons;

  // Grouper par chapitre
  const byChapter: Record<number, EduLessonSummary[]> = {};
  for (const l of lessons) {
    if (!byChapter[l.chapter]) byChapter[l.chapter] = [];
    byChapter[l.chapter].push(l);
  }

  return (
    <main className="relative min-h-screen pb-20">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob w-[600px] h-[600px] -top-40 -left-40 animate-pulse-slow opacity-20" style={{ background: color }} />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/apps/educatif/')}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm"
          >
            <FontAwesomeIcon icon={UI.back} /> Hub
          </button>
          <div className="text-xs text-white/40 uppercase tracking-wider">Module v{data.module.version || '1.0.0'}</div>
        </header>

        {/* Titre module */}
        <section className="mb-10 text-center animate-fade-up">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
            style={{ background: `${color}25`, border: `2px solid ${color}55` }}
          >
            <FontAwesomeIcon icon={UI.cube} className="text-4xl" style={{ color }} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">{data.module.title}</h1>
          {data.module.subtitle && <p className="text-white/60 text-lg">{data.module.subtitle}</p>}
          {data.module.description && <p className="text-white/40 text-sm mt-3 max-w-xl mx-auto">{data.module.description}</p>}
        </section>

        {/* Missions par chapitre */}
        {Object.keys(byChapter).sort((a, b) => Number(a) - Number(b)).map((chapterKey) => {
          const chapterNum = Number(chapterKey);
          const chapterLessons = byChapter[chapterNum];
          return (
            <section key={chapterKey} className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm"
                  style={{ background: `${color}30`, color }}
                >
                  {chapterNum}
                </div>
                <h2 className="font-display text-xl font-semibold">Chapitre {chapterNum}</h2>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="relative">
                {/* Ligne verticale reliant les missions */}
                <div
                  className="absolute left-8 top-8 bottom-8 w-0.5"
                  style={{ background: `linear-gradient(to bottom, ${color}30, transparent)` }}
                />
                <div className="space-y-4">
                  {chapterLessons.map((l, idx) => (
                    <LessonNode
                      key={l.id}
                      lesson={l}
                      moduleColor={color}
                      moduleSlug={data.module.slug}
                      delay={idx * 80}
                      onClick={() => {
                        if (!l.isUnlocked) return;
                        router.push(`/apps/educatif/mission/?id=${l.id}&module=${data.module.slug}`);
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function LessonNode({
  lesson,
  moduleColor,
  moduleSlug,
  delay,
  onClick,
}: {
  lesson: EduLessonSummary;
  moduleColor: string;
  moduleSlug: string;
  delay: number;
  onClick: () => void;
}) {
  const isBoss = lesson.kind === 'BOSS';
  const isCompleted = lesson.status === 'COMPLETED';
  const isInProgress = lesson.status === 'IN_PROGRESS';
  const isLocked = !lesson.isUnlocked;

  const bgColor = isCompleted ? '#10B981' : isBoss ? '#EF4444' : moduleColor;
  const icon = isLocked ? UI.lock : isBoss ? UI.crown : isCompleted ? UI.checkMark : UI.play;

  return (
    <div
      className="relative flex items-center gap-4 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Pastille cercle */}
      <button
        onClick={onClick}
        disabled={isLocked}
        className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${
          isLocked
            ? 'bg-white/5 border border-white/10 cursor-not-allowed'
            : 'hover:scale-110 active:scale-95 shadow-lg'
        }`}
        style={
          isLocked
            ? {}
            : {
                background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
                boxShadow: `0 8px 24px ${bgColor}40`,
              }
        }
      >
        <FontAwesomeIcon
          icon={icon}
          className={`text-xl ${isLocked ? 'text-white/30' : 'text-white'}`}
        />
        {isBoss && !isLocked && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-black flex items-center justify-center">
            <FontAwesomeIcon icon={UI.fire} className="text-[10px] text-white" />
          </div>
        )}
      </button>

      {/* Détail à droite */}
      <button
        onClick={onClick}
        disabled={isLocked}
        className={`flex-1 text-left glass rounded-xl p-4 transition-all ${
          isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                {isBoss ? 'BOSS' : `Mission ${lesson.order}`}
              </span>
              {lesson.conceptKey && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full border"
                  style={{
                    color: moduleColor,
                    borderColor: `${moduleColor}44`,
                    background: `${moduleColor}15`,
                  }}
                >
                  {lesson.conceptKey}
                </span>
              )}
            </div>
            <h3 className="font-display font-semibold text-white truncate">{lesson.title}</h3>
            {lesson.subtitle && <p className="text-white/50 text-xs mt-0.5 line-clamp-1">{lesson.subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {isCompleted && (
              <div className="flex gap-0.5">
                {[1, 2, 3].map((i) => (
                  <FontAwesomeIcon
                    key={i}
                    icon={UI.star}
                    className={`text-sm ${i <= lesson.stars ? 'text-amber-400' : 'text-white/15'}`}
                  />
                ))}
              </div>
            )}
            {isInProgress && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                En cours
              </span>
            )}
            {lesson.xpEarned > 0 && (
              <span className="text-[10px] text-cyan-300 flex items-center gap-1">
                <FontAwesomeIcon icon={UI.bolt} /> {lesson.xpEarned} XP
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
