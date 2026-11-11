// リンクカード（og:image）の画像。サイトのウィンドウと同じ白黒・太い罫線・ずらした影で描く
// 文字は入れない（CI と手元でフォントが違うので）。日付と本文はカードの文字のほうに出る
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const W = 1200;
const H = 630;

// public/mark.svg の中身（viewBox 0 0 120 120）
function markInner() {
  const svg = fs.readFileSync(path.resolve('public/mark.svg'), 'utf8');
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

// 波形を n 本に間引く（各区間の最大値）
function resample(peaks: number[], n: number) {
  if (peaks.length <= n) return peaks;
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * peaks.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / n));
    return Math.max(...peaks.slice(a, b));
  });
}

export function cardSvg(peaks: number[] = []) {
  const sh = 14; // 影のずれ
  const bw = 6; // 罫線
  const x = 56, y = 56, w = W - x * 2 - sh, h = H - y * 2 - sh;
  const barH = 56; // タイトルバー
  const body = { x: x, y: y + barH, w, h: h - barH };

  let content: string;
  if (peaks.length) {
    const m = 300;
    const mx = body.x + 64, my = body.y + (body.h - m) / 2;
    const wx0 = mx + m + 56, wx1 = body.x + body.w - 72;
    const bars = resample(peaks, 36);
    const gap = 6;
    const bwid = (wx1 - wx0 - gap * (bars.length - 1)) / bars.length;
    const wh = 250, base = body.y + (body.h + wh) / 2;
    const rects = bars
      .map((p, i) => {
        const bh = Math.max(10, Math.round(p * wh));
        // サイトのプレイヤーと同じく、再生済みは黒、残りは灰色
        const fill = i < bars.length * 0.4 ? '#000' : '#a3a3a3';
        return `<rect x="${(wx0 + i * (bwid + gap)).toFixed(1)}" y="${base - bh}" width="${bwid.toFixed(1)}" height="${bh}" fill="${fill}"/>`;
      })
      .join('');
    content = `<g transform="translate(${mx} ${my}) scale(${m / 120})" color="#000">${markInner()}</g>${rects}`;
  } else {
    const m = 380;
    content = `<g transform="translate(${body.x + (body.w - m) / 2} ${body.y + (body.h - m) / 2}) scale(${m / 120})" color="#000">${markInner()}</g>`;
  }

  // タイトルバー右端の「−」ボタン（サイトと同じく、白い仕切り線と白い −）
  const tg = 76;
  const tgx = x + w - tg;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fff"/>
<rect x="${x + sh}" y="${y + sh}" width="${w}" height="${h}" fill="#000"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>
<rect x="${x}" y="${y}" width="${w}" height="${barH}" fill="#000"/>
<path d="M${tgx} ${y}v${barH}" stroke="#fff" stroke-width="${bw}"/>
<path d="M${tgx + 27} ${y + barH / 2}h${tg - 54}" stroke="#fff" stroke-width="5"/>
${content}
<rect x="${x + bw / 2}" y="${y + bw / 2}" width="${w - bw}" height="${h - bw}" fill="none" stroke="#000" stroke-width="${bw}"/>
</svg>`;
}

export async function cardPng(peaks?: number[]) {
  return sharp(Buffer.from(cardSvg(peaks))).png({ compressionLevel: 9, palette: true }).toBuffer();
}
