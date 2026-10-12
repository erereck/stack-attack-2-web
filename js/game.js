// Faithful port of the Stack Attack 2 game logic (Mobile Scope AG, 2003).
// Original obfuscated class/field names are kept in comments so every rule
// can be traced back to the decompiled MIDlet:
//   e -> Game, g -> Player, i -> Crate, j -> Crane, l -> Grid.

import { Sprite, LayerManager, byte, jabs } from './engine.js';
import { K } from './input.js';

export const ROWS = 7;

// g.u / g.v / g.t : per character vertical speed, horizontal speed, max super jumps
const SPEED_Y = [[2, 2, 2, 2], [2, 1, 2, 1, 2], [3, 2, 3], [3, 2, 3], [3, 2, 3], [3, 2, 3]];
const SPEED_X = [[2, 2, 2, 2], [3, 2, 3], [3, 2, 3], [3, 2, 3], [3, 2, 3], [3, 2, 3]];
const MAX_JUMPS = [3, 4, 1, 2, 3, 5];
// g.e : first/last animation frame for every player state
const ANIM = [0, 0, 6, 8, 9, 11, 12, 14, 15, 17, 18, 18, 19, 19, 18, 18, 19, 19, 18, 18, 19, 19, 18, 18, 18, 18, 19, 19, 19, 19, 20, 22, 23, 26, 0, 5];
// e.d(int,int) : points for a 3..8 crate combo
const COMBO_POINTS = [50, 80, 120, 200, 300, 500];

// fields captured by save states
const GAME_FIELDS = ['combo', 'score', 'overWait', 'craneCooldown', 'unlockReady', 'unlockDropped', 'unlockOnCrane', 'unlockedNow', 'unlockSaved', 'bombOnScreen', 'hat', 'holdingBomb', 'superJumps', 'gameOver', 'running', 'paused', 'pauseOverlay', 'bonus100', 'blastCol', 'blastRow', 'blastPending', 'soundLock', 'curSpeedX', 'maxJumps', 'tickPitch', 'activeCranes', 'frameCount', 'popX', 'popY', 'popTimer', 'popVis', 'pop3'];
const PLAYER_FIELDS = ['invuln', 'lives', 'step', 'superJump', 'facingRight', 'skipAnim', 'speedX', 'speedY', 'px', 'py', 'moveX', 'moveY', 'anim', 'state', 'prevState', 'animEnd', 'animStart'];

export const CHARACTER_SHEETS =['man', 'woman2', 'man2', 'man3', 'woman', 'man4'];
export const CHARACTER_ICONS = ['iconman', 'icwoman2', 'iconman2', 'iconman3', 'icwoman', 'iconman4'];

/* ------------------------------------------------------------------ */
/* Player (class g)                                                    */
/* ------------------------------------------------------------------ */
class Player extends Sprite {
  constructor(game, img) {
    super(img, 8, 16);
    this.game = game;
    this.setVisible(false);
    this.setCollisionRectangle(0, 0, 8, 16);
    this.invuln = 0; // x
    this.lives = 2; // b
    this.step = 0; // i
    this.superJump = false; // q
    this.facingRight = true; // p
    this.skipAnim = 0; // n
    this.speedX = 0; // m
    this.speedY = 0; // g
    this.px = 0; // f
    this.py = 0; // d
    this.moveX = 0; // z
    this.moveY = 0; // y
    this.anim = 0; // c (current frame)
    this.state = 0; // k
    this.prevState = 0; // a
    this.animEnd = 0; // o
    this.animStart = 0; // h
  }

  /** a(int,int) */
  init(x, y) {
    const G = this.game;
    const ch = G.character;
    this.tableY = SPEED_Y[ch];
    this.tableX = SPEED_X[ch];
    G.maxJumps = MAX_JUMPS[ch];
    this.facingRight = true;
    this.skipAnim = 0;
    this.px = x;
    this.py = y;
    this.state = -1;
    this.moveX = 0;
    this.moveY = 0;
    this.step = 0;
    this.invuln = 0;
    this.lives = G.opts.startLives ?? 2;
    this.setVisible(true);
    this.setState(0);
    this.setPosition(this.px, this.py);
    this.setFrame(this.anim);
  }

  /** d() : called once per frame */
  update() {
    const G = this.game;
    this.animate();
    const vy = this.tableY[this.step];
    if (vy === undefined) this.speedY = 0;
    else {
      this.speedY = vy;
      if (this.superJump) this.speedY = vy + vy;
    }
    if (this.moveY !== 0) {
      this.speedX = this.speedY;
      G.curSpeedX = this.speedX; // static g.l, shared with pushed crates
    } else {
      const vx = this.tableX[this.step];
      if (vx === undefined) this.speedX = 0;
      else {
        this.speedX = vx;
        G.curSpeedX = vx;
      }
    }
    this.step = this.state !== 0 ? byte(this.step + 1) : 0;
    if (this.invuln > 0) {
      this.invuln--;
      if (this.invuln === 20 && this.lives !== -1) this.recover();
    }
    if (this.anim === 22) this.setState(16);
    if (this.moveX < 0) {
      this.moveX += this.speedX;
      this.px -= this.speedX;
    } else if (this.moveX > 0) {
      this.moveX -= this.speedX;
      this.px += this.speedX;
    }
    if (this.moveY < 0) {
      this.moveY += this.speedY;
      this.py -= this.speedY;
    } else if (this.moveY > 0) {
      this.moveY -= this.speedY;
      this.py += this.speedY;
    } else if (this.py % 8 !== 3) {
      this.py -= 8;
      this.py += 3 - (this.py % 8);
    }
    if (this.moveX === 0 && this.moveY === 0) this.setState(0);
    this.setPosition(this.px, this.py);
    return true;
  }

