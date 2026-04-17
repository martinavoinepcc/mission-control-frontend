'use client';

// MCreator Academy — Mission #3 : Mob (entité custom)
// Concepts Java : extends Monster, méthode statique createAttributes() (Builder pattern),
// registerGoals() avec PriorityGoal, AttributeSupplier.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SkinKey = 'GHOST' | 'WOLF' | 'SLIME' | 'GOLEM' | 'BAT';
const SKINS: Record<SkinKey, { emoji: string; bg: string; label: string }> = {
  GHOST: { emoji: '👻', bg: '#1e293b', label: 'Ghost' },
  WOLF:  { emoji: '🐺', bg: '#374151', label: 'Wolf'  },
  SLIME: { emoji: '🟢', bg: '#14532d', label: 'Slime' },
  GOLEM: { emoji: '🗿', bg: '#52525b', label: 'Golem' },
  BAT:   { emoji: '🦇', bg: '#1c1917', label: 'Bat'   },
};

type AIKey = 'PASSIVE' | 'NEUTRAL' | 'HOSTILE';
const AI_LABELS: Record<AIKey, { label: string; goalsCode: string[]; description: string }> = {
  PASSIVE: {
    label: 'Passif',
    description: 'fuit le joueur, pas d\'attaque',
    goalsCode: [
      'this.goalSelector.addGoal(1, new PanicGoal(this, 1.4D));',
      'this.goalSelector.addGoal(2, new RandomStrollGoal(this, 1.0D));',
      'this.goalSelector.addGoal(3, new LookAtPlayerGoal(this, Player.class, 8.0F));',
    ],
  },
  NEUTRAL: {
    label: 'Neutre',
    description: 'attaque seulement si frappé',
    goalsCode: [
      'this.goalSelector.addGoal(1, new MeleeAttackGoal(this, 1.0D, true));',
      'this.goalSelector.addGoal(2, new RandomStrollGoal(this, 1.0D));',
      'this.targetSelector.addGoal(1, new HurtByTargetGoal(this));',
    ],
  },
  HOSTILE: {
    label: 'Hostile',
    description: 'chasse le joueur dès qu\'il le voit',
    goalsCode: [
      'this.goalSelector.addGoal(1, new MeleeAttackGoal(this, 1.2D, false));',
      'this.goalSelector.addGoal(2, new MoveTowardsTargetGoal(this, 1.0D, 32.0F));',
      'this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));',
    ],
  },
};

const COACH_LINES: Record<string, string> = {
  intro: "Mission #3 : Mob. Ici on touche aux Entity classes. Tu vas voir : héritage en chaîne, méthodes static, Builder pattern. Hardcore mais legit.",
  name:  "Le name = registry name. Pas pour le client — pour le code.",
  skin:  "La skin référence ton modèle 3D + texture. MCreator le génère depuis ton pixel art.",
  health: "MAX_HEALTH attribute. Default mob = 20 (= 10 hearts). Player = 20. Ender Dragon = 200.",
  damage: "ATTACK_DAMAGE. C'est le base — modifié par la difficulté en jeu.",
  speed: "MOVEMENT_SPEED. 0.25 = walk normal. 0.35 = fast. 0.50 = sprint demon.",
  ai:    "registerGoals() = la liste des comportements priorisés. Goal 1 > Goal 2 > Goal 3. Le plus bas tier wins.",
  test:  "Spawn-le. Watch ton mob bouger.",
  win:   "BIG MOVE. Premier mob fonctionnel. Au camp tu vas en build avec animations custom, sons, drops, AI complexe.",
};

