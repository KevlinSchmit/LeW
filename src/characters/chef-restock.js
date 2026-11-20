import * as THREE from 'three';
import { isFrontDish } from '../conveyor.js';
import { animateJacket, armJoints } from './chef-animation.js';
import { solveTrayGrip } from './chef-arm-pose.js';
import { digitPose } from './chef-hands.js';
import { sampleStance } from './chef-stance.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const ease=THREE.MathUtils.smootherstep;
const lerp=THREE.MathUtils.lerp;
const up=v(0,1,0);
const gripAt=.82;
const crossAt=1.32;
const lineUpAt=1.45;
const setDownAt=2.14;
const releaseAt=2.58;
const finishAt=2.91;
const serviceLeft=-9.35;
const serviceRight=.95;
const restockChance=.30;
const sidewaysTurn=v(0,0,1);
// Anchor the palm beneath the rolled edge, outside the raised plastic skirt.
const rim=v(-.78,-.14,-1.97);
const palmPad=v(.016,-.067,-.012);

function stepPose(time,step,scale){
  const rise=.28*ease(-step,0,1.35);
  const feet=[[1.22,1.68,2.19,2.55],[.85,1.24,2.54,finishAt]].map(([start,land,back,home],i)=>{
    const out=ease(time,start,land), retract=ease(time,back,home);
    const distance=(out-retract)*step*(i===0?.80:1);
    const lift=rise*(Math.sin(Math.PI*out)+Math.sin(Math.PI*retract));
    return v(distance,lift,distance*.21).divideScalar(scale);
  });
  const center=feet[0].clone().lerp(feet[1],.5);
  const dip=.13*ease(Math.abs(feet[0].x-feet[1].x)*scale,0,3.5);
  return {feet,center,dip};
}

function pathToBelt(start,landing,speed){
  const liftY=landing.y-.69;
  const clearY=landing.y+.135;
  const position=v();
  function predictedX(time){return landing.x+(setDownAt-time)*speed;}
  function sample(time,beltX=predictedX(time)) {
    const rise=ease(time,gripAt,1.40);
    const clearRail=ease(time,1.49,1.72);
    const lineUp=ease(time,lineUpAt,1.96);
    const reach=ease(time,crossAt,setDownAt);
    const lower=ease(time,1.88,setDownAt);
    const height=lerp(lerp(start.y,liftY,rise),clearY,clearRail);
    position.set(lerp(start.x,beltX,lineUp),lerp(height,landing.y,lower),
      lerp(start.z,landing.z,reach));
    return position;
  }
  return {sample,predictedX};
}

function rightArmPose(chef,rig,right,hip,chest,position,plateScale,time){
  const withdraw=ease(time,setDownAt+.04,setDownAt+.31);
  const socket=rim.clone().multiplyScalar(plateScale).add(position);
  socket.add(v(-.13,.20,-.74).multiplyScalar(withdraw));
  const closed=ease(time,.56,gripAt)*(1-withdraw);
  const fingers=digitPose(right,.16+.36*closed,0);
  const goal=chef.worldToLocal(socket).sub(hip).applyQuaternion(chest.clone().invert()).add(rig.rest);
  const turn=lerp(.22,-.24,ease(time,.48,gripAt))+.13*withdraw;
  const extension=ease(time,1.25,1.72);
  const elbowGuide=v(lerp(-.34,-.74,extension),-.86,lerp(-.94,-.37,extension));
  const {angles,outside}=solveTrayGrip(right,goal,palmPad,.18+.08*withdraw,turn,elbowGuide);
  return {angles:[...angles,...fingers.flat()],outside};
}

function reachWeight(time){
  return ease(time,.19,gripAt)*(1-ease(time,setDownAt+.09,releaseAt));
}

