// Canvas screens: loading bar (class f), title sequence (class n), the game
// canvas (class e paint) and a "phone off" screen used by Exit.

import { K, Keys } from './input.js';
import { idiv } from './engine.js';
import { textWidth } from './font.js';
import { CHARACTER_ICONS } from './game.js';

/* ---------------- class f : loading bar ---------------- */
export class LoadingScreen {
  constructor(label, total, ms) {
    this.label = label;
    this.b = total;
    this.a = 0;
    this.ms = ms;
    this.t = 0;
    this.context = 'none';
  }
  update(dt) {
    this.t += dt;
    this.a = Math.min(this.b, Math.floor((this.t / this.ms) * this.b * 1.05));
    if (this.t >= this.ms && !this.fired) {
      this.fired = true;
      this.onDone?.();
    }
  }
  render(R) {
    const W = R.lw;
    R.fillRect(0, 0, W, 80, '#ffffff');
    const d = textWidth(this.label);
    const f = (W - d) >> 1;
    const e = (80 >> 1) + 1 - 4;
    const c = (80 >> 1) - 11 - 4;
    R.rect(f, e, d, 8, '#000000');
    if (this.b > 0 && this.a > 0) {
      let n = idiv((d - 2) * this.a, this.b);
      if (n > d) n = d;
      // the MIDlet's colour formula, int arithmetic and all (red -> orange -> green)
      const q = idiv(this.b << 8, 15);
      const col = (((idiv(this.a << 8, q) * 17) << 8) | ((idiv(15 - (this.a << 8), q) * 17) << 16)) & 0xffffff;
      R.fillRect(f + 1, e + 1, n, 6, '#' + col.toString(16).padStart(6, '0'));
    }
    R.text(this.label, f, c, '#000000');
  }
}

/* ---------------- class n : title sequence ---------------- */
export class TitleScreen {
  /** mode: 'original' | 'quick' | 'skip' */
  constructor(img, mode) {
    this.img = img;
    this.mode = mode;
    this.context = 'menu';
    this.t = mode === 'skip' ? 6000 : 0;
    this.acc = 0;
    this.m = -12800;
    this.g = 0;
    this.v = 128;
    this.a = 0;
    this.fire = false;
  }
  phase() {
    if (this.t < 3000) return 0;
    if (this.t < 6000) return 1;
    if (this.t < 11000) return 2;
    return 3;
  }
  update(dt) {
    this.t += dt;
    this.acc += dt;
    while (this.acc >= 60) {
      this.acc -= 60;
      if (this.phase() === 2 && this.a < 62) {
        // n.paint(): bouncing "Stack Attack 2 Pro" logo, fixed point physics
        ++this.a;
        if ((this.m += this.g += this.v) > 5376) {
          this.m = 5376;
          this.g >>= 2;
          this.g *= -3;
        }
      }
      if (this.t > 6000 && this.fire) return this.finish();
    }
    if (this.phase() === 3) this.finish();
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }
  keyPressed(code) {
    if (code === K.FIRE || code === K.LSK || code === K.RED) this.fire = true;
    if (this.mode === 'quick') {
      const p = this.phase();
      if (p === 0) this.t = 3000;
      else if (p === 1) this.t = 6000;
      else this.fire = true;
    }
  }
  pointer(type) {
    if (type === 'up') this.keyPressed(K.FIRE);
  }
  render(R) {
    const W = R.lw;
    const ox = (W - 101) >> 1;
    const p = this.phase();
    const I = this.img;
    const full = p === 0 ? I.siemens : p === 1 ? I.mos : I.title;
    if (W > 101) {
      // widescreen: soft extension of the picture on both sides
      R.img(full, 0, 0, 1, 80, 0, 0, ox + 1, 80);
      R.img(full, 100, 0, 1, 80, ox + 100, 0, W - ox - 100, 80);
      if (p === 2) R.fillRect(0, 0, W, 80, 'rgba(0,0,0,0.35)');
    }
    R.image(full, ox, 0);
    if (p === 2) R.image(I.logo2, ox, this.m >> 7);
  }
}

/* ---------------- power off (Exit) ---------------- */
export class OffScreen {
  constructor(label) {
    this.label = label;
    this.context = 'menu';
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
  }
  keyPressed() {
    if (this.t > 400) this.onDone?.();
  }
  pointer(type) {
    if (type === 'up') this.keyPressed();
  }
  render(R) {
    const W = R.lw;
    R.fillRect(0, 0, W, 80, '#000');
    if (this.t < 350) {
      // CRT-ish collapse
      const k = 1 - this.t / 350;
      const h = Math.max(1, Math.round(80 * k * k));
      R.fillRect(0, (80 - h) >> 1, W, h, '#9aa');
      return;
    }
    if ((this.t / 700) % 2 < 1.4) {
      const s = this.label;
      R.text(s, (W - textWidth(s)) >> 1, 34, '#555b66');
    }
  }
}

