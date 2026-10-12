// Input layer: keyboard, gamepad and on-screen controls all end up here and are
// turned into the key codes the MIDlet expected (after Siemens' getGameAction()).

export const K = {
  UP: 1,
  LEFT: 2,
  RIGHT: 5,
  DOWN: 6,
  FIRE: 8,
  STAR: 42,
  POUND: 35,
  N0: 48,
  N1: 49,
  N2: 50,
  N3: 51,
  N4: 52,
  N5: 53,
  N6: 54,
  N7: 55,
  N8: 56,
  N9: 57,
  LSK: -1,
  RSK: -4,
  RED: -12,
};

/** b.c(int): number keys 2/4/6/8 become UP/LEFT/RIGHT/DOWN, '5' stays '5'. */
export function mapKey(raw) {
  switch (raw) {
    case 50:
      return K.UP;
    case 52:
      return K.LEFT;
    case 54:
      return K.RIGHT;
    case 56:
      return K.DOWN;
  }
  return raw;
}

// Logical actions. Context decides what code they produce.
export const ACTIONS = ['L', 'R', 'U', 'D', 'JUMP', 'J1', 'J3', 'SUPER', 'BOMB', 'PAUSE', 'FIRE', 'LSK', 'RSK', 'RED', 'MENU', 'FS'];
const DIGITS = { K0: 48, K1: 49, K2: 50, K3: 51, K4: 52, K5: 53, K6: 54, K7: 55, K8: 56, K9: 57, STAR: 42, POUND: 35 };

export const DEFAULT_KEYS = {
  L: ['ArrowLeft', 'KeyA'],
  R: ['ArrowRight', 'KeyD'],
  U: ['ArrowUp', 'KeyW'],
  D: ['ArrowDown', 'KeyS'],
  JUMP: ['Space', 'KeyK'],
  J1: ['KeyQ'],
  J3: ['KeyE'],
  SUPER: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyL'],
  BOMB: ['KeyC', 'KeyB', 'NumpadMultiply'],
  PAUSE: ['KeyP'],
  FIRE: ['Enter', 'NumpadEnter'],
  LSK: ['BracketLeft'],
  RSK: ['Backspace', 'BracketRight'],
  RED: ['Delete', 'End'],
  MENU: ['Escape'],
  FS: ['KeyF'],
};

const NUMPAD = {};
for (let i = 0; i <= 9; i++) {
  NUMPAD['Digit' + i] = 'K' + i;
  NUMPAD['Numpad' + i] = 'K' + i;
}

class KeyState {
  constructor() {
    this.an = 0; // b.an : last key code
    this.ac = 0; // b.ac : 1 pressed, 2 repeated, 0 released
    this.held = []; // {id, action, used}
    this.pending = null; // buffered tap (port enhancement)
    this.context = 'menu'; // 'game' | 'menu' | 'text' | 'none'
    this.listener = null;
    this.meta = null; // handler for MENU / FS
    this.buffer = true;
    this.repeatTimer = null;
  }

  /** What an action means right now. */
  resolve(action) {
    if (action in DIGITS) return mapKey(DIGITS[action]);
    const game = this.context === 'game';
    switch (action) {
      case 'L':
        return K.LEFT;
      case 'R':
        return K.RIGHT;
      case 'D':
        return K.DOWN;
      case 'U':
        return game ? this.jumpCode() : K.UP;
      case 'JUMP':
        return game ? this.jumpCode() : K.FIRE;
      case 'J1':
        return K.N1;
      case 'J3':
        return K.N3;
      case 'SUPER':
        return game ? K.N5 : K.RSK;
      case 'BOMB':
        return K.STAR;
      case 'PAUSE':
        return game ? K.N0 : 0;
      case 'FIRE':
        return K.FIRE;
      case 'LSK':
        return K.LSK;
      case 'RSK':
        return K.RSK;
      case 'RED':
        return K.RED;
    }
    return 0;
  }

  /** Direction-aware jump: '1' / '2' / '3' depending on the held direction. */
  jumpCode() {
    let l = false,
      r = false;
    for (const h of this.held) {
      if (h.action === 'L') l = true;
      if (h.action === 'R') r = true;
    }
    if (!this.dirJump) return K.UP;
    if (l && !r) return K.N1;
    if (r && !l) return K.N3;
    return K.UP;
  }

  isHeld(action) {
    return this.held.some((h) => h.action === action);
  }

  press(id, action) {
    if (action === 'MENU' || action === 'FS') {
      if (this.meta) this.meta(action);
      return;
    }
    if (this.held.some((h) => h.id === id)) return;
    this.held.push({ id, action, used: false });
    const code = this.resolve(action);
    if (!code) return;
    this.an = code;
    this.ac = 1;
    if (this.context === 'game') this.pending = { an: code, ttl: 4 };
    if (this.listener) this.listener.keyPressed?.(code, action);
    this.startRepeat(id, code, action);
  }

