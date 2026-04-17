'use client';

// MCreator Academy — Mission #1 : Le Bloc Cookie
// Première mission du parcours qui prépare Jackson au camp Studio XP (été 2026).
// Outil cible : MCreator (visual mod creation) + Java basics.
// Cette mission lui apprend l'interface MCreator + le concept "Bloc + propriétés + procédure" en lui faisant créer un custom block.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const TEXTURES = ['🍪','💎','🔥','🌋','⚡','🌳','🪨','🌟','🍉','🐠','🍫','🌈','💧','🪐','🪙','🛡️'];
const COLORS: Record<string, string> = {
  '🍪':'#d4a056','💎':'#5dd1ff','🔥':'#ff6a3d','🌋':'#7c3a23','⚡':'#fde047','🌳':'#3f7d20','🪨':'#7c7c7c',
  '🌟':'#fbbf24','🍉':'#ec4899','🐠':'#06b6d4','🍫':'#5d3a1a','🌈':'#a855f7','💧':'#3b82f6','🪐':'#9333ea','🪙':'#facc15','🛡️':'#9ca3af',
};
const RX_LINES: Record<string, string> = {
  intro: "Salut cadet Jackson ! Bienvenue à MCreator Academy. On va construire ton tout premier bloc Minecraft ensemble. Choisis-lui un nom fun, une texture, ses propriétés, puis pèse sur ▶ Tester pour le voir en jeu !",
  name: "Bon nom ! Astuce de pro : ton bloc va apparaître dans ton inventaire avec ce nom exact.",
  texture: "Excellent ! Au camp tu vas dessiner ta texture en pixel art toi-même (16×16). Ici on va vite avec une palette d'emojis.",
  hardness: "La dureté décide combien de coups il faut pour casser ton bloc. La pierre = 1.5, le diamant = 3, l'obsidienne = 50 !",
  light: "Si tu mets la lumière à 15, ton bloc illumine la pièce comme une torche. Top dans une grotte sombre.",
  power: "BOOM. Ça c'est une PROCÉDURE — exactement ce que tu vas câbler au camp. 'QUAND X arrive, ALORS fais Y.' De la programmation pour vrai.",
  test: "Allez, pèse sur le gros bouton vert et regarde ton bloc prendre vie dans le monde Minecraft !",
  win: "MAGISTRAL. Tu viens de créer ton premier bloc Minecraft custom. Au camp Studio XP, tu vas en faire 50 et les assembler dans un mod complet.",
};
const TRIGGERS = [
  { value: 'rightclick', label: 'on clique droit dessus' },
  { value: 'break',      label: 'on le casse' },
  { value: 'walk',       label: 'on marche dessus' },
];
const ACTIONS = [
  { value: 'speed',   label: 'le joueur devient super rapide ⚡' },
  { value: 'cookies', label: 'il pleut des cookies du ciel 🍪' },
  { value: 'diamond', label: '3 diamants apparaissent 💎' },
  { value: 'fire',    label: 'le bloc s\u2019enflamme 🔥' },
];

