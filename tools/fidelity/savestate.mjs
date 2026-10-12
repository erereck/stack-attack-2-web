// Save state round trip: snapshot -> restore into a new Game -> both must evolve identically.
import { pathToFileURL } from 'url';
const root = process.argv[2] ? pathToFileURL(process.argv[2] + '/') : new URL('../../', import.meta.url);
const { Game } = await import(new URL('js/game.js', root));
const { JavaRandom } = await import(new URL('js/engine.js', root));
const img = (w, h) => ({ width: w, height: h });
const I = { back: img(97, 71), wall: img(4, 71), font: img(80, 9), lives: img(144, 8), jumps: img(80, 8), hat: img(8, 8), bomb: img(8, 8), crane: img(176, 18), crates: img(112, 8) };
for (const n of ['man', 'man2', 'man3', 'man4', 'woman', 'woman2']) I[n] = img(216, 16);
const KEYS = [0, 1, 2, 5, 42, 49, 51, 53];
const mk = (rec, cols, seed) => {
  const host = { vibrate() {}, save() {}, consumeKey() {}, openOptions() {} };
  const sfx = { play() {}, midi() {}, tone() {}, smaf: true };
  return new Game({ assets: { img: I }, rec, opts: { startLives: 5 }, cols, sfx, host, rng: new JavaRandom(seed), cosmeticRng: new JavaRandom(seed + 9) });
};
const state = (g) => JSON.stringify(g.snapshot(), (k, v) => (k === 'date' ? 0 : v));
let ok = 0, bad = 0;
for (let t = 1; t <= 40; t++) {
  const rec = { level: t % 3, soundOff: 0, vibOff: 0, character: t % 6, unlocked: 5, highscore: 0 };
  const cols = t % 4 === 0 ? 17 : 12;
  const a = mk(rec, cols, t * 31);
  a.start();
  const rnd = new JavaRandom(t);
  const keys = [];
  for (let f = 0; f < 4000; f++) {
    const an = Math.abs(rnd.nextInt()) % 5 === 0 ? KEYS[Math.abs(rnd.nextInt()) % KEYS.length] : -1;
    keys.push(an);
  }
  let k = { an: 0, ac: 0 };
  const step = (g, f) => {
    if (keys[f] >= 0) k = { an: keys[f], ac: keys[f] ? 1 : 0 };
    g.tick({ ...k });
  };
  const cut = 300 + t * 37;
  for (let f = 0; f < cut && a.running; f++) step(a, f);
  const snap = JSON.parse(JSON.stringify(a.snapshot()));
  const b = mk(rec, cols, 1); // different seed on purpose: restore must bring the RNG back
  b.restore(snap);
  let same = state(a) === state(b);
  const kSave = k;
  for (let f = cut; f < 4000 && a.running && same; f++) {
    k = kSave;
    step(a, f);
    const ka = k;
    k = kSave;
    step(b, f);
    same = state(a) === state(b);
    k = ka;
  }
  same ? ok++ : bad++;
}
console.log({ ok, bad });
