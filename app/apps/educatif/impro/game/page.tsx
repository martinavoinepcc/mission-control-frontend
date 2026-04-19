'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ImprovAPI, type ImprovCard, type ImprovDifficulty } from '@/lib/api';
import { UI } from '@/lib/icons';
import { playBell, playBuzzer, playTick, playCheer } from '@/lib/sounds';

type Phase = 'SETUP' | 'ROUND_READY' | 'CAUCUS' | 'PLAYING' | 'VOTE' | 'FINAL';
type Vote = 'A' | 'B' | 'TIE';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(Math.max(0, s)).padStart(2, '0')}`;
}

type RoundEntry = { card: ImprovCard; vote: Vote };

export default function ImproGamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('SETUP');
  const [teamA, setTeamA] = useState('Équipe A');
  const [teamB, setTeamB] = useState('Équipe B');
  const [playersPerTeam, setPlayersPerTeam] = useState(3);
  const [totalRounds, setTotalRounds] = useState(7);
  const [difficulty, setDifficulty] = useState<ImprovDifficulty>('MEDIUM');
  const [includeConstraints, setIncludeConstraints] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [roundIndex, setRoundIndex] = useState(0); // 0-based
  const [history, setHistory] = useState<RoundEntry[]>([]);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const [card, setCard] = useState<ImprovCard | null>(null);
  const [caucusLeft, setCaucusLeft] = useState(0);
  const [playLeft, setPlayLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);

  async function startMatch() {
    setLoading(true); setErr(null);
    try {
      const { card } = await ImprovAPI.generate({
        mode: 'GAME', generation: 'AUTO', teams: 2, playersPerTeam, difficulty,
        forceNoConstraints: !includeConstraints,
      });
      setCard(card);
      setCaucusLeft(card.caucusSec);
      setPlayLeft(card.durationSec);
      setRoundIndex(0);
      setHistory([]); setScoreA(0); setScoreB(0);
      setRulesOpen(false);
      setPhase('ROUND_READY');
    } catch (e: any) { setErr(e.message || 'Erreur.'); }
    finally { setLoading(false); }
  }

  async function nextRound(lastVote: Vote) {
    if (card) {
      const entry: RoundEntry = { card, vote: lastVote };
      setHistory((h) => [...h, entry]);
      if (lastVote === 'A') setScoreA((s) => s + 1);
      else if (lastVote === 'B') setScoreB((s) => s + 1);
    }
    const nextIdx = roundIndex + 1;
    if (nextIdx >= totalRounds) {
      setPhase('FINAL');
      playCheer();
      return;
    }
    setLoading(true); setErr(null);
    try {
      const { card } = await ImprovAPI.generate({
        mode: 'GAME', generation: 'AUTO', teams: 2, playersPerTeam, difficulty,
        forceNoConstraints: !includeConstraints,
      });
      setCard(card);
      setCaucusLeft(card.caucusSec);
      setPlayLeft(card.durationSec);
      setRoundIndex(nextIdx);
      setRulesOpen(false);
      setPhase('ROUND_READY');
    } catch (e: any) { setErr(e.message || 'Erreur.'); }
    finally { setLoading(false); }
  }

  function startRound() {
    setPaused(false);
    if (card && card.caucusSec > 0) {
      setPhase('CAUCUS'); playTick();
    } else {
      setPhase('PLAYING'); playBell();
    }
  }

  function resetMatch() {
    if (tickRef.current) clearInterval(tickRef.current);
    setPhase('SETUP');
    setCard(null); setCaucusLeft(0); setPlayLeft(0);
    setRoundIndex(0); setHistory([]); setScoreA(0); setScoreB(0);
  }

  useEffect(() => {
    if (phase !== 'CAUCUS' && phase !== 'PLAYING') return;
    if (paused) return;
    tickRef.current = window.setInterval(() => {
      if (phase === 'CAUCUS') {
        setCaucusLeft((x) => {
          if (x <= 1) { setPhase('PLAYING'); playBell(); return 0; }
          if (x <= 3) playTick();
          return x - 1;
        });
      } else if (phase === 'PLAYING') {
        setPlayLeft((x) => {
          if (x <= 1) { setPhase('VOTE'); playBuzzer(); return 0; }
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
      <div className="blob bg-blue-500 w-[420px] h-[420px] -top-48 -left-40 animate-pulse-slow opacity-[0.10]" />
      <div className="blob bg-rose-500 w-[340px] h-[340px] -bottom-32 -right-32 animate-pulse-slow opacity-[0.10]" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => phase === 'SETUP' ? router.push('/apps/educatif/impro') : resetMatch()} className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <FontAwesomeIcon icon={UI.back} /> {phase === 'SETUP' ? 'Impro' : 'Quitter'}
          </button>
          <div className="flex items-center gap-2 text-blue-300 text-sm">
            <FontAwesomeIcon icon={UI.trophy} />
            <span className="font-display">Match</span>
          </div>
        </header>

        {phase === 'SETUP' && (
          <section className="animate-fade-up">
            <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Nouveau match</h1>
            <p className="text-white/50 mb-6">Config rapide, puis on y va.</p>
            <div className="glass rounded-2xl p-5 sm:p-7 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-200/80 mb-2 uppercase tracking-wider">Équipe A (bleu)</label>
                  <input value={teamA} onChange={(e) => setTeamA(e.target.value)} className="input" placeholder="Équipe A" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rose-200/80 mb-2 uppercase tracking-wider">Équipe B (rouge)</label>
                  <input value={teamB} onChange={(e) => setTeamB(e.target.value)} className="input" placeholder="Équipe B" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Joueurs par équipe</label>
                <div className="grid grid-cols-6 gap-2">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button key={n} onClick={() => setPlayersPerTeam(n)} className={`px-3 py-3 rounded-xl border text-sm font-medium transition ${playersPerTeam === n ? 'border-blue-400 bg-blue-400/20 text-blue-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Nombre de rounds</label>
                <div className="grid grid-cols-5 gap-2">
                  {[3, 5, 7, 9, 11].map((n) => (
                    <button key={n} onClick={() => setTotalRounds(n)} className={`px-3 py-3 rounded-xl border text-sm font-medium transition ${totalRounds === n ? 'border-blue-400 bg-blue-400/20 text-blue-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Difficulté</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-3 rounded-xl border text-sm font-medium transition ${difficulty === d ? 'border-blue-400 bg-blue-400/20 text-blue-100' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
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
                <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${includeConstraints ? 'bg-blue-500' : 'bg-white/20'}`}>
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${includeConstraints ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
                <input type="checkbox" className="sr-only" checked={includeConstraints} onChange={(e) => setIncludeConstraints(e.target.checked)} />
              </label>

              {err && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{err}</div>}
              <button onClick={startMatch} disabled={loading} className="btn-primary w-full">
                <span className="flex items-center justify-center gap-2">
                  {loading ? <FontAwesomeIcon icon={UI.spinner} spin /> : <FontAwesomeIcon icon={UI.play} />}
                  Démarrer le match
                </span>
              </button>
            </div>
          </section>
        )}

        {phase !== 'SETUP' && phase !== 'FINAL' && (
          <>
            {/* Scoreboard */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/30 text-center">
                <p className="text-[10px] uppercase tracking-[0.25em] text-blue-300/80 mb-1 truncate">{teamA}</p>
                <p className="font-display font-black text-4xl sm:text-5xl text-blue-100">{scoreA}</p>
              </div>
              <div className="rounded-2xl p-4 bg-white/5 border border-white/10 text-center flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">Round</p>
                <p className="font-display font-bold text-2xl sm:text-3xl">{roundIndex + 1} / {totalRounds}</p>
              </div>
              <div className="rounded-2xl p-4 bg-gradient-to-br from-rose-600/20 to-rose-800/10 border border-rose-500/30 text-center">
                <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300/80 mb-1 truncate">{teamB}</p>
                <p className="font-display font-black text-4xl sm:text-5xl text-rose-100">{scoreB}</p>
              </div>
            </div>

            {/* Card */}
            {card && (
              <div className="glass rounded-3xl p-5 sm:p-7 mb-5 border border-white/15">
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1 font-mono">
                    {card.nature === 'MIXTE' ? 'Mixte' : 'Comparée'} · {card.category.difficulty === 'EASY' ? 'Facile' : card.category.difficulty === 'MEDIUM' ? 'Moyenne' : 'Difficile'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-xl sm:text-3xl font-bold">{card.category.name}</h2>
                    {(card.category.rulesDescription || card.category.shortDescription) && (
                      <button
                        onClick={() => setRulesOpen((v) => !v)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-blue-400/40 text-blue-300/90 hover:bg-blue-400/10 transition flex-shrink-0 text-sm font-bold"
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
                    <div className="mt-3 rounded-xl border border-blue-400/30 bg-blue-400/5 p-3 text-sm text-white/80 leading-relaxed animate-fade-up">
                      {card.category.rulesDescription || card.category.shortDescription}
                    </div>
                  )}
                </div>

                {card.horoscope && (
                  <div className="mb-3 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 p-3 animate-fade-up">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80 mb-1 font-mono flex items-center gap-2">
                      <span>✨</span> Horoscope · <strong className="text-amber-200">{card.horoscope.sign}</strong>
                      {card.horoscope.source === 'fallback' && <span className="text-white/30 text-[9px]">(banque)</span>}
                    </p>
                    <p className="text-white/90 text-sm leading-relaxed italic">« {card.horoscope.text} »</p>
                  </div>
                )}
                {card.theme && (
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Thème</p>
                    <p className="font-display text-base sm:text-lg text-white">{card.theme.name}</p>
                  </div>
                )}
                {card.constraints.length > 0 && (
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Contrainte{card.constraints.length > 1 ? 's' : ''}</p>
                    <div className="space-y-1">
                      {card.constraints.map((k) => (
                        <div key={k.slug} className="text-sm"><span className="text-white/90 font-medium">{k.name}</span>{k.description && <span className="text-white/50"> — {k.description}</span>}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                  <span><FontAwesomeIcon icon={UI.clock} className="mr-1.5 text-white/40" /> {Math.round(card.durationSec / 60)} min</span>
                  {card.caucusSec > 0 && <span><FontAwesomeIcon icon={UI.bell} className="mr-1.5 text-white/40" /> caucus {card.caucusSec}s</span>}
                </div>
              </div>
            )}

            {/* Timer */}
            {phase === 'ROUND_READY' && (
              <div className="glass rounded-3xl p-6 sm:p-8 text-center">
                <p className="text-white/60 text-sm mb-4">Round {roundIndex + 1} prêt.</p>
                <button onClick={startRound} className="btn-primary">
                  <span className="flex items-center gap-2"><FontAwesomeIcon icon={UI.play} /> Démarrer le round</span>
                </button>
              </div>
            )}

            {(phase === 'CAUCUS' || phase === 'PLAYING') && (
              <div className={`rounded-3xl p-6 sm:p-10 text-center border transition ${phase === 'CAUCUS' ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-400/40' : 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border-emerald-400/40'}`}>
                <p className={`text-xs tracking-[0.25em] uppercase font-mono mb-3 ${phase === 'CAUCUS' ? 'text-amber-300/80' : 'text-emerald-300/80'}`}>
                  {phase === 'CAUCUS' ? 'Caucus' : 'Jouez !'}
                </p>
                <div className={`font-display font-black text-6xl sm:text-9xl leading-none ${phase === 'CAUCUS' ? 'text-amber-200' : 'text-emerald-200'} ${paused ? 'opacity-50' : ''}`}>
                  {fmt(phase === 'CAUCUS' ? caucusLeft : playLeft)}
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  <button onClick={() => setPaused((p) => !p)} className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition">
                    <FontAwesomeIcon icon={paused ? UI.play : UI.pause} className="mr-2" />
                    {paused ? 'Reprendre' : 'Pause'}
                  </button>
                  <button onClick={() => addTime(30)} className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition">+30 s</button>
                </div>
              </div>
            )}

            {phase === 'VOTE' && (
              <div className="rounded-3xl p-5 sm:p-8 bg-white/5 border border-white/10">
                <p className="text-center text-sm text-white/60 mb-5">Vote du public pour ce round :</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button onClick={() => nextRound('A')} disabled={loading} className="rounded-2xl p-5 bg-gradient-to-br from-blue-600/30 to-blue-800/20 border-2 border-blue-500/50 hover:border-blue-400 hover:scale-[1.02] transition-all text-center">
                    <p className="font-display font-bold text-lg text-blue-100">{teamA}</p>
                    <p className="text-xs uppercase tracking-wider text-blue-300/70 mt-1">+1 point</p>
                  </button>
                  <button onClick={() => nextRound('TIE')} disabled={loading} className="rounded-2xl p-5 bg-white/5 border-2 border-white/15 hover:border-white/30 hover:scale-[1.02] transition-all text-center">
                    <p className="font-display font-bold text-lg text-white/90">Égalité</p>
                    <p className="text-xs uppercase tracking-wider text-white/50 mt-1">aucun point</p>
                  </button>
                  <button onClick={() => nextRound('B')} disabled={loading} className="rounded-2xl p-5 bg-gradient-to-br from-rose-600/30 to-rose-800/20 border-2 border-rose-500/50 hover:border-rose-400 hover:scale-[1.02] transition-all text-center">
                    <p className="font-display font-bold text-lg text-rose-100">{teamB}</p>
                    <p className="text-xs uppercase tracking-wider text-rose-300/70 mt-1">+1 point</p>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'FINAL' && (
          <section className="animate-fade-up">
            <div className="rounded-3xl p-6 sm:p-10 text-center bg-gradient-to-br from-fuchsia-500/20 via-blue-500/15 to-rose-500/20 border border-white/15 mb-6">
              <p className="text-xs tracking-[0.25em] uppercase font-mono text-white/60 mb-3">Fin du match</p>
              <h2 className="font-display text-4xl sm:text-6xl font-black mb-4">
                {scoreA === scoreB
                  ? <span className="bg-gradient-to-r from-blue-300 to-rose-300 bg-clip-text text-transparent">Égalité 🤝</span>
                  : scoreA > scoreB
                    ? <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">{teamA} gagne 🏆</span>
                    : <span className="bg-gradient-to-r from-rose-300 to-fuchsia-300 bg-clip-text text-transparent">{teamB} gagne 🏆</span>}
              </h2>
              <div className="flex items-center justify-center gap-6 text-2xl font-display font-bold">
                <span className="text-blue-200">{scoreA}</span>
                <span className="text-white/40">—</span>
                <span className="text-rose-200">{scoreB}</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 sm:p-7 mb-6">
              <h3 className="font-display text-lg font-bold mb-4">Résumé des rounds</h3>
              <div className="space-y-2">
                {history.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="font-mono text-xs text-white/40 w-8">{idx + 1}.</span>
                    <span className="flex-1 min-w-0 truncate text-sm">
                      <span className="text-white/80">{r.card.category.name}</span>
                      {r.card.theme && <span className="text-white/40"> · {r.card.theme.name}</span>}
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${r.vote === 'A' ? 'text-blue-200 border-blue-500/40 bg-blue-500/10' : r.vote === 'B' ? 'text-rose-200 border-rose-500/40 bg-rose-500/10' : 'text-white/60 border-white/15 bg-white/5'}`}>
                      {r.vote === 'A' ? teamA : r.vote === 'B' ? teamB : 'Égalité'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={resetMatch} className="btn-primary">
                <span className="flex items-center gap-2"><FontAwesomeIcon icon={UI.play} /> Nouveau match</span>
              </button>
              <button onClick={() => router.push('/apps/educatif/impro')} className="text-sm px-4 py-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition">
                Retour Impro
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
