import * as THREE from 'three';

import brushUrl from './izakaya-assets/yuji-boku-wall.woff2?inline';
import brushLicense from './izakaya-assets/OFL-Yuji-Boku.txt?raw';

const imageSources = import.meta.glob('./izakaya-assets/*.jpg', {
  eager:true, query:'?inline', import:'default'
});

export async function loadIzakayaPrints() {
  const brush = new FontFace('Yuji Boku', `url(${brushUrl}) format("woff2")`);
  // Keep the font notice in the standalone edition as well as in the source.
  document.head.append(document.createComment(brushLicense));
  const [font,art] = await Promise.all([
    brush.load(),
    Promise.all(Object.entries(imageSources).map(async ([path,url])=>{
      const img=new Image();
      img.src=url;
      await img.decode();
      return [path.split('/').at(-1).replace('.jpg',''),img];
    })),
  ]);
  document.fonts.add(font);
  return Object.fromEntries(art);
}

const ink = '#292522';
const vermilion = '#a13125';
const paper = '#efd9a6';
const brush = '"Yuji Boku","Hiragino Mincho ProN","Yu Mincho",serif';

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surface(width,height,draw) {
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

function aging(ctx,w,h,seed,dark='rgba(72,39,15,.18)') {
  const rnd=randomSource(seed);
  const shade=ctx.createRadialGradient(w*.41,h*.39,h*.15,w*.48,h*.48,Math.hypot(w,h)*.55);
  shade.addColorStop(0,'rgba(89,43,19,0)');
  shade.addColorStop(1,dark);
  ctx.fillStyle=shade;
  ctx.fillRect(0,0,w,h);
  for(let i=0;i<w*h/33;i++){
    ctx.fillStyle=rnd()<.58 ? 'rgba(67,40,19,.09)' : 'rgba(255,249,212,.13)';
    ctx.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1);
  }
}

function text(ctx,value,x,y,size,color=ink) {
  ctx.fillStyle=color;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font=size+'px '+brush;
  ctx.fillText(value,x,y);
}

export function plasterTexture() {
  return surface(384,384,(ctx,w,h)=>{
    const rnd=randomSource(451);
    const base=ctx.createLinearGradient(0,0,0,h);
    base.addColorStop(0,'#b58c55');
    base.addColorStop(.41,'#d0ae74');
    base.addColorStop(.86,'#bb8c54');
    base.addColorStop(1,'#9a6b44');
    ctx.fillStyle=base;
    ctx.fillRect(0,0,w,h);
    for(let i=0;i<200;i++){
      const x=rnd()*w,y=rnd()*h,r=5+rnd()*30;
      const cloud=ctx.createRadialGradient(x,y,0,x,y,r);
      cloud.addColorStop(0,i%2?'rgba(83,45,26,.06)':'rgba(255,232,184,.12)');
      cloud.addColorStop(1,'rgba(127,87,49,0)');
      ctx.fillStyle=cloud;
      ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    aging(ctx,w,h,62,'rgba(72,41,23,.07)');
  });
}

export function woodTexture() {
  return surface(384,256,(ctx,w,h)=>{
    const rnd=randomSource(208);
    for(let board=0;board<8;board++){
      const x=board*w/8;
      ctx.fillStyle=['#774a31','#85563b','#69412e','#815038'][board%4];
      ctx.fillRect(x,0,w/8,h);
      ctx.fillStyle='#4a2b20';
      ctx.fillRect(x,0,2,h);
      for(let i=0;i<32;i++){
        const a=x+3+rnd()*(w/8-5),b=rnd()*h,len=20+rnd()*130;
        ctx.strokeStyle=i%2?'rgba(57,33,24,.18)':'rgba(239,190,124,.12)';
        ctx.beginPath();
        ctx.moveTo(a,b);
        ctx.bezierCurveTo(a+4,b+len*.25,a-4,b+len*.65,a+1,b+len);
        ctx.stroke();
      }
    }
    aging(ctx,w,h,62,'rgba(46,22,17,.15)');
  });
}

export function menuSlip(label,price,index) {
  return surface(128,384,(ctx,w,h)=>{
    ctx.fillStyle=['#f5e6bb','#eee0b9','#e8d4a3','#f5e8c6'][index%4];
    ctx.fillRect(0,0,w,h);
    const chars=[...label];
    const spacing=Math.min(61,275/chars.length);
    const size=Math.min(64,spacing*1.09);
    chars.forEach((c,i)=>{
      ctx.save();
      ctx.translate(w/2+2.8*Math.sin(index+i*.9),37+spacing*i);
      ctx.rotate(.048*Math.sin(i*1.9+index*3));
      text(ctx,c,0,0,size*(.96+.04*Math.cos(i*2.6+index)));
      ctx.restore();
    });
    text(ctx,'¥'+price,w/2,h-31,35,vermilion);
    ctx.fillStyle='rgba(102,67,33,.35)';
    ctx.fillRect(58,4,13,9);
    aging(ctx,w,h,40+index);
  });
}

export function wallSign(label,caption) {
  return surface(512,144,(ctx,w,h)=>{
    ctx.fillStyle=paper;
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=vermilion;
    ctx.lineWidth=2;
    ctx.strokeRect(9,9,w-18,h-18);
    const size=label.length>4 ? 81 : 101;
    [...label].forEach((char,i)=>{
      ctx.save();
      ctx.translate(256+(i-(label.length-1)/2)*size*.99,65+1.9*Math.sin(i*2));
      ctx.rotate(.026*Math.cos(i*2.4));
      text(ctx,char,0,0,size);
      ctx.restore();
    });
    text(ctx,caption,w*.5,120,19,vermilion);
    aging(ctx,w,h,62);
  });
}

function cover(ctx,image,x,y,w,h) {
  const scale=Math.max(w/image.width,h/image.height);
  const sw=w/scale,sh=h/scale;
  ctx.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,x,y,w,h);
}

