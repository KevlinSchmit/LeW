import * as THREE from 'three';
import { solveArm } from './chef-arm-pose.js';
import { makeFishStation } from './fish-prep.js';
import { makeSlicingClip } from './chef-slicing.js';
import { makeAdjustingClip } from './chef-adjusting.js';
import { makeCleaningClip } from './chef-cleaning.js';
import { rigStance } from './chef-stance.js';
import { makeDigits, buildHandSurface, digitPose, fingerPad } from './chef-hands.js';
import { floorY, pixelsPerMeter } from './chef-shape.ts';

const point = (x, y, z) => new THREE.Vector3(x, floorY - y, z).divideScalar(pixelsPerMeter);
const smooth = THREE.MathUtils.smoothstep;
const forward = new THREE.Vector3(0, 0, 1);
const cycle = 7.2;

function bone(name, parent, offset) {
  const joint = new THREE.Bone();
  joint.name = name;
  joint.position.copy(offset);
  parent.add(joint);
  return joint;
}

function createArm(spine, side, spinePosition) {
  const suffix = side === 1 ? 'L' : 'R';
  const shoulder = point(side * 91, 243, 0);
  const elbow = point(side * 149, 386, 2);
  const wrist = point(side * 203, 529, 11);
  const upper = elbow.clone().sub(shoulder);
  const lower = wrist.clone().sub(elbow);
  const upperBone = bone('ChefShoulder' + suffix, spine, shoulder.clone().sub(spinePosition));
  const elbowBone = bone('ChefElbow' + suffix, upperBone, upper);
  // A halfway rotation through the elbow crease preserves sleeve volume in a deep bend.
  const bendBone = bone('ChefSleeveBend' + suffix, upperBone, upper);
  // The ulna carries the forearm volume. The separate radius/hand driver can
  // turn the palm upward without winding the entire skin tube around it.
  const skinRoll = bone('ChefForearmSkin' + suffix, elbowBone, new THREE.Vector3());
  const rollBone = bone('ChefPalmRoll' + suffix, elbowBone, new THREE.Vector3());
  const wristBone = bone('ChefWrist' + suffix, rollBone, lower);
  const arm = { side, shoulder, wrist, upper, lower, upperBone, elbowBone, bendBone, skinRoll, rollBone, wristBone };
  arm.digits = makeDigits(arm);
  return arm;
}

// Both surfaces at each seam sample the same influence field in bind space.
function skinSurface(mesh, skeleton, arms) {
  const geometry = mesh.geometry;
  const id=mesh.userData.componentId;
  const bodyPanel=id==='torso' || id==='collar';
  const sleeve=id.startsWith('sleeve-');
  // Cotton rolls around the elbow over a longer span than skin. A mostly
  // linear weight ramp avoids turning the inside panel back through itself.
  const bendStart=sleeve?304:339,mid=sleeve?377:386,bendEnd=sleeve?430:427;
  function acrossBend(value,start,end) {
    const t=THREE.MathUtils.clamp((value-start)/(end-start),0,1);
    return sleeve?THREE.MathUtils.lerp(t,smooth(t,0,1),.42):smooth(t,0,1);
  }
  const positions = geometry.getAttribute('position');
  const indices = [], weights = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    const x = Math.abs(p.x) * pixelsPerMeter;
    const y = floorY - p.y * pixelsPerMeter;
    const arm = arms[p.x > 0 ? 0 : 1];
    const upper = skeleton.bones.indexOf(arm.upperBone);
    let a, b, t;
    const elbow=y+.38*(x-149);
    if (bodyPanel || (sleeve ? elbow<bendStart : y<325)) {
      // Keep the medial shoulder sewn into the jacket while the deltoid turns.
      a = 0; b = upper;
      t = smooth(x, 71, 118) * smooth(y + .42 * (x - 90), 224, 294);
      if (bodyPanel) {
        t *= 1 - smooth(y, 270, 330);
      } else {
        t = THREE.MathUtils.lerp(t, 1, smooth(y,sleeve?273:280,sleeve?302:325));
      }
    } else {
      if (elbow < mid) {
        a = upper; b = upper + 1; t = acrossBend(elbow,bendStart,mid);
      } else if (elbow < bendEnd) {
        a = upper + 1; b = upper + 2; t = acrossBend(elbow,mid,bendEnd);
      } else {
        a = skeleton.bones.indexOf(arm.elbowBone);
        b = skeleton.bones.indexOf(arm.skinRoll);
        // Every vertex of a cross-section gets the same roll weight. The last
        // circular rings nest inside the independently articulated palm heel.
        const station = 1 - geometry.attributes.uv.getY(i);
        t = mesh.userData.componentId.startsWith('forearm-') ? smooth(station, .20, .96) : 0;
      }
    }
    indices.push(a, b, 0, 0);
    weights.push(1 - t, t, 0, 0);
  }
  return bindSurface(mesh,skeleton,indices,weights);
}

