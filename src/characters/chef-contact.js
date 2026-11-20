import * as THREE from 'three';
import { animateJacket, armJoints } from './chef-animation.js';
import { frame, solveWrist } from './chef-arm-pose.js';
import { digitPose, fingerPad } from './chef-hands.js';
import { sampleStance } from './chef-stance.js';

export const pickupTime=.87;
export const offerTime=2.46;
const endTime=offerTime+1.40;
const ease=THREE.MathUtils.smootherstep;
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const wristPath=new THREE.CatmullRomCurve3([
  v(3.19,-1.04,-6.96),
  v(3.36,2.51,-6.71),
  v(3.24,5.86,-4.99),
  v(3.00,6.46,-2.47),
  v(2.56,5.55,.48),
]);
const pickupWrist=wristPath.points[0];
const offeredWrist=wristPath.points.at(-1);
const reachUnder=new THREE.QuadraticBezierCurve3(v(3.82,2.59,-5.47),v(3.81,.45,-6.70),pickupWrist);
// Keep the opening fingers above the covers until the wrist is behind the belt.
const retractWrist=new THREE.CatmullRomCurve3([
  offeredWrist,
  v(3.05,6.65,-2.39),
  v(3.30,5.74,-5.44),
  v(3.49,3.13,-6.02),
]);
const faceDown=v(0,-1,0);
const pickupKnuckles=v(.88,-.42,-.13);
const offeredKnuckles=v(.96,.27,-.08);
const offeredFingers=v(.0064,.3588,-.9334);
const thumbHinge=v(.50,0,.86).normalize();
const fingerHinge=v(1,0,0);
const fingerSpread=v(0,0,1);
const bend=(axis,angle)=>new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(angle));

function cardPinch(arm) {
  const fingers=digitPose(arm,.27,0);
  // Cross the thumb over the upper corner and tuck the index behind the stock.
  fingers[0][0].setFromEuler(new THREE.Euler(.3135,.3058,.2145,'ZYX'));
  fingers[0][1]=bend(thumbHinge,30);
  const flexion=[[48,87,24],[38,63,29],[37,60,31],[40,62,34]];
  flexion.forEach((finger,i)=>{fingers[i+1]=finger.map(angle=>bend(fingerHinge,angle));});
  [0,4,8].forEach((angle,i)=>{fingers[i+2][0].premultiply(bend(fingerSpread,angle));});
  // Aim each curl behind the paper without shifting its fingertip contact.
  [-50,-39].forEach((angle,i)=>{
    const finger=i+1;
    const axis=fingerPad(arm,fingers,finger).sub(arm.digits[finger].bones[0].position).normalize();
    fingers[finger][0].premultiply(bend(axis,angle));
  });
  return fingers;
}

