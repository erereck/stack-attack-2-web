// Runs the JS port with the same seed + key script and dumps state in the Java harness format.
import fs from 'fs';
import { pathToFileURL } from 'url';
const [base, seedS, levelS, chS, unlS, framesS, scriptFile, outFile] = process.argv.slice(2);
const root = pathToFileURL(base + '/');
const { Game } = await import(new URL('js/game.js', root));
const { JavaRandom } = await import(new URL('js/engine.js', root));
const img = (w, h) => ({ width: w, height: h });
const I = { back: img(97, 71), wall: img(4, 71), font: img(80, 9), lives: img(144, 8), jumps: img(80, 8), hat: img(8, 8), bomb: img(8, 8), crane: img(176, 18), crates: img(112, 8) };
for (const n of ['man', 'man2', 'man3', 'man4', 'woman', 'woman2']) I[n] = img(216, 16);

const rec = { level: +levelS, soundOff: 0, vibOff: 0, character: +chS, unlocked: +unlS, highscore: 0, hsName: '' };
const opts = { startLives: 2 };
const key = { an: 0, ac: 0, raw: 0, rawAc: 0 };
const host = { vibrate() {}, save() {}, consumeKey() { key.raw = 0; }, openOptions() {} };
const sfx = { play() {}, midi() {}, tone() {}, smaf: true };
const rng = new JavaRandom(Number(seedS));
const g = new Game({ assets: { img: I }, rec, opts, cols: 12, sfx, host, rng, cosmeticRng: rng });
g.start();
const script = fs.readFileSync(scriptFile, 'utf8').split(/\r?\n/);
const out = [];
const b = (v) => (v ? 1 : 0);
for (let fr = 0; fr < +framesS && g.running; fr++) {
  const line = (script[fr] || '-').trim();
  if (line !== '-') {
    const [an, ac] = line.split(' ').map(Number);
    key.an = key.raw = an;
    key.ac = key.rawAc = ac;
  }
  let err = '';
  try {
    g.tick(key);
  } catch (e) {
    err = ' EXC ' + e.message;
  }
  const P = g.player;
  let s = `${fr} sc=${g.score} pl=${P.px},${P.py},${P.state},${P.lives},${P.invuln},${P.moveX},${P.moveY},${P.step},${P.anim},${P.frame}`;
  s += ` av=${g.superJumps} Z=${b(g.hat)} I=${b(g.holdingBomb)} T=${b(g.gameOver)} p=${b(g.paused)}${b(g.pauseOverlay)} K=${g.craneCooldown} as=${b(g.bombOnScreen)}`;
  s += ` M=${b(g.unlockReady)}${b(g.unlockDropped)}${b(g.unlockOnCrane)}${b(g.unlockedNow)} s=${g.combo} ap=${g.overWait}`;
  const vis = (d) => b(d.visible && d.x >= 0);
  s += ` pop=${g.popX},${g.popY},${g.popTimer},${vis(g.digH)}${vis(g.digT)}${vis(g.digO)},${g.digH.frame}${g.digT.frame}${g.digO.frame}`;
  s += ` hud=${g.hudLives.frame},${g.hudJumps.visible ? g.hudJumps.frame : -1}`;
  s += ' cr=' + g.cranes.map((c) => `${c.cx_},${c.target},${c.cargo},${c.on},${c.delay},${c.dx};`).join('');
  s += ' aa=' + g.reserved.map(b).join('');
  s += ' g=';
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 12; c++) {
      const cr = g.grid.b[c][r];
      if (cr.state === -1 && !cr.visible) {
        s += '.';
        continue;
      }
      s += `[${c}:${r} ${cr.state},${cr.type},${cr.offX},${cr.offY},${cr.x},${cr.y},${b(cr.visible)},${cr.timer},${b(cr.active)}]`;
    }
  out.push(s + err);
  if (err) break;
}
fs.writeFileSync(outFile, out.join('\n') + '\n');