function bindSurface(mesh,skeleton,indices,weights) {
  const geometry=mesh.geometry;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const surface = new THREE.SkinnedMesh(geometry, mesh.material);
  surface.name = mesh.name;
  surface.userData = mesh.userData;
  surface.castShadow = mesh.castShadow;
  surface.receiveShadow = mesh.receiveShadow;
  mesh.parent.add(surface);
  surface.bind(skeleton, mesh.matrixWorld);
  // The bind-pose mesh bounds don't contain the moving hands.
  surface.frustumCulled = false;
  mesh.removeFromParent();
  return surface;
}

// The head nods at the upper neck. Pin the base of the throat inside the
// collar, while its upper rings follow the same nod as the jaw.
function bindNeck(mesh,spine){
  const driver=bone('ChefUpperNeck',mesh.parent,new THREE.Vector3());
  mesh.parent.updateWorldMatrix(true,true);
  const skeleton=new THREE.Skeleton([spine,driver]);
  const position=mesh.geometry.getAttribute('position'),p=new THREE.Vector3();
  const joints=[],weights=[];
  for(let i=0;i<position.count;i++){
    p.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
    const w=1-smooth(floorY-p.y*pixelsPerMeter,169,199);
    joints.push(0,1,0,0);weights.push(1-w,w,0,0);
  }
  return bindSurface(mesh,skeleton,joints,weights);
}

export function rigChef(chef) {
  const torso = chef.getObjectByName('torso');
  const spine = bone('ChefSpine', torso, new THREE.Vector3());
  const arms = [1, -1].map(side => createArm(spine, side, torso.position));
  chef.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([spine, ...arms.flatMap(a =>
    [a.upperBone, a.bendBone, a.elbowBone, a.skinRoll, a.rollBone, a.wristBone]), ...arms.flatMap(a => a.digits.flatMap(d => d.bones))]);
  const meshes = chef.userData.sculptRuntime.meshes;
  for (let i = 0; i < meshes.length; i++) {
    const id = meshes[i].userData.componentId;
    if(id==='neck'){
      meshes[i]=bindNeck(meshes[i],spine);
    }else if (id.startsWith('hand-')) {
      meshes[i] = buildHandSurface(meshes[i], arms[id === 'hand-l' ? 0 : 1], skeleton);
    } else if (/^(torso$|collar$|sleeve-|forearm-)/.test(id)) {
      meshes[i] = skinSurface(meshes[i], skeleton, arms);
    }
  }
  chef.userData.sculptRuntime.stance = rigStance(chef);
  return arms;
}

