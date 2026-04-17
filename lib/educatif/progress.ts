/**
 * Mission Control — Éducatif : helpers de progression locale
 *
 * Persistance via localStorage pour le pilote. Quand le module pilote P01
 * sera validé par Martin, on branchera le backend Prisma (table Module +
 * ModuleAccess + ModuleProgress).
 */

import type { EducatifState, ModuleProgress, SceneType, Level } from './types';

const STORAGE_KEY = 'mc_educatif_progress_v1';

const DEFAULT_STATE: EducatifState = {
  version: 1,
  users: {},
};

export const LEVELS: Level[] = [
  { id: 1, name: 'Recrue',        minXp: 0,    emoji: '🎒' },
  { id: 2, name: 'Apprenti',      minXp: 100,  emoji: '🗺️' },
  { id: 3, name: 'Explorateur',   minXp: 250,  emoji: '🧭' },
  { id: 4, name: 'Constructeur',  minXp: 500,  emoji: '🔨' },
  { id: 5, name: 'Ingénieur',     minXp: 800,  emoji: '⚙️' },
  { id: 6, name: 'Redstone Pro',  minXp: 1200, emoji: '🔴' },
  { id: 7, name: 'Master Codeur', minXp: 1800, emoji: '🏆' },
];

function readState(): EducatifState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.users) return parsed;
    return DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state: EducatifState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded ou storage désactivé — silent fail
  }
}

export function getModuleProgress(username: string, moduleId: string): ModuleProgress {
  const state = readState();
  const user = state.users[username];
  return (
    user?.modules[moduleId] || {
      moduleId,
      completedScenes: [],
      xpEarned: 0,
      badgesEarned: [],
    }
  );
}

export function markSceneComplete(
  username: string,
  moduleId: string,
  scene: SceneType,
  xpGain: number = 0
): ModuleProgress {
  const state = readState();
  const user = state.users[username] || { modules: {} };
  const mod = user.modules[moduleId] || {
    moduleId,
    completedScenes: [],
    xpEarned: 0,
    badgesEarned: [],
  };
  if (!mod.completedScenes.includes(scene)) {
    mod.completedScenes.push(scene);
    mod.xpEarned += xpGain;
  }
  user.modules[moduleId] = mod;
  state.users[username] = user;
  writeState(state);
  return mod;
}

export function awardBadge(
  username: string,
  moduleId: string,
  badgeId: string
): ModuleProgress {
  const state = readState();
  const user = state.users[username] || { modules: {} };
  const mod = user.modules[moduleId] || {
    moduleId,
    completedScenes: [],
    xpEarned: 0,
    badgesEarned: [],
  };
  if (!mod.badgesEarned.includes(badgeId)) {
    mod.badgesEarned.push(badgeId);
  }
  mod.completedAt = mod.completedAt || new Date().toISOString();
  user.modules[moduleId] = mod;
  state.users[username] = user;
  writeState(state);
  return mod;
}

export function getTotalXp(username: string): number {
  const state = readState();
  const user = state.users[username];
  if (!user) return 0;
  return Object.values(user.modules).reduce((sum, m) => sum + m.xpEarned, 0);
}

export function getCurrentLevel(username: string): Level {
  const xp = getTotalXp(username);
  const sorted = [...LEVELS].sort((a, b) => b.minXp - a.minXp);
  return sorted.find(l => xp >= l.minXp) || LEVELS[0];
}

export function getNextLevel(username: string): Level | null {
  const current = getCurrentLevel(username);
  const next = LEVELS.find(l => l.id === current.id + 1);
  return next || null;
}

/** Username courant lu depuis le JWT Mission Control (même pattern que HubitatControl) */
export function getCurrentUsername(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem('mc_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username || null;
  } catch {
    return null;
  }
}