export default function MCreatorMission3Page() {
  const router = useRouter();
  const [mobName, setMobName] = useState('Cookie Wolf');
  const [skin, setSkin] = useState<SkinKey>('WOLF');
  const [maxHealth, setMaxHealth] = useState(20);
  const [attackDamage, setAttackDamage] = useState(4);
  const [movementSpeed, setMovementSpeed] = useState(0.30);
  const [followRange, setFollowRange] = useState(16);
  const [ai, setAi] = useState<AIKey>('NEUTRAL');
  const [coachKey, setCoachKey] = useState('intro');
  const [xp, setXp] = useState(0);
  const [spawning, setSpawning] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const hintKeys = useMemo(() => ['intro','name','skin','health','damage','speed','ai','test'], []);

  const bumpCoach = (k: string) => setCoachKey(k);
  const addXp = (n: number) => setXp((v) => v + n);

  const clsName = useMemo(
    () => (mobName || 'MonMob').replace(/[^a-zA-Z0-9]/g, '') || 'MonMob',
    [mobName]
  );

  const javaCode = useMemo(() => {
    const goals = AI_LABELS[ai].goalsCode;
    return [
      "package com.jackson.mod.entity;",
      "",
      "import net.minecraft.world.entity.EntityType;",
      "import net.minecraft.world.entity.Mob;",
      "import net.minecraft.world.entity.ai.attributes.Attributes;",
      "import net.minecraft.world.entity.ai.attributes.AttributeSupplier;",
      "import net.minecraft.world.entity.ai.goal.*;",
      "import net.minecraft.world.entity.ai.goal.target.*;",
      "import net.minecraft.world.entity.monster.Monster;",
      "import net.minecraft.world.entity.player.Player;",
      "import net.minecraft.world.level.Level;",
      "",
      `public class ${clsName}Entity extends Monster {`,
      "",
      `    public ${clsName}Entity(EntityType<? extends Monster> type, Level level) {`,
      "        super(type, level);",
      "    }",
      "",
      "    // Static factory — appelée 1x au boot pour register les attributes.",
      "    public static AttributeSupplier.Builder createAttributes() {",
      "        return Monster.createMonsterAttributes()",
      `            .add(Attributes.MAX_HEALTH,      ${maxHealth.toFixed(1)}D)`,
      `            .add(Attributes.ATTACK_DAMAGE,   ${attackDamage.toFixed(1)}D)`,
      `            .add(Attributes.MOVEMENT_SPEED,  ${movementSpeed.toFixed(2)}D)`,
      `            .add(Attributes.FOLLOW_RANGE,    ${followRange}.0D);`,
      "    }",
      "",
      "    @Override",
      "    protected void registerGoals() {",
      `        // Comportement : ${AI_LABELS[ai].label} — ${AI_LABELS[ai].description}`,
      ...goals.map((g) => `        ${g}`),
      "    }",
      "}",
    ].join('\n');
  }, [clsName, maxHealth, attackDamage, movementSpeed, followRange, ai]);

  function fireTest() {
    setSpawning(true);
    bumpCoach('test');
    setTimeout(() => {
      setSpawning(false);
      bumpCoach('win');
      addXp(80);
      setShowWin(true);
    }, 2200);
  }

  const skinMeta = SKINS[skin];

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: `
        .mono { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
        .grid-bg { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0); background-size: 22px 22px; }
        @keyframes mobBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes mobWalk { 0%,100% { transform: translateX(-40px); } 50% { transform: translateX(40px); } }
        .mob-idle { animation: mobBob 1.6s ease-in-out infinite; }
        .mob-walk { animation: mobWalk 4s ease-in-out infinite; }
        input[type=range].slider { -webkit-appearance: none; appearance: none; height: 6px; background: #1e293b; border-radius: 999px; outline: none; }
        input[type=range].slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background: #A3E635; border-radius: 50%; cursor: pointer; border: 2px solid #0f172a; box-shadow: 0 0 10px rgba(163,230,53,.6); }
        input[type=range].slider::-moz-range-thumb { width: 20px; height: 20px; background: #A3E635; border-radius: 50%; cursor: pointer; border: 2px solid #0f172a; }
        .code-line { display: block; padding-left: 2.5rem; position: relative; min-height: 1.1em; }
        .code-line::before { content: attr(data-n); position: absolute; left: 0; width: 2rem; text-align: right; color: #475569; padding-right: .5rem; }
        .kw { color: #c084fc; }
        .ty { color: #38bdf8; }
        .nb { color: #f97316; }
        .an { color: #f472b6; }
        .cm { color: #64748b; font-style: italic; }
      ` }} />

      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <header className="relative z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <button onClick={() => router.push('/apps/educatif/')} className="text-slate-400 hover:text-lime-300 text-sm">← Hub</button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-400/10 border border-rose-400/40 rounded-md flex items-center justify-center text-lg text-rose-300 mono font-black">03</div>
          <div>
            <div className="mono text-[9px] text-rose-300/80 tracking-widest">MCREATOR ACADEMY · MISSION 03</div>
            <div className="text-base sm:text-lg font-bold">Mob · <span className="text-rose-300">entité custom</span></div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="mono text-xs px-3 py-1.5 rounded-md bg-rose-400/10 border border-rose-400/40 text-rose-300">XP <span className="font-black">{xp}</span></div>
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center text-xl">💪</div>
            <div className="text-xs leading-tight">
              <div className="font-bold text-fuchsia-300">Coach K</div>
              <div className="text-[10px] text-slate-400 mono">Sensei Java</div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 pb-36">
        <aside className="lg:col-span-2 bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
          <div className="mono text-[9px] text-slate-500 mb-3 tracking-widest">MOD ELEMENTS</div>
          <div className="space-y-2">
            <button onClick={() => router.push('/apps/educatif/mcreator/mission-1-bloc-cookie/')} className="w-full text-left p-3 bg-slate-800/40 border border-lime-400/30 rounded-md flex items-center gap-2 hover:bg-lime-400/10">
              <span className="text-lg">🟩</span>
              <div><div className="font-bold text-sm text-lime-300">Block</div><div className="mono text-[9px] text-lime-400/60">✓ DONE</div></div>
            </button>
            <button onClick={() => router.push('/apps/educatif/mcreator/mission-2-epee-custom/')} className="w-full text-left p-3 bg-slate-800/40 border border-fuchsia-400/30 rounded-md flex items-center gap-2 hover:bg-fuchsia-400/10">
              <span className="text-lg">⚔️</span>
              <div><div className="font-bold text-sm text-fuchsia-300">Item</div><div className="mono text-[9px] text-fuchsia-400/60">✓ DONE</div></div>
            </button>
            <button className="w-full text-left p-3 bg-rose-400/10 border border-rose-400/50 rounded-md flex items-center gap-2">
              <span className="text-lg">🐺</span>
              <div><div className="font-bold text-sm text-rose-300">Mob</div><div className="mono text-[9px] text-rose-400/60">ACTIVE</div></div>
            </button>
            {[['⚙️','Procedure','M04'],['🔨','Recipe','M05']].map(([emo,lbl,tag]) => (
              <button key={lbl} disabled className="w-full text-left p-3 bg-slate-800/40 border border-slate-800 rounded-md flex items-center gap-2 opacity-50">
                <span className="text-lg">{emo}</span>
                <div><div className="font-bold text-sm text-slate-300">{lbl}</div><div className="mono text-[9px] text-slate-500">🔒 {tag}</div></div>
              </button>
            ))}
          </div>
        </aside>

        <section className="lg:col-span-6 bg-slate-900/60 backdrop-blur rounded-lg p-4 sm:p-6 border border-slate-800 flex flex-col gap-4">
          <div>
            <div className="mono text-[9px] text-rose-400/80 tracking-widest mb-1">ENTITY PROPERTIES</div>
            <div className="text-xl sm:text-2xl font-bold">Spawn ton mob</div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-[10px] text-rose-300 bg-rose-400/10 border border-rose-400/40 rounded px-2 py-0.5">01</span>
              <span className="font-bold text-sm">Entity name</span>
              <span className="mono text-[10px] text-slate-500">→ String</span>
            </div>
            <input value={mobName} maxLength={26} onChange={(e) => { setMobName(e.target.value); bumpCoach('name'); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 mono text-sm text-rose-300 focus:border-rose-400 focus:outline-none" />
            <div className="mono text-[10px] text-slate-500 mt-1.5">→ classe Java : <span className="text-rose-400">{clsName}Entity</span></div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">02</span>
              <span className="font-bold text-sm">Skin</span>
              <span className="mono text-[10px] text-slate-500">→ assets/textures/entity/</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(SKINS) as SkinKey[]).map((k) => (
                <button key={k} onClick={() => { setSkin(k); bumpCoach('skin'); addXp(5); }}
                  className={`px-2 py-3 rounded-md border text-center transition ${skin === k ? 'border-rose-400 bg-rose-400/10' : 'border-slate-800 hover:border-rose-400/50 bg-slate-950'}`}>
                  <div className="text-2xl mb-1">{SKINS[k].emoji}</div>
                  <div className="mono text-[10px] text-slate-300">{SKINS[k].label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">03</span>
              <span className="font-bold text-sm">Attributes</span>
              <span className="mono text-[10px] text-slate-500">→ AttributeSupplier.Builder</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">MAX_HEALTH</span>
                  <span className="text-rose-300 font-bold">{maxHealth.toFixed(0)} ❤</span>
                </label>
                <input type="range" min={4} max={100} step={2} value={maxHealth}
                  onChange={(e) => { setMaxHealth(parseInt(e.target.value)); bumpCoach('health'); }}
                  className="slider w-full mt-2" />
                <div className="mono text-[10px] text-slate-500 mt-1">vache=10 · zombie=20 · iron golem=100</div>
              </div>
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">ATTACK_DAMAGE</span>
                  <span className="text-amber-300 font-bold">{attackDamage}</span>
                </label>
                <input type="range" min={0} max={20} step={1} value={attackDamage}
                  onChange={(e) => { setAttackDamage(parseInt(e.target.value)); bumpCoach('damage'); }}
                  className="slider w-full mt-2" />
              </div>
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">MOVEMENT_SPEED</span>
                  <span className="text-cyan-300 font-bold">{movementSpeed.toFixed(2)}</span>
                </label>
                <input type="range" min={0.10} max={0.60} step={0.05} value={movementSpeed}
                  onChange={(e) => { setMovementSpeed(parseFloat(e.target.value)); bumpCoach('speed'); }}
                  className="slider w-full mt-2" />
              </div>
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">FOLLOW_RANGE</span>
                  <span className="text-lime-300 font-bold">{followRange} blocks</span>
                </label>
                <input type="range" min={4} max={48} step={2} value={followRange}
                  onChange={(e) => { setFollowRange(parseInt(e.target.value)); bumpCoach('speed'); }}
                  className="slider w-full mt-2" />
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">04</span>
              <span className="font-bold text-sm">AI Behavior</span>
              <span className="mono text-[10px] text-slate-500">→ registerGoals()</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(AI_LABELS) as AIKey[]).map((k) => (
                <button key={k} onClick={() => { setAi(k); bumpCoach('ai'); addXp(10); }}
                  className={`p-3 rounded-md border text-left transition ${ai === k ? 'border-rose-400 bg-rose-400/10' : 'border-slate-800 hover:border-rose-400/50 bg-slate-950'}`}>
                  <div className="mono text-xs text-rose-300 font-bold mb-0.5">{AI_LABELS[k].label}</div>
                  <div className="mono text-[9px] text-slate-500 leading-tight">{AI_LABELS[k].description}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={fireTest} disabled={spawning}
            className="mt-1 w-full bg-rose-500 hover:bg-rose-400 text-slate-950 mono font-black text-sm py-3.5 rounded-md transition-transform active:scale-[.98] disabled:opacity-60 tracking-widest">
            ▶  RUN  ·  SPAWN  ·  TEST
          </button>
        </section>

        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
            <div className="mono text-[9px] text-slate-500 mb-2 tracking-widest">LIVE PREVIEW</div>
            <div className="rounded-md overflow-hidden border border-slate-800 h-44 flex items-center justify-center relative" style={{ background: skinMeta.bg }}>
              <span className={`text-7xl ${spawning ? 'mob-walk' : 'mob-idle'} drop-shadow-2xl`}>{skinMeta.emoji}</span>
              <div className="absolute top-2 left-2 mono text-[10px] text-white/70">HP {maxHealth}/{maxHealth}</div>
              <div className="absolute top-2 right-2 mono text-[10px] text-white/70">DMG {attackDamage}</div>
              <div className="absolute bottom-2 left-2 mono text-[10px] text-rose-300">{AI_LABELS[ai].label.toUpperCase()}</div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-3 border border-slate-800 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[9px] text-rose-300 tracking-widest">{clsName}Entity.java</div>
              <div className="mono text-[9px] text-slate-500">JAVA · GENERATED</div>
            </div>
            <pre className="bg-slate-950 rounded-md p-3 text-[11px] mono leading-[1.55] overflow-x-auto max-h-[520px] border border-slate-800">
              <code>
                {javaCode.split('\n').map((line, i) => {
                  const colored = line
                    .replace(/(\/\/.*)/g, '<span class="cm">$1</span>')
                    .replace(/\b(package|import|public|private|protected|class|extends|new|this|super|static|return|void|true|false)\b/g, '<span class="kw">$1</span>')
                    .replace(/\b(EntityType|Mob|Monster|Player|Level|AttributeSupplier|Attributes|MeleeAttackGoal|RandomStrollGoal|LookAtPlayerGoal|HurtByTargetGoal|NearestAttackableTargetGoal|MoveTowardsTargetGoal|PanicGoal|String|int|double|boolean|float)\b/g, '<span class="ty">$1</span>')
                    .replace(/\b(\d+(?:\.\d+[DdFf]?)?)\b/g, '<span class="nb">$1</span>')
                    .replace(/\b(MAX_HEALTH|ATTACK_DAMAGE|MOVEMENT_SPEED|FOLLOW_RANGE|@Override)\b/g, '<span class="an">$1</span>');
                  return <span key={i} className="code-line" data-n={String(i + 1).padStart(2, ' ')} dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} />;
                })}
              </code>
            </pre>
            <div className="mono text-[10px] text-slate-500 mt-2">
              Builder pattern : chaque <span className="text-cyan-300">.add(...)</span> retourne le builder. Tu chain les calls. Idiom Java courant.
            </div>
          </div>
        </aside>
      </div>

      <footer className="fixed bottom-0 inset-x-0 z-20 bg-slate-900/95 backdrop-blur border-t border-fuchsia-500/30 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <div className="w-11 h-11 rounded-md bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center text-2xl flex-shrink-0">💪</div>
        <div className="flex-1 min-w-0">
          <div className="mono text-[10px] text-fuchsia-400 tracking-widest">COACH K</div>
          <div className="text-sm text-slate-100 leading-snug">{COACH_LINES[coachKey]}</div>
        </div>
        <button onClick={() => { const next = (hintIdx + 1) % hintKeys.length; setHintIdx(next); bumpCoach(hintKeys[next]); }}
          className="bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 mono font-bold px-3 py-2 rounded-md text-xs">
          HINT →
        </button>
      </footer>

      {showWin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-400/60 rounded-lg p-7 max-w-md shadow-2xl shadow-rose-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-md bg-rose-400/10 border border-rose-400/60 flex items-center justify-center text-2xl text-rose-300">🐺</div>
              <div>
                <div className="mono text-[10px] text-rose-300 tracking-widest">MISSION 03 · SHIPPED</div>
                <div className="text-xl font-bold">Beast Master unlocked</div>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4 text-sm text-slate-300">
              <span className="mono text-rose-300">{mobName}</span> · {AI_LABELS[ai].label} · {maxHealth} HP. Au camp tu vas coder des mobs avec animations + sons + drops.
            </div>
            <div className="flex items-center gap-3 mono text-xs mb-5">
              <span className="text-rose-300">+80 XP</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">🏆 Badge Beast Master</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/apps/educatif/')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 mono font-black py-2.5 rounded-md text-sm">→ HUB</button>
              <button onClick={() => router.push('/apps/educatif/mcreator/mission-4-procedure/')} className="flex-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 mono font-black py-2.5 rounded-md text-sm">M04 →</button>
              <button onClick={() => setShowWin(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 mono text-xs px-3 rounded-md">REDO</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
