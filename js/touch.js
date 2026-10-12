// On-screen controls: an 8-way virtual d-pad, A/B buttons, small buttons and
// the clickable phone keypad. Fingers can slide between directions/buttons.

import { Keys } from './input.js';

let hapticsOn = () => true;
function buzz() {
  if (hapticsOn() && navigator.vibrate) {
    try {
      navigator.vibrate(8);
    } catch (e) {
      /* ignore */
    }
  }
}

/** Buttons with data-act inside a zone; a finger may slide from one to another. */
function buttonZone(zone, prefix) {
  const owned = new Map(); // pointerId -> element
  const pressEl = (pid, el) => {
    const cur = owned.get(pid);
    if (cur === el) return;
    if (cur) {
      cur.classList.remove('down');
      Keys.release(`${prefix}:${pid}:${cur.dataset.act}`);
    }
    if (el) {
      el.classList.add('down');
      Keys.press(`${prefix}:${pid}:${el.dataset.act}`, el.dataset.act);
      buzz();
      owned.set(pid, el);
    } else owned.delete(pid);
  };
  const hit = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const b = el && el.closest('[data-act]');
    return b && zone.contains(b) ? b : null;
  };
  zone.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    try {
      zone.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    pressEl(e.pointerId, b);
  });
  zone.addEventListener('pointermove', (e) => {
    if (!owned.has(e.pointerId)) return;
    const b = hit(e.clientX, e.clientY);
    if (b) pressEl(e.pointerId, b);
  });
  const end = (e) => {
    if (owned.has(e.pointerId)) pressEl(e.pointerId, null);
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** 8-way d-pad. */
function dpad(zone) {
  const knob = zone.querySelector('.dpad-knob');
  const arrows = { U: zone.querySelector('.dp-u'), D: zone.querySelector('.dp-d'), L: zone.querySelector('.dp-l'), R: zone.querySelector('.dp-r') };
  let pid = null,
    cur = null;
  const set = (act, lit) => {
    if (act === cur) return;
    if (cur) Keys.release('dpad:' + cur);
    cur = act;
    if (act) {
      Keys.press('dpad:' + act, act);
      buzz();
    }
    for (const k of Object.keys(arrows)) arrows[k].classList.toggle('on', lit.includes(k));
  };
  const update = (e) => {
    const r = zone.getBoundingClientRect();
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    const dx = e.clientX - cx,
      dy = e.clientY - cy;
    const R = r.width / 2;
    const dist = Math.hypot(dx, dy);
    const k = Math.min(1, dist / (R * 0.55));
    knob.style.transform = `translate(calc(-50% + ${(dx / (dist || 1)) * k * R * 0.32}px), calc(-50% + ${(dy / (dist || 1)) * k * R * 0.32}px))`;
    if (dist < R * 0.2) return set(null, []);
    const ang = (Math.atan2(-dy, dx) * 180) / Math.PI; // 0 = right, 90 = up
    const sector = Math.round(((ang + 360) % 360) / 45) % 8; // 0 E,1 NE,2 N,3 NW,4 W,5 SW,6 S,7 SE
    const game = Keys.context === 'game';
    const mapGame = ['R', 'J3', 'U', 'J1', 'L', 'L', 'D', 'R'];
    const litGame = [['R'], ['U', 'R'], ['U'], ['U', 'L'], ['L'], ['L'], ['D'], ['R']];
    const mapMenu = ['R', 'U', 'U', 'U', 'L', 'D', 'D', 'D'];
    const litMenu = [['R'], ['U'], ['U'], ['U'], ['L'], ['D'], ['D'], ['D']];
    set(game ? mapGame[sector] : mapMenu[sector], game ? litGame[sector] : litMenu[sector]);
  };
  zone.addEventListener('pointerdown', (e) => {
    if (pid !== null) return;
    e.preventDefault();
    pid = e.pointerId;
    try {
      zone.setPointerCapture(pid);
    } catch (err) {
      /* ignore */
    }
    update(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === pid) update(e);
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    set(null, []);
    knob.style.transform = '';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function installTouch({ haptics }) {
  hapticsOn = haptics;
  dpad(document.getElementById('dpad'));
  buttonZone(document.getElementById('pad-main'), 'pm');
  buttonZone(document.getElementById('pad-small'), 'psm');
  buttonZone(document.getElementById('keypad'), 'kp');
}
