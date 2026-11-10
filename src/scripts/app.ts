// ページの動き: 記事の開閉、テーマ、時計、再生（全体で1曲）、GRAPH / PROFILE ポップアップ
type Word = { id: string; count: number; x: number; y: number };
type Page = { anchor: string; date: string; snd: string; ex: string; kws: string[] };
type Graph = { words: Word[]; edges: [string, string][]; pages: Page[] };

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- 時計 ---------- */
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad = (n: number) => String(n).padStart(2, '0');
function tick() {
  const d = new Date();
  const el = $('#clock');
  el.textContent = `${DAYS[d.getDay()]} ${MONS[d.getMonth()]} ${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  el.setAttribute('datetime', d.toISOString());
}
tick();
setInterval(tick, 10_000);

/* ---------- テーマ ---------- */
const root = document.documentElement;
const themeText = $('#theme-text');
const showTheme = () => (themeText.textContent = root.dataset.theme === 'dark' ? 'Dark' : 'Light');
showTheme();
$('#theme').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  showTheme();
});

/* ---------- 記事の開閉 ---------- */
const wins = $$('.win');
const allBtn = $<HTMLButtonElement>('#toggle-all');
function setOpen(win: HTMLElement, open: boolean) {
  win.classList.toggle('is-shut', !open);
  const b = $<HTMLButtonElement>('.win-tg', win);
  b.setAttribute('aria-expanded', String(open));
  b.textContent = open ? '−' : '+';
  b.setAttribute('aria-label', `${open ? 'Close' : 'Open'}: ${win.getAttribute('aria-label')}`);
}
function syncCount() {
  const n = wins.filter((w) => !w.classList.contains('is-shut')).length;
  $('#open-count').textContent = String(n);
  const any = n > 0;
  allBtn.setAttribute('aria-expanded', String(any));
  $('.sym', allBtn).textContent = any ? '−' : '+';
  $('.txt', allBtn).textContent = any ? 'Close all' : 'Open all';
}
for (const w of wins) {
  $('.win-tg', w).addEventListener('click', () => {
    setOpen(w, w.classList.contains('is-shut'));
    syncCount();
  });
}
allBtn.addEventListener('click', () => {
  const open = allBtn.getAttribute('aria-expanded') !== 'true';
  wins.forEach((w) => setOpen(w, open));
  syncCount();
});

function jumpTo(anchor: string) {
  const w = document.getElementById(anchor);
  if (!w) return;
  setOpen(w, true);
  syncCount();
  w.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#${anchor}`);
}
// Linked pages など、記事へのリンクは閉じていたら開く
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#w-"]');
  if (!a) return;
  e.preventDefault();
  jumpTo(a.getAttribute('href')!.slice(1));
});
if (location.hash.startsWith('#w-')) {
  const w = document.getElementById(location.hash.slice(1));
  if (w) setOpen(w, true);
}

/* ---------- 再生（全体で1曲だけ） ---------- */
const audio = new Audio();
audio.preload = 'none';
// R2 など別ドメインの音を Web Audio（FX）に通すため。バケット側に CORS の許可が要る
audio.crossOrigin = 'anonymous';
let current: HTMLElement | null = null;
const nowBtn = $('#now');
const nowText = $('#now-text');
const fmt = (s: number) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

