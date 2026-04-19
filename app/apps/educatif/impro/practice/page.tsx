'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ImprovAPI, type ImprovCard, type ImprovDifficulty } from '@/lib/api';
import { UI } from '@/lib/icons';
import { playBell, playBuzzer, playTick } from '@/lib/sounds';

type Phase = 'FORM' | 'READY' | 'CAUCUS' | 'PLAYING' | 'DONE';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(Math.max(0, s)).padStart(2, '0')}`;
}

export default function ImproPracticePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('FORM');
  const [teams, setTeams] = useState<1 | 2>(2);
  const [playersPerTeam, setPlayersPerTeam] = useState(3);
  const [difficulty, setDifficulty] = useState<ImprovDifficulty>('MEDIUM');
  const [includeConstraints, setIncludeConstraints] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [card, setCard] = useState<ImprovCard | null>(null);
  const [caucusLeft, setCaucusLeft] = useState(0);
  const [playLeft, setPlayLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const tickRef = useRef<number | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const { card } = await ImprovAPI.generate({
        mode: 'PRACTICE',
        generation: 'AUTO',
        teams,
        playersPerTeam,
        difficulty,
        forceNoConstraints: !includeConstraints,
      });
      setCard(card);
      setCaucusLeft(card.caucusSec);
      setPlayLeft(card.durationSec);
      setRulesOpen(false);
      setPhase('READY');
    } catch (e: any) {
      setErr(e.message || 'Erreur de génération.');
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setPaused(false);
    if (card && card.caucusSec > 0) {
      setPhase('CAUCUS');
      playTick();
    } else {
      setPhase('PLAYING');
      playBell();
    }
  }

  function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase('FORM');
    setCard(null);
    setCaucusLeft(0);
    setPlayLeft(0);
    setPaused(false);
  }

  function replay() {
    if (!card) return;
    setCaucusLeft(card.caucusSec);
    setPlayLeft(card.durationSec);
    setPhase('READY');
  }

  // Ticking countdown
  useEffect(() => {
    if (phase !== 'CAUCUS' && phase !== 'PLAYING') return;
    if (paused) return;
    tickRef.current = window.setInterval(() => {
      if (phase === 'CAUCUS') {
        setCaucusLeft((x) => {
          if (x <= 1) {
            setPhase('PLAYING');
            playBell();
            return 0;
          }
          if (x <= 3) playTick();
          return x - 1;
        });
      } else if (phase === 'PLAYING') {
        setPlayLeft((x) => {
          if (x <= 1) {
            setPhase('DONE');
            playBuzzer();
            return 0;
          }
          if (x <= 5) playTick();
          return x - 1;
        });
      }
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [phase, paused]);

  function addTime(sec: number) {
    if (phase === 'CAUCUS') setCaucusLeft((x) => x + sec);
    else if (phase === 'PLAYING') setPlayLeft((x) => x + sec);
  }

  const difficultyLabel: Record<ImprovDifficulty, string> = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' };

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid opacity-60" />
      <div className="blob bg-rose-500 w-[420px] h-[420px] -top-48 -left-40 animate-pulse-slow opacity-[0.10]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => phase === 'FORM' ? router.push('/apps/educatif/impro') : stop()} className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <FontAwesomeIcon icon={UI.back} /> {phase === 'FORM' ? 'Impro' : 'Quitter'}
          </button>
          <div className="flex items-center gap-2 text-rose-300 text-sm">
            <FontAwesomeIcon icon={UI.dice} />
            <span className="font-display">Pratique</span>
          </div>
        </header>

        {phase === 'FORM' && (
          <section className="animate-fade-up">
            <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Nouvelle impro</h1>
            <p className="text-white/50 mb-6">Mode AUTO : on te génère tout. Tu valides, tu joues.</p>

            <div className="glass rounded-2xl p-5 sm:p-7 space-y-6">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Équipes</label>
                <div className="flex gap-2">
                  {([1, 2] as const).map((n) => (
                    <button key={n} onClick={() => setTeams(n)} className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition ${teams === n ? 'border-rose-400 bg-rose-400/20 text-rose-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
                      {n} équipe{n > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Joueurs par équipe</label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} onClick={() => setPlayersPerTeam(n)} className={`px-3 py-3 rounded-xl border text-sm font-medium transition ${playersPerTeam === n ? 'border-rose-400 bg-rose-400/20 text-rose-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Difficulté</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-3 rounded-xl border text-sm font-medium transition ${difficulty === d ? 'border-rose-400 bg-rose-400/20 text-rose-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
                      {difficultyLabel[d]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer hover:bg-white/[0.07] transition">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white/90">Inclure des contraintes</div>
                  <div className="text-xs text-white/50 mt-0.5">Ex. sans se toucher, en chantant, yeux fermés…</div>
                </div>
                <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${includeConstraints ? 'bg-rose-500' : 'bg-white/20'}`}>
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${includeConstraints ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
                <input type="checkbox" className="sr-only" checked={includeConstraints} onChange={(e) => setIncludeConstraints(e.target.checked)} />
              </label>

              {err && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{err}</div>}

              <button onClick={generate} disabled={loading} className="btn-primary w-full">
                <span className="flex items-center justify-center gap-2">
                  {loading ? <FontAwesomeIcon icon={UI.spinner} spin /> : <FontAwesomeIcon icon={UI.bolt} />}
                  Générer la carte
                </span>
              </button>
            </div>
          </section>
        )}

        {phase !== 'FORM' && card && (
          <section className="animate-fade-up">
            {/* Carte */}
            <div className="glass rounded-3xl p-5 sm:p-8 mb-6 border border-rose-400/30">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300/80 mb-1 font-mono">
                    {card.nature === 'MIXTE' ? 'Mixte' : 'Comparée'} · {card.category.difficulty === 'EASY' ? 'Facile' : card.category.difficulty === 'MEDIUM' ? 'Moyenne' : 'Difficile'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display text-2xl sm:text-4xl font-bold">{card.category.name}</h1>
                    {(card.category.rulesDescription || card.category.shortDescription) && (
                      <button
                        onClick={() => setRulesOpen((v) => !v)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-rose-400/40 text-rose-300/90 hover:bg-rose-400/10 transition flex-shrink-0 text-sm font-bold"
                        title="Afficher les règles"
                        aria-label="Afficher les règles"
                      >
                        ?
                      </button>
                    )}
                  </div>
                  {card.category.shortDescription && !rulesOpen && (
                    <p className="text-white/60 text-sm mt-1">{card.category.shortDescription}</p>
                  )}
                  {rulesOpen && (
                    <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-sm text-white/80 leading-relaxed animate-fade-up">
                      {card.category.rulesDescription || card.category.shortDescription}
                    </div>
                  )}
                </div>
              </div>

              {card.horoscope && (
                <div className="mb-4 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 p-4 animate-fade-up">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80 mb-1 font-mono flex items-center gap-2">
                    <span>✨</span> Horoscope du jour · <strong className="text-amber-200">{card.horoscope.sign}</strong>
                    {card.horoscope.source === 'fallback' && <span className="text-white/30 text-[9px]">(banque)</span>}
                  </p>
                  <p className="text-white/90 text-sm leading-relaxed italic mt-1.5">« {card.horoscope.text} »</p>
                </div>
              )}
              {card.theme && (
                <div className="border-t border-white/10 pt-3 mt-3">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Thème</p>
                  <p className="font-display text-lg sm:text-xl text-white">{card.theme.name}</p>
                </div>
              )}
              {card.constraints.length > 0 && (
                <div className="border-t border-white/10 pt-3 mt-3">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Contrainte{card.constraints.length > 1 ? 's' : ''}</p>
                  <div className="space-y-1.5">
                    {card.constraints.map((k) => (
                      <div key={k.slug} className="flex items-start gap-2">
                        <FontAwesomeIcon icon={UI.bolt} className="text-amber-400 text-[10px] mt-1.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-white/90 text-sm">{k.name}</span>
                          {k.description && <span className="text-white/50 text-xs ml-1.5">— {k.description}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-white/10 pt-3 mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-white/60">
                <span><FontAwesomeIcon icon={UI.user} className="mr-1.5 text-white/40" /> {card.players.total} joueur{card.players.total > 1 ? 's' : ''}</span>
                <span><FontAwesomeIcon icon={UI.clock} className="mr-1.5 text-white/40" /> {Math.round(card.durationSec / 60)} min</span>
                {card.caucusSec > 0 && <span><FontAwesomeIcon icon={UI.bell} className="mr-1.5 text-white/40" /> caucus {card.caucusSec}s</span>}
              </div>
            </div>

            {/* Timer block */}
            {phase === 'READY' && (
              <div className="glass rounded-3xl p-6 sm:p-8 text-center">
                <p className="text-white/60 text-sm mb-4">Prêts ?</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={start} className="btn-primary">
                    <span className="flex items-center gap-2"><FontAwesomeIcon icon={UI.play} /> Démarrer</span>
                  </button>
                  <button onClick={replay} className="text-sm px-4 py-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition">
                    <FontAwesomeIcon icon={UI.reset} className="mr-2" /> Nouveau timer
                  </button>
                </div>
              </div>
            )}

            {(phase === 'CAUCUS' || phase === 'PLAYING') && (
              <div className={`rounded-3xl p-6 sm:p-10 text-center border transition ${phase === 'CAUCUS' ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-400/40' : 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border-emerald-400/40'}`}>
                <p className={`text-xs tracking-[0.25em] uppercase font-mono mb-3 ${phase === 'CAUCUS' ? 'text-amber-300/80' : 'text-emerald-300/80'}`}>
                  {phase === 'CAUCUS' ? 'Caucus — discute, stratégie' : 'Jouez !'}
                </p>
                <div className={`font-display font-black text-7xl sm:text-[9rem] leading-none ${phase === 'CAUCUS' ? 'text-amber-200' : 'text-emerald-200'} ${paused ? 'opacity-50' : ''}`}>
                  {fmt(phase === 'CAUCUS' ? caucusLeft : playLeft)}
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  <button onClick={() => setPaused((p) => !p)} className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition">
                    <FontAwesomeIcon icon={paused ? UI.play : UI.pause} className="mr-2" />
                    {paused ? 'Reprendre' : 'Pause'}
                  </button>
                  <button onClick={() => addTime(30)} className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition">
                    +30 s
                  </button>
                  <button onClick={stop} className="text-sm px-4 py-2 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 transition">
                    <FontAwesomeIcon icon={UI.stopSq} className="mr-2" /> Arrêter
                  </button>
                </div>
              </div>
            )}

            {phase === 'DONE' && (
              <div className="rounded-3xl p-6 sm:p-10 text-center bg-gradient-to-br from-rose-500/15 to-fuchsia-500/15 border border-rose-400/40">
                <p className="text-xs tracking-[0.25em] uppercase font-mono text-rose-300/80 mb-3">Scène terminée</p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6">Bravo 👏</h2>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={replay} className="btn-primary">
                    <span className="flex items-center gap-2"><FontAwesomeIcon icon={UI.reset} /> Rejouer la carte</span>
                  </button>
                  <button onClick={() => { stop(); generate(); }} className="text-sm px-4 py-3 rounded-xl border border-rose-400/40 text-rose-200 hover:bg-rose-400/10 transition">
                    <FontAwesomeIcon icon={UI.dice} className="mr-2" /> Nouvelle carte
                  </button>
                  <button onClick={stop} className="text-sm px-4 py-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition">
                    Retour
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
