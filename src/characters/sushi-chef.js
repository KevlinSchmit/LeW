import { FrontSide } from 'three';
import { createChefModel, loadChefTextures } from './createChefModel.ts';
import { floorY, pixelsPerMeter } from './chef-shape.ts';
import frontURL from './textures/front.jpg?inline';
import atlasURL from './textures/atlas.jpg?inline';

const landmark = (x, y, z) => [x / pixelsPerMeter, (floorY - y) / pixelsPerMeter, z / pixelsPerMeter];

export async function createSushiChef() {
  const chef = createChefModel({ textures: await loadChefTextures(frontURL, atlasURL) });
  chef.name = 'CHEF · reference reconstruction';
  // Match the fixed seated view: chin above the chest and sash at belt height.
  const sceneUnitsPerPixel = .0235;
  chef.scale.setScalar(sceneUnitsPerPixel * pixelsPerMeter);
  chef.position.set(0, 8.34 - (floorY - 185) * sceneUnitsPerPixel, -4.96);
  Object.assign(chef.userData, {
    procedural: true,
    static_character: true,
    landmarks: {
      hat: landmark(0, 24, 0),
      chin: landmark(0, 185, 48),
      chest: landmark(0, 360, 73),
      waist: landmark(0, 470, 75),
      feet: landmark(109, 1028, 85),
    },
  });
  // A small neutral bounce keeps the reference palette legible in the restaurant.
  for (const mesh of chef.userData.sculptRuntime.meshes) {
    const material = mesh.material;
    const kind = mesh.userData.materialId;
    const id = mesh.userData.componentId;
    // The full model remains available in the factory. The counter scene uses
    // the upper-body meshes above the belt and omits the lower-body assembly.
    if (/^(apron|trousers|leg-|shoe-|knot|tail-)/.test(id)) {
      mesh.removeFromParent();
      continue;
    }
    mesh.userData.noOutline = material.side !== FrontSide;
    material.name = `CHEF · ${mesh.userData.componentId} ${kind}`;
    if (kind === 'cloth' || kind === 'skin') {
      material.emissive.setHex(kind === 'cloth' ? 0xd8d9dc : 0xa7856e);
      material.emissiveMap = material.map;
      material.emissiveIntensity = kind === 'cloth' ? .25 : .12;
    }
  }
  return chef;
}