function seal(ctx,x,y) {
  ctx.fillStyle=vermilion;
  ctx.fillRect(x,y,31,34);
  ctx.strokeStyle='#e8bd93';
  ctx.lineWidth=1;
  ctx.strokeRect(x+3,y+3,25,28);
  text(ctx,'鮨',x+15,y+17,21,'#e8bd93');
}

// The matte paper margin and lettering differ across the different print formats.
export function artPrint(image,title,format='mounted') {
  if(format==='photo'){
    return surface(432,512,(ctx,w,h)=>{
      cover(ctx,image,0,0,w,h);
      const glaze=ctx.createLinearGradient(0,0,0,155);
      glaze.addColorStop(0,'rgba(20,12,11,.79)');
      glaze.addColorStop(1,'rgba(20,12,11,0)');
      ctx.fillStyle=glaze;
      ctx.fillRect(0,0,w,155);
      ctx.fillStyle='rgba(225,180,106,.8)';
      ctx.fillRect(33,104,80,2);
      text(ctx,title,w/2,70,78,'#f9e1aa');
      ctx.strokeStyle='rgba(246,218,160,.52)';
      ctx.lineWidth=2;
      ctx.strokeRect(8,8,w-16,h-16);
    });
  }
  if(format==='woodblock'){
    return surface(512,404,(ctx,w,h)=>{
      ctx.fillStyle='#e3cb9e';
      ctx.fillRect(0,0,w,h);
      cover(ctx,image,12,12,w-24,h-42);
      text(ctx,title,75,h-16,23);
      seal(ctx,w-58,h-51);
    });
  }
  return surface(492,448,(ctx,w,h)=>{
    ctx.fillStyle='#ddbf89';
    ctx.fillRect(0,0,w,h);
    cover(ctx,image,9,9,w-18,h-18);
    if(title){
      const grd=ctx.createLinearGradient(12,12,120,12);
      grd.addColorStop(0,'rgba(243,219,163,.92)');
      grd.addColorStop(1,'rgba(243,219,163,0)');
      ctx.fillStyle=grd;
      ctx.fillRect(10,12,110,221);
      [...title].forEach((char,i)=>text(ctx,char,46,43+i*53,50));
      seal(ctx,35,207);
    }
  });
}

export function textilePrint(image,title) {
  return surface(390,512,(ctx,w,h)=>{
    ctx.drawImage(image,0,0,w,h);
    text(ctx,title,w/2,103,title.length>2 ? 81 : 119,'#eed8a1');
  });
}

export function bulbHalo() {
  return surface(64,64,(ctx,w,h)=>{
    const glow=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    glow.addColorStop(0,'rgba(255,244,204,.79)');
    glow.addColorStop(.24,'rgba(255,215,142,.41)');
    glow.addColorStop(1,'rgba(255,166,69,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(0,0,w,h);
  });
}
