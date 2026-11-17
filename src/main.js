import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { makeReflectionStudio, refineSurface, makePlastic } from './materials.js';
import modelURL from 'virtual:sushi-model';
import './style.css';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const hint = document.querySelector('#hint');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (error) {
  loading.hidden = true;
  document.querySelector('#error').hidden = false;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.transmissionResolutionScale = 1;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .96;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2c1c12');
scene.fog = new THREE.FogExp2('#53351e', .017);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 90);
// Blender is Z-up; glTF gives us Y-up. Visitor sits on the positive Z side.
const home = new THREE.Vector3(0, 8.0, 17.2);
const target = new THREE.Vector3(0, 2.25, -1.0);
camera.position.copy(home);
camera.lookAt(target);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(target);
controls.enabled = false;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 14;
controls.maxDistance = 26;
controls.minPolarAngle = .90;
controls.maxPolarAngle = 1.30;
controls.minAzimuthAngle = -.22;
controls.maxAzimuthAngle = .22;
controls.rotateSpeed = .35;
controls.zoomSpeed = .45;
scene.environment = makeReflectionStudio(renderer);
scene.environmentIntensity = .48;
scene.add(new THREE.HemisphereLight(0xffe1b2, 0x392415, .43));
RectAreaLightUniformsLib.init();
const counterGlow=new THREE.RectAreaLight(0xffd1a1,4.0,8,3);
counterGlow.position.set(-3,7,4);counterGlow.lookAt(0,0,-1);scene.add(counterGlow);
function areaLight(color, power, position, size, aim, shadow = false) {
  const l = new THREE.DirectionalLight(color, power);
  l.position.set(...position);
  l.target.position.set(...aim);
  l.castShadow = shadow;
  if (shadow) {
    l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -14, right: 14, top: 13, bottom: -10, near: .1, far: 40 });
    l.shadow.bias = -.0003;
    l.shadow.normalBias = .025;
    l.shadow.radius = 4;
  }
  scene.add(l, l.target);
  return l;
}
areaLight(0xffd4a3, 1.75, [-5, 10, 7], 8, [0, 0, 0], true);
areaLight(0xffaa65, .85, [8, 8, -3], 7, [0, 0, 0]);
areaLight(0xffe5c4, .65, [0, 8, 12], 8, [0, 1, 0]);
areaLight(0xaac2df, .12, [-8, 6, -10], 5, [0, 2, 0]);
// Lantern-sized sources produce broad highlights instead of pin-like sparkles.
for (const [x,y,z] of [[-8,6.5,-4],[0,7,-7],[7,6.5,-7]]) {
  const lamp=new THREE.RectAreaLight(0xffb85e,5,1.6,1.3);
  lamp.position.set(x,y,z);lamp.lookAt(x,0,z);scene.add(lamp);
}
// Depth-aware background softness: keep the counter crisp and let the empty room recede.
const renderSize = new THREE.Vector2();
renderer.getDrawingBufferSize(renderSize);
const sceneTarget = new THREE.WebGLRenderTarget(renderSize.x, renderSize.y, { type: THREE.HalfFloatType });
sceneTarget.depthTexture = new THREE.DepthTexture(renderSize.x,renderSize.y);
const finalScene = new THREE.Scene();
const finalCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const finishMaterial = new THREE.ShaderMaterial({
  uniforms: {
    image: { value: sceneTarget.texture }, depth: { value: sceneTarget.depthTexture },
    pixel: { value: new THREE.Vector2(1/renderSize.x,1/renderSize.y) },
    focusDistance: { value: camera.position.distanceTo(target) },
    cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
  },
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `
    #include <common>
    #include <packing>
    uniform sampler2D image;
    uniform sampler2D depth;
    uniform vec2 pixel;
    uniform float focusDistance;
    uniform float cameraNear;
    uniform float cameraFar;
    varying vec2 vUv;
    void main(){
      float d=texture2D(depth,vUv).x;
      float distance=-perspectiveDepthToViewZ(d,cameraNear,cameraFar);
      float blur=smoothstep(focusDistance+4.,focusDistance+11.,distance)*6.;
      vec3 color=texture2D(image,vUv).rgb;
      if(blur>.1){
        vec3 sum=color*2.;float weight=2.;
        for(int i=0;i<18;i++){
          float t=float(i)+.5;
          float angle=t*2.399963;
          float r=sqrt(t/18.);
          vec2 offset=vec2(cos(angle),sin(angle))*r*blur*pixel;
          float sampleDistance=-perspectiveDepthToViewZ(texture2D(depth,vUv+offset).x,cameraNear,cameraFar);
          float w=smoothstep(focusDistance+2.,focusDistance+5.,sampleDistance);
          sum+=texture2D(image,vUv+offset).rgb*w;weight+=w;
        }
        color=sum/weight;
      }
      color*=mix(1.,.86,smoothstep(focusDistance+5.,focusDistance+13.,distance));
      vec2 centered=(vUv-.5)*vec2(1.,.8);
      color*=1.-.42*dot(centered,centered);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
});
finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),finishMaterial));
function renderScene() {
  finishMaterial.uniforms.focusDistance.value = camera.position.distanceTo(controls.target);
  updateStackHotspot();
  renderer.setRenderTarget(sceneTarget);
  renderer.render(scene,camera);
  renderer.setRenderTarget(null);
  renderer.render(finalScene,finalCamera);
}
const plates = [];
const beltTiles = [];
const pickables = [];
const stackMeshes = [];
let plateStack;
let loaded = false;
let motion = !reducedMotion;
let elapsed = 0;
let lookMode = false;
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const interactableNames = new Map([
  ['TEAPOT', 'Sakura tea pot'], ['TEACUP', 'A little moment of calm'],
  ['MENU', 'The menu · portfolio'], ['BELL', 'Service bell'],
  ['DISHES', 'Plate collection · click to select'],
  ['RESUME', 'A freshly printed résumé'], ['SUSHI_', 'Fresh from the conveyor'],
]);
const loader = new GLTFLoader();
loader.load(modelURL, (gltf) => {
  const model = gltf.scene;
  model.name = 'Sushi Counter — original Blender model';
  let glassMaterial;
  model.traverse((object) => {
    if (object.name.startsWith('SUSHI_') && object.isObject3D && !object.isMesh) plates.push(object);
    if (object.name.startsWith('Belt_tile')) beltTiles.push(object);
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      refineSurface(material);
      if (material.name.includes('GLASS')) {
        if(!glassMaterial){glassMaterial=makePlastic(material);glassMaterial.envMap=scene.environment;}
        object.material = glassMaterial;
        object.castShadow = false;
        object.receiveShadow = false;
        object.renderOrder = 3;
      }
      if (material.name.includes('noren') || material.name.includes('Resume') || material.name.includes('Painted sign')) material.side = THREE.DoubleSide;
    }
    let root = object;
    while (root.parent && root.parent !== model) root = root.parent;
    for (const [prefix,label] of interactableNames) {
      if (root.name.startsWith(prefix)) {
        object.userData.sceneLabel = label;
        pickables.push(object);
        break;
      }
    }
  });
  plates.forEach((plate,index)=>{plate.position.x=-6.65+index*5.;plate.scale.setScalar(1.13);});
  // Two additional assemblies complete the loop outside the seated view.
  for (const [source,x] of [[plates[1],-11.65],[plates[0],13.35]]) {
    const extra=source.clone(true);extra.name=source.name+'_return';extra.position.x=x;model.add(extra);plates.push(extra);
  }
  scene.add(model);
  plateStack = model.children.find(object=>object.name.startsWith('DISHES'));
  // Give the collection its own finish for an independent selection state.
  plateStack.traverse(object=>{
    if(object.isMesh){object.material=object.material.clone();stackMeshes.push(object);}
  });
  document.querySelector('#plate-stack').hidden=false;
  for (const plate of plates) plate.userData.startX = plate.position.x;
  for (const tile of beltTiles) tile.userData.startX = tile.position.x;
  renderer.shadowMap.needsUpdate = true;
  loaded = true;
  document.body.dataset.ready = 'true';
  window.__sushi = { scene, camera, renderer, plates, controls, model, plateStack, stackMeshes, pickAt, get motion() { return motion; } };
  loading.querySelector('i').style.width = '100%';
  requestAnimationFrame(() => { renderScene(); loading.classList.add('done'); });
}, (progress) => {
  if (progress.total) loading.querySelector('i').style.width = `${Math.min(95,progress.loaded/progress.total*95)}%`;
}, (error) => {
  console.error('Unable to load the sushi scene',error);
  loading.hidden = true;
  document.querySelector('#error').hidden = false;
  document.querySelector('#error p').textContent = 'The scene could not be loaded. Please reload to try again.';
});
function updateMotionButton() {
  const button = document.querySelector('#motion');
  button.setAttribute('aria-pressed', String(motion));
  button.title = motion ? 'Pause conveyor' : 'Start conveyor';
  button.querySelector('span').textContent = motion ? 'Conveyor on' : 'Conveyor paused';
  button.querySelector('svg').innerHTML = motion ? '<path d="M7 5v10M13 5v10"/>' : '<path d="m7 4 9 6-9 6Z"/>';
}
updateMotionButton();
document.querySelector('#motion').addEventListener('click', () => { motion = !motion; updateMotionButton(); });
function resetView() {
  lookMode = false; controls.enabled = false;
  camera.position.copy(home);
  if (camera.aspect < 1) camera.position.z = 26;
  controls.target.copy(target); camera.lookAt(target);
  document.querySelector('#look').setAttribute('aria-pressed','false');
  document.querySelector('#look span').textContent = 'Look around';
  canvas.style.cursor = 'default';
}
document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); resetView(); });
document.querySelector('#look').addEventListener('click', () => {
  lookMode = !lookMode;
  controls.enabled = lookMode;
  document.querySelector('#look').setAttribute('aria-pressed',String(lookMode));
  document.querySelector('#look span').textContent = lookMode ? 'Reset view' : 'Look around';
  canvas.style.cursor = lookMode ? 'grab' : 'default';
  if (!lookMode) resetView();
  showHint(lookMode ? 'Drag to look around · scroll to move closer' : 'Back to your seat');
});
let hintTimeout;
function showHint(label) {
  hint.textContent = label;
  hint.classList.toggle('visible',!!label);
  clearTimeout(hintTimeout);
  if (label) hintTimeout = setTimeout(() => hint.classList.remove('visible'),2500);
}
document.querySelector('#fullscreen').addEventListener('click',async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { showHint('Fullscreen is not available in this view'); }
});
document.addEventListener('fullscreenchange',() => {
  document.querySelector('#fullscreen').setAttribute('aria-label',document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
});
canvas.addEventListener('pointermove',(event) => {
  pointer.set(event.clientX/innerWidth*2-1, -(event.clientY/innerHeight)*2+1);
});
const stackButton=document.querySelector('#plate-stack');
const stackAnchor=new THREE.Vector3(-10.25,5.95,-5.2);
const stackScreen=new THREE.Vector3();
function updateStackHotspot(){
  if(!plateStack || stackButton.matches(':hover,:focus-visible'))return;
  stackScreen.copy(stackAnchor).project(camera);
  stackButton.style.left=`${Math.round(THREE.MathUtils.clamp((stackScreen.x*.5+.5)*innerWidth,60,innerWidth-60))}px`;
  stackButton.style.top=`${Math.round(THREE.MathUtils.clamp((-stackScreen.y*.5+.5)*innerHeight,115,innerHeight-140))}px`;
}
function selectPlateStack(){
  if(!plateStack)return;
  const selected=!plateStack.userData.selected;
  plateStack.userData.selected=selected;
  stackButton.setAttribute('aria-pressed',String(selected));
  for(const mesh of stackMeshes){mesh.material.emissive.set(selected ? '#6d340e' : '#000000');mesh.material.emissiveIntensity=.18;}
  scene.userData.selectedObject=selected ? plateStack.name : null;
  canvas.dispatchEvent(new CustomEvent('plate-stack-select',{detail:{selected}}));
  showHint(selected ? 'Plate collection selected' : 'Back to the counter');
}
stackButton.addEventListener('click',selectPlateStack);
function pickAt(clientX,clientY){
  if(!loaded)return null;
  raycaster.setFromCamera(new THREE.Vector2(clientX/innerWidth*2-1,1-clientY/innerHeight*2),camera);
  const hit=raycaster.intersectObject(window.__sushi.model,true).find(hit=>!String(hit.object.material?.name).includes('Clear molded'));
  if(!hit)return null;
  let root=hit.object;while(root.parent && root.parent!==window.__sushi.model)root=root.parent;
  return root;
}
canvas.addEventListener('click',event=>{
  if(!lookMode && pickAt(event.clientX,event.clientY)===plateStack)selectPlateStack();
});
canvas.addEventListener('pointerleave' ,() => { pointer.set(0,0); });
window.addEventListener('keydown',(event) => {
  if (event.code === 'Escape') resetView();
  if (event.code === 'Space' && document.activeElement === canvas) {
    event.preventDefault(); motion = !motion; updateMotionButton();
  }
});
function resize() {
  camera.aspect = innerWidth/innerHeight;
  // Portrait retains the entire counter, rather than silently cropping its objects.
  camera.fov = innerWidth/innerHeight < 1 ? 69 : 38;
  camera.position.copy(home);
  if (innerWidth/innerHeight < 1) camera.position.z = 26;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.getDrawingBufferSize(renderSize);
  sceneTarget.setSize(renderSize.x,renderSize.y);
  finishMaterial.uniforms.pixel.value.set(1/renderSize.x,1/renderSize.y);
  camera.lookAt(target);
}
window.addEventListener('resize',resize);
resize();
let previous = performance.now();
let frame = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now-previous)/1000,.05); previous = now;
  if (!loaded || document.hidden) return;
  if (motion) {
    elapsed += dt;
    for (const plate of plates) {
      const start = plate.userData.startX;
      plate.position.x = THREE.MathUtils.euclideanModulo(start+15-elapsed*.19,30)-15;
    }
    for (const tile of beltTiles) tile.position.x = THREE.MathUtils.euclideanModulo(tile.userData.startX+12.5-elapsed*.19,25)-12.5;
  }
  if (lookMode) controls.update();
  else if (!reducedMotion && camera.aspect > 1) {
    camera.position.x = THREE.MathUtils.damp(camera.position.x,pointer.x*.12,2,dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y,home.y+pointer.y*.055,2,dt);
    camera.lookAt(target);
  }
  // A quiet label makes the independent objects discoverable without binding future interactions.
  if (motion && frame % 12 === 0) renderer.shadowMap.needsUpdate = true;
  if (++frame % 12 === 0 && !lookMode && pointer.length() > .01) {
    raycaster.setFromCamera(pointer,camera);
    const hit = raycaster.intersectObjects(pickables,false)[0];
    canvas.title = hit ? hit.object.userData.sceneLabel : 'Take a seat at the sushi counter';
    canvas.style.cursor = hit?.object.userData.sceneLabel?.startsWith('Plate collection') ? 'pointer' : 'default';
  }
  renderScene();
}
requestAnimationFrame(animate);
// Release GPU resources when this document is discarded.
window.addEventListener('pagehide',() => {
  controls.dispose();
  renderer.dispose();
},{once:true});
