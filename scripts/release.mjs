// npm run release -- "見出し" ["説明"]
// サイトのガワを大きく変えたときに、次のバージョン（v1, v2, …）の注釈付きタグを今のコミットに打つ。
// 見出しと説明は、サイトのバージョン履歴にそのまま出る。
// 公開するには git push --follow-tags（コミットと一緒にタグも送られる）。
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const [title, body] = process.argv.slice(2);
if (!title) {
  console.error('使い方: npm run release -- "見出し" ["説明"]');
  process.exit(1);
}
if (git('status', '--porcelain', '--', '.', ':(exclude)site', ':(exclude)src/data/sounds.json')) {
  console.error('記事以外にコミットしていない変更があります。先にコミットしてください。');
  process.exit(1);
}
const nums = git('tag', '--list', 'v*').split('\n').map((t) => Number(t.slice(1))).filter((n) => Number.isInteger(n) && n > 0);
const next = `v${Math.max(0, ...nums) + 1}`;
git('tag', '-a', next, '-m', body ? `${title}\n\n${body}` : title);
console.log(`${next} を ${git('rev-parse', '--short', 'HEAD')} に付けました。公開: git push --follow-tags`);
