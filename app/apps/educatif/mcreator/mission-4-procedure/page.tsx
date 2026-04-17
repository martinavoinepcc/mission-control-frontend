'use client';

// MCreator Academy — Mission #4 : Procedure (event-driven Java)
// Concepts : @SubscribeEvent, conditions empilées (if/&&), actions séquentielles,
// méthodes statiques, paramètres, accès au world/player/entity.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type TriggerKey = 'PLAYER_TICK' | 'BLOCK_RIGHTCLICK' | 'ENTITY_DEATH' | 'PLAYER_HURT' | 'WORLD_TICK';
const TRIGGERS: Record<TriggerKey, { label: string; method: string; params: string; eventClass: string }> = {
  PLAYER_TICK:      { label: 'à chaque tick joueur',  method: 'onPlayerTick',     params: 'TickEvent.PlayerTickEvent event', eventClass: 'TickEvent.PlayerTickEvent' },
  BLOCK_RIGHTCLICK: { label: 'right-click sur block',  method: 'onBlockRightClick', params: 'PlayerInteractEvent.RightClickBlock event', eventClass: 'PlayerInteractEvent.RightClickBlock' },
  ENTITY_DEATH:     { label: 'mob meurt',              method: 'onEntityDeath',    params: 'LivingDeathEvent event', eventClass: 'LivingDeathEvent' },
  PLAYER_HURT:      { label: 'joueur prend dmg',       method: 'onPlayerHurt',     params: 'LivingHurtEvent event', eventClass: 'LivingHurtEvent' },
  WORLD_TICK:       { label: 'à chaque tick monde',    method: 'onWorldTick',      params: 'TickEvent.LevelTickEvent event', eventClass: 'TickEvent.LevelTickEvent' },
};

type CondKey = 'IS_NIGHT' | 'IS_RAINING' | 'PLAYER_ON_FIRE' | 'HOLDING_DIAMOND' | 'BELOW_HALF_HEALTH' | 'IN_WATER';
const CONDITIONS: Record<CondKey, { label: string; expr: (s: string) => string }> = {
  IS_NIGHT:          { label: 'il fait nuit',                expr: () => '!level.isDay()' },
  IS_RAINING:        { label: 'il pleut',                    expr: () => 'level.isRaining()' },
  PLAYER_ON_FIRE:    { label: 'joueur en feu',               expr: (s) => `${s}.isOnFire()` },
  HOLDING_DIAMOND:   { label: 'tient un diamond',            expr: (s) => `${s}.getMainHandItem().is(Items.DIAMOND)` },
  BELOW_HALF_HEALTH: { label: 'PV < 50%',                    expr: (s) => `${s}.getHealth() < ${s}.getMaxHealth() / 2.0F` },
  IN_WATER:          { label: 'dans l\u2019eau',             expr: (s) => `${s}.isInWater()` },
};

type ActKey = 'GIVE_SPEED' | 'SET_FIRE' | 'STRIKE_LIGHTNING' | 'DROP_DIAMOND' | 'HEAL_FULL' | 'TELEPORT_HOME';
const ACTIONS: Record<ActKey, { label: string; code: (s: string) => string }> = {
  GIVE_SPEED:       { label: 'SPEED III x10s',          code: (s) => `${s}.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SPEED, 200, 2));` },
  SET_FIRE:         { label: 'set ON FIRE 5s',          code: (s) => `${s}.setSecondsOnFire(5);` },
  STRIKE_LIGHTNING: { label: 'éclair sur le joueur',     code: (s) => `LightningBolt bolt = EntityType.LIGHTNING_BOLT.create(level);\n            bolt.moveTo(${s}.position()); level.addFreshEntity(bolt);` },
  DROP_DIAMOND:     { label: 'drop 1 diamond',          code: (s) => `level.addFreshEntity(new ItemEntity(level, ${s}.getX(), ${s}.getY()+1, ${s}.getZ(), new ItemStack(Items.DIAMOND)));` },
  HEAL_FULL:        { label: 'heal full HP',            code: (s) => `${s}.setHealth(${s}.getMaxHealth());` },
  TELEPORT_HOME:    { label: 'TP au spawn',              code: (s) => `BlockPos spawn = level.getSharedSpawnPos();\n            ${s}.teleportTo(spawn.getX(), spawn.getY(), spawn.getZ());` },
};

