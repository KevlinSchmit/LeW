import { createChefModel, loadChefTextures } from './createChefModel.ts';
import { floorY, pixelsPerMeter } from './chef-shape.ts';
import frontURL from './textures/front.jpg?inline';
import atlasURL from './textures/atlas.jpg?inline';

const landmark = (x, y, z) => [x / pixelsPerMeter, (floorY - y) / pixelsPerMeter, z / pixelsPerMeter];

export async function createSushiChef() {
  const chef = createChefModel({ textures: await loadChefTextures(frontURL, atlasURL) });
  chef.name = 'CHEF · reference reconstruction';
  chef.position.set(0, -1.25, -10.6);
  chef.scale.setScalar(11.27 * .73 / ((floorY - 24) / pixelsPerMeter));
  Object.assign(chef.userData, {
    procedural: true,
    static_character: true,
    landmarks: {
      hat: landmark(0, 24, 0),
      chin: landmark(0, 173, 52),
      chest: landmark(0, 360, 73),
      waist: landmark(0, 470, 75),
      feet: landmark(109, 1028, 85),
    },
  });
  // A small neutral bounce keeps the reference palette legible in the restaurant.
  for (const mesh of chef.userData.sculptRuntime.meshes) {
    const material = mesh.material;
    const kind = mesh.userData.materialId;
    mesh.userData.noOutline = material.side !== 0;
    material.name = `CHEF · ${mesh.userData.componentId} ${kind}`;
    if (kind === 'cloth' || kind === 'skin') {
      material.emissive.setHex(kind === 'cloth' ? 0xd8d9dc : 0xa7856e);
      material.emissiveMap = material.map;
      material.emissiveIntensity = kind === 'cloth' ? .25 : .12;
    }
  }
  return chef;
}
