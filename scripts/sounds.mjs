// npm run sounds          … site/sounds/ の音源を MP3 に変換 → 外部ストレージへアップロード → src/data/sounds.json を更新
// npm run sounds:local    … アップロードせず public/sounds-local/ に置く（手元の確認用。git には入らない）
//
// 新しい / 変わったファイルだけ処理する（中身のハッシュで判定）。--force で全部やり直す。
// 変換には ffmpeg が必要。--local のときに限り、WAV は ffmpeg なしでも扱える（そのまま置く）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execSync } from 'node:child_process';
import { SOUND_EXT, soundTitle } from '../src/lib/obsidian.mjs';

const args = new Set(process.argv.slice(2));
const LOCAL = args.has('--local');
const FORCE = args.has('--force');
const SRC = 'site/sounds';
const OUT = LOCAL ? 'public/sounds-local' : '.cache/sounds';
const DATA = 'src/data/sounds.json';
const PEAKS = 100;
const PEAK_SR = 8000;

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const baseUrl = (process.env.SOUNDS_BASE_URL || '').replace(/\/$/, '');
if (!LOCAL && !hasFfmpeg) fail('ffmpeg が見つかりません（brew install ffmpeg）。');
if (!LOCAL && !baseUrl) fail('SOUNDS_BASE_URL が未設定です（.env.example を参照）。');

const data = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : {};
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => SOUND_EXT.test(f)).sort() : [];
fs.mkdirSync(OUT, { recursive: true });

let changed = 0;
for (const name of files) {
  const file = path.join(SRC, name);
  const buf = fs.readFileSync(file);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  const prev = data[name];
  const sameMode = prev && (LOCAL ? !/^https?:/.test(prev.url) : /^https?:/.test(prev.url));
  if (!FORCE && prev?.hash === hash && sameMode) continue;

  const { samples, sr } = decode(file, buf);
  const duration = samples.length / sr;
  const peaks = peaksOf(samples);

  let outName;
  if (hasFfmpeg) {
    outName = name.replace(SOUND_EXT, '.mp3');
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-codec:a', 'libmp3lame', '-b:a', '192k', path.join(OUT, outName)]);
  } else {
    outName = name; // --local かつ WAV のときだけここに来る
    fs.copyFileSync(file, path.join(OUT, outName));
  }

  data[name] = {
    title: prev?.title || soundTitle(name),
    url: LOCAL ? `sounds-local/${encodeURIComponent(outName)}` : `${baseUrl}/${encodeURIComponent(outName)}`,
    duration: Math.round(duration * 100) / 100,
    peaks,
    hash,
  };
  changed++;
  console.log(`  ${name} → ${outName} (${duration.toFixed(1)}s)`);
}

// 元ファイルが消えた音源は一覧から外す
for (const name of Object.keys(data)) if (!files.includes(name)) delete data[name];

if (!LOCAL && changed) {
  const cmd = process.env.SOUNDS_UPLOAD_CMD;
  if (!cmd) fail('SOUNDS_UPLOAD_CMD が未設定です。変換済みファイルは .cache/sounds/ にあります。');
  console.log(`upload: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

fs.mkdirSync(path.dirname(DATA), { recursive: true });
const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
fs.writeFileSync(DATA, JSON.stringify(sorted, null, 1) + '\n');
console.log(`${changed} 件を処理、${files.length} 件中。→ ${DATA}`);

// ---

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, a) {
  const r = spawnSync(cmd, a, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 30 });
  if (r.status !== 0) fail(`${cmd} が失敗しました: ${a.join(' ')}`);
  return r.stdout;
}

function decode(file, buf) {
  if (hasFfmpeg) {
    const out = run('ffmpeg', ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(PEAK_SR), '-f', 'f32le', '-']);
    return { samples: new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4), sr: PEAK_SR };
  }
  if (!/\.wav$/i.test(file)) fail(`${file}: ffmpeg なしでは WAV しか読めません。`);
  return decodeWav(buf, file);
}

function decodeWav(buf, file) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') fail(`${file}: WAV ではありません。`);
  let p = 12, fmt, data;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(p + 8), ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') data = buf.subarray(p + 8, Math.min(buf.length, p + 8 + size));
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data) fail(`${file}: WAV の形式が読めません。`);
  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytes * fmt.ch));
  const read = (o) => {
    if (fmt.format === 3 && fmt.bits === 32) return data.readFloatLE(o);
    if (fmt.bits === 16) return data.readInt16LE(o) / 32768;
    if (fmt.bits === 24) return data.readIntLE(o, 3) / 8388608;
    if (fmt.bits === 32) return data.readInt32LE(o) / 2147483648;
    if (fmt.bits === 8) return (data[o] - 128) / 128;
    fail(`${file}: ${fmt.bits}bit は未対応です。`);
  };
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += read((i * fmt.ch + c) * bytes);
    samples[i] = s / fmt.ch;
  }
  return { samples, sr: fmt.sr };
}

function peaksOf(samples) {
  const out = [];
  const step = samples.length / PEAKS;
  for (let i = 0; i < PEAKS; i++) {
    let m = 0;
    const end = Math.min(samples.length, Math.floor((i + 1) * step));
    for (let j = Math.floor(i * step); j < end; j++) m = Math.max(m, Math.abs(samples[j]));
    out.push(m);
  }
  const max = Math.max(1e-9, ...out);
  return out.map((v) => Math.round((v / max) * 100) / 100);
}
