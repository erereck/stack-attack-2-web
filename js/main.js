// Boot, layout, main loop and the MIDlet's screen flow (StackAttack2.startApp + class h + class a).

import { Keys, K, installKeyboard, pollGamepads } from './input.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { Game, CHARACTER_ICONS } from './game.js';
import { ListScreen, FormScreen, TextBoxScreen } from './phone.js';
import { LoadingScreen, TitleScreen, OffScreen, GameScreen } from './screens.js';
import { rec, saveRec, opts, onOptions, keyBindings, cheatsActive, addScore, stats, saveStats } from './settings.js';
import { GAME_LANGS, detectLang, setUiLang, ui } from './i18n.js';
import { installTouch } from './touch.js';
import { PortMenu } from './portmenu.js';
import { JavaRandom } from './engine.js';

const VERSION = '1.0.0';
const IMAGES = [
  'back', 'bomb', 'crane', 'crates', 'font', 'hat', 'jumps', 'lives', 'wall',
  'logo2', 'mos', 'siemens', 'title', 'tick',
  'man', 'man2', 'man3', 'man4', 'woman', 'woman2',
  'iconman', 'iconman2', 'iconman3', 'iconman4', 'icwoman', 'icwoman2',
];

const $ = (id) => document.getElementById(id);
const canvas = $('screen');
const device = $('device');
const pad = $('pad');
const R = new Renderer(canvas);
const audio = new AudioEngine();
const assets = { img: {} };
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

let S = GAME_LANGS.en.s; // current game strings (class c)
let current = null; // current Displayable
let gameScreen = null;
let portMenu = null;
let wideBack = null;
let LW = 101;
let shakeUntil = 0;

/* ---------------- language ---------------- */

function langCode() {
  return opts.lang === 'auto' || !GAME_LANGS[opts.lang] ? detectLang() : opts.lang;
}
function applyLang() {
  const l = langCode();
  S = GAME_LANGS[l].s;
  setUiLang(l);
  document.documentElement.lang = l === 'pt-BR' ? 'pt-BR' : l;
  $('power-lbl').textContent = ui('power');
  $('btn-menu').title = ui('menu') + ' (Esc)';
  $('btn-fs').title = ui('fullscreen') + ' (F)';
  updatePadContext();
}

/* ---------------- display (Display.setCurrent) ---------------- */

function show(scr) {
  if (current && current !== scr) current.hide?.();
  current = scr;
  Keys.listener = portMenu?.isOpen ? null : scr;
  Keys.context = scr.context || 'menu';
  scr.show?.();
  updatePadContext();
}

const OK = () => ({ label: S.A, id: 'ok' });
const BACK = () => ({ label: S.D, id: 'back' });
const list = (o) => new Promise((res) => show(new ListScreen({ ...o, onDone: res })));
const form = (o) => new Promise((res) => show(new FormScreen({ okLabel: S.A, backLabel: S.D, optionsLabel: S.T, ...o, onDone: res })));
const textbox = (o) => new Promise((res) => show(new TextBoxScreen({ input: $('textin'), okLabel: S.A, clearLabel: S.R, ...o, onDone: res })));
function loading(total, ms) {
  return new Promise((res) => {
    const s = new LoadingScreen(S.e, total, ms);
    s.onDone = res;
    show(s);
  });
}

/* ---------------- startApp() ---------------- */

async function startApp() {
  for (;;) {
    if (opts.intro !== 'skip') await loading(10, 450);
    if (rec.soundOff === 0) audio.midi('title', opts.loopMenuMusic);
    await new Promise((res) => {
      const t = new TitleScreen(assets.img, opts.intro);
      t.onDone = res;
      show(t);
    });
    for (;;) {
      const r = await mainMenu();
      if (r === 'exit') break;
      let again = true;
      while (again) {
        await loading(99, 650);
        const res = await playGame();
        again = res.restart;
        if (!again) await afterGame(res.game);
      }
    }
    audio.stopAllMidi();
    await new Promise((res) => {
      const o = new OffScreen(ui('powerHint'));
      o.onDone = res;
      show(o);
    });
  }
}

