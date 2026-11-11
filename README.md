# 貝 — tapes

日記と自作の音源を載せる個人サイトです。
Obsidian で書いた Markdown を Astro で静的サイトにして、GitHub Pages で公開しています。

**https://k-zipo.github.io/tapes/**

## 特徴

- **記事はウィンドウ** … 1日1記事。記事ごとに開閉でき、「Close all」でまとめて閉じられる
- **Obsidian の書き方がそのまま使える** … `[[キーワード]]` はリンクに、`![[x.wav|説明]]` と `![[x.png|説明]]` は音源と画像の子ウィンドウになる
- **キーワードのつながり** … 同じキーワードを持つ記事を「Linked pages」に出す。GRAPH では、同じ記事に出てくるキーワード同士を線で結んだ図が見られる
- **プレイヤー** … 同時に鳴るのは1曲だけ。波形を押すとその位置から再生し、NOW PLAYING に今の曲が出る
- **FX** … 再生中の音にディレイをかける、画面を塞がない小さなウィンドウ（Web Audio API）
- **サイトのバージョン** … git のタグから作ったバージョンとその履歴を、サイトのメニューバーに出す
- **記事ごとのリンクカード** … `/d/YYYY-MM-DD/` を SNS に貼ると、日付・書き出し・音源の波形が入ったカードになる。開いた人はトップのその記事に移る
- ライト／ダークの切り替え、時計、640px 以下でのスマホ表示、キーボード操作とスクリーンリーダーへの配慮

デザインは白黒だけ、3px の罫線、6px ずらした影です。フォントは Archivo と Zen Kaku Gothic New を使っています。

## 技術スタック

