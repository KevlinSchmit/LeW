import * as THREE from 'three';
import { partitionMesh } from '../partition-mesh.js';
import { matchesTableware } from './servings.js';

const xAxis = new THREE.Vector3(1,0,0);
const direction = new THREE.Vector3(.82,.19,.67).normalize();
const pinchAxis = new THREE.Vector3(direction.z,0,-direction.x).normalize();
const ease = THREE.MathUtils.smootherstep;
const movementTime = 1.78;
const biteCues=[[.66,'sticks',.47,.18],[1.40,'bite',.52,0]];

function separateFood(dish) {
  const food=dish.children.filter(part=>!matchesTableware(part));
  if (food.length===1 && food[0].userData.individualSushi) return [...food[0].children];
  if (dish.userData.sushiKind==='roe') {
    const bites=[new THREE.Group(),new THREE.Group()];
    for (const part of food) {
      for (const [index,portion] of partitionMesh(part,center=>Number(center.x>=0))) {
        bites[index].add(portion);
      }
    }
    dish.remove(...food);
    dish.add(...bites);
    bites.forEach(bite=>{bite.userData.ownsGeometry=true;});
    return bites;
  }
  const bite=new THREE.Group();
  dish.add(bite);
  bite.add(...food);
  return [bite];
}

function bitePose(part) {
  const bounds=new THREE.Box3().setFromObject(part,true);
  const center=bounds.getCenter(new THREE.Vector3());
  center.y=THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,.42);
  const point=new THREE.Vector3();
  let width=0;
  part.traverse(mesh=>{
    if (!mesh.isMesh || mesh.name==='Sushi outline') return;
    const positions=mesh.geometry.attributes.position;
    for (let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).sub(center);
      if (Math.abs(point.y)<.17) width=Math.max(width,Math.abs(point.dot(pinchAxis)));
    }
  });
  part.name='Sushi bite';
  return {
    part,center,width:THREE.MathUtils.clamp(width,.24,1.28),
    start:part.position.clone(),rotation:part.quaternion.clone(),
  };
}

export function createDiningChopsticks(model, bamboo, sounds) {
  const sticks=new THREE.Group();
  sticks.name='Bamboo chopsticks in hand';
  sticks.visible=false;
  model.add(sticks);
  const pieces=partitionMesh(bamboo,center=>Number(center.z>=.006));
  const pair=[0,1].map(index=>{
    const stick=pieces.get(index);
    const bounds=new THREE.Box3().setFromBufferAttribute(stick.geometry.attributes.position);
    const middle=bounds.getCenter(new THREE.Vector3());
    stick.geometry.translate(-bounds.min.x,-middle.y,-middle.z);
    stick.name=index===0?'Lower bamboo chopstick':'Upper bamboo chopstick';
    sticks.add(stick);
    return stick;
  });
  const center=new THREE.Vector3(), rest=new THREE.Vector3(), mouth=new THREE.Vector3();
  const reach=new THREE.Vector3(), handle=new THREE.Vector3(), tip=new THREE.Vector3();
  const local=new THREE.Vector3(), rotation=new THREE.Quaternion();
  const tiltAxis=new THREE.Vector3(0,0,1);

  function posePair(halfGap) {
    handle.copy(center).addScaledVector(direction,5.8);
    for (const [i,stick] of pair.entries()) {
      const side=i*2-1;
      tip.copy(center).addScaledVector(pinchAxis,side*halfGap);
      stick.position.copy(tip);
      reach.copy(handle).addScaledVector(pinchAxis,side*.14).sub(tip).normalize();
      stick.quaternion.setFromUnitVectors(xAxis,reach);
    }
  }

  function prepare(dish) {
    const parts=separateFood(dish);
    for (const part of parts) model.attach(part);
    const bites=parts.map(bitePose).sort((a,b)=>b.center.z-a.center.z);
    return {bites, duration:bites.length*movementTime};
  }

  function update({bites,duration}, previous, time, camera) {
    sticks.visible=time<duration;
    for (const [i,bite] of bites.entries()) {
      const t=time-i*movementTime;
      sounds.cues(previous-i*movementTime,t,biteCues);
      bite.part.visible=t<1.41;
      if (t<0 || t>=movementTime) continue;
      const {part,width,start}=bite;
      const grab=ease(t,.04,.68);
      const pinch=ease(t,.47,.68);
      const lift=ease(t,.68,1.40);
      const retract=ease(t,1.42,1.77);
      rest.copy(bite.center).addScaledVector(direction,3.0).addScaledVector(tiltAxis,.16);
      mouth.set(.06,-.44,-.52).applyQuaternion(camera.quaternion).add(camera.position);
      center.copy(rest).lerp(bite.center,grab);
      center.y+=.28*Math.sin(Math.PI*grab);
      center.lerp(mouth,lift);
      center.y+=.39*Math.sin(Math.PI*lift);
      center.lerp(rest,retract);
      let gap=width+.28*(1-pinch);
      gap=THREE.MathUtils.lerp(gap,.16,retract);
      posePair(gap);
      if (lift>0 && t<1.41) {
        rotation.setFromAxisAngle(tiltAxis,-.18*lift);
        const displacement=local.copy(start).sub(bite.center).applyQuaternion(rotation).add(center);
        part.position.copy(displacement);
        part.quaternion.copy(rotation).multiply(bite.rotation);
      }
    }
  }

  function finish({bites}) {
    sticks.visible=false;
    for (const {part} of bites) {
      part.removeFromParent();
      if (part.userData.ownsGeometry) part.traverse(mesh=>mesh.geometry?.dispose());
    }
  }

  return {prepare,update,finish};
}
