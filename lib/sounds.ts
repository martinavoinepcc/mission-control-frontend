// Web Audio helpers for Impro Engine.
// Tones générés à la volée, zéro asset externe.

let _ctx: AudioContext | null = null;
function ctx() {
  if (typeof window === 'undefined') return null;
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx;
}

function tone(freq: number, durMs: number, type: OscillatorType = 'sine', gainStart = 0.35) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainStart, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durMs / 1000);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durMs / 1000);
}

export function playBell() {
  tone(1320, 600, 'sine', 0.3);
  setTimeout(() => tone(1760, 900, 'sine', 0.2), 80);
}

export function playBuzzer() {
  tone(220, 300, 'square', 0.3);
  setTimeout(() => tone(165, 500, 'square', 0.28), 120);
}

export function playTick() {
  tone(880, 40, 'sine', 0.08);
}

export function playCheer() {
  [600, 800, 1000, 1200].forEach((f, i) => setTimeout(() => tone(f, 180, 'triangle', 0.25), i * 80));
}