  release(id) {
    const i = this.held.findIndex((h) => h.id === id);
    if (i < 0) return;
    const [h] = this.held.splice(i, 1);
    const code = this.resolve(h.action);
    this.stopRepeat(id);
    if (this.held.length) {
      const top = this.held[this.held.length - 1];
      this.an = this.resolve(top.action);
      this.ac = 1;
    } else {
      this.an = code;
      this.ac = 0;
    }
    if (this.listener) this.listener.keyReleased?.(code, h.action);
  }

  releaseAll() {
    for (const h of [...this.held]) this.release(h.id);
    this.pending = null;
  }

  startRepeat(id, code, action) {
    this.stopRepeat();
    if (this.context === 'game') return;
    if (code !== K.UP && code !== K.DOWN && code !== K.LEFT && code !== K.RIGHT) return;
    this.repeatId = id;
    this.repeatTimer = setTimeout(() => {
      this.repeatTimer = setInterval(() => {
        if (!this.held.some((h) => h.id === id)) return this.stopRepeat();
        this.ac = 2;
        this.listener?.keyRepeated?.(code, action);
      }, 110);
    }, 380);
  }
  stopRepeat(id) {
    if (id !== undefined && id !== this.repeatId) return;
    clearTimeout(this.repeatTimer);
    clearInterval(this.repeatTimer);
    this.repeatTimer = null;
  }

  /** Game side: the key state for this 111 ms frame. */
  sample() {
    const live = { raw: this.an, rawAc: this.ac };
    // keys the game already consumed (b.an = 0) stay silent until released, like on the phone
    const held = this.held.filter((h) => !h.used);
    if (held.length) {
      // a held jump wins over walking so "jump + direction" jumps that way
      let top = held[held.length - 1];
      const jump = held.find((h) => h.action === 'JUMP' || h.action === 'U');
      if (jump && (top.action === 'L' || top.action === 'R') && this.dirJump) top = jump;
      const an = this.resolve(top.action);
      if (an) return { an, ac: 1, ...live };
    }
    if (this.buffer && this.pending) return { an: this.pending.an, ac: 1, pend: true, ...live };
    return { an: this.an, ac: this.ac, ...live };
  }

  afterTick(used) {
    if (!this.pending) return;
    if (used || --this.pending.ttl <= 0) this.pending = null;
  }

  consume() {
    this.an = 0;
    this.pending = null;
    for (const h of this.held) h.used = true;
  }
}

export const Keys = new KeyState();

/* ---------------- keyboard ---------------- */

export function installKeyboard(getBindings, isTextMode) {
  const lookup = () => {
    const map = {};
    const b = getBindings();
    for (const a of Object.keys(b)) for (const code of b[a]) (map[code] ||= []).push(a);
    return map;
  };
  let map = lookup();
  window.addEventListener('sa2-bindings', () => (map = lookup()));

  const actionsFor = (e) => {
    const list = [...(map[e.code] || [])];
    if (NUMPAD[e.code]) list.push(NUMPAD[e.code]);
    if (e.key === '*' && !list.includes('BOMB')) list.push('STAR');
    if (e.key === '#') list.push('POUND');
    return list;
  };

  window.addEventListener(
    'keydown',
    (e) => {
      if (isTextMode()) return; // the text box handles its own keys
      if (e.target && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName) && !e.target.dataset.game) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const acts = actionsFor(e);
      if (!acts.length) return;
      e.preventDefault();
      if (e.repeat) return;
      // a digit pressed alongside a game binding: prefer the binding
      const a = acts.find((x) => !(x in DIGITS)) || acts[0];
      Keys.press('kb:' + e.code, a);
    },
    { capture: false }
  );
  window.addEventListener('keyup', (e) => {
    Keys.release('kb:' + e.code);
  });
  window.addEventListener('blur', () => Keys.releaseAll());
}

/* ---------------- gamepad ---------------- */

const PAD_BUTTONS = {
  0: 'JUMP',
  1: 'SUPER',
  2: 'BOMB',
  3: 'FIRE',
  4: 'LSK',
  5: 'RSK',
  8: 'MENU',
  9: 'PAUSE',
  12: 'U',
  13: 'D',
  14: 'L',
  15: 'R',
};
const padPrev = new Map();

export function pollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = false;
  for (const p of pads) {
    if (!p) continue;
    any = true;
    const state = {};
    for (const [i, a] of Object.entries(PAD_BUTTONS)) {
      const b = p.buttons[i];
      if (b && (b.pressed || b.value > 0.5)) state['b' + i] = a;
    }
    const ax = p.axes[0] || 0,
      ay = p.axes[1] || 0;
    if (ax < -0.5) state.axL = 'L';
    if (ax > 0.5) state.axR = 'R';
    if (ay < -0.6) state.axU = 'U';
    if (ay > 0.6) state.axD = 'D';
    const prev = padPrev.get(p.index) || {};
    for (const k of Object.keys(state)) if (!prev[k]) Keys.press(`gp${p.index}:${k}`, state[k]);
    for (const k of Object.keys(prev)) if (!state[k]) Keys.release(`gp${p.index}:${k}`);
    padPrev.set(p.index, state);
  }
  return any;
}