function paint(cw: HTMLElement, frac: number) {
  const bars = $$('.wave i', cw);
  const k = Math.round(frac * bars.length);
  bars.forEach((b, i) => b.classList.toggle('on', i < k));
}
function setPlaying(cw: HTMLElement, on: boolean) {
  cw.classList.toggle('is-playing', on);
  $('.pbtn', cw).setAttribute('aria-label', `${on ? 'Pause' : 'Play'}: ${cw.dataset.title}`);
}
function showNow() {
  if (current && !audio.paused) {
    nowText.textContent = `Now playing: ${current.dataset.title}${audio.loop ? ' (loop)' : ''}  ■`;
    nowBtn.setAttribute('aria-label', `Stop: ${current.dataset.title}`);
  } else {
    nowText.textContent = 'Not playing';
    nowBtn.setAttribute('aria-label', 'Nothing playing');
  }
}
function stop() {
  audio.pause();
  if (current) {
    setPlaying(current, false);
    paint(current, 0);
    $('.cw-t', current).textContent = '0:00';
  }
  current = null;
  showNow();
}
function play(cw: HTMLElement, at?: number) {
  fxStart();
  if (current !== cw) {
    stop();
    current = cw;
    audio.src = cw.dataset.src!;
  }
  audio.loop = cw.dataset.loop === '1';
  if (at != null && Number.isFinite(audio.duration)) audio.currentTime = at * audio.duration;
  audio.play().catch(() => stop());
}
// ループの切り替え（再生中の曲なら、その場で反映する）
function setLoop(cw: HTMLElement, on: boolean) {
  cw.dataset.loop = on ? '1' : '';
  $('.lbtn', cw).setAttribute('aria-pressed', String(on));
  if (current === cw) { audio.loop = on; showNow(); }
}
for (const cw of $$('.cw--sound')) {
  $('.lbtn', cw).addEventListener('click', () => setLoop(cw, cw.dataset.loop !== '1'));
  $('.pbtn', cw).addEventListener('click', () => {
    if (current === cw && !audio.paused) audio.pause();
    else play(cw);
  });
  // 波形を押すとその位置から
  $('.wave', cw).addEventListener('click', (e) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, ((e as MouseEvent).clientX - r.left) / r.width));
    if (current === cw && Number.isFinite(audio.duration)) {
      audio.currentTime = frac * audio.duration;
      if (audio.paused) audio.play();
    } else {
      play(cw);
      audio.addEventListener('loadedmetadata', () => (audio.currentTime = frac * audio.duration), { once: true });
    }
  });
}
audio.addEventListener('play', () => { if (current) setPlaying(current, true); showNow(); });
audio.addEventListener('pause', () => { if (current) setPlaying(current, false); showNow(); });
audio.addEventListener('ended', stop);
audio.addEventListener('timeupdate', () => {
  if (!current || !audio.duration) return;
  paint(current, audio.currentTime / audio.duration);
  $('.cw-t', current).textContent = fmt(audio.currentTime);
});
nowBtn.addEventListener('click', stop);

/* ---------- FX（ディレイ） ----------
 * audio → dry ─────────────────────────┐
 *       → send → delay ⇄ (feedback → lowpass) │→ limiter → 出力
 *                 delay → wet ───────────────┘
 * OFF のときは send を 0 にするだけ（残響は自然に消えていく）。
 * AudioContext はブラウザの決まりで、最初に再生ボタンを押したときに作る。
 */
type FxState = { on: boolean; time: number; fb: number; mix: number };
const FX_DEFAULT: FxState = { on: false, time: 380, fb: 45, mix: 35 };
let fx: FxState = { ...FX_DEFAULT };
try { fx = { ...FX_DEFAULT, ...JSON.parse(localStorage.getItem('fx') || '{}') }; } catch {}

let ctx: AudioContext | null = null;
let nodes: { send: GainNode; delay: DelayNode; feedback: GainNode; dry: GainNode; wet: GainNode } | null = null;

function fxStart() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const src = ctx.createMediaElementSource(audio);
  const dry = ctx.createGain();
  const send = ctx.createGain();
  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200; // 繰り返すたびに少しずつこもる
  const wet = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor(); // フィードバックを上げても耳を守る
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  src.connect(dry).connect(limiter);
  src.connect(send).connect(delay);
  delay.connect(feedback).connect(tone).connect(delay);
  delay.connect(wet).connect(limiter);
  limiter.connect(ctx.destination);
  nodes = { send, delay, feedback, dry, wet };
  fxApply(true);
}

function fxApply(instant = false) {
  try { localStorage.setItem('fx', JSON.stringify(fx)); } catch {}
  fxShow();
  if (!ctx || !nodes) return;
  const t = ctx.currentTime;
  const set = (p: AudioParam, v: number, tc = 0.03) => (instant ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, tc));
  const m = fx.mix / 100;
  set(nodes.send.gain, fx.on ? 1 : 0, 0.01);
  set(nodes.dry.gain, fx.on ? Math.cos((m * Math.PI) / 2) : 1);
  set(nodes.wet.gain, Math.sin((m * Math.PI) / 2));
  set(nodes.feedback.gain, fx.fb / 100);
  // 時間はゆっくり追従させる（動かすとテープのように音程が揺れる）
  set(nodes.delay.delayTime, fx.time / 1000, 0.08);
}

const fxWin = $('#fx');
const fxNav = $<HTMLButtonElement>('.navb[data-nav="fx"]');
const fxOn = $<HTMLButtonElement>('#fx-on');
const sliders = {
  time: $<HTMLInputElement>('#fx-time'),
  fb: $<HTMLInputElement>('#fx-fb'),
  mix: $<HTMLInputElement>('#fx-mix'),
};
const readout = { time: (v: number) => `${v} ms`, fb: (v: number) => `${v}%`, mix: (v: number) => `${v}%` };