export function createChefContact(chef,{mixer},idles,cardGrip) {
  const {arms,stance:rig,meshes}=chef.userData.sculptRuntime;
  const [left,right]=arms;
  const joints=armJoints(left);
  const freeJoints=armJoints(right);
  const legs=rig.legs.flatMap(({thigh,shin,foot})=>[thigh,shin,foot]);
  const cuff=meshes.find(mesh=>mesh.morphTargetDictionary?.cuffRoll!==undefined);
  const scale=chef.getWorldScale(new THREE.Vector3()).x;

  const grip=cardPinch(left);
  const open=digitPose(left,.12,0);
  const resting=digitPose(right,.10,0).flat();
  const thumb=fingerPad(left,grip,0), index=fingerPad(left,grip,1);
  const socket=thumb.clone().lerp(index,.53);
  const wristBasis=frame(offeredFingers,offeredKnuckles);
  const cardInWrist=wristBasis.invert().multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-.44,-.26,-.15,'YXZ')));
  const cardPoint=new THREE.Vector3(), gripOffset=new THREE.Vector3(), cardRotation=new THREE.Quaternion();
  let clip,time,released,resumeIdle;

  function placeCard(card) {
    const wrist=left.wristBone;
    wrist.getWorldQuaternion(cardRotation).multiply(cardInWrist);
    wrist.localToWorld(cardPoint.copy(socket));
    card.position.copy(cardPoint).sub(gripOffset.copy(cardGrip).applyQuaternion(cardRotation));
    card.parent.worldToLocal(card.position);
    card.parent.getWorldQuaternion(card.quaternion).invert().multiply(cardRotation);
  }

  function start() {
    const moving=[rig.chest,rig.neck,...legs,...joints,...freeJoints];
    const initial=moving.map(node=>node.quaternion.clone());
    const hipStart=rig.hips.position.clone();
    const cuffStart=cuff?.morphTargetInfluences[cuff.morphTargetDictionary.cuffRoll]??0;
    const steps=Math.ceil(endTime*40);
    const times=Array.from({length:steps+1},(_,i)=>i*endTime/steps);
    times.push(pickupTime,offerTime);
    times.sort((a,b)=>a-b);
    const poses=moving.map(()=>[]);
    const positions=[];

    for(const t of times) {
      const bendDown=ease(t,.04,.75)*(1-ease(t,.90,1.68));
      const leanIn=ease(t,1.38,offerTime)*(1-ease(t,offerTime+.18,endTime));
      const back=ease(t,offerTime+.10,endTime-.25);
      const settle=ease(t,0,.46);
      const resume=ease(t,endTime-.42,endTime);
      const stance=sampleStance(rig,(2.99*bendDown+.35*leanIn)/scale,
        .089*bendDown+.095*leanIn,.19*bendDown+.045*leanIn,(.42*bendDown+.20*leanIn)/scale,
        {setback:(.25*bendDown+.52*leanIn)/scale});
      const hips=hipStart.clone().lerp(stance.pos,settle).lerp(hipStart,resume);
      const chest=initial[0].clone().slerp(stance.chest,settle*(1-resume));
      const neck=stance.neck.multiply(bend(v(0,1,0),-7*bendDown-3*leanIn));
      const inverseChest=chest.clone().invert();
      const toChest=position=>chef.worldToLocal(position.clone()).sub(hips).applyQuaternion(inverseChest).add(rig.rest);
      const lift=THREE.MathUtils.smoothstep(t,pickupTime,offerTime);
      const overBelt=ease(t,1.66,1.96)*(1-ease(t,2.29,offerTime))
        +ease(t,offerTime+.075,offerTime+.26)*(1-ease(t,endTime-.56,endTime-.23));
      const faceGuest=ease(t,1.43,offerTime)*(1-ease(t,offerTime+.16,endTime-.09));
      const wrist=t<pickupTime ? reachUnder.getPoint(ease(t,.12,pickupTime))
        : t<=offerTime ? wristPath.getPoint(lift) : retractWrist.getPoint(back);
      const elbowGuide=v(.46,-.89,-.15+.30*bendDown).lerp(v(.15,-.89,-.15),faceGuest);
      elbowGuide.addScaledVector(v(.48,.37,0),overBelt);
      const down=faceDown.clone().applyQuaternion(inverseChest);
      const facing=pickupKnuckles.clone().lerp(offeredKnuckles,faceGuest).applyQuaternion(inverseChest);
      const handAngles=solveWrist(left,toChest(wrist),elbowGuide,forearm=>{
        const fingers=forearm.clone().normalize();
        const downward=down.clone().addScaledVector(fingers,-down.dot(fingers));
        fingers.addScaledVector(downward,.31-.08*bendDown+.16*faceGuest).normalize();
        return frame(fingers.negate(),facing);
      });
      const closes=ease(t,.64,pickupTime)*(1-ease(t,offerTime+.04,offerTime+.29));
      const digits=open.map((finger,i)=>finger.map((q,j)=>q.clone().slerp(grip[i][j],closes)));

      // The free arm hangs next to the apron, following the dip at the knees.
      const restingWrist=v(-3.26,-.30-2.30*bendDown,-7.52-.28*bendDown);
      const restingKnuckles=v(-.97,.10,.22).applyQuaternion(inverseChest);
      const restingAngles=solveWrist(right,toChest(restingWrist),v(-.40,-.76,-.40),lower=>{
        return frame(lower.clone().negate(),restingKnuckles);
      });
      const armPose=[...handAngles,...digits.flat()];
      const freePose=[...restingAngles,...resting];
      const pose=[chest,neck,...stance.legAngles.flat(),...armPose,...freePose];
      const armStart=2+legs.length;
      const reachForCard=THREE.MathUtils.smoothstep(t,.015,.85)*(1-resume);
      const freeWeight=ease(t,.08,.79)*(1-resume);
      positions.push(...hips.toArray());
      pose.forEach((value,i)=>{
        const amount=i<armStart ? settle*(1-resume) : i<armStart+joints.length ? reachForCard : freeWeight;
        poses[i].push(...(i===0 ? value : initial[i].clone().slerp(value,amount)).toArray());
      });
    }
    const tracks=moving.map((node,i)=>new THREE.QuaternionKeyframeTrack(node.name+'.quaternion',times,poses[i]));
    tracks.push(new THREE.VectorKeyframeTrack(rig.hips.name+'.position',times,positions));
    if(cuff)tracks.push(new THREE.NumberKeyframeTrack(cuff.uuid+'.morphTargetInfluences[cuffRoll]',
      [0,.46,offerTime,endTime],[cuffStart,0,0,cuffStart]));
    clip=new THREE.AnimationClip('Reach over the counter with a card',endTime,tracks);
    animateJacket(clip,chef,arms);
    resumeIdle=idles.suspend();
    const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.play();
    mixer.update(0);
    time=0;
    released=false;
  }

  return {
    start,placeCard,
    release(){released=true;},
    get active(){return Boolean(clip);},
    update(dt){
      if(!clip || !released && time>=offerTime)return false;
      const next=Math.min(time+dt,released ? endTime : offerTime);
      mixer.update(next-time);
      time=next;
      if(released && time>=endTime){
        mixer.uncacheClip(clip);
        resumeIdle();
        clip=null;
      }
      return true;
    },
  };
}
