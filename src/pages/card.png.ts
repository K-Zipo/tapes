// サイト全体のリンクカード画像（マークだけ）
import { cardPng } from '../lib/card';

export async function GET() {
  return new Response(await cardPng(), { headers: { 'Content-Type': 'image/png' } });
}
