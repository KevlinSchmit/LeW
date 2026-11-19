import * as THREE from 'three';

const palette = {
  rice: ['#a99a7c','#e4d5b8','#fff7dc',.83],
  nori: ['#141915','#303828','#5e6250',.77],
  shrimp: ['#a74f3e','#e79370','#f9d5b7',.61],
  mackerel: ['#3b4850','#8d9f9e','#ebe6d3',.48],
  eel: ['#512923','#a15b39','#d5a06a',.40],
  octopus: ['#8e4b59','#e6cfbf','#fff2de',.62],
  clam: ['#a63e48','#e69486','#ffead0',.52],
  scallop: ['#bba385','#e7cfb1','#fff7e1',.51],
  tofu: ['#82411f','#c87a38','#f1ae64',.73],
  wakame: ['#204726','#4e873e','#92ba68',.49],
  wakameLight: ['#345a2b','#75a751','#bfd183',.43],
  uni: ['#b26e35','#e1a55a','#f2cd85',.76],
  roe: ['#a74528','#e47e38','#ffc477',.48],
  salmon: ['#ba5b4d','#e59279','#f9d2b3',.57],
  bake: ['#914b2b','#d69b56','#f2d59a',.58],
  cuke: ['#375542','#7fa26e','#d9e2ab',.77],
  herbs: ['#284b31','#628b54','#a4b97e',.88],
  sesame: ['#bf9e63','#eed19a','#fff2cd',.81],
};

export function seeded(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    return seed/4294967296;
  };
}

function rgb(hex) {
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
}

function texture(width,height,draw) {
  const canvas=document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  return map;
}

function ellipse(ctx,x,y,w,h,angle,color) {
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.ellipse(x,y,w,h,angle,0,Math.PI*2);
  ctx.fill();
}

// Signed, band-limited brush marks. Broad variation survives in the seated view,
// while the smaller rice grains, skin fibers and pores read in the orbit view.
function paintBase(ctx,w,h,kind,colors) {
  const [dark,body,light]=colors.map(rgb), random=seeded(117+kind.charCodeAt(0)*47);
  const image=ctx.createImageData(w,h), data=image.data;
  const soft=THREE.MathUtils.smoothstep;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const u=x/w,v=y/h,edge=Math.abs(v-.5)*2, line=Math.sin(u*19+v*4);
    let shade=.52+.11*Math.sin(v*14+u*10)+.06*Math.sin(x*.40-y*.20);
    shade+=(random()-.5)*.10;
    switch(kind){
      case 'shrimp': {
        const segment=Math.abs(Math.sin((u*7.2+.26*edge+.055*line)*Math.PI));
        shade=.23+.54*soft(segment,.17,.66)+.14*edge+.06*line;
        break;
      }
      case 'mackerel':
        shade=.21+.66*soft(edge,.24,.92)+.06*Math.sin(u*111+v*17);
        shade-=.16*soft(Math.sin(u*76+2.6*Math.cos(v*9)),.1,.88)*(1-edge);
        break;
      case 'eel':
        shade=.30+.55*soft(Math.sin((u*12.8+.33*edge+.06*line)*Math.PI),-.51,.91);
        shade-=.10*edge;
        break;
      case 'octopus':
        shade=.83-.69*soft(edge,.67,.99)+.042*line;
        break;
      case 'clam':
        shade=.85-.62*soft(u+.12*Math.sin(v*4.8),.46,.97)+.11*Math.cos(v*25-u*7);
        break;
      case 'scallop':
        shade=.62+.18*Math.sin(v*43+u*8)+.10*Math.sin(v*113-3*line);
        break;
      case 'salmon': {
        const vein=Math.abs(Math.sin((u*5.4-.82*v+.18*Math.sin(v*5.8))*Math.PI));
        shade=.43+.39*(1-soft(vein,.05,.31))+.10*line;
        break;
      }
      case 'nori':
        shade=.25+.16*line+.13*Math.sin(x*.21+.13*y)+.11*Math.cos(y*.32+u*22)
          +.09*Math.sin(x*.65+y*.68)+.1*random();
        break;
      case 'tofu':
        shade=.36+.28*v+.12*Math.sin(u*8*Math.PI+Math.sin(v*11)*.91)
          +.086*Math.cos(v*113+u*22)+.068*Math.sin(u*113-v*19);
        break;
      case 'wakame':
      case 'wakameLight': {
        const band=(v-.45)*7;
        shade=.43+.31*Math.exp(-band*band)+.13*Math.sin(u*37+v*5)-.23*soft(edge,.71,1);
        break;
      }
      case 'uni':
      case 'bake':
        shade=.49+.18*Math.sin(11*u+4*Math.sin(9*v))+.11*Math.cos(v*46-u*18)+.07*line;
        break;
    }
    const left=shade<.5 ? dark : body, right=shade<.5 ? body : light;
    const mix=Math.max(0,Math.min(1,shade<.5 ? shade*2 : shade*2-1));
    for(let c=0;c<3;c++)data[4*(y*w+x)+c]=THREE.MathUtils.lerp(left[c],right[c],mix)+(random()-.5)*5;
    data[4*(y*w+x)+3]=255;
  }
  ctx.putImageData(image,0,0);
}

