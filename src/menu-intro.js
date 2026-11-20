import * as THREE from 'three';
import { seeded } from './sushi/paint.js';
import { drawMenuInk, menuInkWidth } from './menu-lettering.js';

const hingeX = -2.275;
const paperCut = .19;
const pageWidth = 4.45;
const pageHeight = 3.43;
const duration = 2.65;
const openingDuration = 1.22;
const pickupDuration = .97;
const initialCover = .62;
const openFront = Math.PI - .068;
const openBack = .060;
const paperWidthPx = 512;
const paperHeightPx = 400;
const firstLeafAngles = [.38, .24, .13];
const { smootherstep, lerp, clamp } = THREE.MathUtils;
const openingCues=[[.24,'page',.56,-.14],[.49,'pageSoft',.46,.13]];
const closingCues=[[.20,'pageSoft',.46,.14],[.47,'page',.40,-.13],[1.34,'bookClose',.63,-.04]];

// The export merges both covers and all trim using the same material. Cut in book space
// so both moving halves retain the original triangles, normals and UVs at the desk.
function splitAt(mesh, height) {
  mesh.updateMatrix();
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  source.applyMatrix4(mesh.matrix);
  const attributes = Object.entries(source.attributes);
  const position = source.attributes.position;
  const vertex = i => attributes.flatMap(([, a]) =>
    Array.from({ length: a.itemSize }, (_, c) => a.getComponent(i, c)));

  const sides = [-1, 1].map(side => {
    const data = attributes.map(() => []);
    for (let i = 0; i < position.count; i += 3) {
      const polygon = [];
      for (let j = 0; j < 3; j++) {
        const a = i + j, b = i + (j + 1) % 3;
        const ay = position.getY(a) - height, by = position.getY(b) - height;
        const aInside = ay * side >= 0, bInside = by * side >= 0;
        const values = (aInside || aInside !== bInside) ? vertex(a) : null;
        if (aInside) polygon.push(values);
        if (aInside !== bInside) {
          const other = vertex(b), ratio = ay / (ay - by);
          polygon.push(values.map((value, n) => THREE.MathUtils.lerp(value, other[n], ratio)));
        }
      }
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const point of [polygon[0], polygon[j], polygon[j + 1]]) {
          let offset = 0;
          attributes.forEach(([, attr], index) => {
            data[index].push(...point.slice(offset, offset + attr.itemSize));
            offset += attr.itemSize;
          });
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    attributes.forEach(([name, attr], index) =>
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(data[index], attr.itemSize)));
    const part = new THREE.Mesh(geometry, mesh.material);
    part.castShadow = mesh.castShadow;
    part.receiveShadow = mesh.receiveShadow;
    return part;
  });
  source.dispose();
  mesh.removeFromParent();
  mesh.geometry.dispose();
  return sides;
}

function paintPaper(left) {
  const canvas = document.createElement('canvas');
  canvas.width = paperWidthPx;
  canvas.height = paperHeightPx;
  const ctx = canvas.getContext('2d');
  const wash = ctx.createLinearGradient(0, 0, canvas.width, 0);
  wash.addColorStop(0, '#aa9168');
  wash.addColorStop(.045, '#cbb99b');
  wash.addColorStop(.18, '#eae3d0');
  wash.addColorStop(.86, '#ebe5d2');
  wash.addColorStop(1, '#d8c9ae');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const random = seeded(left ? 271 : 903);
  for (let i = 0; i < 5100; i++) {
    ctx.fillStyle = i % 3 ? '#8f79571d' : '#fff7d353';
    ctx.fillRect(random()*canvas.width, random()*canvas.height, .3+random()*2.4, .4+random()*.6);
  }
  return canvas;
}

function paperMaterial(canvas, name) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    name, map, roughness: .95, envMapIntensity: .07,
    emissiveMap: map, emissive: 0xc8b18e, emissiveIntensity: .29, side: THREE.DoubleSide,
  });
}

function paperFace(canvas, name) {
  const geometry = new THREE.PlaneGeometry(pageWidth - .025, pageHeight - .024);
  geometry.rotateX(-Math.PI / 2);
  const face = new THREE.Mesh(geometry, paperMaterial(canvas, name));
  face.name = name;
  face.position.y = paperCut;
  face.receiveShadow = true;
  return face;
}

