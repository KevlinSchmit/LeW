import * as THREE from 'three';
import { createWasabiMound } from './wasabi-mound.js';
import { partitionMesh } from './partition-mesh.js';

const ease=THREE.MathUtils.smootherstep;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

export function createCounterCondiments(model,camera,sounds,onClose){
  const dish=model.children.find(o=>o.name.startsWith('SAUCE_DISH'));
  const pool=dish.children.find(o=>o.material?.name==='Dark soy sauce' || /soy.sauce.pool/i.test(o.name));
  const jar=model.getObjectByName('Wasabi jar'), bottle=model.getObjectByName('Soy dispenser');
  const bamboo=model.children.find(o=>o.name.startsWith('CHOPSTICKS')).children.find(o=>o.material?.name.includes('End-grain & bamboo'));
  const targets=new Set([dish,jar,bottle,bamboo]);
  pool.visible=false;

  const lid=new THREE.Group();
  jar.add(lid);
  lid.add(jar.getObjectByName('Notched wasabi lid'),jar.getObjectByName('Wasabi lid paper mark'));
  const mound=createWasabiMound();
  mound.name='Wasabi in dish';
  mound.position.set(-.30,.113,-.17);
  mound.castShadow=true;
  mound.visible=false;
  dish.add(mound);

  const spoon=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:0xb9bec0,metalness:.48,roughness:.35});
  const bowl=new THREE.Mesh(new THREE.SphereGeometry(1,18,12,0,Math.PI*2,Math.PI/2,Math.PI/2),steel);
  steel.side=THREE.DoubleSide;
  bowl.scale.set(.165,.075,.195);
  const handle=new THREE.Mesh(new THREE.CapsuleGeometry(.043,.80,6,12),steel);
  handle.rotation.x=.62;
  handle.position.set(0,.31,.36);
  spoon.add(bowl,handle);
  const scoop=mound.clone();
  scoop.position.set(0,-.025,0);
  spoon.add(scoop);
  const spoonRest=v(0,.69,.15);
  spoon.position.copy(spoonRest);
  scoop.visible=false;
  jar.add(spoon);
  const stream=new THREE.Mesh(new THREE.CylinderGeometry(.034,.048,1,12),pool.material);
  model.add(stream);
  stream.visible=false;

  // Use separate moving copies so sushi dining can keep using the original paired mesh.
  const sticks=[...partitionMesh(bamboo,p=>Number(p.z>=.006)).values()].map(piece=>{
    const center=new THREE.Box3().setFromBufferAttribute(piece.geometry.attributes.position).getCenter(v());
    piece.geometry.translate(-center.x,-center.y,-center.z);
    piece.position.add(center.applyQuaternion(piece.quaternion));
    bamboo.parent.add(piece);
    piece.visible=false;
    return {piece,rest:piece.position.clone(),rotation:piece.quaternion.clone()};
  });
  // The spoon follows a single curved stroke, clearing the open rim on its way out.
  const parking=dish.position.clone().add(v(1.58,0,-.72));
  parking.y=jar.position.y;
  const servingPoint=dish.position.clone().add(mound.position).sub(parking);
  const spoonPath=new THREE.CatmullRomCurve3([
    spoonRest, v(-.07,.62,.06), v(-.12,.73,-.01), v(-.24,1.14,.04),
    v(-.65,1.29,.22), servingPoint.clone().add(v(.36,.42,-.06)),
    servingPoint.clone().add(v(.016,.048,0))
  ]);
  let action;
  const dest=v(), tip=v(), delta=v(), up=v(0,1,0);
  const lens=new THREE.PerspectiveCamera(), focus=v();
  function begin(object){
    if(action || !targets.has(object))return false;
    const kind=object===bamboo?'sticks':object===bottle&&!pool.visible?'pour':object===jar&&!mound.visible?'scoop':'shake';
    action={object,kind,time:0,rest:object.position.clone(),rotation:object.quaternion.clone(),
      eye:camera.position.clone(),view:camera.quaternion.clone(),fov:camera.fov};
    if(kind==='sticks'){bamboo.visible=false;sticks.forEach(s=>s.piece.visible=true);}
    sounds.play(kind==='sticks'?'sticks':kind==='shake'?'plateRock':'potLift',.35);
    return true;
  }
  function frame(t,end){
    const a=action;
    const weight=ease(t,0,1.4)*(1-ease(t,end-1.25,end));
    focus.copy(dish.position).lerp(a.object.position,.45);
    focus.y+=.53;
    lens.position.copy(focus).add(dest.set(.24,3.15,3.76).multiplyScalar(Math.max(1,.98/camera.aspect)));
    lens.lookAt(focus);
    camera.position.copy(a.eye).lerp(lens.position,weight);
    camera.quaternion.copy(a.view).slerp(lens.quaternion,weight);
    camera.fov=THREE.MathUtils.lerp(a.fov,34,weight);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function update(dt){
    const a=action;
    if(!a)return;
    const before=a.time,t=a.time+=dt;
    let end;
    if(a.kind==='shake'){
      end=.68;
      const p=Math.min(1,t/end);
      a.object.rotation.z=.105*Math.sin(4*Math.PI*p)*Math.sin(Math.PI*p)**2;
    }else if(a.kind==='sticks'){
      end=3.08;
      sticks.forEach(({piece,rest,rotation},i)=>{
        const time=t-.055*i;
        const push=ease(time,0,.38);
        const roll=ease(time,.31,.99);
        const fall=THREE.MathUtils.clamp((time-.32)/.31,0,1);
        const lift=ease(time,1.42,1.91);
        const replace=ease(time,1.82,2.63);
        const settle=ease(time,2.58,2.98);
        const away=1-replace;
        piece.position.copy(rest);
        piece.position.z+=(.62*push+(.75+i*.24)*roll)*away;
        const bounce=.055*Math.abs(Math.sin(Math.PI*2*roll))*(1-roll);
        piece.position.y+=(-.32*fall*fall+bounce)*(1-lift)+.52*lift*(1-settle);
        piece.quaternion.copy(rotation);
        piece.rotateY((i===0?.055:-.045)*roll*away);
        piece.rotateX((.62*push+(i===0?4.2:4.7)*roll)*away);
      });
      sounds.cues(before,t,[[.62,'sticks',.59],[2.96,'sticks',.34]]);
    }else{
      const pouring=a.kind==='pour';
      end=pouring?4.65:6.55;
      if(pouring){
        const carry=ease(t,.12,1.52)*(1-ease(t,end-1.48,end-.13));
        dest.copy(dish.position).add(v(1.26,.86,0));
        bottle.position.copy(a.rest).lerp(dest,carry);
        bottle.position.y+=2.36*Math.sin(Math.PI*carry);
        const tilt=ease(t,1.45,2.04)*(1-ease(t,2.99,3.53));
        bottle.rotation.z=1.04*tilt;
        const amount=ease(t,2.03,3.04);
        if(amount>0){
          pool.visible=true;
          pool.scale.set(Math.sqrt(amount),1,Math.sqrt(amount));
        }
        stream.visible=t>=1.96 && t<3.04;
        if(stream.visible){
          tip.set(-.56,1.445,.05);bottle.localToWorld(tip);model.worldToLocal(tip);
          dest.copy(dish.position).add(v(-.10,.15,.02));
          delta.subVectors(tip,dest);
          stream.position.copy(dest).lerp(tip,.5);
          stream.scale.set(1,delta.length(),1);
          stream.quaternion.setFromUnitVectors(up,delta.normalize());
        }
      }else{
        const travel=ease(t,0,1.68)*(1-ease(t,4.91,end));
        const arc=Math.sin(Math.PI*travel);
        jar.position.copy(a.rest).lerp(parking,travel);
        jar.position.y+=1.52*arc;
        jar.position.z+=.20*arc;
        jar.rotation.z=.068*Math.sin(2*Math.PI*travel);

        const open=ease(t,1.48,2.12)*(1-ease(t,4.48,5.02));
        lid.position.set(.18*open,.61*open*open,-.73*open);
        lid.rotation.x=-.10*open;

        const forward=ease(t,1.97,3.37);
        const returning=ease(t,3.60,4.61);
        const progress=forward*(1-returning);
        spoonPath.getPoint(progress,spoon.position);
        // A slight wrist curl as the bowl digs in, then rolls toward the dish.
        const dig=Math.sin(Math.PI*Math.min(1,progress/.34));
        const tipOver=ease(t,3.06,3.50)*(1-ease(t,3.52,3.97));
        spoon.rotation.set(-.32*dig+.13*Math.sin(Math.PI*progress),.16*Math.sin(Math.PI*progress),-.94*tipOver);
        scoop.visible=t>=2.20 && t<3.46;
        scoop.scale.setScalar(ease(t,2.20,2.57));
        if(t>=3.46)mound.visible=true;
        sounds.cues(before,t,[[1.61,'lid',.33],[4.91,'lid',.28]]);
      }
      frame(t,end);
    }
    if(t>=end){
      a.object.position.copy(a.rest);
      a.object.quaternion.copy(a.rotation);
      if(a.kind==='sticks'){sticks.forEach(s=>s.piece.visible=false);bamboo.visible=true;}
      action=null;
      onClose();
    }
  }
  return {targets,begin,update,get active(){return !!action;}};
}