// 残響の見え方: 0 秒から 2.4 秒までに、原音と繰り返しを縦線で並べる
const taps = $('#fx-taps');
const TAP_SPAN = 2400;
function fxShow() {
  fxOn.setAttribute('aria-pressed', String(fx.on));
  fxOn.textContent = fx.on ? 'On' : 'Off';
  fxWin.classList.toggle('is-on', fx.on);
  for (const k of ['time', 'fb', 'mix'] as const) {
    sliders[k].value = String(fx[k]);
    sliders[k].style.setProperty('--v', `${((fx[k] - +sliders[k].min) / (+sliders[k].max - +sliders[k].min)) * 100}%`);
    $(`#fx-${k}-v`).textContent = readout[k](fx[k]);
  }
  const bars: HTMLElement[] = [];
  const add = (x: number, h: number, dry = false) => {
    const i = document.createElement('i');
    i.style.left = `${(x / TAP_SPAN) * 100}%`;
    i.style.height = `${Math.max(4, h * 100)}%`;
    if (dry) i.className = 'dry';
    bars.push(i);
  };
  const m = fx.mix / 100;
  add(0, fx.on ? Math.cos((m * Math.PI) / 2) : 1, true);
  if (fx.on) {
    let h = Math.sin((m * Math.PI) / 2);
    for (let x = fx.time; x < TAP_SPAN && h > 0.03; x += fx.time) {
      add(x, h);
      h *= (fx.fb / 100) * 0.92;
    }
  }
  taps.replaceChildren(...bars);
}

for (const k of ['time', 'fb', 'mix'] as const) {
  sliders[k].addEventListener('input', () => {
    fx[k] = +sliders[k].value;
    fxApply();
  });
}
fxOn.addEventListener('click', () => {
  fx.on = !fx.on;
  fxApply();
});

function fxOpen(open: boolean) {
  fxWin.hidden = !open;
  fxNav.setAttribute('aria-pressed', String(open));
  document.body.classList.toggle('fx-open', open);
  if (open) fxOn.focus({ preventScroll: true });
}
fxNav.addEventListener('click', () => fxOpen(fxWin.hidden));
$('#fx-close').addEventListener('click', () => { fxOpen(false); fxNav.focus(); });
fxWin.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { fxOpen(false); fxNav.focus(); }
});

// タイトルバーをつかんで動かす（スマホでは下に張り付くので動かさない）
const grip = $('.fx-bar', fxWin);
const narrow = matchMedia('(max-width: 640px)');
grip.addEventListener('pointerdown', (e) => {
  if (narrow.matches || (e.target as Element).closest('button')) return;
  const r = fxWin.getBoundingClientRect();
  const dx = e.clientX - r.left, dy = e.clientY - r.top;
  grip.setPointerCapture(e.pointerId);
  fxWin.classList.add('is-dragging');
  const move = (ev: PointerEvent) => {
    const x = Math.min(window.innerWidth - r.width, Math.max(0, ev.clientX - dx));
    const y = Math.min(window.innerHeight - 40, Math.max(0, ev.clientY - dy));
    fxWin.style.left = `${x}px`;
    fxWin.style.top = `${y}px`;
    fxWin.style.right = fxWin.style.bottom = 'auto';
  };
  const up = () => {
    grip.removeEventListener('pointermove', move);
    fxWin.classList.remove('is-dragging');
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up, { once: true });
  grip.addEventListener('pointercancel', up, { once: true });
});
fxShow();

/* ---------- ポップアップ ---------- */
const navBtns = $$<HTMLButtonElement>('.navb:not([data-nav="fx"])'); // FX は開け閉めが別
const setNav = (which: string) => navBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.nav === which)));
let openModal: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;

