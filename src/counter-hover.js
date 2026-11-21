import * as THREE from 'three';
import { matchesTableware } from './sushi/servings.js';
import { isFrontDish } from './conveyor.js';

export function createCounterHover(model, plates, plateStack, sceneTarget, camera) {
  let pickables = [];
  const targets = new Map();
  const servings = new Map();
  const root = prefix => model.children.find(part => part.name.startsWith(prefix));

  function register(label, roots, outline = () => true, enabled = () => true) {
    const entry = { label, root: roots[0], parts: [], surfaces: [], enabled };
    for (const object of roots) object.traverse(part => {
      if (!part.isMesh || /^(Sushi outline|Fine black contour)$/.test(part.name)) return;
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      pickables.push(part);
      entry.parts.push(part);
      targets.set(part, entry);
      if (outline(part)) entry.surfaces.push(part);
    });
    return entry;
  }

  const noOutline = () => false;
  register('About Me', [root('TEAPOT')]);
  register(null, model.children.filter(part => /^Teapot_.*coaster/.test(part.name)), noOutline);
  register(null, [root('TEACUP')]);
  register(null, model.children.filter(part => /^Tea_(cup_wooden_coaster|coaster_lip)/.test(part.name)), noOutline);
  register(null, [root('SAUCE_DISH')], noOutline);
  register('Directory', [root('MENU')]);
  const chopsticks = root('CHOPSTICKS');
  const sticks = chopsticks.children.find(part => part.material?.name.includes('End-grain & bamboo'));
  register(null, [sticks], noOutline);
  register(null, chopsticks.children.filter(part => part !== sticks), noOutline);
  register('Contact', [root('BELL')]);
  const card=root('Contact card');
  register('Contact', [card], part=>part.name!=='Contact card highlight',()=>card.userData.parked);
  register('Resume', [root('POS')]);
  register(null, [model.getObjectByName('Wasabi jar')], noOutline);
  register(null, [model.getObjectByName('Soy dispenser')], noOutline);
  register('Music', [model.getObjectByName('Counter MP3 player')]);
  const [leftStack, rightStack] = [...plateStack.children].sort((a, b) => a.position.x - b.position.x);
  register('Experience', [leftStack]);
  register(null, [rightStack], noOutline);
  function registerServing(plate) {
    servings.set(plate,register(null,[plate],part=>!matchesTableware(part),()=>plate.visible && isFrontDish(plate)));
  }

  function replaceServing(plate) {
    for (const part of servings.get(plate).parts) targets.delete(part);
    pickables=pickables.filter(part=>targets.has(part));
    registerServing(plate);
  }
  plates.forEach(registerServing);

  const mask = new THREE.WebGLRenderTarget(sceneTarget.width, sceneTarget.height, {
    format: THREE.RedFormat, depthBuffer: false,
  });
  const maskScene = new THREE.Scene();
  maskScene.background = new THREE.Color(0);
  // The scene depth keeps the white edge behind plates, rails and other foreground objects.
  const material = new THREE.ShaderMaterial({
    uniforms: {
      depth: { value: sceneTarget.depthTexture }, pixel: { value: new THREE.Vector2() },
      cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
    },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      #include <packing>
      uniform sampler2D depth;
      uniform vec2 pixel;
      uniform float cameraNear, cameraFar;
      void main(){
        float surfaceZ=texture2D(depth,gl_FragCoord.xy*pixel).x;
        float front=-perspectiveDepthToViewZ(surfaceZ,cameraNear,cameraFar);
        float fragment=-perspectiveDepthToViewZ(gl_FragCoord.z,cameraNear,cameraFar);
        if(fragment>front+.016+front*.0015) discard;
        gl_FragColor=vec4(1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  const resize = (width, height) => {
    mask.setSize(width, height);
    material.uniforms.pixel.value.set(1/width, 1/height);
  };
  resize(sceneTarget.width, sceneTarget.height);

  const bounds = new THREE.Vector4();
  const worldBounds = new THREE.Box3();
  const partBounds = new THREE.Box3();
  const position = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const hits = [];
  let current;
  let started;

  function render(renderer, pointer, uniforms, reducedMotion) {
    hits.length = 0;
    if (pointer) {
      ray.setFromCamera(pointer, camera);
      ray.intersectObjects(pickables, false, hits);
    }
    const hit = card.visible ? hits[0] : hits.find(({object})=>object.parent!==card);
    const entry = hit && targets.get(hit.object);
    const next = entry?.enabled() ? entry : null;
    if (next !== current) {
      current = next;
      started = performance.now();
      maskScene.clear();
      if (current?.surfaces.length) {
        current.proxies ??= current.surfaces.map(source => {
          const proxy = new THREE.Mesh(source.geometry, material);
          proxy.matrixAutoUpdate = false;
          return proxy;
        });
        for (const proxy of current.proxies) maskScene.add(proxy);
      }
    }
    uniforms.hoverStrength.value = 0;
    if (!current?.surfaces.length) return current;

    worldBounds.makeEmpty();
    current.proxies.forEach((proxy, index) => {
      proxy.matrix.copy(current.surfaces[index].matrixWorld);
      proxy.matrixWorldNeedsUpdate = true;
      worldBounds.union(partBounds.copy(proxy.geometry.boundingBox).applyMatrix4(proxy.matrix));
    });
    bounds.set(Infinity, Infinity, -Infinity, -Infinity);
    for (const x of [worldBounds.min.x, worldBounds.max.x]) {
      for (const y of [worldBounds.min.y, worldBounds.max.y]) {
        for (const z of [worldBounds.min.z, worldBounds.max.z]) {
          position.set(x, y, z).project(camera);
          bounds.set(Math.min(bounds.x, position.x), Math.min(bounds.y, position.y),
            Math.max(bounds.z, position.x), Math.max(bounds.w, position.y));
        }
      }
    }
    uniforms.hoverBounds.value.copy(bounds).multiplyScalar(.5).addScalar(.5);
    uniforms.hoverPointer.value.copy(pointer).multiplyScalar(.5).addScalar(.5);
    uniforms.hoverHitDepth.value = -position.copy(hit.point).applyMatrix4(camera.matrixWorldInverse).z;
    uniforms.hoverStrength.value = reducedMotion ? 1 : .6 + .4*Math.min((performance.now()-started)/120, 1);
    material.uniforms.cameraNear.value = camera.near;
    material.uniforms.cameraFar.value = camera.far;
    renderer.setRenderTarget(mask);
    renderer.render(maskScene, camera);
    return current;
  }

  return {
    render, resize, replaceServing, texture: mask.texture,
    get activeObject() { return current?.root ?? null; },
    dispose() { mask.dispose(); material.dispose(); },
  };
}
