# 貝

日記と自作の音源を載せる個人サイト。Obsidian で書いたノートを Astro でビルドして GitHub Pages に公開する。

## 書く

- `site/diary/YYYY-MM-DD.md` … 1日1ファイル。タイトルなし。下書きは frontmatter に `draft: true`。
- `[[単語]]` … キーワード。集計して GRAPH と Linked pages に出る。`[[単語|表示]]` も可。
- `![[x.wav|説明文]]` … 音源の子ウィンドウ。`|` の後ろが下の説明文。
- `![[x.png|説明文]]` … 画像の子ウィンドウ。画像は `site/attachments/` に置く（git に入る）。
- `site/profile.md` … PROFILE と フッターのリンク。

## 手元で見る

```bash
npm install
npm run sounds:local   # 音源を public/sounds-local/ に置いて波形を計算（アップロードしない）
npm run dev            # http://localhost:4321
```

## 音源を公開する

`site/sounds/` の元ファイルは git に入れない。`.env.example` を `.env` にコピーして保存先を書き、

```bash
npm run sounds
```

で MP3 に変換 → アップロード → `src/data/sounds.json`（git に入れる）を更新する。変わったファイルだけ処理する（`--force` で全部）。ffmpeg が必要（`brew install ffmpeg`）。

## 公開

`main` に push すると GitHub Actions がビルドして Pages にデプロイする（`.github/workflows/deploy.yml`）。
リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく。