function show(id: 'graph' | 'profile' | 'changelog', origin = 'top right') {
  if (openModal && openModal.id !== id) openModal.hidden = true;
  else returnFocus = document.activeElement as HTMLElement;
  const m = document.getElementById(id)!;
  $('.modal', m).style.transformOrigin = origin;
  // アニメーションをやり直す
  m.hidden = true;
  void m.offsetWidth;
  m.hidden = false;
  openModal = m;
  document.body.classList.add('modal-open');
  setNav(id);
  $<HTMLButtonElement>('.xbtn', m).focus({ preventScroll: true });
}
function hide() {
  if (!openModal) return;
  openModal.hidden = true;
  openModal = null;
  document.body.classList.remove('modal-open');
  setNav('article');
  returnFocus?.focus({ preventScroll: true });
  returnFocus = null;
}
for (const b of navBtns) {
  b.addEventListener('click', () => {
    if (b.dataset.nav === 'graph') { renderGraph(); show('graph'); }
    else if (b.dataset.nav === 'profile') show('profile');
    else hide();
  });
}
$$('[data-close]').forEach((b) => b.addEventListener('click', hide));
$('#ver').addEventListener('click', () => show('changelog', 'top right'));
document.addEventListener('keydown', (e) => {
  if (!openModal) return;
  if (e.key === 'Escape') hide();
  if (e.key === 'Tab') {
    // フォーカスをポップアップの中に留める
    const f = $$<HTMLElement>('.modal button, .modal a[href], .modal input', openModal).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const [first, last] = [f[0], f[f.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- GRAPH ---------- */
const G: Graph = JSON.parse($('#graph-data').textContent || '{}');
const count = new Map(G.words.map((w) => [w.id, w.count]));
const byId = new Map(G.words.map((w) => [w.id, w]));
const neighbors = new Map<string, Set<string>>(G.words.map((w) => [w.id, new Set()]));
for (const [a, b] of G.edges) { neighbors.get(a)!.add(b); neighbors.get(b)!.add(a); }
const ranked = [...G.words].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, 'ja'));
let sel = ranked[0]?.id ?? '';
let filter = '';

const canvas = $('#g-canvas');
const nodeEls = new Map<string, HTMLButtonElement>();
for (const w of G.words) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `gnode ${w.count >= 3 ? 'c3' : w.count === 2 ? 'c2' : 'one'}`;
  b.style.left = `${w.x}%`;
  b.style.top = `${w.y}%`;
  b.setAttribute('aria-label', `${w.id} — ${w.count} pages`);
  b.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="lbl"></span>';
  $('.lbl', b).textContent = w.id;
  b.addEventListener('click', () => pick(w.id));
  canvas.append(b);
  nodeEls.set(w.id, b);
}
$<HTMLInputElement>('#kw-filter').addEventListener('input', (e) => {
  filter = (e.target as HTMLInputElement).value.trim().toLowerCase();
  renderGraph();
});

function chip(id: string, withCount: boolean) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `chip${count.get(id) === 1 ? ' one' : ''}`;
  b.setAttribute('aria-pressed', String(id === sel));
  b.textContent = id + ' ';
  if (withCount) {
    const s = document.createElement('small');
    s.textContent = String(count.get(id));
    b.append(s);
  }
  b.addEventListener('click', () => pick(id));
  return b;
}
function pick(id: string) {
  sel = id;
  renderGraph();
}
function renderGraph() {
  const match = (id: string) => !filter || id.toLowerCase().includes(filter);
  const near = neighbors.get(sel) ?? new Set();
  let on = '', faint = '';
  for (const [a, b] of G.edges) {
    const p = byId.get(a)!, q = byId.get(b)!;
    const seg = `M${p.x * 10} ${p.y * 6}L${q.x * 10} ${q.y * 6}`;
    if (a === sel || b === sel) on += seg; else faint += seg;
  }
  $('#g-on').setAttribute('d', on || 'M0 0');
  $('#g-faint').setAttribute('d', faint || 'M0 0');
  for (const [id, b] of nodeEls) {
    b.setAttribute('aria-pressed', String(id === sel));
    b.classList.toggle('near', near.has(id));
    b.classList.toggle('miss', !match(id));
  }
  $('#g-chips').replaceChildren(...ranked.filter((w) => match(w.id)).map((w) => chip(w.id, true)));

  const pages = G.pages.filter((p) => p.kws.includes(sel));
  $('#g-sel').textContent = sel;
  $('#g-sel-count').textContent = String(pages.length);
  $('#g-pages').replaceChildren(...pages.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pcard';
    b.innerHTML = '<span class="pcard-top"><span></span><span></span></span><span class="pcard-ex"></span>';
    const [d, s] = $$('.pcard-top span', b);
    d.textContent = p.date;
    s.textContent = p.snd;
    $('.pcard-ex', b).textContent = p.ex;
    b.addEventListener('click', () => {
      returnFocus = null;
      hide();
      jumpTo(p.anchor);
    });
    return b;
  }));
  const rel = [...near].sort((a, b) => count.get(b)! - count.get(a)! || a.localeCompare(b, 'ja'));
  $('#g-rel-count').textContent = String(rel.length);
  $('#g-related').replaceChildren(...rel.map((id) => chip(id, false)));
}

// 本文のキーワード → そのキーワードを選んだ状態で GRAPH を中央から
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a.kw');
  if (!a) return;
  e.preventDefault();
  const kw = a.dataset.kw!;
  if (count.has(kw)) sel = kw;
  filter = '';
  $<HTMLInputElement>('#kw-filter').value = '';
  renderGraph();
  show('graph', 'center');
});
