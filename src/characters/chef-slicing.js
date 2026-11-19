import * as THREE from 'three';
import { frame, solveArm, solveGrip } from './chef-arm-pose.js';
import { fishWell, boardGrip } from './fish-prep.js';
import { sampleStance } from './chef-stance.js';
import { digitPose, fingerPad } from './chef-hands.js';
import { pixelsPerMeter } from './chef-shape.ts';

const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const smooth=THREE.MathUtils.smoothstep;
const ease=(t,a,b)=>smooth(t,a,b);
const lerp=THREE.MathUtils.lerp;
const duration=16.4;
const beats=[5.55,6.80,8.05];
const axis=v(1,0,0);
const trayHome=v(0,fishWell.boardY,fishWell.z);
const knifeHome=v(-2.25,.30,-1.66);
const handSocket=v(1,-36,-11).divideScalar(pixelsPerMeter);
const palmDown=v(-.25,-1,-.64);
const toolToHand=frame(v(0,0,1),v(.643,.766,0)).multiply(frame(v(.883,-.469,0),v(0,0,-1)).invert());

function follow(t,points) {
  let i=0;
  while(i<points.length-2 && t>points[i+1][0])i++;
  const [a,b]=points.slice(i,i+2);
  return a[1].clone().lerp(b[1],ease(t,a[0],b[0]));
}

function knifePose(t,cuts) {
  const restAngle=.015;
  const points=[[0,knifeHome],[4.42,knifeHome],[4.87,v(-1.80,1.16,-.82)]];
  const angles=[[0,v(0,restAngle,0)],[4.42,v(0,restAngle,0)],[4.87,v(-.18,-.16,-.05)]];
  for(const [i,b] of beats.entries()) {
    const x=cuts[i];
    // The keen edge is .215 below the grip. The board top is .076 high.
    // Draw along Z while descending, then lift clear before advancing X.
    for(const [dt,pos,rot] of [
      [0,v(x+.04,.98,-.68),v(-.19,-.055,-.04)],
      [.25,v(x+.035,.64,-.51),v(-.13,-.055,-.025)],
      [.74,v(x+.045,.296,-.95),v(0,-.055,0)],
      [.88,v(x+.045,.296,-.98),v(0,-.055,0)],
      [1.12,v(x+.045,.94,-.82),v(-.17,-.055,-.04)],
    ]) { points.push([b+dt,pos]);angles.push([b+dt,rot]); }
  }
  points.push([9.72,v(-1.80,1.0,-.82)],[10.36,knifeHome],[duration,knifeHome]);
  angles.push([9.72,v(-.14,restAngle,0)],[10.36,v(0,restAngle,0)],[duration,v(0,restAngle,0)]);
  const a=follow(t,angles);
  return {position:follow(t,points),rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(a.x,a.y,a.z,'YXZ'))};
}

function blend(a,b,f) { return a.map((q,i)=>q.clone().slerp(b[i],f)); }
function knifeFingers(arm) {
  const normal=digitPose(arm,1,0);
  return normal.map((joints,i)=>i===0 ? joints : [54+4*i,81+2*i,47].map(deg=>
    new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(deg))));
}

