// Minimal re-implementation of the bits of MIDP / com.siemens.mp.color_game
// that Stack Attack 2 relies on: Sprite, LayerManager and java.util.Random.

/** Wraps a number the way a Java (byte) cast does. */
export const byte = (v) => (v << 24) >> 24;
/** Java int division (truncates toward zero). */
export const idiv = (a, b) => Math.trunc(a / b) | 0;
/** Java Math.abs(int): abs(MIN_VALUE) stays negative. */
export const jabs = (v) => (v === -2147483648 ? v : Math.abs(v));

const MASK48 = (1n << 48n) - 1n;
const MULT = 0x5deece66dn;

/** java.util.Random, bit-exact. */
export class JavaRandom {
  constructor(seed = Date.now()) {
    this.setSeed(seed);
  }
  setSeed(seed) {
    this.seed = (BigInt(Math.floor(seed)) ^ MULT) & MASK48;
  }
  next(bits) {
    this.seed = (this.seed * MULT + 0xbn) & MASK48;
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextInt() {
    return this.next(32);
  }
}

/** Fixed-size frame sprite with MIDP2-like semantics. */
export class Sprite {
  constructor(img, fw, fh) {
    this.img = img;
    this.fw = fw ?? img.width;
    this.fh = fh ?? img.height;
    this.cols = Math.max(1, Math.floor(img.width / this.fw));
    this.frames = this.cols * Math.max(1, Math.floor(img.height / this.fh));
    this.frame = 0;
    this.x = 0;
    this.y = 0;
    // previous-tick position, used for optional frame interpolation
    this.ix = 0;
    this.iy = 0;
    this.visible = true;
    this.cx = 0;
    this.cy = 0;
    this.cw = this.fw;
    this.ch = this.fh;
  }
  setFrame(f) {
    // MIDP throws on a bad index; clamp instead so a corner case can't kill the game loop
    this.frame = f < 0 ? 0 : f >= this.frames ? this.frames - 1 : f;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  setVisible(v) {
    this.visible = !!v;
  }
  isVisible() {
    return this.visible;
  }
  setCollisionRectangle(x, y, w, h) {
    this.cx = x;
    this.cy = y;
    this.cw = w;
    this.ch = h;
  }
  /** collidesWith(sprite, pixelLevel=false) */
  collidesWith(o) {
    if (!this.visible || !o.visible) return false;
    const ax = this.x + this.cx,
      ay = this.y + this.cy,
      bx = o.x + o.cx,
      by = o.y + o.cy;
    return ax < bx + o.cw && bx < ax + this.cw && ay < by + o.ch && by < ay + this.ch;
  }
  snap() {
    this.ix = this.x;
    this.iy = this.y;
  }
  paint(r, ox, oy) {
    if (!this.visible) return;
    const sx = (this.frame % this.cols) * this.fw;
    const sy = Math.floor(this.frame / this.cols) * this.fh;
    r.sprite(this, sx, sy, ox, oy);
  }
}

/** Index 0 is drawn last (on top), like javax.microedition.lcdui.game.LayerManager. */
export class LayerManager {
  constructor() {
    this.layers = [];
  }
  append(l) {
    const i = this.layers.indexOf(l);
    if (i >= 0) this.layers.splice(i, 1);
    this.layers.push(l);
  }
  paint(r, ox, oy) {
    for (let i = this.layers.length - 1; i >= 0; i--) this.layers[i].paint(r, ox, oy);
  }
}

/** Promise helper for awaiting a duration. */
export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
