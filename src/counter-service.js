import * as THREE from 'three';
import { seeded } from './sushi/paint.js';

function paint(width,height,draw) {
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

function bambooGrain() {
  return paint(256,256,(ctx,w,h)=>{
    const rng=seeded(247);
    const wood=ctx.createLinearGradient(0,0,0,h);
    wood.addColorStop(0,'#916037');
    wood.addColorStop(.28,'#bf8e51');
    wood.addColorStop(.70,'#c69c5c');
    wood.addColorStop(1,'#daad72');
    ctx.fillStyle=wood;
    ctx.fillRect(0,0,w,h);
    for(let i=0;i<163;i++){
      const x=rng()*w,y=rng()*h,bend=3+rng()*5;
      ctx.strokeStyle=i%5 ? 'rgba(101,60,32,.18)' : 'rgba(255,223,154,.34)';
      ctx.lineWidth=.45+rng()*.95;
      ctx.beginPath();
      ctx.moveTo(x,y-32);
      ctx.bezierCurveTo(x+bend,y+45,x-bend,y+95,x+1,y+160);
      ctx.stroke();
    }
    for(const line of [209,231]) {
      ctx.fillStyle='rgba(109,58,25,.22)';
      ctx.fillRect(0,line,w,2);
      ctx.fillStyle='rgba(255,225,161,.38)';
      ctx.fillRect(0,line-1,w,1);
    }
  });
}

function wasabiPaint() {
  return paint(192,128,(ctx,w,h)=>{
    const rng=seeded(622);
    const base=ctx.createLinearGradient(0,0,0,h);
    base.addColorStop(0,'#a6b26b');
    base.addColorStop(.48,'#879d51');
    base.addColorStop(1,'#64753e');
    ctx.fillStyle=base;
    ctx.fillRect(0,0,w,h);
    const colors=['#82964d','#748743','#a9b66a','#bac27b','#53603a','#6d8144'];
    for(let i=0;i<1190;i++){
      const x=rng()*w,y=rng()*h,rx=.51+rng()*2.4,ry=.4+rng()*1.57;
      ctx.fillStyle=colors[i%colors.length];
      ctx.globalAlpha=.48+rng()*.48;
      ctx.beginPath();
      ctx.ellipse(x,y,rx,ry,(rng()-.5)*2.6,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
  });
}

function darkFlutes() {
  return paint(128,80,(ctx,w,h)=>{
    const tone=ctx.createLinearGradient(0,0,0,h);
    tone.addColorStop(0,'#35332b');
    tone.addColorStop(.24,'#242423');
    tone.addColorStop(.86,'#161817');
    tone.addColorStop(1,'#292925');
    ctx.fillStyle=tone;
    ctx.fillRect(0,0,w,h);
    for(let i=0;i<32;i++){
      ctx.fillStyle='rgba(86,84,74,.52)';
      ctx.fillRect(i*4,6,1,65);
      ctx.fillStyle='rgba(10,10,10,.38)';
      ctx.fillRect(i*4+2,6,1,65);
    }
  });
}

function lidMark() {
  return paint(96,48,(ctx,w,h)=>{
    ctx.fillStyle='#e7dbc0';
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#88816b';
    ctx.strokeRect(3,3,w-6,h-6);
    ctx.font='30px "Yuji Boku", serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle='#242b21';
    ctx.fillText('わさび',w/2,h/2,w-12);
  });
}

function matte(name,color,map=null,emissiveIntensity=0) {
  return new THREE.MeshStandardMaterial({
    name,color,map,roughness:.83,
    emissive:emissiveIntensity ? 0xffffff : 0,
    emissiveMap:emissiveIntensity ? map : null,emissiveIntensity,
  });
}

const v=(r,y)=>new THREE.Vector2(r,y);

function turn(parent,name,profile,material,facets=18){
  const mesh=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>v(r,y)),facets),material);
  mesh.name=name;
  parent.add(mesh);
  return mesh;
}

function placement(parent,name,x,z){
  const group=new THREE.Group();
  group.name=name;
  group.position.set(x,.045,z);
  parent.add(group);
  return group;
}

function wasabiJar(group,glass){
  const pasteMap=wasabiPaint();
  const filling=matte('Grated wasabi paste',0xe7ebce,pasteMap,.25);
  turn(group,'Wasabi filling',[[0,.087],[.483,.087],[.501,.20],[.502,.631],
    [.480,.709],[.39,.733],[.20,.704],[0,.713]],filling,18);
  turn(group,'Wasabi jar glass',[[0,0],[.449,0],[.503,.042],[.547,.124],[.553,.65],
    [.532,.749],[.513,.800],[.491,.801],[.484,.745],[.515,.63],[.512,.136],[.485,.089],[0,.089]],glass,20);
  const cap=matte('Black ribbed wasabi lid',0xffffff,darkFlutes());
  turn(group,'Black wasabi screw cap',[[0,.749],[.521,.749],[.558,.772],
    [.561,.933],[.533,.980],[.469,.999],[0,.999]],cap,20);
  turn(group,'Wasabi jar dark foot seam',[[.484,.036],[.506,.045],[.503,.064],[.481,.070]],
    new THREE.MeshBasicMaterial({color:0x332c19}),20);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.465,.228),matte('Wasabi lid label',0xffffff,lidMark(),.10));
  label.name='Wasabi lid paper mark';
  label.rotation.set(-Math.PI/2,0,.27);
  label.position.set(.055,1.000,-.035);
  group.add(label);
}

function soyCruet(group,glass,wood){
  const soy=matte('Dark shoyu inside the glass',0x382019);
  turn(group,'Soy sauce fill',[[0,.085],[.355,.085],[.402,.14],[.409,1.016],[.373,1.124],[0,1.126]],soy);
  turn(group,'Short soy glass cruet',[[0,0],[.344,0],[.415,.059],[.456,.155],[.45,1.22],
    [.414,1.333],[.411,1.383],[.365,1.383],[.365,1.315],[.405,1.228],[.409,.153],[.351,.083],[0,.083]],glass,18);
  turn(group,'Brown soy dispenser cap',[[0,1.294],[.449,1.294],[.494,1.323],
    [.497,1.529],[.468,1.577],[.402,1.588],[0,1.588]],wood,18);
  const spout=new THREE.Mesh(new THREE.BoxGeometry(.185,.119,.126),wood);
  spout.name='Soy pour lip';
  spout.position.set(-.471,1.445,.05);
  spout.rotation.y=-.18;
  group.add(spout);
}

export function restyleRightCounter(model){
  model.children.find(o=>o.name.startsWith('CONDIMENTS'))?.removeFromParent();
  const fittings=new THREE.Group();
  fittings.name='CONDIMENTS · soy and wasabi';
  model.add(fittings);

  const woodMap=bambooGrain();
  const bent=matte('Bamboo · dark bent hoops',0xb19059,woodMap,.06);
  const glass=new THREE.MeshPhysicalMaterial({
    name:'BOTTLE GLASS · counter jars',color:0xc3d0b4,roughness:.19,
  });
  wasabiJar(placement(fittings,'Wasabi jar',7.81,.16),glass);
  soyCruet(placement(fittings,'Soy dispenser',9.04,.31),glass,bent);

  const terminal=model.children.find(o=>o.name.startsWith('POS'));
  terminal.position.set(6.98,.056,3.94);
  terminal.scale.multiplyScalar(.68);
  terminal.rotateY(-.19);
  const bell=model.children.find(o=>o.name.startsWith('BELL'));
  bell.position.set(3.12,.058,2.89);
}
