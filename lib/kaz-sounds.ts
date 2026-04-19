// Kaz sound effects - Web Audio generated, zero external assets.
// Inspired by retro game SFX: chiptune-like + filtered noise + chord stings.

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx;
}

function tone(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.3, delay = 0) {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + delay;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + durMs / 1000);
}

function sweep(fStart: number, fEnd: number, durMs: number, type: OscillatorType = 'sine', gain = 0.25) {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  const t0 = c.currentTime;
  osc.frequency.setValueAtTime(fStart, t0);
  osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + durMs / 1000);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + durMs / 1000);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + durMs / 1000);
}

function noiseBurst(durMs: number, filterFreq: number, gain = 0.3, qFactor = 2) {
  const c = ctx(); if (!c) return;
  const bufferSize = c.sampleRate * (durMs / 1000);
  const buf = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const w = Math.random() * 2 - 1;
    data[i] = (last + 0.02 * w) / 1.02; // brown noise (deeper than white)
    last = data[i]; data[i] *= 3.5;
  }
  const src = c.createBufferSource(); src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.75, c.currentTime + durMs / 1000);
  filter.Q.value = qFactor;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.setValueAtTime(gain, c.currentTime + (durMs / 1000) * 0.8);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durMs / 1000);
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start();
}

// ===== UI / mécaniques (rapides, subtils) =====
export function playClick() { tone(800, 30, 'sine', 0.22); }
export function playTick() { tone(1200, 40, 'sine', 0.18); }
export function playIfTaken() { tone(880, 80, 'sine', 0.22); tone(1320, 100, 'sine', 0.22, 0.07); }
export function playElseTaken() { tone(440, 80, 'sine', 0.22); tone(660, 100, 'sine', 0.22, 0.07); }
export function playWasted() { sweep(200, 80, 500, 'square', 0.25); }

// ===== Moments dramatiques =====
export function playCookieEaten() {
  // Rising power-up: C - E - G
  tone(523, 400, 'triangle', 0.15);
  tone(659, 400, 'triangle', 0.15, 0.08);
  tone(784, 500, 'triangle', 0.18, 0.16);
}
export function playPotionDrink() {
  // Magic sweep down + high sparkle
  sweep(2000, 400, 800, 'sine', 0.22);
  setTimeout(() => { tone(1760, 100, 'sine', 0.14); tone(2217, 100, 'sine', 0.12, 0.05); tone(2637, 100, 'sine', 0.1, 0.1); }, 600);
}
export function playBossSpawn() {
  // Sub drone + dissonant chord
  tone(55, 1200, 'sine', 0.35);
  tone(220, 800, 'sawtooth', 0.13, 0.3);
  tone(233, 800, 'sawtooth', 0.11, 0.3);  // A# dissonant
  tone(311, 800, 'sawtooth', 0.09, 0.3);
}
export function playBossDie() {
  noiseBurst(300, 800, 0.35, 0.5);
  sweep(200, 50, 500, 'square', 0.35);
  tone(880, 400, 'triangle', 0.2, 0.3);
}
export function playBossDrop() {
  // Metallic bell descending
  [1200, 900, 700, 550].forEach((f, i) => tone(f, 400, 'sine', 0.18, i * 0.1));
  setTimeout(() => tone(2000, 200, 'triangle', 0.15), 400);
}
export function playWaveSpawn() {
  // Zombie growl (filtered brown noise)
  noiseBurst(900, 200, 0.35, 2);
}
export function playBadgeReveal() {
  // Fanfare I - V - I major
  [523, 659, 784].forEach(f => tone(f, 500, 'triangle', 0.14));
  setTimeout(() => { [784, 988, 1175].forEach(f => tone(f, 500, 'triangle', 0.14)); }, 400);
  setTimeout(() => { [1047, 1319, 1568].forEach(f => tone(f, 800, 'triangle', 0.16)); }, 800);
  setTimeout(() => { tone(2093, 200, 'sine', 0.1); tone(2349, 200, 'sine', 0.08, 0.05); }, 1000);
}

// Registry for convenient dispatch by name
export const KAZ_SOUNDS: Record<string, () => void> = {
  click: playClick,
  tick: playTick,
  if_taken: playIfTaken,
  else_taken: playElseTaken,
  wasted: playWasted,
  cookie_eaten: playCookieEaten,
  potion_drink: playPotionDrink,
  boss_spawn: playBossSpawn,
  boss_die: playBossDie,
  boss_drop: playBossDrop,
  wave_spawn: playWaveSpawn,
  badge_reveal: playBadgeReveal,
};

export function playKazSound(name: keyof typeof KAZ_SOUNDS) {
  const fn = KAZ_SOUNDS[name];
  if (fn) fn();
}
