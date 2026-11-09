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
  Q.selectionPath = function (ctx,selection) {
    ctx.beginPath();
    if (selection.points && selection.points.length>=3) {
      ctx.moveTo(selection.points[0].x,selection.points[0].y);
      for (let i=1;i<selection.points.length;i++) ctx.lineTo(selection.points[i].x,selection.points[i].y);
      ctx.closePath();
    } else ctx.rect(selection.x,selection.y,selection.w,selection.h);
  };
  Q.selectionMask = function (selection) {
    if (!selection.points) return null;
    const canvas=Q.canvas(selection.w,selection.h), ctx=canvas.getContext('2d');
    ctx.translate(-selection.x,-selection.y); Q.selectionPath(ctx,selection); ctx.fillStyle='#000'; ctx.fill();
    const rgba=ctx.getImageData(0,0,selection.w,selection.h).data, mask=new Uint8Array(selection.w*selection.h);
    for (let i=0;i<mask.length;i++) mask[i]=rgba[i*4+3]>=128 ? 1 : 0;
    return mask;
  };
  Q.intersectRect = function (a, b) {
    const x=Math.max(a.x,b.x), y=Math.max(a.y,b.y);
    const right=Math.min(a.x+a.w,b.x+b.w), bottom=Math.min(a.y+a.h,b.y+b.h);
    return right > x && bottom > y ? {x:x,y:y,w:right-x,h:bottom-y} : null;
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
