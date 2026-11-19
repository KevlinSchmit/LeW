import * as THREE from 'three';
import { drawMenuInk } from './menu-lettering.js';

function paperPrint() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tone = ctx.createLinearGradient(0,0,256,0);
  tone.addColorStop(0,'#cfb995');
  tone.addColorStop(.065,'#f8edce');
  tone.addColorStop(.88,'#f1e1c5');
  tone.addColorStop(1,'#e2c9a5');
  ctx.fillStyle = tone;
  ctx.fillRect(0,0,256,512);
  ctx.fillStyle = '#674d2819';
  for (let y=0;y<512;y+=6) ctx.fillRect(0,y,256,1);
  ctx.strokeStyle = '#49392b';
  drawMenuInk(ctx,'Resume',23,37,1.76);
  ctx.setLineDash([4,3]);
  ctx.beginPath();
  ctx.moveTo(23,136); ctx.lineTo(235,136);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const font = '18px "Tea Story Handwriting"';
  document.fonts.load(font).then(() => {
    ctx.fillStyle = '#504236';
    ctx.font = font;
    let y = 162;
    for (const paragraph of document.querySelectorAll('#resume-story .tea-story-copy p')) {
      let line = '';
      for (const word of paragraph.textContent.trim().split(/\s+/)) {
        const joined = line ? `${line} ${word}` : word;
        if (ctx.measureText(joined).width<=215) line=joined;
        else {
          ctx.fillText(line,23,y);
          y+=23;
          line=word;
        }
      }
      ctx.fillText(line,23,y);
      y+=38;
    }
    texture.needsUpdate=true;
  });
  return texture;
}

export function createCounterReceipt(terminal) {
  const width = 1.25, length = 2.9, divisions = 32;
  const geometry = new THREE.PlaneGeometry(1,1,1,divisions);
  const paper = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
    map:paperPrint(),side:THREE.DoubleSide,transparent:true,depthWrite:false,
  }));
  paper.name = 'Printed receipt curling from POS outlet';
  paper.frustumCulled = false;
  paper.visible = false;
  paper.renderOrder = 8;
  terminal.add(paper);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const {position,uv} = geometry.attributes;
  position.setUsage(THREE.DynamicDrawUsage);
  uv.setUsage(THREE.DynamicDrawUsage);

  return {
    outlet:terminal.localToWorld(new THREE.Vector3(0,1.047,-1.26)),
    update(feed, lift, fade, camera) {
      paper.visible = feed>.001 && fade<.995;
      if (!paper.visible) return;
      paper.material.opacity=1-fade;
      paper.material.depthWrite=fade===0;
      const fit = Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*2;
      const distance = 2.1;
      const frameWidth = fit*distance*camera.aspect * (camera.aspect<1 ? .84 : .73);
      const frameHeight = fit*distance*.84;
      for(let row=0;row<=divisions;row++) for(let column=0;column<2;column++) {
        const i=row*2+column, s=row/divisions, v=(1-s)*feed, span=length*v;
        const x=(column-.5)*width;
        // The strip feeds vertically at the slot and curls toward the rear lid.
        const y=1.047+span*.97-.128*span*span;
        const z=-1.26-.045*span-.115*span*span;
        a.set(x,y,z);
        b.set((column-.5)*frameWidth,(.5-s)*frameHeight,-distance);
        b.applyQuaternion(camera.quaternion).add(camera.position);
        terminal.worldToLocal(b);
        a.lerp(b,lift);
        position.setXYZ(i,a.x,a.y,a.z);
        uv.setXY(i,column,1-s*feed);
      }
      position.needsUpdate = uv.needsUpdate = true;
    },
    hide() {paper.visible=false;},
  };
}
