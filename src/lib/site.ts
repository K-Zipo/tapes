// ビルド時の集計: キーワード一覧、共起グラフ、Linked pages
import { getCollection, type CollectionEntry } from 'astro:content';
import { keywordsOf, soundsOf, excerptOf, soundTitle, loadSounds } from './obsidian.mjs';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export type Article = {
  entry: CollectionEntry<'diary'>;
  id: string; // 2026-11-08
  anchor: string; // w-2026-11-08
  date: string; // 2026.11.08
  dow: string; // SUN
  keywords: string[];
  sounds: string[]; // 表示用タイトル
  excerpt: string;
  linked: { anchor: string; date: string; hasSound: boolean; shared: string[] }[];
};

export type GraphData = {
  words: { id: string; count: number; x: number; y: number }[];
  edges: [string, string][];
  pages: { anchor: string; date: string; snd: string; ex: string; kws: string[] }[];
};

export async function loadSite() {
  const entries = (await getCollection('diary', (e) => !e.data.draft)).sort((a, b) => b.id.localeCompare(a.id));
  const sounds = loadSounds();

  const articles: Article[] = entries.map((entry) => {
    const id = entry.id;
    const [y, m, d] = id.split('-').map(Number);
    const body = entry.body ?? '';
    return {
      entry,
      id,
      anchor: `w-${id}`,
      date: id.replaceAll('-', '.'),
      dow: DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
      keywords: keywordsOf(body),
      sounds: soundsOf(body).map((n: string) => sounds[n]?.title || soundTitle(n)),
      excerpt: excerptOf(body),
      linked: [],
    };
  });

  // 出てくる記事の数と、同じ記事に一緒に出てくる組
  const count = new Map<string, number>();
  const pair = new Map<string, [string, string]>();
  for (const a of articles) {
    a.keywords.forEach((k, i) => {
      count.set(k, (count.get(k) ?? 0) + 1);
      for (const l of a.keywords.slice(i + 1)) {
        const [p, q] = k < l ? [k, l] : [l, k];
        pair.set(`${p}\u0000${q}`, [p, q]);
      }
    });
  }

  // Linked pages: 同じキーワードを持つ別の日（共通が多い順 → 新しい順）
  for (const a of articles) {
    a.linked = articles
      .filter((b) => b !== a)
      .map((b) => ({ b, shared: a.keywords.filter((k) => b.keywords.includes(k)) }))
      .filter((x) => x.shared.length > 0)
      .sort((x, y) => y.shared.length - x.shared.length || y.b.id.localeCompare(x.b.id))
      .slice(0, 6)
      .map(({ b, shared }) => ({ anchor: b.anchor, date: b.date, hasSound: b.sounds.length > 0, shared }));
  }

  const edges = [...pair.values()];
  const pos = layout([...count.keys()], edges, count);
  const graph: GraphData = {
    words: [...count.entries()].map(([id, c]) => ({ id, count: c, ...pos.get(id)! })),
    edges,
    pages: articles.map((a) => ({
      anchor: a.anchor,
      date: `${a.date} ${a.dow}`,
      snd: a.sounds.length ? `♪ ${a.sounds[0]}` : '',
      ex: a.excerpt,
      kws: a.keywords,
    })),
  };

  const singles = [...count.entries()].filter(([, c]) => c === 1).map(([k]) => k);
  return { articles, graph, singles };
}

/** 決まった結果になる簡単な力学配置。座標は 0〜100（%） */
function layout(ids: string[], edges: [string, string][], count: Map<string, number>) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const sorted = [...ids].sort((a, b) => (count.get(b)! - count.get(a)!) || a.localeCompare(b));
  const P = new Map(sorted.map((id, i) => {
    const t = i * 2.39996; // 黄金角で初期配置
    const r = 0.15 + 0.35 * Math.sqrt((i + 0.5) / Math.max(1, sorted.length));
    return [id, { x: 0.5 + r * Math.cos(t) + (rnd() - 0.5) * 0.02, y: 0.5 + r * Math.sin(t) + (rnd() - 0.5) * 0.02 }];
  }));
  const n = Math.max(1, ids.length);
  const k = 0.9 / Math.sqrt(n);
  for (let it = 0; it < 400; it++) {
    const temp = 0.05 * (1 - it / 400) + 0.002;
    const D = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const a = P.get(sorted[i])!, b = P.get(sorted[j])!;
        // ラベルが横に長いので、横方向の距離を詰めて見積もる
        const dx = (a.x - b.x) * 0.6, dy = a.y - b.y;
        const d = Math.max(0.01, Math.hypot(dx, dy));
        const f = (k * k) / d;
        D.get(sorted[i])!.x += (dx / d) * f; D.get(sorted[i])!.y += (dy / d) * f;
        D.get(sorted[j])!.x -= (dx / d) * f; D.get(sorted[j])!.y -= (dy / d) * f;
      }
    for (const [p, q] of edges) {
      const a = P.get(p)!, b = P.get(q)!;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const f = (d * d) / k;
      D.get(p)!.x -= (dx / d) * f; D.get(p)!.y -= (dy / d) * f;
      D.get(q)!.x += (dx / d) * f; D.get(q)!.y += (dy / d) * f;
    }
    for (const id of ids) {
      const a = P.get(id)!, v = D.get(id)!;
      // 中心へ引く（つながっていない塊どうしが四隅に離れすぎないように）
      v.x += (0.5 - a.x) * 1.2; v.y += (0.5 - a.y) * 1.2;
      const l = Math.max(1e-9, Math.hypot(v.x, v.y));
      a.x += (v.x / l) * Math.min(l, temp);
      a.y += (v.y / l) * Math.min(l, temp);
    }
  }
  // 枠に収める（右側はラベルの分を空ける）
  const xs = ids.map((id) => P.get(id)!.x), ys = ids.map((id) => P.get(id)!.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const out = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const a = P.get(id)!;
    out.set(id, {
      x: Math.round((6 + ((a.x - x0) / Math.max(1e-6, x1 - x0)) * 70) * 10) / 10,
      y: Math.round((10 + ((a.y - y0) / Math.max(1e-6, y1 - y0)) * 80) * 10) / 10,
    });
  }
  return out;
}
