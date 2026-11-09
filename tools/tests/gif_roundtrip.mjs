/* Builds a GIF with the in-app encoder, decodes it with an independent pure
 * Python decoder (tools/tests/gif_decode.py) and compares the pixels.
 * Run:  node tools/tests/gif_roundtrip.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

globalThis.window = {
  Q: {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    now: () => Date.now()
  }
};
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.document = { createElement: () => { throw new Error('canvas not available'); } };

const code = readFileSync(path.join(root, 'android/assets/app/js/gif.js'), 'utf8');
new Function('window', 'btoa', 'document', code)(globalThis.window, globalThis.btoa, globalThis.document);

const Q = globalThis.window.Q;
const { quantize, GifWriter } = Q.gifInternals;

const W = 40, H = 30;
const frames = [];
const images = [];
for (let f = 0; f < 3; f++) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = (x * 6 + f * 40) & 255;
      data[i + 1] = (y * 8) & 255;
      data[i + 2] = ((x + y) * 3 + f * 20) & 255;
      data[i + 3] = 255;
    }
  }
  images.push(data);
  frames.push(quantize(data, 256));
}

const writer = new GifWriter(W, H, 0);
frames.forEach((fr) => writer.frame(fr, 8));
const bytes = writer.finish();
const outPath = path.join(root, 'build', 'gif-test.gif');
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
console.log(`wrote ${outPath} (${bytes.length} bytes, ${frames.length} frames)`);

const jsFrames = (() => {
  const out = [];
  frames.forEach((fr) => {
    out.push(Array.from(fr.indices));
    }
  );
  return out;
})();

const decodedJson = execFileSync('python3', [path.join(here, 'gif_decode.py'), outPath, '--json'], {
  encoding: 'utf8'
});
const decoded = JSON.parse(decodedJson);
console.log(`decoder reports ${decoded.frames.length} frames of ${decoded.width}x${decoded.height}`);

let mismatches = 0;
decoded.frames.forEach((fr, fi) => {
  if (fr.length !== W * H) throw new Error(`frame ${fi} has ${fr.length} pixels`);
  const expected = jsFrames[fi];
  for (let i = 0; i < fr.length; i++) {
    if (fr[i] !== expected[i]) mismatches++;
  }
});
if (decoded.frames.length !== frames.length) throw new Error('frame count mismatch');
if (mismatches) throw new Error(`${mismatches} pixel indices differ after decode`);
console.log('index round trip OK (pure-Python decoder)');

// second opinion: ImageMagick's GIF reader must see the same colours
try {
  execFileSync('convert', [outPath + '[0]', '-depth', '8', path.join(root, 'build', 'gif-im.rgb')],
    { stdio: 'pipe' });
  const raw = readFileSync(path.join(root, 'build', 'gif-im.rgb'));
  const pal = frames[0].palette, idx = frames[0].indices;
  let bad = 0;
  for (let i = 0; i < idx.length; i++) {
    const p = idx[i];
    if (raw[i * 3] !== pal[p * 3] || raw[i * 3 + 1] !== pal[p * 3 + 1] || raw[i * 3 + 2] !== pal[p * 3 + 2]) bad++;
  }
  if (bad) throw new Error(`ImageMagick decoded ${bad} wrong pixels`);
  console.log('colour round trip OK (ImageMagick)');
} catch (e) {
  if (String(e).includes('ENOENT')) console.log('ImageMagick not installed, skipped second opinion');
  else throw e;
}

console.log('GIF encoder verified');
