// Draws the 101x80 (or wider) logical screen onto the page canvas.
// Everything is drawn directly at device resolution with edge snapping, which
// keeps pixels crisp at any scale and allows sub-pixel smooth motion.

import { fontAtlas, layoutText } from './font.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.view = canvas.getContext('2d', { alpha: false });
    this.buf = document.createElement('canvas');
    this.ctx = this.buf.getContext('2d', { alpha: false });
    this.lw = 101;
    this.lh = 80;
    this.s = 1;
    this.alpha = 1;
    this.interp = false;
    this.filter = 'sharp'; // sharp | lcd | scan | soft
    this.ghost = 0;
    this.shake = 0;
    this.ox = 0;
    this.oy = 0;
  }

  /** Called every frame before drawing. */
  begin(lw, lh) {
    this.lw = lw;
    this.lh = lh;
    const W = this.canvas.width,
      H = this.canvas.height;
    const soft = this.filter === 'soft';
    const bw = soft ? lw : W,
      bh = soft ? lh : H;
    if (this.buf.width !== bw || this.buf.height !== bh) {
      this.buf.width = bw;
      this.buf.height = bh;
    }
    this.s = bw / lw;
    this.sy = bh / lh;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, bw, bh);
    this.useInterp = this.interp && !soft;
    this.ox = 0;
    this.oy = 0;
  }

  X(x) {
    return Math.round((x + this.ox) * this.s);
  }
  Y(y) {
    return Math.round((y + this.oy) * this.sy);
  }

  img(img, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
    const x0 = this.X(dx),
      y0 = this.Y(dy),
      x1 = this.X(dx + dw),
      y1 = this.Y(dy + dh);
    if (x1 <= x0 || y1 <= y0) return;
    this.ctx.drawImage(img, sx, sy, sw, sh, x0, y0, x1 - x0, y1 - y0);
  }

  /** Draw a whole image at logical position. */
  image(img, x, y) {
    this.img(img, 0, 0, img.width, img.height, x, y);
  }

  sprite(sp, sx, sy, ox, oy) {
    let x = sp.x,
      y = sp.y;
    if (this.useInterp) {
      const dx = x - sp.ix,
        dy = y - sp.iy;
      if (dx * dx + dy * dy <= 16 * 16 + 1) {
        x = sp.ix + dx * this.alpha;
        y = sp.iy + dy * this.alpha;
      }
    }
    this.img(sp.img, sx, sy, sp.fw, sp.fh, x + ox, y + oy);
  }

  fillRect(x, y, w, h, color) {
    const x0 = this.X(x),
      y0 = this.Y(y),
      x1 = this.X(x + w),
      y1 = this.Y(y + h);
    if (x1 <= x0 || y1 <= y0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  /** MIDP drawRect: the outline covers (w+1) x (h+1) pixels. */
  rect(x, y, w, h, color) {
    this.fillRect(x, y, w + 1, 1, color);
    this.fillRect(x, y + h, w + 1, 1, color);
    this.fillRect(x, y, 1, h + 1, color);
    this.fillRect(x + w, y, 1, h + 1, color);
  }

  /** Vertical gradient made of 1px bands, like an old phone theme. */
  gradient(x, y, w, h, top, bottom) {
    const a = hex(top),
      b = hex(bottom);
    for (let i = 0; i < h; i++) {
      const t = h > 1 ? i / (h - 1) : 0;
      const c = `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
      this.fillRect(x, y + i, w, 1, c);
    }
  }

  text(s, x, y, color = '#000') {
    const atlas = fontAtlas(color);
    return layoutText(String(s), x, y, (ax, ay, w, h, dx, dy) => this.img(atlas, ax, ay, w, h, dx, dy));
  }

  clip(x, y, w, h) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(this.X(x), this.Y(y), this.X(x + w) - this.X(x), this.Y(y + h) - this.Y(y));
    c.clip();
  }
  unclip() {
    this.ctx.restore();
  }

  /** Composite the finished frame onto the visible canvas, with the chosen filter. */
  present() {
    const v = this.view;
    const W = this.canvas.width,
      H = this.canvas.height;
    v.setTransform(1, 0, 0, 1, 0, 0);
    let dx = 0,
      dy = 0;
    if (this.shake > 0) {
      const amp = Math.max(1, Math.round(this.s * 0.8));
      dx = Math.round((Math.random() * 2 - 1) * amp);
      dy = Math.round((Math.random() * 2 - 1) * amp);
    }
    if (dx || dy) {
      v.fillStyle = '#000';
      v.fillRect(0, 0, W, H);
    }
    v.imageSmoothingEnabled = this.filter === 'soft';
    v.imageSmoothingQuality = 'high';
    v.globalAlpha = this.ghost > 0 ? 1 - this.ghost : 1;
    v.drawImage(this.buf, dx, dy, W, H);
    v.globalAlpha = 1;
    if (this.filter === 'lcd' && this.s >= 2.5) this.lcdGrid(v, W, H);
    else if (this.filter === 'scan' && this.sy >= 2) this.scanlines(v, W, H);
  }

  lcdGrid(v, W, H) {
    const t = Math.max(1, Math.round(this.s * 0.14));
    v.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 1; i < this.lw; i++) v.fillRect(Math.round((i * W) / this.lw) - (t >> 1), 0, t, H);
    for (let j = 1; j < this.lh; j++) v.fillRect(0, Math.round((j * H) / this.lh) - (t >> 1), W, t);
  }

  scanlines(v, W, H) {
    const t = Math.max(1, Math.round(this.sy * 0.38));
    v.fillStyle = 'rgba(0,0,0,0.33)';
    for (let j = 0; j < this.lh; j++) v.fillRect(0, Math.round(((j + 1) * H) / this.lh) - t, W, t);
  }
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
