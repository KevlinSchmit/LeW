import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeReflectionStudio, makeWoodReflections, refineSurface, makeBottleGlass, outlineChef } from './materials.js';
import { serviceFloor } from './characters/fish-prep.js';
import { createSushiChef } from './characters/sushi-chef.js';
import { startChefAnimation, cycleChefIdles } from './characters/chef-animation.js';
import { createChefRestock } from './characters/chef-restock.js';
import { createContactInteraction } from './contact-card.js';
import { createCounterAudio } from './counter-audio.js';
import modelURL from 'virtual:sushi-model';
import { installConveyor, isFrontDish, straightSpan, conveyorHalfWidth } from './conveyor.js';
import { installIzakayaBackdrop } from './izakaya-backdrop.js';
import { addSushiMenu, matchesTableware } from './sushi/servings.js';
import { makeSushiTableware } from './sushi/tableware.js';
import { restyleRightCounter } from './counter-service.js';
import { addCounterPlayer } from './counter-player.js';
import { createPlayerInteraction } from './counter-player-interaction.js';
import { replaceCounterTerminal } from './counter-terminal.js';
import { createCounterStories } from './counter-stories.js';
import { paintLabel } from './counter-paper.js';
import { createPlateExperience } from './plate-experience.js';
import { createCounterHover } from './counter-hover.js';
import { createHoverLabel } from './hover-label.js';
import { createMenuIntro } from './menu-intro.js';
import { createTeaStory } from './tea-story.js';
import { prepareEmptyCup } from './tea-water.js';
import { loadIzakayaPrints } from './izakaya-prints.js';
import './style.css';

