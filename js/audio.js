// Audio: the SMAF effects (decoded from the original Yamaha ADPCM to WAV),
// a small 2-operator FM synth for the MIDI jingles (the x55 phones used a
// Yamaha MA chip), and Sound.playTone() beeps for the non-SMAF code path.

const SFX = ['bang', 'ouch', 'jump', 'tick', 'boxland', 'cranedrp'];
const SONGS = ['title', 'gameover', 'extra', 'fullrow'];

// GM program -> FM patch. ratio: modulator/carrier, index: modulation depth.
const PATCHES = {
  10: { name: 'music box', wave: 'sine', ratio: 3.5, index: 3.2, indexEnd: 0.4, indexTau: 0.18, a: 0.002, decayTau: 0.45, sus: 0, rel: 0.25, gain: 0.55 },
  0: { name: 'piano', wave: 'sine', ratio: 1, index: 2.2, indexEnd: 0.5, indexTau: 0.25, a: 0.003, decayTau: 0.9, sus: 0.0, rel: 0.18, gain: 0.6 },
  60: { name: 'horn', wave: 'sine', ratio: 1, index: 0.6, indexEnd: 1.6, indexTau: 0.08, a: 0.04, decayTau: 0.5, sus: 0.75, rel: 0.12, gain: 0.42, vib: 5 },
  default: { wave: 'sine', ratio: 1, index: 1.4, indexEnd: 0.8, indexTau: 0.2, a: 0.005, decayTau: 0.6, sus: 0.4, rel: 0.12, gain: 0.45 },
  chip: { wave: 'square', ratio: 1, index: 0, indexEnd: 0, indexTau: 1, a: 0.002, decayTau: 0.3, sus: 0.55, rel: 0.05, gain: 0.16 },
};

/* ---------------- MIDI parsing ---------------- */

function parseMidi(buf) {
  const d = new DataView(buf);
  let p = 0;
  const str = (n) => String.fromCharCode(...new Uint8Array(buf, p, n));
  if (str(4) !== 'MThd') throw new Error('not midi');
  const div = d.getUint16(12);
  const ntr = d.getUint16(10);
  p = 8 + d.getUint32(4);
  const events = [];
  for (let t = 0; t < ntr; t++) {
    const len = d.getUint32(p + 4);
    let q = p + 8;
    const end = q + len;
    let tick = 0,
      run = 0;
    const vlq = () => {
      let v = 0,
        c;
      do {
        c = d.getUint8(q++);
        v = (v << 7) | (c & 127);
      } while (c & 128);
      return v;
    };
    while (q < end) {
      tick += vlq();
      let st = d.getUint8(q);
      if (st === 0xff) {
        const type = d.getUint8(q + 1);
        q += 2;
        const l = vlq();
        if (type === 0x51) events.push({ tick, type: 'tempo', v: (d.getUint8(q) << 16) | (d.getUint8(q + 1) << 8) | d.getUint8(q + 2) });
        q += l;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        q++;
        q += vlq();
        continue;
      }
      if (st & 0x80) {
        run = st;
        q++;
      } else st = run;
      const ch = st & 15,
        hi = st >> 4;
      const a = d.getUint8(q),
        b = hi === 0xc || hi === 0xd ? 0 : d.getUint8(q + 1);
      q += hi === 0xc || hi === 0xd ? 1 : 2;
      if (hi === 9 && b > 0) events.push({ tick, type: 'on', ch, note: a, vel: b });
      else if (hi === 8 || (hi === 9 && b === 0)) events.push({ tick, type: 'off', ch, note: a });
      else if (hi === 0xc) events.push({ tick, type: 'prog', ch, v: a });
      else if (hi === 0xb && a === 7) events.push({ tick, type: 'vol', ch, v: b });
    }
    p = end;
  }
  events.sort((x, y) => x.tick - y.tick);
  // ticks -> seconds
  let tempo = 500000,
    lastTick = 0,
    time = 0;
  for (const e of events) {
    time += ((e.tick - lastTick) * tempo) / div / 1e6;
    lastTick = e.tick;
    e.t = time;
    if (e.type === 'tempo') tempo = e.v;
  }
  return { events, duration: time };
}

