// deterministic key script: "an ac" on event frames, "-" otherwise
import fs from 'fs';
const [seed, frames, out, allowRed] = process.argv.slice(2);
let s = Number(seed) * 2654435761 >>> 0;
const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
const KEYS = [1, 2, 5, 1, 2, 5, 49, 51, 53, 42, 48, 2, 5];
const lines = [];
let held = 0;
for (let f = 0; f < +frames; f++) {
  const r = rnd();
  if (r < 0.12) { held = KEYS[Math.floor(rnd() * KEYS.length)]; lines.push(`${held} 1`); }
  else if (r < 0.2 && held) { lines.push(`${held} 0`); held = 0; }
  else if (allowRed === '1' && f > frames * 0.9 && r > 0.995) lines.push('-12 1');
  else lines.push('-');
}
fs.writeFileSync(out, lines.join('\n') + '\n');
