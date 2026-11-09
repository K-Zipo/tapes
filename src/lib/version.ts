// サイトの「ガワ」（記事以外）のバージョン。git の注釈付きタグ v1, v2, … を数える。
// 大きく変えたときだけ `npm run release -- "見出し" "説明"` でタグを打つ（scripts/release.mjs）。
// タグのメッセージが履歴に出る（1行目 = 見出し、残り = 説明）。コミットの細かい履歴は出さない。
// git が使えないとき・タグがまだないときは v0。
import { execFileSync } from 'node:child_process';

export type Release = { n: number; tag: string; date: string; title: string; body: string; url: string | null };
export type Version = { releases: Release[]; current: Release | null; hash: string | null; dirty: boolean };

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (...args: string[]) => { try { return git(...args); } catch { return null; } };

function repoUrl() {
  const u = tryGit('remote', 'get-url', 'origin');
  const m = u?.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

let cached: Version | null = null;
export function loadVersion(): Version {
  if (cached) return cached;
  const repo = repoUrl();
  const out = tryGit('for-each-ref', 'refs/tags/v*', '--format=%(refname:short)%1f%(creatordate:short)%1f%(contents:subject)%1f%(contents:body)%1e') ?? '';
  const releases = out
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [tag, date, title, body = ''] = r.split('\x1f');
      return { n: Number(tag.slice(1)), tag, date: date.replaceAll('-', '.'), title, body: body.trim(), url: repo ? `${repo}/tree/${tag}` : null };
    })
    .filter((r) => Number.isInteger(r.n) && r.n > 0)
    .sort((a, b) => b.n - a.n);
  // 記事以外のファイルに、まだコミットしていない変更があるか
  const dirty = (tryGit('status', '--porcelain', '--', '.', ':(exclude)site', ':(exclude)src/data/sounds.json') ?? '') !== '';
  cached = { releases, current: releases[0] ?? null, hash: tryGit('rev-parse', '--short', 'HEAD'), dirty };
  return cached;
}