export default function MCreatorMission1Page() {
  const router = useRouter();
  const [blockName, setBlockName] = useState('Cookie de Diamant');
  const [texture, setTexture] = useState('🍪');
  const [hardness, setHardness] = useState(3);
  const [light, setLight] = useState(0);
  const [trigger, setTrigger] = useState('rightclick');
  const [action, setAction] = useState('speed');
  const [rexKey, setRexKey] = useState<string>('intro');
  const [xp, setXp] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [effects, setEffects] = useState<{ id: number; emoji: string; left: string; top: string }[]>([]);
  const [showWin, setShowWin] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const hintKeys = useMemo(() => ['intro','name','texture','hardness','light','power','test'], []);

  function bumpRex(key: string) {
    setRexKey(key);
  }

  function addXp(n: number) {
    setXp((v) => v + n);
  }

  function handleTexturePick(emoji: string) {
    setTexture(emoji);
    bumpRex('texture');
    addXp(10);
  }

  const javaCode = useMemo(() => {
    const cls = (blockName || 'MonBloc').replace(/[^a-zA-Z0-9]/g, '') + 'Block';
    const trigJ = ({ rightclick: 'onRightClick', break: 'onBlockBroken', walk: 'onWalkOn' } as Record<string, string>)[trigger];
    const actJ = ({
      speed:   'player.addEffect(SPEED, 200, 2);',
      cookies: 'world.dropItem(COOKIE, x, y+5, z, 8);',
      diamond: 'world.dropItem(DIAMOND, x, y+1, z, 3);',
      fire:    'world.setBlock(x, y+1, z, FIRE);',
    } as Record<string, string>)[action];
    return `// MCreator écrit ce code Java pour toi !
public class ${cls} extends Block {
  hardness   = ${hardness.toFixed(1)}f;
  lightLevel = ${light};

  @Override
  public void ${trigJ}(World w, Player p) {
    ${actJ}
  }
}`;
  }, [blockName, hardness, light, trigger, action]);

  function fireTest() {
    setSpinning(true);
    const map: Record<string, string> = { speed: '⚡', cookies: '🍪', diamond: '💎', fire: '🔥' };
    const emoji = map[action];
    const newEffects = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      emoji,
      left: `${Math.random() * 80 + 10}%`,
      top:  `${Math.random() * 60 + 10}%`,
    }));
    setEffects(newEffects);
    bumpRex('test');
    setTimeout(() => {
      setSpinning(false);
      setEffects([]);
      bumpRex('win');
      addXp(60);
      setShowWin(true);
    }, 2200);
  }

  const cubeColor = COLORS[texture] || '#facc15';

  return (
    <main className="relative min-h-screen text-white">
      <style dangerouslySetInnerHTML={{ __html: `
        .pixel-font { font-family: 'Courier New', 'Lucida Console', monospace; letter-spacing: 0.05em; }
        .scene { perspective: 800px; perspective-origin: 50% 50%; }
        .cube { width: 140px; height: 140px; position: relative; transform-style: preserve-3d; transform: rotateX(-25deg) rotateY(35deg); transition: transform .8s cubic-bezier(.2,.8,.3,1.2); }
        .cube.spin { animation: cubespin 6s linear infinite; }
        @keyframes cubespin { from { transform: rotateX(-25deg) rotateY(35deg);} to { transform: rotateX(-25deg) rotateY(395deg);} }
        .cube .face { position: absolute; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; font-size: 80px; image-rendering: pixelated; border: 2px solid rgba(0,0,0,.35); box-shadow: inset 0 0 24px rgba(0,0,0,.25); }
        .cube .top    { transform: rotateX(90deg)  translateZ(70px); filter: brightness(1.15); }
        .cube .bottom { transform: rotateX(-90deg) translateZ(70px); filter: brightness(0.55); }
        .cube .front  { transform: translateZ(70px); }
        .cube .back   { transform: rotateY(180deg) translateZ(70px); filter: brightness(0.7); }
        .cube .left   { transform: rotateY(-90deg) translateZ(70px); filter: brightness(0.85); }
        .cube .right  { transform: rotateY(90deg)  translateZ(70px); filter: brightness(0.95); }
        .ground {
          background:
            repeating-linear-gradient(0deg, #6b3f1f 0, #6b3f1f 32px, #5a3517 32px, #5a3517 33px),
            repeating-linear-gradient(90deg, transparent 0, transparent 32px, rgba(0,0,0,.18) 32px, rgba(0,0,0,.18) 33px);
        }
        .sky { background: linear-gradient(180deg, #6ec3ff 0%, #b6e2ff 60%, #d6efff 100%); }
        .pulse-glow { box-shadow: 0 0 0 0 rgba(74,222,128,.65); animation: pulseGlow 1.6s infinite; }
        @keyframes pulseGlow {
          0%   { box-shadow: 0 0 0 0 rgba(74,222,128,.65); }
          70%  { box-shadow: 0 0 0 14px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
        input[type=range].mc-slider { -webkit-appearance: none; appearance: none; height: 10px; background: #1f2937; border-radius: 6px; outline: none; }
        input[type=range].mc-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; background: #4ADE80; border-radius: 50%; cursor: pointer; border: 3px solid #064e3b; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
        input[type=range].mc-slider::-moz-range-thumb { width: 28px; height: 28px; background: #4ADE80; border-radius: 50%; cursor: pointer; border: 3px solid #064e3b; }
      ` }} />

      <div className="absolute inset-0 cosmic-grid" />

      {/* TOP BAR */}
      <header className="relative z-10 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-b border-emerald-600/30 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 shadow-lg">
        <button
          onClick={() => router.push('/apps/educatif/')}
          className="text-white/70 hover:text-white text-sm flex items-center gap-1"
        >
          ← Hub
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-400 to-emerald-700 rounded-lg flex items-center justify-center text-2xl sm:text-3xl shadow-md">🟩</div>
          <div>
            <div className="pixel-font text-emerald-300 text-[10px]">MCREATOR ACADEMY</div>
            <div className="text-base sm:text-xl font-black">Mission #1 — Crée ton Bloc Cookie 🍪</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-lg px-3 py-1.5">
            <span className="text-2xl">⭐</span>
            <span className="font-black text-amber-300">{xp} XP</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-2xl border-2 border-orange-300">🦖</div>
            <div className="text-sm">
              <div className="font-black text-orange-300">Cmdt Rex</div>
              <div className="text-xs text-white/60">Coach Studio XP</div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* PALETTE */}
        <aside className="lg:col-span-2 bg-slate-900/80 backdrop-blur rounded-xl p-4 border border-slate-700">
          <div className="pixel-font text-[10px] text-white/50 mb-3">ÉLÉMENTS DU MOD</div>
          <div className="space-y-2">
            <button className="w-full text-left p-3 bg-emerald-500/20 border-2 border-emerald-400 rounded-lg flex items-center gap-2 pulse-glow">
              <span className="text-2xl">🟩</span>
              <div>
                <div className="font-black text-sm">Bloc</div>
                <div className="text-[10px] text-emerald-300">en cours →</div>
              </div>
            </button>
            {[['⚔️','Item'], ['🐔','Mob'], ['⚙️','Procédure']].map(([emo, lbl]) => (
              <button key={lbl} disabled className="w-full text-left p-3 bg-slate-800/60 border-2 border-slate-700 rounded-lg flex items-center gap-2 opacity-60">
                <span className="text-2xl">{emo}</span>
                <div>
                  <div className="font-black text-sm">{lbl}</div>
                  <div className="text-[10px] text-white/40">débloque-moi</div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6 p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg">
            <div className="pixel-font text-[9px] text-amber-300 mb-1">DANS LE VRAI MCREATOR</div>
            <div className="text-xs text-amber-100/80 leading-relaxed">Ces 4 catégories existent pour de vrai. Tu vas créer chacune au camp.</div>
          </div>
        </aside>

        {/* WORKSPACE */}
        <section className="lg:col-span-7 bg-slate-900/80 backdrop-blur rounded-xl p-4 sm:p-6 border border-slate-700 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="pixel-font text-[10px] text-emerald-300 mb-1">PROPRIÉTÉS DU BLOC</div>
              <div className="text-xl sm:text-2xl font-black">Construis ton premier bloc 👇</div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-4 border-2 border-emerald-400">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 bg-emerald-500 text-slate-900 rounded-full flex items-center justify-center font-black">1</span>
              <span className="font-black text-lg">Nom de ton bloc</span>
            </div>
            <input
              value={blockName}
              maxLength={24}
              onChange={(e) => { setBlockName(e.target.value); bumpRex('name'); }}
              className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-lg px-4 py-3 text-lg font-black focus:border-emerald-400 focus:outline-none"
            />
            <div className="text-xs text-white/50 mt-1">Astuce : un nom fun = un bloc fun. « Cookie de Diamant », « Bloc Volcan », ce que tu veux.</div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-slate-600 text-slate-200 rounded-full flex items-center justify-center font-black">2</span>
              <span className="font-black text-lg">Choisis sa texture</span>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {TEXTURES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTexturePick(t)}
                  className={`aspect-square bg-slate-950 border-2 rounded-lg text-2xl sm:text-3xl hover:scale-110 transition ${
                    texture === t ? 'border-emerald-400 bg-emerald-500/20' : 'border-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="text-xs text-white/50 mt-2">Au camp tu vas dessiner ta texture en pixel art (16×16). Ici on choisit vite avec un emoji.</div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-slate-600 text-slate-200 rounded-full flex items-center justify-center font-black">3</span>
              <span className="font-black text-lg">Règle ses propriétés</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-white/80 flex justify-between">
                  <span>💪 Dureté</span><span className="text-emerald-400">{hardness.toFixed(1)}</span>
                </label>
                <input
                  type="range" min={0} max={10} step={0.5}
                  value={hardness}
                  onChange={(e) => { setHardness(parseFloat(e.target.value)); bumpRex('hardness'); }}
                  className="mc-slider w-full mt-2"
                />
                <div className="text-[11px] text-white/40 mt-1">0 = se casse à mains nues · 10 = il faut du diamant</div>
              </div>
              <div>
                <label className="text-sm font-bold text-white/80 flex justify-between">
                  <span>💡 Lumière</span><span className="text-amber-300">{light}</span>
                </label>
                <input
                  type="range" min={0} max={15} step={1}
                  value={light}
                  onChange={(e) => { setLight(parseInt(e.target.value)); bumpRex('light'); }}
                  className="mc-slider w-full mt-2"
                />
                <div className="text-[11px] text-white/40 mt-1">0 = noir · 15 = brille comme du verre lumineux</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-4 border-2 border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-slate-600 text-slate-200 rounded-full flex items-center justify-center font-black">4</span>
              <span className="font-black text-lg">Donne-lui un super-pouvoir</span>
            </div>
            <div className="text-xs text-white/50 mb-2">C'est ça une <b className="text-emerald-400">procédure</b> dans MCreator : « Quand X arrive, fais Y ». Au camp tu vas en câbler des dizaines.</div>
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_1fr] gap-2 items-center">
              <div className="text-sm font-bold text-amber-300">QUAND</div>
              <select value={trigger} onChange={(e) => { setTrigger(e.target.value); bumpRex('power'); }} className="bg-slate-950 border-2 border-slate-700 rounded-lg px-3 py-2 font-bold">
                {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="text-sm font-bold text-emerald-400">ALORS</div>
              <select value={action} onChange={(e) => { setAction(e.target.value); bumpRex('power'); }} className="bg-slate-950 border-2 border-slate-700 rounded-lg px-3 py-2 font-bold">
                {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={fireTest}
            disabled={spinning}
            className="mt-2 w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-900 font-black text-lg sm:text-xl py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 disabled:opacity-60"
          >
            ▶  TESTER MON BLOC DANS MINECRAFT
          </button>
        </section>

        {/* PREVIEW + JAVA */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-slate-900/80 backdrop-blur rounded-xl p-4 border border-slate-700 flex-1">
            <div className="pixel-font text-[10px] text-white/50 mb-2">APERÇU EN JEU</div>
            <div className="rounded-lg overflow-hidden border-2 border-slate-700">
              <div className="sky h-20 sm:h-24 flex items-end justify-center relative">
                <div className="absolute top-2 right-2 text-2xl">☁️</div>
                <div className="absolute top-3 left-3 text-2xl">🌞</div>
              </div>
              <div className="ground h-32 flex items-start justify-center pt-3 relative scene">
                <div className={`cube ${spinning ? 'spin' : ''}`} style={{ filter: light > 0 ? `drop-shadow(0 0 ${light * 1.5}px rgba(253,224,71,${light/15}))` : 'none' }}>
                  <div className="face top" style={{ background: cubeColor }} />
                  <div className="face bottom" style={{ background: cubeColor }} />
                  <div className="face front" style={{ background: cubeColor }}>{texture}</div>
                  <div className="face back" style={{ background: cubeColor }}>{texture}</div>
                  <div className="face left" style={{ background: cubeColor }}>{texture}</div>
                  <div className="face right" style={{ background: cubeColor }}>{texture}</div>
                </div>
                <div className="absolute inset-0 pointer-events-none">
                  {effects.map((e) => (
                    <span
                      key={e.id}
                      className="absolute text-3xl sm:text-4xl"
                      style={{
                        left: e.left, top: e.top,
                        animation: 'fxRise 1.4s ease-out forwards',
                      }}
                    >
                      {e.emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes fxRise {
                0%   { opacity: 0; transform: translateY(20px) scale(0.6); }
                30%  { opacity: 1; transform: translateY(0) scale(1.1); }
                100% { opacity: 0; transform: translateY(-80px) scale(1); }
              }
            ` }} />

            <div className="mt-3 p-2 bg-slate-950 rounded-lg">
              <div className="text-[11px] text-white/50">Nom :</div>
              <div className="font-black text-emerald-300 truncate">{blockName || '...'}</div>
              <div className="grid grid-cols-2 gap-1 mt-2 text-[11px]">
                <div><span className="text-white/50">Dureté</span> <span className="text-amber-300 font-bold">{hardness.toFixed(1)}</span></div>
                <div><span className="text-white/50">Lumière</span> <span className="text-amber-300 font-bold">{light}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur rounded-xl p-4 border border-slate-700">
            <div className="pixel-font text-[10px] text-white/50 mb-2">CODE JAVA GÉNÉRÉ</div>
            <pre className="bg-slate-950 rounded-lg p-3 text-[11px] text-emerald-300 overflow-x-auto"><code>{javaCode}</code></pre>
            <div className="text-[10px] text-white/40 mt-2">👆 Au camp tu vas comprendre chaque ligne. Promis, c'est moins pire que ça en a l'air.</div>
          </div>
        </aside>
      </div>

      {/* BOTTOM REX BAR */}
      <footer className="sticky bottom-0 z-20 bg-gradient-to-r from-orange-900/60 to-amber-900/60 backdrop-blur border-t-2 border-orange-500/40 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-2xl sm:text-3xl border-2 border-orange-300 flex-shrink-0">🦖</div>
        <div className="flex-1 min-w-0">
          <div className="text-orange-300 font-black text-xs sm:text-sm">Cmdt Rex te dit :</div>
          <div className="text-sm sm:text-lg font-bold text-amber-100 leading-snug">{RX_LINES[rexKey]}</div>
        </div>
        <button
          onClick={() => { const next = (hintIdx + 1) % hintKeys.length; setHintIdx(next); bumpRex(hintKeys[next]); }}
          className="bg-orange-500 hover:bg-orange-400 text-slate-900 font-black px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap text-xs sm:text-base"
        >
          💡 Aide-moi
        </button>
      </footer>

      {/* WIN MODAL */}
      {showWin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-emerald-900 to-emerald-950 border-4 border-emerald-400 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <div className="text-7xl mb-2 animate-bounce">🏆</div>
            <div className="pixel-font text-emerald-300 text-xs mb-2">MISSION #1 RÉUSSIE</div>
            <div className="text-3xl font-black text-white mb-2">Tu es Apprenti Modder !</div>
            <div className="text-amber-300 text-lg mb-4">+ 60 XP · Badge 🍪 débloqué</div>
            <div className="bg-slate-950/60 rounded-lg p-3 mb-4 text-sm text-white/80">
              Ton bloc <b className="text-emerald-300">{blockName || 'Mon Bloc'}</b> existe pour de vrai dans ton mod. Au camp Studio XP cet été, tu vas en construire des dizaines comme ça — puis des items, des mobs, des dimensions complètes.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/apps/educatif/')}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black py-3 rounded-lg"
              >
                Retour au hub
              </button>
              <button onClick={() => setShowWin(false)} className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 rounded-lg">
                Refaire
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
