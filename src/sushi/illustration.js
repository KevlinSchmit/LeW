import * as THREE from 'three';
import { matchesTableware } from './servings.js';

const size = 384;

// Flatten the exact serving into print art once, independent of the restaurant camera.
export function illustrateServing(dish, renderer) {
  const scene = new THREE.Scene();
  const food = new THREE.Group();
  for (const part of dish.children) {
    if (!matchesTableware(part)) {
      food.add(part.clone(true));
    }
  }
  scene.add(food);
  const box = new THREE.Box3().setFromObject(food);
  if (box.isEmpty()) return '';
  const center = box.getCenter(new THREE.Vector3());
  food.position.sub(center);
  const span = box.getSize(new THREE.Vector3()).length() * .54;
  const camera = new THREE.OrthographicCamera(-span,span,span,-span,.1,20);
  camera.position.set(3.1,3,5.8);
  camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xfff4dd,0xb29171,1.75));
  const light = new THREE.DirectionalLight(0xfff6e8,2.1);
  light.position.set(-4,5,3);
  scene.add(light);

  const target = new THREE.WebGLRenderTarget(size,size);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const active = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
  const pixels = new Uint8Array(size * size * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0,0);
    renderer.clear();
    renderer.render(scene,camera);
    renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
  } finally {
    renderer.setRenderTarget(active);
    renderer.setClearColor(clear,alpha);
    target.dispose();
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size,size);
  const nearby = [[0,2],[0,-2],[2,0],[-2,0]];
  for (let y=2;y<size-2;y++) for(let x=2;x<size-2;x++) {
    const p = 4*(y*size+x), dest = 4*((size-1-y)*size+x);
    if (pixels[p+3]) {
      const shade = ((x+y*7)%9)-4;
      image.data[dest] = Math.round(pixels[p]/9)*9 + shade + 4;
      image.data[dest+1] = Math.round(pixels[p+1]/10)*10 + shade;
      image.data[dest+2] = Math.round(pixels[p+2]/10)*10 + shade - 4;
      image.data[dest+3] = pixels[p+3];
    } else if (nearby.some(([dx,dy]) => pixels[4*((y+dy)*size+x+dx)+3]>110)) {
      image.data.set([52,36,25,192],dest);
    }
  }
  ctx.putImageData(image,0,0);
  return canvas.toDataURL('image/png');
}