  /** c(int) : start an action, only when idle */
  act(n) {
    const G = this.game;
    if (this.state !== 0) return false;
    this.speedX = 2;
    this.speedY = 2;
    switch (n) {
      case 2:
      case 4:
        this.moveX = -8;
        this.setState(n);
        this.facingRight = false;
        break;
      case 1:
      case 3:
        this.moveX = 8;
        this.setState(n);
        this.facingRight = true;
        break;
      case 9:
        this.moveY = 8;
        this.setState(this.facingRight ? 9 : 10);
        break;
      case 5:
        this.moveY = -8;
        G.sound(4);
        this.setState(this.facingRight ? 5 : 6);
        break;
      case 7:
        this.moveY = -16;
        this.speedY = 4;
        if (!G.opts.cheatJumps) G.superJumps--;
        G.sound(4);
        this.setState(this.facingRight ? 5 : 6);
        this.superJump = true;
        break;
      case 11:
        this.moveY = -8;
        this.moveX = 8;
        G.sound(4);
        this.setState(n);
        this.facingRight = true;
        break;
      case 12:
        this.moveY = 8;
        this.moveX = 8;
        this.setState(n);
        this.facingRight = true;
        break;
      case 13:
        this.moveY = -8;
        this.moveX = -8;
        this.setState(n);
        G.sound(4);
        this.facingRight = false;
        break;
      case 14:
        this.moveY = 8;
        this.moveX = -8;
        this.setState(n);
        this.facingRight = false;
        break;
      case 0:
        if (this.setState(n)) this.skipAnim = 1;
        break;
    }
    return true;
  }

  /** c() : animation sequencer (incl. the random idle "look around") */
  animate() {
    if (this.skipAnim === 1) {
      this.skipAnim--;
      return;
    }
    if (this.animStart !== this.animEnd) {
      if (this.anim >= this.animEnd) {
        if (this.state === 0) {
          this.animEnd = 0;
          this.anim = 0;
        } else this.anim = this.animStart;
      } else this.anim++;
    } else if (this.state === 0) {
      if (this.animEnd === 0) {
        if (jabs(this.game.cosmeticRng.nextInt()) % 7 === 0) this.animEnd = 5;
      } else this.animEnd = 0;
    }
    this.setFrame(this.anim);
  }

  /** b(int) */
  setState(n) {
    if (this.state >= 15 && n !== 16) return false;
    if (this.state === n) return false;
    this.prevState = this.state;
    this.state = n;
    this.step = 0;
    this.superJump = false;
    this.anim = this.animStart = ANIM[n * 2];
    this.animEnd = ANIM[n * 2 + 1];
    return true;
  }

  /** a() : back on the feet after being hit */
  recover() {
    this.state = 0;
    this.step = 0;
    this.superJump = false;
    this.anim = this.animStart = ANIM[0];
    this.animEnd = ANIM[1];
  }

  /** f() */
  prevKind() {
    const a = this.prevState;
    if (a === 5 || a === 6) return 5;
    if (a === 9 || a === 10) return 9;
    return a;
  }
  /** h() */
  kind() {
    const k = this.state;
    if (k === 5 || k === 6) return 5;
    if (k === 9 || k === 10) return 9;
    return k;
  }
  /** g() : grid column */
  col() {
    return (this.px - 4) >> 3;
  }
  /** a(int) : grid row at a vertical offset */
  row(off) {
    return (59 - (this.py + off + 16)) >> 3;
  }

