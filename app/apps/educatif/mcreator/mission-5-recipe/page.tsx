'use client';

// MCreator Academy — Mission #5 : Recipe (crafting)
// Concepts : Builder pattern (ShapedRecipeBuilder), pattern-matching String,
// Ingredient.of, JSON recipe data file, RecipeProvider.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type IngKey = '_' | 'D' | 'I' | 'G' | 'S' | 'R' | 'O' | 'B' | 'C';
const INGREDIENTS: Record<IngKey, { name: string; emoji: string; java: string; tag: string }> = {
  '_': { name: 'empty',      emoji: '·',  java: 'Ingredient.EMPTY',                tag: ' ' },
  'D': { name: 'Diamond',    emoji: '💎', java: 'Ingredient.of(Items.DIAMOND)',    tag: 'D' },
  'I': { name: 'Iron Ingot', emoji: '⬜', java: 'Ingredient.of(Items.IRON_INGOT)', tag: 'I' },
  'G': { name: 'Gold Ingot', emoji: '🟨', java: 'Ingredient.of(Items.GOLD_INGOT)', tag: 'G' },
  'S': { name: 'Stick',      emoji: '🟤', java: 'Ingredient.of(Items.STICK)',      tag: 'S' },
  'R': { name: 'Redstone',   emoji: '🔴', java: 'Ingredient.of(Items.REDSTONE)',   tag: 'R' },
  'O': { name: 'Obsidian',   emoji: '⬛', java: 'Ingredient.of(Items.OBSIDIAN)',   tag: 'O' },
  'B': { name: 'Blaze Rod',  emoji: '🟧', java: 'Ingredient.of(Items.BLAZE_ROD)',  tag: 'B' },
  'C': { name: 'Cookie',     emoji: '🍪', java: 'Ingredient.of(Items.COOKIE)',     tag: 'C' },
};

type OutputKey = 'NETHERITE_SWORD' | 'BEACON' | 'ENCHANTED_GOLDEN_APPLE' | 'TRIDENT' | 'TOTEM';
const OUTPUTS: Record<OutputKey, { name: string; emoji: string; java: string }> = {
  NETHERITE_SWORD:        { name: 'Netherite Sword',         emoji: '🗡️', java: 'Items.NETHERITE_SWORD' },
  BEACON:                 { name: 'Beacon',                  emoji: '💠', java: 'Items.BEACON' },
  ENCHANTED_GOLDEN_APPLE: { name: 'Enchanted Golden Apple',  emoji: '🍎', java: 'Items.ENCHANTED_GOLDEN_APPLE' },
  TRIDENT:                { name: 'Trident',                 emoji: '🔱', java: 'Items.TRIDENT' },
  TOTEM:                  { name: 'Totem of Undying',        emoji: '🛡️', java: 'Items.TOTEM_OF_UNDYING' },
};

const COACH_LINES: Record<string, string> = {
  intro: "Mission finale : Recipe. Ici on touche aux Builder patterns + JSON data files. C'est meta : ton code Java écrit du JSON que Minecraft parse au runtime.",
  grid:  "Drag an ingredient → click sur une cell. Pattern Minecraft : 3 strings de 3 chars. Chaque char = un ingredient slot.",
  output: "L'output = ce que la recipe crée. Quantity = combien tu en obtiens par craft.",
  count: "Le count multiplie. Crafting = 1, mais une recipe peut produire 4 stairs ou 8 walls.",
  test:  "Triggere le craft. Watch le pattern matcher.",
  win:   "FINALE SHIPPED. Tu maîtrises les 5 element types MCreator. Tu rentres au camp Studio XP avec une avance de senior. Let's GO.",
};

