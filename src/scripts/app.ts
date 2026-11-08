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
    nowText.textContent = `Now playing: ${current.dataset.title}  ■`;
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
  if (current !== cw) {
    stop();
    current = cw;
    audio.src = cw.dataset.src!;
  }
  if (at != null && Number.isFinite(audio.duration)) audio.currentTime = at * audio.duration;
  audio.play().catch(() => stop());
}
for (const cw of $$('.cw--sound')) {
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

/* ---------- ポップアップ ---------- */
const navBtns = $$<HTMLButtonElement>('.navb');
const setNav = (which: string) => navBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.nav === which)));
let openModal: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;

function show(id: 'graph' | 'profile', origin = 'top right') {
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
