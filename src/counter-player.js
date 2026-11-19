import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seeded } from './sushi/paint.js';

const pos=(x,y,z)=>new THREE.Vector3(x,y,z);
const ink=new THREE.MeshBasicMaterial({
  name:'Player thin silhouette ink',color:0x191715,side:THREE.BackSide,
});
ink.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n transformed += normal * 0.008;');
};
ink.customProgramCacheKey=()=> 'counter-player-outline';

function paintedTexture(w,h,draw){
  const canvas=document.createElement('canvas');
  canvas.width=w;
  canvas.height=h;
  draw(canvas.getContext('2d'),w,h);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

function brushedIvory(){
  return paintedTexture(256,192,(ctx,w,h)=>{
    const shade=ctx.createLinearGradient(0,0,w,h);
    shade.addColorStop(0,'#ddd5c1');
    shade.addColorStop(.32,'#f6f1e2');
    shade.addColorStop(.64,'#ebe3d2');
    shade.addColorStop(1,'#d5cbb7');
    ctx.fillStyle=shade;
    ctx.fillRect(0,0,w,h);
    const random=seeded(391);
    for(let i=0;i<810;i++){
      ctx.fillStyle=i%3?'rgba(255,249,229,.12)':'rgba(113,95,72,.095)';
      ctx.fillRect(random()*w,random()*h,5+random()*67,.42+random()*.67);
    }
  });
}

function screenPaint(){
  return paintedTexture(192,128,(ctx,w,h)=>{
    const shade=ctx.createLinearGradient(0,0,w,h);
    shade.addColorStop(0,'#141718');
    shade.addColorStop(.5,'#282e2f');
    shade.addColorStop(1,'#121719');
    ctx.fillStyle=shade;
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(177,191,177,.14)';
    ctx.beginPath();
    ctx.moveTo(w*.09,0);ctx.lineTo(w*.40,0);
    ctx.lineTo(w*.94,h);ctx.lineTo(w*.68,h);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(179,190,177,.35)';
    ctx.lineWidth=1;
    ctx.strokeRect(1,1,w-2,h-2);
  });
}

function wheelPaint(){
  return paintedTexture(160,160,(ctx,w)=>{
    const radial=ctx.createRadialGradient(74,64,14,80,80,80);
    radial.addColorStop(0,'#f5efde');
    radial.addColorStop(.89,'#ede6d5');
    radial.addColorStop(1,'#ccc3b0');
    ctx.fillStyle=radial;
    ctx.fillRect(0,0,w,w);
    ctx.strokeStyle='#adb1a8';
    ctx.beginPath();ctx.arc(80,80,30,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#737a73';
    ctx.font='bold 11px sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText('MENU',80,22);
    const triangle=(x,y,d)=>{
      ctx.beginPath();ctx.moveTo(x-d*3,y-4);ctx.lineTo(x-d*3,y+4);ctx.lineTo(x+d*4,y);ctx.fill();
    };
    for(const [x,d] of [[20,-1],[140,1]]){
      triangle(x-3,80,d);triangle(x+3,80,d);
      ctx.fillRect(x+d*8-1,76,2,8);
    }
    triangle(76,137,1);
    ctx.fillRect(83,133,2,8);
    ctx.fillRect(87,133,2,8);
  });
}

function part(parent,name,geometry,material,location,outline=false){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=name;
  mesh.position.copy(location);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  if(outline){
    const contour=new THREE.Mesh(geometry,ink);
    contour.name='Fine black contour';
    contour.raycast=()=>{};
    mesh.add(contour);
  }
  return mesh;
}

function addClickWheel(parent,ivory,center){
  const wheel=new THREE.Group();
  wheel.name='MP3 click wheel';
  wheel.position.set(0,.257,.556);
  parent.add(wheel);
  part(wheel,'Fixed click wheel rim',new THREE.CylinderGeometry(.426,.429,.014,40),center,pos(0,-.007,0));

  const radius=.419, maxDip=.007;
  const directions=['up','down','left','right'];
  const axes=[[0,1],[0,-1],[-1,0],[1,0]];
  const geometry=new THREE.RingGeometry(.145,radius,48,8);
  const positions=geometry.attributes.position;
  const colors=new THREE.BufferAttribute(new Float32Array(positions.count*3).fill(1),3);
  colors.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('color',colors);
  for(let i=0;i<positions.count;i++){
    const r=Math.hypot(positions.getX(i),positions.getY(i));
    positions.setZ(i,.013*THREE.MathUtils.smoothstep(radius-r,0,.034));
  }
  geometry.computeVertexNormals();
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=axes.map(([dx,dy],index)=>{
    const target=new THREE.Float32BufferAttribute(new Float32Array(positions.count*3),3);
    target.name=directions[index];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i), y=positions.getY(i), r=Math.hypot(x,y);
      const sector=THREE.MathUtils.smoothstep((x*dx+y*dy)/r,.54,.96);
      const nearCenter=THREE.MathUtils.smoothstep(r,.151,.275);
      const nearRim=1-THREE.MathUtils.smoothstep(r,.33,radius-.033);
      target.setZ(i,-maxDip*sector*nearCenter*nearRim);
    }
    return target;
  });
  const face=part(wheel,'Printed circular click wheel',geometry,ivory,pos(0,0,0));
  face.rotation.x=-Math.PI/2;
  const selectHeight=.269;
  const select=part(parent,'Inset select button',new THREE.CylinderGeometry(.148,.151,.024,22),center,pos(0,selectHeight,.556));

  function pressWheel(action,amount){
    const index=directions.indexOf(action);
    face.morphTargetInfluences.fill(0);
    if(index>=0)face.morphTargetInfluences[index]=amount;
    const pressed=geometry.morphAttributes.position[index];
    for(let i=0;i<positions.count;i++){
      const shade=pressed ? 1+.20*amount*pressed.getZ(i)/maxDip : 1;
      colors.setXYZ(i,shade,shade,shade);
    }
    colors.needsUpdate=true;
    select.position.y=selectHeight-(action==='select'?.008*amount:0);
  }
  return {wheel,pressWheel};
}