/* ---------------- class h : menus ---------------- */

let mainSel = 0;
async function mainMenu() {
  let st = 'main';
  for (;;) {
    if (st === 'main') {
      if (opts.loopMenuMusic && rec.soundOff === 0) audio.midi('title', true);
      const r = await list({ title: S.h + ' Pro', items: [S.x, S.k, S.o, S.q, S.T, S.ag].map((label) => ({ label })), selected: mainSel, left: OK() });
      mainSel = r.index;
      st = ['chars', 'hs', 'instr', 'about', 'options', 'exit'][r.index];
      if (st === 'exit') return 'exit';
    } else if (st === 'chars') {
      const unlocked = opts.cheatUnlockAll ? 5 : rec.unlocked;
      const names = [S.O, S.N, S.M, S.K, S.J, S.H];
      const items = names.map((label, i) => ({ label, icon: i > unlocked ? assets.img.tick : assets.img[CHARACTER_ICONS[i]] }));
      const r = await list({ title: S.B, items, selected: rec.character <= unlocked ? rec.character : 0, left: OK(), right: BACK() });
      if (r.id === 'back') st = 'main';
      else if (r.index > unlocked) await form({ title: S.o, text: S.ad, left: OK() });
      else {
        rec.character = r.index;
        saveRec();
        st = 'level';
      }
    } else if (st === 'level') {
      const r = await list({ title: S.c, items: [S.ai, S.U, S.V].map((label) => ({ label })), selected: rec.level, left: OK(), right: BACK() });
      if (r.id === 'back') st = 'chars';
      else {
        rec.level = r.index;
        saveRec();
        return 'start';
      }
    } else if (st === 'hs') {
      const has = rec.highscore !== 0;
      const r = await form({
        title: S.k,
        text: '   ' + (rec.hsName || '') + '\n    ' + rec.highscore + ' ' + S.S,
        menu: has
          ? [
              { label: ui('share'), id: 'share' },
              { label: S.R, id: 'clear' },
            ]
          : null,
        right: BACK(),
      });
      if (r.id === 'share') share(rec.highscore);
      else if (r.id === 'clear') {
        rec.highscore = 0;
        saveRec();
      } else st = 'main';
    } else if (st === 'instr') {
      await form({ title: S.o, text: S.p, left: OK() });
      st = 'main';
    } else if (st === 'about') {
      await form({ title: S.q, text: `Developed by Mobile Scope AG\nVersion: 1.08\n\nWeb port ${VERSION}\ngithub.com/erereck/stack-attack-2-web`, left: OK() });
      st = 'main';
    } else if (st === 'options') {
      await soundVibrationList();
      st = 'main';
    }
  }
}

/** The MULTIPLE List with Sound / Vibration, used both in the menu and in game (FIRE). */
async function soundVibrationList() {
  const r = await list({
    title: S.T,
    type: 'multiple',
    items: [{ label: S.I }, { label: S.Z }],
    flags: [rec.soundOff === 0, rec.vibOff === 0],
    left: { label: S.A, id: 'toggle', toggle: true },
    right: BACK(),
  });
  rec.vibOff = r.flags[1] ? 0 : 1;
  rec.soundOff = r.flags[0] ? 0 : 1;
  if (rec.soundOff) audio.stopAllMidi();
  saveRec();
}

/* ---------------- class e : a game ---------------- */

const sfx = {
  play: (n) => audio.play(n),
  midi: (n) => audio.midi(n),
  tone: (f, ms) => audio.tone(f, ms),
  get smaf() {
    return opts.sound !== 'beep';
  },
};

const host = {
  vibrate: doVibrate,
  save: saveRec,
  consumeKey: () => Keys.consume(),
  openOptions: async () => {
    const scr = gameScreen;
    const g = scr.game;
    g.shown = false; // hideNotify()
    await soundVibrationList();
    g.paused = false;
    Keys.consume();
    g.shown = true;
    scr.acc = 0;
    show(scr);
    syncGameMusic();
  },
};

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function layoutNow() {
  if (gameScreen && current === gameScreen) {
    if (gameScreen.game.cols !== 12) return 'wide-field';
    return opts.layout === 'wide-hud' ? 'wide-hud' : 'original';
  }
  return opts.layout;
}
const widthFor = (l) => (l === 'wide-hud' ? 142 : l === 'wide-field' ? 141 : 101);