export function makeSlicingClip(chef,arms,station,nigiri,restFood,ready,armJoints) {
  const rig=chef.userData.sculptRuntime.stance;
  const {stage,tray,knife,pieces,cuts}=station;
  const scale=stage.scale.x;
  const fromBoard=p=>p.clone().multiplyScalar(scale).add(stage.position);
  const homeRice=restFood.clone().sub(stage.position).divideScalar(scale);
  const riceAside=homeRice.clone().add(v(-2.21,0,.115));
  const bodyTracks=new Map(),times=[];
  const shafts=arms.map(arm=>arm.lower.clone().normalize());
  const rollAngle=(q,n)=>2*Math.atan2(q.x*n.x+q.y*n.y+q.z*n.z,q.w);
  const lastRoll=ready.map((pose,k)=>rollAngle(pose[3],shafts[k])/.16);
  function record(node,type,value) {
    const name=node.name+'.'+type;
    if(!bodyTracks.has(name))bodyTracks.set(name,[]);
    bodyTracks.get(name).push(...value.toArray());
  }
  tray.position.copy(trayHome);
  const parked=knifePose(0,cuts);
  knife.position.copy(parked.position);knife.quaternion.copy(parked.rotation);
  for(let i=0;i<=duration*30;i++) {
    const t=i/30;
    times.push(t);
    const fetch=ease(t,.46,1.87)*(1-ease(t,2.19,3.48));
    const putBack=ease(t,11.25,12.72)*(1-ease(t,13.10,14.59));
    const working=ease(t,2.55,3.64)*(1-ease(t,10.72,12.02));
    const stroke=beats.reduce((sum,b)=>sum+ease(t,b+.20,b+.72)*(1-ease(t,b+.84,b+1.14)),0);
    const stance=sampleStance(rig,(2.65*(fetch+putBack)+.62*working+.07*stroke)*scale,
      .29*(fetch+putBack)+.145*working+.024*stroke,.19*(fetch+putBack)+.16*working,.12*(fetch+putBack)*scale);
    record(rig.hips,'position',stance.pos);record(rig.chest,'quaternion',stance.chest);
    record(rig.neck,'quaternion',stance.neck);
    rig.legs.forEach((leg,k)=>[leg.thigh,leg.shin,leg.foot].forEach((node,j)=>record(node,'quaternion',stance.legAngles[k][j])));

    const board=follow(t,[[0,trayHome],[2.19,trayHome],[3.48,v(0,.43,fishWell.z)],
      [3.94,v(0,.43,0)],[4.20,v(0,.005,0)],[10.76,v(0,.005,0)],
      [11.06,v(0,.43,0)],[11.53,v(0,.43,fishWell.z)],[12.84,trayHome],[duration,trayHome]]);
    record(tray,'position',board);
    const tool=knifePose(t,cuts);
    record(knife,'position',tool.position);record(knife,'quaternion',tool.rotation);
    const slices=beats.map(b=>ease(t,b+.74,b+1.09));
    // Existing cut pieces move together as the next portion separates.
    // Replenish only once the whole board is back inside the shelf.
    pieces.forEach((p,j)=>{
      const moved=slices.slice(j).reduce((a,b)=>a+b,0)*(1-ease(t,13.55,14.48));
      record(p,'position',v(-.071*moved,0,.059*moved));
    });
    const served=follow(t,[[0,homeRice],[.27,homeRice],[.48,homeRice.clone().add(v(0,.34,0))],
      [.80,riceAside.clone().add(v(0,.34,0))],[.94,riceAside],[14.55,riceAside],
      [14.87,riceAside.clone().add(v(0,.35,0))],[15.65,homeRice.clone().add(v(0,.35,0))],[15.98,homeRice],[duration,homeRice]]);
    record(nigiri,'position',fromBoard(served));
    const target=p=>stance.toChest(fromBoard(p));
    const localFacing=p=>p.clone().applyQuaternion(stance.chest.clone().invert());
    const fingerContact=(arm,goal,facing,hold,expression=0)=>{
      const fingers=digitPose(arm,hold,expression);
      const pad=fingerPad(arm,fingers,1).lerp(fingerPad(arm,fingers,2),.5);
      return [...solveArm(arm,target(goal),pad,0,localFacing(facing),0),...fingers.flat()];
    };
    for(const [k,arm] of arms.entries()) {
      let pose;
      const handle=board.clone().add(v(arm.side*boardGrip.x,boardGrip.y,boardGrip.z));
      const cradle=arm.side===1 ? v(-.80,.47,.74) : v(.96,-.23,-.09);
      const descending=ease(t,.88,1.93)*(1-ease(t,13.04,14.42));
      const behindBench=v(arm.side*1.62,.84,-1.42);
      const reach=behindBench.clone().lerp(handle,descending);
      if(arm.side===1) {
        const hold=ease(t,4.19,4.99)*(1-ease(t,9.80,10.64));
        const over=2.7*hold*(1-hold);
        reach.y+=over;
        const lift=fingerContact(arm,reach,cradle,.76);
        const steady=fingerContact(arm,board.clone().add(v(.47,.425+over,-.035)),v(-.40,-1,-.23),.78,.2);
        pose=blend(lift,steady,hold);
        pose=blend(ready[k],pose,ease(t,.03,.83)*(1-ease(t,14.38,15.36)));
      } else {
        const riceGoal=served.clone().add(v(-.06,.16,0));
        const hand=stance.chest.clone().invert().multiply(tool.rotation).multiply(toolToHand);
        const toolPose=[...solveGrip(arm,target(tool.position),handSocket,hand),...knifeFingers(arm).flat()];
        // Both hands carry the board, then the knife hand moves over to the rack.
        const carrying=ease(t,.83,1.47)*(1-ease(t,13.94,14.76));
        const takeTool=ease(t,3.94,4.42)*(1-ease(t,10.36,10.76));
        reach.y+=2.0*takeTool*(1-takeTool);
        const goal=riceGoal.lerp(reach,carrying);
        // Clear the worktop before the fingertips descend past its rear edge.
        if(t<2 || t>13) goal.z=lerp(served.z,reach.z,ease(carrying,0,.66));
        const turn=ease(t,.82,1.83)*(1-ease(t,13.52,14.8));
        const facing=palmDown.clone().lerp(cradle,turn);
        const lift=fingerContact(arm,goal,facing,lerp(.93,.73,carrying),.20*(1-carrying));
        pose=blend(lift,toolPose,takeTool);
        pose=blend(ready[k],pose,ease(t,0,.41)*(1-ease(t,16.02,duration)));
      }
      // Unwrap palm roll through +/-180 before taking the skin's small share.
      // Two equivalent hand quaternions must never send the skin 58° backward.
      const raw=rollAngle(pose[4],shafts[k]);
      lastRoll[k]=raw+2*Math.PI*Math.round((lastRoll[k]-raw)/(2*Math.PI));
      pose[3].setFromAxisAngle(shafts[k],lastRoll[k]*.16);
      armJoints(arm).forEach((joint,j)=>record(joint,'quaternion',pose[j]));
    }
  }
  const tracks=Array.from(bodyTracks,([name,values])=>name.endsWith('.position')
    ? new THREE.VectorKeyframeTrack(name,times,values)
    : new THREE.QuaternionKeyframeTrack(name,times,values));
  return new THREE.AnimationClip('Slice salmon at the board',duration,tracks);
}
