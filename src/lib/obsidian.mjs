// Obsidian の書き方（[[キーワード]] と ![[埋め込み]]）を扱う。
// remark プラグインと、ビルド時の集計（src/lib/site.ts）の両方から使う。
import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';

export const WIKI = /(!?)\[\[([^\]\n]+?)\]\]/g;
export const SOUND_EXT = /\.(wav|aiff?|flac|mp3|m4a|ogg|opus)$/i;
export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

const ROOT = process.cwd();
const SOUNDS_JSON = path.join(ROOT, 'src/data/sounds.json');
const ATTACH_DIR = path.join(ROOT, 'site/attachments');

/** [[target|alias]] を分ける */
export function parseTarget(inner) {
  const i = inner.indexOf('|');
  if (i < 0) return { target: inner.trim(), alias: '' };
  return { target: inner.slice(0, i).trim(), alias: inner.slice(i + 1).trim() };
}

/** 本文に出てくるキーワード（出てきた順、重複なし） */
export function keywordsOf(body) {
  const out = [];
  for (const m of body.matchAll(WIKI)) {
    if (m[1]) continue;
    const { target } = parseTarget(m[2]);
    if (target && !out.includes(target)) out.push(target);
  }
  return out;
}

/** 本文に埋め込まれた音源のファイル名 */
export function soundsOf(body) {
  const out = [];
  for (const m of body.matchAll(WIKI)) {
    if (!m[1]) continue;
    const { target } = parseTarget(m[2]);
    if (SOUND_EXT.test(target)) out.push(target);
  }
  return out;
}

