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
  if (w) {
    setOpen(w, true);
    // 記事ごとの URL（/d/…/）から来たとき。フォントの読み込みで位置がずれるので、読み込み後にもう一度合わせる
    const go = () => w.scrollIntoView({ block: 'start', behavior: 'instant' });
    go();
    document.fonts?.ready.then(go);
  }
}

/* ---------- 共有 ---------- */
// 記事ごとの URL（/d/…/）はリンクカード付き。開いた人はトップのその記事に移る
for (const b of $$<HTMLButtonElement>('.win-share')) {
  const label = $('span', b);
  let timer = 0;
  const flash = (text: string) => {
    label.textContent = text;
    clearTimeout(timer);
    timer = window.setTimeout(() => (label.textContent = 'Share'), 1600);
  };
  b.addEventListener('click', async () => {
    const url = new URL(b.dataset.url!, location.origin).href;
    // 共有シートはスマホだけ（PC の共有シートは使いにくいので、コピーにする）
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: b.dataset.title, url }); } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('Copied');
    } catch {
      prompt('URL', url);
    }
  });
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
  fxEcho();
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
  fxEcho();
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
  add(0, fx.on ? Math.cos((fx.mix / 100 * Math.PI) / 2) : 1, true);
  fxTaps().forEach((h, i) => add(fx.time * (i + 1), h));
  taps.replaceChildren(...bars);
}

// 繰り返しの大きさ（原音の後ろに並ぶぶん）。OFF なら空
function fxTaps() {
  const out: number[] = [];
  if (!fx.on) return out;
  let h = Math.sin((fx.mix / 100 * Math.PI) / 2);
  for (let x = fx.time; x < TAP_SPAN && h > 0.03; x += fx.time) {
    out.push(h);
    h *= (fx.fb / 100) * 0.92;
  }
  return out;
}

/* 画面のディレイ: FX が ON で鳴っているあいだ、その記事のウィンドウに繰り返しを出す。
 * - 影: 後ろのコピーほど薄く・ぼけて・少しずれる（ずれは記事ごとに決まった値で、動かない）
 * - 文字: 本文のいくつかの文字が、右へ繰り返しの数だけどもる（下の stutter） */
let echoWin: HTMLElement | null = null;
const small = matchMedia('(max-width: 640px)');
const col = (pct: number) => `color-mix(in srgb, var(--fg) ${Math.round(pct)}%, var(--bg))`;
function fxEcho() {
  const taps = fxTaps().slice(0, 6);
  const win = taps.length && current && !audio.paused ? current.closest<HTMLElement>('.win') : null;
  if (echoWin && echoWin !== win) echoWin.classList.remove('is-echo');
  if (echoWin !== win) stutterStop();
  echoWin = win;
  if (!win) return;

  const base = small.matches ? 4 : 6; // いつもの影（--shadow）
  const step = (small.matches ? 0.7 : 1) * (4 + ((fx.time - 40) / 1160) * 10); // TIME → 1 回あたり 4〜14px
  let seed = [...win.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1; // -1〜1
  const box = taps.map((h, i) => {
    const k = i + 1;
    const d = base + step * k;
    return `${(d + rnd() * 0.5 * k).toFixed(1)}px ${(d + rnd() * 0.5 * k).toFixed(1)}px ${(1.5 * k).toFixed(1)}px ${col(h * 100)}`;
  });
  win.style.setProperty('--echo', box.join(', '));
  win.classList.add('is-echo');
  stutterStart(win);
}

/* 文字のどもり。本文からランダムに何か所か選び、その塊のすぐ後ろに同じ塊を繰り返しの数だけ、後ろほど薄く差し込む。
 * 例: 「点滅していた」→「点滅点滅点滅点滅していた」。差し込んだぶん、後ろの文字は押し出される。
 * 動かさない。選び直すのは、FX のつまみを動かしたときと、再生を始めたときだけ。
 * - 繰り返す塊の長さ: TIME で決める（長いディレイほど長い塊が戻ってくる）
 * - 1文字あたりの繰り返しの数と薄さ: FEEDBACK と MIX（影と同じ fxTaps）
 * 差し込む文字は CSS の ::after で出すので、コピーや読み上げには混ざらない。 */
const STUTTER_SPOTS = 6; // どもる場所の数
let stutterWin: HTMLElement | null = null;
let stutterKey = '';
function stutterStop() {
  stutterKey = '';
  if (!stutterWin) return;
  const parents = new Set<Node>();
  for (const el of $$('.stutter', stutterWin)) {
    if (el.parentNode) parents.add(el.parentNode);
    el.remove();
  }
  parents.forEach((p) => p.normalize()); // 分けたテキストをつなぎ直す
  stutterWin = null;
}
function stutterStart(win: HTMLElement) {
  const key = `${win.id}|${fx.time}|${fx.fb}|${fx.mix}`;
  if (key === stutterKey) return;
  stutterStop();
  stutterKey = key;
  stutterWin = win;

  // TIME が長いほど、繰り返す塊が長くなる（40ms → 1 文字、1200ms → 8 文字）
  const len = 1 + Math.round(((fx.time - 40) / 1160) * 7);
  const spotsIn = (root: HTMLElement) => {
    const out: [Text, number][] = [];
    for (const n of textNodes(root)) {
      const end = Math.max(1, n.length - len + 1); // 塊がテキストの終わりをはみ出さないように（短いテキストは丸ごと）
      for (let i = 0; i < end; i++) if (/\S/.test(n.data[i])) out.push([n, i]);
    }
    return out;
  };
  const take = (from: [Text, number][]) => from.splice(Math.floor(Math.random() * from.length), 1)[0];
  // 子ウィンドウ（音源・画像）は文字が少なくて当たりにくいので、それぞれ 1 か所は必ずどもらせる
  const cws = $$('.cw', win);
  const picks = cws.map((cw) => spotsIn(cw)).filter((s) => s.length).map(take);
  const spots = spotsIn($('.wbody', win)).filter(([n, i]) => !picks.some(([pn, pi]) => pn === n && pi === i));
  while (picks.length < STUTTER_SPOTS + cws.length && spots.length) picks.push(take(spots));
  // 同じテキストの中では後ろから差し込む（前の位置がずれないように）
  const byNode = new Map<Text, number[]>();
  for (const [n, i] of picks) byNode.set(n, [...(byNode.get(n) ?? []), i]);
  const taps = fxTaps().slice(0, 6);
  for (const [node, at] of [...byNode].flatMap(([n, is]) => is.sort((x, y) => y - x).map((i) => [n, i] as const))) {
    const ch = node.data.slice(at, at + len);
    const rest = node.splitText(at + ch.length);
    const wrap = document.createElement('span');
    wrap.className = 'stutter';
    wrap.setAttribute('aria-hidden', 'true');
    for (const h of taps) {
      const g = document.createElement('span');
      g.dataset.c = ch;
      g.style.color = col(h * 100);
      wrap.append(g);
    }
    rest.before(wrap);
  }
}
function textNodes(root: HTMLElement) {
  const out: Text[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('.cw-t, .pbtn, .lbtn, .win-share') || !/\S/.test(n.nodeValue || '') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walk.nextNode()) out.push(walk.currentNode as Text);
  return out;
}
small.addEventListener('change', fxEcho);

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