export function addCounterPlayer(model){
  const player=new THREE.Group();
  player.name='Counter MP3 player';
  player.position.set(5.42,.01,3.04);
  player.rotation.y=-.48;
  model.add(player);

  const metal=new THREE.MeshStandardMaterial({name:'MP3 warm ivory housing',color:0xffffff,map:brushedIvory(),
    metalness:.22,roughness:.55,emissive:0xeee5d3,emissiveIntensity:.19});
  const charcoal=new THREE.MeshStandardMaterial({name:'MP3 charcoal bezel',color:0x292c2c,roughness:.78});
  const face=new THREE.MeshStandardMaterial({name:'MP3 dark display glass',color:0xffffff,map:screenPaint(),roughness:.31,
    emissive:0x161b1c,emissiveIntensity:.28});
  const wheelMap=wheelPaint();
  const ivory=new THREE.MeshStandardMaterial({name:'MP3 printed click wheel',map:wheelMap,roughness:.81,
    emissive:0xeee5d1,emissiveIntensity:.14,vertexColors:true});
  const center=new THREE.MeshStandardMaterial({name:'MP3 select button',color:0xc7bcaa,roughness:.67,
    emissive:0xd7cab5,emissiveIntensity:.15});
  const wire=new THREE.MeshStandardMaterial({name:'Warm white headphone cable',color:0xe2daca,
    roughness:.86,emissive:0xede5d5,emissiveIntensity:.22});

  const housing=part(player,'Beveled silver player housing',new RoundedBoxGeometry(1.42,.197,2.29,1,.071),
    metal,pos(0,.155,0),true);
  part(player,'Dark housing seam',new RoundedBoxGeometry(1.423,.026,2.293,1,.012),
    charcoal,pos(0,.110,0));
  part(player,'MP3 screen surround',new RoundedBoxGeometry(1.197,.034,.956,1,.012),
    charcoal,pos(0,.252,-.506));
  const display=part(player,'Inset MP3 display',new THREE.PlaneGeometry(1.112,.867),face,pos(0,.273,-.506));
  display.rotation.x=-Math.PI/2;
  const {wheel,pressWheel}=addClickWheel(player,ivory,center);
  part(player,'Headphone socket',new THREE.CylinderGeometry(.069,.069,.039,12),charcoal,pos(.442,.160,-1.151))
    .rotation.x=Math.PI/2;
  part(player,'Plugged headphone jack',new THREE.CylinderGeometry(.053,.061,.245,10),wire,pos(.442,.160,-1.274))
    .rotation.x=Math.PI/2;

  // One uninterrupted cord from the plug, around the case, and down the counter.
  const wrapped=[
    [.442,.160,-1.393],[.474,.197,-1.47],[.55,.253,-1.53],[.69,.326,-1.53],
    [.79,.351,-1.37],[.83,.328,-1.15],[.836,.212,-.71],[.825,.084,-.415],
    [.714,.033,-.366],[.35,.026,-.347],[-.30,.026,-.326],[-.672,.035,-.307],
    [-.763,.029,-.282],[-.790,.030,-.239],[-.752,.028,-.195],[-.699,.031,-.172],
    [-.34,.025,-.159],[.34,.025,-.146],[.688,.039,-.112],[.750,.104,-.09],
    [.769,.205,-.078],[.733,.296,-.049],[.63,.299,-.023],[.291,.299,-.004],
    [-.315,.299,.034],[-.679,.299,.073],[-.752,.210,.117],[-.772,.074,.194],
    [-.721,.029,.285],[-.31,.025,.32],[.33,.025,.36],[.714,.028,.397],
    [.791,.025,.49],[.88,.022,.65],
  ].map(p=>pos(...p));
  player.updateWorldMatrix(true,false);
  const tablePath=[
    [5.96,.032,4.22],[5.86,.032,4.46],[5.62,.031,4.86],[5.49,.031,5.33],
    [5.60,.032,5.78],[5.96,.032,6.16],[6.57,.032,6.40],[7.48,.032,6.63],[8.61,.032,7.03],
    [9.53,.032,7.72],[10.60,.032,8.54],[11.44,.032,9.48],
    [12.33,.032,10.87],[12.48,.032,12.17],[12.61,.026,13.23],[12.71,-.26,13.47],
  ].map(p=>player.worldToLocal(pos(...p)));
  const cord=new THREE.CatmullRomCurve3([...wrapped,...tablePath],false,'centripetal');
  part(player,'Headphone cable across tabletop',new THREE.TubeGeometry(cord,205,.025,7,false),
    wire,pos(0,0,0),true);
  return {player,housing,display,wheel,pressWheel};
}
