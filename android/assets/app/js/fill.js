/* Scanline flood fill for a single cel. Returns the changed bounds or null. */
(function () {
  'use strict';
  const Q = window.Q;
  Q.floodFill = function (image, sx, sy, rgb, threshold, preserveAlpha, mask) {
    const w=image.width, h=image.height, data=image.data;
    sx=Math.floor(sx); sy=Math.floor(sy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    const start=(sy*w+sx)*4, original=[data[start],data[start+1],data[start+2],data[start+3]];
    if (preserveAlpha && original[3] === 0) return null;
    const tol=Q.clamp(Number(threshold) || 0,0,128);
    if (tol === 0 && original[3] === 255 && original[0] === rgb[0] && original[1] === rgb[1] && original[2] === rgb[2]) return null;
    const visited=new Uint8Array(w*h), stack=[sy*w+sx];
    let minX=w,minY=h,maxX=-1,maxY=-1;
    function matches(index) {
      if (visited[index] || (mask && !mask[index])) return false;
      const i=index*4, a=data[i+3];
      if ((preserveAlpha && a === 0) || Math.abs(a-original[3]) > tol) return false;
      if (a === 0 && original[3] === 0) return true;
      return Math.abs(data[i]-original[0])<=tol && Math.abs(data[i+1]-original[1])<=tol && Math.abs(data[i+2]-original[2])<=tol;
    }
    while (stack.length) {
      const seed=stack.pop(), y=Math.floor(seed/w), x=seed%w;
      if (!matches(seed)) continue;
      let left=x,right=x;
      while (left>0 && matches(y*w+left-1)) left--;
      while (right+1<w && matches(y*w+right+1)) right++;
      let up=false,down=false;
      for (let px=left;px<=right;px++) {
        const index=y*w+px, i=index*4; visited[index]=1;
        data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; if (!preserveAlpha) data[i+3]=255;
        if (y>0) { const can=matches(index-w); if (can && !up) stack.push(index-w); up=can; }
        if (y+1<h) { const can=matches(index+w); if (can && !down) stack.push(index+w); down=can; }
      }
      minX=Math.min(minX,left); maxX=Math.max(maxX,right); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
    }
    return maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  };
  // Find either the connected region or all matching pixels in an immutable
  // source image. One byte of state per pixel; connected search uses a bounded
  // typed queue and never enqueues a pixel twice.
  Q.matchColorRegion = function (image,sx,sy,threshold,scope,selectionMask,alphaBarrier) {
    const w=image.width,h=image.height,data=image.data; sx=Math.floor(sx); sy=Math.floor(sy);
    if(sx<0 || sy<0 || sx>=w || sy>=h || !['connected','all'].includes(scope)) return null;
    const seed=sy*w+sx, si=seed*4, original=[data[si],data[si+1],data[si+2],data[si+3]], tol=Q.clamp(Number(threshold)||0,0,128), state=new Uint8Array(w*h);
    function matches(n) {
      if((selectionMask && !selectionMask[n]) || (alphaBarrier && !alphaBarrier[n*4+3])) return false;
      const i=n*4,a=data[i+3]; if(Math.abs(a-original[3])>tol) return false;
      if(a===0 && original[3]===0) return true;
      return Math.abs(data[i]-original[0])<=tol && Math.abs(data[i+1]-original[1])<=tol && Math.abs(data[i+2]-original[2])<=tol;
    }
    if(!matches(seed)) return state;
    if(scope==='all') { for(let i=0;i<state.length;i++) if(matches(i)) state[i]=2; return state; }
    const queue=new Uint32Array(w*h); let read=0,write=0; queue[write++]=seed; state[seed]=2;
    function visit(n) { if(state[n]) return; state[n]=1; if(matches(n)) { state[n]=2; queue[write++]=n; } }
    while(read<write) { const n=queue[read++], x=n%w; if(x>0) visit(n-1); if(x+1<w) visit(n+1); if(n>=w) visit(n-w); if(n+w<state.length) visit(n+w); }
    return state;
  };
  Q.fillColorRegion = function (target,region,rgb,preserveAlpha) {
    if(!region) return null; const w=target.width,h=target.height,data=target.data; let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let n=0;n<region.length;n++) if(region[n]===2) {
      const i=n*4, a=preserveAlpha ? data[i+3] : 255;
      if(data[i]===rgb[0] && data[i+1]===rgb[1] && data[i+2]===rgb[2] && data[i+3]===a) continue;
      data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; data[i+3]=a;
      const x=n%w,y=Math.floor(n/w); minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
    return maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  };
  Q.selectionFromRegion = function (region,w,h,ox,oy) {
    if(!region) return null; const runs=[]; let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++) for(let x=0;x<w;) {
      if(region[y*w+x]!==2) {x++;continue;} const left=x; while(x<w && region[y*w+x]===2) x++;
      if(runs.length>=4096) return {error:'Selection is too complex; lower tolerance or use lasso'};
      runs.push({x:ox+left,y:oy+y,w:x-left}); minX=Math.min(minX,left);maxX=Math.max(maxX,x-1);minY=Math.min(minY,y);maxY=y;
    }
    return maxX<0 ? null : {x:ox+minX,y:oy+minY,w:maxX-minX+1,h:maxY-minY+1,runs:runs};
  };
  // Replace matching non-transparent RGB pixels, including disconnected areas.
  // Alpha is never changed; the optional binary mask is local to image bounds.
  Q.recolorMatching = function (image, source, target, tolerance, mask) {
    const w=image.width,h=image.height,data=image.data,tol=Q.clamp(tolerance,0,128);
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let n=0;n<w*h;n++) {
      const i=n*4; if(!data[i+3] || (mask && !mask[n])) continue;
      if(Math.abs(data[i]-source[0])>tol || Math.abs(data[i+1]-source[1])>tol || Math.abs(data[i+2]-source[2])>tol) continue;
      if(data[i]===target[0] && data[i+1]===target[1] && data[i+2]===target[2]) continue;
      data[i]=target[0]; data[i+1]=target[1]; data[i+2]=target[2];
      const x=n%w,y=Math.floor(n/w); minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
    }
    return maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  };
  // Connected-colour selection on the active cel. Run-length geometry keeps
  // clipping compatible with brushes; reject pathological complex boundaries.
  Q.floodSelect = function (image, sx, sy, threshold) {
    const w=image.width,h=image.height,data=image.data; sx=Math.floor(sx); sy=Math.floor(sy);
    if (sx<0 || sy<0 || sx>=w || sy>=h) return null;
    const start=(sy*w+sx)*4, original=[data[start],data[start+1],data[start+2],data[start+3]], tol=Q.clamp(Number(threshold)||0,0,128);
    const visited=new Uint8Array(w*h),stack=[sy*w+sx],runs=[]; let minX=w,minY=h,maxX=-1,maxY=-1;
    function matches(n) { if(visited[n]) return false; const i=n*4,a=data[i+3]; if(Math.abs(a-original[3])>tol) return false; if(a===0 && original[3]===0) return true; return Math.abs(data[i]-original[0])<=tol && Math.abs(data[i+1]-original[1])<=tol && Math.abs(data[i+2]-original[2])<=tol; }
    while(stack.length) {
      const n=stack.pop(),y=Math.floor(n/w),x=n%w; if(!matches(n)) continue;
      let left=x,right=x; while(left>0 && matches(y*w+left-1)) left--; while(right+1<w && matches(y*w+right+1)) right++;
      if (runs.length>=4096) return {error:'Selection is too complex; lower tolerance or use lasso'};
      runs.push({x:left,y:y,w:right-left+1}); let up=false,down=false;
      for(let xx=left;xx<=right;xx++) { const pos=y*w+xx; visited[pos]=1; if(y>0) { const can=matches(pos-w); if(can&&!up) stack.push(pos-w); up=can; } if(y+1<h) { const can=matches(pos+w); if(can&&!down) stack.push(pos+w); down=can; } }
      minX=Math.min(minX,left);maxX=Math.max(maxX,right);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    if(maxX<0) return null;
    return {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,runs:runs};
  };
})();
