// LCDUI look-alikes (List, Form, Alert, TextBox) drawn in the style of a
// Siemens x55 phone. The MIDlet used the phone's native UI for every menu.

import { K } from './input.js';
import { textWidth, wrapText, LINE_H } from './font.js';

export const THEME = {
  headTop: '#5a92e6',
  headBot: '#1b3f8c',
  headLine: '#0a1f4d',
  headText: '#ffffff',
  body: '#ffffff',
  text: '#000000',
  dim: '#7a7a7a',
  selTop: '#6aa6f2',
  selBot: '#2556b0',
  selText: '#ffffff',
  softTop: '#f6f6f6',
  softBot: '#c2c2c2',
  softLine: '#7c7c7c',
  softText: '#000000',
  track: '#e2e2e2',
  thumb: '#3a6fc8',
};
const HEAD_H = 12;
const SOFT_H = 12;
const H = 80;
const BODY_Y = HEAD_H;
const BODY_H = H - HEAD_H - SOFT_H;

function fit(s, maxW) {
  if (textWidth(s) <= maxW) return s;
  while (s.length > 1 && textWidth(s + '…') > maxW) s = s.slice(0, -1);
  return s + '…';
}

export function drawHeader(R, W, title) {
  R.gradient(0, 0, W, HEAD_H - 1, THEME.headTop, THEME.headBot);
  R.fillRect(0, HEAD_H - 1, W, 1, THEME.headLine);
  const t = fit(title, W - 6);
  R.text(t, (W - textWidth(t)) >> 1, 0, THEME.headText);
}

export function drawSoftkeys(R, W, left, right, mid) {
  const y = H - SOFT_H;
  R.fillRect(0, y, W, 1, THEME.softLine);
  R.gradient(0, y + 1, W, SOFT_H - 1, THEME.softTop, THEME.softBot);
  const half = (W >> 1) - 8;
  if (left) R.text(fit(left, half), 2, y, THEME.softText);
  if (right) {
    const t = fit(right, half);
    R.text(t, W - 2 - textWidth(t), y, THEME.softText);
  }
  if (mid) {
    const cx = W >> 1;
    if (mid.up) {
      R.fillRect(cx - 2, y + 4, 5, 1, THEME.softText);
      R.fillRect(cx - 1, y + 3, 3, 1, THEME.softText);
      R.fillRect(cx, y + 2, 1, 1, THEME.softText);
    }
    if (mid.down) {
      R.fillRect(cx - 2, y + 7, 5, 1, THEME.softText);
      R.fillRect(cx - 1, y + 8, 3, 1, THEME.softText);
      R.fillRect(cx, y + 9, 1, 1, THEME.softText);
    }
  }
}

function drawScrollbar(R, W, first, visible, total) {
  if (total <= visible) return;
  const x = W - 3;
  R.fillRect(x, BODY_Y + 1, 2, BODY_H - 2, THEME.track);
  const h = Math.max(4, Math.round(((BODY_H - 2) * visible) / total));
  const y = BODY_Y + 1 + Math.round(((BODY_H - 2 - h) * first) / Math.max(1, total - visible));
  R.fillRect(x, y, 2, h, THEME.thumb);
}

/** Common pointer handling: tap on soft keys, drag to scroll. */
class Base {
  constructor() {
    this.context = 'menu';
    this.drag = null;
  }
  softAt(x, y, W) {
    if (y < H - SOFT_H) return null;
    return x < W / 2 ? K.LSK : K.RSK;
  }
  pointer(type, x, y, W) {
    if (type === 'down') {
      this.drag = { x, y, y0: y, moved: false, scroll0: this.scrollPos?.() ?? 0 };
      return;
    }
    if (!this.drag) return;
    if (type === 'move') {
      if (Math.abs(y - this.drag.y0) > 3) this.drag.moved = true;
      if (this.drag.moved && this.dragScroll) this.dragScroll(this.drag.scroll0, this.drag.y0 - y);
      return;
    }
    if (type === 'up') {
      const d = this.drag;
      this.drag = null;
      if (d.moved) return;
      const sk = this.softAt(x, y, W);
      if (sk) return this.keyPressed(sk);
      this.tap?.(x, y, W);
    }
  }
}

/* ---------------- List ---------------- */

