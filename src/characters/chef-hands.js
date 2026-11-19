import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { pixelsPerMeter } from './chef-shape.ts';

// Coordinates are measured from the wrist. X runs from thumb to little finger,
// Y runs toward the fingertips and positive Z points out through the knuckles.
const digits = [
  ['Thumb',  [[-10,12,-3],[-22,23,-7],[-29,33,-9],[-33,42,-12]], [8.4,6.6,5.1,3.9]],
  ['Index',  [[-14,40,1],[-16,59,0],[-17,70,-2],[-17,79,-4]], [6.4,5.2,4.4,3.4]],
  ['Middle', [[-3,43,2],[-3,64,1],[-3,76,-1],[-3,86,-4]], [6.6,5.4,4.6,3.6]],
  ['Ring',   [[8,42,1],[9,61,0],[10,73,-2],[10,81,-5]], [6.2,5,4.2,3.3]],
  ['Little', [[17,38,-1],[21,53,-2],[23,62,-4],[24,70,-7]], [5.4,4.4,3.7,3]],
];

const local = (v, side) => new THREE.Vector3(side * v[0], -v[1], v[2]).divideScalar(pixelsPerMeter);
const smooth = THREE.MathUtils.smoothstep;
function union(a, b, radius) {
  const h = Math.max(radius - Math.abs(a - b), 0) / radius;
  return Math.min(a, b) - h * h * radius * .25;
}

function ellipsoid(x, y, z, rx, ry, rz) {
  const a = Math.hypot(x/rx, y/ry, z/rz);
  const b = Math.hypot(x/(rx*rx), y/(ry*ry), z/(rz*rz));
  return b > .0001 ? a*(a-1)/b : -Math.min(rx, ry, rz);
}

export function makeDigits(arm) {
  return digits.map(([name, points, radii]) => {
    let parent = arm.wristBone;
    const bones = [], segments = [];
    points.slice(0, 3).forEach((p, i) => {
      const joint = new THREE.Bone();
      const labels = name === 'Thumb' ? ['CMC','MCP','IP'] : ['MCP','PIP','DIP'];
      joint.name = 'Chef' + (arm.side === 1 ? 'L' : 'R') + name + labels[i];
      joint.position.copy(local(p, arm.side));
      if (i > 0) joint.position.sub(local(points[i-1], arm.side));
      parent.add(joint);
      parent = joint;
      bones.push(joint);
      const [dx,dy,dz] = points[i+1].map((value, j) => value - p[j]);
      const length = Math.hypot(dx,dy,dz);
      segments.push({p, dx, dy, dz, length, r: radii[i], taper: radii[i+1] - radii[i]});
    });
    return {name, points, bones, segments, tip:local(points[3],arm.side)};
  });
}

function nearestSegment(x,y,z, digit) {
  let distance = Infinity, along = 0;
  digit.segments.forEach(({p,dx,dy,dz,length,r,taper}, i) => {
    const vx=x-p[0], vy=y-p[1], vz=z-p[2];
    const t=THREE.MathUtils.clamp((vx*dx + vy*dy + vz*dz)/(length*length), 0, 1);
    const d=Math.hypot(vx-dx*t,vy-dy*t,vz-dz*t) - r - taper*t;
    if (d < distance) { distance=d; along=i+t; }
  });
  return { distance, along };
}

function skinDistance(x,y,z, chains) {
  // The heel of the palm overlaps the forearm. Separate pads blend into a
  // single surface through the thumb web and interdigital webs.
  let d=ellipsoid(x, y-22, z, 21.9, 27, 11.6);
  d=union(d, ellipsoid(x+1.4,y-1,z,14.2,16,14.7), 4);
  d=union(d, ellipsoid(x+10,y-24,z+5,12,18,9), 4);
  for (const chain of chains) d=union(d, nearestSegment(x,y,z,chain).distance, y<48 ? 4 : 1.35);
  return d;
}

