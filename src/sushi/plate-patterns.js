import * as THREE from 'three';
import { seeded } from './paint.js';

const finishes = [
  ['Indigo waves','#256286','#e7e4d3','waves'],
  ['Marigold waves','#e1ab45','#fff0bc','waves'],
  ['Celadon hemp leaf','#80a493','#f4ebcf','hemp'],
  ['Plum blossoms','#84566f','#f4ddcf','blossom'],
  ['Ivory vine','#e5cc98','#a38b5e','vine'],
  ['Ink shippo','#484046','#eee5d5','shippo'],
  ['Vermilion blossoms','#a85347','#f9dfc2','blossom'],
];
const size=512, center=size/2, radius=250;
const tau=2*Math.PI;

function ring(ctx,r,color,width){
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.beginPath();
  ctx.arc(center,center,r,0,tau);
  ctx.stroke();
}

function waveTransfer(ctx, ground, ink) {
  const pitch=46, row=15.5;
  ctx.lineWidth=2.1;
  for(let i=0;i<34;i++) for(let x=-pitch+(i%2)*pitch*.5;x<size+pitch;x+=pitch){
    const y=18+i*row;
    ctx.beginPath();
    ctx.arc(x,y,pitch*.52,Math.PI,tau);
    ctx.closePath();
    ctx.fillStyle=ground;
    ctx.fill();
    ctx.strokeStyle=ink;
    for(const r of [4.8,9.2,13.6,18,22.4]){
      ctx.beginPath();ctx.arc(x,y,r,Math.PI,tau);ctx.stroke();
    }
  }
}

function geometryTransfer(ctx,motif) {
  const pitch=39, angle=Math.PI/3;
  for(let i=0;i<17;i++) for(let x=-20+(i%2)*pitch*.5;x<size+pitch;x+=pitch){
    const y=i*(motif==='hemp'?pitch*.866:pitch);
    if(motif==='shippo'){
      ctx.beginPath();
      ctx.arc(x,y,pitch*.704,0,tau);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x,y,2,0,tau);
      ctx.fill();
    }else{
      for(let j=0;j<6;j++){
        const a=angle*j, dx=Math.cos(a)*21, dy=Math.sin(a)*21;
        const nextX=Math.cos(a+angle)*21, nextY=Math.sin(a+angle)*21;
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(x+dx,y+dy);
        ctx.lineTo(x+nextX,y+nextY);
        ctx.moveTo(x,y);
        ctx.lineTo(x+(.58*dx+.42*nextX)*.42,y+(.58*dy+.42*nextY)*.42);
        ctx.lineTo(x+dx,y+dy);
        ctx.moveTo(x+(.58*dx+.42*nextX)*.42,y+(.58*dy+.42*nextY)*.42);
        ctx.lineTo(x+nextX,y+nextY);
        ctx.stroke();
      }
    }
  }
}

function flowers(ctx, motif) {
  const count=motif==='vine'?22:19;
  if(motif==='vine'){
    ctx.beginPath();
    for(let k=0;k<=320;k++){
      const a=k/320*tau, r=211+11*Math.sin(a*count);
      ctx.lineTo(center+r*Math.cos(a),center+r*Math.sin(a));
    }
    ctx.stroke();
  }
  for(let i=0;i<count;i++){
    const a=i*tau/count;
    ctx.save();
    ctx.translate(center+215*Math.cos(a),center+215*Math.sin(a));
    ctx.rotate(a+.32);
    for(let k=0;k<5;k++){
      ctx.rotate(tau/5);
      ctx.beginPath();
      ctx.moveTo(.9,1.6);
      ctx.bezierCurveTo(4.4,8.4,11.6,10.3,10,3);
      ctx.quadraticCurveTo(12,1.5,10.1,-.3);
      ctx.bezierCurveTo(5.3,-4.7,2,-1.2,.9,1.6);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0,0,2.1,0,tau);
    ctx.fill();
    for(const [x,y,s] of [[-14,12,1],[13,-12,-1]]){
      ctx.beginPath();ctx.moveTo(x-5,y);
      ctx.quadraticCurveTo(x,y-10*s,x+9,y-3*s);
      ctx.quadraticCurveTo(x+5,y+7*s,x-5,y);
      ctx.fill();
    }
    ctx.restore();
  }
}

function paintTransfer(index) {
  const [name,ground,ink,motif]=finishes[index];
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  const glaze=ctx.createRadialGradient(center,center,2,center,center,radius);
  glaze.addColorStop(0,'#eee8da');
  glaze.addColorStop(.59,'#f1eadc');
  glaze.addColorStop(.73,'#e5dac4');
  glaze.addColorStop(.97,'#faf1de');
  glaze.addColorStop(1,'#d5c8af');
  ctx.fillStyle=glaze;
  ctx.fillRect(0,0,size,size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(center,center,radius*.978,0,tau);
  ctx.arc(center,center,radius*.734,0,tau,true);
  ctx.clip('evenodd');
  ctx.fillStyle=ground;
  ctx.fillRect(0,0,size,size);
  ctx.fillStyle=ctx.strokeStyle=ink;
  ctx.lineWidth=1.65;
  if(motif==='waves')waveTransfer(ctx,ground,ink);
  else if(motif==='shippo'||motif==='hemp')geometryTransfer(ctx,motif);
  else flowers(ctx,motif);
  ctx.restore();

  ring(ctx,radius*.716,ground,1.9);
  ring(ctx,radius*.737,ink,1.65);
  ring(ctx,radius*.977,ink,1.5);
  ring(ctx,radius*.986,ground,1.8);
  const random=seeded(4517+index*123);
  for(let i=0;i<7200;i++){
    ctx.fillStyle=i%3?'#fff2d71d':'#6d514a13';
    const x=random()*size, y=random()*size;
    ctx.fillRect(x,y,.42+random()*1.27,.4+random()*.9);
  }
  const map=new THREE.CanvasTexture(canvas);
  map.name=name+' transfer';
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=8;
  return map;
}

export function makePorcelainFinishes() {
  return finishes.map(([name],index)=>{
    const map=paintTransfer(index);
    return new THREE.MeshPhysicalMaterial({
      name:name+' · glazed porcelain',map,roughness:.53,clearcoat:.34,
      clearcoatRoughness:.28,envMapIntensity:.17,emissiveMap:map,
      emissive:0xfff4e6,emissiveIntensity:.092,
    });
  });
}