export class ListScreen extends Base {
  /**
   * items: [{label, icon?}] ; type: 'implicit' | 'multiple'
   * left/right: {label, id} soft keys ; onDone({index, id, flags})
   */
  constructor(o) {
    super();
    Object.assign(this, { type: 'implicit', selected: 0, flags: null }, o);
    this.sel = Math.min(this.selected, this.items.length - 1);
    this.top = 0;
    this.itemH = this.items.some((i) => i.icon) ? 17 : 11;
    this.vis = Math.max(1, Math.floor(BODY_H / this.itemH));
    this.ensure();
  }
  ensure() {
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + this.vis) this.top = this.sel - this.vis + 1;
  }
  scrollPos() {
    return this.top;
  }
  dragScroll(start, dy) {
    const max = Math.max(0, this.items.length - this.vis);
    this.top = Math.max(0, Math.min(max, start + Math.round(dy / this.itemH)));
  }
  move(d) {
    const n = this.items.length;
    this.sel = (this.sel + d + n) % n;
    this.ensure();
  }
  keyPressed(code) {
    switch (code) {
      case K.UP:
        return this.move(-1);
      case K.DOWN:
        return this.move(1);
      case K.FIRE:
      case K.N5:
        if (this.type === 'multiple') return this.toggle();
        return this.done({ index: this.sel });
      case K.LSK:
        if (this.left) {
          if (this.type === 'multiple' && this.left.toggle) return this.toggle();
          return this.done({ index: this.sel, id: this.left.id });
        }
        return;
      case K.RSK:
        if (this.right) return this.done({ index: this.sel, id: this.right.id });
        return;
    }
    // number keys pick an entry directly, like on the phone
    if (code >= K.N1 && code <= K.N9 && code - K.N1 < this.items.length && this.type === 'implicit') {
      this.sel = code - K.N1;
      this.ensure();
    }
  }
  keyRepeated(code) {
    if (code === K.UP || code === K.DOWN) this.keyPressed(code);
  }
  toggle() {
    this.flags[this.sel] = !this.flags[this.sel];
  }
  tap(x, y) {
    if (y < BODY_Y || y >= BODY_Y + BODY_H) return;
    const i = this.top + Math.floor((y - BODY_Y) / this.itemH);
    if (i < 0 || i >= this.items.length) return;
    this.sel = i;
    if (this.type === 'multiple') this.toggle();
    else this.done({ index: i });
  }
  done(r) {
    if (this.flags) r.flags = [...this.flags];
    this.onDone?.(r);
  }
  render(R) {
    const W = R.lw;
    R.fillRect(0, 0, W, H, THEME.body);
    drawHeader(R, W, this.title);
    const scroll = this.items.length > this.vis;
    const iw = W - (scroll ? 5 : 1);
    for (let k = 0; k < this.vis; k++) {
      const i = this.top + k;
      if (i >= this.items.length) break;
      const it = this.items[i];
      const y = BODY_Y + k * this.itemH;
      const sel = i === this.sel;
      if (sel) R.gradient(1, y, iw - 1, this.itemH, THEME.selTop, THEME.selBot);
      const col = sel ? THEME.selText : it.dim ? THEME.dim : THEME.text;
      let tx = 3;
      if (this.type === 'multiple') {
        const by = y + 2;
        R.fillRect(3, by, 7, 7, '#ffffff');
        R.rect(3, by, 6, 6, sel ? '#ffffff' : '#555555');
        if (this.flags[i]) {
          const c = '#1d8a1d';
          R.fillRect(4, by + 3, 1, 2, c);
          R.fillRect(5, by + 4, 1, 2, c);
          R.fillRect(6, by + 3, 1, 2, c);
          R.fillRect(7, by + 2, 1, 2, c);
          R.fillRect(8, by + 1, 1, 2, c);
        }
        tx = 13;
      }
      if (it.icon) {
        R.image(it.icon, 3, y);
        tx = 14;
      }
      const ty = y + ((this.itemH - LINE_H) >> 1);
      R.text(fit(it.label, iw - tx - 2), tx, ty, col);
    }
    drawScrollbar(R, W, this.top, this.vis, this.items.length);
    drawSoftkeys(R, W, this.left?.label, this.right?.label, scroll ? { up: this.top > 0, down: this.top + this.vis < this.items.length } : null);
  }
}

/* ---------------- Form / Alert ---------------- */