function playGame() {
  audio.stopMidi('title');
  const daily = opts.daily;
  const seed = daily ? dailySeed() : Date.now();
  const rng = new JavaRandom(seed);
  const cosmeticRng = daily ? new JavaRandom(seed * 7919 + 13) : rng;
  const cols = opts.layout === 'wide-field' ? 17 : 12;
  const g = new Game({ assets, rec, opts, cols, wideBack: cols !== 12 ? wideBack : null, sfx, host, rng, cosmeticRng });
  g.start();
  return new Promise((res) => {
    const env = {
      opts,
      img: assets.img,
      daily,
      best: rec.highscore,
      get S() {
        return S;
      },
      get layout() {
        return layoutNow();
      },
    };
    const scr = new GameScreen(g, env);
    scr.onEnd = () => {
      if (gameScreen === scr) gameScreen = null;
      if (opts.inGameMusic) audio.stopMidi('title');
      res({ game: scr.game, restart: !!scr.restart });
    };
    gameScreen = scr;
    show(scr);
    syncGameMusic();
  });
}

function syncGameMusic() {
  if (!gameScreen || current !== gameScreen) return;
  if (opts.inGameMusic && rec.soundOff === 0 && gameScreen.game.running) audio.midi('title', true);
  else audio.stopMidi('title');
}

/** StackAttack2 case 2 + class a: what happens after a game. */
async function afterGame(g) {
  const score = g.score;
  const cheat = cheatsActive() || !!g.tainted;
  stats.games++;
  stats.time += (g.frameCount * 111) / 1000;
  stats.crates += g.stats.cleared;
  stats.combos += g.stats.combos;
  stats.rows += g.stats.rows;
  stats.bestCombo = Math.max(stats.bestCombo, g.stats.bestCombo);
  if (!cheat) stats.best = Math.max(stats.best, score);
  saveStats();
  let newHigh = false;
  if (!cheat && score > rec.highscore) {
    rec.highscore = score;
    newHigh = true;
    saveRec();
  }
  const entry = { score, name: rec.hsName || '', char: g.character, level: rec.level, cols: g.cols, daily: opts.daily, speed: opts.speed, date: Date.now() };
  if (newHigh || g.unlockedNow) {
    if (g.unlockedNow) await form({ title: S.Q, text: S.s + ' ' + S.aj[Math.max(0, rec.unlocked - 1)] + '.', left: OK() });
    await form({ title: newHigh ? S.k : S.G, text: '\n  ' + score + ' ' + S.S, left: OK() });
    if (newHigh) {
      const name = await textbox({ title: S.v, value: rec.hsName, maxLen: 12 });
      if (name) {
        rec.hsName = name;
        entry.name = name;
        saveRec();
      }
    }
  } else {
    await form({ title: S.G, text: '\n  ' + score + ' ' + S.S, left: OK() });
  }
  if (!cheat && score > 0) addScore(entry);
}

/* ---------------- save states (port extra) ---------------- */

function hasState() {
  try {
    return !!localStorage.getItem('sa2.state');
  } catch (e) {
    return false;
  }
}

function saveState() {
  if (!gameScreen || current !== gameScreen || !gameScreen.game.running) return;
  try {
    localStorage.setItem('sa2.state', JSON.stringify(gameScreen.game.snapshot()));
    toast(ui('stateSaved'));
  } catch (e) {
    toast(String(e.message || e));
  }
  portMenu.render();
}

