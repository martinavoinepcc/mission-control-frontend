// Modèle du monde de jeu Code Cadet + rendu Canvas 2D + moteur d'exécution pas-à-pas.

import type { Step } from './blockly-config';

export type Dir = 'north' | 'south' | 'east' | 'west';

export type WorldSpec = {
  tileset: string;
  cols: number;
  rows: number;
  start: { x: number; y: number; dir: Dir };
  goal: { x: number; y: number } | null;
  items: Array<{ type: string; x: number; y: number; color?: string }>;
  obstacles: Array<{ type: string; x: number; y: number }>;
};

export type WorldState = {
  spec: WorldSpec;
  rex: { x: number; y: number; dir: Dir };
  collected: Set<string>;
  message: string | null;
  outOfBounds: boolean;
  drowned: boolean;
  reachedGoal: boolean;
};

export function createInitialState(spec: WorldSpec): WorldState {
  return {
    spec,
    rex: { x: spec.start.x, y: spec.start.y, dir: spec.start.dir },
    collected: new Set(),
    message: null,
    outOfBounds: false,
    drowned: false,
    reachedGoal: false,
  };
}

export function applyStep(state: WorldState, step: Step): WorldState {
  const s: WorldState = {
    ...state,
    rex: { ...state.rex },
    collected: new Set(state.collected),
  };
  switch (step.op) {
    case 'say':
      s.message = step.text;
      break;
    case 'turnRight':
      s.rex.dir = rotate(s.rex.dir, 1);
      break;
    case 'turnLeft':
      s.rex.dir = rotate(s.rex.dir, -1);
      break;
    case 'move': {
      const [dx, dy] = dirDelta(s.rex.dir);
      const nx = s.rex.x + dx;
      const ny = s.rex.y + dy;
      if (nx < 0 || ny < 0 || nx >= s.spec.cols || ny >= s.spec.rows) {
        s.outOfBounds = true;
        break;
      }
      // Collision avec obstacle type "water"
      const hit = s.spec.obstacles.find((o) => o.x === nx && o.y === ny);
      if (hit?.type === 'water') {
        s.drowned = true;
        s.rex.x = nx;
        s.rex.y = ny;
        break;
      }
      s.rex.x = nx;
      s.rex.y = ny;
      break;
    }
  }
  // Check goal
  if (s.spec.goal && s.rex.x === s.spec.goal.x && s.rex.y === s.spec.goal.y && !s.drowned && !s.outOfBounds) {
    s.reachedGoal = true;
  }
  // Auto-collect items où Rex arrive
  for (const item of s.spec.items) {
    if (item.x === s.rex.x && item.y === s.rex.y) {
      s.collected.add(`${item.type}-${item.x}-${item.y}`);
    }
  }
  return s;
}

function rotate(d: Dir, turns: number): Dir {
  const order: Dir[] = ['north', 'east', 'south', 'west'];
  const idx = order.indexOf(d);
  const next = (idx + turns + 4 * 10) % 4;
  return order[next];
}

function dirDelta(d: Dir): [number, number] {
  switch (d) {
    case 'north': return [0, -1];
    case 'south': return [0, 1];
    case 'east': return [1, 0];
    case 'west': return [-1, 0];
  }
}

// ============ RENDU CANVAS ============

export type RenderOpts = {
  canvas: HTMLCanvasElement;
  state: WorldState;
  tileSize?: number;
};