function restockClip(chef,arms,ready,path,plateScale,landingX){
  const rig=chef.userData.sculptRuntime.stance;
  const right=arms.find(arm=>arm.side===-1);
  const joints=arms.map(armJoints);
  const beginning=joints.map(arm=>arm.map(bone=>bone.quaternion.clone()));
  const hipsStart=rig.hips.position.clone(), chestStart=rig.chest.quaternion.clone();
  const neckStart=rig.neck.quaternion.clone();
  const legJoints=rig.legs.map(leg=>[leg.thigh,leg.shin,leg.foot]);
  const legStart=legJoints.map(leg=>leg.map(bone=>bone.quaternion.clone()));
  const cuff=chef.userData.sculptRuntime.meshes.find(mesh=>mesh.morphTargetDictionary?.cuffRoll!==undefined);
  const cuffStart=cuff?.morphTargetInfluences[cuff.morphTargetDictionary.cuffRoll]??0;
  const scale=chef.getWorldScale(v()).x;
  const shoulderX=chef.localToWorld(right.shoulder.clone()).x;
  const stride=-2.10*ease(-landingX,4.2,9.3);
  const sideReach=THREE.MathUtils.clamp((landingX-stride-shoulderX)/5,-1,1);
  const channels=new Map(), times=[];
  const steps=Math.ceil(finishAt*30);
  const samples=Array.from({length:steps+1},(_,i)=>i*finishAt/steps);
  samples.push(gripAt,setDownAt);
  samples.sort((a,b)=>a-b);

  function record(node,key,value){
    const name=node.name+'.'+key;
    if(!channels.has(name))channels.set(name,[]);
    channels.get(name).push(...value.toArray());
  }

  for(const time of new Set(samples)){
    const settle=ease(time,0,.42);
    const working=reachWeight(time);
    const crouch=ease(time,.11,.73)*(1-ease(time,.83,1.30));
    const carry=ease(time,.91,1.29)*(1-ease(time,1.80,2.22));
    const deliver=ease(time,crossAt,setDownAt)*(1-ease(time,setDownAt+.06,releaseAt));
    const {feet,center,dip}=stepPose(time,stride,scale);
    const stance=sampleStance(rig,(2.69*crouch+.12*(working+carry)+dip)/scale,.13*crouch+.045*working-.12*carry,
      .26*crouch+.075*working,center.x+(-.30*crouch+.63*sideReach*deliver)/scale,
      {feet,setback:center.z-(.32*crouch+1.27*carry)/scale});
    stance.chest.premultiply(new THREE.Quaternion().setFromAxisAngle(sidewaysTurn,.092*crouch-.075*sideReach*deliver));
    // Blend out of the suspended idle, including a squat or a sleeve roll.
    const chest=chestStart.clone().slerp(stance.chest,settle);
    const hips=hipsStart.clone().lerp(stance.pos,settle);
    const neck=neckStart.clone().slerp(stance.neck,settle);
    neck.multiply(new THREE.Quaternion().setFromAxisAngle(up,-.29*crouch-.09*working));
    const {angles,outside}=rightArmPose(chef,rig,right,hips,chest,path.sample(time),plateScale,time);
    if(time>=gripAt && time<=setDownAt && outside)return null;
    record(rig.hips,'position',hips);
    record(rig.chest,'quaternion',chest);
    record(rig.neck,'quaternion',neck);
    legJoints.forEach((leg,i)=>leg.forEach((joint,j)=>
      record(joint,'quaternion',legStart[i][j].clone().slerp(stance.legAngles[i][j],settle))));
    joints[0].forEach((joint,i)=>record(joint,'quaternion',beginning[0][i].clone().slerp(ready[0][i],settle)));
    joints[1].forEach((joint,i)=>record(joint,'quaternion',beginning[1][i].clone().slerp(ready[1][i],settle).slerp(angles[i],working)));
    times.push(time);
  }
  const tracks=Array.from(channels,([name,values])=>name.endsWith('.position')
    ? new THREE.VectorKeyframeTrack(name,times,values) : new THREE.QuaternionKeyframeTrack(name,times,values));
  if(cuff)tracks.push(new THREE.NumberKeyframeTrack(cuff.uuid+'.morphTargetInfluences[cuffRoll]',[0,.42,finishAt],[cuffStart,0,0]));
  const clip=new THREE.AnimationClip('Restock sushi with right hand',finishAt,tracks);
  animateJacket(clip,chef,arms);
  return clip;
}

