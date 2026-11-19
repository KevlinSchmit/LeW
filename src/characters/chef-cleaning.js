import * as THREE from 'three';
import { frame, solveArm, solveGrip } from './chef-arm-pose.js';
import { digitPose, fingerPad, pinchDigits } from './chef-hands.js';
import { sampleStance } from './chef-stance.js';
import { pixelsPerMeter } from './chef-shape.ts';

const v = (x,y,z) => new THREE.Vector3(x,y,z);
const ease = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const duration = 8.6;
const home = v(2.13,0,.015);
const firstContact = v(1.18,0,-.075);
const fingerFrame = frame(v(0,-1,0),v(0,0,-1)).invert();

// A folded cotton cloth. Both shapes share the hems and bottom surface, so the
// corners can droop when lifted and the pile can flatten against the wood.
function clothPoint(u,w,top,gather,press) {
  const corner = Math.abs(u*w)**5;
  const middle = Math.exp(-2.1*(u*u+w*w));
  const fold = .014*Math.cos(Math.PI*(w+.13*u)) + .012*Math.sin(3.8*u+.75*w);
  const y = (top ? .125+fold : 0) + gather*(.19*middle-.11*(1-middle))
    - (top ? .064*press*middle : 0);
  return v(.515*u*(1-.10*corner-.15*gather) + .009*Math.sin(2.8*w), y,
    .343*w*(1-.12*corner-.09*gather) + .012*Math.sin(3.7*u));
}

function foldedCloth(stage) {
  const cols=36, rows=18, pos=[], gathered=[], pressed=[], colors=[], indices=[];
  const cotton=new THREE.Color(0xe1dcc5), stripe=new THREE.Color(0x788e8c);
  for (const top of [true,false]) {
    for (let j=0;j<=rows;j++) for (let i=0;i<=cols;i++) {
      const u=2*i/cols-1, w=2*j/rows-1;
      pos.push(...clothPoint(u,w,top,0,0).toArray());
      gathered.push(...clothPoint(u,w,top,1,0).toArray());
      pressed.push(...clothPoint(u,w,top,0,1).toArray());
      const yarn=(i===3 || i===6) ? stripe : cotton;
      colors.push(...yarn.clone().multiplyScalar((top ? 1 : .74)*(.97+.03*Math.cos(i*2.2+j*1.8))).toArray());
    }
  }
  const stride=cols+1, layer=stride*(rows+1);
  function quad(a,b,c,d) { indices.push(a,b,c,a,c,d); }
  for (let j=0;j<rows;j++) for(let i=0;i<cols;i++) {
    const a=j*stride+i, b=a+1, c=b+stride, d=a+stride;
    quad(a,d,c,b); quad(layer+a,layer+b,layer+c,layer+d);
  }
  const rim=[];
  for(let i=0;i<=cols;i++) rim.push(i);
  for(let j=1;j<=rows;j++) rim.push(j*stride+cols);
  for(let i=cols-1;i>=0;i--) rim.push(rows*stride+i);
  for(let j=rows-1;j>0;j--) rim.push(j*stride);
  rim.forEach((a,i)=>{const b=rim[(i+1)%rim.length];quad(a,b,b+layer,a+layer);});
  const geo=new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  geo.morphAttributes.position=[gathered,pressed].map((data,i)=>{
    const attribute=new THREE.Float32BufferAttribute(data,3);
    attribute.name=i===0 ? 'gather' : 'pressure';
    return attribute;
  });
  const cloth=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  cloth.name='CounterWashcloth';
  cloth.position.copy(home);
  cloth.castShadow=cloth.receiveShadow=true;
  stage.add(cloth);
  return cloth;
}

// Four short, slightly diagonal passes. A push takes a little more time under
// load than its return. The cloth stays down even as the pressure eases.
const wipes=[
  [2.20,2.87,3.32,2.12,1.18,.055,-.045],
  [3.32,3.92,4.38,2.04,1.12,.090,-.005],
  [4.38,5.08,5.57,2.17,1.26,.065,-.085],
  [5.57,6.14,6.61,2.06,1.32,.010,-.06],
];
function clothMotion(t) {
  const lift=ease(t,1.03,1.35)*(1-ease(t,1.75,2.10))
    + ease(t,6.81,7.09)*(1-ease(t,7.43,7.76));
  const p=home.clone().lerp(firstContact,ease(t,1.25,1.88));
  let effort=0;
  for (const [start,far,end,outer,inner,zFar,zNear] of wipes) {
    const push=ease(t,start,far), pull=ease(t,far,end);
    p.x=lerp(lerp(p.x,outer,push),inner,pull);
    p.z=lerp(lerp(p.z,zFar,push),zNear,pull);
    effort+=ease(t,start-.04,start+.24)*(1-ease(t,far-.09,far+.21));
  }
  p.lerp(home,ease(t,6.99,7.55));
  p.y=.50*lift;
  const contact=ease(t,1.99,2.23)*(1-ease(t,6.56,6.82));
  return {p,lift,contact,effort,pressure:contact*(.30+.70*effort)};
}