/** 本文をプレーンテキストにして先頭を切り出す（GRAPH のカード用） */
export function excerptOf(body, max = 48) {
  const text = body
    .split('\n')
    .filter((l) => !/^\s*!\[\[.+\]\]\s*$/.test(l))
    .join(' ')
    .replace(WIKI, (_, bang, inner) => {
      if (bang) return '';
      const { target, alias } = parseTarget(inner);
      return alias || target;
    })
    .replace(/[#>*_`~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** ファイル名から表示用のタイトル */
export function soundTitle(name) {
  return name.replace(SOUND_EXT, '').replace(/[-_]+/g, ' ');
}

export function loadSounds() {
  try {
    return JSON.parse(fs.readFileSync(SOUNDS_JSON, 'utf8'));
  } catch {
    return {};
  }
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICON_SOUND =
  '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h3l4-3.5v11l-4-3.5h-3z" fill="currentColor"/></svg>';
const ICON_IMAGE =
  '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="5.5" cy="6.5" r="1.4" fill="currentColor"/><path d="M2.5 12.5l4-4 3 3 2-2 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ICON_FILE =
  '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h7l3 3v10H3z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SPEAKER_OFF =
  '<svg class="i-off" width="34" height="34" viewBox="0 0 36 36" aria-hidden="true"><path d="M4 13h7l8-7v24l-8-7H4z" fill="currentColor"/><path d="M24 13l9 10M33 13l-9 10" stroke="currentColor" stroke-width="2.8" stroke-linecap="square"/></svg>';
const SPEAKER_ON =
  '<svg class="i-on" width="34" height="34" viewBox="0 0 36 36" aria-hidden="true"><path d="M4 13h7l8-7v24l-8-7H4z" fill="currentColor"/><path d="M24 12c2.6 3.2 2.6 8.8 0 12M28.5 8c4.6 5.6 4.6 14.4 0 20" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';

function cwBar(icon, name, right) {
  return `<div class="cw-bar"><span class="cw-name">${icon}${esc(name)}</span><span>${esc(right)}</span></div>`;
}
const cap = (alias) => (alias ? `<p class="cw-cap jp">${esc(alias)}</p>` : '');

function renderSound(name, alias, base) {
  const s = loadSounds()[name];
  const title = s?.title || soundTitle(name);
  if (!s) {
    return `<div class="cw" role="group" aria-label="${esc(name)}">${cwBar(ICON_SOUND, name, '--:--')}<p class="cw-missing">未処理の音源です（npm run sounds）。</p>${cap(alias)}</div>`;
  }
  const url = /^https?:\/\//.test(s.url) ? s.url : base + s.url.replace(/^\//, '');
  const dur = fmtTime(s.duration);
  const bars = (s.peaks || []).map((p) => `<i style="height:${Math.max(6, Math.round(p * 100))}%"></i>`).join('');
  return `<div class="cw cw--sound" role="group" aria-label="${esc(name)}" data-src="${esc(url)}" data-title="${esc(title)}">${cwBar(ICON_SOUND, name, dur)}<div class="cw-player"><button type="button" class="pbtn" aria-label="Play: ${esc(title)}">${SPEAKER_OFF}${SPEAKER_ON}</button><div class="cw-main"><div class="cw-meta"><span class="cw-title">${esc(title)}</span><span><span class="cw-t">0:00</span> / ${dur}</span></div><div class="wave" aria-hidden="true">${bars}</div></div></div>${cap(alias)}</div>`;
}

function renderImage(name, alias, base) {
  let size = '';
  let w = '';
  let h = '';
  try {
    const d = imageSize(fs.readFileSync(path.join(ATTACH_DIR, name)));
    w = d.width;
    h = d.height;
    size = `${w}×${h}`;
  } catch {
    return `<div class="cw" role="group" aria-label="${esc(name)}">${cwBar(ICON_IMAGE, name, '')}<p class="cw-missing">site/attachments/ に見つかりません。</p>${cap(alias)}</div>`;
  }
  const src = base + 'attachments/' + encodeURIComponent(name);
  return `<div class="cw" role="group" aria-label="${esc(name)}">${cwBar(ICON_IMAGE, name, size)}<div class="cw-img"><img src="${esc(src)}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${esc(alias || name)}"></div>${cap(alias)}</div>`;
}

export function renderEmbed(inner, base = '/') {
  const { target, alias } = parseTarget(inner);
  if (SOUND_EXT.test(target)) return renderSound(target, alias, base);
  if (IMAGE_EXT.test(target)) return renderImage(target, alias, base);
  return `<div class="cw" role="group" aria-label="${esc(target)}">${cwBar(ICON_FILE, target, '')}${cap(alias)}</div>`;
}

export function renderKeyword(inner) {
  const { target, alias } = parseTarget(inner);
  return `<a class="kw" href="#graph" data-kw="${esc(target)}">${esc(alias || target)}</a>`;
}

/** text ノードを text / html ノードに分ける */
function splitText(value) {
  const nodes = [];
  let last = 0;
  for (const m of value.matchAll(WIKI)) {
    if (m[1]) continue; // 文中の ![[...]] はそのまま
    if (m.index > last) nodes.push({ type: 'text', value: value.slice(last, m.index) });
    nodes.push({ type: 'html', value: renderKeyword(m[2]) });
    last = m.index + m[0].length;
  }
  if (last === 0) return [{ type: 'text', value }];
  if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
  return nodes;
}

/** 段落が埋め込みだけでできていれば、その中身の一覧を返す */
function embedsOf(paragraph) {
  if (!paragraph.children.every((c) => c.type === 'text' || c.type === 'break')) return null;
  const text = paragraph.children.map((c) => (c.type === 'text' ? c.value : '\n')).join('');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    const m = /^!\[\[([^\]\n]+)\]\]$/.exec(l);
    if (!m) return null;
    out.push(m[1]);
  }
  return out.length ? out : null;
}

export function remarkObsidian({ base = '/' } = {}) {
  const b = base.endsWith('/') ? base : base + '/';
  const walk = (node) => {
    if (!node.children) return;
    const out = [];
    for (const c of node.children) {
      if (c.type === 'paragraph') {
        const embeds = embedsOf(c);
        if (embeds) {
          for (const e of embeds) out.push({ type: 'html', value: renderEmbed(e, b) });
          continue;
        }
      }
      if (c.type === 'text') {
        out.push(...splitText(c.value));
        continue;
      }
      if (c.type === 'code' || c.type === 'inlineCode' || c.type === 'html') {
        out.push(c);
        continue;
      }
      walk(c);
      out.push(c);
    }
    node.children = out;
  };
  return () => (tree) => walk(tree);
}