function turningSheet(material, index) {
  const width = pageWidth - .078 - index * .019;
  const start = .069 + index * .006;
  const geometry = new THREE.BoxGeometry(width, .008, pageHeight - .069 - index * .012, 24, 1, 8);
  geometry.translate(start + width / 2, 0, 0);
  const { position, normal } = geometry.attributes;
  const curved = [], curvedNormals = [];
  const n = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const u = (x - start) / width;
    const curl = .66 + .065 * z;
    curved.push(x - .18 * u ** 3, y + curl * u ** 2, z);
    const ny = normal.getY(i);
    n.set((normal.getX(i) - ny * 2 * curl * u / width) / (1 - .54 * u ** 2 / width),
      ny, normal.getZ(i) - ny * .065 * u ** 2).normalize().toArray(curvedNormals, i * 3);
  }
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(curved, 3)];
  geometry.morphAttributes.normal = [new THREE.Float32BufferAttribute(curvedNormals, 3)];
  const sheet = new THREE.Mesh(geometry, material);
  sheet.name = 'Flexible paper sheet ' + (index + 1);
  sheet.position.y = [.022, .003, -.018][index];
  sheet.castShadow = sheet.receiveShadow = true;
  return sheet;
}

function lightBook(book) {
  const light = new THREE.SpotLight(0xfffbef, 102, 9.1, .61, .57, 2);
  light.name = 'Menu warm light from the left';
  light.position.set(-7, 6.0, -3.65);
  light.target.position.set(-2.8, 0, .30);
  light.visible = false;
  light.castShadow = true;
  light.shadow.mapSize.set(768, 768);
  light.shadow.camera.near = .32;
  light.shadow.camera.far = 9.1;
  light.shadow.bias = -.00012;
  light.shadow.normalBias = .012;
  book.add(light, light.target);
  return light;
}

function rigBook(book) {
  const byMaterial = name => book.children.find(part => part.material?.name === name);
  const painted = book.children.find(part => part.name === 'Menu_painted_cover');
  const bound = byMaterial('End-grain & bamboo');
  const [backCover, frontCover] = splitAt(byMaterial('Indigo lacquer'), paperCut);
  const [backPaper, frontPaper] = splitAt(byMaterial('Warm cotton paper'), paperCut);
  const [backEdges, frontEdges] = splitAt(byMaterial('Ivory glazed ceramic'), paperCut);
  backCover.name = 'Original back cover';
  frontCover.name = 'Original front cover';
  backPaper.name = 'Lower paper block';
  frontPaper.name = 'Turning paper block';
  backEdges.name = 'Lower page edges';
  frontEdges.name = 'Turning page edges';
  const hinge = name => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(hingeX, paperCut, 0);
    book.add(pivot);
    return pivot;
  };
  const front = hinge('Front cover hinge');
  const back = hinge('Back cover hinge');
  const leaves = hinge('Turning pages hinge');
  const spine = hinge('Bound spine');
  const blank = paintPaper(false);
  const print = document.createElement('canvas');
  print.width = blank.width;
  print.height = blank.height;
  print.getContext('2d').drawImage(blank, 0, 0);
  const right = paperFace(print, 'Right warm paper leaf');
  const left = paperFace(paintPaper(true), 'Left warm paper leaf');
  const sheets = firstLeafAngles.map((_, i) => {
    const pivot = hinge('Page hinge ' + (i + 1));
    const sheet = turningSheet(left.material, i);
    pivot.add(sheet);
    return { pivot, sheet };
  });
  book.add(frontCover, backCover, backPaper, frontPaper, backEdges, frontEdges, left, right);
  for (const part of [frontCover, painted]) front.attach(part);
  for (const part of [backCover, backPaper, backEdges, right]) back.attach(part);
  for (const part of [frontPaper, frontEdges, left]) leaves.attach(part);
  spine.attach(bound);

  // In the spread the original stitch loops relax into the cloth at the gutter.
  // The zero morph leaves their exact exported closed shape.
  bound.updateMatrix();
  const invBound = bound.matrix.clone().invert();
  const xyz = bound.geometry.attributes.position;
  const relaxed = new Float32Array(xyz.count * 3);
  const point = new THREE.Vector3();
  for (let i = 0; i < xyz.count; i++) {
    point.fromBufferAttribute(xyz, i).applyMatrix4(bound.matrix);
    point.x *= .62;
    point.y = -.033 + point.y * .22;
    point.applyMatrix4(invBound).toArray(relaxed, i * 3);
  }
  bound.geometry.morphAttributes.position = [new THREE.BufferAttribute(relaxed, 3)];
  bound.updateMorphTargets();

  // A narrow, flexible lining fills the fold just inside the original covers.
  const lining = new THREE.Mesh(new THREE.BoxGeometry(.126, .030, 3.40),
    new THREE.MeshStandardMaterial({ color: 0xb6a184, roughness: .91 }));
  lining.name = 'Spine paper lining';
  lining.position.set(0, -.024, 0);
  lining.receiveShadow = true;
  spine.add(lining);

  painted.material = painted.material.clone();
  painted.material.emissiveMap = painted.material.map;
  painted.material.emissive.set(0xffffff);
  painted.material.emissiveIntensity = 0;
  return { front, back, leaves, spine, bound, painted, right, blank, print, sheets, light: lightBook(book) };
}

