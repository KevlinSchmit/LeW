import { seeded } from './sushi/paint.js';

export function applyTeaPaperStock(panel) {
  const stock = document.createElement('canvas');
  stock.width = 840;
  stock.height = 590;
  const {width, height} = stock;
  const ctx = stock.getContext('2d');
  const random = seeded(416);
  const pixels = ctx.createImageData(width,height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y*width+x)*4;
      const edge = Math.min(x, width-1-x, y, height-1-y);
      const wear = 1 - Math.min(1,edge/26);
      const grain = (random()-.5)*16;
      const clouds = Math.sin(x*.013+y*.021)*2.9 + Math.cos(x*.034-y*.027)*1.7;
      pixels.data[i] = 234 - wear*38 + grain + clouds;
      pixels.data[i+1] = 194 - wear*37 + grain + clouds;
      pixels.data[i+2] = 129 - wear*29 + grain + clouds;
      pixels.data[i+3] = 255;
    }
  }
  ctx.putImageData(pixels,0,0);
  for (const [x,y,r] of [[.04,.42,.30],[.81,.84,.42],[.66,.19,.31]]) {
    const stain = ctx.createRadialGradient(x*width,y*height,0,x*width,y*height,r*height);
    stain.addColorStop(0,'#98582128');
    stain.addColorStop(1,'#98582100');
    ctx.fillStyle = stain;
    ctx.fillRect(0,0,width,height);
  }
  for (let i = 0; i < 3500; i++) {
    const x = random()*width, y = random()*height;
    ctx.strokeStyle = i%3 ? '#86563012' : '#fff2cb42';
    ctx.lineWidth = .43+random()*.34;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+random()*3.7-1.4,y+random()*2.9-1.1);
    ctx.stroke();
  }

  const radius = 21;
  const rowPitch = Math.sqrt(3)*radius;
  for (let row = 0; row*rowPitch/2 < height+radius; row++) {
    const y = row*rowPitch/2;
    const margin = Math.min(y,height-y);
    if (margin>142) continue;
    ctx.globalAlpha = .24*(1-Math.max(0,margin)/142);
    for (let x = (row%2)*radius*1.5; x<width+radius; x+=radius*3) {
      ctx.strokeStyle = '#fff1b9';
      ctx.lineWidth = .65;
      for (const size of [radius,radius-3]) {
        ctx.beginPath();
        for (let i=0;i<6;i++) {
          const angle=i*Math.PI/3;
          ctx.lineTo(x+Math.cos(angle)*size,y+Math.sin(angle)*size);
        }
        ctx.closePath();
        ctx.stroke();
      }
      for (let i=0;i<6;i++) {
        const angle=i*Math.PI/3;
        ctx.beginPath();
        ctx.ellipse(x+Math.cos(angle)*5.6,y+Math.sin(angle)*5.6,3.8,2,angle,0,Math.PI*2);
        ctx.stroke();
      }
    }
  }
  panel.style.setProperty('--tea-paper-stock',`url("${stock.toDataURL('image/jpeg',.87)}")`);
}