function paintWeights(x,y,z,arm,skeleton) {
  const wrist=skeleton.bones.indexOf(arm.wristBone);
  const lower=skeleton.bones.indexOf(arm.rollBone);
  // The wrist uses the same blend as the adjoining forearm.
  const w=smooth(529+y+.32*x,503,551);
  const weights = new Map([[lower,1-w],[wrist,w]]);
  const digitWeights=[];
  for (const digit of arm.digits) {
    const {distance,along}=nearestSegment(x,y,z,digit);
    const seg=digit.segments[0];
    const baseProjection=((x-seg.p[0])*seg.dx+(y-seg.p[1])*seg.dy+(z-seg.p[2])*seg.dz)/seg.length;
    const influence=smooth(baseProjection,-5,5) * (1-smooth(distance,0,6.5));
    if (influence > 0) digitWeights.push({digit,along,influence});
  }
  const total=digitWeights.reduce((a,b)=>a+b.influence,0);
  const share=Math.min(total,1)*w;
  weights.set(wrist,w-share);
  for (const {digit,along,influence} of digitWeights) {
    const weight=share*influence/total;
    const index=skeleton.bones.indexOf(digit.bones[0]);
    const p=smooth(along,.76,1.23), d=smooth(along,1.72,2.28);
    weights.set(index,weight*(1-p));
    weights.set(index+1,weight*(p-d));
    weights.set(index+2,weight*d);
  }
  const top=[...weights].filter(entry=>entry[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const sum=top.reduce((a,b)=>a+b[1],0);
  while (top.length<4) top.push([wrist,0]);
  return [top.map(e=>e[0]),top.map(e=>e[1]/sum)];
}

export function buildHandSurface(old, arm, skeleton) {
  const resolution=36, extent=60, centerY=36;
  const volume=new MarchingCubes(resolution,old.material,false,false,12000);
  volume.isolation=0;
  const coordinate = i => (2*i/resolution-1)*extent;
  for (let k=0;k<resolution;k++) for (let j=0;j<resolution;j++) for (let i=0;i<resolution;i++) {
    volume.setCell(i,j,k,-skinDistance(coordinate(i)*arm.side, centerY-coordinate(j), coordinate(k), arm.digits));
  }
  volume.update();
  const raw=new THREE.BufferGeometry();
  const positions=[], normals=[], uv=[], ids=[], weights=[];
  const normal=new THREE.Vector3();
  for (let i=0;i<volume.count;i++) {
    const off=3*i, p=volume.positionArray;
    const x=p[off]*extent, y=centerY-p[off+1]*extent, z=p[off+2]*extent;
    positions.push(x/pixelsPerMeter,-y/pixelsPerMeter,z/pixelsPerMeter);
    normals.push(...normal.fromArray(volume.normalArray,off).normalize().toArray());
    uv.push(.5 + .18*x*arm.side/32, .89 - .78*THREE.MathUtils.clamp((y+8)/98,0,1));
    const [indices,values]=paintWeights(x*arm.side,y,z,arm,skeleton);
    ids.push(...indices); weights.push(...values);
  }
  raw.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  raw.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  raw.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  raw.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
  raw.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const hand=new THREE.SkinnedMesh(mergeVertices(raw,1e-6),old.material);
  hand.material.flatShading=false;
  hand.name=old.name;
  hand.userData=old.userData;
  hand.position.copy(arm.wrist).sub(old.parent.getWorldPosition(new THREE.Vector3()));
  old.parent.add(hand);
  hand.updateMatrixWorld(true);
  hand.bind(skeleton,hand.matrixWorld);
  hand.castShadow=old.castShadow;
  hand.frustumCulled=false;
  old.removeFromParent();
  old.geometry.dispose(); raw.dispose(); volume.geometry.dispose();
  return hand;
}

export function digitPose(arm, hold, press) {
  const r=THREE.MathUtils.degToRad;
  const support=arm.side===1;
  return arm.digits.map(({name},i)=>{
    if (name==='Thumb') {
      const oppose=new THREE.Quaternion().setFromEuler(new THREE.Euler(
        r(13+14*hold),arm.side*r(15+13*hold),arm.side*r(8+14*hold),'ZYX'));
      const hinge=new THREE.Vector3(.50,0,arm.side*.86).normalize();
      return [oppose,...[16+17*hold,10+16*hold].map(a=>new THREE.Quaternion().setFromAxisAngle(hinge,r(a)))];
    }
    const outer=i-1;
    const curl=support ? [23,34,19] : [9+3*outer,15+5*outer,10+3*outer];
    const pressFinger=!support && i<=2 ? press : 0;
    return curl.map((a,j)=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),
      r(8+2*outer+a*hold+[12,14,7][j]*pressFinger)));
  });
}

// The contact landmark follows the articulated pads, including distal flexion.
export function fingerPad(arm,poses,index) {
  const digit=arm.digits[index];
  const tip=digit.tip.clone().sub(local(digit.points[2],arm.side));
  for (let i=2;i>=0;i--) tip.applyQuaternion(poses[index][i]).add(digit.bones[i].position);
  return tip;
}

// Keep the other fingers curled while the thumb closes across the index pad.
export function pinchDigits(arm,fingers,strength) {
  const axis=new THREE.Vector3(1,0,0);
  for(let d=1;d<fingers.length;d++) {
    const angles=d===1 ? [44,67,39] : [53,79,48];
    angles.forEach((degrees,j)=>fingers[d][j].slerp(
      new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees)),strength));
  }
  const index=fingerPad(arm,fingers,1);
  const thumbBase=arm.digits[0].bones[0].position;
  const target=index.clone().add(new THREE.Vector3(-8*arm.side,4,0).divideScalar(pixelsPerMeter));
  const adjustment=new THREE.Quaternion().setFromUnitVectors(
    fingerPad(arm,fingers,0).sub(thumbBase).normalize(),target.sub(thumbBase).normalize());
  fingers[0][0].premultiply(new THREE.Quaternion().slerp(adjustment,strength));
  return index.lerp(fingerPad(arm,fingers,0),.5);
}
