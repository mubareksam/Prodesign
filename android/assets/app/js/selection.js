/* Rectangular selection geometry and lossless pixel flips. */
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