const canvas = document.querySelector('#scene');
const seatDescription=canvas.getAttribute('aria-description');
const seatShortcuts=canvas.getAttribute('aria-keyshortcuts');
const hoverLabel = document.querySelector('#object-hover-label');
const showHoverLabel = createHoverLabel(hoverLabel);
const app = document.querySelector('#app');
const sounds = createCounterAudio();
const soundButton = document.querySelector('#sound');
soundButton.hidden=!sounds.supported;
function syncSoundButton() {
  soundButton.setAttribute('aria-pressed',String(!sounds.muted));
  soundButton.title=sounds.muted ? 'Enable sound effects' : 'Mute sound effects';
}
syncSoundButton();
for(const gesture of ['pointerdown','click','keydown'])document.addEventListener(gesture,sounds.unlock,true);
soundButton.addEventListener('click',()=>{
  if(!introComplete)return;
  sounds.setMuted(!sounds.muted);
  syncSoundButton();
  if(!sounds.muted)sounds.play('interface',.53);
});
const explore = document.querySelector('#start-exploring');
const loading = document.querySelector('#loading');
const playerExit = document.querySelector('#mp3-exit');
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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = .98;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#231c17');
scene.fog = new THREE.FogExp2('#30231a', .018);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 90);
// Blender is Z-up; glTF gives us Y-up. Visitor sits on the positive Z side.
const home = new THREE.Vector3(0, 8.0, 17.2);
const target = new THREE.Vector3(0, 2.25, -1.0);
const roomHalfWidth = conveyorHalfWidth + 2.6;
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
scene.environmentIntensity = .16;
scene.add(new THREE.HemisphereLight(0xb3a48d, 0x1b1411, .38));
function directionalLight(color, power, position, aim, shadow = false) {
  const l = new THREE.DirectionalLight(color, power);
  l.position.set(...position);
  l.target.position.set(...aim);
  l.castShadow = shadow;
  if (shadow) {
    l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -14, right: 14, top: 13, bottom: -10, near: .1, far: 40 });
    l.shadow.bias = -.0003;
    l.shadow.normalBias = .025;
    l.shadow.radius = 1;
  }
  scene.add(l, l.target);
  return l;
}
// Restaurant reference: local tungsten pools, dark ceiling and quiet shadow fill.
const counterKey=new THREE.SpotLight(0xffba72,360,36,.68,.40,2);
counterKey.name='Warm left counter key';
counterKey.position.set(-9,7,6);counterKey.target.position.set(-3,1,0);
counterKey.castShadow=true;counterKey.shadow.mapSize.set(2048,2048);
counterKey.shadow.camera.near=.5;counterKey.shadow.camera.far=36;
counterKey.shadow.bias=-.0002;counterKey.shadow.normalBias=.025;
counterKey.shadow.radius=1;
scene.add(counterKey,counterKey.target);
const roomFill=directionalLight(0xffe0b1,.22,[8,6,-4],[0,1,0]);
roomFill.name='Quiet room fill';
// A quiet reflected pool keeps the POS readable without lifting all the shadows.
const serviceBounce=new THREE.PointLight(0xffdfa3,24,9,2);
serviceBounce.name='Right counter reflected warmth';serviceBounce.position.set(7,5,4);scene.add(serviceBounce);
// A warm central pool lights the wood and food while the surrounding room recedes.
const centerTopLight=new THREE.SpotLight(0xffc979,480,32,.47,.60,2);
centerTopLight.name='Central warm yellow top light';
centerTopLight.position.set(0,12.75,-.65);
centerTopLight.target.position.set(0,.2,-.15);
centerTopLight.castShadow=true;
centerTopLight.shadow.mapSize.set(2048,2048);
centerTopLight.shadow.camera.near=.5;
centerTopLight.shadow.camera.far=32;
centerTopLight.shadow.bias=-.0002;
centerTopLight.shadow.normalBias=.02;
centerTopLight.shadow.radius=1;
scene.add(centerTopLight,centerTopLight.target);
// No depth-of-field: every painted asset should remain readable.
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
    cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
    hoverMask: { value: null }, hoverBounds: { value: new THREE.Vector4() },
    hoverPointer: { value: new THREE.Vector2() }, hoverHitDepth: { value: 0 },
    hoverStrength: { value: 0 }, pixelRatio: { value: renderer.getPixelRatio() },
    teaLip: { value: new THREE.Vector4() }, teaLipActive: { value: false },
  },
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `
    #include <common>
    #include <packing>
    uniform sampler2D image;
    uniform sampler2D depth;
    uniform vec2 pixel;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform sampler2D hoverMask;
    uniform vec4 hoverBounds;
    uniform vec2 hoverPointer;
    uniform float hoverHitDepth, hoverStrength, pixelRatio;
    uniform vec4 teaLip;
    uniform bool teaLipActive;
    varying vec2 vUv;
    void main(){
      float d=texture2D(depth,vUv).x;
      float distance=-perspectiveDepthToViewZ(d,cameraNear,cameraFar);
      vec3 color=texture2D(image,vUv).rgb;
      // Broken ink contours at occlusion boundaries; not every surface is outlined.
      float edge=0.;
      for(int i=0;i<8;i++){
        float angle=float(i)*.785398;
        vec2 direction=vec2(cos(angle),sin(angle));
        float neighbor=-perspectiveDepthToViewZ(texture2D(depth,vUv+direction*pixel*1.25).x,cameraNear,cameraFar);
        edge=max(edge,smoothstep(.04,.17,neighbor-distance));
      }
      // The dark depth outline is behind the translucent tea at the spout.
      if(teaLipActive){
        vec2 stepPixels=(teaLip.zw-teaLip.xy)/pixel;
        vec2 pointPixels=(vUv-teaLip.xy)/pixel;
        float along=clamp(dot(pointPixels,stepPixels)/max(1.,dot(stepPixels,stepPixels)),0.,1.);
        edge*=smoothstep(2.8,6.3,length(pointPixels-stepPixels*along)/pixelRatio);
      }
      float foreground=1.-smoothstep(27.,35.,distance);
      // Keep painted colors rich without amplifying the yellow-green cast.
      float luminance=dot(color,vec3(.2126,.7152,.0722));
      color=max(mix(vec3(luminance),color,1.10),vec3(0.));
      color=mix(color,vec3(.004,.003,.002),edge*foreground*.90);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      // Orange-brown display grade; preserve luminance and the approved light pools.
      float displayLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
      vec3 orangeBrown=gl_FragColor.rgb*vec3(1.08,.82,.72);
      gl_FragColor.rgb=orangeBrown*(displayLuma/max(dot(orangeBrown,vec3(.2126,.7152,.0722)),.00001));
      vec2 outlinePixel=pixel*pixelRatio;
      if(hoverStrength>0. && all(greaterThanEqual(vUv,hoverBounds.xy-4.*outlinePixel))
        && all(lessThanEqual(vUv,hoverBounds.zw+4.*outlinePixel))){
        float pointerDepth=-perspectiveDepthToViewZ(texture2D(depth,hoverPointer).x,cameraNear,cameraFar);
        if(hoverHitDepth<=pointerDepth+.04+pointerDepth*.002){
          float fill=texture2D(hoverMask,vUv).r;
          if(fill<1.){
            float edge=0., halo=0.;
            for(int i=0;i<8;i++){
              float angle=float(i)*.785398;
              vec2 offset=vec2(cos(angle),sin(angle))*outlinePixel;
              edge=max(edge,texture2D(hoverMask,vUv+offset*1.65).r);
              halo+=texture2D(hoverMask,vUv+offset*3.6).r;
            }
            float light=max(.86*edge,.075*halo)*(1.-fill)*hoverStrength;
            gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.,.94,.84),light);
          }
        }
      }
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
});
finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),finishMaterial));
const projectionStart = new THREE.Vector3(), projectionEnd = new THREE.Vector3();
function renderScene() {
  renderer.setRenderTarget(sceneTarget);
  renderer.render(scene,camera);
  const uniforms = finishMaterial.uniforms;
  uniforms.cameraNear.value = camera.near;
  uniforms.cameraFar.value = camera.far;
  uniforms.teaLipActive.value = teaActive && teaStory.pouring;
  if (uniforms.teaLipActive.value) {
    projectionStart.copy(teaStory.outlet).project(camera).multiplyScalar(.5).addScalar(.5);
    projectionEnd.copy(teaStory.lipEnd).project(camera).multiplyScalar(.5).addScalar(.5);
    uniforms.teaLip.value.set(projectionStart.x,projectionStart.y,projectionEnd.x,projectionEnd.y);
  }
  const hovered = counterHover.render(renderer,
    introComplete && pointerOnCanvas && !orbitDragging ? pointer : null, uniforms, reducedMotion);
  updateHoverLabel(hovered);
  const canClick = hovered && (hovered.root === deskMenu || hovered.root === teaStory.teapot
    || (!overview && (hovered.root===counterStories.terminal || hovered.root===playerInteraction.player || plates.includes(hovered.root)))
    || (!overview && (hovered.root===experience.column || hovered.root===contact.bell || hovered.root===contact.card)));
  let playerControl=false;
  if (playerActive && pointerOnCanvas) {
    raycaster.setFromCamera(pointer,camera);
    playerControl=playerInteraction.canPoint(raycaster);
  }
  const cursor = (canClick || playerControl || experienceActive && experience.canPoint) ? 'pointer'
    : introComplete && lookMode ? (orbitDragging ? 'grabbing' : 'grab') : 'default';
  if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  renderer.setRenderTarget(null);
  renderer.render(finalScene,finalCamera);
}
const plates = [];
let conveyor;
let overview = false;
let roomShell;
let chefApron;
let counterHover;
let menuIntro;
let teaStory;
let teaActive = false;
let counterStories;
let counterStoryActive = false;
let experience;
let experienceActive = false;
let playerInteraction;
let playerActive = false;
let contact;
let contactActive = false;
let deskMenu;
let introComplete = false;
let returnToSeatAfterMenu = false;
let plateStack;
let chefMixer;
let chefIdles;
let chefRestock;
let chefPausedForSushi = false;
let loaded = false;
let motion = !reducedMotion;
const conveyorBoostMultiplier = 3;
const conveyorSpeed = .39;
let conveyorTravel = 0;
let conveyorHold;
let suppressConveyorClick = false;
let lookMode = false;
let pointerOnCanvas = false;
let orbitDragging = false;
const pointer = new THREE.Vector2();
const pointerDown = new THREE.Vector2();
const seatAngle = new THREE.Vector2();
const seatOrientation = new THREE.Quaternion();
const seatOffset = new THREE.Quaternion();
const seatEuler = new THREE.Euler(0,0,0,'YXZ');
const seatYaw = THREE.MathUtils.degToRad(7);
const seatPitch = THREE.MathUtils.degToRad(3.55);
const raycaster = new THREE.Raycaster();
const rayPoint = new THREE.Vector2();
canvas.inert = true;
function placeMenu(returnToSeat = false) {
  if (!menuIntro?.start()) return;
  returnToSeatAfterMenu = returnToSeat;
  app.dataset.intro = 'placing';
}
explore.addEventListener('click', () => placeMenu());
app.addEventListener('click', event => {
  if (app.dataset.intro !== 'reading' || event.target === explore) return;
  setPickRay(event.clientX, event.clientY);
  if (raycaster.intersectObject(deskMenu, true).length === 0) placeMenu(true);
});
const loader = new GLTFLoader();
const loadScene = loader.loadAsync(modelURL, (progress) => {
  if (progress.total) loading.querySelector('i').style.width = `${Math.min(95,progress.loaded/progress.total*95)}%`;
});
Promise.all([loadScene, createSushiChef(), loadIzakayaPrints()]).then(([gltf, chef, prints]) => {
  const model = gltf.scene;
  model.name = 'Sushi Counter — original Blender model';
  // Replace the embedded indigo character with an editable procedural chef.
  for (const child of [...model.children]) {
    if (child.name.startsWith('CHEF')) model.remove(child);
    if (child.name.startsWith('SUSHI_') && !child.isMesh) {
      plates.push(child);
      for (const part of [...child.children]) {
        if (/ceramic_identification_sign|sign_clip/i.test(part.name)||matchesTableware(part)) part.removeFromParent();
      }
    }
  }
  model.add(chef);
  restyleRightCounter(model);
  let bottleMaterial, woodEnvironment;
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      refineSurface(material);
      if(material.name.includes('Honey oak')){
        woodEnvironment ??= makeWoodReflections(renderer);
        material.envMap=woodEnvironment;
      }
      if (material.name.startsWith('BOTTLE GLASS')) {
        if(!bottleMaterial){bottleMaterial=makeBottleGlass(material);bottleMaterial.envMap=scene.environment;}
        object.material=bottleMaterial;object.castShadow=false;object.receiveShadow=false;object.renderOrder=2;
      }
      if (material.name.includes('noren')) material.side = THREE.DoubleSide;
    }
  });
  replaceCounterTerminal(model);
  const playerParts=addCounterPlayer(model);
  outlineChef(chef, .002);
  const kitchen = startChefAnimation(chef, chef.userData.sculptRuntime.arms, model.getObjectByName('SUSHI_salmon'));
  chefMixer = kitchen.mixer;
  const [shaping,slicing,cleaning,adjusting] = chef.animations;
  chefIdles = cycleChefIdles(chefMixer,[adjusting,cleaning,shaping,slicing]);
  const tableware=makeSushiTableware();
  addSushiMenu(model,plates,tableware.dressServing);
  conveyor = installConveyor(model, plates);
  chefRestock = createChefRestock(chef,kitchen,chefIdles,conveyor,plate=>{
    counterHover.replaceServing(plate);
    sounds.play('plateSet',.32,plate.position.x*.05,.96);
  });
  roomShell = ['RoomRoof','RoomBack','RoomLeft','RoomRight'].map(name=>model.getObjectByName(name));
  const [roof,back,left,right] = roomShell;
  const walnut = back.children.find(m=>m.material?.name.includes('walnut')).material;
  installIzakayaBackdrop(roof,back,left,right,roomHalfWidth,prints);
  const bounds = new THREE.Box3();
  const architecture = model.children.find(node=>node.name.startsWith('RESTAURANT'));
  // Repeat the existing counter planks and edging at their original grain scale.
  for (const panel of architecture.children.filter(node=>node.name.startsWith('Counter_'))) {
    const span = bounds.setFromObject(panel).getSize(new THREE.Vector3()).x;
    for (const side of [-1,1]) {
      const extension = panel.clone();
      extension.name += side < 0 ? '_left' : '_right';
      extension.position.x += side * span;
      architecture.add(extension);
    }
  }
  chefApron = chef.userData.sculptRuntime.meshes.filter(m=>m.userData.overviewOnly);
  const support = model.getObjectByName('PlateSupportTop');
  function cabinet(name, x,y,z, width,height,depth, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;
    model.add(mesh);
  }
  const board = new THREE.Box3().setFromObject(support);
  const floorHeight = -1.14;
  cabinet('Plate station base',board.getCenter(new THREE.Vector3()).x,(board.min.y+floorHeight)/2,
    board.getCenter(new THREE.Vector3()).z,board.max.x-board.min.x-.22,board.min.y-floorHeight,board.max.z-board.min.z-.22,walnut);
  cabinet('Dining counter base',0,-.73,6.38,straightSpan-.3,.82,13.48,walnut);
  model.add(serviceFloor(model.getObjectByName('Chef prep table'),floorHeight,roomHalfWidth+.3));
  scene.add(model);
  deskMenu = model.children.find(node=>node.name.startsWith('MENU'));
  menuIntro = createMenuIntro(deskMenu, camera, explore, sounds,
    () => {
      app.dataset.intro = 'reading';
      explore.hidden = false;
    },
    () => {
      introComplete = true;
      app.removeAttribute('data-intro');
      canvas.inert = false;
      if (returnToSeatAfterMenu && lookMode) resetView();
      returnToSeatAfterMenu = false;
      controls.enabled = lookMode;
      canvas.focus({preventScroll:true});
      renderer.shadowMap.needsUpdate = true;
    });
  plateStack = model.children.find(object=>object.name.startsWith('DISHES'));
  tableware.dressStacks(plateStack);
  experience = createPlateExperience(plateStack,scene,camera,sounds,()=>{
    experienceActive=false;
    introComplete=true;
    app.removeAttribute('data-experience');
    controls.enabled=lookMode;
    clearPointer();
    canvas.focus({preventScroll:true});
  });
  prepareEmptyCup(model.children.find(node=>node.name.startsWith('TEACUP')));
  contact = createContactInteraction(model,camera,chef,kitchen,chefIdles,reducedMotion,sounds,resized=>{
    contactActive=false;
    introComplete=true;
    app.removeAttribute('data-contact');
    canvas.inert=false;
    if(resized)resize();
    controls.enabled=lookMode;
    clearPointer();
    canvas.focus({preventScroll:true});
  });
  counterHover = createCounterHover(model, plates, plateStack, sceneTarget, camera);
  finishMaterial.uniforms.hoverMask.value = counterHover.texture;
  syncCutaway();
  teaStory = createTeaStory(model, scene, camera, sounds, () => {
    teaActive = false;
    introComplete = true;
    app.removeAttribute('data-tea');
    canvas.inert = false;
    controls.enabled = lookMode;
    canvas.focus({preventScroll:true});
  });
  counterStories = createCounterStories(model,camera,renderer,deskMenu,sounds,{
    onSushiFocus() { chefPausedForSushi=true; },
    onMeal() { chefPausedForSushi=false; },
    onClose(slot) {
      counterStoryActive=false;
      introComplete=true;
      app.removeAttribute('data-counter-story');
      canvas.inert=false;
      controls.enabled=lookMode;
      canvas.focus({preventScroll:true});
      if (slot) chefRestock.schedule(slot);
    },
  });
  playerInteraction = createPlayerInteraction(playerParts,camera,prints,document.querySelector('#mp3-status'),reducedMotion,sounds,(resized)=>{
    playerActive=false;
    introComplete=true;
    app.removeAttribute('data-mp3');
    canvas.setAttribute('aria-description',seatDescription);
    canvas.setAttribute('aria-keyshortcuts',seatShortcuts);
    if (resized) resize();
    controls.enabled=lookMode;
    clearPointer();
    canvas.focus({preventScroll:true});
  },syncSoundButton);
  paintLabel(playerExit.querySelector('canvas'),'Back to Explore',1,'#f6e6c9',0);
  playerExit.addEventListener('click',playerInteraction.dismiss);
  renderer.shadowMap.needsUpdate = true;
  window.__sushi = { chefMixer, scene, camera, renderer, plates, controls, model, plateStack, pickAt,
    get hoveredObject() { return counterHover.activeObject; },
    get motion() { return motion; }, get overview() { return overview; } };
  loading.querySelector('i').style.width = '100%';
  requestAnimationFrame(() => {
    // Warm the restaurant's regular lighting before the temporary book light is added.
    renderer.setRenderTarget(sceneTarget);
    renderer.compile(scene, camera);
    menuIntro.open();
    renderScene();
    loading.classList.add('done');
    previous = performance.now();
    loaded = true;
    document.body.dataset.ready = 'true';
  });
}).catch((error) => {
  console.error('Unable to load the sushi scene',error);
  loading.hidden = true;
  document.querySelector('#error').hidden = false;
  document.querySelector('#error p').textContent = 'The scene could not be loaded. Please reload to try again.';
});
function updateMotionButton() {
  const button = document.querySelector('#motion');
  button.setAttribute('aria-pressed', String(motion));
  button.title = motion ? 'Pause conveyor' : 'Start conveyor';
  button.querySelector('span').textContent = conveyorHold?.boosted ? `Conveyor ×${conveyorBoostMultiplier}` : motion ? 'Conveyor on' : 'Conveyor paused';
  button.querySelector('svg').innerHTML = motion ? '<path d="M7 5v10M13 5v10"/>' : '<path d="m7 4 9 6-9 6Z"/>';
}
updateMotionButton();
function toggleMotion() {
  if (!introComplete) return;
  motion = !motion;
  sounds.play(motion?'beltStart':'beltStop',.73);
  if (!motion) endConveyorHold();
  updateMotionButton();
}
document.querySelector('#motion').addEventListener('click',toggleMotion);
const tourButton = document.querySelector('#tour');
const seatedLimits = {minDistance:14,maxDistance:26,minPolarAngle:.9,maxPolarAngle:1.3,
  minAzimuthAngle:-.22,maxAzimuthAngle:.22,rotateSpeed:.35,zoomSpeed:.45};
const tourLimits = {minDistance:8,maxDistance:250,minPolarAngle:.12,maxPolarAngle:1.41,
  minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,rotateSpeed:.87,zoomSpeed:.85};
const tourFill = new THREE.HemisphereLight(0xfff4e5,0xb29981,1.35);
const tourKey = directionalLight(0xffefdc,.85,[7,18,-8],[0,1,-10]);
tourKey.visible=false;
tourFill.visible=false;
scene.add(tourFill);
function syncCutaway() {
  if (!roomShell) return;
  const [roof,back,left,right]=roomShell;
  roof.visible=!overview;
  back.visible=!overview || camera.position.z>-25;
  left.visible=!overview || camera.position.x>-roomHalfWidth;
  right.visible=!overview || camera.position.x<roomHalfWidth;
  for (const mesh of chefApron) mesh.visible=overview;
  tourFill.visible=tourKey.visible=overview;
  scene.fog.density=overview ? .004 : .018;
}
function updateViewButtons() {
  tourButton.setAttribute('aria-pressed',String(overview));
  tourButton.querySelector('span').textContent=overview ? 'Back to seat' : '360° view';
  document.querySelector('#look').setAttribute('aria-pressed',String(lookMode && !overview));
  document.querySelector('#look span').textContent=lookMode && !overview ? 'Reset view' : 'Look around';
  canvas.style.cursor=lookMode ? 'grab' : 'default';
}
function seatedPose() {
  camera.position.copy(home);
  if (camera.aspect<1) camera.position.z=26;
  camera.fov=camera.aspect<1 ? 69 : 38;
  camera.far=90;
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  camera.lookAt(target);
  seatOrientation.copy(camera.quaternion);
  seatAngle.set(0,0);
  clearPointer();
}
function followSeatPointer(dt) {
  if (reducedMotion || conveyorHold) return;
  // Keep the Experience label and its entry target still under the pointer.
  if (pointerOnCanvas && experience.hitsStack(pointer) &&
    pickAt((pointer.x*.5+.5)*innerWidth,(.5-pointer.y*.5)*innerHeight)===experience.column) return;
  seatAngle.lerp(pointer,1-Math.exp(-8.5*dt));
  seatEuler.set(seatAngle.y*seatPitch,-seatAngle.x*seatYaw,0);
  seatOffset.setFromEuler(seatEuler);
  camera.quaternion.copy(seatOrientation).multiply(seatOffset);
  camera.updateMatrixWorld();
}
function resetView() {
  // Flush any remaining drag inertia before restoring the saved seat.
  controls.autoRotate=false;
  controls.enableDamping=false;
  controls.update();
  controls.enableDamping=true;
  overview=false;
  lookMode=false;
  orbitDragging=false;
  controls.enabled=false;
  Object.assign(controls,seatedLimits);
  seatedPose();
  updateViewButtons();
  syncCutaway();
  renderer.shadowMap.needsUpdate=true;
}
tourButton.addEventListener('click',()=>{
  if (!introComplete) return;
  sounds.play('interface',.65,.26,overview?.83:1.04);
  if (overview) { resetView(); return; }
  resetView();
  overview=lookMode=controls.enabled=true;
  Object.assign(controls,tourLimits);
  controls.target.set(0,2.35,-6.0);
  camera.fov=camera.aspect<1 ? 70 : 48;
  camera.far=360;
  camera.updateProjectionMatrix();
  const tourDistance = Math.min(tourLimits.maxDistance,conveyorHalfWidth*Math.max(1.7,2/camera.aspect));
  camera.position.set(22,28,30).sub(controls.target)
    .setLength(tourDistance).add(controls.target);
  controls.autoRotate=!reducedMotion;
  controls.autoRotateSpeed=.55;
  controls.update(0);
  updateViewButtons();
  syncCutaway();
  renderer.shadowMap.needsUpdate=true;
  showHint('Drag to orbit · scroll to zoom · Esc to return');
});
controls.addEventListener('start',()=>{orbitDragging=true;if(overview)controls.autoRotate=false;});
controls.addEventListener('end',()=>{orbitDragging=false;});
document.querySelector('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  if (introComplete) {
    sounds.play('interface',.52,0,.88);
    resetView();
  }
});
document.querySelector('#look').addEventListener('click', () => {
  if (!introComplete) return;
  sounds.play('interface',.60,0,lookMode?.88:1.10);
  if (overview) resetView();
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
  if (!introComplete) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { showHint('Fullscreen is not available in this view'); }
});
document.addEventListener('fullscreenchange',() => {
  sounds.play('interface',.63,.34,document.fullscreenElement?1.10:.83);
  document.querySelector('#fullscreen').setAttribute('aria-label',document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
});
canvas.addEventListener('pointermove',(event) => {
  if (conveyorHold?.id===event.pointerId && pointerTravel(event)>9) endConveyorHold();
  if((!introComplete && !experienceActive && !playerActive) || event.pointerType!=='mouse')return;
  if(experienceActive)experience.pointerMoved();
  pointerOnCanvas=true;
  pointer.set(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2).clampScalar(-1,1);
});
function setPickRay(clientX, clientY) {
  const { left, top, width, height } = canvas.getBoundingClientRect();
  rayPoint.set((clientX-left)/width*2-1,1-(clientY-top)/height*2);
  raycaster.setFromCamera(rayPoint,camera);
}
function pickAt(clientX,clientY){
  if(!introComplete)return null;
  setPickRay(clientX,clientY);
  const hit=raycaster.intersectObject(window.__sushi.model,true).find(({object})=>{
    for (let part=object; part; part=part.parent) if (!part.visible || part.userData.chefCarried) return false;
    if (object.userData.sushiCover && !plates.includes(object.parent)) return false;
    return true;
  });
  if(!hit)return null;
  let root=hit.object;
  while(root.parent && root.parent!==window.__sushi.model && root.parent!==plateStack)root=root.parent;
  return root;
}
const experienceLabelAnchor=new THREE.Vector3();
function updateHoverLabel(hovered) {
  if (introComplete && !overview && hoverLabel.getAttribute('role')==='button' && hoverLabel.matches(':hover')) return;
  if (!hovered?.label) {
    showHoverLabel(null);
    return;
  }
  const x = (pointer.x + 1) * innerWidth / 2;
  const y = (1 - pointer.y) * innerHeight / 2;
  if (pickAt(x,y)!==hovered.root || (overview && hovered.root===experience.column)) {
    showHoverLabel(null);
    return;
  }
  if (hovered.root===experience.column) {
    experience.column.localToWorld(experienceLabelAnchor.set(0,3.44,1.0)).project(camera);
    showHoverLabel(hovered.label,(experienceLabelAnchor.x*.5+.5)*innerWidth-61,
      (.5-experienceLabelAnchor.y*.5)*innerHeight+49);
  } else showHoverLabel(hovered.label,x,y);
}
function reopenMenu() {
  if (!introComplete || !menuIntro.reopen()) return;
  introComplete = false;
  app.dataset.intro = 'opening';
  canvas.inert = true;
  controls.enabled = false;
  clearPointer();
}
function pourTea() {
  if (!introComplete || !teaStory.begin()) return;
  teaActive = true;
  introComplete = false;
  app.dataset.tea = '';
  canvas.inert = true;
  controls.enabled = false;
  clearPointer();
}
function startCounterStory(kind, source) {
  if (!introComplete || !counterStories.begin(kind,source)) return;
  if (kind==='sushi') conveyor.takeDish(source,camera);
  counterStoryActive=true;
  introComplete=false;
  app.dataset.counterStory=kind;
  canvas.inert=true;
  controls.enabled=false;
  clearPointer();
}
function openExperience() {
  if (!introComplete || overview || !experience.begin()) return;
  experienceActive=true;
  introComplete=false;
  app.dataset.experience='';
  controls.enabled=false;
  clearPointer();
  canvas.focus({preventScroll:true});
}
function openPlayer() {
  if (!introComplete || overview || !playerInteraction.begin()) return;
  playerActive=true;
  introComplete=false;
  app.dataset.mp3='';
  canvas.setAttribute('aria-description','Use the arrow keys or click wheel. M is the Menu and Up button. Enter selects, and Escape returns to the counter.');
  canvas.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space M Backspace Escape');
  controls.enabled=false;
  clearPointer();
  canvas.focus({preventScroll:true});
}
function openContact(fromTable=false) {
  if(!introComplete || overview || !contact.begin(fromTable))return;
  contactActive=true;
  introComplete=false;
  app.dataset.contact='';
  canvas.inert=true;
  controls.enabled=false;
  clearPointer();
}
hoverLabel.addEventListener('click',openExperience);
hoverLabel.addEventListener('pointerleave',clearPointer);
function pointerTravel(event) {
  return Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y);
}
function endConveyorHold(event) {
  if (!conveyorHold || (event?.pointerId!==undefined && event.pointerId!==conveyorHold.id)) return;
  const {boosted}=conveyorHold;
  conveyorHold=undefined;
  if (boosted) {
    sounds.stop('belt',.15);
    if(motion)sounds.play('beltStop',.29,0,1.12);
    updateMotionButton();
  }
}
canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button!==0) return;
  endConveyorHold();
  suppressConveyorClick=false;
  pointerDown.set(event.clientX,event.clientY);
  if (!introComplete || !motion) return;
  const picked=pickAt(event.clientX,event.clientY);
  if (conveyor.isSurface(picked)) {
    conveyorHold={id:event.pointerId,started:performance.now(),boosted:false};
  }
});
window.addEventListener('pointerup',endConveyorHold);
window.addEventListener('pointercancel',endConveyorHold);
canvas.addEventListener('contextmenu',event=>{
  if (conveyorHold || suppressConveyorClick) event.preventDefault();
});
canvas.addEventListener('click',event=>{
  if (suppressConveyorClick) {
    suppressConveyorClick=false;
    return;
  }
  if (event.detail && pointerTravel(event)>6) return;
  if (experienceActive) {
    setPickRay(event.clientX,event.clientY);
    experience.click(rayPoint);
    return;
  }
  if (playerActive) {
    setPickRay(event.clientX,event.clientY);
    playerInteraction.click(raycaster);
    return;
  }
  if (!introComplete) return;
  const picked = pickAt(event.clientX,event.clientY);
  if (picked === deskMenu) reopenMenu();
  else if (picked === teaStory.teapot) pourTea();
  else if (!overview && picked === counterStories.terminal) startCounterStory('resume');
  else if (picked === contact.bell || picked === contact.card) openContact(picked===contact.card);
  else if (picked === playerInteraction.player) openPlayer();
  else if (!overview && plates.includes(picked) && isFrontDish(picked)) startCounterStory('sushi',picked);
  else if (picked === experience.column) openExperience();
});
function clearPointer() {
  pointerOnCanvas=false;
  pointer.set(0,0);
}
canvas.addEventListener('pointerleave',event=>{
  endConveyorHold(event);
  if (event.relatedTarget!==hoverLabel) clearPointer();
});
canvas.addEventListener('pointercancel',clearPointer);
window.addEventListener('blur',()=>{
  endConveyorHold();
  clearPointer();
});
window.addEventListener('keydown',(event) => {
  if(contactActive) {
    if(event.code==='Escape') {
      event.preventDefault();
      contact.dismiss();
    }
    return;
  }
  if (playerActive) {
    if (event.code==='Escape' || document.activeElement===canvas) playerInteraction.key(event);
    return;
  }
  if (experienceActive) {
    if(event.code==='Escape' || document.activeElement===canvas)experience.key(event);
    return;
  }
  if (teaActive && event.code === 'Escape') {
    event.preventDefault();
    teaStory.dismiss();
    return;
  }
  if (counterStoryActive && event.code === 'Escape') {
    event.preventDefault();
    counterStories.dismiss();
    return;
  }
  if (!introComplete) return;
  if (event.code === 'Escape') {
    if(lookMode || overview)sounds.play('interface',.62,0,.88);
    resetView();
  }
  if (overview && ['ArrowLeft','ArrowRight'].includes(event.code)) {
    event.preventDefault();
    controls.autoRotate=false;
    controls.rotateLeft(event.code==='ArrowLeft' ? .16 : -.16);
  }
  if (event.code === 'Space' && document.activeElement === canvas) {
    event.preventDefault();
    toggleMotion();
  }
  if (event.code === 'Enter' && document.activeElement === canvas) {
    event.preventDefault();
    reopenMenu();
  }
  if (event.code === 'KeyT' && document.activeElement === canvas) pourTea();
  if (event.code === 'KeyE' && document.activeElement === canvas) openExperience();
  if (event.code === 'KeyM' && document.activeElement === canvas) openPlayer();
  if (event.code === 'KeyC' && document.activeElement === canvas) openContact();
});
function resize() {
  camera.aspect = innerWidth/innerHeight;
  // Portrait retains the entire counter, rather than silently cropping its objects.
  const focused=teaActive || counterStoryActive || experienceActive || playerActive || contactActive;
  if (!lookMode && !focused) seatedPose();
  else if (!focused) {
    camera.fov = camera.aspect<1 ? (overview ? 70 : 69) : (overview ? 48 : 38);
    camera.updateProjectionMatrix();
  } else camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.getDrawingBufferSize(renderSize);
  sceneTarget.setSize(renderSize.x,renderSize.y);
  counterHover?.resize(renderSize.x,renderSize.y);
  finishMaterial.uniforms.pixel.value.set(1/renderSize.x,1/renderSize.y);
  finishMaterial.uniforms.pixelRatio.value = renderer.getPixelRatio();
  menuIntro?.fit();
}
window.addEventListener('resize',resize);
resize();
let previous = performance.now();
document.addEventListener('visibilitychange',()=>{
  sounds.visibility();
  endConveyorHold();
  previous=performance.now();
});
function animate(now) {
  requestAnimationFrame(animate);
  const frameSeconds = Math.max(0, (now - previous) / 1000);
  const dt = Math.min(frameSeconds, .05); previous = now;
  if (!loaded || document.hidden) return;
  if (!introComplete) endConveyorHold();
  if (conveyorHold && !conveyorHold.boosted && now-conveyorHold.started>=420) {
    conveyorHold.boosted=true;
    conveyorHold.boostedAt=now;
    suppressConveyorClick=true;
    sounds.play('beltStart',.33);
    updateMotionButton();
  }
  const beltSpeed=motion ? conveyorSpeed*(conveyorHold?.boosted ? conveyorBoostMultiplier : 1) : 0;
  if(conveyorHold?.boosted){
    const ramp=Math.min(1,(now-conveyorHold.boostedAt)/420);
    sounds.sustain('belt',.16,0,.94+.27*ramp);
  }
  if (motion) {
    conveyorTravel += dt*beltSpeed;
    conveyor.update(conveyorTravel);
    // Every rendered moving pose needs its own matching shadow maps.
    renderer.shadowMap.needsUpdate = true;
  }
  if (contact.update(dt,!chefRestock.busy)) renderer.shadowMap.needsUpdate = true;
  if (!chefPausedForSushi && !contact.ownsChef) {
    if (chefRestock.update(dt,beltSpeed,introComplete && !overview)) renderer.shadowMap.needsUpdate = true;
    else if (motion) chefIdles.advance(frameSeconds);
  }
  if (playerInteraction.update(dt)) renderer.shadowMap.needsUpdate = true;
  if (!playerActive && !contactActive) {
    if (teaActive) {
      if (teaStory.update(dt)) renderer.shadowMap.needsUpdate = true;
    } else if (counterStoryActive) {
      if (counterStories.update(dt)) renderer.shadowMap.needsUpdate = true;
    } else if (experienceActive) {
      if (experience.update(dt,pointerOnCanvas ? pointer : null)) renderer.shadowMap.needsUpdate = true;
    } else if (!introComplete) {
      if (menuIntro.update(frameSeconds)) renderer.shadowMap.needsUpdate = true;
    } else if (lookMode) controls.update(dt);
    else followSeatPointer(dt);
  }
  if (overview) syncCutaway();
  if (introComplete && conveyor.refill(camera,chefRestock.reserves)) renderer.shadowMap.needsUpdate = true;
  renderScene();
}
requestAnimationFrame(animate);
window.addEventListener('pageshow',event => {
  if (event.persisted) location.reload();
});
// Release GPU resources when this document is discarded.
window.addEventListener('pagehide',() => {
  playerInteraction?.dispose();
  sounds.dispose();
  controls.dispose();
  counterHover?.dispose();
  menuIntro?.dispose();
  renderer.dispose();
},{once:true});