function loadState() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem('sa2.state'));
  } catch (e) {
    /* ignore */
  }
  if (!d || !gameScreen || current !== gameScreen) return toast(ui('noState'));
  rec.character = d.character;
  rec.level = d.level;
  const rng = new JavaRandom(1);
  const cosmeticRng = d.crng ? new JavaRandom(2) : rng;
  const g = new Game({ assets, rec, opts, cols: d.cols, wideBack: d.cols !== 12 ? wideBack : null, sfx, host, rng, cosmeticRng });
  g.restore(d);
  g.tainted = true;
  g.paused = true;
  g.pauseOverlay = true;
  Keys.consume();
  gameScreen.game = g;
  gameScreen.acc = 0;
  gameScreen.endAt = 0;
  toast(ui('stateLoaded'));
}

/* ---------------- platform services ---------------- */

function doVibrate(ms) {
  if (opts.realVibration && navigator.vibrate) {
    try {
      navigator.vibrate(Math.min(ms, 1000));
    } catch (e) {
      /* ignore */
    }
  }
  if (opts.shake && ms >= 40) shakeUntil = Math.max(shakeUntil, performance.now() + Math.min(ms, 600));
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

async function share(points) {
  const text = ui('shareText', points);
  const url = location.href.split('#')[0];
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Stack Attack 2', text, url });
    } catch (e) {
      /* cancelled */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(ui('copied'));
  } catch (e) {
    toast(text);
  }
}

function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    return;
  }
  const el = d.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return toast(ui('iosFs'));
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => toast(ui('iosFs')));
  } catch (e) {
    toast(ui('iosFs'));
  }
}

/* ---------------- layout ---------------- */

const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.append(probe);
function safeArea() {
  const cs = getComputedStyle(probe);
  return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}

function touchMode() {
  if (opts.touch === 'auto') return isTouch ? 'pad' : 'none';
  return opts.touch;
}
function skinMode() {
  if (opts.skin === 'auto') return isTouch ? 'none' : 'bezel';
  return opts.skin;
}

function placeBox(el, cx, cy, w, h) {
  el.style.left = `${Math.round(cx - w / 2)}px`;
  el.style.top = `${Math.round(cy - h / 2)}px`;
  el.style.width = `${Math.round(w)}px`;
  el.style.height = `${Math.round(h)}px`;
}

