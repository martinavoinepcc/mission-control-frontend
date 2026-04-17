'use client';

// MCreator Academy — Mission #2 : Item (épée custom)
// Concept Java : héritage (extends SwordItem), enum Tier, constructeur super(...).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type TierKey = 'WOOD' | 'STONE' | 'IRON' | 'DIAMOND' | 'NETHERITE';

const TIERS: Record<TierKey, {
  label: string; emoji: string; color: string; baseDamage: number; durability: number; speed: number; enchantability: number;
}> = {
  WOOD:      { label: 'Wood',      emoji: '🟫', color: '#8b5a2b', baseDamage: 4,  durability: 59,   speed: 1.6, enchantability: 15 },
  STONE:     { label: 'Stone',     emoji: '🪨', color: '#9ca3af', baseDamage: 5,  durability: 131,  speed: 1.6, enchantability: 5  },
  IRON:      { label: 'Iron',      emoji: '⬜', color: '#d4d4d8', baseDamage: 6,  durability: 250,  speed: 1.6, enchantability: 14 },
  DIAMOND:   { label: 'Diamond',   emoji: '💎', color: '#5dd1ff', baseDamage: 7,  durability: 1561, speed: 1.6, enchantability: 10 },
  NETHERITE: { label: 'Netherite', emoji: '🟪', color: '#3f3a3a', baseDamage: 8,  durability: 2031, speed: 1.6, enchantability: 15 },
};

const COACH_LINES: Record<string, string> = {
  intro: "Mission #2 unlocked. Tu vas build un Item — une épée custom. Concepts Java level up : héritage + enum.",
  name:  "Le name devient ton Item.Properties().getDescriptionId(). Brand it.",
  tier:  "Le Tier c'est un enum Java — wood/stone/iron/diamond/netherite. Chaque tier a ses stats baked in. Tu peux extend ou override.",
  damage: "Damage modifier. Le constructeur SwordItem(Tier, int damage, float speed, Properties) prend ce nombre direct.",
  speed: "Attack speed = 1.6 par défaut. Plus = plus de hits/sec. Override via attribute modifier.",
  ench:  "Enchantability = combien la table d'enchantement aime ton item. Diamond=10, Netherite=15.",
  test:  "Swing la lame. Watch le damage popper.",
  win:   "BIG SHIP. Premier item legit. Au camp tu vas en build des dizaines : armures, outils, totems, potions custom.",
};

