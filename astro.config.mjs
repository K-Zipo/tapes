import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import { unified } from '@astrojs/markdown-remark';
import { remarkObsidian } from './src/lib/obsidian.mjs';

// GitHub Actions では configure-pages の出力から渡す（.github/workflows/deploy.yml）
const site = process.env.SITE_URL || undefined;
const base = process.env.SITE_BASE || '/';

// site/attachments/ を public/attachments/ にコピーする（画像は git に入れて Pages から配信）
function attachments() {
  const copy = () => {
    const src = path.resolve('site/attachments');
    const dst = path.resolve('public/attachments');
    fs.rmSync(dst, { recursive: true, force: true });
    if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true });
  };
  return {
    name: 'site-attachments',
    hooks: {
      'astro:config:setup': ({ addWatchFile }) => {
        copy();
        addWatchFile(path.resolve('site/attachments'));
      },
    },
  };
}

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [attachments()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkObsidian({ base })] }),
  },
});