function layout() {
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const sa = safeArea();
  LW = widthFor(layoutNow());
  const skin = skinMode();
  const usePad = touchMode() === 'pad' && skin !== 'phone';
  const portrait = vh > vw;
  const sc = opts.padSize / 100;
  document.documentElement.style.setProperty('--pad-op', String(opts.padOpacity / 100));
  pad.hidden = !usePad;

  let area = { x: sa.l, y: sa.t, w: vw - sa.l - sa.r, h: vh - sa.t - sa.b };
  if (portrait) {
    area.y += 50;
    area.h -= 50;
  }

  // measure the device frame in "logical pixel" units
  device.className = 'skin-' + skin;
  let dW = LW,
    dH = 80;
  if (skin !== 'none') {
    device.style.setProperty('--u', '10px');
    canvas.style.width = `${LW * 10}px`;
    canvas.style.height = `${80 * 10}px`;
    const r = device.getBoundingClientRect();
    dW = r.width / 10;
    dH = r.height / 10;
  }

  if (usePad) {
    if (portrait) {
      const minPad = Math.min(330, Math.max(220, vh * 0.36)) * Math.min(1.2, Math.max(0.8, sc));
      const gameH = Math.min(area.h - minPad, (area.w * dH) / dW);
      const padTop = area.y + gameH + 8;
      const regionH = vh - sa.b - padTop;
      area.h = gameH;
      const D = Math.min(regionH * 0.66, vw * 0.44) * sc;
      const A = D * 0.5,
        B = D * 0.42;
      const cy = padTop + Math.max(D / 2 + 46, regionH * 0.55);
      placeBox($('dpad'), sa.l + 18 + D / 2, Math.min(cy, vh - sa.b - D / 2 - 10), D, D);
      const ax = vw - sa.r - 18 - A / 2,
        ay = Math.min(cy - A * 0.35, vh - sa.b - A * 1.4);
      placeBox($('pad-main'), 0, 0, 0, 0);
      const pm = $('pad-main');
      pm.style.left = '0px';
      pm.style.top = '0px';
      pm.style.width = '0px';
      pm.style.height = '0px';
      placeBox(pm.querySelector('.pb-a'), ax, ay, A, A);
      placeBox(pm.querySelector('.pb-b'), ax - A * 1.02, ay + A * 0.66, B, B);
      const ps = $('pad-small');
      ps.style.left = '50%';
      ps.style.transform = 'translateX(-50%)';
      const dTop = Math.min(cy, vh - sa.b - D / 2 - 10) - D / 2;
      ps.style.top = `${Math.round(Math.max(padTop + 4, (padTop + dTop) / 2 - 17))}px`;
      ps.style.width = ps.style.height = '';
    } else {
      let D = Math.min(vh * 0.44, 200) * sc;
      // keep both thumb clusters outside the picture, shrinking it at most to 70% of its height
      const fullW = (area.h * dW) / dH;
      let side = D * 1.02 + 30;
      if (area.w - 2 * side < fullW) {
        const minW = fullW * 0.7;
        if (area.w - 2 * side < minW) {
          D = Math.max(100, ((area.w - minW) / 2 - 30) / 1.02);
          side = D * 1.02 + 30;
        }
        area.x += side;
        area.w -= 2 * side;
      }
      const A = D * 0.5,
        B = D * 0.42;
      placeBox($('dpad'), sa.l + 22 + D / 2, vh - sa.b - 22 - D / 2, D, D);
      const pm = $('pad-main');
      pm.style.left = pm.style.top = '0px';
      pm.style.width = pm.style.height = '0px';
      const ax = vw - sa.r - 22 - A / 2,
        ay = vh - sa.b - 26 - A * 1.15;
      placeBox(pm.querySelector('.pb-a'), ax, ay, A, A);
      placeBox(pm.querySelector('.pb-b'), ax - A * 1.1, ay + A * 0.5, B, B);
      const ps = $('pad-small');
      ps.style.transform = '';
      ps.style.left = `${sa.l + 10}px`;
      ps.style.top = `${sa.t + 10}px`;
      ps.style.maxWidth = `${Math.max(120, side - 16)}px`;
    }
    if (portrait) $('pad-small').style.maxWidth = '';
    const fs = Math.max(11, Math.round(Math.min(vw, vh) * 0.028 * sc));
    pad.querySelectorAll('.pb').forEach((b) => (b.style.fontSize = `${fs}px`));
  }

  // fit
  if (skin !== 'none') {
    const m = Math.min(14, Math.min(area.w, area.h) * 0.03);
    area = { x: area.x + m, y: area.y + m, w: area.w - 2 * m, h: area.h - 2 * m };
  }
  let u = Math.min(area.w / dW, area.h / dH);
  if (opts.scaling === 'integer') u = Math.max(1, Math.floor(u * dpr)) / dpr;
  u = Math.max(u, 0.5);
  let cssW = LW * u,
    cssH = 80 * u;
  if (opts.scaling === 'stretch' && skin === 'none') {
    cssW = area.w;
    cssH = area.h;
  }
  device.style.setProperty('--u', `${u}px`);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const devW = skin === 'none' ? cssW : dW * u,
    devH = skin === 'none' ? cssH : dH * u;
  device.style.left = `${Math.round(area.x + (area.w - devW) / 2)}px`;
  device.style.top = `${Math.round(area.y + (area.h - devH) / 2)}px`;
  const bw = Math.max(1, Math.round(cssW * dpr)),
    bh = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
}

function updatePadContext() {
  const game = Keys.context === 'game';
  pad.classList.toggle('ctx-game', game);
  const a = pad.querySelector('[data-lbl="a"]'),
    b = pad.querySelector('[data-lbl="b"]');
  if (a) a.textContent = game ? ui('padJump') : ui('padOk');
  if (b) b.textContent = game ? ui('padSuper') : ui('padBack');
  const small = $('pad-small');
  small.style.visibility = game ? 'visible' : 'hidden';
  small.querySelector('[data-lbl="bomb"]').textContent = ui('padBomb');
  small.querySelector('[data-lbl="ok"]').textContent = ui('padOk');
  small.querySelector('[data-lbl="pause"]').textContent = ui('padPause');
}