| | |
| --- | --- |
| サイト | [Astro](https://astro.build) 7（静的出力、Content Collections）、TypeScript |
| Markdown | remark の自作プラグインで Obsidian の書き方を変換（`@astrojs/markdown-remark`） |
| 音源 | ffmpeg で MP3 に変換し、波形も計算する。rclone で Cloudflare R2 に置く |
| 公開 | GitHub Actions → GitHub Pages |

ブラウザ側は素の TypeScript だけで書いていて、UI フレームワークは使っていません。

## しくみ

```
Obsidian vault ──npm run notes──▶ site/diary, site/attachments, site/profile.md ──astro build──▶ dist/ ──Actions──▶ Pages
音源フォルダ ───npm run notes──▶ site/sounds（git 管理外）──npm run sounds──▶ R2 ＋ src/data/sounds.json
```

- 記事の元は **リポジトリの外の Obsidian vault** にあります。`npm run notes` で `site/` に写し、それをコミットします。CI には vault がないので、コミット済みの `site/` を使ってビルドします。
- 音源は大きいので git に入れていません。MP3 にしたものを R2 から配信し、URL・長さ・波形だけを `src/data/sounds.json` に入れてコミットします。
- 画像は `site/attachments/` に入れて git で管理し、ビルドのときに `public/` へコピーして Pages から配信します。

## ディレクトリ

```
site/                 記事の中身（vault から写したもの。直接編集しない）
  diary/YYYY-MM-DD.md   日記
  attachments/          画像
  profile.md            PROFILE とフッターのリンク
  sounds/               音源の元ファイル（git 管理外）
src/
  pages/index.astro     1ページだけのサイト
  content.config.ts     コレクションの定義
  lib/obsidian.mjs      Obsidian の書き方を変換する remark プラグイン、子ウィンドウの HTML
  lib/site.ts           キーワードの集計、Linked pages、GRAPH の配置（決まった結果になる力学モデル）
  lib/version.ts        git のタグからバージョンの履歴を作る
  lib/card.ts           リンクカードの画像（SVG を sharp で PNG にする）
  pages/d/[id]/         記事ごとのリンクカード用ページと画像
  scripts/app.ts        ブラウザ側の動き（開閉、再生、FX、ポップアップ、GRAPH）
  styles/global.css     スタイル
  data/sounds.json      音源の URL・長さ・波形（npm run sounds が書く）
scripts/
  notes.mjs             vault と音源フォルダから site/ に取り込む
  sounds.mjs            音源を MP3 に変換・アップロードし、sounds.json を更新する
  release.mjs           次のバージョンのタグを打つ
obsidian/snippets/      Obsidian をサイトと同じ見た目にする CSS スニペット
```

## はじめる

必要なもの：Node.js 22.9 以上（CI は 24）。音源を扱うときは ffmpeg と rclone も使います。

```bash
npm install
npm run dev        # http://localhost:4321
```

vault が見つからないときは、取り込みを飛ばして、コミット済みの `site/` でそのまま動きます。
記事を試しに足すなら、`site/diary/2026-01-01.md` のように日付の名前で Markdown を置いてください。

音源をアップロードせずに手元で鳴らすには、`site/sounds/` に WAV などを置いて次を実行します。

```bash
npm run sounds:local   # public/sounds-local/ に置いて波形を計算する（ffmpeg がなくても WAV は扱える）
```

`sounds:local` は `src/data/sounds.json` の URL を手元用に書き換えます。この状態ではコミットしないでください（`git checkout src/data/sounds.json` で戻せます）。

## 記事の書き方

`site/diary/YYYY-MM-DD.md` が1日分です。ファイル名が日付で、タイトルは付けません。
日付の名前になっていないファイルは無視されます。

```markdown
---
draft: false   # true にするとサイトに出ない
---

[[BD]] の [[ピッチEG]] を浅くした。

![[bd-study-03.wav|自作BDにディレイを薄く。]]
![[bd-card.png|使ったカード]]
```

- `[[単語]]` / `[[単語|表示]]` … キーワード。押すと、その単語を選んだ状態で GRAPH が開く。1つの記事にしか出てこない単語は、下線が点線になる
- `![[x.wav|説明]]` … 音源の子ウィンドウ。使える拡張子は `src/lib/obsidian.mjs` の `SOUND_EXT` を参照。LOOP ボタンでループ再生を切り替えられる
- `![[x.wav|説明|loop]]` … 最初からループ再生にしておく
- `![[x.png|説明]]` … 画像の子ウィンドウ。縦横の大きさはビルドのときに読み取る。バーを押すと開閉できる
- `![[x.png|説明|closed]]` … 最初は閉じた状態で出す。Obsidian の大きさ指定（`|300` など）はサイトでは無視する
- 子ウィンドウにするには、`![[…]]` だけの段落にする

`site/profile.md` の frontmatter には `based_in`・`makes`・`contact`・`links: [{label, url}]` を書きます。本文は PROFILE に出ます。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（先に `notes --if-exists` が走る） |
| `npm run build` | `dist/` にビルド（先に `notes --if-exists` が走る） |
| `npm run notes` | vault と音源フォルダから `site/` に取り込む |
| `npm run sounds` | 取り込み → MP3 に変換 → アップロード → `sounds.json` 更新。変わったファイルだけ処理する（`-- --force` で全部） |
| `npm run sounds:local` | アップロードせず `public/sounds-local/` に置く |
| `npm run release -- "見出し" "説明"` | 次のバージョンの注釈付きタグを打つ |

## 環境変数

`.env.example` を `.env` にコピーして使います。`.env` は git に入れません。

| 変数 | 内容 |
| --- | --- |
| `NOTES_DIR` | Obsidian vault の場所（省略時は iCloud の vault「貝」） |
| `SOUNDS_DIR` | 音源の元ファイルの場所（省略時は `~/Music/貝`） |
| `SOUNDS_BASE_URL` | 音源の公開 URL（末尾に `/` を付けない） |
| `SOUNDS_UPLOAD_CMD` | `.cache/sounds/` をアップロードするコマンド |
| `RCLONE_CONFIG_R2_*` | rclone の接続先 `r2`。設定ファイルを作らず、環境変数だけで設定する |
| `SITE_URL` / `SITE_BASE` | ビルド時のサイトの URL とベースパス（CI では `configure-pages` が渡す） |

## 音源の配信（Cloudflare R2）

1. R2 にバケットを作り、公開 URL（r2.dev か独自ドメイン）を有効にする
2. 「Object Read & Write」の API トークンを作り、`.env` に書く
3. バケットに CORS を設定する。FX は別ドメインの音を Web Audio に通すので、これがないと音が鳴らない

   ```json
   [{ "AllowedOrigins": ["https://<user>.github.io", "http://localhost:4321"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
   ```

R2 以外のストレージでも、`SOUNDS_BASE_URL` と `SOUNDS_UPLOAD_CMD` を変えれば使えます。

## デプロイ

`main` に push すると `.github/workflows/deploy.yml` がビルドして Pages にデプロイします。
リポジトリの Settings → Pages → Source を「GitHub Actions」にしておいてください。
ベースパス（`/tapes/` など）は自動で決まります。

出力は普通の静的ファイルなので、ほかのホスティングにも置けます（`SITE_URL=… SITE_BASE=/ npm run build`）。

## バージョン

メニューバーのバージョンは、注釈付きタグ `v1, v2, …` の数で決まります。タグのメッセージがそのまま履歴に出ます。
記事の更新では増えません。サイトのガワを大きく変えたときだけタグを打ちます。

```bash
npm run release -- "FX を足した" "ディレイのウィンドウを付けた。"
git push --follow-tags
```

CI はタグを読むために、履歴を全部取ってきます（`fetch-depth: 0`）。

## Obsidian のスニペット

`obsidian/snippets/kai-site.css` を vault の `.obsidian/snippets/` にコピーし、設定 → 外観 → CSS スニペットでオンにします。
Obsidian の編集画面がサイトと同じ見た目になります。