function riceMarks(ctx,w,h,random,count) {
  for(let i=0;i<count;i++){
    const x=random()*w,y=random()*h,a=(random()-.5)*3.2,rx=2.3+random()*4.1,ry=1.45+random()*1.85;
    ellipse(ctx,x+.7,y+.75,rx+.46,ry+.36,a,'rgba(132,111,85,.40)');
    ellipse(ctx,x,y,rx,ry,a,['#eedfc3','#f6eacf','#d9cdb0','#e5d5b8','#fdf3df'][i%5]);
    ellipse(ctx,x-.31,y-.49,rx*.61,ry*.33,a,'rgba(255,251,231,.76)');
  }
}

function paintedIngredient(kind,colors) {
  return texture(256,160,(ctx,w,h)=>{
    paintBase(ctx,w,h,kind,colors);
    const rnd=seeded(328+kind.charCodeAt(0)*113);
    if(kind==='rice'){
      riceMarks(ctx,w,h,rnd,980);
      return;
    }
    if(kind==='roe'){
      for(let i=0;i<810;i++){
        const x=rnd()*w,y=rnd()*h,r=1+rnd()*2.7;
        ellipse(ctx,x+.3,y+.4,r+.4,r+.4,0,'#9f4929');
        ellipse(ctx,x,y,r,r,0,['#da702e','#eb8540','#ec9947','#d06c31'][i%4]);
        ellipse(ctx,x-r*.23,y-r*.29,r*.33,r*.24,0,'#f7bb74');
      }
      return;
    }
    if(kind==='wakame'||kind==='wakameLight'){
      ctx.lineWidth=.85;
      for(let i=0;i<125;i++){
        const x=rnd()*w, y=rnd()*h;
        ctx.strokeStyle=i%3?'#edf2ae29':'#2c50292b';
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.quadraticCurveTo(x+10,y-4,x+13+rnd()*39,y-2.7);
        ctx.stroke();
      }
      return;
    }
    const density=kind==='tofu'||kind==='nori' ? 1550 : 630;
    for(let i=0;i<density;i++){
      const x=rnd()*w,y=rnd()*h, rx=.45+rnd()*(kind==='nori'?6.1:2.9);
      const ry=.28+rnd()*.85;
      const highlights=kind==='nori' ? 'rgba(162,168,120,.27)' : 'rgba(255,240,199,.31)';
      ellipse(ctx,x,y,rx,ry,kind==='nori'?(rnd()-.5)*2.2:-.21+rnd()*.41,
        i%3 ? highlights : 'rgba(68,37,37,.27)');
    }
    if(kind==='bake'||kind==='eel'){
      for(let i=0;i<82;i++){
        const x=rnd()*w,y=rnd()*h,r=.7+rnd()*4.9;
        ellipse(ctx,x,y,r*1.3,r*.68,.16,'rgba(85,34,24,.56)');
        ellipse(ctx,x-r*.26,y+r*.34,r*.69,r*.27,.16,'rgba(247,168,91,.55)');
      }
    }
  });
}