/* ---------------- options -> subsystems ---------------- */

const PALETTES = {
  original: '',
  lcd: 'saturate(0.78) contrast(0.9) brightness(1.06) sepia(0.14)',
  gb: 'url(#pal-gb)',
  gray: 'grayscale(1) contrast(1.06)',
  vivid: 'saturate(1.45) contrast(1.1)',
  night: 'brightness(0.78) sepia(0.35) saturate(0.9)',
};

function applyOptions() {
  R.filter = opts.filter;
  R.ghost = +opts.ghost || 0;
  R.interp = !!opts.smooth;
  canvas.style.filter = PALETTES[opts.palette] || '';
  audio.vol.master = opts.master / 100;
  audio.vol.music = opts.music / 100;
  audio.vol.sfx = opts.sfx / 100;
  audio.synth = opts.synth;
  audio.phoneSpeaker = !!opts.phoneSpeaker;
  audio.applyVolumes();
  Keys.buffer = !!opts.inputBuffer;
  Keys.dirJump = !!opts.dirJump;
  $('fps').hidden = !opts.showFps;
}

onOptions((k) => {
  if (k === 'lang' || k === '*') applyLang();
  applyOptions();
  if (k === 'inGameMusic' || k === '*') syncGameMusic();
  if (k === 'loopMenuMusic' && !gameScreen && opts.loopMenuMusic && rec.soundOff === 0) audio.midi('title', true);
  layout();
});

/* ---------------- main loop ---------------- */

let last = performance.now();
let fpsCount = 0,
  fpsT = 0;
let rafSeen = 0;
function rafLoop(now) {
  rafSeen = performance.now();
  frame(now);
  requestAnimationFrame(rafLoop);
}
// some webviews / hidden panes stall requestAnimationFrame: keep the game alive with a timer
setInterval(() => {
  const t = performance.now();
  if (!document.hidden && t - rafSeen > 250) frame(t);
}, 33);

function frame(now) {
  const dt = Math.min(250, now - last);
  last = now;
  pollGamepads();
  const lw = widthFor(layoutNow());
  if (lw !== LW) layout();
  if (current && !portMenu?.isOpen) current.update?.(dt, now);
  R.shake = opts.shake && now < shakeUntil ? 1 : 0;
  R.begin(LW, 80);
  if (current) current.render(R, now);
  R.present();
  fpsCount++;
  if (now - fpsT > 500) {
    if (opts.showFps) $('fps').textContent = `${Math.round((fpsCount * 1000) / (now - fpsT))} fps`;
    fpsCount = 0;
    fpsT = now;
  }
}

/* ---------------- canvas pointer -> phone UI ---------------- */

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * LW, ((e.clientY - r.top) / r.height) * 80];
}
canvas.addEventListener('pointerdown', (e) => {
  if (!current?.pointer) return;
  e.preventDefault();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignore */
  }
  current.pointer('down', ...canvasPoint(e), LW);
});
canvas.addEventListener('pointermove', (e) => current?.pointer?.('move', ...canvasPoint(e), LW));
canvas.addEventListener('pointerup', (e) => current?.pointer?.('up', ...canvasPoint(e), LW));
canvas.addEventListener('pointercancel', () => current?.pointer?.('cancel', 0, 0, LW));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------- focus / visibility (hideNotify / showNotify) ---------------- */

function autoPause() {
  if (!gameScreen || current !== gameScreen || !opts.pauseOnBlur) return;
  const g = gameScreen.game;
  if (g.running && !g.paused && !g.gameOver) {
    g.paused = true;
    g.pauseOverlay = true;
    Keys.consume();
  }
}
document.addEventListener('visibilitychange', () => {
  if (gameScreen) gameScreen.game.shown = !document.hidden;
  if (document.hidden) autoPause();
  if (audio.ctx) {
    if (document.hidden) audio.ctx.suspend().catch(() => {});
    else audio.ctx.resume().catch(() => {});
  }
});
window.addEventListener('blur', autoPause);

/* ---------------- boot ---------------- */

