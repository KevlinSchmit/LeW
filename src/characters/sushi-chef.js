import { Vector3, FrontSide } from 'three';
import { createChefModel, loadChefTextures } from './createChefModel.ts';
import { floorY, pixelsPerMeter } from './chef-shape.ts';
import frontURL from './textures/front.jpg?inline';
import atlasURL from './textures/atlas.jpg?inline';

const landmark = (x, y, z) => [x / pixelsPerMeter, (floorY - y) / pixelsPerMeter, z / pixelsPerMeter];

export async function createSushiChef() {
  const chef = createChefModel({ textures: await loadChefTextures(frontURL, atlasURL) });
  chef.name = 'CHEF · reference reconstruction';
  chef.scale.setScalar(11.27 * .73 / ((floorY - 24) / pixelsPerMeter));
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

// Fit the chin and sash to screen-space guides along the seated camera's centerline.
export function frameSushiChef(chef, camera) {
  camera.updateMatrixWorld(true);
  const slope = (screenY) => {
    const point = new Vector3(0, screenY, 0).unproject(camera).sub(camera.position);
    return point.y / point.z;
  };
  const top = slope(.94);
  const bottom = slope(-.92);
  const [, chinY, chinZ] = chef.userData.landmarks.chin.map(value => value * chef.scale.x);
  const [, waistY, waistZ] = chef.userData.landmarks.waist.map(value => value * chef.scale.x);
  const depth = (chinY - waistY - chinZ * top + waistZ * bottom) / (top - bottom);
  chef.position.set(0, camera.position.y + (depth + chinZ) * top - chinY, camera.position.z + depth);
}
