// The port's own settings overlay (think Ship of Harkinian's menu bar):
// everything that is not part of the original phone UI lives here.

import { opts, setOpt, keyBindings, scores, stats, clearScores, exportSave, importSave, wipeAll, resetOpts, cheatsActive, rec } from './settings.js';
import { ui } from './i18n.js';
import { GAME_LANGS } from './i18n.js';
import { DEFAULT_KEYS } from './input.js';
import { CHARACTER_ICONS } from './game.js';

const VERSION = '1.0.0';

const KEY_NAMES = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Backspace: 'Backspace',
  Escape: 'Esc',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift D',
  ControlLeft: 'Ctrl',
  NumpadMultiply: 'Num *',
  BracketLeft: '[',
  BracketRight: ']',
  Delete: 'Del',
  End: 'End',
};
const keyName = (c) => KEY_NAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

export class PortMenu {
  constructor(root, host) {
    this.root = root;
    this.host = host;
    this.tab = 'video';
    this.waitKey = null;
    this.isOpen = false;
    root.addEventListener('pointerdown', (e) => {
      if (e.target === root) this.close();
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.isOpen) return;
        if (this.waitKey) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.code !== 'Escape') {
            const b = Object.assign({}, opts.keys || {});
            b[this.waitKey] = [e.code];
            setOpt('keys', b);
            window.dispatchEvent(new Event('sa2-bindings'));
          }
          this.waitKey = null;
          this.render();
          return;
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.close();
        }
      },
      true
    );
  }

  open(tab) {
    if (tab) this.tab = tab;
    this.isOpen = true;
    this.root.hidden = false;
    this.render();
    this.host.onOpen?.();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.waitKey = null;
    this.root.hidden = true;
    this.host.onClose?.();
  }
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  render() {
    const scrollTop = this.root.querySelector('.pm-body')?.scrollTop || 0;
    const tabs = [
      ['general', ui('tabGeneral')],
      ['video', ui('tabVideo')],
      ['game', ui('tabGame')],
      ['audio', ui('tabAudio')],
      ['controls', ui('tabControls')],
      ['cheats', ui('tabCheats')],
      ['records', ui('tabRecords')],
      ['about', ui('tabAbout')],
    ];
    const body = h('div', { class: 'pm-body' }, this[`tab_${this.tab}`]());
    const panel = h(
      'div',
      { class: 'pm', role: 'dialog', 'aria-label': ui('menu') },
      h('div', { class: 'pm-head' }, h('img', { src: 'assets/img/logo2.png', alt: '' }), h('h2', {}, ui('menu')), h('button', { class: 'pm-x', 'aria-label': ui('close'), onclick: () => this.close() }, '×')),
      this.host.inGame()
        ? h(
            'div',
            { class: 'pm-game' },
            h('button', { class: 'btn primary', onclick: () => this.close() }, '▶ ' + ui('resume')),
            h('button', { class: 'btn', onclick: () => (this.close(), this.host.restartGame()) }, '↻ ' + ui('restartGame')),
            h('button', { class: 'btn danger', onclick: () => (this.close(), this.host.endGame()) }, '■ ' + ui('endGame')),
            h('button', { class: 'btn', onclick: () => this.host.saveState() }, '💾 ' + ui('saveState')),
            h('button', { class: 'btn', disabled: !this.host.hasState(), onclick: () => (this.close(), this.host.loadState()) }, '📂 ' + ui('loadState'))
          )
        : null,
      h(
        'div',
        { class: 'pm-tabs', role: 'tablist' },
        tabs.map(([id, label]) =>
          h(
            'button',
            {
              class: 'pm-tab',
              role: 'tab',
              'aria-selected': String(this.tab === id),
              onclick: () => {
                this.tab = id;
                this.render();
                this.root.querySelector('.pm-body').scrollTop = 0;
              },
            },
            label
          )
        )
      ),
      body
    );
    this.root.replaceChildren(panel);
    this.root.querySelector('.pm-body').scrollTop = scrollTop;
    const sel = this.root.querySelector('.pm-tab[aria-selected="true"]');
    sel?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ---------- row builders ---------- */
  set(k, v) {
    setOpt(k, v);
    this.render();
  }
  toggle_(k, label, desc) {
    return h(
      'div',
      { class: 'pm-row' },
      h('div', { class: 'pm-lbl' }, h('b', {}, ui(label || k)), desc ? h('small', {}, ui(desc)) : null),
      h('button', { class: 'sw', role: 'switch', 'aria-checked': String(!!opts[k]), 'aria-label': ui(label || k), onclick: () => this.set(k, !opts[k]) })
    );
  }
  seg(k, label, choices, desc) {
    return h(
      'div',
      { class: 'pm-row col' },
      h('div', { class: 'pm-lbl' }, h('b', {}, ui(label || k)), desc ? h('small', {}, ui(desc)) : null),
      h(
        'div',
        { class: 'seg' },
        choices.map(([v, l]) => h('button', { 'aria-pressed': String(opts[k] === v), onclick: () => this.set(k, v) }, typeof l === 'string' ? ui(l) : l))
      )
    );
  }
  select(k, label, choices) {
    const s = h(
      'select',
      { class: 'sel', 'aria-label': ui(label), onchange: (e) => this.set(k, e.target.value) },
      choices.map(([v, l]) => h('option', { value: v, selected: opts[k] === v }, l))
    );
    return h('div', { class: 'pm-row' }, h('div', { class: 'pm-lbl' }, h('b', {}, ui(label))), s);
  }
  range(k, label, min, max, step, fmt = (v) => v + '%', desc) {
    const out = h('output', {}, fmt(opts[k]));
    const inp = h('input', {
      type: 'range',
      min,
      max,
      step,
      value: opts[k],
      'aria-label': ui(label),
      oninput: (e) => {
        out.textContent = fmt(+e.target.value);
        setOpt(k, +e.target.value);
      },
    });
    return h('div', { class: 'pm-row' }, h('div', { class: 'pm-lbl' }, h('b', {}, ui(label)), desc ? h('small', {}, ui(desc)) : null), h('div', { class: 'rng' }, inp, out));
  }
  section(t) {
    return h('div', { class: 'pm-section' }, t);
  }

  /* ---------- tabs ---------- */
  tab_general() {
    return [
      this.select('lang', 'lang', [['auto', ui('langAuto')], ...Object.entries(GAME_LANGS).map(([k, v]) => [k, v.name])]),
      this.seg('intro', 'intro', [
        ['original', 'introOriginal'],
        ['quick', 'introQuick'],
        ['skip', 'introSkip'],
      ]),
      this.toggle_('pauseOnBlur'),
      this.toggle_('daily', 'daily', 'dailyDesc'),
      h('div', { class: 'pm-row' }, h('div', { class: 'pm-lbl' }), h('button', { class: 'btn', onclick: () => (resetOpts(), this.render()) }, ui('resetOpts'))),
    ];
  }
  tab_video() {
    return [
      h('div', { class: 'pm-row' }, h('div', { class: 'pm-lbl' }, h('b', {}, ui('fullscreen'))), h('button', { class: 'btn primary', onclick: () => this.host.fullscreen() }, '⛶ ' + ui('fullscreen'))),
      this.seg(
        'layout',
        'layout',
        [
          ['original', 'layoutOriginal'],
          ['wide-hud', 'layoutWideHud'],
          ['wide-field', 'layoutWideField'],
        ],
        'layoutDesc'
      ),
      this.seg('skin', 'skin', [
        ['auto', 'skinAuto'],
        ['none', 'skinNone'],
        ['bezel', 'skinBezel'],
        ['phone', 'skinPhone'],
      ]),
      this.seg('scaling', 'scaling', [
        ['fit', 'scaleFit'],
        ['integer', 'scaleInt'],
        ['stretch', 'scaleStretch'],
      ]),
      this.seg('filter', 'filter', [
        ['sharp', 'filterSharp'],
        ['lcd', 'filterLcd'],
        ['scan', 'filterScan'],
        ['soft', 'filterSoft'],
      ]),
      this.seg(
        'ghost',
        'ghost',
        [
          [0, 'ghostOff'],
          [0.35, 'ghostLow'],
          [0.6, 'ghostHigh'],
        ],
        'ghostDesc'
      ),
      this.seg('palette', 'palette', [
        ['original', 'palOriginal'],
        ['lcd', 'palLcd'],
        ['gb', 'palGb'],
        ['gray', 'palGray'],
        ['vivid', 'palVivid'],
        ['night', 'palNight'],
      ]),
      this.toggle_('smooth', 'smooth', 'smoothDesc'),
      this.toggle_('shake'),
      this.toggle_('showFps'),
    ];
  }
  tab_game() {
    return [
      this.range('speed', 'speed', 50, 200, 25, (v) => v + '%', 'speedDesc'),
      this.toggle_('inputBuffer', 'inputBuffer', 'inputBufferDesc'),
      this.toggle_('dirJump', 'dirJump', 'dirJumpDesc'),
      this.toggle_('hudScore'),
      this.toggle_('dropGuide'),
      this.toggle_('restoredSfx', 'restoredSfx', 'restoredSfxDesc'),
      this.toggle_('fixBugs', 'fixBugs', 'fixBugsDesc'),
      this.toggle_('inGameMusic'),
    ];
  }
  tab_audio() {
    return [
      this.range('master', 'master', 0, 100, 5),
      this.range('music', 'music', 0, 100, 5),
      this.range('sfx', 'sfx', 0, 100, 5),
      this.seg('sound', 'sound', [
        ['smaf', 'soundSmaf'],
        ['beep', 'soundBeep'],
      ]),
      this.seg('synth', 'synth', [
        ['fm', 'synthFm'],
        ['chip', 'synthChip'],
      ]),
      this.toggle_('phoneSpeaker'),
      this.toggle_('loopMenuMusic'),
    ];
  }
  tab_controls() {
    const b = keyBindings();
    const rows = Object.keys(DEFAULT_KEYS).map((a) => [
      h('span', {}, ui('act' + a)),
      h(
        'button',
        {
          class: 'kbd' + (this.waitKey === a ? ' wait' : ''),
          onclick: () => {
            this.waitKey = a;
            this.render();
          },
        },
        this.waitKey === a ? ui('pressKey') : (b[a] || []).map(keyName).join(' / ') || '—'
      ),
    ]);
    return [
      this.seg('touch', 'touch', [
        ['auto', 'touchAuto'],
        ['pad', 'touchPad'],
        ['none', 'touchNone'],
      ]),
      this.range('padSize', 'padSize', 70, 140, 5),
      this.range('padOpacity', 'padOpacity', 25, 100, 5),
      this.toggle_('haptics'),
      this.toggle_('realVibration'),
      this.section(ui('keysTitle')),
      h('p', { class: 'pm-lbl' }, h('small', {}, ui('keysHint'))),
      h('div', { class: 'keys' }, rows.flat()),
      h(
        'div',
        { class: 'pm-row' },
        h('div', { class: 'pm-lbl' }),
        h(
          'button',
          {
            class: 'btn',
            onclick: () => {
              setOpt('keys', null);
              window.dispatchEvent(new Event('sa2-bindings'));
              this.render();
            },
          },
          ui('keysReset')
        )
      ),
      h('p', { class: 'note' }, ui('gamepadInfo')),
    ];
  }
  tab_cheats() {
    return [
      h('p', { class: 'note' }, ui('cheatsNote')),
      this.toggle_('cheatUnlockAll'),
      this.toggle_('cheatLives'),
      this.toggle_('cheatJumps'),
      this.toggle_('cheatHat'),
      this.range('startLives', 'startLives', 0, 9, 1, (v) => String(v)),
    ];
  }
  tab_records() {
    const S = this.host.strings();
    const names = [S.O, S.N, S.M, S.K, S.J, S.H];
    const levels = [S.ai, S.U, S.V];
    const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
    const table = scores.length
      ? h(
          'table',
          { class: 'rec' },
          h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, ui('recChar')), h('th', {}, ui('recLevel')), h('th', {}, ui('recDate')), h('th', { style: 'text-align:right' }, ui('recScore')))),
          h(
            'tbody',
            {},
            scores.slice(0, 20).map((s, i) =>
              h(
                'tr',
                {},
                h('td', {}, String(i + 1)),
                h('td', {}, h('img', { src: `assets/img/${CHARACTER_ICONS[s.char] || 'iconman'}.png`, alt: '' }), s.name || names[s.char] || ''),
                h('td', {}, (levels[s.level] || '') + (s.cols && s.cols !== 12 ? ' · ' + s.cols + 'c' : '') + (s.daily ? ' · ' + ui('dailyTag') : '') + (s.speed && s.speed !== 100 ? ` · ${s.speed}%` : '')),
                h('td', {}, fmtDate(s.date)),
                h('td', { class: 'n' }, String(s.score))
              )
            )
          )
        )
      : h('p', { class: 'pm-lbl' }, h('small', {}, ui('recEmpty')));
    const t = Math.round(stats.time / 60);
    const stat = (v, l) => h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, ui(l)));
    const fileIn = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onchange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          importSave(await f.text());
          this.host.toast(ui('importOk'));
        } catch (err) {
          this.host.toast(ui('importFail'));
        }
        this.render();
      },
    });
    return [
      this.section(ui('recTitle')),
      table,
      scores.length ? h('div', { class: 'btns', style: 'margin-top:10px' }, h('button', { class: 'btn danger', onclick: () => (clearScores(), this.render()) }, ui('recClear'))) : null,
      this.section(ui('statsTitle')),
      h(
        'div',
        { class: 'stats' },
        stat(stats.games, 'statGames'),
        stat(t >= 60 ? `${Math.floor(t / 60)}h ${t % 60}m` : `${t} min`, 'statTime'),
        stat(stats.crates, 'statCrates'),
        stat(stats.combos, 'statCombos'),
        stat(stats.rows, 'statRows'),
        stat(Math.max(stats.best, rec.highscore), 'statBest'),
        stat(stats.bestCombo, 'statBestCombo')
      ),
      this.section(ui('saveTitle')),
      h(
        'div',
        { class: 'btns' },
        h(
          'button',
          {
            class: 'btn',
            onclick: () => {
              const a = h('a', { href: URL.createObjectURL(new Blob([exportSave()], { type: 'application/json' })), download: 'stack-attack-2-save.json' });
              document.body.append(a);
              a.click();
              setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
            },
          },
          '⇩ ' + ui('exportSave')
        ),
        h('button', { class: 'btn', onclick: () => fileIn.click() }, '⇧ ' + ui('importSave')),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              if (confirm(ui('wipeConfirm'))) {
                wipeAll();
                location.reload();
              }
            },
          },
          ui('wipe')
        ),
        fileIn
      ),
    ];
  }
  tab_about() {
    return h(
      'div',
      { class: 'about' },
      h('p', {}, ui('aboutText')),
      h('p', {}, 'Developed by Mobile Scope AG · Version 1.08 (MIDlet)'),
      h('p', {}, `${ui('version')} ${VERSION} · `, h('a', { href: 'https://github.com/erereck/stack-attack-2-web', target: '_blank', rel: 'noopener' }, 'github.com/erereck/stack-attack-2-web')),
      h('p', { class: 'note' }, ui('aboutRights')),
      cheatsActive() ? h('p', { class: 'note' }, ui('cheatsNote')) : null
    );
  }
}
