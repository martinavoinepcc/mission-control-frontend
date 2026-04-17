'use client';

// MCreator Academy — Mission #1 : Block Cookie
// Parcours Jackson → camp Studio XP été 2026. Outil cible : MCreator + Java.
// v2 — Coach K (Gym bro), ado-cool, emphasis PUR Java.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const TEXTURES = ['🍪','💎','🔥','🌋','⚡','🌳','🪨','🌟','🍉','🐠','🍫','🌈','💧','🪐','🪙','🛡️'];
const COLORS: Record<string, string> = {
  '🍪':'#d4a056','💎':'#5dd1ff','🔥':'#ff6a3d','🌋':'#7c3a23','⚡':'#fde047','🌳':'#3f7d20','🪨':'#7c7c7c',
  '🌟':'#fbbf24','🍉':'#ec4899','🐠':'#06b6d4','🍫':'#5d3a1a','🌈':'#a855f7','💧':'#3b82f6','🪐':'#9333ea','🪙':'#facc15','🛡️':'#9ca3af',
};

// Coach K — Gym bro influenceur, sensei Java, vibe Quebec-franglais
const COACH_LINES: Record<string, string> = {
  intro: "Yo Jackson. On va ship ton premier mod legit. Choisis un nom, une texture, tweak les stats, pèse sur ▶ Play. Let's go bro.",
  name:  "Clean. Ce nom-là devient le getName() de ta classe Java — littéralement.",
  texture: "Vibes solides. Au camp tu vas draw ta texture 16×16 en pixel art — ici on fast-track avec un emoji.",
  hardness: "Hardness = nb de hits pour break le bloc. Stone=1.5f · Diamond=3f · Obsidian=50f. Ça devient getDestroySpeed() en Java.",
  light: "Light 15 = glow comme un torch. Essential dans les caves. Ça map sur setLightEmission() dans Properties.",
  power: "Bro. CA c'est une procedure Java. Pattern WHEN X THEN Y = method @Override avec un if. Exactement ce que tu vas coder au camp.",
  test: "Pèse. Regarde ça popper.",
  win: "LET'S GOOO. Premier mod in the bag. Propre. Au camp Studio XP tu vas en ship 50+ et build un mod complet.",
};

const TRIGGERS = [
  { value: 'rightclick', label: 'on right-click le bloc',      method: 'useItemOn' },
  { value: 'break',      label: 'on break le bloc',             method: 'onDestroyedByPlayer' },
  { value: 'walk',       label: 'on step sur le bloc',          method: 'stepOn' },
];

const ACTIONS = [
  { value: 'speed',   label: 'player → SPEED x3 ⚡',        code: 'player.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SPEED, 200, 2));' },
  { value: 'cookies', label: 'rain de cookies 🍪',          code: 'level.addFreshEntity(new ItemEntity(level, x, y+5, z, new ItemStack(Items.COOKIE, 8)));' },
  { value: 'diamond', label: 'drop 3 diamonds 💎',          code: 'level.addFreshEntity(new ItemEntity(level, x, y+1, z, new ItemStack(Items.DIAMOND, 3)));' },
  { value: 'fire',    label: 'le bloc s\u2019enflamme 🔥',  code: 'level.setBlock(pos.above(), Blocks.FIRE.defaultBlockState(), 3);' },
];