/* ---------------- class e : the game canvas ---------------- */
export class GameScreen {
  constructor(game, env) {
    this.game = game;
    this.env = env; // {opts, S, img, layout, daily}
    this.context = 'game';
    this.acc = 0;
    this.endAt = 0;
    this.suspended = false;
  }
  tickMs() {
    return 111 / (this.env.opts.speed / 100);
  }
  update(dt, now) {
    const g = this.game;
    if (this.suspended) return;
    const ms = this.tickMs();
    this.acc = Math.min(this.acc + dt, ms * 4);
    while (this.acc >= ms) {
      this.acc -= ms;
      if (!g.running) break;
      const k = Keys.sample();
      g.tick(k);
      Keys.afterTick(g.keyUsed);
    }
    if (!g.running && !this.endAt) this.endAt = now + 500;
    if (this.endAt && now >= this.endAt && !this.ended) {
      this.ended = true;
      this.onEnd?.();
    }
  }
  render(R) {
    const g = this.game;
    const { opts, S, img, layout } = this.env;
    R.alpha = g.paused || !g.shown || this.suspended ? 1 : Math.min(1, this.acc / this.tickMs());
    const fieldW = g.cols * 8 + 5;
    R.fillRect(0, 0, R.lw, 80, '#000');
    if (layout === 'wide-hud') {
      R.clip(0, 0, fieldW, 80);
      g.paint(R, 0);
      R.unclip();
      this.panel(R, fieldW);
    } else {
      g.paint(R, 0);
      if (opts.hudScore) this.scoreTag(R, fieldW);
    }
    if (g.gameOver) this.scoreBox(R, fieldW);
    else if (g.pauseOverlay) this.pauseBox(R, fieldW);
  }

  /** e.b(Graphics) */
  scoreBox(R, FW) {
    const s = this.game.score + ' ' + this.env.S.S;
    const n2 = textWidth(s);
    const n3 = (FW - n2) >> 1;
    R.fillRect(n3 - 3, 31, n2 + 7, 13, '#ffffff');
    R.rect(n3 - 4, 30, n2 + 8, 14, '#000000');
    R.text(s, n3, 32, '#000000');
  }
  /** e.a(Graphics) */
  pauseBox(R, FW) {
    const s = this.game.score + ' ' + this.env.S.S;
    const s2 = this.env.S.ac;
    const n3 = (FW - textWidth(s2)) >> 1;
    const n2 = textWidth(s);
    const n4 = (FW - n2) >> 1;
    R.fillRect(n4 - 3, 21, n2 + 7, 26, '#ffffff');
    R.rect(n4 - 4, 20, n2 + 8, 27, '#000000');
    R.text(s2, n3, 22, '#000000');
    R.text(s, n4, 34, '#000000');
  }

  scoreTag(R, FW) {
    const s = String(this.game.score);
    const w = textWidth(s);
    R.fillRect(FW - w - 5, 0, w + 4, 10, 'rgba(0,0,0,0.6)');
    R.text(s, FW - w - 3, -2, '#ffe14a');
  }

  /** Widescreen side panel (port extra). */
  panel(R, x0) {
    const g = this.game;
    const { S, img, opts } = this.env;
    const W = R.lw;
    const pw = W - x0;
    R.gradient(x0, 0, pw, 80, '#1c2030', '#090a0f');
    R.fillRect(x0, 0, 1, 80, '#3b4257');
    const cx = (s) => x0 + ((pw - textWidth(s)) >> 1);
    const label = (s, y, c) => R.text(s, cx(s), y, c);
    const pts = (S.S || 'points').toUpperCase();
    label(pts.length > 7 ? pts.slice(0, 6) : pts, 0, '#7f8aa6');
    label(String(g.score), 9, '#ffe14a');
    label('HI', 21, '#7f8aa6');
    label(String(Math.max(this.env.best || 0, g.score)), 30, '#ffffff');
    // character + crane count
    const icon = img[CHARACTER_ICONS[g.character]];
    R.image(icon, x0 + 5, 45);
    const cr = `${g.activeCranes}/${g.maxCranes}`;
    // tiny crane hook icon above the active/max crane count
    R.fillRect(x0 + 17, 44, 9, 1, '#9aa3b8');
    R.fillRect(x0 + 21, 45, 1, 2, '#9aa3b8');
    R.fillRect(x0 + 19, 47, 5, 1, '#9aa3b8');
    R.fillRect(x0 + 19, 48, 1, 1, '#9aa3b8');
    R.fillRect(x0 + 23, 48, 1, 1, '#9aa3b8');
    R.text(cr, x0 + 16, 50, '#ffffff');
    const secs = Math.floor((g.frameCount * 111) / 1000);
    const tm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    label(tm, 64, this.env.daily ? '#7fd3ff' : '#7f8aa6');
  }
}