export default function MCreatorMission2Page() {
  const router = useRouter();
  const [itemName, setItemName] = useState('Lame de Cookie');
  const [tier, setTier] = useState<TierKey>('IRON');
  const [bonusDamage, setBonusDamage] = useState(3);
  const [attackSpeed, setAttackSpeed] = useState(1.6);
  const [enchantability, setEnchantability] = useState(14);
  const [coachKey, setCoachKey] = useState('intro');
  const [xp, setXp] = useState(0);
  const [swinging, setSwinging] = useState(false);
  const [hitDmg, setHitDmg] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const hintKeys = useMemo(() => ['intro','name','tier','damage','speed','ench','test'], []);

  const bumpCoach = (k: string) => setCoachKey(k);
  const addXp = (n: number) => setXp((v) => v + n);

  const clsName = useMemo(
    () => (itemName || 'MonItem').replace(/[^a-zA-Z0-9]/g, '') || 'MonItem',
    [itemName]
  );

  const javaCode = useMemo(() => {
    const t = TIERS[tier];
    return [
      "package com.jackson.mod.item;",
      "",
      "import net.minecraft.world.item.SwordItem;",
      "import net.minecraft.world.item.Tier;",
      "import net.minecraft.world.item.Tiers;",
      "import net.minecraft.world.item.Item.Properties;",
      "import net.minecraft.world.item.Rarity;",
      "",
      `public class ${clsName}Sword extends SwordItem {`,
      "",
      `    public ${clsName}Sword() {`,
      `        super(`,
      `            Tiers.${tier},                    // tier enum (durability+speed+harvest)`,
      `            ${bonusDamage},                            // bonus damage par-dessus le tier`,
      `            ${attackSpeed.toFixed(1)}f,                          // attack speed (default 1.6f)`,
      "            new Properties()",
      `                .stacksTo(1)`,
      `                .rarity(Rarity.${tier === 'NETHERITE' ? 'EPIC' : tier === 'DIAMOND' ? 'RARE' : 'COMMON'})`,
      "        );",
      "    }",
      "",
      "    // Total damage en jeu = Tier.getAttackDamageBonus() + bonusDamage + 1",
      `    // = ${TIERS[tier].baseDamage} + ${bonusDamage} + 1 = ${TIERS[tier].baseDamage + bonusDamage + 1} dmg/hit`,
      "}",
    ].join('\n');
  }, [clsName, tier, bonusDamage, attackSpeed]);

  function fireTest() {
    setSwinging(true);
    bumpCoach('test');
    const total = TIERS[tier].baseDamage + bonusDamage + 1;
    setHitDmg(total);
    setTimeout(() => {
      setSwinging(false);
      setHitDmg(null);
      bumpCoach('win');
      addXp(70);
      setShowWin(true);
    }, 2000);
  }

  const tierMeta = TIERS[tier];
  const totalDamage = tierMeta.baseDamage + bonusDamage + 1;

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: `
        .mono { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
        .grid-bg { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0); background-size: 22px 22px; }
        .sword-anim { transition: transform .25s cubic-bezier(.4,1.6,.6,1); transform-origin: 50% 90%; }
        .sword-anim.swing { animation: swordSwing .8s ease-out; }
        @keyframes swordSwing {
          0%   { transform: rotate(-15deg); }
          30%  { transform: rotate(-90deg); }
          70%  { transform: rotate(60deg) scale(1.1); }
          100% { transform: rotate(-15deg); }
        }
        @keyframes dmgPop {
          0%   { opacity: 0; transform: translateY(0) scale(.5); }
          15%  { opacity: 1; transform: translateY(-30px) scale(1.3); }
          100% { opacity: 0; transform: translateY(-100px) scale(1); }
        }
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
      ` }} />

      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <header className="relative z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <button onClick={() => router.push('/apps/educatif/')} className="text-slate-400 hover:text-lime-300 text-sm transition">← Hub</button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-fuchsia-400/10 border border-fuchsia-400/40 rounded-md flex items-center justify-center text-lg text-fuchsia-300 mono font-black">02</div>
          <div>
            <div className="mono text-[9px] text-fuchsia-300/80 tracking-widest">MCREATOR ACADEMY · MISSION 02</div>
            <div className="text-base sm:text-lg font-bold">Item · <span className="text-fuchsia-300">épée custom</span></div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="mono text-xs px-3 py-1.5 rounded-md bg-fuchsia-400/10 border border-fuchsia-400/40 text-fuchsia-300">XP <span className="font-black">{xp}</span></div>
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
        {/* PALETTE */}
        <aside className="lg:col-span-2 bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
          <div className="mono text-[9px] text-slate-500 mb-3 tracking-widest">MOD ELEMENTS</div>
          <div className="space-y-2">
            <button onClick={() => router.push('/apps/educatif/mcreator/mission-1-bloc-cookie/')} className="w-full text-left p-3 bg-slate-800/40 border border-lime-400/30 rounded-md flex items-center gap-2 hover:bg-lime-400/10">
              <span className="text-lg">🟩</span>
              <div>
                <div className="font-bold text-sm text-lime-300">Block</div>
                <div className="mono text-[9px] text-lime-400/60">✓ DONE</div>
              </div>
            </button>
            <button className="w-full text-left p-3 bg-fuchsia-400/10 border border-fuchsia-400/50 rounded-md flex items-center gap-2">
              <span className="text-lg">⚔️</span>
              <div>
                <div className="font-bold text-sm text-fuchsia-300">Item</div>
                <div className="mono text-[9px] text-fuchsia-400/60">ACTIVE</div>
              </div>
            </button>
            {[['🐺','Mob','M03'],['⚙️','Procedure','M04'],['🔨','Recipe','M05']].map(([emo,lbl,tag]) => (
              <button key={lbl} disabled className="w-full text-left p-3 bg-slate-800/40 border border-slate-800 rounded-md flex items-center gap-2 opacity-50">
                <span className="text-lg">{emo}</span>
                <div>
                  <div className="font-bold text-sm text-slate-300">{lbl}</div>
                  <div className="mono text-[9px] text-slate-500">🔒 {tag}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* WORKSPACE */}
        <section className="lg:col-span-6 bg-slate-900/60 backdrop-blur rounded-lg p-4 sm:p-6 border border-slate-800 flex flex-col gap-4">
          <div>
            <div className="mono text-[9px] text-fuchsia-400/80 tracking-widest mb-1">ITEM PROPERTIES</div>
            <div className="text-xl sm:text-2xl font-bold">Forge ton épée</div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-[10px] text-fuchsia-300 bg-fuchsia-400/10 border border-fuchsia-400/40 rounded px-2 py-0.5">01</span>
              <span className="font-bold text-sm">Item name</span>
              <span className="mono text-[10px] text-slate-500">→ String</span>
            </div>
            <input value={itemName} maxLength={26} onChange={(e) => { setItemName(e.target.value); bumpCoach('name'); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 mono text-sm text-fuchsia-300 focus:border-fuchsia-400 focus:outline-none" />
            <div className="mono text-[10px] text-slate-500 mt-1.5">→ classe Java : <span className="text-fuchsia-400">{clsName}Sword</span></div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">02</span>
              <span className="font-bold text-sm">Tier</span>
              <span className="mono text-[10px] text-slate-500">→ enum Tiers.{tier}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(TIERS) as TierKey[]).map((k) => (
                <button key={k} onClick={() => { setTier(k); bumpCoach('tier'); addXp(8); }}
                  className={`px-2 py-3 rounded-md border text-center transition ${tier === k ? 'border-fuchsia-400 bg-fuchsia-400/10' : 'border-slate-800 hover:border-fuchsia-400/50 bg-slate-950'}`}>
                  <div className="text-2xl mb-1">{TIERS[k].emoji}</div>
                  <div className="mono text-[10px] text-slate-300">{TIERS[k].label}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 mono text-[10px] text-slate-500 mt-3 gap-1 px-1">
              <div><span className="text-slate-400">base dmg</span> <span className="text-fuchsia-300">{tierMeta.baseDamage}</span></div>
              <div><span className="text-slate-400">durab</span> <span className="text-fuchsia-300">{tierMeta.durability}</span></div>
              <div><span className="text-slate-400">speed</span> <span className="text-fuchsia-300">{tierMeta.speed}</span></div>
              <div><span className="text-slate-400">ench</span> <span className="text-fuchsia-300">{tierMeta.enchantability}</span></div>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">03</span>
              <span className="font-bold text-sm">Stats override</span>
              <span className="mono text-[10px] text-slate-500">→ super(...)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">bonusDamage</span>
                  <span className="text-fuchsia-300 font-bold">+{bonusDamage}</span>
                </label>
                <input type="range" min={0} max={10} step={1} value={bonusDamage}
                  onChange={(e) => { setBonusDamage(parseInt(e.target.value)); bumpCoach('damage'); }}
                  className="slider w-full mt-2" />
              </div>
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">attackSpeed</span>
                  <span className="text-amber-300 font-bold">{attackSpeed.toFixed(1)}f</span>
                </label>
                <input type="range" min={0.5} max={3.5} step={0.1} value={attackSpeed}
                  onChange={(e) => { setAttackSpeed(parseFloat(e.target.value)); bumpCoach('speed'); }}
                  className="slider w-full mt-2" />
              </div>
              <div>
                <label className="flex justify-between items-center mono text-xs">
                  <span className="text-slate-400">enchantability</span>
                  <span className="text-cyan-300 font-bold">{enchantability}</span>
                </label>
                <input type="range" min={0} max={30} step={1} value={enchantability}
                  onChange={(e) => { setEnchantability(parseInt(e.target.value)); bumpCoach('ench'); }}
                  className="slider w-full mt-2" />
              </div>
            </div>
          </div>

          <button onClick={fireTest} disabled={swinging}
            className="mt-1 w-full bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 mono font-black text-sm py-3.5 rounded-md transition-transform active:scale-[.98] disabled:opacity-60 tracking-widest">
            ▶  RUN  ·  SWING  ·  TEST
          </button>
        </section>

        {/* PREVIEW + JAVA */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
            <div className="mono text-[9px] text-slate-500 mb-2 tracking-widest">LIVE PREVIEW</div>
            <div className="rounded-md overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-800 to-slate-900 h-48 flex items-center justify-center relative">
              {/* Sword pixel art SVG */}
              <svg viewBox="0 0 24 24" width="120" height="120" className={`sword-anim ${swinging ? 'swing' : ''}`}>
                <rect x="11" y="2" width="2" height="14" fill={tierMeta.color} stroke="#000" strokeWidth=".4" />
                <rect x="10" y="3" width="4" height="12" fill={tierMeta.color} stroke="none" opacity=".8" />
                <rect x="9"  y="14" width="6" height="2" fill="#5a3517" stroke="#000" strokeWidth=".4" />
                <rect x="11" y="16" width="2" height="6" fill="#3b2516" stroke="#000" strokeWidth=".4" />
                <rect x="11" y="2" width="2" height="2" fill="#fff" opacity=".4" />
              </svg>
              {hitDmg !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="mono font-black text-3xl text-rose-400" style={{ animation: 'dmgPop 1.6s ease-out forwards' }}>-{hitDmg}</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 mono text-[10px] text-slate-400">total dmg/hit</div>
              <div className="absolute bottom-2 right-2 mono text-lg font-black text-fuchsia-300">{totalDamage}</div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-3 border border-slate-800 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[9px] text-fuchsia-300 tracking-widest">{clsName}Sword.java</div>
              <div className="mono text-[9px] text-slate-500">JAVA · GENERATED</div>
            </div>
            <pre className="bg-slate-950 rounded-md p-3 text-[11px] mono leading-[1.55] overflow-x-auto max-h-[480px] border border-slate-800">
              <code>
                {javaCode.split('\n').map((line, i) => {
                  const colored = line
                    .replace(/(\/\/.*)/g, '<span class="cm">$1</span>')
                    .replace(/\b(package|import|public|private|class|extends|new|this|super|static|final)\b/g, '<span class="kw">$1</span>')
                    .replace(/\b(SwordItem|Tier|Tiers|Item|Properties|Rarity|String|int|float|double|boolean)\b/g, '<span class="ty">$1</span>')
                    .replace(/\b(\d+(?:\.\d+f?)?)\b/g, '<span class="nb">$1</span>')
                    .replace(/\b(WOOD|STONE|IRON|DIAMOND|NETHERITE|EPIC|RARE|COMMON|UNCOMMON)\b/g, '<span class="an">$1</span>');
                  return <span key={i} className="code-line" data-n={String(i + 1).padStart(2, ' ')} dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} />;
                })}
              </code>
            </pre>
            <div className="mono text-[10px] text-slate-500 mt-2">
              <span className="text-fuchsia-300">extends SwordItem</span> = héritage Java. Tu hérites de toute la logique d'attaque vanilla, t'override juste les stats via le constructor.
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
          <div className="bg-slate-900 border border-fuchsia-400/60 rounded-lg p-7 max-w-md shadow-2xl shadow-fuchsia-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-md bg-fuchsia-400/10 border border-fuchsia-400/60 flex items-center justify-center text-2xl text-fuchsia-300">⚔</div>
              <div>
                <div className="mono text-[10px] text-fuchsia-300 tracking-widest">MISSION 02 · SHIPPED</div>
                <div className="text-xl font-bold">Forgeron unlocked</div>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4 text-sm text-slate-300">
              <span className="mono text-fuchsia-300">{itemName}</span> · tier {tierMeta.label} · {totalDamage} dmg/hit. Au camp tu vas ship des outils, armures, potions, totems custom.
            </div>
            <div className="flex items-center gap-3 mono text-xs mb-5">
              <span className="text-fuchsia-300">+70 XP</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">🏆 Badge Forgeron</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/apps/educatif/')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 mono font-black py-2.5 rounded-md text-sm">→ HUB</button>
              <button onClick={() => router.push('/apps/educatif/mcreator/mission-3-mob-custom/')} className="flex-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 mono font-black py-2.5 rounded-md text-sm">M03 →</button>
              <button onClick={() => setShowWin(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 mono text-xs px-3 rounded-md">REDO</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
