// Persistence: the MIDlet's RecordStore "SA2PRO" (class d) plus the port's own options.

import { DEFAULT_KEYS } from './input.js';

const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* private mode / quota: keep running without saving */
    }
  },
};

/* ---------- original record store (class d) ---------- */

const REC_DEFAULT = {
  level: 0, // d.i
  soundOff: 0, // d.e
  vibOff: 0, // d.k
  character: 0, // d.a (not persisted by the MIDlet, kept here for convenience)
  unlocked: 0, // d.b
  highscore: 0, // d.d[0]
  hsName: '', // d.g[10]
};

export const rec = Object.assign({}, REC_DEFAULT, store.get('sa2.rms') || {});
export function saveRec() {
  store.set('sa2.rms', rec);
}
export function resetRec() {
  Object.assign(rec, REC_DEFAULT);
  saveRec();
}

/* ---------- port options ---------- */

export const OPT_DEFAULT = {
  lang: 'auto',
  intro: 'quick',
  pauseOnBlur: true,
  // video
  layout: 'original',
  scaling: 'fit',
  filter: 'sharp',
  ghost: 0,
  palette: 'original',
  skin: 'auto',
  smooth: false,
  showFps: false,
  shake: false,
  // gameplay
  speed: 100,
  inputBuffer: true,
  dirJump: true,
  hudScore: false,
  dropGuide: false,
  restoredSfx: false,
  fixBugs: false,
  inGameMusic: false,
  daily: false,
  // audio
  master: 80,
  music: 80,
  sfx: 90,
  sound: 'smaf',
  synth: 'fm',
  phoneSpeaker: false,
  loopMenuMusic: false,
  // controls
  touch: 'auto',
  padSize: 100,
  padOpacity: 75,
  haptics: true,
  realVibration: true,
  keys: null,
  // cheats
  cheatUnlockAll: false,
  cheatLives: false,
  cheatJumps: false,
  cheatHat: false,
  startLives: 2,
};

export const opts = Object.assign({}, OPT_DEFAULT, store.get('sa2.opts') || {});
const listeners = new Set();
export function onOptions(fn) {
  listeners.add(fn);
}
export function setOpt(k, v) {
  opts[k] = v;
  store.set('sa2.opts', opts);
  for (const fn of listeners) fn(k, v);
}
export function saveOpts() {
  store.set('sa2.opts', opts);
}
export function resetOpts() {
  const keep = { keys: opts.keys };
  Object.assign(opts, OPT_DEFAULT, keep);
  saveOpts();
  for (const fn of listeners) fn('*');
}

export function keyBindings() {
  return Object.assign({}, DEFAULT_KEYS, opts.keys || {});
}

export function cheatsActive() {
  return opts.cheatUnlockAll || opts.cheatLives || opts.cheatJumps || opts.cheatHat || opts.startLives !== 2;
}

/* ---------- local leaderboard & stats (port extras) ---------- */

export const scores = store.get('sa2.scores') || [];
export function addScore(entry) {
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  scores.splice(30);
  store.set('sa2.scores', scores);
  return scores.indexOf(entry);
}
export function clearScores() {
  scores.splice(0);
  store.set('sa2.scores', scores);
}

export const stats = Object.assign({ games: 0, time: 0, crates: 0, combos: 0, rows: 0, best: 0, bestCombo: 0 }, store.get('sa2.stats') || {});
export function saveStats() {
  store.set('sa2.stats', stats);
}

export function exportSave() {
  return JSON.stringify({ v: 1, rec, opts, scores, stats }, null, 1);
}
export function importSave(text) {
  const d = JSON.parse(text);
  if (d.rec) Object.assign(rec, d.rec);
  if (d.opts) Object.assign(opts, d.opts);
  if (Array.isArray(d.scores)) {
    scores.splice(0, scores.length, ...d.scores);
    store.set('sa2.scores', scores);
  }
  if (d.stats) Object.assign(stats, d.stats);
  saveRec();
  saveOpts();
  saveStats();
  for (const fn of listeners) fn('*');
}
export function wipeAll() {
  for (const k of ['sa2.rms', 'sa2.opts', 'sa2.scores', 'sa2.stats']) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* ignore */
    }
  }
}