const COACH_LINES: Record<string, string> = {
  intro: "Mission #4 : Procedure. C'est ici que tu fais du VRAI code Java event-driven. @SubscribeEvent, méthodes statiques, conditions chainées avec &&. C'est exactement le pattern enterprise.",
  trigger: "Le trigger = le type d'event auquel ta méthode écoute. Forge te livre l'event en paramètre — tu lis dessus pour avoir player/entity/level.",
  cond:    "Chaque condition s'AND avec les autres. En Java c'est && (logical AND). Si une seule est false, on skip le body.",
  act:     "Les actions s'exécutent dans l'ordre. C'est juste du Java séquentiel — première ligne, deuxième ligne, etc.",
  test:    "Triggere ton event. Watch le code run.",
  win:     "MASSIVE. Tu viens de coder un event handler legit. C'est le pattern qu'on utilise dans Forge, Spring, Node EventEmitter — partout.",
};

export default function MCreatorMission4Page() {
  const router = useRouter();
  const [procName, setProcName] = useState('NightLightning');
  const [trigger, setTrigger] = useState<TriggerKey>('PLAYER_TICK');
  const [conds, setConds] = useState<CondKey[]>(['IS_NIGHT', 'IS_RAINING']);
  const [acts, setActs]   = useState<ActKey[]>(['STRIKE_LIGHTNING']);
  const [coachKey, setCoachKey] = useState('intro');
  const [xp, setXp] = useState(0);
  const [running, setRunning] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const hintKeys = useMemo(() => ['intro','trigger','cond','act','test'], []);

  const bumpCoach = (k: string) => setCoachKey(k);
  const addXp = (n: number) => setXp((v) => v + n);

  const clsName = useMemo(() => (procName || 'MaProc').replace(/[^a-zA-Z0-9]/g, '') || 'MaProc', [procName]);

  function toggleCond(k: CondKey) {
    setConds((arr) => arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k].slice(0, 3));
    bumpCoach('cond'); addXp(5);
  }
  function toggleAct(k: ActKey) {
    setActs((arr) => arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k].slice(0, 3));
    bumpCoach('act'); addXp(5);
  }

  const javaCode = useMemo(() => {
    const trig = TRIGGERS[trigger];
    // Pick subject : player or entity depending on trigger
    const subj = trigger === 'WORLD_TICK' ? 'level' : trigger === 'ENTITY_DEATH' ? 'entity' : 'player';
    const eventGet =
      trigger === 'PLAYER_TICK'      ? `Player ${subj} = event.player;` :
      trigger === 'BLOCK_RIGHTCLICK' ? `Player ${subj} = event.getEntity();` :
      trigger === 'ENTITY_DEATH'     ? `LivingEntity ${subj} = event.getEntity();` :
      trigger === 'PLAYER_HURT'      ? `LivingEntity ${subj} = event.getEntity();` :
                                       `Level ${subj} = event.level;`;
    const levelGet = subj === 'level' ? '' : `Level level = ${subj}.level();`;

    const condExpr = conds.length === 0
      ? 'true'
      : conds.map((c) => CONDITIONS[c].expr(subj)).join(' && ');

    const actLines = acts.length === 0
      ? ['// (aucune action — ajoute-en au moins une !)']
      : acts.map((a) => ACTIONS[a].code(subj));

    return [
      "package com.jackson.mod.procedure;",
      "",
      "import net.minecraft.world.entity.LivingEntity;",
      "import net.minecraft.world.entity.player.Player;",
      "import net.minecraft.world.entity.LightningBolt;",
      "import net.minecraft.world.entity.EntityType;",
      "import net.minecraft.world.entity.item.ItemEntity;",
      "import net.minecraft.world.item.ItemStack;",
      "import net.minecraft.world.item.Items;",
      "import net.minecraft.world.effect.MobEffectInstance;",
      "import net.minecraft.world.effect.MobEffects;",
      "import net.minecraft.world.level.Level;",
      "import net.minecraft.core.BlockPos;",
      "import net.minecraftforge.event.TickEvent;",
      "import net.minecraftforge.event.entity.living.*;",
      "import net.minecraftforge.event.entity.player.PlayerInteractEvent;",
      "import net.minecraftforge.eventbus.api.SubscribeEvent;",
      "import net.minecraftforge.fml.common.Mod;",
      "",
      `@Mod.EventBusSubscriber(modid = "jacksonmod")`,
      `public class ${clsName}Procedure {`,
      "",
      "    @SubscribeEvent",
      `    public static void ${trig.method}(${trig.params}) {`,
      `        ${eventGet}`,
      ...(levelGet ? [`        ${levelGet}`] : []),
      "",
      `        if (${condExpr}) {`,
      ...actLines.map((l) => `            ${l}`),
      "        }",
      "    }",
      "}",
    ].join('\n');
  }, [clsName, trigger, conds, acts]);

  function fireTest() {
    setRunning(true);
    bumpCoach('test');
    setTimeout(() => {
      setRunning(false);
      bumpCoach('win');
      addXp(90);
      setShowWin(true);
    }, 2000);
  }

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: `
        .mono { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
        .grid-bg { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0); background-size: 22px 22px; }
        @keyframes runPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56,189,248,.6); }
          50%      { box-shadow: 0 0 0 12px rgba(56,189,248,0); }
        }
        .running { animation: runPulse 1.4s ease-in-out infinite; }
        input[type=text] { -webkit-appearance: none; }
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
          <div className="w-10 h-10 bg-cyan-400/10 border border-cyan-400/40 rounded-md flex items-center justify-center text-lg text-cyan-300 mono font-black">04</div>
          <div>
            <div className="mono text-[9px] text-cyan-300/80 tracking-widest">MCREATOR ACADEMY · MISSION 04</div>
            <div className="text-base sm:text-lg font-bold">Procedure · <span className="text-cyan-300">event handler Java</span></div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="mono text-xs px-3 py-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/40 text-cyan-300">XP <span className="font-black">{xp}</span></div>
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
            <button className="w-full text-left p-3 bg-cyan-400/10 border border-cyan-400/50 rounded-md flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <div><div className="font-bold text-sm text-cyan-300">Procedure</div><div className="mono text-[9px] text-cyan-400/60">ACTIVE</div></div>
            </button>
            <button disabled className="w-full text-left p-3 bg-slate-800/40 border border-slate-800 rounded-md flex items-center gap-2 opacity-50">
              <span className="text-lg">🔨</span>
              <div><div className="font-bold text-sm text-slate-300">Recipe</div><div className="mono text-[9px] text-slate-500">🔒 M05</div></div>
            </button>
          </div>
        </aside>

        <section className="lg:col-span-6 bg-slate-900/60 backdrop-blur rounded-lg p-4 sm:p-6 border border-slate-800 flex flex-col gap-4">
          <div>
            <div className="mono text-[9px] text-cyan-400/80 tracking-widest mb-1">EVENT HANDLER</div>
            <div className="text-xl sm:text-2xl font-bold">Code ta procédure</div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-[10px] text-cyan-300 bg-cyan-400/10 border border-cyan-400/40 rounded px-2 py-0.5">01</span>
              <span className="font-bold text-sm">Procedure name</span>
              <span className="mono text-[10px] text-slate-500">→ ClassName Java</span>
            </div>
            <input value={procName} maxLength={26} onChange={(e) => { setProcName(e.target.value); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 mono text-sm text-cyan-300 focus:border-cyan-400 focus:outline-none" />
            <div className="mono text-[10px] text-slate-500 mt-1.5">→ classe Java : <span className="text-cyan-400">{clsName}Procedure</span></div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="mono text-[10px] text-fuchsia-300 bg-fuchsia-400/10 border border-fuchsia-400/40 rounded px-2 py-0.5">02</span>
              <span className="font-bold text-sm">WHEN — trigger event</span>
              <span className="mono text-[10px] text-slate-500">→ @SubscribeEvent</span>
            </div>
            <select value={trigger} onChange={(e) => { setTrigger(e.target.value as TriggerKey); bumpCoach('trigger'); addXp(8); }}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 mono text-sm text-fuchsia-300 focus:border-fuchsia-400 focus:outline-none">
              {(Object.keys(TRIGGERS) as TriggerKey[]).map((k) => <option key={k} value={k}>{TRIGGERS[k].label}</option>)}
            </select>
            <div className="mono text-[10px] text-slate-500 mt-1.5">event class : <span className="text-cyan-300">{TRIGGERS[trigger].eventClass}</span></div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/40 rounded px-2 py-0.5">03</span>
                <span className="font-bold text-sm">IF — conditions chainées</span>
                <span className="mono text-[10px] text-slate-500">→ if (a && b && c)</span>
              </div>
              <span className="mono text-[10px] text-slate-500">{conds.length}/3</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CONDITIONS) as CondKey[]).map((k) => {
                const active = conds.includes(k);
                return (
                  <button key={k} onClick={() => toggleCond(k)}
                    className={`px-3 py-2 rounded-md border text-left transition mono text-xs ${active ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-amber-400/40'}`}>
                    <span className="text-amber-400">{active ? '☑' : '☐'}</span> {CONDITIONS[k].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-md p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] text-lime-300 bg-lime-400/10 border border-lime-400/40 rounded px-2 py-0.5">04</span>
                <span className="font-bold text-sm">THEN — actions séquentielles</span>
                <span className="mono text-[10px] text-slate-500">→ body Java</span>
              </div>
              <span className="mono text-[10px] text-slate-500">{acts.length}/3</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ACTIONS) as ActKey[]).map((k) => {
                const active = acts.includes(k);
                return (
                  <button key={k} onClick={() => toggleAct(k)}
                    className={`px-3 py-2 rounded-md border text-left transition mono text-xs ${active ? 'border-lime-400 bg-lime-400/10 text-lime-200' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-lime-400/40'}`}>
                    <span className="text-lime-400">{active ? '☑' : '☐'}</span> {ACTIONS[k].label}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={fireTest} disabled={running}
            className={`mt-1 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 mono font-black text-sm py-3.5 rounded-md transition-transform active:scale-[.98] disabled:opacity-60 tracking-widest ${running ? 'running' : ''}`}>
            {running ? '· · ·  EVENT FIRED  · · ·' : '▶  RUN  ·  TRIGGER  ·  TEST'}
          </button>
        </section>

        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-4 border border-slate-800">
            <div className="mono text-[9px] text-slate-500 mb-2 tracking-widest">EVENT FLOW</div>
            <div className="bg-slate-950 rounded-md border border-slate-800 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="mono text-fuchsia-300 font-bold">⚡ EVENT</span>
                <span className="text-slate-300">{TRIGGERS[trigger].label}</span>
              </div>
              <div className="border-l-2 border-slate-700 pl-3 space-y-1.5">
                {conds.length === 0 ? (
                  <div className="text-slate-500 mono text-xs">if (true) → exécute toujours</div>
                ) : (
                  conds.map((c, i) => (
                    <div key={c} className="mono text-amber-300 text-xs">
                      <span className="text-slate-500">{i === 0 ? 'if' : '&&'}</span> {CONDITIONS[c].label}
                    </div>
                  ))
                )}
              </div>
              <div className="mono text-slate-500 text-xs">↓ THEN</div>
              <div className="border-l-2 border-lime-400/50 pl-3 space-y-1.5">
                {acts.length === 0 ? (
                  <div className="text-slate-500 mono text-xs">— aucune action —</div>
                ) : (
                  acts.map((a, i) => (
                    <div key={a} className="mono text-lime-300 text-xs">
                      <span className="text-slate-500">{i + 1}.</span> {ACTIONS[a].label}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur rounded-lg p-3 border border-slate-800 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[9px] text-cyan-300 tracking-widest">{clsName}Procedure.java</div>
              <div className="mono text-[9px] text-slate-500">JAVA · GENERATED</div>
            </div>
            <pre className="bg-slate-950 rounded-md p-3 text-[11px] mono leading-[1.55] overflow-x-auto max-h-[560px] border border-slate-800">
              <code>
                {javaCode.split('\n').map((line, i) => {
                  const colored = line
                    .replace(/(\/\/.*)/g, '<span class="cm">$1</span>')
                    .replace(/\b(package|import|public|private|protected|class|extends|new|this|super|static|return|void|true|false|if|else)\b/g, '<span class="kw">$1</span>')
                    .replace(/\b(LivingEntity|Player|LightningBolt|EntityType|ItemEntity|ItemStack|Items|MobEffectInstance|MobEffects|Level|BlockPos|TickEvent|LivingDeathEvent|LivingHurtEvent|PlayerInteractEvent|String|int|double|boolean|float)\b/g, '<span class="ty">$1</span>')
                    .replace(/\b(\d+(?:\.\d+[FfDd]?)?)\b/g, '<span class="nb">$1</span>')
                    .replace(/(@SubscribeEvent|@Mod\.EventBusSubscriber)/g, '<span class="an">$1</span>');
                  return <span key={i} className="code-line" data-n={String(i + 1).padStart(2, ' ')} dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} />;
                })}
              </code>
            </pre>
            <div className="mono text-[10px] text-slate-500 mt-2">
              <span className="text-fuchsia-300">@SubscribeEvent</span> = annotation. Forge scanne ta classe au boot et appelle ta méthode quand l'event fire. Pure event-driven.
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
          <div className="bg-slate-900 border border-cyan-400/60 rounded-lg p-7 max-w-md shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-md bg-cyan-400/10 border border-cyan-400/60 flex items-center justify-center text-2xl text-cyan-300">⚙</div>
              <div>
                <div className="mono text-[10px] text-cyan-300 tracking-widest">MISSION 04 · SHIPPED</div>
                <div className="text-xl font-bold">Event Handler unlocked</div>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4 text-sm text-slate-300">
              <span className="mono text-cyan-300">{procName}</span> · {conds.length} cond · {acts.length} act. Au camp tu vas chainer ces procedures pour build des boss fights, des questlines, des mini-jeux entiers.
            </div>
            <div className="flex items-center gap-3 mono text-xs mb-5">
              <span className="text-cyan-300">+90 XP</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">🏆 Badge Event Master</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/apps/educatif/')} className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 mono font-black py-2.5 rounded-md text-sm">→ HUB</button>
              <button onClick={() => router.push('/apps/educatif/mcreator/mission-5-recipe/')} className="flex-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 mono font-black py-2.5 rounded-md text-sm">M05 →</button>
              <button onClick={() => setShowWin(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 mono text-xs px-3 rounded-md">REDO</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