function loadImage(name) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(name));
    im.src = `assets/img/${name}.png`;
  });
}

/** Background for the 17 column field: the 97px wall widened with a repeated slice. */
function buildWideBack(back, cols) {
  const w = cols * 8 + 1;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = back.height;
  const x = c.getContext('2d');
  const extra = w - back.width;
  x.drawImage(back, 0, 0, 48, back.height, 0, 0, 48, back.height);
  for (let o = 0; o < extra; o += 40) {
    const n = Math.min(40, extra - o);
    x.drawImage(back, 8, 0, n, back.height, 48 + o, 0, n, back.height);
  }
  x.drawImage(back, 48, 0, back.width - 48, back.height, 48 + extra, 0, back.width - 48, back.height);
  return c;
}

async function boot() {
  applyLang();
  applyOptions();
  installKeyboard(keyBindings, () => Keys.context === 'text' && document.activeElement === $('textin'));
  installTouch({ haptics: () => opts.haptics });
  portMenu = new PortMenu($('portmenu'), {
    inGame: () => !!gameScreen && current === gameScreen && gameScreen.game.running,
    onOpen: () => {
      Keys.releaseAll();
      Keys.listener = null;
      if (gameScreen) gameScreen.suspended = true;
    },
    onClose: () => {
      Keys.listener = current;
      if (gameScreen) {
        gameScreen.suspended = false;
        gameScreen.acc = 0;
      }
      layout();
    },
    restartGame: () => {
      if (!gameScreen) return;
      gameScreen.restart = true;
      gameScreen.game.gameOver = true;
      gameScreen.game.running = false;
    },
    endGame: () => {
      if (!gameScreen) return;
      const g = gameScreen.game;
      g.gameOver = true; // same as the red "end call" key
      g.overWait = 0;
      g.running = false;
    },
    fullscreen: toggleFullscreen,
    saveState,
    loadState,
    hasState,
    strings: () => S,
    toast,
  });
  Keys.meta = (a) => {
    if (a === 'MENU') {
      if (current instanceof TextBoxScreen && document.activeElement === $('textin')) return;
      portMenu.toggle();
    } else if (a === 'FS') toggleFullscreen();
  };
  $('btn-menu').addEventListener('click', () => portMenu.toggle());
  $('btn-fs').addEventListener('click', toggleFullscreen);
  $('textin').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      $('textin').blur();
    }
  });

  window.addEventListener('resize', layout);
  window.visualViewport?.addEventListener('resize', layout);
  screen.orientation?.addEventListener?.('change', () => setTimeout(layout, 120));
  document.addEventListener('fullscreenchange', () => setTimeout(layout, 60));
  layout();
  requestAnimationFrame(rafLoop);

  // a black phone screen until it is switched on
  current = { context: 'none', render: (r) => r.fillRect(0, 0, r.lw, 80, '#000') };

  const status = $('load-status');
  const power = $('power');
  power.disabled = true;
  status.textContent = ui('loading');
  try {
    const imgs = await Promise.all(IMAGES.map(loadImage));
    IMAGES.forEach((n, i) => (assets.img[n] = imgs[i]));
    wideBack = buildWideBack(assets.img.back, 17);
    await audio.load('assets/');
  } catch (e) {
    console.error(e);
    status.textContent = ui('loadFail');
    return;
  }
  status.textContent = '';
  $('power-hint').textContent = ui('powerHint');
  power.disabled = false;

  let started = false;
  const go = async (e) => {
    if (started) return;
    if (e && e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey)) return;
    started = true;
    window.removeEventListener('keydown', go, true);
    $('splash').removeEventListener('pointerup', go);
    e?.preventDefault?.();
    await audio.unlock();
    $('splash').classList.add('gone');
    setTimeout(() => ($('splash').hidden = true), 450);
    startApp();
  };
  power.addEventListener('click', go);
  $('splash').addEventListener('pointerup', go);
  window.addEventListener('keydown', go, true);
}

boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// handy for debugging from the console
window.SA2 = { get game() { return gameScreen?.game; }, opts, rec, audio, Keys, K };
