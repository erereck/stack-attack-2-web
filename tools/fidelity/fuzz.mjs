// Headless fuzz test of the ported game logic.
import { pathToFileURL } from 'url';
const root = process.argv[2] ? pathToFileURL(process.argv[2] + '/') : new URL('../../', import.meta.url);
const { Game } = await import(new URL('js/game.js', root));
const { JavaRandom } = await import(new URL('js/engine.js', root));
const img = (w, h) => ({ width: w, height: h });
const I = { back: img(97, 71), wall: img(4, 71), font: img(80, 9), lives: img(144, 8), jumps: img(80, 8), hat: img(8, 8), bomb: img(8, 8), crane: img(176, 18), crates: img(112, 8) };
for (const n of ['man', 'man2', 'man3', 'man4', 'woman', 'woman2']) I[n] = img(216, 16);
const KEYS = [0, 1, 2, 5, 6, 8, 42, 48, 49, 51, 53];
let totalFrames = 0, errors = 0, games = 0, maxScore = 0, unlocks = 0, overs = 0;
const issues = new Map();
const note = (k) => issues.set(k, (issues.get(k) || 0) + 1);
for (let seed = 1; seed <= 400; seed++) {
  const rnd = new JavaRandom(seed * 77);
  const rec = { level: seed % 3, soundOff: 0, vibOff: 0, character: seed % 6, unlocked: seed % 6, highscore: 0, hsName: '' };
  const opts = { restoredSfx: true, fixBugs: seed % 2 === 0, startLives: 2, cheatLives: false };
  const cols = seed % 5 === 0 ? 17 : 12;
  const host = { vibrate() {}, save() {}, consumeKey() {}, openOptions() { g.paused = false; } };
  const sfx = { play() {}, midi() {}, tone() {}, smaf: true };
  var g = new Game({ assets: { img: I }, rec, opts, cols, sfx, host, rng: new JavaRandom(seed), cosmeticRng: new JavaRandom(seed + 1) });
  g.start();
  games++;
  let key = { an: 0, ac: 0, raw: 0, rawAc: 0 };
  for (let f = 0; f < 30000 && g.running; f++) {
    if (Math.abs(rnd.nextInt()) % 6 === 0) {
      const an = KEYS[Math.abs(rnd.nextInt()) % KEYS.length];
      key = { an, ac: an ? 1 : 0, raw: an, rawAc: an ? 1 : 0 };
    }
    if (g.paused && g.pauseOverlay && Math.abs(rnd.nextInt()) % 4 === 0) key = { an: 48, ac: 1, raw: 48, rawAc: 1 };
    try {
      g.tick(key);
    } catch (e) {
      errors++;
      note('EXC ' + e.message + ' ' + e.stack.split('\n')[1]);
      break;
    }
    totalFrames++;
    // invariants
    const P = g.player;
    if (P.px < 4 || P.px > 4 + (g.cols - 1) * 8) note('player x out of field');
    if (P.py > 43) note('player below floor');
    const seen = new Set();
    for (let c = 0; c < g.cols; c++) for (let r = 0; r < 7; r++) {
      const cr = g.grid.b[c][r];
      if (seen.has(cr)) note('duplicate crate object');
      seen.add(cr);
      if (cr.state === 0 && cr.type < 4 && r > 0 && g.grid.b[c][r - 1].state === -1) note('floating resting crate');
      if (cr.state === 0 && cr.type < 10 && cr.visible && (cr.x !== (c << 3) + 4 || cr.y !== 51 - (r << 3))) note('resting crate misplaced');
    }
    if (P.state === 0 && P.moveX === 0 && P.moveY === 0) {
      const c = P.col(), r = P.row(0);
      const a = g.grid.at(c, r), b = g.grid.at(c, r + 1);
      if ((g.grid.solid(c, r) && a.state === 0) || (g.grid.solid(c, r + 1) && b.state === 0)) note("player overlaps RESTING crate st=" + a.state + "/" + b.state + " prev=" + P.prevState);
      else if (g.grid.solid(c, r) || g.grid.solid(c, r + 1)) note("overlap moving crate st=" + a.state + "/" + b.state + " prev=" + P.prevState);
    }
  }
  maxScore = Math.max(maxScore, g.score);
  if (g.unlockedNow) unlocks++;
  if (g.gameOver) overs++;
}
console.log({ games, totalFrames, errors, maxScore, unlocks, overs });
for (const [k, v] of issues) console.log(v, k);
