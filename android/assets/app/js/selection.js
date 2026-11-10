/* Selection geometry, paths and lossless pixel flips. */
(function () {
  'use strict';
  const Q = window.Q;
  Q.selectionRect = function (a, b, width, height) {
    const x = Math.max(0, Math.floor(Math.min(a.x,b.x)));
    const y = Math.max(0, Math.floor(Math.min(a.y,b.y)));
    const right = Math.min(width, Math.ceil(Math.max(a.x,b.x)));
    const bottom = Math.min(height, Math.ceil(Math.max(a.y,b.y)));
    return right > x && bottom > y ? { x:x, y:y, w:right-x, h:bottom-y } : null;
  };
  Q.lassoSelection = function (points,width,height) {
    if (!points || points.length<3) return null;
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    const bounds=Q.selectionRect({x:Math.min(...xs),y:Math.min(...ys)},{x:Math.max(...xs),y:Math.max(...ys)},width,height);
    if (!bounds || bounds.w<2 || bounds.h<2) return null;
    bounds.points=points.map(p=>({x:p.x,y:p.y})); return bounds;
  };
  // Preserve the original ellipse when it extends beyond the canvas. Using a
  // native path also avoids constructing hundreds of polygon edges per stamp.
  Q.ellipseSelection = function(a,b,width,height) {
    if(!a || !b || ![a.x,a.y,b.x,b.y].every(Number.isFinite)) return null;
    const rx=Math.abs(b.x-a.x)/2, ry=Math.abs(b.y-a.y)/2;
    if(rx<1 || ry<1) return null;
    const bounds=Q.selectionRect(a,b,width,height);
    if(!bounds || bounds.w<1 || bounds.h<1) return null;
    bounds.shape='ellipse'; bounds.ellipse={cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,rx:rx,ry:ry}; return bounds;
  };
  Q.complexSelection = function(s) { return !!(s && (s.points || s.runs || s.shape==='ellipse')); };
  Q.selectionPath = function (ctx,selection) {
    ctx.beginPath();
    if (selection.shape==='ellipse' && selection.ellipse) { const e=selection.ellipse; ctx.ellipse(e.cx,e.cy,e.rx,e.ry,0,0,Math.PI*2); }
    else if (selection.runs) { for (const run of selection.runs) ctx.rect(run.x,run.y,run.w,1); }
    else if (selection.points && selection.points.length>=3) {
      ctx.moveTo(selection.points[0].x,selection.points[0].y);
      for (let i=1;i<selection.points.length;i++) ctx.lineTo(selection.points[i].x,selection.points[i].y);
      ctx.closePath();
    } else ctx.rect(selection.x,selection.y,selection.w,selection.h);
  };
  Q.selectionMask = function (selection) {
    if (selection.runs) { const mask=new Uint8Array(selection.w*selection.h); for (const run of selection.runs) mask.fill(1,(run.y-selection.y)*selection.w+run.x-selection.x,(run.y-selection.y)*selection.w+run.x-selection.x+run.w); return mask; }
    if (!selection.points && selection.shape!=='ellipse') return null;
    const canvas=Q.canvas(selection.w,selection.h), ctx=canvas.getContext('2d');
    ctx.translate(-selection.x,-selection.y); Q.selectionPath(ctx,selection); ctx.fillStyle='#000'; ctx.fill();
    const rgba=ctx.getImageData(0,0,selection.w,selection.h).data, mask=new Uint8Array(selection.w*selection.h);
    for (let i=0;i<mask.length;i++) mask[i]=rgba[i*4+3]>=128 ? 1 : 0;
    return mask;
  };
  // Complement an existing selection using the same hard mask as pixel edits.
  // A null selection means "unrestricted" elsewhere, so an empty result must
  // not be represented as null (which would accidentally select everything).
  Q.invertSelection = function (selection,width,height) {
    if (!selection) return {error:'Make a selection first'};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || !Number.isInteger(selection.x) || !Number.isInteger(selection.y) || !Number.isInteger(selection.w) || !Number.isInteger(selection.h) || selection.w<1 || selection.h<1 || selection.x<0 || selection.y<0 || selection.x+selection.w>width || selection.y+selection.h>height) return {error:'Invalid selection'};
    if (width*height>4*1024*1024) return {error:'Canvas exceeds the 4 megapixel inversion limit'};
    if (Q.complexSelection(selection) && selection.w*selection.h>4*1024*1024) return {error:'Selection mask exceeds the 4 megapixel inversion limit'};
    try {
      const mask=Q.selectionMask(selection), runs=[]; let minX=width,minY=height,maxX=0,maxY=0;
      for (let y=0;y<height;y++) {
        let start=-1;
        for (let x=0;x<=width;x++) {
          let selected=false;
          if (x<width && x>=selection.x && x<selection.x+selection.w && y>=selection.y && y<selection.y+selection.h) selected=mask ? !!mask[(y-selection.y)*selection.w+x-selection.x] : true;
          const include=x<width && !selected;
          if (include && start<0) start=x;
          if (!include && start>=0) {
            if (runs.length>=4096) return {error:'Inverted selection is too complex (maximum 4096 runs)'};
            runs.push({x:start,y:y,w:x-start}); minX=Math.min(minX,start); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=y+1; start=-1;
          }
        }
      }
      if (!runs.length) return {error:'Inversion would be empty; selection left unchanged'};
      return {selection:{x:minX,y:minY,w:maxX-minX,h:maxY-minY,runs:runs}};
    } catch(e) { return {error:'Not enough memory to invert selection'}; }
  };

  Q.intersectRect = function (a, b) {
    const x=Math.max(a.x,b.x), y=Math.max(a.y,b.y);
    const right=Math.min(a.x+a.w,b.x+b.w), bottom=Math.min(a.y+a.h,b.y+b.h);
    return right > x && bottom > y ? {x:x,y:y,w:right-x,h:bottom-y} : null;
  };
  // Geometry and allocation checks shared by the precision dialog and commit.
  Q.planPreciseTransform = function (src,canvasWidth,canvasHeight,o) {
    if (!src || !o || !Number.isInteger(src.x) || !Number.isInteger(src.y) || !Number.isInteger(src.w) || !Number.isInteger(src.h) || src.w<1 || src.h<1 || src.x<0 || src.y<0 || src.x+src.w>canvasWidth || src.y+src.h>canvasHeight) return {error:'Choose a valid rectangular selection'};
    if (!Number.isInteger(o.dx) || !Number.isInteger(o.dy) || Math.abs(o.dx)>canvasWidth*2 || Math.abs(o.dy)>canvasHeight*2) return {error:'Move offsets must be whole pixels within twice the canvas size'};
    if (!Number.isInteger(o.width) || !Number.isInteger(o.height) || o.width<1 || o.height<1 || o.width>Math.min(8192,canvasWidth*4) || o.height>Math.min(8192,canvasHeight*4)) return {error:'Width and height must be whole pixels within the size limit'};
    if (!Number.isFinite(o.angle) || Math.abs(o.angle)>360 || !['smooth','nearest'].includes(o.resampling)) return {error:'Angle must be between −360° and 360°'};
    const theta=o.angle*Math.PI/180, cos=Math.cos(theta), sin=Math.sin(theta), cx=src.x+src.w/2+o.dx, cy=src.y+src.h/2+o.dy;
    const hw=o.width/2, hh=o.height/2, points=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>({x:cx+x*cos-y*sin,y:cy+x*sin+y*cos}));
    function stable(x) { const r=Math.round(x); return Math.abs(x-r)<1e-9 ? r : x; }
    const left=Math.floor(stable(Math.min(...points.map(p=>p.x)))), top=Math.floor(stable(Math.min(...points.map(p=>p.y))));
    const right=Math.ceil(stable(Math.max(...points.map(p=>p.x)))), bottom=Math.ceil(stable(Math.max(...points.map(p=>p.y))));
    const bounds={x:left,y:top,w:right-left,h:bottom-top};
    const union={x:Math.min(src.x,left),y:Math.min(src.y,top),w:Math.max(src.x+src.w,right)-Math.min(src.x,left),h:Math.max(src.y+src.h,bottom)-Math.min(src.y,top)};
    const rect=Q.intersectRect(union,{x:0,y:0,w:canvasWidth,h:canvasHeight});
    if ((src.w*src.h+3*rect.w*rect.h)*4>64*1024*1024) return {error:'Transform needs more than the 64 MiB temporary-memory limit'};
    const angle=((o.angle%360)+360)%360, unchanged=o.dx===0 && o.dy===0 && o.width===src.w && o.height===src.h && angle===0;
    return {src:{...src},cx:cx,cy:cy,theta:theta,bounds:bounds,rect:rect,points:points,clipped:left<0 || top<0 || right>canvasWidth || bottom>canvasHeight,unchanged:unchanged};
  };

  Q.flipImage = function (image, horizontal, vertical) {
    const w=image.width, h=image.height, data=image.data;
    if (!horizontal && !vertical) return;
    // Swap each pair once, in place, preserving RGBA bytes exactly.
    for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
      const targetX=horizontal ? w-1-x : x, targetY=vertical ? h-1-y : y;
      const a=y*w+x, b=targetY*w+targetX;
      if (a >= b) continue;
      for (let channel=0; channel<4; channel++) {
        const i=a*4+channel, j=b*4+channel, value=data[i]; data[i]=data[j]; data[j]=value;
      }
    }
  };
})();
