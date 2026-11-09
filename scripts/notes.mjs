// npm run notes … iCloud の Obsidian vault から site/ にノートを取り込む
//
// 正本は vault 側。site/diary, site/attachments, site/sounds は毎回置き換わる
// （vault で消したノートは site/ からも消える）。site/ を直接編集しないこと。
//   vault の attachments/ → site/attachments/（画像。git に入れて Pages から配信）
//   SOUNDS_DIR（vault の外。既定 ~/Music/貝）→ site/sounds/（音源。git に入れない。npm run sounds で R2 へ）
// 音源は大きくて iCloud の容量を食うので vault には入れない。
// もし vault の attachments/ に音源が紛れていても取り込むが、警告を出す。
// vault の場所は NOTES_DIR、音源の場所は SOUNDS_DIR（.env）で変えられる。
//   --if-exists  vault が見つからなければ何もしない（npm run dev / build の前に自動で使う。
//                GitHub Actions には vault がないので、そこではコミット済みの site/ でビルドする）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SOUND_EXT } from '../src/lib/obsidian.mjs';

const VAULT =
  process.env.NOTES_DIR ||
  path.join(os.homedir(), 'Library/Mobile Documents/iCloud~md~obsidian/Documents/貝');
const SOUNDS_DIR = process.env.SOUNDS_DIR || path.join(os.homedir(), 'Music/貝');
const DEST = 'site';
const FILES = ['profile.md'];

if (!fs.existsSync(VAULT)) {
  if (process.argv.includes('--if-exists')) process.exit(0);
  console.error(`vault が見つかりません: ${VAULT}\nNOTES_DIR で場所を指定してください。`);
  process.exit(1);
}

// iCloud の「ストレージを最適化」で中身がまだ Mac に来ていないファイルは .名前.icloud になっている
const pending = [];
const filter = (src) => {
  const base = path.basename(src);
  if (base.endsWith('.icloud')) {
    pending.push(path.relative(VAULT, src));
    return false;
  }
  return base !== '.DS_Store';
};

const reset = (d) => {
  fs.rmSync(path.join(DEST, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(DEST, d), { recursive: true });
};
let n = 0;

// 日記
reset('diary');
if (fs.existsSync(path.join(VAULT, 'diary'))) {
  fs.cpSync(path.join(VAULT, 'diary'), path.join(DEST, 'diary'), { recursive: true, filter });
  n += fs.readdirSync(path.join(DEST, 'diary')).length;
}

// 添付と音源（サブフォルダの中も見る。置き先はフラット。音源かどうかは拡張子で決める）
reset('attachments');
reset('sounds');
const seen = new Map();
const inVault = [];
const walk = (dir, root) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const src = path.join(dir, e.name);
    if (!filter(src)) continue;
    if (e.isDirectory()) { walk(src, root); continue; }
    const isSound = SOUND_EXT.test(e.name);
    if (root === SOUNDS_DIR && !isSound) continue;
    if (root === VAULT && isSound) inVault.push(path.relative(VAULT, src));
    if (seen.has(e.name)) {
      console.warn(`同じ名前のファイルが2つあります（後の方を使います）: ${seen.get(e.name)} / ${src}`);
    }
    seen.set(e.name, src);
    fs.copyFileSync(src, path.join(DEST, isSound ? 'sounds' : 'attachments', e.name));
    n++;
  }
};
walk(path.join(VAULT, 'attachments'), VAULT);
if (fs.existsSync(SOUNDS_DIR)) walk(SOUNDS_DIR, SOUNDS_DIR);
else console.warn(`音源フォルダがありません: ${SOUNDS_DIR}（SOUNDS_DIR で場所を指定できます）`);
if (inVault.length) {
  console.warn(
    `vault の中に音源があります。iCloud の容量を食うので ${SOUNDS_DIR} に移してください:\n  ` +
      inVault.join('\n  '),
  );
}
for (const f of FILES) {
  const src = path.join(VAULT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DEST, f));
    n++;
  }
}

console.log(`notes: ${n} 件を ${VAULT} から取り込みました`);
if (pending.length) {
  console.warn(
    `まだ iCloud からダウンロードされていないファイルがあります（Finder で「今すぐダウンロード」）:\n  ` +
      pending.join('\n  '),
  );
  process.exitCode = 1;
}