function sample(time, arms, restFood) {
  const close = smooth(time,.20,1.46)*(1-smooth(time,5.82,6.98));
  const lift = smooth(time,1.52,2.78)*(1-smooth(time,4.58,5.76));
  const press = smooth(time,2.86,3.25)*(1-smooth(time,3.28,3.64))
    + .74*smooth(time,3.76,4.06)*(1-smooth(time,4.10,4.46));
  const food = restFood.clone().add(new THREE.Vector3(-2*lift,9*lift,-2*lift).divideScalar(pixelsPerMeter));
  const rotation = new THREE.Quaternion().setFromAxisAngle(forward,.07*lift-.06*press);
  const poses = arms.map(arm => {
    const support = arm.side === 1;
    const grip = support ? .35+.12*lift : 1;
    const openGrip = support ? .64 : .82;
    const fingers = digitPose(arm, grip*THREE.MathUtils.lerp(openGrip,1,close), press);
    const closed = digitPose(arm,grip,press);
    const pad = fingerPad(arm,closed,1).lerp(fingerPad(arm,closed,2), .5);
    const contact = new THREE.Vector3(support ? 17 : -4, support ? 5.5 : 8, -1);
    contact.divideScalar(pixelsPerMeter).applyQuaternion(rotation).add(food);
    // The supporting hand waits near the rice. The working hand settles back
    // over the board after the second press, without reaching out to the side.
    const palm = support ? new THREE.Vector3(-.93,1.1,.80) : new THREE.Vector3(-.25,-1,-.70+.12*press);
    palm.applyQuaternion(rotation);
    const pitch = THREE.MathUtils.degToRad(support ? 0 : -8+6*press);
    return [...solveArm(arm,contact,pad,pitch,palm,(1-close)*(support ? 1 : .38)), ...fingers.flat()];
  });
  return { food, rotation, poses };
}

function armJoints(a) {
  return [a.upperBone,a.bendBone,a.elbowBone,a.skinRoll,a.rollBone,a.wristBone,...a.digits.flatMap(d=>d.bones)];
}

function makeClip(arms, nigiri, restFood) {
  const times = [], locations = [], rotations = [];
  const bones = arms.flatMap(armJoints);
  const values = bones.map(() => []);
  const steps = Math.round(cycle * 30);
  for (let i = 0; i <= steps; i++) {
    const time = i * cycle / steps;
    const { food, rotation, poses } = sample(time, arms, restFood);
    times.push(time);
    locations.push(...food.toArray());
    rotations.push(...rotation.toArray());
    poses.flat().forEach((q, k) => values[k].push(...q.toArray()));
  }
  return new THREE.AnimationClip('Shape and serve nigiri', cycle, [
    ...bones.map((joint, i) => new THREE.QuaternionKeyframeTrack(joint.name + '.quaternion', times, values[i])),
    new THREE.VectorKeyframeTrack(nigiri.name + '.position', times, locations),
    new THREE.QuaternionKeyframeTrack(nigiri.name + '.quaternion', times, rotations),
  ]);
}

// Bake fabric controls from the solved joints, so all clips use the same
// sleeve response while the cutter and supporting hand move independently.
function animateJacket(clip,chef,arms) {
  const surfaces=chef.userData.sculptRuntime.meshes;
  const garment=id=>surfaces.find(mesh=>mesh.userData.componentId===id);
  const panels=[garment('torso'),garment('collar')];
  const rotate=new THREE.Quaternion(), direction=new THREE.Vector3();
  const trackFor=bone=>clip.tracks.find(track=>track.name===bone.name+'.quaternion');
  function drive(surface,shape,times,values) {
    if(surface?.morphTargetDictionary?.[shape]===undefined)return;
    clip.tracks.push(new THREE.NumberKeyframeTrack(
      surface.uuid+'.morphTargetInfluences['+shape+']',times,values));
  }
  for(const arm of arms){
    const elbow=trackFor(arm.elbowBone),shoulder=trackFor(arm.upperBone);
    const folds=[],draw=[],upper=arm.upper.clone().normalize(),lower=arm.lower.clone().normalize();
    for(let i=0;i<elbow.times.length;i++){
      rotate.fromArray(elbow.values,i*4);
      const bend=upper.angleTo(direction.copy(lower).applyQuaternion(rotate));
      const compression=smooth(bend,Math.PI*.10,Math.PI*.62);
      folds.push(compression);
      rotate.fromArray(shoulder.values,i*4);
      const lift=upper.angleTo(direction.copy(upper).applyQuaternion(rotate));
      draw.push(.78*smooth(lift,.07,1.27)+.22*compression);
    }
    const left=arm.side===1;
    drive(garment(left?'sleeve-l':'sleeve-r'),'elbowFold',elbow.times,folds);
    for(const panel of panels)drive(panel,left?'leftDraw':'rightDraw',shoulder.times,draw);
  }
  const chest=trackFor(chef.userData.sculptRuntime.stance.chest);
  if(chest){
    const lean=Array.from(chest.times,(_,i)=>{
      rotate.fromArray(chest.values,i*4);
      return smooth(Math.acos(THREE.MathUtils.clamp(direction.set(0,1,0).applyQuaternion(rotate).y,-1,1)),.04,.30);
    });
    for(const panel of panels)drive(panel,'waistFold',chest.times,lean);
  }
}

