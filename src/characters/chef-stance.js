import * as THREE from 'three';
import { floorY, pixelsPerMeter } from './chef-shape.ts';

const point = (x,y,z)=>new THREE.Vector3(x,floorY-y,z).divideScalar(pixelsPerMeter);
const axisX = new THREE.Vector3(1,0,0);
const turn = a=>new THREE.Quaternion().setFromAxisAngle(axisX,a);

function pivot(name, parent, position) {
  const node=new THREE.Bone();
  node.name=name;
  node.position.copy(position);
  parent.add(node);
  return node;
}

// Build at the original bind pose. The coat, sleeves and hand skeleton move
// together above the hips. Each shoe has an independent, fixed ankle target.
export function rigStance(chef) {
  const rest=point(0,520,0);
  const hips=pivot('ChefPelvis',chef,rest);
  const chest=pivot('ChefChest',hips,new THREE.Vector3());
  for(const id of ['torso','sash','trousers']) {
    const node=chef.getObjectByName(id);
    node.position.sub(rest);
    (id==='trousers' ? hips : chest).add(node);
  }
  const legs=[1,-1].map(side=>{
    const tag=side===1 ? 'L' : 'R', suffix=tag.toLowerCase();
    const hip=point(side*45,525,-5), knee=point(side*68,750,-3), ankle=point(side*86,970,-10);
    const upper=knee.clone().sub(hip), lower=ankle.clone().sub(knee);
    const thigh=pivot('ChefHip'+tag,hips,hip.clone().sub(rest));
    const shin=pivot('ChefKnee'+tag,thigh,upper);
    const foot=pivot('ChefAnkle'+tag,shin,lower);
    chef.updateMatrixWorld(true);
    const skeleton=new THREE.Skeleton([hips,thigh,shin,foot]);
    const meshes=chef.userData.sculptRuntime.meshes;
    for(const id of ['leg-'+suffix,'shoe-'+suffix]) {
      const i=meshes.findIndex(m=>m.userData.componentId===id);
      const old=meshes[i],geo=old.geometry, pos=geo.attributes.position;
      const ids=[],weights=[],p=new THREE.Vector3();
      for(let k=0;k<pos.count;k++) {
        p.fromBufferAttribute(pos,k).applyMatrix4(old.matrixWorld);
        const y=floorY-p.y*pixelsPerMeter;
        const a=id.startsWith('shoe') ? 3 : y<580 ? 0 : y<888 ? 1 : 2;
        const blend=a===0 ? THREE.MathUtils.smoothstep(y,525,578) : a===1
          ? THREE.MathUtils.smoothstep(y,711,792) : a===2 ? THREE.MathUtils.smoothstep(y,929,970) : 0;
        ids.push(a,Math.min(a+1,3),0,0); weights.push(1-blend,blend,0,0);
      }
      geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
      geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
      const mesh=new THREE.SkinnedMesh(geo,old.material);
      mesh.name=old.name;mesh.userData=old.userData;mesh.castShadow=true;mesh.frustumCulled=false;
      old.parent.add(mesh);mesh.bind(skeleton,old.matrixWorld);
      old.removeFromParent();meshes[i]=mesh;
    }
    return {hip,knee,ankle,upper,lower,thigh,shin,foot};
  });
  return {rest,hips,chest,neck:chef.getObjectByName('neck'),legs};
}

export function sampleStance(rig, depth, lean, gaze, shift, {feet,setback=0}={}) {
  const offset=new THREE.Vector3(shift,-depth,-.61*depth+setback);
  const pos=rig.rest.clone().add(offset);
  const chest=turn(lean);
  const legAngles=rig.legs.map(({hip,upper,lower,ankle},index)=>{
    const toAnkle=ankle.clone().sub(hip).sub(offset);
    if(feet)toAnkle.add(feet[index]);
    const d=toAnkle.length(), axis=toAnkle.divideScalar(d);
    const along=(d*d+upper.lengthSq()-lower.lengthSq())/(2*d);
    // The bind-plane knee points forward. Project it onto the current reach
    // plane so the knee cannot reverse on the way out of a deep squat.
    const bindAxis=upper.clone().add(lower).normalize();
    const front=upper.clone().addScaledVector(bindAxis,-upper.dot(bindAxis)).normalize();
    // Let each knee open toward its own foot as the hips sit back.
    front.x+=Math.sign(hip.x)*.64*THREE.MathUtils.smoothstep(depth,0,.16);
    front.addScaledVector(axis,-front.dot(axis)).normalize();
    const toKnee=axis.clone().multiplyScalar(along).addScaledVector(front,Math.sqrt(Math.max(0,upper.lengthSq()-along*along)));
    const toFoot=axis.clone().multiplyScalar(d).sub(toKnee);
    const thigh=new THREE.Quaternion().setFromUnitVectors(upper.clone().normalize(),toKnee.normalize());
    const lowerWorld=new THREE.Quaternion().setFromUnitVectors(lower.clone().normalize(),toFoot.normalize());
    return [thigh,thigh.clone().invert().multiply(lowerWorld),lowerWorld.invert()];
  });
  return {pos,chest,neck:turn(gaze),legAngles,
    // Board-space hand goals must compensate for the motion of the ribcage.
    toChest(p){return p.clone().sub(pos).applyQuaternion(chest.clone().invert()).add(rig.rest);}};
}