export default function MCreatorMission1Page() {
  const router = useRouter();
  const [blockName, setBlockName] = useState('Cookie de Diamant');
  const [texture, setTexture] = useState('🍪');
  const [hardness, setHardness] = useState(3);
  const [light, setLight] = useState(0);
  const [trigger, setTrigger] = useState('rightclick');
  const [action, setAction] = useState('speed');
  const [coachKey, setCoachKey] = useState<string>('intro');
  const [xp, setXp] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [effects, setEffects] = useState<{ id: number; emoji: string; left: string; top: string }[]>([]);
  const [showWin, setShowWin] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const hintKeys = useMemo(() => ['intro','name','texture','hardness','light','power','test'], []);

  const bumpCoach = (k: string) => setCoachKey(k);
  const addXp = (n: number) => setXp((v) => v + n);

  function handleTexturePick(emoji: string) {
    setTexture(emoji);
    bumpCoach('texture');
    addXp(10);
  }

  const clsName = useMemo(
    () => (blockName || 'MonBloc').replace(/[^a-zA-Z0-9]/g, '') || 'MonBloc',
    [blockName]
  );

  const javaCode = useMemo(() => {
    const cls = clsName;
    const trigMeta = TRIGGERS.find((t) => t.value === trigger)!;
    const actMeta  = ACTIONS.find((a) => a.value === action)!;

    return [
      "package com.jackson.mod.block;",
      "",
      "import net.minecraft.world.level.block.Block;",
      "import net.minecraft.world.level.block.state.BlockState;",
      "import net.minecraft.world.level.material.Material;",
      "import net.minecraft.world.entity.player.Player;",
      "import net.minecraft.world.effect.MobEffectInstance;",
      "import net.minecraft.world.effect.MobEffects;",
      "import net.minecraft.world.InteractionResult;",
      "",
      `public class ${cls}Block extends Block {`,
      "",
      `    public ${cls}Block() {`,
      "        super(Properties.of(Material.STONE)",
      `            .strength(${hardness.toFixed(1)}f)`,
      `            .lightLevel(state -> ${light})`,
      "            .requiresCorrectToolForDrops()",
      "        );",
      "    }",
      "",
      "    @Override",
      `    public InteractionResult ${trigMeta.method}(`,
      "            BlockState state, Level level, BlockPos pos, Player player) {",
      "",
      "        if (!level.isClientSide) {",
      "            double x = pos.getX(), y = pos.getY(), z = pos.getZ();",
      `            ${actMeta.code}`,
      "        }",
      "        return InteractionResult.SUCCESS;",
      "    }",
      "}",
    ].join('\n');
  }, [clsName, hardness, light, trigger, action]);

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
    bumpCoach('test');
    setTimeout(() => {
      setSpinning(false);
      setEffects([]);
      bumpCoach('win');
      addXp(60);
      setShowWin(true);
    }, 2200);
  }

  const cubeColor = COLORS[texture] || '#facc15';

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: `
        .mono { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
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
        .ground { background: repeating-linear-gradient(0deg, #433225 0, #433225 32px, #352618 32px, #352618 33px), repeating-linear-gradient(90deg, transparent 0, transparent 32px, rgba(0,0,0,.18) 32px, rgba(0,0,0,.18) 33px); }
        .sky { background: linear-gradient(180deg, #0f1b2d 0%, #1e2d44 60%, #2a3d5a 100%); }
        .grid-bg { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0); background-size: 22px 22px; }
        .neon { text-shadow: 0 0 8px currentColor; }
        input[type=range].slider { -webkit-appearance: none; appearance: none; height: 6px; background: #1e293b; border-radius: 999px; outline: none; }
        input[type=range].slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background: #A3E635; border-radius: 50%; cursor: pointer; border: 2px solid #0f172a; box-shadow: 0 0 10px rgba(163,230,53,.6); }
        input[type=range].slider::-moz-range-thumb { width: 20px; height: 20px; background: #A3E635; border-radius: 50%; cursor: pointer; border: 2px solid #0f172a; }
        .code-line { display: block; padding-left: 2.5rem; position: relative; min-height: 1.1em; }
        .code-line::before { content: attr(data-n); position: absolute; left: 0; width: 2rem; text-align: right; color: #475569; padding-right: .5rem; }
        .kw { color: #c084fc; }
        .ty { color: #38bdf8; }
        .st { color: #fde047; }
        .nb { color: #f97316; }
        .an { color: #f472b6; }
        .cm { color: #64748b; font-style: italic; }
        @keyframes fxRise {
          0%   { opacity: 0; transform: translateY(20px) scale(0.6); }
          30%  { opacity: 1; transform: translateY(0) scale(1.1); }
          100% { opacity: 0; transform: translateY(-80px) scale(1); }
        }
      ` }} />

      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* TOP BAR */}
      <header className="relative z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <button onClick={() => router.push('/apps/educatif/')} className="text-slate-400 hover:text-lime-300 text-sm flex items-center gap-1 transition">
          ← Hub
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-400/10 border border-lime-400/40 rounded-md flex items-center justify-center text-lg text-lime-300 mono font-black">01</div>
          <div>
            <div className="mono text-[9px] text-lime-300/80 tracking-widest">MCREATOR ACADEMY · MISSION 01</div>
            <div className="text-base sm:text-lg font-bold text-slate-100">Block · <span className="text-lime-300">Cookie de Diamant</span></div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="mono text-xs px-3 py-1.5 rounded-md bg-lime-400/10 border border-lime-400/40 text-lime-300">
            <span className="opacity-60">XP</span> <span className="font-black">{xp}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center text-xl shadow-lg shadow-fuchsia-500/20">💪</div>
            <div className="text-xs leading-tight">
              <div className="font-bold text-fuchsia-300">Coach K</div>
              <div className="text-[10px] text-slate-400 mono">Sensei Java</div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 pb-36">
        {/* PALETTE */}
        <aside className="lg:col-span-2 bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
          <div className="mono text-[9px] text-slate-500 mb-3 tracking-widest">MOD ELEMENTS</div>
          <div className="space-y-2">
            <button className="w-full text-left p-3 bg-lime-400/10 border border-lime-400/50 rounded-md flex items-center gap-2">
              <span className="text-lg">🟩</span>
              <div>
                <div className="font-bold text-sm text-lime-300">Block</div>
                <div className="mono text-[9px] text-lime-400/60">ACTIVE</div>
              </div>
            </button>
            {[['⚔️','Item','M02'], ['🐺','Mob','M03'], ['⚙️','Procedure','M04'], ['🔨','Recipe','M05']].map(([emo, lbl, tag]) => (
              <button key={lbl} disabled className="w-full text-left p-3 bg-slate-800/40 border border-slate-800 rounded-md flex items-center gap-2 opacity-50">
                <span className="text-lg">{emo}</span>
                <div>
                  <div className="font-bold text-sm text-slate-300">{lbl}</div>
                  <div className="mono text-[9px] text-slate-500">🔒 {tag}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-5 p-3 bg-slate-800/40 border border-slate-800 rounded-md">
            <div className="mono text-[9px] text-slate-500 mb-1 tracking-widest">REAL MCREATOR</div>
            <div className="text-xs text-slate-400 leading-relaxed">Ces 5 catégories existent dans l'outil. Tu vas toutes les ship au camp.</div>
          </div>
        </aside>

        {/* WORKSPACE */}
        <section className="lg:col-span-6 bg-slate-900/60 backdrop-blur rounded-lg p-4 sm:p-6 border border-slate-800 flex flex-col gap-4">
          <div>
            <div className="mono text-[9px] text-lime-400/80 tracking-widest mb-1">BLOCK PROPERTIES</div>
            <div className="text-xl sm:text-2xl font-bold">Configure ton block</div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-[10px] text-lime-300 bg-lime-400/10 border border-lime-400/40 rounded px-2 py-0.5">01</span>
              <span className="font-bold text-sm text-slate-200">Registry name</span>
              <span className="mono text-[10px] text-slate-500">→ String</span>
            </div>
            <input
              value={blockName}
              maxLength={24}
              onChange={(e) => { setBlockName(e.target.value); bumpCoach('name'); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 mono text-sm text-lime-300 focus:border-lime-400 focus:outline-none"
            />
            <div className="mono text-[10px] text-slate-500 mt-1.5">→ classe Java : <span className="text-lime-400">{clsName}Block</span></div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">02</span>
              <span className="font-bold text-sm text-slate-200">Texture</span>
              <span className="mono text-[10px] text-slate-500">→ assets/textures/</span>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {TEXTURES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTexturePick(t)}
                  className={`aspect-square bg-slate-950 border rounded-md text-xl sm:text-2xl hover:scale-110 transition ${
                    texture === t ? 'border-lime-400 bg-lime-400/10' : 'border-slate-800 hover:border-lime-400/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">03</span>
              <span className="font-bold text-sm text-slate-200">Properties</span>
              <span className="mono text-[10px] text-slate-500">→ Block.Properties.of()</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">.strength()</span>
                  <span className="text-lime-300 font-bold">{hardness.toFixed(1)}f</span>
                </label>
                <input type="range" min={0} max={10} step={0.5} value={hardness}
                  onChange={(e) => { setHardness(parseFloat(e.target.value)); bumpCoach('hardness'); }}
                  className="slider w-full mt-2"
                />
                <div className="mono text-[10px] text-slate-500 mt-1">hands=0 · stone=1.5 · diamond=3 · obsidian=50</div>
              </div>
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">.lightLevel()</span>
                  <span className="text-amber-300 font-bold">{light}</span>
                </label>
                <input type="range" min={0} max={15} step={1} value={light}
                  onChange={(e) => { setLight(parseInt(e.target.value)); bumpCoach('light'); }}
                  className="slider w-full mt-2"
                />
                <div className="mono text-[10px] text-slate-500 mt-1">0=dark · 15=glowstone</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">04</span>
              <span className="font-bold text-sm text-slate-200">Procedure</span>
              <span className="mono text-[10px] text-slate-500">→ @Override method</span>
            </div>
            <div className="mono text-[10px] text-slate-500 mb-3">Pattern <span className="text-fuchsia-300">WHEN</span> → <span className="text-lime-300">THEN</span>. C'est littéralement une méthode Java avec un <span className="text-fuchsia-300">if</span>.</div>
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2 items-center">
              <div className="mono text-xs text-fuchsia-300 font-bold">WHEN</div>
              <select value={trigger} onChange={(e) => { setTrigger(e.target.value); bumpCoach('power'); }} className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 mono text-xs text-slate-200 focus:border-fuchsia-400 focus:outline-none">
                {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="mono text-xs text-lime-300 font-bold">THEN</div>
              <select value={action} onChange={(e) => { setAction(e.target.value); bumpCoach('power'); }} className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 mono text-xs text-slate-200 focus:border-lime-400 focus:outline-none">
                {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={fireTest}
            disabled={spinning}
            className="mt-1 w-full bg-lime-400 hover:bg-lime-300 text-slate-950 mono font-black text-sm py-3.5 rounded-md transition-transform active:scale-[.98] disabled:opacity-60 tracking-widest"
          >
            ▶  RUN  ·  BUILD  ·  TEST
          </button>
        </section>

        {/* PREVIEW + JAVA */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
            <div className="mono text-[9px] text-slate-500 mb-2 tracking-widest">LIVE PREVIEW</div>
            <div className="rounded-md overflow-hidden border border-slate-800">
              <div className="sky h-16 flex items-end justify-center relative">
                <div className="absolute top-2 right-2 text-xl opacity-60">☁️</div>
                <div className="absolute top-2 left-2 text-xl opacity-60">🌙</div>
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
                    <span key={e.id} className="absolute text-3xl" style={{ left: e.left, top: e.top, animation: 'fxRise 1.4s ease-out forwards' }}>
                      {e.emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-3 border border-slate-800 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[9px] text-lime-300 tracking-widest">{clsName}Block.java</div>
              <div className="mono text-[9px] text-slate-500">JAVA · GENERATED</div>
            </div>
            <pre className="bg-slate-950 rounded-md p-3 text-[11px] mono leading-[1.55] overflow-x-auto max-h-[440px] border border-slate-800">
              <code>
                {javaCode.split('\n').map((line, i) => {
                  const colored = line
                    .replace(/(\/\/.*)/g, '<span class="cm">$1</span>')
                    .replace(/\b(package|import|public|private|protected|class|extends|return|if|new|this)\b/g, '<span class="kw">$1</span>')
                    .replace(/\b(Block|BlockState|Level|Player|Material|MobEffectInstance|MobEffects|InteractionResult|Properties|Items|Blocks|ItemEntity|ItemStack|BlockPos|String|int|double|boolean|float|void)\b/g, '<span class="ty">$1</span>')
                    .replace(/\b(\d+(?:\.\d+f?)?)\b/g, '<span class="nb">$1</span>')
                    .replace(/(@Override)/g, '<span class="an">$1</span>');
                  return (
                    <span key={i} className="code-line" data-n={String(i + 1).padStart(2, ' ')} dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} />
                  );
                })}
              </code>
            </pre>
            <div className="mono text-[10px] text-slate-500 mt-2">Chaque slider/dropdown dans le panel = une ligne de Java réelle. Same thing que MCreator ship au camp.</div>
          </div>
        </aside>
      </div>

      {/* COACH K BAR */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur border-t border-fuchsia-500/30 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <div className="w-11 h-11 rounded-md bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center text-2xl shadow-lg shadow-fuchsia-500/20 flex-shrink-0">💪</div>
        <div className="flex-1 min-w-0">
          <div className="mono text-[10px] text-fuchsia-400 tracking-widest">COACH K</div>
          <div className="text-sm text-slate-100 leading-snug">{COACH_LINES[coachKey]}</div>
        </div>
        <button
          onClick={() => { const next = (hintIdx + 1) % hintKeys.length; setHintIdx(next); bumpCoach(hintKeys[next]); }}
          className="bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 mono font-bold px-3 py-2 rounded-md whitespace-nowrap text-xs"
        >
          HINT →
        </button>
      </footer>

      {/* WIN MODAL */}
      {showWin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-lime-400/60 rounded-lg p-7 max-w-md shadow-2xl shadow-lime-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-md bg-lime-400/10 border border-lime-400/60 flex items-center justify-center text-2xl text-lime-300">✓</div>
              <div>
                <div className="mono text-[10px] text-lime-300 tracking-widest">MISSION 01 · SHIPPED</div>
                <div className="text-xl font-bold text-slate-100">Apprenti Modder unlocked</div>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4 text-sm text-slate-300">
              Ton block <span className="mono text-lime-300">{blockName}</span> compile pour de vrai. Au camp Studio XP cet été : 50+ blocks + items + mobs + procedures → mod complet.
            </div>
            <div className="flex items-center gap-3 mono text-xs mb-5">
              <span className="text-lime-300">+60 XP</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">🏆 Badge Block Master</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/apps/educatif/')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 mono font-black py-2.5 rounded-md tracking-widest text-sm">
                → HUB
              </button>
              <button onClick={() => router.push('/apps/educatif/mcreator/mission-2-epee-custom/')} className="flex-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 mono font-black py-2.5 rounded-md tracking-widest text-sm">
                M02 →
              </button>
              <button onClick={() => setShowWin(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 mono text-xs px-3 rounded-md">
                REDO
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
