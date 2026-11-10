/* Qalam — animated GIF encoder (GIF89a + median-cut palette + LZW).
 * Written from scratch so animations can be exported without any library.
 */
(function () {
  'use strict';
  const Q = window.Q;

  /* ── median cut quantiser ───────────────────────────────── */

  function quantize(data, maxColors) {
    const BINS = 32768;                       // 5 bits per channel
    const count = new Int32Array(BINS);
    const sr = new Float64Array(BINS);
    const sg = new Float64Array(BINS);
    const sb = new Float64Array(BINS);

    const n = data.length / 4;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (data[o + 3] < 128) continue;        // treat transparency as background
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      count[key]++;
      sr[key] += r; sg[key] += g; sb[key] += b;
    }

    const entries = [];
    for (let k = 0; k < BINS; k++) {
      if (!count[k]) continue;
      entries.push({
        k: k,
        n: count[k],
        r: sr[k] / count[k],
        g: sg[k] / count[k],
        b: sb[k] / count[k]
      });
    }
    if (!entries.length) {
      entries.push({ k: 0, n: 1, r: 0, g: 0, b: 0 });
    }

    let boxes = [entries];
    while (boxes.length < maxColors) {
      let best = -1, bestScore = 0;
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (box.length < 2) continue;
        let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0, total = 0;
        for (const e of box) {
          if (e.r < rMin) rMin = e.r;
          if (e.r > rMax) rMax = e.r;
          if (e.g < gMin) gMin = e.g;
          if (e.g > gMax) gMax = e.g;
          if (e.b < bMin) bMin = e.b;
          if (e.b > bMax) bMax = e.b;
          total += e.n;
        }
        const range = Math.max(rMax - rMin, gMax - gMin, bMax - bMin);
        const score = range * Math.log(1 + total);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) break;

      const box = boxes[best];
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const e of box) {
        if (e.r < rMin) rMin = e.r;
        if (e.r > rMax) rMax = e.r;
        if (e.g < gMin) gMin = e.g;
        if (e.g > gMax) gMax = e.g;
        if (e.b < bMin) bMin = e.b;
        if (e.b > bMax) bMax = e.b;
      }
      const rr = rMax - rMin, gr = gMax - gMin, br = bMax - bMin;
      const chan = rr >= gr && rr >= br ? 'r' : (gr >= br ? 'g' : 'b');
      box.sort(function (a, b) { return a[chan] - b[chan]; });
      let half = 0;
      for (const e of box) half += e.n;
      half /= 2;
      let acc = 0, cut = 1;
      for (let i = 0; i < box.length - 1; i++) {
        acc += box[i].n;
        if (acc >= half) { cut = i + 1; break; }
        cut = i + 2;
      }
      cut = Q.clamp(cut, 1, box.length - 1);
      boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
    }

    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < boxes.length && i < 256; i++) {
      let r = 0, g = 0, b = 0, total = 0;
      for (const e of boxes[i]) { r += e.r * e.n; g += e.g * e.n; b += e.b * e.n; total += e.n; }
      total = total || 1;
      palette[i * 3] = Math.round(r / total);
      palette[i * 3 + 1] = Math.round(g / total);
      palette[i * 3 + 2] = Math.round(b / total);
    }

    // map every pixel to its nearest palette entry (cached per 5-bit colour)
    const cache = new Int16Array(BINS).fill(-1);
    const indices = new Uint8Array(n);
    let bgIndex = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let idx = cache[key];
      if (idx < 0) {
        let bestD = Infinity;
        for (let p = 0; p < 256; p++) {
          const dr = r - palette[p * 3];
          const dg = g - palette[p * 3 + 1];
          const db = b - palette[p * 3 + 2];
          const dd = dr * dr + dg * dg + db * db;
          if (dd < bestD) { bestD = dd; idx = p; }
        }
        cache[key] = idx;
      }
      indices[i] = idx;
      if (i === 0) bgIndex = idx;
    }

    return { palette: palette, indices: indices, size: 256, background: bgIndex };
  }

  /* ── LZW (GIF flavour) ──────────────────────────────────── */

  function lzwEncode(pixels, minCodeSize) {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    let dict = new Map();

    const out = [];
    let cur = 0, bits = 0;

    function emit(code) {
      cur |= code << bits;
      bits += codeSize;
      while (bits >= 8) {
        out.push(cur & 0xff);
        cur >>= 8;
        bits -= 8;
      }
    }

    emit(clearCode);

    let prefix = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const k = pixels[i];
      const key = (prefix << 8) | k;
      const found = dict.get(key);
      if (found !== undefined) { prefix = found; continue; }

      emit(prefix);

      if (nextCode === 4096) {
        emit(clearCode);
        dict = new Map();
        codeSize = minCodeSize + 1;
        nextCode = eoiCode + 1;
      } else {
        dict.set(key, nextCode);
        nextCode++;
        if (nextCode === (1 << codeSize) + 1 && codeSize < 12) codeSize++;
      }
      prefix = k;
    }

    emit(prefix);
    emit(eoiCode);
    if (bits > 0) out.push(cur & 0xff);
    return Uint8Array.from(out);
  }

  /* ── file assembly ──────────────────────────────────────── */

  function GifWriter(width, height, loop) {
    this.w = width;
    this.h = height;
    this.bytes = [];
    this.loop = loop == null ? 0 : loop;
    this.started = false;
  }

  GifWriter.prototype._byte = function (v) { this.bytes.push(v & 0xff); };
  GifWriter.prototype._short = function (v) { this.bytes.push(v & 0xff, (v >> 8) & 0xff); };
  GifWriter.prototype._str = function (s) {
    for (let i = 0; i < s.length; i++) this.bytes.push(s.charCodeAt(i) & 0xff);
  };

  GifWriter.prototype.start = function () {
    if (this.started) return;
    this.started = true;
    this._str('GIF89a');
    this._short(this.w);
    this._short(this.h);
    this._byte(0x70);          // no global colour table, 8 bit colour resolution
    this._byte(0);             // background index
    this._byte(0);             // pixel aspect ratio
    // A missing loop extension means play exactly once; zero means forever.
    if (this.loop >= 0) {
      this._byte(0x21); this._byte(0xff); this._byte(0x0b);
      this._str('NETSCAPE2.0');
      this._byte(0x03); this._byte(0x01);
      this._short(this.loop);
      this._byte(0x00);
    }
  };

  GifWriter.prototype.frame = function (frame, delayCs) {
    this.start();
    const pal = frame.palette;
    const idx = frame.indices;

    // graphic control extension
    this._byte(0x21); this._byte(0xf9); this._byte(0x04);
    this._byte(0x08);                    // disposal = 2 (restore to background)
    this._short(Math.max(2, Math.round(delayCs)));
    this._byte(frame.background || 0);
    this._byte(0x00);

    // image descriptor with a local colour table (256 entries)
    this._byte(0x2c);
    this._short(0); this._short(0);
    this._short(this.w); this._short(this.h);
    this._byte(0x87);                    // local table, 256 colours (2^(7+1))
    for (let i = 0; i < 256 * 3; i++) this.bytes.push(pal[i] || 0);

    const minCodeSize = 8;
    this._byte(minCodeSize);
    const lzw = lzwEncode(idx, minCodeSize);
    for (let i = 0; i < lzw.length; i += 255) {
      const chunk = lzw.subarray(i, Math.min(i + 255, lzw.length));
      this._byte(chunk.length);
      for (let j = 0; j < chunk.length; j++) this.bytes.push(chunk[j]);
    }
    this._byte(0x00);
  };

  GifWriter.prototype.finish = function () {
    this.start();
    this._byte(0x3b);
    return Uint8Array.from(this.bytes);
  };

  function toBase64(bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(s);
  }
  Q.toBase64 = toBase64;

  /* ── public API ─────────────────────────────────────────── */

  Q.encodeGif = function (canvases, opts) {
    opts = opts || {};
    const delayCs = opts.delayCs || 8;
    const outW = opts.width || canvases[0].width;
    const outH = opts.height || canvases[0].height;

    const writer = new GifWriter(outW, outH, opts.loop == null ? 0 : opts.loop);
    let i = 0;

    return new Promise(function (resolve) {
      function step() {
        const t0 = Q.now();
        while (i < canvases.length && Q.now() - t0 < 90) {
          const src = canvases[i];
          const tmp = Q.canvas(outW, outH);
          const c = tmp.getContext('2d');
          c.fillStyle = opts.background || '#ffffff';
          c.fillRect(0, 0, outW, outH);
          c.drawImage(src, 0, 0, outW, outH);
          const data = c.getImageData(0, 0, outW, outH).data;
          writer.frame(quantize(data, 256), opts.delaysCs ? opts.delaysCs[i] : delayCs);
          i++;
          if (opts.onProgress) opts.onProgress(i / canvases.length);
        }
        if (i < canvases.length) setTimeout(step, 0);
        else {
          const bytes = writer.finish();
          resolve({ bytes: bytes, base64: toBase64(bytes), dataUrl: 'data:image/gif;base64,' + toBase64(bytes) });
        }
      }
      step();
    });
  };

  Q.gifInternals = { quantize: quantize, lzwEncode: lzwEncode, GifWriter: GifWriter };
})();