function numberTrack(node, property, times, values) {
  return new THREE.NumberKeyframeTrack(node.uuid + '.' + property, times, values);
}

function sheetTracks(sheets, times, opening, startingAngles = firstLeafAngles) {
  return sheets.flatMap(({ pivot, sheet }, i) => {
    const delay = opening ? .09 + i * .15 : .065 + (sheets.length - i - 1) * .145;
    const travel = opening ? .71 : .60;
    const progress = times.map(t => smootherstep(t, delay, delay + travel));
    const angles = progress.map(t => opening ? lerp(startingAngles[i], openFront, t) : openFront * (1 - t));
    const bends = progress.map(t => Math.sin(Math.PI * t) * (opening ? .92 : -.78));
    return [
      numberTrack(pivot, 'rotation[z]', times, angles),
      numberTrack(sheet, 'morphTargetInfluences[0]', times, bends),
    ];
  });
}

export function createMenuIntro(book, camera, button, sounds, onReady, onFinish) {
  const desk = { position: book.position.clone(), quaternion: book.quaternion.clone() };
  const { front, back, leaves, spine, bound, painted, right, blank, print, sheets, light } = rigBook(book);
  front.rotation.z = leaves.rotation.z = initialCover;
  back.rotation.z = openBack;
  sheets.forEach(({ pivot }, i) => { pivot.rotation.z = firstLeafAngles[i]; });
  bound.morphTargetInfluences[0] = 1;

  const mixer = new THREE.AnimationMixer(book);
  const center = new THREE.Vector3(hingeX, .23, 0);
  const readingPosition = new THREE.Vector3();
  const readingRotation = new THREE.Quaternion();
  const raisedClosedPosition = new THREE.Vector3();
  const readingLight = light.intensity;
  const facing = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.035, -.065, -.018, 'YXZ'))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const point = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const cameraFromMesh = new THREE.Matrix4();
  const frameLimit = new THREE.Vector2();
  const bookSurfaces = [];
  book.traverse(part => { if (part.isMesh) bookSurfaces.push(part); });
  let action;
  let phase = 'opening';
  let finished = false;
  let label = 'Start Exploring';
  let inkLayout;
  let inkHovered = false;

  function paperToScreen(x, y) {
    right.localToWorld(point.set((x / print.width - .5) * (pageWidth - .025), 0,
      (y / print.height - .5) * (pageHeight - .024)));
    point.project(camera);
    return [(point.x + 1) * innerWidth / 2, (1 - point.y) * innerHeight / 2];
  }

  function paintAction() {
    if (!inkLayout) return;
    const ctx = print.getContext('2d');
    ctx.drawImage(blank, 0, 0);
    const { left, arrowX, lineY, scale } = inkLayout;
    const active = !button.hidden && (inkHovered || button.matches(':focus-visible'));
    ctx.strokeStyle = active ? '#572d1c' : '#28322b';
    drawMenuInk(ctx, label, left, lineY - 17*scale, scale);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.85 * scale;
    ctx.beginPath();
    ctx.moveTo(arrowX, lineY);
    ctx.quadraticCurveTo(arrowX + 8*scale, lineY + .75, arrowX + 16*scale, lineY);
    ctx.moveTo(arrowX + 10*scale, lineY - 6*scale);
    ctx.lineTo(arrowX + 16*scale, lineY);
    ctx.lineTo(arrowX + 10*scale, lineY + 6*scale);
    ctx.stroke();
    if (active) {
      const y = lineY + 24*scale;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.quadraticCurveTo((left + arrowX)/2, y - 1.6, arrowX + 16*scale, y);
      ctx.stroke();
    }
    right.material.map.needsUpdate = true;
  }

  function printAction() {
    const paperPixels = Math.abs(paperToScreen(print.width, 200)[0] - paperToScreen(0, 200)[0]);
    const width = menuInkWidth(label);
    const scale = Math.min(clamp(8850 / paperPixels, 19, 34) / 24, 385 / (width + 35));
    const arrowX = print.width - 38 - 16*scale;
    const lineY = print.height - 65;
    const left = arrowX - (width + 14)*scale;
    inkLayout = { left, arrowX, lineY, scale };
    paintAction();

    const corners = [[left - 13, lineY - 22*scale], [arrowX + 24*scale, lineY - 22*scale],
      [left - 13, lineY + 27*scale], [arrowX + 24*scale, lineY + 27*scale]]
      .map(([x, y]) => paperToScreen(x, y));
    const x = Math.min(...corners.map(p => p[0])), y = Math.min(...corners.map(p => p[1]));
    const w = Math.max(...corners.map(p => p[0])) - x;
    const h = Math.max(...corners.map(p => p[1])) - y;
    button.style.left = `${x}px`;
    button.style.top = `${y - Math.max(0, 44 - h) / 2}px`;
    button.style.width = `${w}px`;
    button.style.height = `${Math.max(h, 44)}px`;
  }

  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    inkHovered = true;
    paintAction();
  });
  for (const event of ['pointerleave', 'pointercancel']) button.addEventListener(event, () => {
    inkHovered = false;
    paintAction();
  });
  button.addEventListener('focus', paintAction);
  button.addEventListener('blur', paintAction);

  function centerOpening() {
    const spread = clamp(Math.cos(front.rotation.z) / Math.cos(openFront), 0, 1);
    const turn = Math.max(0, ...sheets.map(({ pivot }) => Math.sin(pivot.rotation.z) - Math.sin(openFront)));
    point.set(center.x * (1 - spread), -.20 * (1 - spread) - .56 * turn, 0)
      .multiply(book.scale).applyQuaternion(book.quaternion);
    book.position.copy(readingPosition).add(point);
    if (phase !== 'opening') return;

    // The curling, near edge can project larger than the spread. Accommodate it
    // along the view axis while keeping the camera and the resting fit fixed.
    book.updateWorldMatrix(false, true);
    let retreat = 0;
    for (const mesh of bookSurfaces) {
      cameraFromMesh.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(cameraFromMesh);
        retreat = Math.max(retreat, point.z + Math.abs(point.x) / frameLimit.x,
          point.z + Math.abs(point.y) / frameLimit.y);
      }
    }
    point.set(0, 0, -retreat).applyQuaternion(camera.quaternion).applyQuaternion(parentRotation);
    book.position.add(point);
  }

  function measureReadingPose() {
    camera.updateMatrixWorld();
    const { x: sx, y: sy, z: sz } = book.scale;
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    frameLimit.set(v * camera.aspect * .976, v * .964);
    let distance = camera.near;
    // Fit the entire open cover, including the near page corners, in perspective.
    for (const x of [-6.89, 2.35]) for (const y of [-.04, .53]) for (const z of [-1.835, 1.835]) {
      point.set((x-center.x)*sx, (y-center.y)*sy, z*sz).applyQuaternion(facing);
      distance = Math.max(distance, point.z + Math.abs(point.x) / (v * camera.aspect * .965),
        point.z + Math.abs(point.y) / (v * .92));
    }
    book.parent.getWorldQuaternion(parentRotation).invert();
    readingRotation.copy(parentRotation).multiply(camera.quaternion).multiply(facing);
    const anchor = book.parent.worldToLocal(camera.localToWorld(point.set(0, 0, -distance)));
    readingPosition.copy(anchor).sub(center.clone().multiply(book.scale).applyQuaternion(readingRotation));
    point.set(center.x, -.20, 0).multiply(book.scale).applyQuaternion(readingRotation);
    raisedClosedPosition.copy(readingPosition).add(point);
  }

  function fit() {
    if (phase !== 'opening' && phase !== 'reading') return;
    measureReadingPose();
    book.quaternion.copy(readingRotation);
    centerOpening();
    book.updateWorldMatrix(true, true);
    printAction();
  }

  function settle() {
    book.position.copy(desk.position);
    book.quaternion.copy(desk.quaternion);
    front.rotation.z = back.rotation.z = leaves.rotation.z = spine.rotation.z = 0;
    for (const { pivot, sheet } of sheets) {
      pivot.rotation.z = 0;
      sheet.morphTargetInfluences[0] = 0;
    }
    bound.morphTargetInfluences[0] = 0;
    painted.material.emissiveIntensity = 0;
    book.remove(light, light.target);
    phase = 'desk';
    sounds.play('bookSet',.75);
    book.updateWorldMatrix(true, true);
    onFinish();
  }
  mixer.addEventListener('finished', () => { finished = true; });

  function play(clip) {
    finished = false;
    action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }

  function open(fromDesk = false) {
    phase = 'opening';
    light.visible = true;
    const times = Array.from({ length: 75 }, (_, i) => i / 74 * openingDuration);
    const openAngles = times.map(t => lerp(fromDesk ? 0 : initialCover, openFront, smootherstep(t, 0, .59)));
    const binding = times.map(t => fromDesk ? smootherstep(t, 0, .48) : 1);
    play(new THREE.AnimationClip('Open Menu and turn three pages', openingDuration, [
      numberTrack(front, 'rotation[z]', times, openAngles),
      numberTrack(leaves, 'rotation[z]', times, openAngles),
      numberTrack(back, 'rotation[z]', times, binding.map(t => t * openBack)),
      numberTrack(bound, 'morphTargetInfluences[0]', times, binding),
      ...sheetTracks(sheets, times, true, fromDesk ? [0, 0, 0] : firstLeafAngles),
    ]));
  }

  function reopen() {
    if (phase !== 'desk') return false;
    sounds.play('bookLift',.72);
    phase = 'lifting';
    label = 'Back to Explore';
    button.setAttribute('aria-label', label.toUpperCase() + ' →');
    measureReadingPose();
    light.intensity = 0;
    book.add(light, light.target);
    const times = Array.from({ length: 61 }, (_, i) => i / 60 * pickupDuration);
    const positions = [], rotations = [], power = [];
    const pose = new THREE.Quaternion();
    for (const t of times) {
      const lift = smootherstep(t, 0, pickupDuration);
      point.copy(desk.position).lerp(raisedClosedPosition, lift);
      point.y += .31*Math.sin(Math.PI*lift);
      positions.push(...point.toArray());
      pose.copy(desk.quaternion).slerp(readingRotation, smootherstep(t, .09, pickupDuration));
      rotations.push(...pose.toArray());
      power.push(readingLight*smootherstep(t, .39, pickupDuration));
    }
    play(new THREE.AnimationClip('Lift Menu from the table', pickupDuration, [
      new THREE.VectorKeyframeTrack('.position', times, positions),
      new THREE.QuaternionKeyframeTrack('.quaternion', times, rotations),
      numberTrack(light, 'intensity', times, power),
    ]));
    return true;
  }

  function start() {
    if (phase !== 'reading' || button.hidden) return false;
    phase = 'placing';
    button.hidden = true;
    inkHovered = false;
    paintAction();
    const from = book.position.clone();
    const upright = book.quaternion.clone();
    const away = new THREE.Vector3(0, -1, 0).applyQuaternion(upright);
    const pose = new THREE.Quaternion();
    const originalAnchor = center.clone().multiply(book.scale).applyQuaternion(upright).add(from);
    const times = [], positions = [], rotations = [], coverAngles = [], backAngles = [];
    const stitchRelax = [], spineAngles = [], coverLight = [], lampPower = [];
    // Sample eased poses into one clip. The tabletop is approached only after the cover is flat.
    for (let i = 0; i <= 160; i++) {
      const t = i / 160 * duration;
      const close = smootherstep(t, .43, 1.41);
      const tilt = smootherstep(t, .83, 2.30);
      const lower = smootherstep(t, .39, duration);
      const angle = openFront * (1 - close);
      times.push(t);
      coverAngles.push(angle);
      backAngles.push(openBack * (1 - close));
      stitchRelax.push(1 - close);
      spineAngles.push(.045 * Math.sin(close * Math.PI));
      coverLight.push(.52 * smootherstep(close, .55, 1) * (1 - smootherstep(t, 1.58, 2.52)));
      lampPower.push(readingLight * (1 - smootherstep(t, 1.35, 2.44)));
      pose.copy(upright).slerp(desk.quaternion, tilt);
      rotations.push(...pose.toArray());
      const spread = Math.max(0, Math.cos(angle) / Math.cos(openFront));
      point.set(center.x * spread, center.y * (1 - close), 0)
        .multiply(book.scale).applyQuaternion(pose);
      point.multiplyScalar(-1).addScaledVector(originalAnchor, 1 - lower).addScaledVector(desk.position, lower);
      point.y += .19 * Math.sin(Math.PI * lower);
      // Turning corners approach the viewer. Give the upright book room before lowering it.
      point.addScaledVector(away, .69 * smootherstep(t, .04, .42) * (1 - smootherstep(t, .77, 1.29)));
      positions.push(...point.toArray());
    }
    // The first key must match the waiting pose, including the small open hinge angle.
    positions.splice(0, 3, ...from.toArray());
    const number = (node, property, values) => numberTrack(node, property, times, values);
    const clip = new THREE.AnimationClip('Close and set down Menu', duration, [
      new THREE.VectorKeyframeTrack('.position', times, positions),
      new THREE.QuaternionKeyframeTrack('.quaternion', times, rotations),
      number(front, 'rotation[z]', coverAngles),
      number(back, 'rotation[z]', backAngles),
      number(leaves, 'rotation[z]', coverAngles),
      number(spine, 'rotation[z]', spineAngles),
      number(bound, 'morphTargetInfluences[0]', stitchRelax),
      number(painted, 'material.emissiveIntensity', coverLight),
      number(light, 'intensity', lampPower),
      ...sheetTracks(sheets, times, false),
    ]);
    play(clip);
    return true;
  }
  fit();
  function update(seconds) {
    if (!action?.isRunning()) return false;
    const previous=action.time;
    mixer.update(phase === 'opening' ? Math.min(seconds, .06) : seconds);
    if(phase==='opening')sounds.cues(previous,action.time,openingCues);
    if(phase==='placing')sounds.cues(previous,action.time,closingCues);
    // The mixer applies its final sampled bindings after dispatching 'finished'.
    if (finished) {
      mixer.uncacheRoot(book);
      action = null;
      if (phase === 'lifting') {
        book.quaternion.copy(readingRotation);
        book.position.copy(raisedClosedPosition);
        light.intensity = readingLight;
        open(true);
        fit();
      } else if (phase === 'opening') {
        front.rotation.z = leaves.rotation.z = openFront;
        back.rotation.z = openBack;
        bound.morphTargetInfluences[0] = 1;
        for (const { pivot, sheet } of sheets) {
          pivot.rotation.z = openFront;
          sheet.morphTargetInfluences[0] = 0;
        }
        phase = 'reading';
        fit();
        onReady();
      } else settle();
    } else if (phase === 'opening') centerOpening();
    return true;
  }
  return { fit, open, reopen, start, update, dispose: () => light.shadow.dispose() };
}
