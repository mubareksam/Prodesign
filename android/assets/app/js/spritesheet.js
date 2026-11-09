/* PNG contact sheet for animation frames; one tile per source frame. */
(function () {
  'use strict';
  const Q=window.Q;
  Q.spriteSheetLayout=function (doc,columns,scale) {
    const count=doc.frames.length;
    if (!Number.isInteger(columns) || columns<1 || columns>count || !Number.isFinite(scale) || scale<0.01 || scale>1) return null;
    const tileW=Math.max(1,Math.round(doc.width*scale)), tileH=Math.max(1,Math.round(doc.height*scale));
    const rows=Math.ceil(count/columns), width=tileW*columns, height=tileH*rows;
    if (width>8192 || height>8192 || width*height>16777216) return null;
    return {columns:columns,rows:rows,tileW:tileW,tileH:tileH,width:width,height:height};
  };
  Q.renderSpriteSheet=function (doc,columns,scale,transparent) {
    const l=Q.spriteSheetLayout(doc,columns,scale); if (!l) throw new Error('Invalid sprite sheet dimensions');
    const canvas=Q.canvas(l.width,l.height), ctx=canvas.getContext('2d');
    doc.frames.forEach(function (_,i) {
      const x=(i%l.columns)*l.tileW, y=Math.floor(i/l.columns)*l.tileH;
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,l.tileW,l.tileH); ctx.clip();
      ctx.translate(x,y); ctx.scale(l.tileW/doc.width,l.tileH/doc.height);
      if (!transparent) { ctx.fillStyle=doc.bg; ctx.fillRect(0,0,doc.width,doc.height); }
      doc.composite(ctx,i); ctx.restore();
    });
    return canvas;
  };
})();
