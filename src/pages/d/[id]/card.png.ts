// 記事ごとのリンクカード画像（その日の最初の音源の波形）
import type { APIRoute } from 'astro';
import { loadSite } from '../../../lib/site';
import { cardPng } from '../../../lib/card';

export async function getStaticPaths() {
  const { articles } = await loadSite();
  return articles.map((a) => ({ params: { id: a.id }, props: { peaks: a.peaks } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(await cardPng(props.peaks), { headers: { 'Content-Type': 'image/png' } });