export function startChefAnimation(chef, arms, salmonPlate) {
  const nigiri = new THREE.Group();
  nigiri.name = 'NigiriInHands';
  const food = new THREE.Group();
  // Reuse the restaurant's painted salmon and rice meshes, excluding the cloche and dish.
  for (const piece of salmonPlate.children) {
    if (/curved_fish_fillet|Pearl_rice/i.test(piece.name) || /curved fish fillet|Pearl rice/i.test(piece.name)) {
      food.add(piece.clone());
    }
  }
  if (food.children.length !== 2) throw new Error('The salmon serving needs both rice and fish');
  const bounds = new THREE.Box3().setFromObject(food, true);
  const scale = 50 / (pixelsPerMeter * (bounds.max.x - bounds.min.x));
  food.scale.setScalar(scale);
  food.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
  nigiri.add(food);
  chef.add(nigiri);

  // The worktop belongs to the room. Its rear edge clears the coat and its
  // front edge stops short of the conveyor. Target its actual surface.
  const table = new THREE.Group();
  table.name = 'Chef prep table';
  table.position.set(0,.32,-4.00);
  const wood = new THREE.MeshStandardMaterial({color:0x97643e,roughness:.86});
  function plank(x,y,z,w,h,d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wood);
    mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true;
    table.add(mesh);
  }
  plank(0,-.05,0,5.4,.10,1.04);
  const postTop=-.10,postBase=chef.position.y-table.position.y;
  for (const x of [-2.56,2.56]) for (const z of [-.44,.44])
    plank(x,(postTop+postBase)/2,z,.12,postTop-postBase,.12);
  chef.parent.add(table);
  const foodHeight = bounds.getSize(new THREE.Vector3()).y * scale;
  const restFood = chef.worldToLocal(table.localToWorld(new THREE.Vector3(0,0,.18)));
  restFood.y += foodHeight/2;
  nigiri.position.copy(restFood);
  const clip = makeClip(arms,nigiri,restFood);
  const mixer = new THREE.AnimationMixer(chef);
  const station=makeFishStation(chef,table);
  const ready=sample(0,arms,restFood).poses;
  const slicing=makeSlicingClip(chef,arms,station,nigiri,restFood,ready,armJoints);
  const cleaning=makeCleaningClip(chef,arms,station.stage,ready,armJoints);
  const adjusting=makeAdjustingClip(chef,arms,station.stage,ready,armJoints);
  for(const take of [clip,slicing,cleaning,adjusting]) animateJacket(take,chef,arms);
  chef.animations.push(clip,slicing,cleaning,adjusting);
  mixer.clipAction(clip).play();
  mixer.update(0);
  return mixer;
}

// Play each recipe once per bag. Avoid an immediate repeat across bag boundaries.
export function cycleChefIdles(mixer, clips, random=Math.random) {
  let queue=[...clips], active, remaining;
  mixer.stopAllAction();
  function next() {
    if (!queue.length) {
      queue=[...clips];
      for (let i=queue.length-1;i>0;i--) {
        const j=Math.floor(random()*(i+1));
        [queue[i],queue[j]]=[queue[j],queue[i]];
      }
      if (queue.length>1 && queue[0]===active.getClip()) [queue[0],queue[1]]=[queue[1],queue[0]];
    }
    active?.stop();
    const clip=queue.shift();
    active=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);
    active.clampWhenFinished=true;
    active.play();
    remaining=clip.duration;
  }
  next();
  return seconds=>{
    while(seconds>=remaining) {
      mixer.update(remaining);
      seconds-=remaining;
      next();
    }
    mixer.update(seconds);
    remaining-=seconds;
  };
}