export function makeCleaningClip(chef,arms,stage,ready,armJoints) {
  const cloth=foldedCloth(stage), rig=chef.userData.sculptRuntime.stance;
  const times=[], tracks=new Map(), gatherValues=[], pressureValues=[];
  const scale=stage.scale.x;
  function record(node,key,value) {
    const name=node.name+'.'+key;
    if(!tracks.has(name)) tracks.set(name,[]);
    tracks.get(name).push(...value.toArray());
  }
  for(let i=0;i<=Math.round(duration*30);i++) {
    const t=i/30, {p,lift,contact,effort,pressure}=clothMotion(t);
    times.push(t);
    record(cloth,'position',p);
    gatherValues.push(lift);pressureValues.push(pressure);
    const reaching=ease(t,.10,.92)*(1-ease(t,7.86,8.52));
    const stance=sampleStance(rig,(.18*reaching+.12*contact+.045*effort)*scale,
      .085*reaching+.085*contact+.032*effort,.11*reaching,
      (.08*reaching+contact*(.07+.21*(p.x-firstContact.x)))*scale);
    record(rig.hips,'position',stance.pos);record(rig.chest,'quaternion',stance.chest);
    record(rig.neck,'quaternion',stance.neck);
    rig.legs.forEach((leg,k)=>[leg.thigh,leg.shin,leg.foot].forEach((bone,j)=>
      record(bone,'quaternion',stance.legAngles[k][j])));
    const boardTarget=q=>stance.toChest(q.clone().multiplyScalar(scale).add(stage.position));
    const invChest=stance.chest.clone().invert();
    for(const [k,arm] of arms.entries()) {
      let pose,weight;
      if(arm.side===1) {
        const grip=ease(t,.62,1.03)*(1-ease(t,7.77,8.13));
        const fingers=digitPose(arm,.18+.79*grip,0);
        // Soften and spread the fingers as the bunched cloth meets the table.
        for(let d=0;d<fingers.length;d++) for(const joint of fingers[d]) {
          joint.slerp(new THREE.Quaternion(),contact*(d===0 ? .63 : .78));
        }
        const pinch=grip*(1-ease(t,1.65,2.18)+ease(t,6.48,6.86));
        const pinched=pinchDigits(arm,fingers,pinch);
        const tip=fingerPad(arm,fingers,1).lerp(fingerPad(arm,fingers,2),.5).lerp(pinched,pinch);
        const hand=frame(v(-.51,-.29-.13*lift,.81),v(0,-1,0)).multiply(fingerFrame);
        // The thumb and fingertips gather the upper fold for the lift; the pads
        // bear on the same patch through every reversal on the work surface.
        const q=tip.clone().applyQuaternion(hand);
        const bottom=Math.min(...fingers.map((_,d)=>{
          const end=arm.digits[d].segments[2];
          return fingerPad(arm,fingers,d).applyQuaternion(hand).y-(end.r+end.taper)/pixelsPerMeter;
        }));
        const goal=p.clone();
        goal.y+=clothPoint(0,0,true,lift,pressure).y+(q.y-bottom)/scale-.027*pinch;
        goal.y+=.65*(1-ease(t,.33,.87))+.55*ease(t,7.88,8.25);
        pose=[...solveGrip(arm,boardTarget(goal),tip,invChest.clone().multiply(hand)),...fingers.flat()];
        weight=ease(t,0,.87)*(1-ease(t,7.82,duration));
      } else {
        // The free hand rests just behind the near edge of the board.
        const fingers=digitPose(arm,.54,0);
        const pad=fingerPad(arm,fingers,2);
        const goal=v(-1.55,.87,-.56);
        pose=[...solveArm(arm,boardTarget(goal),pad,-.07,v(.39,-.70,-.55),0),...fingers.flat()];
        weight=ease(t,.03,.92)*(1-ease(t,7.80,8.55));
      }
      armJoints(arm).forEach((bone,j)=>
        record(bone,'quaternion',ready[k][j].clone().slerp(pose[j],weight)));
    }
  }
  const channels=Array.from(tracks,([name,values])=>name.endsWith('.position')
    ? new THREE.VectorKeyframeTrack(name,times,values) : new THREE.QuaternionKeyframeTrack(name,times,values));
  channels.push(new THREE.NumberKeyframeTrack(cloth.name+'.morphTargetInfluences[gather]',times,gatherValues),
    new THREE.NumberKeyframeTrack(cloth.name+'.morphTargetInfluences[pressure]',times,pressureValues));
  return new THREE.AnimationClip('Cleaning Counter',duration,channels);
}
