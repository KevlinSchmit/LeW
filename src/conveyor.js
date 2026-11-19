import * as THREE from 'three';

const originalSpan = 25;
export const straightSpan = 75;
const quarterTurn = 7.5;
const sideRun = 10;
const radius = 2 * quarterTurn / Math.PI;
export const conveyorHalfWidth = straightSpan / 2 + radius + 1.26;
const halfLoop = straightSpan + 2*quarterTurn + sideRun;
const length = 2 * halfLoop;
const frontZ = -2.05;
const nearCenter = frontZ-radius;
const farCenter = nearCenter-sideRun;
const rearZ = farCenter-radius;
const centerZ = (frontZ+rearZ)/2;
const half = straightSpan / 2;
const tilePitch = .5;
const dishPitch = 5;

export function isFrontDish(dish) {
  return Math.abs(dish.position.z-frontZ)<.02 && Math.abs(dish.rotation.y)<.03;
}

// Arc length is shared by the plates and slats, including both tangent joins.
function sample(distance, pose) {
  const progress = THREE.MathUtils.euclideanModulo(distance,length);
  const returning = progress >= halfLoop;
  const s = returning ? progress-halfLoop : progress;
  let x, z, angle, curved=false;
  if (s < straightSpan) {
    x=s-half; z=frontZ; angle=0;
  } else if (s >= straightSpan+quarterTurn && s < straightSpan+quarterTurn+sideRun) {
    x=half+radius; z=nearCenter-(s-straightSpan-quarterTurn); angle=Math.PI/2;
  } else {
    curved=true;
    const near = s < straightSpan+quarterTurn;
    angle = near ? (s-straightSpan)/radius : Math.PI/2+(s-straightSpan-quarterTurn-sideRun)/radius;
    x=half+radius*Math.sin(angle);
    z=(near ? nearCenter : farCenter)+radius*Math.cos(angle);
  }
  pose.position.set(returning ? -x : x,0,returning ? 2*centerZ-z : z);
  pose.rotation.y=returning ? angle+Math.PI : angle;
  return curved;
}

export function installConveyor(model, dishes) {
  const front = model.children.find(o=>o.name.startsWith('CONVEYOR'));
  const slats = front.children.filter(o=>o.name.startsWith('Belt_tile'));
  const tile = slats[0];
  for (const slat of slats) slat.removeFromParent();
  front.scale.x *= straightSpan / originalSpan;
  const rear = front.clone(true);
  rear.name = 'Rear conveyor';
  rear.rotation.y = Math.PI;
  rear.position.z = 2*centerZ;
  model.add(rear);

  const endRails = new THREE.Group();
  endRails.name = 'Conveyor returns';
  model.add(endRails);
  const steel = front.children.find(o=>o.material.name.includes('steel')).material;
  const black = front.children.find(o=>o.material.name.includes('Blackened')).material;
  const oak = front.children.find(o=>o.material.name.includes('walnut')).material;
  function arcStrip(offset, depth, bottom, height, material) {
    const inner = radius+offset-depth/2, outer = inner+depth;
    const points = [[inner,bottom],[outer,bottom],[outer,bottom+height],[inner,bottom+height],[inner,bottom]];
    const corner = new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),32,0,Math.PI/2);
    const straightSide = new THREE.BoxGeometry(depth,height,sideRun);
    function piece(geometry,x,y,z,angle=0) {
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,y,z);
      mesh.rotation.y=angle;
      mesh.castShadow=mesh.receiveShadow=true;
      endRails.add(mesh);
    }
    piece(corner, half,0,nearCenter);
    piece(corner, half,0,farCenter,Math.PI/2);
    piece(corner,-half,0,farCenter,Math.PI);
    piece(corner,-half,0,nearCenter,3*Math.PI/2);
    for (const side of [-1,1]) piece(straightSide,side*(half+radius+offset),bottom+height/2,centerZ);
  }
  // Cross-sections follow the profiles of the straight Blender rail meshes.
  arcStrip(-.07,2.13,-1.14,2.64,oak);
  const baseGeometry=new THREE.BoxGeometry(straightSpan,2.64,2.13);
  for (const z of [frontZ-.07,rearZ+.07]) {
    const base=new THREE.Mesh(baseGeometry,oak);
    base.name='Conveyor straight support';
    base.position.set(0,.18,z);
    base.castShadow=base.receiveShadow=true;
    model.add(base);
  }
  arcStrip(-.07,2.45,1.49,.22,black);
  arcStrip(.97,.28,.01,1.62,steel);
  arcStrip(1.14,.06,1.4925,.075,black);
  arcStrip(1.17,.18,-.01,.18,oak);
  arcStrip(1.10,.18,1.675,.11,steel);
  arcStrip(-1.13,.13,1.68,.14,steel);

  // Bend one copy of a slat into a wedge. Its two long edges stay parallel
  // to the curved rails. Both families are drawn in just two calls.
  const bent = tile.geometry.clone();
  const verts = bent.attributes.position, normals = bent.attributes.normal;
  for (let i=0;i<verts.count;i++) {
    const angle=verts.getX(i)/radius, r=radius+verts.getZ(i);
    const c=Math.cos(angle), s=Math.sin(angle), nx=normals.getX(i), nz=normals.getZ(i);
    verts.setXYZ(i,r*s,verts.getY(i),r*c-radius);
    normals.setXYZ(i,c*nx+s*nz,normals.getY(i),-s*nx+c*nz);
  }
  const tileCount = length / tilePitch;
  const batches = [tile.geometry,bent].map((geometry,index)=>{
    const mesh = new THREE.InstancedMesh(geometry,tile.material,tileCount);
    mesh.name = index ? 'Belt curved tiles' : 'Belt straight tiles';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;
    mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  });
  const recipes = dishes.slice();
  for (let i=recipes.length;i<length/dishPitch;i++) {
    const dish = recipes[i%recipes.length].clone(true);
    dish.name += '_'+i;
    model.add(dish);
    dishes.push(dish);
  }
  const dishY = dishes[0].position.y;
  dishes.forEach(dish=>dish.scale.setScalar(1.13));
  const pose = new THREE.Object3D();
  const pending = new Map();
  const view = new THREE.Frustum(), projection = new THREE.Matrix4(), bounds = new THREE.Box3();
  function setView(frustum, camera) {
    camera.updateWorldMatrix(true, false);
    return frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  }
  function takeDish(dish, camera) {
    pending.set(dish, setView(new THREE.Frustum(),camera));
    dish.visible = false;
  }
  function refill(camera) {
    if (pending.size === 0) return false;
    setView(view,camera);
    let changed = false;
    for (const [dish,pickupView] of pending) {
      bounds.setFromObject(dish).expandByScalar(.45);
      if (pickupView.intersectsBox(bounds) || view.intersectsBox(bounds)) continue;
      dish.visible = true;
      pending.delete(dish);
      changed = true;
    }
    return changed;
  }
  function update(travel) {
    const counts = [0,0];
    for (let i=0;i<tileCount;i++) {
      const batch = Number(sample((i+.5)*tilePitch-travel,pose));
      pose.position.y=tile.position.y;
      pose.updateMatrix();
      batches[batch].setMatrixAt(counts[batch]++,pose.matrix);
    }
    batches.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;});
    dishes.forEach((dish,i)=>{
      sample(half-6.65+i*dishPitch-travel,pose);
      dish.position.copy(pose.position);
      dish.position.y=dishY;
      dish.rotation.y=pose.rotation.y;
    });
  }
  update(0);
  const isSurface=object=>object===front || object===rear || object===endRails || batches.includes(object);
  return {update,takeDish,refill,isSurface};
}