export function renderWorld({ canvas, state, tileSize = 64 }: RenderOpts) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { spec, rex } = state;

  // Resize canvas if needed
  const desiredW = spec.cols * tileSize;
  const desiredH = spec.rows * tileSize;
  if (canvas.width !== desiredW) canvas.width = desiredW;
  if (canvas.height !== desiredH) canvas.height = desiredH;

  // Background selon tileset
  drawBackground(ctx, spec.tileset, desiredW, desiredH);

  // Grille de tuiles
  for (let y = 0; y < spec.rows; y++) {
    for (let x = 0; x < spec.cols; x++) {
      drawTile(ctx, spec.tileset, x, y, tileSize);
    }
  }

  // Obstacles (eau, murs)
  for (const o of spec.obstacles) {
    drawObstacle(ctx, o, tileSize);
  }

  // Items (cristaux, drapeaux)
  for (const item of spec.items) {
    const key = `${item.type}-${item.x}-${item.y}`;
    if (state.collected.has(key)) continue;
    drawItem(ctx, item, tileSize);
  }

  // Goal marker (si pas un item)
  if (spec.goal && !spec.items.find((i) => i.x === spec.goal!.x && i.y === spec.goal!.y)) {
    drawGoalMarker(ctx, spec.goal.x, spec.goal.y, tileSize);
  }

  // Rex
  drawRex(ctx, rex, tileSize, state.drowned);

  // Message bulle
  if (state.message) {
    drawSpeechBubble(ctx, rex.x, rex.y, tileSize, state.message);
  }

  // Overlay si échec/succès
  if (state.outOfBounds) {
    drawOverlay(ctx, desiredW, desiredH, 'Oups! Hors-limite', '#F87171');
  }
  if (state.drowned) {
    drawOverlay(ctx, desiredW, desiredH, 'Splash! Dans l\'eau', '#60A5FA');
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, tileset: string, w: number, h: number) {
  const bg = {
    plaine: ['#1a3d2e', '#0f2419'],
    foret: ['#0a2f22', '#071a14'],
    grotte: ['#2d1b3d', '#1a0f26'],
    pont: ['#1e3a5f', '#0f1f33'],
  }[tileset] || ['#1a1a2e', '#0f0f1e'];
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, bg[0]);
  grad.addColorStop(1, bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawTile(ctx: CanvasRenderingContext2D, tileset: string, x: number, y: number, size: number) {
  const px = x * size;
  const py = y * size;
  const colors = {
    plaine: { base: '#4ADE80', top: '#6EE7A8', side: '#2E9E5E' },
    foret: { base: '#15803d', top: '#22A055', side: '#0E5E2B' },
    grotte: { base: '#6B21A8', top: '#8B3DC9', side: '#4A0E78' },
    pont: { base: '#94A3B8', top: '#CBD5E1', side: '#64748B' },
  }[tileset] || { base: '#4ADE80', top: '#6EE7A8', side: '#2E9E5E' };

  // Face supérieure (isométrique léger)
  ctx.fillStyle = colors.top;
  ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
  // Bordure intérieure
  ctx.strokeStyle = colors.side;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
  // Petites variations pixel-art
  ctx.fillStyle = colors.base + 'cc';
  ctx.fillRect(px + 8, py + 8, 4, 4);
  ctx.fillRect(px + size - 16, py + size - 14, 3, 3);
  ctx.fillRect(px + size - 20, py + 12, 2, 2);
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: { type: string; x: number; y: number }, size: number) {
  const px = o.x * size;
  const py = o.y * size;
  if (o.type === 'water') {
    const grad = ctx.createLinearGradient(px, py, px, py + size);
    grad.addColorStop(0, '#60A5FA');
    grad.addColorStop(1, '#1D4ED8');
    ctx.fillStyle = grad;
    ctx.fillRect(px, py, size, size);
    // Vagues
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ly = py + 12 + i * 16;
      ctx.moveTo(px + 6, ly);
      ctx.quadraticCurveTo(px + size / 2, ly - 4, px + size - 6, ly);
    }
    ctx.stroke();
  }
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  item: { type: string; x: number; y: number; color?: string },
  size: number,
) {
  const cx = item.x * size + size / 2;
  const cy = item.y * size + size / 2;
  if (item.type === 'crystal') {
    const color = item.color || 'cyan';
    const palette: Record<string, string[]> = {
      cyan: ['#67E8F9', '#06B6D4', '#0891B2'],
      green: ['#86EFAC', '#22C55E', '#16A34A'],
      purple: ['#D8B4FE', '#A855F7', '#7E22CE'],
      gold: ['#FDE68A', '#F59E0B', '#D97706'],
    };
    const [light, mid, dark] = palette[color] || palette.cyan;
    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30);
    glow.addColorStop(0, mid + '88');
    glow.addColorStop(1, mid + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 30, cy - 30, 60, 60);
    // Cristal (diamant)
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 14, cy);
    ctx.lineTo(cx, cy + 18);
    ctx.lineTo(cx - 14, cy);
    ctx.closePath();
    ctx.fillStyle = mid;
    ctx.fill();
    // Reflet
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 5, cy - 4);
    ctx.lineTo(cx - 5, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 14, cy);
    ctx.lineTo(cx, cy + 18);
    ctx.lineTo(cx - 14, cy);
    ctx.closePath();
    ctx.stroke();
  } else if (item.type === 'flag') {
    // Drapeau or
    ctx.fillStyle = '#78350F';
    ctx.fillRect(cx - 1, cy - 24, 3, 44);
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 22);
    ctx.lineTo(cx + 22, cy - 14);
    ctx.lineTo(cx + 2, cy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.stroke();
  }
}