export class FormScreen extends Base {
  /** title, text, left, right ({label,id}), menu: [{label,id}] for an "Options" soft key */
  constructor(o) {
    super();
    Object.assign(this, o);
    this.scroll = 0;
    this.lineH = 10;
    this.vis = Math.floor((BODY_H - 2) / this.lineH);
    this.popup = null;
    this.wrapW = 0;
  }
  layout(W) {
    if (this.wrapW === W) return;
    this.wrapW = W;
    this.lines = wrapText(this.text, W - 9);
  }
  scrollPos() {
    return this.scroll;
  }
  dragScroll(start, dy) {
    this.scroll = Math.max(0, Math.min(this.maxScroll(), start + Math.round(dy / this.lineH)));
  }
  maxScroll() {
    return Math.max(0, (this.lines?.length || 0) - this.vis);
  }
  keyPressed(code) {
    if (this.popup) return this.popupKey(code);
    switch (code) {
      case K.UP:
        this.scroll = Math.max(0, this.scroll - 1);
        return;
      case K.DOWN:
        this.scroll = Math.min(this.maxScroll(), this.scroll + 1);
        return;
      case K.FIRE:
      case K.N5:
      case K.LSK:
        if (this.menu) {
          this.popup = { sel: 0 };
          return;
        }
        if (this.left) return this.onDone?.({ id: this.left.id });
        return;
      case K.RSK:
        if (this.right) return this.onDone?.({ id: this.right.id });
        return;
    }
  }
  keyRepeated(code) {
    if (code === K.UP || code === K.DOWN) this.keyPressed(code);
  }
  popupKey(code) {
    const n = this.menu.length;
    if (code === K.UP) this.popup.sel = (this.popup.sel + n - 1) % n;
    else if (code === K.DOWN) this.popup.sel = (this.popup.sel + 1) % n;
    else if (code === K.FIRE || code === K.LSK || code === K.N5) {
      const it = this.menu[this.popup.sel];
      this.popup = null;
      this.onDone?.({ id: it.id });
    } else if (code === K.RSK) this.popup = null;
  }
  popupRect(W) {
    const n = this.menu.length;
    const h = n * 11 + 2;
    return { x: 6, y: H - SOFT_H - h - 1, w: W - 12, h };
  }
  tap(x, y, W) {
    if (this.popup) {
      const r = this.popupRect(W);
      const i = Math.floor((y - r.y - 1) / 11);
      if (x >= r.x && x < r.x + r.w && i >= 0 && i < this.menu.length) {
        this.popup.sel = i;
        this.popupKey(K.FIRE);
      } else this.popup = null;
    }
  }
  render(R) {
    const W = R.lw;
    this.layout(W);
    R.fillRect(0, 0, W, H, THEME.body);
    drawHeader(R, W, this.title);
    const lines = this.lines;
    for (let k = 0; k < this.vis + 1; k++) {
      const i = this.scroll + k;
      if (i >= lines.length) break;
      const y = BODY_Y + 1 + k * this.lineH;
      if (y + 9 > H - SOFT_H) break;
      R.text(lines[i], 3, y - 1, THEME.text);
    }
    drawScrollbar(R, W, this.scroll, this.vis, lines.length);
    const more = lines.length > this.vis;
    let left = this.menu ? this.optionsLabel : this.left?.label;
    let right = this.right?.label;
    if (this.popup) {
      const r = this.popupRect(W);
      R.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, '#000000');
      R.fillRect(r.x, r.y, r.w, r.h, '#ffffff');
      this.menu.forEach((it, i) => {
        const y = r.y + 1 + i * 11;
        const sel = i === this.popup.sel;
        if (sel) R.gradient(r.x + 1, y, r.w - 2, 11, THEME.selTop, THEME.selBot);
        R.text(`${i + 1} ${it.label}`, r.x + 3, y, sel ? THEME.selText : THEME.text);
      });
      left = this.okLabel;
      right = this.backLabel;
    }
    drawSoftkeys(R, W, left, right, more ? { up: this.scroll > 0, down: this.scroll < this.maxScroll() } : null);
  }
}

/* ---------------- TextBox ---------------- */

export class TextBoxScreen extends Base {
  /** title, value, maxLen, okLabel, clearLabel, input (HTMLInputElement), onDone(value|null) */
  constructor(o) {
    super();
    Object.assign(this, o);
    this.context = 'text';
    this.t0 = performance.now();
  }
  show() {
    const inp = this.input;
    inp.value = this.value || '';
    inp.maxLength = this.maxLen;
    inp.oninput = () => {
      this.value = inp.value.slice(0, this.maxLen);
      this.t0 = performance.now();
    };
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.ok();
      }
    };
    this.focus();
  }
  hide() {
    this.input.oninput = this.input.onkeydown = null;
    this.input.blur();
  }
  focus() {
    try {
      this.input.focus({ preventScroll: true });
      const n = this.input.value.length;
      this.input.setSelectionRange(n, n);
    } catch (e) {
      /* ignore */
    }
  }
  ok() {
    this.onDone?.(this.value.trim());
  }
  keyPressed(code) {
    if (code === K.LSK || code === K.FIRE) return this.ok();
    if (code === K.RSK) {
      this.value = this.value.slice(0, -1);
      this.input.value = this.value;
    }
  }
  tap(x, y) {
    if (y >= BODY_Y && y < H - SOFT_H) this.focus();
  }
  render(R) {
    const W = R.lw;
    R.fillRect(0, 0, W, H, THEME.body);
    drawHeader(R, W, this.title);
    const bx = 3,
      by = BODY_Y + 4,
      bw = W - 7,
      bh = 13;
    R.fillRect(bx, by, bw, bh, '#ffffff');
    R.rect(bx - 1, by - 1, bw + 1, bh + 1, THEME.headBot);
    let s = this.value;
    while (s.length && textWidth(s) > bw - 6) s = s.slice(1);
    const w = R.text(s, bx + 2, by + 1, THEME.text);
    if (((performance.now() - this.t0) / 500) % 2 < 1) R.fillRect(bx + 2 + w + 1, by + 3, 1, 9, THEME.text);
    const cnt = `${this.value.length}/${this.maxLen}`;
    R.text(cnt, W - 3 - textWidth(cnt), by + bh + 2, THEME.dim);
    drawSoftkeys(R, W, this.okLabel, this.value.length ? this.clearLabel : '');
  }
}
