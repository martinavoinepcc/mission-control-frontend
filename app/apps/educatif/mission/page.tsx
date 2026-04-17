'use client';

// QuestRunner — page d'exécution d'une mission.
// Compose : Blockly workspace + canvas du monde + HUD + système d'indices.
// Query params : ?id=<lessonId>&module=<moduleSlug>

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  getEduLesson,
  postEduProgress,
  clearToken,
  type EduLessonDetail,
} from '@/lib/api';
import { UI } from '@/lib/icons';
import {
  registerBlocks,
  buildToolboxXml,
  compileWorkspaceToSteps,
  type Step,
  type CompileResult,
} from '@/lib/educatif/blockly-config';
import {
  createInitialState,
  applyStep,
  renderWorld,
  type WorldState,
} from '@/lib/educatif/world';

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <MissionInner />
    </Suspense>
  );
}

function Loader() {
  return (
    <main className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 cosmic-grid" />
      <FontAwesomeIcon icon={UI.spinner} className="text-neon-cyan text-3xl animate-spin" />
    </main>
  );
}

function MissionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const lessonId = Number(params.get('id'));
  const moduleSlug = params.get('module') || 'code-cadet';

  const [lessonData, setLessonData] = useState<EduLessonDetail | null>(null);
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [hintLevel, setHintLevel] = useState(0); // 0 = pas d'indice, 1-4 = niveau
  const [showHint, setShowHint] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>('idle');
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [blocksUsed, setBlocksUsed] = useState(0);
  const [earnedStars, setEarnedStars] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blocklyContainerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<any>(null);
  const blocklyRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  // ============ LOAD LESSON ============
  useEffect(() => {
    if (!lessonId) {
      router.push('/apps/educatif/');
      return;
    }
    (async () => {
      try {
        const d = await getEduLesson(lessonId);
        setLessonData(d);
        setWorldState(createInitialState(d.lesson.data.world));
        // Log start
        postEduProgress(d.lesson.id, 'start').catch(() => {});
      } catch (err: any) {
        if (err.message.includes('Session') || err.message.includes('Authentification')) {
          clearToken();
          router.push('/');
          return;
        }
        setResultMsg(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId, router]);

  // ============ INIT BLOCKLY ============
  useEffect(() => {
    if (!lessonData || !blocklyContainerRef.current) return;
    let cancelled = false;
    (async () => {
      const Blockly = await import('blockly');
      if (cancelled) return;
      blocklyRef.current = Blockly;
      registerBlocks(Blockly);

      const toolboxXml = buildToolboxXml(lessonData.lesson.data.toolbox.categories);
      try {
        const ws = Blockly.inject(blocklyContainerRef.current!, {
          toolbox: toolboxXml,
          renderer: 'zelos',
          grid: { spacing: 20, length: 3, colour: '#2a2a3e', snap: true },
          trashcan: true,
          scrollbars: true,
          sounds: false,
          theme: (Blockly as any).Themes?.Classic || undefined,
          zoom: {
            controls: true,
            wheel: true,
            startScale: 0.95,
            maxScale: 1.6,
            minScale: 0.5,
            scaleSpeed: 1.15,
          },
        });
        workspaceRef.current = ws;

        // Restore saved code or starter
        const saved = lessonData.progress?.savedCode;
        const starter = lessonData.lesson.data.starter?.xml;
        const xmlStr = saved || starter;
        if (xmlStr) {
          try {
            const dom = (Blockly as any).utils.xml.textToDom(xmlStr);
            (Blockly as any).Xml.domToWorkspace(dom, ws);
          } catch (e) {
            /* ignore */
          }
        }

        // Track block count
        const updateCount = () => {
          setBlocksUsed(ws.getAllBlocks(false).length);
        };
        ws.addChangeListener(updateCount);
        updateCount();
      } catch (e) {
        console.error('Blockly init error', e);
      }
    })();
    return () => {
      cancelled = true;
      if (workspaceRef.current) {
        try { workspaceRef.current.dispose(); } catch {}
        workspaceRef.current = null;
      }
    };
  }, [lessonData]);

  // ============ RENDER WORLD (animation boucle) ============
  useEffect(() => {
    if (!worldState || !canvasRef.current) return;
    renderWorld({ canvas: canvasRef.current, state: worldState, tileSize: 56 });
    // Re-render chaque 500ms pour animer le goal pulsant
    const loop = () => {
      if (canvasRef.current && worldState) {
        renderWorld({ canvas: canvasRef.current, state: worldState, tileSize: 56 });
      }
      rafRef.current = window.setTimeout(loop, 500) as unknown as number;
    };
    rafRef.current = window.setTimeout(loop, 500) as unknown as number;
    return () => { if (rafRef.current) window.clearTimeout(rafRef.current); };
  }, [worldState]);

  // ============ PLAY ============
  const handlePlay = useCallback(async () => {
    if (!workspaceRef.current || !blocklyRef.current || !lessonData) return;
    if (running) return;
    setRunning(true);
    setStatus('idle');
    setResultMsg(null);

    const compile: CompileResult = compileWorkspaceToSteps(
      blocklyRef.current,
      workspaceRef.current,
    );

    // Save code
    try {
      const xmlDom = (blocklyRef.current as any).Xml.workspaceToDom(workspaceRef.current);
      const xmlStr = (blocklyRef.current as any).Xml.domToText(xmlDom);
      postEduProgress(lessonData.lesson.id, 'save_code', { code: xmlStr }).catch(() => {});
    } catch {}

    if (compile.errors.length) {
      setRunning(false);
      setStatus('fail');
      setResultMsg(compile.errors[0]);
      return;
    }

    // Log attempt
    postEduProgress(lessonData.lesson.id, 'attempt').catch(() => {});

    // Reset world + animer étape par étape
    let state = createInitialState(lessonData.lesson.data.world);
    setWorldState(state);
    await sleep(200);

    for (const step of compile.steps) {
      state = applyStep(state, step);
      setWorldState(state);
      await sleep(speedForStep(step));
      if (state.outOfBounds || state.drowned) break;
    }

    // Évaluation succès
    const success = evaluateSuccess(state, lessonData.lesson.data, compile);
    if (success.ok) {
      // Calcul étoiles
      const stars = computeStars(compile, lessonData.lesson.data);
      const xp = Math.round((lessonData.lesson.data.xpMax || 20) * (stars / 3));
      setStatus('success');
      setEarnedStars(stars);
      setEarnedXp(xp);
      setResultMsg(lessonData.lesson.data.rexLines.onSuccess);
      try {
        await postEduProgress(lessonData.lesson.id, 'complete', { stars, xp });
      } catch {}
    } else {
      setStatus('fail');
      setResultMsg(success.message || lessonData.lesson.data.rexLines.onError);
    }
    setRunning(false);
  }, [lessonData, running]);

  // ============ RESET ============
  const handleReset = useCallback(() => {
    if (running) return;
    if (!lessonData) return;
    setWorldState(createInitialState(lessonData.lesson.data.world));
    setStatus('idle');
    setResultMsg(null);
  }, [lessonData, running]);

  // ============ HINT ============
  const handleHint = useCallback(async () => {
    if (!lessonData) return;
    const next = Math.min(hintLevel + 1, 4);
    setHintLevel(next);
    setShowHint(true);
    try {
      await postEduProgress(lessonData.lesson.id, 'hint');
    } catch {}
  }, [hintLevel, lessonData]);

  if (loading) return <Loader />;
  if (!lessonData || !worldState) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white/60">
        Mission introuvable.
      </main>
    );
  }

  const color = lessonData.module.coverColor || '#4ADE80';

  return (
    <main className="relative min-h-screen flex flex-col bg-[#0a0a14]">
      {/* Header compact */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-white/10 bg-black/40 backdrop-blur z-20">
        <button
          onClick={() => router.push(`/apps/educatif/module/?slug=${moduleSlug}`)}
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm"
        >
          <FontAwesomeIcon icon={UI.back} />
          <span className="hidden sm:inline">Carte</span>
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-right truncate">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              {lessonData.lesson.kind === 'BOSS' ? 'BOSS' : `Mission ${lessonData.lesson.order}`}
            </p>
            <h1 className="font-display text-sm sm:text-base font-bold truncate">
              {lessonData.lesson.title}
            </h1>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}30`, border: `1px solid ${color}55` }}
          >
            <FontAwesomeIcon
              icon={lessonData.lesson.kind === 'BOSS' ? UI.crown : UI.cube}
              style={{ color }}
            />
          </div>
        </div>
      </header>

      {/* Main grid : game (gauche) + blockly (droite) sur desktop */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Panneau jeu */}
        <section className="lg:w-[45%] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col bg-black/30">
          {/* HUD top */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <FontAwesomeIcon icon={UI.run} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/40">Commandant Rex</p>
                <p className="text-xs text-white/80 font-semibold">{worldState.rex.dir === 'east' ? '→ Est' : worldState.rex.dir === 'west' ? '← Ouest' : worldState.rex.dir === 'north' ? '↑ Nord' : '↓ Sud'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-white/60">
                <FontAwesomeIcon icon={UI.cube} className="text-neon-cyan" /> {blocksUsed}
              </span>
              {lessonData.lesson.data.success.maxBlocks && (
                <span className="text-white/40 text-[10px]">/ max {lessonData.lesson.data.success.maxBlocks}</span>
              )}
            </div>
          </div>

          {/* Canvas zone */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <canvas
              ref={canvasRef}
              className="rounded-xl shadow-2xl border border-white/10 max-w-full"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* Briefing permanent */}
          <div className="px-4 py-3 border-t border-white/5 bg-black/40">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={UI.run} className="text-emerald-400 text-xs" />
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                {status === 'success'
                  ? lessonData.lesson.data.rexLines.onSuccess
                  : status === 'fail'
                    ? lessonData.lesson.data.rexLines.onError
                    : lessonData.lesson.data.rexLines.intro}
              </p>
            </div>
          </div>
        </section>

        {/* Panneau Blockly */}
        <section className="flex-1 flex flex-col min-h-[420px] lg:min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-neon-violet/20 border border-neon-violet/40 flex items-center justify-center">
                <FontAwesomeIcon icon={UI.code} className="text-neon-violet text-xs" />
              </div>
              <span className="text-xs font-semibold text-white/80">Ton programme</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <button
                onClick={handleHint}
                disabled={running || hintLevel >= 4}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs transition disabled:opacity-40 touch-manipulation"
              >
                <FontAwesomeIcon icon={UI.hint} />
                <span className="hidden sm:inline">Indice {hintLevel > 0 ? `(${hintLevel}/4)` : ''}</span>
                <span className="sm:hidden">{hintLevel > 0 ? `${hintLevel}/4` : 'Aide'}</span>
              </button>
              <button
                onClick={handleReset}
                disabled={running}
                aria-label="Reset"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 text-xs transition disabled:opacity-40 touch-manipulation"
              >
                <FontAwesomeIcon icon={UI.reset} />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={handlePlay}
                disabled={running}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition disabled:opacity-40 shadow-lg shadow-emerald-500/30 touch-manipulation"
              >
                <FontAwesomeIcon icon={running ? UI.spinner : UI.play} className={running ? 'animate-spin' : ''} />
                {running ? 'Exéc...' : 'Jouer'}
              </button>
            </div>
          </div>
          <div ref={blocklyContainerRef} className="flex-1 bg-[#1a1a2e]" style={{ minHeight: 400 }} />
        </section>
      </div>

      {/* Modals */}
      {showBriefing && (
        <BriefingModal
          briefing={lessonData.lesson.data.briefing}
          rexLine={lessonData.lesson.data.rexLines.intro}
          avatarKey={lessonData.module.avatarKey}
          onClose={() => setShowBriefing(false)}
        />
      )}
      {showHint && (
        <HintModal
          hints={lessonData.lesson.data.hints}
          level={hintLevel}
          onClose={() => setShowHint(false)}
          onMore={() => {
            if (hintLevel < 4) setHintLevel(hintLevel + 1);
          }}
        />
      )}
      {status === 'success' && (
        <SuccessModal
          stars={earnedStars}
          xp={earnedXp}
          message={resultMsg || ''}
          onContinue={() => router.push(`/apps/educatif/module/?slug=${moduleSlug}`)}
          onRetry={() => {
            setStatus('idle');
            handleReset();
          }}
        />
      )}
      {status === 'fail' && resultMsg && (
        <div className="fixed bottom-6 right-6 max-w-sm glass rounded-xl p-4 border border-amber-500/40 bg-amber-500/10 shadow-2xl z-50 animate-fade-up">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={UI.heart} className="text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white font-semibold mb-1">Presque !</p>
              <p className="text-xs text-white/80">{resultMsg}</p>
            </div>
            <button onClick={() => { setStatus('idle'); setResultMsg(null); }} className="text-white/50 hover:text-white">
              <FontAwesomeIcon icon={UI.close} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ============ HELPERS ============
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function speedForStep(step: Step): number {
  if (step.op === 'say') return 900;
  return 300;
}

function evaluateSuccess(state: WorldState, data: any, compile: CompileResult): { ok: boolean; message?: string } {
  const s = data.success;
  if (state.outOfBounds) return { ok: false, message: 'Rex est sorti de la zone. Compte les cases!' };
  if (state.drowned) return { ok: false, message: 'Rex est tombé à l\'eau. Essaie avec une boucle!' };
  if (s.type === 'reachGoal') {
    if (!state.reachedGoal) return { ok: false, message: 'Rex n\'a pas atteint l\'objectif. Réessaie.' };
    if (s.rules?.mustUseBlock && !compile.blocksUsed.includes(s.rules.mustUseBlock)) {
      return { ok: false, message: 'Tu dois utiliser le bloc « Répéter » pour passer.' };
    }
    return { ok: true };
  }
  if (s.type === 'customCondition') {
    const rules = s.rules || {};
    if (rules.containsBlock) {
      for (const b of rules.containsBlock) {
        if (!compile.blocksUsed.includes(b)) return { ok: false, message: `Il manque le bloc « ${prettyBlockName(b)} ».` };
      }
    }
    return { ok: true };
  }
  if (s.type === 'collectAll') {
    const total = data.world.items?.length || 0;
    if (state.collected.size < total) return { ok: false, message: 'Il reste des items à collecter.' };
    return { ok: true };
  }
  return { ok: true };
}

function prettyBlockName(t: string): string {
  return {
    event_start: 'Au début',
    rex_say: 'Dire',
    rex_move_forward: 'Avancer',
    rex_turn_right: 'Tourner à droite',
    rex_turn_left: 'Tourner à gauche',
    rex_repeat: 'Répéter',
  }[t] || t;
}

function computeStars(compile: CompileResult, data: any): number {
  const tiers = data.stars || {};
  const blockCount = compile.blockCount;
  if (tiers.gold) {
    const okBlocks = !tiers.gold.maxBlocks || blockCount <= tiers.gold.maxBlocks;
    const okUse = !tiers.gold.mustUse || tiers.gold.mustUse.every((t: string) => compile.blocksUsed.includes(t));
    if (okBlocks && okUse) return 3;
  }
  if (tiers.silver && (!tiers.silver.maxBlocks || blockCount <= tiers.silver.maxBlocks)) return 2;
  return 1;
}

// ============ COMPOSANTS MODALS ============
function BriefingModal({
  briefing,
  rexLine,
  avatarKey,
  onClose,
}: {
  briefing: { text: string; avatarClip?: string };
  rexLine: string;
  avatarKey: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-up">
      <div className="glass rounded-2xl max-w-lg w-full p-6 border border-emerald-500/30">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon icon={UI.run} className="text-white text-xl" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Commandant Rex</p>
            <p className="font-display text-base font-bold">Briefing mission</p>
          </div>
        </div>
        <p className="text-sm text-white/90 leading-relaxed mb-5">{briefing.text}</p>
        <button
          onClick={onClose}
          className="w-full px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition shadow-lg shadow-emerald-500/40"
        >
          Allons-y, cadet !
        </button>
      </div>
    </div>
  );
}

function HintModal({
  hints,
  level,
  onClose,
  onMore,
}: {
  hints: string[];
  level: number;
  onClose: () => void;
  onMore: () => void;
}) {
  const labels = ['', 'Petit indice', 'Indice +', 'Aide guidée', 'Solution'];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="glass rounded-2xl max-w-md w-full p-6 border border-amber-400/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center">
              <FontAwesomeIcon icon={UI.hint} className="text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-300">Indice {level}/4</p>
              <p className="font-display text-sm font-bold">{labels[level]}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <FontAwesomeIcon icon={UI.close} />
          </button>
        </div>
        <p className="text-sm text-white/90 leading-relaxed mb-4">{hints[level - 1]}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 text-sm transition"
          >
            Je tente !
          </button>
          {level < 4 && (
            <button
              onClick={onMore}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold transition"
            >
              Plus d'aide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessModal({
  stars,
  xp,
  message,
  onContinue,
  onRetry,
}: {
  stars: number;
  xp: number;
  message: string;
  onContinue: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-up">
      <div className="glass rounded-2xl max-w-md w-full p-8 border border-emerald-500/40 text-center relative overflow-hidden">
        {/* Confettis simples */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-amber-400"
              style={{
                left: `${(i * 13 + 10) % 100}%`,
                top: `${(i * 17 + 5) % 100}%`,
                background: ['#FBBF24', '#06B6D4', '#A855F7', '#10B981'][i % 4],
                animation: `pulse-slow ${1 + (i % 3)}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
        <div className="relative">
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map((i) => (
              <FontAwesomeIcon
                key={i}
                icon={UI.star}
                className={`text-4xl ${i <= stars ? 'text-amber-400 drop-shadow-lg' : 'text-white/15'}`}
                style={{ animation: i <= stars ? `fade-up 0.5s ease-out ${i * 0.15}s both` : undefined }}
              />
            ))}
          </div>
          <h2 className="font-display text-3xl font-bold mb-2">
            <span className="grad-text">Mission réussie !</span>
          </h2>
          <p className="text-white/80 text-sm mb-4 leading-relaxed">{message}</p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="px-4 py-2 rounded-xl bg-cyan-400/15 border border-cyan-400/30">
              <p className="text-[10px] uppercase tracking-wider text-cyan-300">XP gagné</p>
              <p className="font-display text-xl font-bold text-cyan-300">+{xp}</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-amber-400/15 border border-amber-400/30">
              <p className="text-[10px] uppercase tracking-wider text-amber-300">Étoiles</p>
              <p className="font-display text-xl font-bold text-amber-300">{stars}/3</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 text-sm transition"
            >
              <FontAwesomeIcon icon={UI.reset} className="mr-2" />
              Rejouer
            </button>
            <button
              onClick={onContinue}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition shadow-lg shadow-emerald-500/40"
            >
              Continuer <FontAwesomeIcon icon={UI.arrowRight} className="ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