function organicFill(ctx,color,cx,cy,rx,ry,seed) {
  const random=seeded(seed);
  ctx.fillStyle=color;
  ctx.beginPath();
  for(let j=0;j<9;j++){
    const a=j/9*2*Math.PI,r=.83+.20*random();
    const x=cx+Math.cos(a)*rx*r,y=cy+Math.sin(a)*ry*r;
    if(j===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fill();
}

function rollFace(kind) {
  return texture(192,192,(ctx,w,h)=>{
    const rnd=seeded(3001+kind.charCodeAt(0));
    const outer={tekka:'#363d2e',california:'#da793b',philadelphia:'#df8a74'}[kind];
    ctx.fillStyle=outer;
    ctx.fillRect(0,0,w,h);
    if(kind==='california'){
      for(let i=0;i<1850;i++)ellipse(ctx,rnd()*w,rnd()*h,1+rnd()*2,1+rnd()*2,0,
        ['#bf592d','#efa25d','#da7839','#f0a767'][i%4]);
    }
    organicFill(ctx,'#af9c7c',96,96,91,88,854);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(12,14,168,164,kind==='tekka'?70:47);
    ctx.clip();
    ctx.fillStyle='#e3d5b8';
    ctx.fillRect(0,0,w,h);
    riceMarks(ctx,w,h,rnd,1180);
    ctx.restore();
    organicFill(ctx,'#454c39',96,94,kind==='tekka'?48:59,kind==='tekka'?45:55,639);
    if(kind==='tekka'){
      organicFill(ctx,'#ae3349',96,94,36,34,41);
      organicFill(ctx,'#ce5060',91,88,30,24,13);
      ctx.strokeStyle='rgba(242,171,159,.63)';
      ctx.lineWidth=1.7;
      for(let i=0;i<9;i++){
        ctx.beginPath();
        ctx.moveTo(69+i*4,80);
        ctx.quadraticCurveTo(89+i*2,89,74+i*4,109);
        ctx.stroke();
      }
    }else{
      organicFill(ctx,'#87a56b',78,73,37,25,101);
      organicFill(ctx,'#d4d9a5',79,69,27,18,101);
      organicFill(ctx,kind==='california'?'#e3a89b':'#d57768',106,100,41,29,107);
      organicFill(ctx,kind==='california'?'#f1d4bb':'#efa688',107,98,28,15,37);
      organicFill(ctx,kind==='california'?'#70995e':'#f3e9d8',85,124,31,15,110);
      organicFill(ctx,'#dfdbb5',79,121,18,9,110);
    }
  });
}

export function makeSushiPaints() {
  const paints={};
  for(const [key,[dark,body,light,roughness]] of Object.entries(palette)){
    const map=paintedIngredient(key,[dark,body,light]);
    paints[key]=new THREE.MeshStandardMaterial({
      name:'Painted sushi · '+key,color:0xffffff,map,roughness,metalness:0,
      emissive:0xffffff,emissiveMap:map,emissiveIntensity:key==='nori'?.20:.14,
    });
    if(key==='wakame'||key==='wakameLight')paints[key].side=THREE.DoubleSide;
  }
  for(const key of ['tekka','california','philadelphia']){
    const map=rollFace(key);
    paints[key+'Face']=new THREE.MeshStandardMaterial({
      name:'Painted sushi · '+key+' cut face',map,roughness:.79,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.13,
    });
  }
  return paints;
}