  /** b() : hit by a crate / explosion. Returns true on game over. */
  hit() {
    const G = this.game;
    if (this.invuln === 0) {
      this.setState(15);
      this.px += this.moveX;
      this.moveX = 0;
      this.py += this.moveY;
      this.moveY = 0;
      this.step = 0;
      this.superJump = false;
      G.vibrate(500);
      if (!G.opts.cheatLives) this.lives = byte(this.lives - 1);
      if (this.lives === -1) {
        G.gameOver = true;
        G.overWait = 20;
        G.sound(6);
        return true;
      }
    }
    this.invuln = 50;
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Crate (class i)                                                     */
/* ------------------------------------------------------------------ */
class Crate extends Sprite {
  constructor(game, img) {
    super(img, 8, 8);
    this.game = game;
    this.setVisible(false);
    this.offX = 0; // f
    this.offY = 0; // a
    this.type = 0; // h : 0-3 crates, 4 bomb, 5 hat, 6 +100, 7 jumps, 8 life, 9 new character, 10-13 explosion
    this.state = -1; // c : -1 empty, 0 rest, 1/2 pushed, 3 falling, 4 exploding, 6/7 settling
    this.blink = false; // b
    this.timer = 0; // g
    this.active = false; // d : needs updating this frame
  }

  /** a(byte,int,int,byte) */
  place(state, x, y, type) {
    this.state = state;
    this.type = type;
    this.offY = 0;
    this.timer = 50;
    if (type === 4 && this.game.character !== 5) this.setCollisionRectangle(-7, -7, 15, 15);
    else this.setCollisionRectangle(0, 0, 8, 8);
    this.setVisible(true);
    this.setPosition(x, y);
    this.setFrame(this.type);
  }

  /** shared body of the four timed power-ups */
  powerupTick(x, y) {
    if (this.state === 0) {
      this.blink = !this.blink;
      this.setVisible(this.blink);
      this.timer = byte(this.timer - 1);
      if (this.timer < 0) {
        this.state = -1;
        this.setVisible(false);
        this.active = false;
        this.setPosition(x + this.offX, y + this.offY);
        return true;
      }
    }
    return false;
  }

  /** a(int,int,g,int,int) : per frame update; true = slot emptied (things above must fall) */
  update(x, y, player, col, row) {
    const G = this.game;
    this.active = false;
    if (this.state === -1) return false;
    if (this.state !== 6) {
      if (this.offX < 0) {
        this.active = true;
        this.offX = byte(this.offX + G.curSpeedX);
        if (this.offX === 0 && this.offY === 0) this.state = 6;
      } else if (this.offX > 0) {
        this.active = true;
        this.offX = byte(this.offX - G.curSpeedX);
        if (this.offX === 0 && this.offY === 0) this.state = 6;
      }
      if (this.offY < 0 && this.state !== 4) {
        this.active = true;
        this.offY = byte(this.offY + 2);
        if (this.offY === 0) this.state = y !== 48 ? 6 : 0;
      }
    } else this.state = 7;

    const t = this.type;
    if (t >= 10) {
      this.active = true;
      this.type = byte(this.type + 1);
      if (this.type === 14) {
        this.state = -1;
        this.setVisible(false);
        return true;
      }
      this.setFrame(this.type);
    } else if (t === 5) {
      if (this.powerupTick(x, y)) return true;
      this.active = true;
      if (this.collidesWith(player)) {
        this.state = -1;
        this.setVisible(false);
        G.hat = true;
        G.vibrate(20);
      }
    } else if (t === 7) {
      if (this.powerupTick(x, y)) return true;
      this.active = true;
      if (this.collidesWith(player)) {
        this.state = -1;
        this.setVisible(false);
        if ((G.superJumps += 3) > G.maxJumps) G.superJumps = G.maxJumps;
        G.vibrate(20);
      }
    } else if (t === 8) {
      if (this.powerupTick(x, y)) return true;
      this.active = true;
      if (this.collidesWith(player)) {
        this.state = -1;
        this.setVisible(false);
        player.lives = byte(player.lives + 1);
        G.vibrate(20);
        G.sound(7);
      }
    } else if (t === 6) {
      if (this.powerupTick(x, y)) return true;
      this.active = true;
      if (this.collidesWith(player)) {
        this.state = -1;
        this.setVisible(false);
        G.bonus100 = true;
        G.vibrate(20);
      }
    } else if (t === 9) {
      // the "new character" crate blinks forever: its timer is never decremented
      if (this.state === 0) {
        this.blink = !this.blink;
        this.setVisible(this.blink);
        if (this.timer < 0) {
          this.state = -1;
          this.setVisible(false);
          this.active = false;
          this.setPosition(x + this.offX, y + this.offY);
          return true;
        }
      }
      this.active = true;
      if (this.collidesWith(player)) {
        this.state = -1;
        this.setVisible(false);
        G.unlockCharacter();
        G.vibrate(20);
        G.unlockedNow = true;
      }
    } else if (t === 4) {
      this.active = true;
      if (this.state === 0 && !G.gameOver) {
        switch (this.timer) {
          case 1:
          case 5:
          case 10:
          case 19:
          case 32:
          case 49:
            G.vibrate(50 - this.timer);
            G.tickPitch = this.timer;
            G.sound(5);
            this.setVisible(false);
            break;
          default:
            this.setVisible(true);
        }
        this.timer = byte(this.timer - 1);
        if (this.timer < 0) {
          G.bombOnScreen = false;
          G.blastCol = col;
          G.blastRow = row;
          G.blastPending = true;
          this.type = 10;
          G.vibrate(100);
          G.sound(2);
          this.setCollisionRectangle(-7, -7, 15, 15);
          if (this.collidesWith(player)) player.hit();
        } else if (this.collidesWith(player) && G.character === 5) {
          G.bombOnScreen = false;
          G.holdingBomb = true;
          G.vibrate(20);
          this.state = -1;
          this.setVisible(false);
        }
      }
    }
    this.setPosition(x + this.offX, y + this.offY);
    return false;
  }

  /** a() */
  explode() {
    if (this.state !== 4 && this.state !== -1 && this.type !== 9) {
      this.state = 4;
      this.type = 10;
      this.active = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Crane (class j)                                                     */
/* ------------------------------------------------------------------ */
class Crane extends Sprite {
  constructor(game, img, delay) {
    super(img, 16, 18);
    this.game = game;
    this.setVisible(false);
    this.on = -1; // c
    this.delay = delay; // e
    this.cx_ = 0; // d (x position)
    this.target = 0; // b
    this.dx = 0; // f
    this.cargo = 0; // a (crate type; 10 = empty hook)
  }
  /** d() */
  activate() {
    this.on = 0;
    this.dx = 2;
    this.cx_ = -16;
    this.pick();
    this.setVisible(true);
    this.setPosition(this.cx_, -8);
    this.setFrame(0);
  }
  /** a(int) */
  activateNow() {
    this.activate();
    this.delay = 0;
  }
  /** b() : move; returns the column to drop into, or -1 */
  step() {
    const G = this.game;
    if (this.on === -1) return -1;
    if (this.delay !== 0) {
      this.delay--;
      return -1;
    }
    let col = -1;
    if (this.cx_ === this.target) col = (this.target - 2 + 4) >> 3;
    this.cx_ += this.dx;
    if (this.cx_ > G.craneMaxX || this.cx_ < -16) {
      if (this.cargo === 4) G.bombOnScreen = false;
      this.dx = 0;
      if (G.craneCooldown === 0) {
        if (G.unlockOnCrane && this.cargo === 9) G.unlockOnCrane = false;
        this.pick();
        this.chooseSide();
        G.craneCooldown = 10;
      }
    }
    this.setPosition(this.cx_, -8);
    this.setFrame(this.cargo);
    return col;
  }
  /** c() */
  empty() {
    this.cargo = 10;
  }
  /** f() */
  chooseSide() {
    const G = this.game;
    if (G.gameOver) {
      this.on = -1;
      return;
    }
    if (jabs(G.rng.nextInt()) % 2 === 0) {
      this.cx_ = -16;
      this.dx = 2;
      return;
    }
    this.cx_ = G.craneMaxX;
    this.dx = -2;
  }
  /** a() : choose drop column and cargo */
  pick() {
    const G = this.game;
    const N = G.cols;
    let c = jabs(G.rng.nextInt() % N);
    while (G.reserved[c]) {
      if (++c !== N) continue;
      c = 0;
    }
    G.reserved[c] = true;
    this.target = (c << 3) + 4 - 2;
    if ((G.rng.nextInt() & 7) === 0) {
      const n = jabs(G.rng.nextInt() & 0x1f);
      if (G.unlockReady && !G.unlockOnCrane && !G.unlockDropped && G.rec.unlocked < 5) {
        this.cargo = 9;
        G.vibrate(45);
        G.unlockOnCrane = true;
      } else if (n < 6) {
        if (!G.bombOnScreen) {
          this.cargo = 4;
          G.bombOnScreen = true;
        } else this.cargo = 2;
      } else {
        this.cargo = n < 12 ? 6 : n < 18 ? (!G.hat ? 5 : 0) : n < 28 ? (G.superJumps !== G.maxJumps ? 7 : 1) : 8;
      }
    } else this.cargo = jabs(G.rng.nextInt() & 3);
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Grid of crates (class l)                                            */
/* ------------------------------------------------------------------ */
class Grid {
  constructor(game, img) {
    this.game = game;
    this.cols = game.cols;
    this.solidLimit = game.character !== 5 ? 5 : 4; // l.a : Sam can walk into bombs
    this.layer = new LayerManager();
    this.b = [];
    for (let c = 0; c < this.cols; c++) this.b.push(new Array(ROWS));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.b[c][r] = new Crate(game, img);
        this.layer.append(this.b[c][r]);
      }
    }
    this.nullCrate = new Crate(game, img); // stands in for out-of-range reads
  }
  at(c, r) {
    const col = this.b[c];
    return (col && col[r]) || this.nullCrate;
  }
  /** b(int,int,byte) */
  place(c, r, type) {
    const cr = this.at(c, r);
    if (!cr.isVisible()) {
      cr.place(0, (c << 3) + 4, 51 - (r << 3), type);
      cr.active = true;
      return true;
    }
    return false;
  }
  /** b(int,int) : a solid crate stands there */
  solid(c, r) {
    if (r >= 7) return false;
    const cr = this.at(c, r);
    return cr.state !== -1 && cr.type < this.solidLimit;
  }
  /** e(int,int) : anything but an explosion stands there */
  any(c, r) {
    if (r >= 7) return false;
    const cr = this.at(c, r);
    return cr.state !== -1 && cr.type < 10;
  }
  /** d(int,int) : push the crate at (c,r) one column to the left */
  pushLeft(c, r) {
    const b = this.b;
    if (b[c][r].state !== 0 && b[c][r].state !== 6) return false;
    if (b[c - 1][r].type > 4) b[c - 1][r].state = -1;
    const t = b[c - 1][r];
    b[c - 1][r] = b[c][r];
    b[c][r] = t;
    const m = b[c - 1][r];
    m.offX = 8;
    m.offY = 0;
    m.state = 1;
    m.setVisible(true);
    m.active = true;
    b[c][r].active = true;
    return true;
  }
  /** a(int,int) : push the crate at (c,r) one column to the right */
  pushRight(c, r) {
    const b = this.b;
    if (b[c][r].state !== 0 && b[c][r].state !== 6) return false;
    if (b[c + 1][r].type > 4) b[c + 1][r].state = -1;
    const t = b[c + 1][r];
    b[c + 1][r] = b[c][r];
    b[c][r] = t;
    const m = b[c + 1][r];
    m.offX = -8;
    m.offY = 0;
    m.state = 2;
    m.setVisible(true);
    m.active = true;
    b[c][r].active = true;
    return true;
  }
  /** b() : bottom line complete? then blow it up */
  bottomFull() {
    for (let c = 0; c < this.cols; c++) {
      if (this.b[c][0].state !== 0) return false;
      if (this.b[c][0].type === 9) return this.secondFull();
    }
    for (let c = 0; c < this.cols; c++) {
      const cr = this.b[c][0];
      cr.type = 10;
      cr.state = 4;
      cr.active = true;
    }
    return true;
  }
  /** a() : same check for the second line (used when a bonus crate sits in the first) */
  secondFull() {
    for (let c = 0; c < this.cols; c++) if (this.b[c][1].state !== 0) return false;
    for (let c = 0; c < this.cols; c++) {
      const cr = this.b[c][1];
      cr.type = 10;
      cr.state = 4;
      cr.active = true;
    }
    return true;
  }
  stateAt(c, r) {
    return this.at(c, r).state;
  }
  setState(c, r, s) {
    this.at(c, r).state = s;
  }
  explode(c, r) {
    this.at(c, r).explode();
  }
}

/* ------------------------------------------------------------------ */
/* Game (class e)                                                      */
/* ------------------------------------------------------------------ */
export class Game {
  /**
   * @param {object} env
   *  assets   : { img: {name: HTMLImageElement} }
   *  rec      : record store (character, unlocked, level, soundOff, vibOff, highscore, ...)
   *  opts     : port options (cols, cheats, fixes...)
   *  sfx      : { play(name), midi(name), tone(f, ms), smaf:boolean }
   *  host     : { vibrate(ms), openOptions(), save() }
   *  rng      : JavaRandom
   */
  constructor(env) {
    Object.assign(this, env);
    this.cols = env.cols || 12;
    this.craneMaxX = this.cols * 8 + 24; // 120 for the original 12 columns
    this.popClampX = this.cols * 8 - 20; // 76
    this.character = this.rec.character;
    this.cosmeticRng = env.cosmeticRng || this.rng;

    this.shown = true; // u
    this.combo = 0; // s
    this.score = 0; // ab
    this.overWait = -1; // ap
    this.craneCooldown = 0; // K
    this.unlockReady = false; // M
    this.unlockDropped = false; // m
    this.unlockOnCrane = false; // y
    this.unlockedNow = false; // l
    this.unlockSaved = false; // au
    this.bombOnScreen = false; // as
    this.hat = false; // Z
    this.holdingBomb = false; // I
    this.superJumps = 0; // av
    this.gameOver = false; // T
    this.running = false; // at
    this.paused = false; // p
    this.pauseOverlay = false; // o
    this.bonus100 = false; // x
    this.blastCol = 0; // g
    this.blastRow = 0; // e
    this.blastPending = false; // J
    this.soundLock = false; // k
    this.curSpeedX = 0; // g.l
    this.maxJumps = 3; // g.j
    this.tickPitch = 0; // i.e
    this.reserved = new Array(this.cols).fill(false); // aa
    this.activeCranes = this.rec.level + 1; // Y
    this.maxCranes = this.rec.level === 2 ? 8 : this.rec.level === 1 ? 5 : 3; // v
    this.frameCount = 0;
    this.stats = { combos: 0, cleared: 0, rows: 0, bestCombo: 0 };

    // popup score digits state (ai, ah, ag, aj, ak)
    this.popX = 0;
    this.popY = 0;
    this.popTimer = 0;
    this.popVis = false;
    this.pop3 = false;

    const I = this.assets.img;
    this.back = new LayerManager(); // af
    this.top = new LayerManager(); // ae
    this.sprites = [];

    // v() : cranes, staggered by 17 frames
    this.cranes = [];
    let delay = 0;
    for (let n = 0; n < this.maxCranes; n++) {
      this.cranes.push(new Crane(this, I.crane, delay));
      delay = byte(delay + 17);
    }
    // y() : background
    this.bg = new Sprite(env.wideBack || I.back);
    this.bg.setPosition(4, -8);
    this.back.append(this.bg);
    // x() : wall, score digits, HUD
    this.wall = new Sprite(I.wall, 4, 71);
    this.wall.setPosition(0, -8);
    const digit = (x) => {
      const s = new Sprite(I.font, 8, 9);
      s.setPosition(x, 20);
      s.setVisible(false);
      s.setFrame(1);
      this.top.append(s);
      return s;
    };
    this.digH = digit(20); // S
    this.digT = digit(28); // R
    this.digO = digit(36); // Q
    this.top.append(this.wall);
    this.hudLives = this.hud(I.lives, 16, 10, true, 2); // O
    this.hudJumps = this.hud(I.jumps, 16, 36, false, 1); // P
    this.hudHat = this.hud(I.hat, 8, 64, false, 0); // N
    this.hudBomb = this.hud(I.bomb, 8, 84, false, 0); // H
    // crates
    this.grid = new Grid(this, I.crates); // ar
    // player
    this.player = new Player(this, I[CHARACTER_SHEETS[this.character]]); // ao
    this.top.append(this.player);

    this.sprites.push(this.bg, this.wall, this.digH, this.digT, this.digO, this.hudLives, this.hudJumps, this.hudHat, this.hudBomb, this.player, ...this.cranes);
    for (const col of this.grid.b) this.sprites.push(...col);
  }

  hud(img, fw, x, vis, frame) {
    const s = new Sprite(img, fw, 8);
    s.setPosition(x, 64);
    s.setVisible(vis);
    s.setFrame(frame);
    this.top.append(s);
    return s;
  }

  /* ---------------- platform glue ---------------- */

  /** b(int) */
  vibrate(ms) {
    if (this.rec.vibOff === 0 && !this.gameOver) this.host.vibrate(ms);
  }

  /** e(int,int) : Sound.playTone fallback */
  tone(f, ms) {
    if (this.rec.soundOff === 0 && !this.gameOver) this.sfx.tone(f, ms);
  }

  /** d(int) : one sound per frame, jingles take priority */
  sound(n) {
    if (this.soundLock && n !== 9 && n !== 8 && n !== 7 && n !== 6) return;
    this.soundLock = true;
    if (this.rec.soundOff !== 0) return;
    const smaf = this.sfx.smaf;
    const restored = this.opts.restoredSfx;
    switch (n) {
      case 0: // crate lands: silent on SMAF phones (boxland.mmf ships unused)
        if (smaf) {
          if (restored) this.sfx.play('boxland');
          return;
        }
        this.tone(240, 50);
        return;
      case 1: // crate leaves the crane (cranedrp.mmf ships unused)
        if (smaf && restored) this.sfx.play('cranedrp');
        return;
      case 2:
        if (smaf) this.sfx.play('bang');
        else this.tone(180, 80);
        return;
      case 3:
        if (smaf) this.sfx.play('ouch');
        else this.tone(300, 30);
        return;
      case 4:
        if (smaf) this.sfx.play('jump');
        else this.tone(200 + (50 - this.tickPitch), 5);
        return;
      case 5:
        if (smaf) this.sfx.play('tick');
        else this.tone(200 + (50 - this.tickPitch), 5);
        return;
      case 6:
        this.sfx.midi('gameover');
        return;
      case 7:
        if (smaf) this.sfx.midi('extra');
        else this.tone(240, 20);
        return;
      case 8:
      case 9:
        if (smaf) this.sfx.midi('fullrow');
        else this.tone(280, 20);
        return;
    }
  }

  unlockCharacter() {
    this.rec.unlocked++;
  }

  /* ---------------- run() ---------------- */

  start() {
    this.running = true;
    this.initLayout();
    this.placePlayer();
    for (let n = 0; n < this.activeCranes; n++) {
      this.cranes[n].activate();
      this.top.append(this.cranes[n]);
    }
    for (const s of this.sprites) s.snap();
  }

  /** One iteration of the original 111 ms main loop. `key` = {an, ac}. */
  tick(key) {
    if (!this.shown) return;
    if (!this.paused) {
      for (const s of this.sprites) s.snap();
      const o = this.opts;
      if (o.cheatJumps) this.superJumps = this.maxJumps;
      if (o.cheatHat) this.hat = true;
      this.input(key);
      if (this.unlockedNow && !this.unlockSaved) {
        this.unlockSaved = true;
        this.host.save();
      }
      this.player.update();
      this.updateCranes();
      this.checkBonus();
      this.updatePopup();
      this.updateCrates();
      this.settle();
      if (this.grid.bottomFull()) {
        this.addScore(10 * this.activeCranes);
        this.addCrane();
        this.stats.rows++;
        this.sound(9);
        this.vibrate(500);
      }
      if (this.superJumps > 0) {
        this.hudJumps.setVisible(true);
        this.hudJumps.setFrame(this.superJumps - 1);
      } else this.hudJumps.setVisible(false);
      this.hudHat.setVisible(this.hat);
      this.hudBomb.setVisible(this.holdingBomb);
      this.hudLives.setFrame(this.player.lives > 7 ? 8 : this.player.lives + 1);
      this.soundLock = false;
      this.frameCount++;
      if (!this.gameOver && key.an === K.RED) {
        if (key.ac === 1 || key.ac === 2) {
          this.running = false;
          this.overWait = 0;
          this.gameOver = true;
        }
      } else if (this.gameOver) {
        if (this.overWait !== 0) --this.overWait;
        else if (key.ac === 1 || key.ac === 2) this.running = false;
      }
    } else if (this.pauseOverlay) {
      this.digH.setVisible(false);
      this.digT.setVisible(false);
      this.digO.setVisible(false);
      if (key.an === 48 && key.ac === 1) {
        this.paused = false;
        this.pauseOverlay = false;
        this.consume(key);
      }
    }
  }

  consume(key) {
    key.an = 0;
    this.host.consumeKey();
  }

  /** g() : translate the pressed key into a player action */
  input(key) {
    const P = this.player;
    let act = 0;
    this.keyUsed = false; // port: lets the input buffer know a buffered press was consumed
    const prev = P.prevKind();
    if (P.state !== 15 && P.state !== 16) {
      if (!this.gameOver && (key.ac === 1 || key.ac === 2)) {
        switch (key.an) {
          case 42:
            if (P.state === 0 && this.holdingBomb) {
              this.holdingBomb = false;
              this.blastCol = P.col();
              this.blastRow = P.row(0);
              this.blastPending = true;
              this.keyUsed = true;
            }
            break;
          case 8:
            this.paused = true;
            this.consume(key);
            this.host.openOptions();
            break;
          case 48:
            this.paused = true;
            this.pauseOverlay = true;
            this.consume(key);
            break;
          case 1:
          case 50:
            if (this.standing() && this.canJump()) act = 5;
            break;
          case 53:
            if (this.superJumps > 0 && this.standing() && this.canJump()) act = 7;
            break;
          case 5:
          case 54:
            if (this.standing() && this.freeRight()) act = 1;
            else {
              if (prev === 5 || prev === 9 || prev === 14 || prev === 12) {
                if (this.floorRight()) {
                  if (this.freeRight()) act = 1;
                } else if (this.dropRight()) act = 12;
              }
              if (this.canPushRight()) act = 3;
            }
            break;
          case 2:
          case 52:
            if (this.standing() && this.freeLeft()) act = 2;
            else {
              if (prev === 5 || prev === 9 || prev === 14 || prev === 12) {
                if (this.floorLeft()) {
                  if (this.freeLeft()) act = 2;
                } else if (this.dropLeft()) act = 14;
              }
              if (this.canPushLeft()) act = 4;
            }
            break;
          case 49:
            if (this.freeLeft() && this.standing()) act = 13;
            else {
              if (this.standing() && this.canJump()) act = 5;
              if (this.standing() && this.freeLeft()) act = 2;
              else if (prev === 5 && this.floorLeft() && this.freeLeft()) act = 2;
              else if (prev === 5 && this.canPushLeft()) act = 4;
            }
            break;
          case 51:
            if (this.freeRight() && this.standing()) act = 11;
            else {
              if (this.standing() && this.canJump()) act = 5;
              if (this.standing() && this.freeRight()) act = 1;
              else if (prev === 5 && this.floorRight() && this.freeRight()) act = 1;
              else if (prev === 5 && this.canPushRight()) act = 3;
            }
            break;
        }
      } else if (!this.standing()) act = 9;
    } else if (P.moveY === 0 && !this.standing()) {
      P.step = 0;
      P.moveY = 8;
    }
    // a diagonal jump always continues over the edge
    if (prev === 11) {
      act = this.freeRight() && this.floorRight() ? 1 : this.freeRight() && !this.floorRight() ? 12 : 9;
    } else if (prev === 13) {
      act = this.freeLeft() && this.floorLeft() ? 2 : this.freeLeft() && !this.floorLeft() ? 14 : 9;
    }
    if (act === 0 && !this.standing()) act = 9;
    const before = P.state;
    P.act(act);
    if (act !== 0 && act !== 9 && before === 0 && P.state !== 0) this.keyUsed = true;
    this.headBreak();
    return 0;
  }

  /** t() : room to jump straight up */
  canJump() {
    const c = this.player.col();
    const r = this.player.row(-16);
    if (r >= 7) return true;
    if (this.grid.solid(c, r)) return false;
    return !this.grid.solid(c, r - 1);
  }
  /** r() : standing on a crate or the floor */
  standing() {
    const c = this.player.col();
    const r = this.player.row(8);
    if (r === -1) return true;
    return this.grid.solid(c, r);
  }
  /** q() */
  floorRight() {
    const c = this.player.col();
    const r = this.player.row(8);
    if (c === this.cols - 1) return false;
    if (r === -1) return true;
    return this.grid.solid(c + 1, r);
  }
  /** p() */
  floorLeft() {
    const c = this.player.col();
    const r = this.player.row(8);
    if (c === 0) return false;
    if (r === -1) return true;
    return this.grid.solid(c - 1, r);
  }
  /** o() */
  freeRight() {
    const c = this.player.col();
    const r = this.player.row(-15);
    const G = this.grid;
    if (c === this.cols - 1) return false;
    if (G.solid(c + 1, r + 1)) return false;
    if (G.solid(c + 1, r)) return false;
    return !G.solid(c + 1, r - 1);
  }
  /** n() */
  freeLeft() {
    const c = this.player.col();
    const r = this.player.row(-15);
    const G = this.grid;
    if (c === 0) return false;
    if (G.solid(c - 1, r + 1)) return false;
    if (G.solid(c - 1, r)) return false;
    return !G.solid(c - 1, r - 1);
  }
  /** m() */
  dropRight() {
    const c = this.player.col();
    const r = this.player.row(-15);
    const G = this.grid;
    if (c === this.cols - 1) return false;
    if (G.solid(c + 1, r + 1)) return false;
    if (G.solid(c + 1, r)) return false;
    if (G.solid(c + 1, r - 1)) return false;
    return !G.solid(c + 1, r - 2);
  }
  /** l() : the original checks column c+1 in its last test (typo); optionally fixed */
  dropLeft() {
    const c = this.player.col();
    const r = this.player.row(-15);
    const G = this.grid;
    if (c === 0) return false;
    if (G.solid(c - 1, r + 1)) return false;
    if (G.solid(c - 1, r)) return false;
    if (G.solid(c - 1, r - 1)) return false;
    return !G.solid(this.opts.fixBugs ? c - 1 : c + 1, r - 2);
  }
  /** k() */
  canPushLeft() {
    const P = this.player;
    if (P.state !== 0) return false;
    if (!this.standing() && P.prevKind() !== 5) return false;
    const c = P.col();
    const r = P.row(-15);
    if (c <= 1) return false;
    if (this.grid.any(c - 2, r - 1)) return false;
    if (this.grid.solid(c - 1, r)) return false;
    return this.grid.pushLeft(c - 1, r - 1);
  }
  /** j() */
  canPushRight() {
    const P = this.player;
    if (P.state !== 0) return false;
    if (!this.standing() && P.prevKind() !== 5) return false;
    const c = P.col();
    const r = P.row(-15);
    if (c >= this.cols - 2) return false;
    if (this.grid.any(c + 2, r - 1)) return false;
    if (this.grid.solid(c + 1, r)) return false;
    return this.grid.pushRight(c + 1, r - 1);
  }
  /** i() : jumping into a falling crate breaks it */
  headBreak() {
    const P = this.player;
    let c, r;
    if (P.kind() === 5 && this.grid.solid((c = P.col()), (r = P.row(-15)))) {
      this.grid.explode(c, r);
      this.sound(2);
    }
  }

  /** b(int,int) : crate at (c,r) drops one slot (and drags the column above) */
  fall(c, r) {
    const G = this.grid;
    const cr = G.at(c, r);
    if (cr.state !== -1 && cr.state !== 3) {
      cr.setVisible(true);
      const P = this.player;
      if (cr.type < G.solidLimit && P.col() === c && (P.row(-16) === r || P.row(-8) === r) && P.kind() !== 9 && this.standing()) {
        cr.state = 4;
        cr.type = 10;
        cr.active = true;
        if (this.hat) {
          this.hat = false;
          this.sound(3);
          this.vibrate(100);
          return;
        }
        this.sound(2);
        P.hit();
        return;
      }
      if (r - 1 < 0) return; // would be an ArrayIndexOutOfBounds in the MIDlet
      G.b[c][r] = G.b[c][r - 1];
      G.b[c][r - 1] = cr;
      cr.state = 3;
      cr.offY = -8;
      G.b[c][r].active = true;
      cr.active = true;
      if (r !== 6 && G.b[c][r + 1].state !== -1) this.fall(c, r + 1);
    }
  }

  /** a(int,int) : crane releases its cargo above column c */
  drop(c, type) {
    this.reserved[c] = false;
    if (this.grid.solid(c, 5)) return false;
    this.grid.place(c, 6, type);
    const cr = this.grid.b[c][6];
    cr.state = 7;
    cr.active = true;
    this.sound(1);
    if (type === 9) this.unlockDropped = true;
    return true;
  }

  /** b() : one more crane after a cleared line */
  addCrane() {
    if (this.activeCranes !== this.maxCranes) {
      this.cranes[this.activeCranes].activateNow();
      this.top.append(this.cranes[this.activeCranes]);
      this.activeCranes++;
    }
  }

  /** a(int) */
  addScore(n) {
    if (!this.gameOver) this.score += n;
  }

  /** u() */
  updateCranes() {
    for (let n = 0; n < this.maxCranes; n++) {
      const col = this.cranes[n].step();
      if (col !== -1 && !this.gameOver && this.drop(col, this.cranes[n].cargo)) {
        this.addScore(2);
        this.cranes[n].empty();
      }
    }
    if (this.craneCooldown > 0) --this.craneCooldown;
  }

  /** f() */
  checkBonus() {
    if (this.bonus100) {
      this.bonus100 = false;
      this.popup(100, this.player.px, this.player.py, false);
    }
  }

  /** h() : floating score digits */
  updatePopup() {
    if (this.popTimer > 0) {
      this.popVis = !this.popVis;
      --this.popTimer;
      if (this.popTimer === 0) this.popVis = false;
      this.digH.setVisible(this.popVis && this.pop3);
      this.digT.setVisible(this.popVis);
      this.digO.setVisible(this.popVis);
      --this.popY;
      if (this.pop3) {
        this.digH.setPosition(this.popX, this.popY);
        this.digT.setPosition(this.popX + 8, this.popY);
        this.digO.setPosition(this.popX + 16, this.popY);
        return;
      }
      this.digH.setPosition(-10, this.popY);
      this.digT.setPosition(this.popX, this.popY);
      this.digO.setPosition(this.popX + 8, this.popY);
    }
  }

  /** a(int,int,int,boolean) */
  popup(points, a, b, onGrid) {
    this.vibrate(points * 3);
    this.addScore(points);
    if (onGrid) {
      this.popX = (a << 3) + 4;
      if (this.popX > this.popClampX) this.popX = this.popClampX;
      this.popY = 51 - (b << 3);
    } else {
      this.popX = a;
      this.popY = b;
    }
    this.popVis = true;
    this.popTimer = 25;
    this.digO.setVisible(true);
    this.digT.setVisible(true);
    this.digO.setFrame(points % 10);
    let n = Math.trunc(points / 10);
    this.digT.setFrame(n % 10);
    n = Math.trunc(n / 10);
    if (n !== 0) {
      this.digH.setVisible(true);
      this.digH.setFrame(n % 10);
      this.digH.setPosition(this.popX, this.popY);
      this.digT.setPosition(this.popX + 7, this.popY);
      this.digO.setPosition(this.popX + 15, this.popY);
      this.pop3 = true;
      return;
    }
    this.digH.setVisible(false);
    this.digT.setPosition(this.popX, this.popY);
    this.digO.setPosition(this.popX + 7, this.popY);
    this.pop3 = false;
  }

  /** a() : update every crate that needs it, then resolve explosions */
  updateCrates() {
    const G = this.grid;
    let y = 3;
    for (let r = 6; r >= 0; r--) {
      for (let c = 0; c < this.cols; c++) {
        const cr = G.b[c][r];
        if (cr.active && cr.update((c << 3) + 4, y, this.player, c, r)) this.collapse(c, r);
      }
      y += 8;
    }
    if (this.blastPending) {
      const g = this.blastCol,
        e = this.blastRow,
        b = G.b;
      try {
        if (g - 1 >= 0) {
          b[g - 1][e].explode();
          if (e > 0) b[g - 1][e - 1].explode();
          if (e < 6) b[g - 1][e + 1].explode();
        }
        if (g + 1 <= this.cols - 1) {
          b[g + 1][e].explode();
          if (e > 0) b[g + 1][e - 1].explode();
          if (e < 6) b[g + 1][e + 1].explode();
        }
        if (e > 0) b[g][e - 1].explode();
        if (e < 6) b[g][e + 1].explode();
      } catch (err) {
        /* same as the MIDlet's catch (Exception) */
      }
      this.blastPending = false;
    }
  }

  /** c(int,int) */
  collapse(c, r) {
    while (r < 7) {
      this.fall(c, r);
      r++;
    }
  }

  /** s() : crates that finished moving either land or keep falling */
  settle() {
    const G = this.grid;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (G.b[c][r].state !== 7) continue;
        if (r === 0) {
          G.setState(c, 0, 0);
          this.vibrate(5);
          this.sound(0);
          this.match(c, r);
        } else if (G.stateAt(c, r - 1) !== -1) {
          G.setState(c, r, 0);
          this.vibrate(5);
          this.sound(0);
          this.match(c, r);
        } else {
          this.fall(c, r);
          G.b[c][r].active = true;
          if (G.solid(c, r - 1)) {
            this.fall(c, r - 1);
            G.b[c][r - 1].active = true;
          }
        }
      }
    }
  }

  /** d(int,int) : 3+ identical crates in a line disappear */
  match(c, r) {
    const b = this.grid.b;
    const N = this.cols;
    let h = 1,
      v = 1;
    const t = b[c][r].type;
    let left = 0,
      right = 0,
      up = 0,
      down = 0;
    if (c < N) {
      right = c + 1;
      while (right < N) {
        if (b[right][r].state !== 0 || b[right][r].type !== t) break;
        h++;
        right++;
      }
    }
    if (c > 0) {
      left = c - 1;
      while (left >= 0) {
        if (b[left][r].state !== 0 || b[left][r].type !== t) break;
        h++;
        left--;
      }
      left++;
    }
    if (r < 7) {
      up = r + 1;
      while (up < 7) {
        if (b[c][up].state !== 0 || b[c][up].type !== t) break;
        v++;
        up++;
      }
    }
    if (r > 0) {
      down = r - 1;
      while (down >= 0) {
        if (b[c][down].state !== 0 || b[c][down].type !== t) break;
        v++;
        down--;
      }
    }
    if (h > 2) {
      while (left !== right) {
        this.grid.explode(left, r);
        left++;
      }
    }
    if (v > 2) {
      down++;
      while (down !== up) {
        this.grid.explode(c, down);
        down++;
      }
    }
    if (h > 2 || v > 2) {
      if (h < 3) h = 0;
      if (v < 3) v = 0;
      if (!this.unlockDropped && (this.combo += h + v) > (this.rec.unlocked + 1) * 25) this.unlockReady = true;
      this.stats.combos++;
      this.stats.cleared += h + v;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, h + v);
      this.sound(8);
      // the MIDlet indexes past the table (and crashes) on 9+ crate combos
      this.popup(COMBO_POINTS[Math.min(v + h - 3, COMBO_POINTS.length - 1)], c, r, true);
    }
  }

  /** c() : random starting floor, 8 crates + 4 on top */
  initLayout() {
    const N = this.cols;
    const G = this.grid;
    let pos = 0;
    for (let i = 0; i < 8; i++) {
      const n = jabs(this.rng.nextInt() % N);
      if ((pos += n) >= N) pos -= N;
      while (G.solid(pos, 0)) {
        if (++pos < N) continue;
        pos -= N;
      }
      G.place(pos, 0, i >> 1);
    }
    for (let t = 0; t < 4; t++) {
      const n = jabs(this.rng.nextInt() % N);
      if ((pos += n) >= N) pos -= N;
      for (;;) {
        if (!G.solid(pos, 0)) {
          if (++pos < N) continue;
          pos -= N;
          continue;
        }
        if (!G.solid(pos, 1)) break;
        if (++pos < N) continue;
        pos -= N;
      }
      G.place(pos, 1, t);
    }
  }

  /** B() */
  placePlayer() {
    for (let c = 0; c < this.cols; c++) {
      if (this.grid.solid(c, 1)) {
        this.player.init(4 + (c << 3), 27);
        break;
      }
    }
  }

  /* ---------------- save states (port extra) ---------------- */

  snapshot() {
    const sp = (s) => [s.x, s.y, s.frame, s.visible ? 1 : 0, s.cx, s.cy, s.cw, s.ch];
    const P = this.player;
    return {
      v: 1,
      cols: this.cols,
      character: this.character,
      level: this.rec.level,
      rng: this.rng.seed.toString(),
      crng: this.cosmeticRng === this.rng ? null : this.cosmeticRng.seed.toString(),
      g: GAME_FIELDS.map((k) => this[k]),
      reserved: [...this.reserved],
      stats: { ...this.stats },
      player: PLAYER_FIELDS.map((k) => P[k]),
      ps: sp(P),
      cranes: this.cranes.map((c) => [c.on, c.delay, c.cx_, c.target, c.dx, c.cargo, ...sp(c)]),
      craneOrder: this.top.layers.filter((l) => this.cranes.includes(l)).map((l) => this.cranes.indexOf(l)),
      grid: this.grid.b.map((col) => col.map((cr) => [cr.offX, cr.offY, cr.type, cr.state, cr.blink ? 1 : 0, cr.timer, cr.active ? 1 : 0, ...sp(cr)])),
      hud: this.hudSprites().map(sp),
      score: this.score,
      date: Date.now(),
    };
  }

  hudSprites() {
    return [this.digH, this.digT, this.digO, this.hudLives, this.hudJumps, this.hudHat, this.hudBomb];
  }

  /** Restores a snapshot into a freshly constructed Game (same character / columns). */
  restore(d) {
    const put = (s, a, o = 0) => {
      s.x = a[o];
      s.y = a[o + 1];
      s.frame = a[o + 2];
      s.visible = !!a[o + 3];
      s.cx = a[o + 4];
      s.cy = a[o + 5];
      s.cw = a[o + 6];
      s.ch = a[o + 7];
    };
    this.rng.seed = BigInt(d.rng);
    if (d.crng && this.cosmeticRng !== this.rng) this.cosmeticRng.seed = BigInt(d.crng);
    GAME_FIELDS.forEach((k, i) => (this[k] = d.g[i]));
    this.reserved = [...d.reserved];
    this.stats = { ...d.stats };
    const P = this.player;
    P.tableY = SPEED_Y[this.character];
    P.tableX = SPEED_X[this.character];
    PLAYER_FIELDS.forEach((k, i) => (P[k] = d.player[i]));
    put(P, d.ps);
    d.cranes.forEach((a, i) => {
      const c = this.cranes[i];
      [c.on, c.delay, c.cx_, c.target, c.dx, c.cargo] = a;
      put(c, a, 6);
    });
    for (const i of d.craneOrder) this.top.append(this.cranes[i]);
    d.grid.forEach((col, c) =>
      col.forEach((a, r) => {
        const cr = this.grid.b[c][r];
        [cr.offX, cr.offY, cr.type, cr.state] = a;
        cr.blink = !!a[4];
        cr.timer = a[5];
        cr.active = !!a[6];
        put(cr, a, 7);
      })
    );
    this.hudSprites().forEach((s, i) => put(s, d.hud[i]));
    for (const s of this.sprites) s.snap();
  }

  /* ---------------- paint() ---------------- */

  /** Draws the playfield. ox = horizontal offset of the 101px field inside the canvas. */
  paint(r, ox) {
    this.back.paint(r, ox, 8);
    this.grid.layer.paint(r, ox, 8);
    if (this.opts.dropGuide) this.paintDropGuide(r, ox);
    this.top.paint(r, ox, 8);
  }

  /** Port extra: show where each loaded crane is going to drop its crate. */
  paintDropGuide(r, ox) {
    const blink = (this.frameCount >> 1) & 1;
    for (const cr of this.cranes) {
      if (cr.on === -1 || cr.delay !== 0 || cr.cargo === 10 || cr.dx === 0) continue;
      const c = (cr.target + 2) >> 3;
      let top = 0;
      while (top < 7 && this.grid.at(c, top).state !== -1) top++;
      const x = ox + (c << 3) + 4;
      const yTop = 8 + 10;
      const yBot = 8 + 51 - (top << 3) + 8;
      r.fillRect(x, yTop, 8, Math.max(0, yBot - yTop), 'rgba(255,255,255,0.13)');
      if (blink) r.fillRect(x + 3, yBot - 2, 2, 1, 'rgba(255,255,255,0.7)');
    }
  }
}