export function createChefRestock(chef,{mixer,table,ready},idles,conveyor,onReplace){
  const {arms,stance}=chef.userData.sculptRuntime;
  const right=arms.find(arm=>arm.side===-1);
  const rightJoints=armJoints(right);
  const staging=v(-4,-2.96,-7.76);
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(3.15,.14,3.60),table.children[0].material);
  shelf.name='Recessed pickup shelf below the front conveyor';
  shelf.position.copy(table.worldToLocal(staging.clone().add(v(0,-.07,0))));
  shelf.castShadow=shelf.receiveShadow=true;
  table.add(shelf);
  const waiting=new Map();
  let service;

  function begin(slot,path,clip){
    const carried=conveyor.replacementFor(slot);
    carried.name='Chef replacement serving';
    carried.visible=false;
    carried.userData.chefCarried=true;
    carried.position.copy(path.sample(0));
    carried.rotation.y=0;
    slot.parent.add(carried);
    mixer.stopAllAction();
    const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.play();
    mixer.update(0);
    service={slot,path,clip,carried,time:0};
  }

  function tryNext(speed){
    if(waiting.size===0)return false;
    // Serve the downstream gaps first while their positions are still within reach.
    for(const [slot,previousX] of [...waiting].sort(([a],[b])=>a.position.x-b.position.x)){
      if(slot.visible || !isFrontDish(slot) || slot.position.x<serviceLeft){
        waiting.delete(slot);
        continue;
      }
      // A gap approaching from the right stays reserved until the chef can reach it.
      const landingX=slot.position.x-setDownAt*speed;
      if(landingX<serviceLeft || landingX>serviceRight || Math.abs(landingX-previousX)<.12)continue;
      const landing=conveyor.futurePosition(slot,setDownAt*speed);
      const path=pathToBelt(staging,landing,speed);
      const clip=restockClip(chef,arms,ready,path,slot.scale.x,landing.x);
      if(!clip){
        waiting.set(slot,landingX);
        continue;
      }
      waiting.delete(slot);
      if(Math.random()>=restockChance)continue;
      begin(slot,path,clip);
      return true;
    }
    return false;
  }

  function update(dt,speed,canStart){
    if(!service)return canStart && tryNext(speed);
    const {slot,path,clip,carried}=service;
    service.time+=dt;
    mixer.update(dt);
    if(service.time>=setDownAt && carried.parent){
      if(conveyor.putDish(slot,carried))onReplace(slot);
      carried.removeFromParent();
    }
    const pose=path.sample(service.time,slot.position.x);
    if(carried.parent){
      // Stock is loaded into the recess. Reveal the covered plate only as the hand lifts it.
      carried.visible=service.time>=gripAt;
      carried.position.copy(pose);
    }
    // The guest can pause or speed up the belt once the camera is back at the seat.
    if(service.time>=lineUpAt && service.time<releaseAt && Math.abs(slot.position.x-path.predictedX(service.time))>.004){
      const {angles}=rightArmPose(chef,stance,right,stance.hips.position,stance.chest.quaternion,pose,slot.scale.x,service.time);
      rightJoints.forEach((joint,i)=>joint.quaternion.copy(ready[1][i]).slerp(angles[i],reachWeight(service.time)));
    }
    if(service.time>=clip.duration){
      mixer.uncacheClip(clip);
      service=null;
      idles.next();
      mixer.update(0);
    }
    return true;
  }

  return {
    get busy(){return Boolean(service);},
    schedule(slot){waiting.set(slot,Infinity);},
    reserves(slot){return waiting.has(slot) || service?.slot===slot;},
    update,
  };
}