export default function MCreatorMission5Page() {
  const router = useRouter();
  const [recipeName, setRecipeName] = useState('cookie_sword_recipe');
  const [grid, setGrid] = useState<IngKey[]>(['D','D','D', '_','S','_', '_','S','_']);
  const [output, setOutput] = useState<OutputKey>('NETHERITE_SWORD');
  const [count, setCount] = useState(1);
  const [activeIng, setActiveIng] = useState<IngKey>('D');
  const [coachKey, setCoachKey] = useState('intro');
  const [xp, setXp] = useState(0);
  const [crafting, setCrafting] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const hintKeys = useMemo(() => ['intro','grid','output','count','test'], []);

  const bumpCoach = (k: string) => setCoachKey(k);
  const addXp = (n: number) => setXp((v) => v + n);

  function placeCell(i: number) {
    setGrid((g) => g.map((c, idx) => idx === i ? activeIng : c));
    bumpCoach('grid'); addXp(3);
  }

  // Compute pattern (3 strings of 3 chars) + the unique definitions used
  const recipe = useMemo(() => {
    const pattern = [
      grid.slice(0,3).map((k) => INGREDIENTS[k].tag).join(''),
      grid.slice(3,6).map((k) => INGREDIENTS[k].tag).join(''),
      grid.slice(6,9).map((k) => INGREDIENTS[k].tag).join(''),
    ];
    const usedTags = new Set(grid.filter((k) => k !== '_').map((k) => INGREDIENTS[k].tag));
    return { pattern, usedTags: Array.from(usedTags) };
  }, [grid]);

  const javaCode = useMemo(() => {
    const out = OUTPUTS[output];
    const defines = recipe.usedTags.map((tag) => {
      const ingKey = (Object.keys(INGREDIENTS) as IngKey[]).find((k) => INGREDIENTS[k].tag === tag);
      const ing = INGREDIENTS[ingKey || '_'];
      return `            .define('${tag}', ${ing.java})`;
    });

    return [
      "package com.jackson.mod.recipe;",
      "",
      "import net.minecraft.data.recipes.FinishedRecipe;",
      "import net.minecraft.data.recipes.RecipeProvider;",
      "import net.minecraft.data.recipes.ShapedRecipeBuilder;",
      "import net.minecraft.world.item.crafting.Ingredient;",
      "import net.minecraft.world.item.crafting.RecipeCategory;",
      "import net.minecraft.world.item.Items;",
      "import java.util.function.Consumer;",
      "",
      "public class Recipes extends RecipeProvider {",
      "",
      "    @Override",
      "    protected void buildRecipes(Consumer<FinishedRecipe> writer) {",
      `        ShapedRecipeBuilder.shaped(RecipeCategory.COMBAT, ${out.java}, ${count})`,
      `            .pattern("${recipe.pattern[0]}")`,
      `            .pattern("${recipe.pattern[1]}")`,
      `            .pattern("${recipe.pattern[2]}")`,
      ...defines,
      "            .unlockedBy(\"has_diamond\", has(Items.DIAMOND))",
      `            .save(writer, "${recipeName}");`,
      "    }",
      "}",
    ].join('\n');
  }, [recipe, output, count, recipeName]);

  const jsonRecipe = useMemo(() => {
    const out = OUTPUTS[output];
    const keys: Record<string, { item: string }> = {};
    recipe.usedTags.forEach((tag) => {
      const ingKey = (Object.keys(INGREDIENTS) as IngKey[]).find((k) => INGREDIENTS[k].tag === tag);
      if (ingKey && ingKey !== '_') {
        keys[tag] = { item: 'minecraft:' + INGREDIENTS[ingKey].name.toLowerCase().replace(' ', '_') };
      }
    });
    return JSON.stringify({
      type: 'minecraft:crafting_shaped',
      pattern: recipe.pattern,
      key: keys,
      result: { item: 'minecraft:' + out.name.toLowerCase().replace(/ /g, '_'), count },
    }, null, 2);
  }, [recipe, output, count]);

  function fireTest() {
    setCrafting(true);
    bumpCoach('test');
    setTimeout(() => {
      setCrafting(false);
      bumpCoach('win');
      addXp(100);
      setShowWin(true);
    }, 2000);
  }

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: `
        .mono { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
        .grid-bg { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0); background-size: 22px 22px; }
        @keyframes craftGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,.6); }
          50%      { box-shadow: 0 0 0 16px rgba(251,191,36,0); }
        }
        .crafting { animation: craftGlow 1s ease-in-out 2; }
        input[type=range].slider { -webkit-appearance: none; appearance: none; height: 6px; background: #1e293b; border-radius: 999px; outline: none; }
        input[type=range].slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background: #fbbf24; border-radius: 50%; cursor: pointer; border: 2px solid #0f172a; box-shadow: 0 0 10px rgba(251,191,36,.6); }
        input[type=range].slider::-moz-range-thumb { width: 20px; height: 20px; background: #fbbf24; border-radius: 50%; cursor: pointer; border: 2px solid #0f172a; }
        .code-line { display: block; padding-left: 2.5rem; position: relative; min-height: 1.1em; }
        .code-line::before { content: attr(data-n); position: absolute; left: 0; width: 2rem; text-align: right; color: #475569; padding-right: .5rem; }
        .kw { color: #c084fc; }
        .ty { color: #38bdf8; }
        .nb { color: #f97316; }
        .st { color: #fde047; }
        .an { color: #f472b6; }
        .cm { color: #64748b; font-style: italic; }
      ` }} />

      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <header className="relative z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <button onClick={() => router.push('/apps/educatif/')} className="text-slate-400 hover:text-lime-300 text-sm">← Hub</button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-400/10 border border-amber-400/40 rounded-md flex items-center justify-center text-lg text-amber-300 mono font-black">05</div>
          <div>
            <div className="mono text-[9px] text-amber-300/80 tracking-widest">MCREATOR ACADEMY · MISSION 05 · FINALE</div>
            <div className="text-base sm:text-lg font-bold">Recipe · <span className="text-amber-300">crafting custom</span></div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="mono text-xs px-3 py-1.5 rounded-md bg-amber-400/10 border border-amber-400/40 text-amber-300">XP <span className="font-black">{xp}</span></div>
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
            <button onClick={() => router.push('/apps/educatif/mcreator/mission-3-mob-custom/')} className="w-full text-left p-3 bg-slate-800/40 border border-rose-400/30 rounded-md flex items-center gap-2 hover:bg-rose-400/10">
              <span className="text-lg">🐺</span>
              <div><div className="font-bold text-sm text-rose-300">Mob</div><div className="mono text-[9px] text-rose-400/60">✓ DONE</div></div>
            </button>
            <button onClick={() => router.push('/apps/educatif/mcreator/mission-4-procedure/')} className="w-full text-left p-3 bg-slate-800/40 border border-cyan-400/30 rounded-md flex items-center gap-2 hover:bg-cyan-400/10">
              <span className="text-lg">⚙️</span>
              <div><div className="font-bold text-sm text-cyan-300">Procedure</div><div className="mono text-[9px] text-cyan-400/60">✓ DONE</div></div>
            </button>
            <button className="w-full text-left p-3 bg-amber-400/10 border border-amber-400/50 rounded-md flex items-center gap-2">
              <span className="text-lg">🔨</span>
              <div><div className="font-bold text-sm text-amber-300">Recipe</div><div className="mono text-[9px] text-amber-400/60">ACTIVE · FINALE</div></div>
            </button>
          </div>
        </aside>

        <section className="lg:col-span-6 bg-slate-900/60 backdrop-blur rounded-lg p-4 sm:p-6 border border-slate-800 flex flex-col gap-4">
          <div>
            <div className="mono text-[9px] text-amber-400/80 tracking-widest mb-1">SHAPED RECIPE</div>
            <div className="text-xl sm:text-2xl font-bold">Forge ta recette</div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/40 rounded px-2 py-0.5">01</span>
              <span className="font-bold text-sm">Recipe id</span>
              <span className="mono text-[10px] text-slate-500">→ ResourceLocation</span>
            </div>
            <input value={recipeName} maxLength={32} onChange={(e) => setRecipeName(e.target.value.replace(/\s/g, '_').toLowerCase())}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 mono text-sm text-amber-300 focus:border-amber-400 focus:outline-none" />
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">02</span>
              <span className="font-bold text-sm">Ingredients palette</span>
              <span className="mono text-[10px] text-slate-500">→ click puis place dans la grille</span>
            </div>
            <div className="grid grid-cols-9 gap-1.5">
              {(Object.keys(INGREDIENTS) as IngKey[]).map((k) => (
                <button key={k} onClick={() => setActiveIng(k)}
                  className={`aspect-square rounded-md border text-2xl transition flex items-center justify-center ${activeIng === k ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-950 hover:border-amber-400/40'}`}
                  title={INGREDIENTS[k].name}>
                  {INGREDIENTS[k].emoji}
                </button>
              ))}
            </div>
            <div className="mono text-[10px] text-slate-500 mt-2">selected : <span className="text-amber-300">{INGREDIENTS[activeIng].name}</span> → <span className="text-cyan-300">{INGREDIENTS[activeIng].java}</span></div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">03</span>
              <span className="font-bold text-sm">Crafting grid 3×3</span>
              <span className="mono text-[10px] text-slate-500">→ pattern strings</span>
            </div>
            <div className="flex items-center gap-4">
              <div className={`grid grid-cols-3 gap-1.5 p-3 bg-amber-900/20 rounded-md border-2 border-amber-500/30 ${crafting ? 'crafting' : ''}`}>
                {grid.map((cell, i) => (
                  <button key={i} onClick={() => placeCell(i)}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-md border-2 border-amber-700/40 bg-slate-900 text-3xl sm:text-4xl hover:bg-amber-900/30 hover:border-amber-400 transition flex items-center justify-center">
                    {cell === '_' ? '' : INGREDIENTS[cell].emoji}
                  </button>
                ))}
              </div>
              <div className="text-3xl text-amber-400">→</div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-md border-2 border-amber-500/60 bg-amber-500/10 text-4xl sm:text-5xl flex items-center justify-center">{OUTPUTS[output].emoji}</div>
                <div className="mono text-[10px] text-amber-300 mt-1">x{count}</div>
              </div>
            </div>
            <div className="mt-3 mono text-[10px] text-slate-500">pattern : <span className="text-amber-300">["{recipe.pattern[0]}", "{recipe.pattern[1]}", "{recipe.pattern[2]}"]</span></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">04</span>
                <span className="font-bold text-sm">Output item</span>
              </div>
              <select value={output} onChange={(e) => { setOutput(e.target.value as OutputKey); bumpCoach('output'); addXp(8); }}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 mono text-xs text-amber-300 focus:border-amber-400 focus:outline-none">
                {(Object.keys(OUTPUTS) as OutputKey[]).map((k) => <option key={k} value={k}>{OUTPUTS[k].emoji} {OUTPUTS[k].name}</option>)}
              </select>
            </div>
            <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="mono text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5">05</span>
                <span className="font-bold text-sm">Count</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={64} step={1} value={count}
                  onChange={(e) => { setCount(parseInt(e.target.value)); bumpCoach('count'); }}
                  className="slider flex-1" />
                <span className="mono text-amber-300 font-bold text-lg">x{count}</span>
              </div>
            </div>
          </div>

          <button onClick={fireTest} disabled={crafting}
            className="mt-1 w-full bg-amber-400 hover:bg-amber-300 text-slate-950 mono font-black text-sm py-3.5 rounded-md transition-transform active:scale-[.98] disabled:opacity-60 tracking-widest">
            ▶  RUN  ·  CRAFT  ·  TEST
          </button>
        </section>

        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-3 border border-slate-800 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[9px] text-amber-300 tracking-widest">Recipes.java</div>
              <div className="mono text-[9px] text-slate-500">JAVA · GENERATED</div>
            </div>
            <pre className="bg-slate-950 rounded-md p-3 text-[11px] mono leading-[1.55] overflow-x-auto max-h-[360px] border border-slate-800">
              <code>
                {javaCode.split('\n').map((line, i) => {
                  const colored = line
                    .replace(/(\/\/.*)/g, '<span class="cm">$1</span>')
                    .replace(/("[^"]*")/g, '<span class="st">$1</span>')
                    .replace(/('[^']*')/g, '<span class="st">$1</span>')
                    .replace(/\b(package|import|public|private|protected|class|extends|new|this|super|static|return|void|true|false)\b/g, '<span class="kw">$1</span>')
                    .replace(/\b(ShapedRecipeBuilder|FinishedRecipe|RecipeProvider|RecipeCategory|Ingredient|Items|Consumer|String|int|float|boolean)\b/g, '<span class="ty">$1</span>')
                    .replace(/\b(\d+(?:\.\d+[FfDd]?)?)\b/g, '<span class="nb">$1</span>')
                    .replace(/(@Override)/g, '<span class="an">$1</span>');
                  return <span key={i} className="code-line" data-n={String(i + 1).padStart(2, ' ')} dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} />;
                })}
              </code>
            </pre>
          </div>

          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-3 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[9px] text-cyan-300 tracking-widest">{recipeName}.json</div>
              <div className="mono text-[9px] text-slate-500">JSON · DATAGEN</div>
            </div>
            <pre className="bg-slate-950 rounded-md p-3 text-[11px] mono leading-[1.55] overflow-x-auto max-h-[260px] border border-slate-800 text-slate-300">
              <code>{jsonRecipe}</code>
            </pre>
            <div className="mono text-[10px] text-slate-500 mt-2">Ton code Java <span className="text-cyan-300">.save(writer, ...)</span> écrit ce JSON dans <span className="text-amber-300">data/jacksonmod/recipes/</span>. Minecraft le lit au load.</div>
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
          <div className="bg-slate-900 border border-amber-400/60 rounded-lg p-7 max-w-md shadow-2xl shadow-amber-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-md bg-amber-400/10 border border-amber-400/60 flex items-center justify-center text-2xl text-amber-300">🏆</div>
              <div>
                <div className="mono text-[10px] text-amber-300 tracking-widest">FINALE · MCREATOR ACADEMY</div>
                <div className="text-xl font-bold">Camp Ready unlocked</div>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4 text-sm text-slate-300">
              Tu maîtrises les <span className="text-lime-300">5 element types</span> MCreator : Block, Item, Mob, Procedure, Recipe. T'as compris la base du Java moderne (héritage, builders, annotations, events). T'es prêt pour Studio XP.
            </div>
            <div className="flex flex-wrap items-center gap-2 mono text-xs mb-5">
              <span className="text-amber-300">+100 XP</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">🏆 Modder Senior</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/apps/educatif/')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 mono font-black py-2.5 rounded-md text-sm">→ HUB</button>
              <button onClick={() => setShowWin(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 mono text-xs px-3 rounded-md">REDO</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
