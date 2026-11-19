import * as THREE from 'three';
import { seeded } from './sushi/paint.js';

const size = 512;

function paint(draw, scalar = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  if (!scalar) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function panel(ctx, x, y, width, height, radius, fill, ink) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function shades(ctx, x, y, endX, endY, colors) {
  const gradient = ctx.createLinearGradient(x, y, endX, endY);
  colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
  return gradient;
}

function grain(ctx, seed, count, alpha) {
  const random = seeded(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 3 ? `rgba(245,249,227,${alpha * random()})`
      : `rgba(30,42,41,${alpha * random()})`;
    ctx.fillRect(random() * size, random() * size, .6 + random() * 2.2, .6 + random() * 1.2);
  }
}

function deckKeys() {
  const soft = ['–', '–', 'ALPHA', '–', '–'].map((label, i) => ({
    x: 102 + i * 67, y: 260, w: 48, h: 25, label,
    colors: i === 2 ? ['#666e73','#424a51','#29343d'] : ['#bbb3e2','#8b79c3','#5c4a97'],
    ink: '#eee9ec', small: true,
  }));
  const numberLegends = ['1','2 ABC','3 DEF','4 GHI','5 JKL','6 MNO',
    '7 PRS','8 TUV','9 WXY','*','0 SP','#'];
  const number = numberLegends.map((label, i) => ({
    x: 144 + i % 3 * 108, y: 297 + Math.floor(i / 3) * 36, w: 84, h: 29,
    label, colors: ['#f0f2e1','#c4cfc3','#9eaaa4'], ink: '#263331',
  }));
  const functionKeys = [
    ['×',['#eb9380','#d45c4b','#9d342b']],
    ['←',['#f4dd86','#e2ad4b','#b77c29']],
    ['↵',['#afe096','#73b767','#467d4c']],
  ].map(([label, colors], i) => ({
    x: 144 + i * 108, y: 449, w: 84, h: 34, label, colors, ink: '#263131',
  }));
  return [...soft, ...number, ...functionKeys];
}

export function paintTerminalDeck() {
  const keys = deckKeys();
  const map = paint(ctx => {
    ctx.fillStyle = shades(ctx, 8, 60, 496, 438, ['#b3bcba','#c9cdc1','#b6bfb8','#9faeab']);
    ctx.fillRect(0, 0, size, size);
    grain(ctx, 914, 13000, .13);

    // Ink at the sloped deck inset, around the printer hatch, and at the screen bezel.
    panel(ctx, 38, 107, 437, 370, 21, '#cad1c330', '#303d3c95');
    panel(ctx, 43, 21, 425, 83, 17, shades(ctx, 0, 22, 0, 102, ['#c5cecc','#edf0df','#a2aeaa']), '#424f4d');
    panel(ctx, 81, 54, 350, 27, 7, shades(ctx, 0, 54, 0, 81, ['#121f22','#253337','#535d54']), '#3f4b48');
    ctx.fillStyle = '#f2f6e5aa';
    ctx.fillRect(95, 82, 322, 2);
    ctx.fillStyle = '#b0beb2';
    for (let i = 0; i < 57; i++) ctx.fillRect(95 + i * 5.7, 79.5, 1.4, 2.3);
    ctx.fillStyle = '#122526';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('VX 520', 345, 121);
    ctx.font = '11px sans-serif';
    ctx.fillText('CARD SERVICES', 86, 121);

    panel(ctx, 72, 127, 319, 109, 9, '#2e3b3d', '#182426');
    panel(ctx, 76, 131, 311, 101, 7, '#b2bcb1');
    panel(ctx, 81, 135, 301, 93, 4, shades(ctx, 86, 133, 220, 229, ['#edf2e4','#e2eadb','#c3d1c5']), '#78928a');
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(82, 136, 299, 91, 4);
    ctx.clip();
    ctx.fillStyle = '#566e590e';
    for (let row = 138; row < 230; row += 3) ctx.fillRect(82, row, 300, 1);
    ctx.fillStyle = '#ffffff43';
    ctx.beginPath();
    ctx.moveTo(92, 134); ctx.lineTo(156, 134); ctx.lineTo(247, 229); ctx.lineTo(193, 229);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#243632';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    for (const [i, item] of ['Debit','Credit','Gift','Prepaid'].entries()) ctx.fillText(item, 366, 152 + i * 21);
    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillText('SELECT', 96, 157);
    ctx.fillText('CARD TYPE', 96, 173);

    for (let i = 0; i < 4; i++) {
      const y = 137 + i * 24;
      panel(ctx, 407, y, 33, 16, 7, shades(ctx, 0, y, 0, y + 17, ['#eff0df','#abbab3','#879995']), '#475956');
    }

    for (const {x,y,w,h,label,colors,ink,small} of keys) {
      panel(ctx, x - w / 2 - 1, y - h / 2 + 2, w + 2, h, 8, '#34444270');
      panel(ctx, x - w / 2, y - h / 2, w, h, 8, shades(ctx, 0, y - h/2, 0, y + h/2, colors), '#3e4745');
      const [symbol, letters] = label.split(' ');
      ctx.fillStyle = ink;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = `bold ${small ? 10 : 19}px sans-serif`;
      ctx.fillText(symbol, x - (letters ? 12 : 0), y);
      if (letters) {
        ctx.font = '9px sans-serif';
        ctx.fillText(letters, x + 12, y - 3);
      }
    }
    ctx.strokeStyle = '#344644';
    ctx.lineWidth = 2;
    ctx.strokeRect(429, 278, 20, 12);
    ctx.beginPath();
    ctx.moveTo(431, 282); ctx.lineTo(445, 282);
    ctx.moveTo(434, 295); ctx.lineTo(448, 295); ctx.lineTo(444, 291);
    ctx.stroke();
  });

  const bump = paint(ctx => {
    ctx.fillStyle = '#767676'; ctx.fillRect(0, 0, size, size);
    grain(ctx, 215, 16000, .13);
    panel(ctx, 74, 129, 315, 104, 9, '#414141');
    panel(ctx, 81, 135, 301, 93, 4, '#606060');
    for (const {x,y,w,h} of keys) {
      panel(ctx, x - w/2, y - h/2, w, h, 8, '#aaabaa');
      panel(ctx, x - w/2 + 3, y - h/2 + 3, w - 6, h - 6, 6, '#d9d9d9');
    }
  }, true);
  const roughness = paint(ctx => {
    ctx.fillStyle = '#bcbcbc'; ctx.fillRect(0, 0, size, size);
    grain(ctx, 291, 4500, .13);
    panel(ctx, 82, 135, 299, 93, 4, '#616161');
    for (const {x,y,w,h} of keys) panel(ctx, x - w/2, y - h/2, w, h, 8, '#9c9c9c');
  }, true);
  return {map, bump, roughness};
}

export function paintTerminalSides() {
  return paint(ctx => {
    // Side atlas: front, back, left and right strips all share the same molded seam.
    ctx.fillStyle = shades(ctx, 0, 0, 0, 512, ['#aeb9b5','#8d9b99','#52615e','#35413f','#242e2e']);
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = shades(ctx, i * 128, 0, (i + 1) * 128, 0, ['#121d201f','#eff4da18','#14222825']);
      ctx.fillRect(i * 128, 0, 128, 512);
    }
    grain(ctx, 811, 8500, .15);
    ctx.fillStyle = '#202926'; ctx.fillRect(0, 285, 512, 12);
    ctx.fillStyle = '#b1bfb06b'; ctx.fillRect(0, 281, 512, 4);
    ctx.fillStyle = '#afbcaa58'; ctx.fillRect(0, 414, 512, 5);
    ctx.fillStyle = '#1e292ad0'; ctx.fillRect(0, 421, 512, 9);
    panel(ctx, 25, 171, 78, 91, 3, shades(ctx, 0, 171, 0, 262, ['#141e1d','#35423e','#738079']));
    ctx.fillStyle = '#2e3d37';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▴ ▯ ▴', 64, 155);
    for (let i = 0; i < 5; i++) {
      panel(ctx, 145 + i * 10, 366, 5, 23, 2, '#1b2626');
      ctx.fillStyle = '#87978e65'; ctx.fillRect(145 + i * 10, 389, 5, 2);
    }
    for (const [a,b] of [[269,361],[399,489]]) {
      panel(ctx, a, 323, b-a, 115, 10, '#44504c65', '#283633');
      ctx.fillStyle = '#9dafa36b'; ctx.fillRect(a+8, 322, b-a-16, 3);
    }
  });
}
