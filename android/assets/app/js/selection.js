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

  // Boolean operations create hard run masks; null means unrestricted elsewhere,
  // so refusing empty results avoids accidentally selecting the entire canvas.
  Q.combineSelections = function (base,added,operation,width,height) {
    if(!base || !added) return {error:'Make an existing selection first'};
    if(!['add','subtract'].includes(operation)) return {error:'Invalid selection operation'};
    const valid=s=>s && [s.x,s.y,s.w,s.h].every(Number.isInteger) && s.x>=0 && s.y>=0 && s.w>0 && s.h>0 && s.x+s.w<=width && s.y+s.h<=height;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!valid(base)||!valid(added)) return {error:'Invalid selection bounds'};
    if(width*height>4*1024*1024) return {error:'Canvas exceeds the 4 megapixel selection-combine limit'};
    try {
      const masks=[Q.selectionMask(base),Q.selectionMask(added)], shapes=[base,added];
      function contains(n,x,y) { const s=shapes[n]; return x>=s.x && x<s.x+s.w && y>=s.y && y<s.y+s.h && (!masks[n] || !!masks[n][(y-s.y)*s.w+x-s.x]); }
      const left=operation==='subtract' ? base.x : Math.min(base.x,added.x), top=operation==='subtract' ? base.y : Math.min(base.y,added.y);
      const right=operation==='subtract' ? base.x+base.w : Math.max(base.x+base.w,added.x+added.w), bottom=operation==='subtract' ? base.y+base.h : Math.max(base.y+base.h,added.y+added.h);
      const runs=[]; let minX=width,minY=height,maxX=0,maxY=0;
      for(let y=top;y<bottom;y++) { let start=-1; for(let x=left;x<=right;x++) {
        const include=x<right && (operation==='add' ? contains(0,x,y)||contains(1,x,y) : contains(0,x,y)&&!contains(1,x,y));
        if(include && start<0) start=x;
        if(!include && start>=0) { if(runs.length>=4096) return {error:'Combined selection is too complex (maximum 4096 runs)'}; runs.push({x:start,y:y,w:x-start}); minX=Math.min(minX,start); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=y+1; start=-1; }
      }}
      if(!runs.length) return {error:'Result would be empty; selection left unchanged'};
      return {selection:{x:minX,y:minY,w:maxX-minX,h:maxY-minY,runs:runs}};
    } catch(e) { return {error:'Not enough memory to combine selections'}; }
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
  // A 3×3 piecewise-affine mesh with nearest or premultiplied-alpha bilinear sampling.
  Q.transformGrid = function (r) { return Array.from({length:9},(_,i)=>({x:r.x+(i%3)*r.w/2,y:r.y+Math.floor(i/3)*r.h/2})); };
  Q.transformQuad = function (p) {
    const corners=[p[0],p[2],p[6],p[8]];
    return Array.from({length:9},(_,i)=>{const u=(i%3)/2,v=Math.floor(i/3)/2;return {x:(1-u)*(1-v)*corners[0].x+u*(1-v)*corners[1].x+(1-u)*v*corners[2].x+u*v*corners[3].x,y:(1-u)*(1-v)*corners[0].y+u*(1-v)*corners[1].y+(1-u)*v*corners[2].y+u*v*corners[3].y};});
  };
  Q.meshTriangles = function () { const a=[]; for(let y=0;y<2;y++) for(let x=0;x<2;x++) {const i=y*3+x; a.push([i,i+1,i+4],[i,i+4,i+3]);} return a; };
  Q.planMeshTransform = function (src,pts,w,h) {
    if(!Array.isArray(pts) || pts.length!==9 || pts.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x)>w*3 || Math.abs(p.y)>h*3)) return {error:'Invalid handles'};
    for(const [i,j,k] of Q.meshTriangles()) {const a=pts[i],b=pts[j],c=pts[k]; if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0.05) return {error:'Handles cross or collapse; move them apart'};}
    const original=Q.transformGrid(src); if(pts.every((p,i)=>Math.abs(p.x-original[i].x)<0.001 && Math.abs(p.y-original[i].y)<0.001)) return {error:'Nothing changed'};
    const minX=Math.floor(Math.min(src.x,...pts.map(p=>p.x))),minY=Math.floor(Math.min(src.y,...pts.map(p=>p.y))),maxX=Math.ceil(Math.max(src.x+src.w,...pts.map(p=>p.x))),maxY=Math.ceil(Math.max(src.y+src.h,...pts.map(p=>p.y)));
    const rect=Q.intersectRect({x:minX,y:minY,w:maxX-minX,h:maxY-minY},{x:0,y:0,w:w,h:h});
    if(!rect || rect.w*rect.h>2*1024*1024 || src.w*src.h>2*1024*1024 || 8*src.w*src.h+32*rect.w*rect.h>64*1024*1024) return {error:'Transform exceeds the 2 MP or estimated 64 MiB limit; select a smaller area'};
    const bounds=Q.intersectRect({x:Math.floor(Math.min(...pts.map(p=>p.x))),y:Math.floor(Math.min(...pts.map(p=>p.y))),w:Math.ceil(Math.max(...pts.map(p=>p.x)))-Math.floor(Math.min(...pts.map(p=>p.x))),h:Math.ceil(Math.max(...pts.map(p=>p.y)))-Math.floor(Math.min(...pts.map(p=>p.y)))},{x:0,y:0,w:w,h:h});
    return {rect:rect,bounds:bounds};
  };
  Q.rasterMesh = function (source,pts,rect,sampling) {
    const out=new Uint8ClampedArray(rect.w*rect.h*4), sw=source.width,sh=source.height, data=source.data;
    for(const [ia,ib,ic] of Q.meshTriangles()) {
      const a=pts[ia],b=pts[ib],c=pts[ic], det=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      const x0=Math.max(rect.x,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(rect.x+rect.w,Math.ceil(Math.max(a.x,b.x,c.x))),y0=Math.max(rect.y,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(rect.y+rect.h,Math.ceil(Math.max(a.y,b.y,c.y)));
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) {
        const dx=x+0.5-a.x,dy=y+0.5-a.y, u=(dx*(c.y-a.y)-dy*(c.x-a.x))/det,v=((b.x-a.x)*dy-(b.y-a.y)*dx)/det;
        if(u< -1e-8 || v< -1e-8 || u+v>1+1e-8) continue;
        const fx=((ia%3)*(1-u-v)+(ib%3)*u+(ic%3)*v)*sw/2, fy=(Math.floor(ia/3)*(1-u-v)+Math.floor(ib/3)*u+Math.floor(ic/3)*v)*sh/2, di=((y-rect.y)*rect.w+x-rect.x)*4;
        if(sampling!=='smooth') { const sx=Math.min(sw-1,Math.max(0,Math.floor(fx))),sy=Math.min(sh-1,Math.max(0,Math.floor(fy))),si=(sy*sw+sx)*4;out[di]=data[si];out[di+1]=data[si+1];out[di+2]=data[si+2];out[di+3]=data[si+3]; }
        else {
          const xx=Math.max(0,Math.min(sw-1,fx-0.5)),yy=Math.max(0,Math.min(sh-1,fy-0.5)),x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1), tx=xx-x0,ty=yy-y0;
          const i00=(y0*sw+x0)*4,i10=(y0*sw+x1)*4,i01=(y1*sw+x0)*4,i11=(y1*sw+x1)*4,w00=(1-tx)*(1-ty)*data[i00+3],w10=tx*(1-ty)*data[i10+3],w01=(1-tx)*ty*data[i01+3],w11=tx*ty*data[i11+3],alpha=w00+w10+w01+w11;
          out[di+3]=alpha;if(alpha>0) for(let ch=0;ch<3;ch++) out[di+ch]=(data[i00+ch]*w00+data[i10+ch]*w10+data[i01+ch]*w01+data[i11+ch]*w11)/alpha;
        }
      }
    }
    return out;
  };
})();
