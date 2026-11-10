/* Destructive, undoable pixel effects. All operations preserve the canvas size. */
(function () {
  'use strict';
  const Q = window.Q;

  function boxBlur(data, width, height, radius) {
    // Two sliding-window passes are O(width * height), regardless of radius.
    const temp = new Uint8ClampedArray(data.length);
    // Blur premultiplied channels to avoid dark fringes around transparency.
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      data[i] *= a; data[i + 1] *= a; data[i + 2] *= a;
    }
    for (let y = 0; y < height; y++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let x = 0; x <= Math.min(width - 1, radius); x++) sum += data[(y * width + x) * 4 + ch];
        for (let x = 0; x < width; x++) {
          const left = Math.max(0, x - radius), right = Math.min(width - 1, x + radius);
          temp[(y * width + x) * 4 + ch] = sum / (right - left + 1);
          if (x - radius >= 0) sum -= data[(y * width + x - radius) * 4 + ch];
          if (x + radius + 1 < width) sum += data[(y * width + x + radius + 1) * 4 + ch];
        }
      }
    }
    for (let x = 0; x < width; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let y = 0; y <= Math.min(height - 1, radius); y++) sum += temp[(y * width + x) * 4 + ch];
        for (let y = 0; y < height; y++) {
          const top = Math.max(0, y - radius), bottom = Math.min(height - 1, y + radius);
          data[(y * width + x) * 4 + ch] = sum / (bottom - top + 1);
          if (y - radius >= 0) sum -= temp[((y - radius) * width + x) * 4 + ch];
          if (y + radius + 1 < height) sum += temp[((y + radius + 1) * width + x) * 4 + ch];
        }
      }
    }
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha) { data[i] = data[i] * 255 / alpha; data[i + 1] = data[i + 1] * 255 / alpha; data[i + 2] = data[i + 2] * 255 / alpha; }
    }
  }

  function motionBlur(data, width, height, radius) {
    const src = new Uint8ClampedArray(data);
    // Premultiplied horizontal moving average, O(width * height).
    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3] / 255; src[i] *= a; src[i + 1] *= a; src[i + 2] *= a;
    }
    for (let y = 0; y < height; y++) for (let channel = 0; channel < 4; channel++) {
      let sum = 0;
      for (let x = 0; x <= Math.min(width - 1, radius); x++) sum += src[(y * width + x) * 4 + channel];
      for (let x = 0; x < width; x++) {
        const left = Math.max(0, x - radius), right = Math.min(width - 1, x + radius);
        data[(y * width + x) * 4 + channel] = sum / (right - left + 1);
        if (x - radius >= 0) sum -= src[(y * width + x - radius) * 4 + channel];
        if (x + radius + 1 < width) sum += src[(y * width + x + radius + 1) * 4 + channel];
      }
    }
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha) { data[i] = data[i] * 255 / alpha; data[i + 1] = data[i + 1] * 255 / alpha; data[i + 2] = data[i + 2] * 255 / alpha; }
    }
  }

  function sharpen(data, width, height, strength) {
    const soft = new Uint8ClampedArray(data);
    boxBlur(soft, width, height, 2);
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      for (let c = 0; c < 3; c++) data[i+c] += (data[i+c] - soft[i+c]) * strength * 1.5;
    }
  }

  function bloom(data, width, height, strength) {
    const glow = new Uint8ClampedArray(data);
    for (let i = 0; i < glow.length; i += 4) {
      const highlight = Q.clamp((Math.max(glow[i], glow[i+1], glow[i+2]) - 150) / 105, 0, 1);
      glow[i+3] *= highlight;
    }
    boxBlur(glow, width, height, Math.max(1, Math.round(strength * 12)));
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i+3] / 255, g = glow[i+3] / 255 * strength * 0.65;
      const out = a + g * (1 - a);
      if (!out) continue;
      for (let c = 0; c < 3; c++) {
        data[i+c] = (data[i+c] * a + glow[i+c] * g * (1-a)) / out + glow[i+c] * g * a * 0.35;
      }
      data[i+3] = out * 255;
    }
  }

  function glitch(data, width, height, strength) {
    const src = new Uint8ClampedArray(data), shift = Math.max(1, Math.round(strength * 30));
    const band = Math.max(1, Math.round(height / 24));
    for (let y = 0; y < height; y++) {
      const offset = (Math.floor(y / band) % 3 - 1) * shift;
      for (let x = 0; x < width; x++) {
        const from = (y * width + Q.clamp(x + offset, 0, width - 1)) * 4, to = (y * width + x) * 4;
        data[to] = src[from]; data[to+1] = src[from+1]; data[to+2] = src[from+2]; data[to+3] = src[from+3];
      }
    }
  }

  function pixelate(data,width,height,size) {
    // Each block averages premultiplied colour to avoid dark transparent fringes.
    for (let y=0;y<height;y+=size) for (let x=0;x<width;x+=size) {
      const right=Math.min(width,x+size), bottom=Math.min(height,y+size);
      let alpha=0,r=0,g=0,b=0,count=0;
      for (let yy=y;yy<bottom;yy++) for (let xx=x;xx<right;xx++) {
        const i=(yy*width+xx)*4,a=data[i+3]; alpha+=a; r+=data[i]*a; g+=data[i+1]*a; b+=data[i+2]*a; count++;
      }
      const outA=alpha/count, outR=alpha ? r/alpha : 0, outG=alpha ? g/alpha : 0, outB=alpha ? b/alpha : 0;
      for (let yy=y;yy<bottom;yy++) for (let xx=x;xx<right;xx++) {
        const i=(yy*width+xx)*4; data[i]=outR; data[i+1]=outG; data[i+2]=outB; data[i+3]=outA;
      }
    }
  }

  Q.applyPixelEffect = function (image, type, amount) {
    const data = image.data, w = image.width, h = image.height;
    const strength = Q.clamp(Number(amount) || 0, 0, 1);
    if (!strength) return image;
    if (type === 'blur') {
      // Three box passes provide a bounded, Gaussian-like soft blur. This is
      // an approximation, not an exact Gaussian kernel.
      const radius=Math.max(1,Math.round(strength*9));
      boxBlur(data,w,h,radius); boxBlur(data,w,h,radius); boxBlur(data,w,h,radius);
      return image;
    }
    if (type === 'motion') { motionBlur(data, w, h, Math.max(1, Math.round(strength * 32))); return image; }
    if (type === 'sharpen') { sharpen(data, w, h, strength); return image; }
    if (type === 'bloom') { bloom(data, w, h, strength); return image; }
    if (type === 'glitch') { glitch(data, w, h, strength); return image; }
    if (type === 'pixelate') { pixelate(data,w,h,Math.max(2,Math.round(2+strength*30))); return image; }
    const supported = ['grayscale', 'invert', 'sepia', 'brightness', 'saturation', 'contrast', 'hue', 'noise', 'threshold', 'halftone', 'chromatic', 'posterize', 'solarize'];
    const original = type === 'chromatic' ? new Uint8ClampedArray(data) : null;
    if (supported.indexOf(type) < 0) throw new Error('Unknown effect');
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let nr = r, ng = g, nb = b;
      if (type === 'grayscale') { nr = ng = nb = gray; }
      else if (type === 'invert') { nr = 255-r; ng = 255-g; nb = 255-b; }
      else if (type === 'sepia') { nr = .393*r+.769*g+.189*b; ng = .349*r+.686*g+.168*b; nb = .272*r+.534*g+.131*b; }
      else if (type === 'brightness') { nr = r + 100; ng = g + 100; nb = b + 100; }
      else if (type === 'saturation') { nr = gray + (r-gray)*2; ng = gray + (g-gray)*2; nb = gray + (b-gray)*2; }
      else if (type === 'contrast') { nr=(r-128)*2+128; ng=(g-128)*2+128; nb=(b-128)*2+128; }
      else if (type === 'hue') { const hsv=Q.rgbToHsv(r,g,b); const rgb=Q.hsvToRgb(hsv[0]+180*strength,hsv[1],hsv[2]); data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; continue; }
      else if (type === 'chromatic') {
        const pixel=i/4, x=pixel%w, y=Math.floor(pixel/w), shift=Math.max(1,Math.round(strength*12));
        nr=original[(y*w+Math.max(0,x-shift))*4]; nb=original[(y*w+Math.min(w-1,x+shift))*4+2];
      }
      else if (type === 'halftone') {
        const pixel=i/4, x=pixel%w, y=Math.floor(pixel/w), matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
        nr = ng = nb = gray >= (matrix[(y%4)*4+(x%4)]+0.5)*16 ? 255 : 0;
      }
      else if (type === 'posterize') { nr=Math.round(r/85)*85; ng=Math.round(g/85)*85; nb=Math.round(b/85)*85; }
      else if (type === 'solarize') { nr=r>=128 ? 255-r : r; ng=g>=128 ? 255-g : g; nb=b>=128 ? 255-b : b; }
      else if (type === 'threshold') { nr = ng = nb = gray >= 128 ? 255 : 0; }
      else if (type === 'noise') { const n = (Math.random() - .5) * 160; nr = r+n; ng = g+n; nb = b+n; }
      data[i] = r + (nr-r)*strength;
      data[i+1] = g + (ng-g)*strength;
      data[i+2] = b + (nb-b)*strength;
    }
    return image;
  };
  // Three-stop luminance gradient map; transparent pixels and alpha are untouched.
  Q.gradientMap = function (image,colors,strength,mask) {
    if(!Array.isArray(colors) || colors.length!==3 || colors.some(c=>!Array.isArray(c) || c.length!==3 || c.some(n=>!Number.isInteger(n) || n<0 || n>255)) || !Number.isFinite(strength) || strength<0 || strength>1) throw new Error('Invalid gradient map');
    const lut=new Uint8ClampedArray(256*3);
    for(let n=0;n<256;n++) {const t=n/255*2,i=t<1 ? 0 : 1,f=t-i;for(let c=0;c<3;c++)lut[n*3+c]=colors[i][c]*(1-f)+colors[i+1][c]*f;}
    const d=image.data,w=image.width,h=image.height;let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let n=0;n<w*h;n++) {const i=n*4;if(!d[i+3] || (mask && !mask[n]) || strength===0)continue;const l=Math.round(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])*3;
      const r=Math.round(d[i]+(lut[l]-d[i])*strength),g=Math.round(d[i+1]+(lut[l+1]-d[i+1])*strength),b=Math.round(d[i+2]+(lut[l+2]-d[i+2])*strength);if(r===d[i] && g===d[i+1] && b===d[i+2])continue;
      d[i]=r;d[i+1]=g;d[i+2]=b;const x=n%w,y=Math.floor(n/w);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
    return maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  };
  // Offline representative sample: previews use the same pixel effect engine,
  // but deliberately do not claim to be a live preview of the artwork.
  Q.effectPreviewCanvas = function (type) {
    const cv=Q.canvas(64,48), c=cv.getContext('2d');
    const g=c.createLinearGradient(0,0,64,48); g.addColorStop(0,'#45b9c7'); g.addColorStop(0.5,'#eac48c'); g.addColorStop(1,'#b43f72'); c.fillStyle=g; c.fillRect(0,0,64,48);
    c.fillStyle='#fbe5b6'; c.beginPath(); c.arc(45,13,8,0,Math.PI*2); c.fill();
    c.fillStyle='#28395d'; c.beginPath(); c.moveTo(0,41); c.lineTo(21,19); c.lineTo(38,40); c.lineTo(50,28); c.lineTo(64,42); c.lineTo(64,48); c.lineTo(0,48); c.closePath(); c.fill();
    c.fillStyle='#f58542'; c.fillRect(4,36,11,5);
    const image=c.getImageData(0,0,64,48); Q.applyPixelEffect(image,type,0.75); c.putImageData(image,0,0); return cv;
  };
})();
