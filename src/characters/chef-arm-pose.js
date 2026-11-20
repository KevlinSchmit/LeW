import * as THREE from 'three';
const identity = new THREE.Quaternion();
const down = new THREE.Vector3(0,-1,0);
const forward = new THREE.Vector3(0,0,1);
const palmNormal = new THREE.Vector3(0,0,-1);

// Match a longitudinal axis and a facing direction without adding any stretch.
export function frame(axis, facing) {
  const y = axis.clone().normalize();
  const x = new THREE.Vector3().crossVectors(y, facing).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export function solveArm(arm, target, pad, wristPitch, palmFacing, release) {
  // Treat the wrist and posed finger pads as the end of the forearm for the
  // reach solve. That keeps the wrist near neutral even as the fingers curl.
  const neutralWrist = new THREE.Quaternion().setFromUnitVectors(down, arm.lower.clone().normalize());
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), wristPitch);
  const wristRotation = neutralWrist.multiply(pitch);
  const lowerToPad = arm.lower.clone().add(pad.clone().applyQuaternion(wristRotation));
  const axis = target.clone().sub(arm.shoulder);
  const distance = axis.length();
  axis.divideScalar(distance);
  const upperLengthSq = arm.upper.lengthSq();
  const along = (upperLengthSq - lowerToPad.lengthSq() + distance**2)/(2*distance);
  const radius = Math.sqrt(Math.max(0, upperLengthSq - along**2));
  // Of the possible elbow positions, use the one nearest a freely hanging arm.
  const pole = new THREE.Vector3(arm.side * .12, -1, arm.side === 1 ? .25 : .245);
  pole.addScaledVector(axis, -pole.dot(axis)).normalize();
  const upper = axis.clone().multiplyScalar(along).addScaledVector(pole, radius);
  const elbowToPad = target.clone().sub(arm.shoulder).sub(upper);
  const forearmWorld = frame(elbowToPad, palmFacing).multiply(
    frame(lowerToPad, palmNormal.clone().applyQuaternion(wristRotation)).invert());
  const lower = arm.lower.clone().applyQuaternion(forearmWorld);

  // Orient the humerus to the bend plane. Elbow flexion and axial forearm
  // rotation are separate transforms so turning the palm cannot crank the sleeve.
  const shoulder = frame(upper, lower).multiply(frame(arm.upper, forward).invert());
  const clearBoard = new THREE.Vector3(arm.side*.09, arm.side===1 ? .23 : .17, -.045);
  const readyDirection = lower.clone().normalize().addScaledVector(clearBoard,release).normalize();
  const clear = new THREE.Quaternion().setFromUnitVectors(lower.clone().normalize(),readyDirection);
  forearmWorld.premultiply(clear);
  const lowerInShoulder = readyDirection.applyQuaternion(shoulder.clone().invert());
  const flex = new THREE.Quaternion().setFromUnitVectors(arm.lower.clone().normalize(), lowerInShoulder);
  const roll = shoulder.clone().multiply(flex).invert().multiply(forearmWorld);
  const skinRotation = identity.clone().slerp(roll, .16);
  return [shoulder, identity.clone().slerp(flex,.5), flex, skinRotation, roll, wristRotation];
}

// Constrain a chosen point inside the grip to the tool handle throughout a draw.
export function solveGrip(arm, target, socket, hand, elbowGuide) {
  return solveWrist(arm,target.clone().sub(socket.clone().applyQuaternion(hand)),elbowGuide,()=>hand,false);
}

// Solve the elbow first so a hand can follow the actual forearm direction.
export function solveWrist(arm,target,elbowGuide,orientHand,limitReach=true) {
  const axis=target.clone().sub(arm.shoulder);
  const requested=axis.length();
  const d=limitReach ? THREE.MathUtils.clamp(requested,Math.abs(arm.upper.length()-arm.lower.length())+.001,
    (arm.upper.length()+arm.lower.length())*.976) : requested;
  axis.divideScalar(requested);
  const along=(arm.upper.lengthSq()-arm.lower.lengthSq()+d*d)/(2*d);
  const pole=elbowGuide?.clone() ?? new THREE.Vector3(arm.side*.23,-1,.16);
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const upper=axis.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,arm.upper.lengthSq()-along*along)));
  const lower=axis.clone().multiplyScalar(d).sub(upper);
  const hand=orientHand(lower);
  const shoulder=frame(upper,lower).multiply(frame(arm.upper,forward).invert());
  const flex=new THREE.Quaternion().setFromUnitVectors(arm.lower.clone().normalize(),lower.clone().applyQuaternion(shoulder.clone().invert()).normalize());
  const elbowWorld=shoulder.clone().multiply(flex);
  // Project the palm normal onto the perpendicular plane of the forearm.
  const forearm=frame(lower,palmNormal.clone().applyQuaternion(hand)).multiply(frame(arm.lower,palmNormal).invert());
  const roll=elbowWorld.invert().multiply(forearm);
  const wristRot=forearm.clone().invert().multiply(hand);
  return [shoulder,identity.clone().slerp(flex,.5),flex,identity.clone().slerp(roll,.16),roll,wristRot];
}

export function solveTrayGrip(arm,target,pad,wristPitch,turn,elbowGuide){
  const shaft=arm.lower.clone().normalize();
  const wrist=new THREE.Quaternion().setFromUnitVectors(down,shaft)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),wristPitch));
  const pronation=new THREE.Quaternion().setFromAxisAngle(shaft,turn);
  // Treat the wrist and finger pad as part of the forearm for the reach solve.
  const forearmTip=arm.lower.clone().add(pad.clone().applyQuaternion(wrist)).applyQuaternion(pronation);
  const axis=target.clone().sub(arm.shoulder);
  const requested=axis.length(), upperLength=arm.upper.length(), lowerLength=forearmTip.length();
  axis.divideScalar(requested);
  const near=Math.abs(upperLength-lowerLength)+.001;
  const far=(upperLength+lowerLength)*.984;
  const distance=THREE.MathUtils.clamp(requested,near,far);
  const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
  const pole=elbowGuide.clone();
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  const upper=axis.clone().multiplyScalar(along)
    .addScaledVector(pole,Math.sqrt(Math.max(0,upperLength**2-along**2)));
  const elbowToPad=axis.multiplyScalar(distance).sub(upper);
  // Use the elbow's bend plane as the roll reference through the entire lift.
  const forearm=frame(elbowToPad,upper.clone().negate()).multiply(frame(forearmTip,forward).invert());
  const lower=arm.lower.clone().applyQuaternion(forearm);
  const shoulder=frame(upper,lower).multiply(frame(arm.upper,forward).invert());
  const flex=new THREE.Quaternion().setFromUnitVectors(shaft,lower.clone().applyQuaternion(shoulder.clone().invert()).normalize());
  const elbow=shoulder.clone().multiply(flex);
  const roll=elbow.invert().multiply(forearm);
  return {
    angles:[shoulder,identity.clone().slerp(flex,.5),flex,
      new THREE.Quaternion().setFromAxisAngle(shaft,turn*.16),
      roll.multiply(pronation),wrist],
    outside:Math.abs(requested-distance)>.00001,
  };
}