function drawGoalMarker(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const cx = x * size + size / 2;
  const cy = y * size + size / 2;
  const t = Date.now() / 400;
  const pulse = 14 + Math.sin(t) * 3;
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRex(ctx: CanvasRenderingContext2D, rex: { x: number; y: number; dir: Dir }, size: number, drowned: boolean) {
  const px = rex.x * size;
  const py = rex.y * size;
  const cx = px + size / 2;
  const cy = py + size / 2;

  if (drowned) {
    ctx.globalAlpha = 0.5;
  }

  // Ombre
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, py + size - 8, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corps (cube stylisé)
  ctx.fillStyle = '#10B981';
  ctx.fillRect(cx - 14, cy - 14, 28, 28);
  // Tête
  ctx.fillStyle = '#34D399';
  ctx.fillRect(cx - 11, cy - 22, 22, 14);
  // Yeux — orientation selon dir
  ctx.fillStyle = '#FFF';
  const eyeOffsets: Record<Dir, [number, number]> = {
    north: [0, -3],
    south: [0, 3],
    east: [3, 0],
    west: [-3, 0],
  };
  const [ex, ey] = eyeOffsets[rex.dir];
  ctx.fillRect(cx - 6 + ex, cy - 17 + ey, 3, 3);
  ctx.fillRect(cx + 3 + ex, cy - 17 + ey, 3, 3);
  // Visor emblème
  ctx.fillStyle = '#06B6D4';
  ctx.fillRect(cx - 8, cy - 6, 16, 3);
  // Bras (petits cubes)
  ctx.fillStyle = '#047857';
  ctx.fillRect(cx - 18, cy - 8, 4, 14);
  ctx.fillRect(cx + 14, cy - 8, 4, 14);
  // Flèche d'orientation (indicateur direction)
  ctx.fillStyle = '#FDE68A';
  const arrows: Record<Dir, string> = { north: '▲', south: '▼', east: '▶', west: '◀' };
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(arrows[rex.dir], cx, cy + 24);

  ctx.globalAlpha = 1;
}

function drawSpeechBubble(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number, text: string) {
  const x = tx * size + size / 2;
  const y = ty * size - 8;
  ctx.font = 'bold 13px sans-serif';
  const padding = 8;
  const metrics = ctx.measureText(text);
  const w = metrics.width + padding * 2;
  const h = 24;
  const bx = x - w / 2;
  const by = y - h - 6;
  // Bulle
  ctx.fillStyle = '#FFF';
  roundRect(ctx, bx, by, w, h, 6, true);
  // Pointeur
  ctx.beginPath();
  ctx.moveTo(x - 5, by + h);
  ctx.lineTo(x, by + h + 6);
  ctx.lineTo(x + 5, by + h);
  ctx.closePath();
  ctx.fillStyle = '#FFF';
  ctx.fill();
  // Texte
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + h / 2);
}

function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, color: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
}
