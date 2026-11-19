import * as THREE from 'three';
import { frame, solveGrip } from './chef-arm-pose.js';
import { digitPose, pinchDigits } from './chef-hands.js';
import { sampleStance } from './chef-stance.js';
import { pixelsPerMeter } from './chef-shape.ts';

const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const ease=THREE.MathUtils.smoothstep;
const duration=6.8;
const fingerFrame=frame(v(0,-1,0),v(0,0,-1)).invert();
const fromFingers=(axis,normal)=>frame(axis,normal).multiply(fingerFrame);
const cuffGrip=fromFingers(v(.78,-.035,-.63),v(.16,-1,.10));

function blend(from,to,weight) {
  return from.map((q,i)=>q.clone().slerp(to[i],weight));
}

export function makeAdjustingClip(chef,arms,stage,ready,armJoints) {
  const rig=chef.userData.sculptRuntime.stance;
  const [left,right]=arms;
  const sleeve=chef.userData.sculptRuntime.meshes.find(m=>m.userData.componentId==='sleeve-l');
  const sash=chef.getObjectByName('sash surface');
  const sashWidth=sash.geometry.userData.grid.longitude;
  const {longitude,latitude}=sleeve.geometry.userData.grid;
  const cuffVertex=latitude*(longitude+1)+Math.round(longitude*.50);
  const {elbowFold,cuffRoll}=sleeve.morphTargetDictionary;
  const leftJoints=armJoints(left);
  const scale=stage.scale.x;
  const times=[],channels=new Map(),cuffValues=[];
  function record(node,property,value){
    const name=node.name+'.'+property;
    if(!channels.has(name))channels.set(name,[]);
    channels.get(name).push(...value.toArray());
  }
  for(let i=0;i<=Math.round(duration*30);i++){
    const t=i/30;
    times.push(t);
    const adjusting=ease(t,.23,1.25)*(1-ease(t,2.61,3.49));
    const settle=ease(t,2.80,3.65)*(1-ease(t,4.98,6.36));
    const roll=ease(t,1.76,2.30)*(1-ease(t,2.97,4.68));
    cuffValues.push(roll);
    const stance=sampleStance(rig,(.11*adjusting+.08*settle)*scale,
      .074*adjusting+.030*settle,.122*adjusting+.05*settle,.105*adjusting*scale);
    stance.neck.multiply(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),.16*adjusting));
    const inverseChest=stance.chest.clone().invert();
    const target=p=>stance.toChest(p.clone().multiplyScalar(scale).add(stage.position));
    record(rig.hips,'position',stance.pos);record(rig.chest,'quaternion',stance.chest);
    record(rig.neck,'quaternion',stance.neck);
    rig.legs.forEach((leg,k)=>[leg.thigh,leg.shin,leg.foot].forEach((bone,j)=>
      record(bone,'quaternion',stance.legAngles[k][j])));

    rig.hips.position.copy(stance.pos);
    rig.chest.quaternion.copy(stance.chest);
    sash.updateWorldMatrix(true,false);

    function pat(arm,pose,at) {
      const hit=ease(t,at-.36,at)*(1-ease(t,at+.12,at+.39));
      const brush=ease(t,at,at+.17)*(1-ease(t,at+.17,at+.42));
      const f=digitPose(arm,.08,0);
      const palm=v(0,-24,-11.8).divideScalar(pixelsPerMeter);
      // Place the heel of the palm against the front edge of the sash, then
      // drag it a few centimetres down the cotton as the hand comes away.
      const outward=v(arm.side*.64,0,.77);
      const hand=fromFingers(v(-arm.side*.40,-.84,.33),outward.clone().negate());
      const vertex=7*(sashWidth+1)+Math.round(sashWidth*(.5+.13*arm.side));
      const place=sash.getVertexPosition(vertex,v()).applyMatrix4(sash.matrixWorld);
      const rest=stance.toChest(chef.worldToLocal(place));
      rest.addScaledVector(outward,scale*(.045+.67*(1-hit)));
      rest.y-=scale*.30*brush;
      const patPose=[...solveGrip(arm,rest,palm,inverseChest.clone().multiply(hand)),...f.flat()];
      return blend(pose,patPose,settle);
    }

    const leftFingers=digitPose(left,.34,0);
    // Keep the upper arm down against the body. Raise the forearm only
    // enough to turn the hem towards the reaching hand.
    const hanging=v(.30,-.93,.20).normalize();
    const raised=v(-.62,-.54+.12*roll,.56).normalize();
    const wrist=left.shoulder.clone().addScaledVector(hanging,left.upper.length())
      .addScaledVector(raised,left.lower.length());
    const openHand=fromFingers(v(-.86,-.30,.35),v(.19,.95,.06));
    const supporting=[...solveGrip(left,wrist,v(),openHand,hanging),...leftFingers.flat()];
    const leftPose=pat(left,blend(ready[0],supporting,adjusting),4.02);
    leftJoints.forEach((bone,j)=>record(bone,'quaternion',leftPose[j]));

    // Sample the same skinned hem that is rendered, including the fabric roll.
    // This keeps the pinch on the cuff as the supporting arm moves.
    leftJoints.forEach((bone,j)=>bone.quaternion.copy(leftPose[j]));
    const bend=left.upper.angleTo(left.lower.clone().applyQuaternion(leftPose[2]));
    sleeve.morphTargetInfluences[elbowFold]=ease(bend,Math.PI*.10,Math.PI*.62);
    sleeve.morphTargetInfluences[cuffRoll]=roll;
    chef.updateMatrixWorld(true);
    const hem=chef.worldToLocal(sleeve.getVertexPosition(cuffVertex,v()).applyMatrix4(sleeve.matrixWorld));

    const pinch=ease(t,1.34,1.72)*(1-ease(t,2.29,2.61));
    const reach=ease(t,.54,1.64)*(1-ease(t,2.32,3.17));
    const fingers=digitPose(right,.21,0);
    const pad=pinchDigits(right,fingers,pinch);
    const travel=target(v(.08,2.82,-.40)).lerp(stance.toChest(hem),reach);
    // Clear the front of the jacket on the way to and from the opposite sleeve.
    travel.addScaledVector(v(0,.18,.50),scale*Math.sin(Math.PI*reach));
    const grasp=[...solveGrip(right,travel,pad,inverseChest.clone().multiply(cuffGrip),v(-.18,-.88,.84)),...fingers.flat()];
    const rightPose=pat(right,blend(ready[1],grasp,
      ease(t,.42,1.02)*(1-ease(t,2.76,3.63))),4.64);
    armJoints(right).forEach((bone,j)=>record(bone,'quaternion',rightPose[j]));
  }
  // Return the rig to bind before the live mixer is started.
  rig.hips.position.copy(rig.rest);
  rig.chest.quaternion.identity();
  leftJoints.forEach(bone=>bone.quaternion.identity());
  sleeve.morphTargetInfluences[elbowFold]=0;
  sleeve.morphTargetInfluences[cuffRoll]=0;
  chef.updateMatrixWorld(true);
  const tracks=Array.from(channels,([name,values])=>name.endsWith('.position')
    ? new THREE.VectorKeyframeTrack(name,times,values) : new THREE.QuaternionKeyframeTrack(name,times,values));
  tracks.push(new THREE.NumberKeyframeTrack(sleeve.uuid+'.morphTargetInfluences[cuffRoll]',times,cuffValues));
  return new THREE.AnimationClip('Adjust Sleeves and Brush Sash',duration,tracks);
}