/* ---------------- engine ---------------- */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.songs = {};
    this.active = {}; // sample name -> source
    this.seqs = {}; // song name -> sequencer state
    this.vol = { master: 0.8, music: 0.8, sfx: 0.9 };
    this.synth = 'fm';
    this.phoneSpeaker = false;
    this.smaf = true; // false = Sound.playTone() beeps like a phone without SMAF
    this.raw = { sfx: {}, songs: {} };
  }

  async load(base) {
    const get = (u) => fetch(base + u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(u))));
    await Promise.all([
      ...SFX.map(async (n) => (this.raw.sfx[n] = await get(`snd/${n}.wav`))),
      ...SONGS.map(async (n) => (this.songs[n] = parseMidi(await get(`mus/${n}.mid`)))),
    ]);
  }

  /** Must run from a user gesture (autoplay policy). */
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const c = this.ctx;
      this.out = c.createGain();
      this.hp = c.createBiquadFilter();
      this.hp.type = 'highpass';
      this.lp = c.createBiquadFilter();
      this.lp.type = 'lowpass';
      // soft limiter: the original SMAF effects are mastered at full scale
      this.limiter = c.createDynamicsCompressor();
      this.limiter.threshold.value = -4;
      this.limiter.knee.value = 4;
      this.limiter.ratio.value = 16;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;
      this.out.connect(this.hp).connect(this.lp).connect(this.limiter).connect(c.destination);
      this.musicBus = c.createGain();
      this.sfxBus = c.createGain();
      this.musicBus.connect(this.out);
      this.sfxBus.connect(this.out);
      this.applyVolumes();
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      await Promise.all(
        Object.entries(this.raw.sfx).map(async ([n, ab]) => {
          try {
            this.buffers[n] = await c.decodeAudioData(ab.slice(0));
          } catch (e) {
            console.warn('decode', n, e);
          }
        })
      );
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch (e) {
        /* ignored */
      }
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.vol.master, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.75, t, 0.02);
    this.hp.frequency.value = this.phoneSpeaker ? 420 : 10;
    this.lp.frequency.value = this.phoneSpeaker ? 5200 : 22000;
    this.hp.Q.value = this.phoneSpeaker ? 1.4 : 0.7;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Player.start(): does nothing while the same sound is still playing. */
  play(name) {
    if (!this.ready || !this.buffers[name]) return;
    if (this.active[name]) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffers[name];
    s.connect(this.sfxBus);
    s.onended = () => {
      if (this.active[name] === s) delete this.active[name];
    };
    this.active[name] = s;
    s.start();
  }

  /** com.siemens.mp.game.Sound.playTone(freq, ms) */
  tone(freq, ms) {
    if (!this.ready || freq <= 0) return;
    const c = this.ctx,
      t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = c.createGain();
    const dur = Math.max(ms, 8) / 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.002);
    g.gain.setValueAtTime(0.18, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.004);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  /* ---------- MIDI sequencer ---------- */

  isPlaying(name) {
    return !!this.seqs[name];
  }

  midi(name, loop = false) {
    if (!this.ready || !this.songs[name]) return;
    if (this.seqs[name]) return; // already playing: start() is a no-op
    const song = this.songs[name];
    const seq = { song, i: 0, start: this.ctx.currentTime + 0.05, loop, voices: new Map(), prog: new Array(16).fill(0), all: new Set() };
    this.seqs[name] = seq;
    const pump = () => this.pump(name);
    seq.timer = setInterval(pump, 25);
    pump();
  }

  stopMidi(name) {
    const seq = this.seqs[name];
    if (!seq) return;
    clearInterval(seq.timer);
    const t = this.ctx.currentTime;
    for (const v of seq.all) this.release(v, t, 0.03);
    delete this.seqs[name];
  }

  stopAllMidi() {
    for (const n of Object.keys(this.seqs)) this.stopMidi(n);
  }

  pump(name) {
    const seq = this.seqs[name];
    if (!seq) return;
    const now = this.ctx.currentTime;
    const horizon = now + 0.15;
    const ev = seq.song.events;
    while (seq.i < ev.length && seq.start + ev[seq.i].t < horizon) {
      const e = ev[seq.i++];
      const t = Math.max(now, seq.start + e.t);
      if (e.type === 'prog') seq.prog[e.ch] = e.v;
      else if (e.type === 'on') {
        const key = e.ch * 128 + e.note;
        const old = seq.voices.get(key);
        if (old) {
          this.release(old, t);
          seq.all.delete(old);
        }
        const v = this.noteOn(seq, e.ch, e.note, e.vel, t);
        if (v) {
          seq.voices.set(key, v);
          seq.all.add(v);
        }
      } else if (e.type === 'off') {
        const key = e.ch * 128 + e.note;
        const v = seq.voices.get(key);
        if (v) {
          this.release(v, t);
          seq.voices.delete(key);
          seq.all.delete(v);
        }
      }
    }
    if (seq.i >= ev.length && now > seq.start + seq.song.duration + 0.3) {
      if (seq.loop) {
        seq.i = 0;
        seq.start = seq.start + seq.song.duration + 0.4;
      } else {
        clearInterval(seq.timer);
        delete this.seqs[name];
      }
    }
  }

  noteOn(seq, ch, note, vel, t) {
    const c = this.ctx;
    const amp = c.createGain();
    amp.connect(this.musicBus);
    const v = { nodes: [], amp, t0: t, a: 0.002, rel: 0.1, done: false };
    const velGain = (vel / 127) ** 1.6;
    if (ch === 9) {
      this.drum(note, velGain, t, amp, v);
      v.rel = 0.4;
      return v;
    }
    const p = this.synth === 'chip' ? PATCHES.chip : PATCHES[seq.prog[ch]] || PATCHES.default;
    const f = 440 * 2 ** ((note - 69) / 12);
    const car = c.createOscillator();
    car.type = p.wave;
    car.frequency.value = f;
    if (p.index > 0 || p.indexEnd > 0) {
      const mod = c.createOscillator();
      mod.frequency.value = f * p.ratio;
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * p.index, t);
      mg.gain.setTargetAtTime(f * p.indexEnd, t + p.a, p.indexTau);
      mod.connect(mg).connect(car.frequency);
      mod.start(t);
      v.nodes.push(mod);
    }
    if (p.vib) {
      const lfo = c.createOscillator();
      lfo.frequency.value = p.vib;
      const lg = c.createGain();
      lg.gain.value = f * 0.004;
      lfo.connect(lg).connect(car.frequency);
      lfo.start(t);
      v.nodes.push(lfo);
    }
    const peak = p.gain * velGain;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + p.a);
    amp.gain.setTargetAtTime(peak * p.sus, t + p.a, p.decayTau);
    car.connect(amp);
    car.start(t);
    v.nodes.push(car);
    v.a = p.a;
    v.rel = p.rel;
    return v;
  }

  drum(note, vg, t, amp, v) {
    const c = this.ctx;
    const noise = (hp, lp, dec, gain) => {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      const f1 = c.createBiquadFilter();
      f1.type = 'highpass';
      f1.frequency.value = hp;
      const f2 = c.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = lp;
      const g = c.createGain();
      g.gain.setValueAtTime(gain * vg, t);
      g.gain.setTargetAtTime(0.0001, t + 0.002, dec);
      s.connect(f1).connect(f2).connect(g).connect(amp);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dec * 6);
      v.nodes.push(s);
    };
    const tonal = (f0, f1, sweep, dec, gain, type = 'sine') => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
      const g = c.createGain();
      g.gain.setValueAtTime(gain * vg, t);
      g.gain.setTargetAtTime(0.0001, t + 0.003, dec);
      o.connect(g).connect(amp);
      o.start(t);
      o.stop(t + dec * 6);
      v.nodes.push(o);
    };
    amp.gain.value = 1;
    switch (note) {
      case 35:
      case 36:
        tonal(150, 42, 0.12, 0.09, 1.1);
        break;
      case 38:
      case 40:
        noise(900, 7000, 0.06, 0.55);
        tonal(220, 160, 0.05, 0.04, 0.45, 'triangle');
        break;
      case 41:
      case 43:
        tonal(110, 70, 0.2, 0.1, 0.8);
        break;
      case 45:
      case 47:
        tonal(140, 90, 0.2, 0.1, 0.8);
        break;
      case 48:
      case 50:
        tonal(185, 120, 0.2, 0.1, 0.8);
        break;
      case 49:
      case 52:
      case 55:
      case 57:
        noise(3500, 12000, 0.22, 0.35);
        break;
      case 42:
      case 44:
      case 69:
      case 70:
        noise(6500, 14000, 0.025, 0.4);
        break;
      case 46:
        noise(6000, 14000, 0.1, 0.35);
        break;
      default:
        noise(2000, 9000, 0.05, 0.3);
    }
  }

  release(v, t, rel) {
    if (v.done) return;
    v.done = true;
    const r = rel ?? v.rel;
    const tt = Math.max(t, v.t0 + v.a + 0.001);
    v.amp.gain.setTargetAtTime(0.0001, tt, r / 3);
    for (const n of v.nodes) {
      try {
        n.stop(tt + r * 2 + 0.05);
      } catch (e) {
        /* already stopped */
      }
    }
    setTimeout(() => v.amp.disconnect(), (tt - this.ctx.currentTime + r * 2 + 0.2) * 1000);
  }
}
