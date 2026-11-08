import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 日記: site/diary/YYYY-MM-DD.md（ファイル名が日付、タイトルなし）
const diary = defineCollection({
  loader: glob({ pattern: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md', base: './site/diary' }),
  schema: z.object({
    draft: z.boolean().default(false),
  }),
});

// プロフィール: site/profile.md
const profile = defineCollection({
  loader: glob({ pattern: 'profile.md', base: './site' }),
  schema: z.object({
    based_in: z.string().optional(),
    makes: z.string().optional(),
    contact: z.string().optional(),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
});

export const collections = { diary, profile };
