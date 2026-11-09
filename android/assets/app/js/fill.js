/* Scanline flood fill for a single cel. Returns the changed bounds or null. */
(function () {
  'use strict';
  const Q = window.Q;
  Q.floodFill = function (image, sx, sy, rgb, threshold) {
    const w=image.width, h=image.height, data=image.data;
    sx=Math.floor(sx); sy=Math.floor(sy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
    const start=(sy*w+sx)*4, original=[data[start],data[start+1],data[start+2],data[start+3]];
    const tol=Q.clamp(Number(threshold) || 0,0,128);
    if (tol === 0 && original[3] === 255 && original[0] === rgb[0] && original[1] === rgb[1] && original[2] === rgb[2]) return null;
    const visited=new Uint8Array(w*h), stack=[sy*w+sx];
    let minX=w,minY=h,maxX=-1,maxY=-1;
    function matches(index) {
      if (visited[index]) return false;
      const i=index*4, a=data[i+3];
      if (Math.abs(a-original[3]) > tol) return false;
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
        data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; data[i+3]=255;
        if (y>0) { const can=matches(index-w); if (can && !up) stack.push(index-w); up=can; }
        if (y+1<h) { const can=matches(index+w); if (can && !down) stack.push(index+w); down=can; }
      }
      minX=Math.min(minX,left); maxX=Math.max(maxX,right); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
    }
    return maxX<0 ? null : {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  };
})();
