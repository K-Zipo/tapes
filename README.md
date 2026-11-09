# 貝

日記と自作の音源を載せる個人サイト。Obsidian で書いたノートを Astro でビルドして GitHub Pages に公開する。

## 書く

ノートの正本は iCloud の Obsidian vault「貝」
（`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/貝`）。Mac・iPhone・iPad で同じものを編集できる。
`npm run notes` で vault から `site/` に取り込む（`npm run dev` / `build` / `sounds` の前にも自動で走る）。
`site/` は取り込むたびに上書きされるので、直接編集しない。取り込んだ後に commit & push すると公開される。
vault の日記は Obsidian の「デイリーノート」で `diary/YYYY-MM-DD.md` として作られる。

vault の中の置き方:

- `diary/YYYY-MM-DD.md` … 1日1ファイル。タイトルなし。下書きは frontmatter に `draft: true`。
  ファイル名が日付になっていないノート（`diary 1.md` など）はサイトに出ない。
- `attachments/` … 画像（貼り付け・ドラッグで自動的にここに入る）。`site/attachments/` に取り込まれ、git に入って Pages から配信される。
- `profile.md` … PROFILE と フッターのリンク。

音源は大きくて iCloud の容量を食うので、vault には入れず Mac の `~/Music/貝`（`.env` の `SOUNDS_DIR` で変更可）に置く。
`site/sounds/` に取り込まれ（git に入れない）、`npm run sounds` で R2 へ上がる。
日記には `![[x.wav|説明文]]` と名前で書くだけでよい（Obsidian の中では「見つからないファイル」になり、再生はできない）。
画像と音源のファイル名は重ならないようにする。

ノートの書き方:

- `[[単語]]` … キーワード。集計して GRAPH と Linked pages に出る。`[[単語|表示]]` も可。
- `![[x.wav|説明文]]` … 音源の子ウィンドウ。`|` の後ろが下の説明文。
- `![[x.png|説明文]]` … 画像の子ウィンドウ。

## 手元で見る

```bash
npm install
npm run sounds:local   # 音源を MP3 にして public/sounds-local/ に置き、波形を計算（アップロードしない）
npm run dev            # http://localhost:4321
```

## 音源を公開する

音源は Cloudflare R2 から配信する（無料枠 10GB・転送量無料）。最初に一度だけ:

1. Cloudflare で R2 を有効にし、バケット（例: `kai-sounds`）を作る。
2. バケットの Settings → Public access で r2.dev の公開URLを有効にする（独自ドメインでもよい）。
3. R2 → Manage R2 API Tokens で「Object Read & Write」のトークンを作る。
4. `.env.example` を `.env` にコピーし、公開URL・アカウントID・キーを書く。
5. バケットの Settings → CORS Policy に、サイトから音を読む許可を入れる（FX のディレイを音源にかけるのに必要。これがないと音が鳴らない）:

   ```json
   [{ "AllowedOrigins": ["https://<ユーザー名>.github.io", "http://localhost:4321"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
   ```

そのあとは、音源を足したら

```bash
npm run sounds
```

で `~/Music/貝` から取り込み → MP3 に変換 → R2 にアップロード → `src/data/sounds.json`（git に入れる）を更新する。
変わったファイルだけ処理する（`--force` で全部）。ffmpeg と rclone が必要（`brew install ffmpeg rclone`）。

## 公開

`main` に push すると GitHub Actions がビルドして Pages にデプロイする（`.github/workflows/deploy.yml`）。
リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく。

## Obsidian の見た目

`obsidian/snippets/kai-site.css` をサイトと同じ見え方にするスニペットとして用意してある。
vault の `.obsidian/snippets/` にコピーし、設定 → 外観 → CSSスニペットで `kai-site` をオンにする。
