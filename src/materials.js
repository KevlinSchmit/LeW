import * as THREE from 'three';

/** A restrained photographic environment: wide warm sources, no point-like LEDs. */
export function makeReflectionStudio(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(.045,.028,.014);
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(35,22,35),
    new THREE.MeshBasicMaterial({color:new THREE.Color(.052,.034,.020),side:THREE.BackSide}),
  );
  studio.add(room);
  const cards = [];
  for (const [position,size,color] of [
    [[-6,8,4],[9,2.2],[5.2,2.7,1.1]],
    [[6,9,-3],[6,1.8],[3.7,1.8,.65]],
    [[0,10,-6],[5,3],[2.5,1.2,.4]],
    [[-5,-1,10],[3,8],[4.2,3.1,1.9]],
    [[-8,4,-8],[2,4],[.5,.64,.8]],
  ]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color:new THREE.Color(...color),side:THREE.DoubleSide}));
    card.position.set(...position);card.lookAt(0,1,0);studio.add(card);cards.push(card);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);
  const texture=pmrem.fromScene(studio,.025).texture;
  room.geometry.dispose();room.material.dispose();
  for(const card of cards){card.geometry.dispose();card.material.dispose();}
  pmrem.dispose();
  return texture;
}

/** Preserve Blender's authored normal/roughness maps while tuning the web finish. */
export function refineSurface(material) {
  const name=material.name;
  if(material.normalScale)material.normalScale.setScalar(name.includes('celadon') || name.includes('ceramic') ? .28 : .5);
  if(name.includes('Washi')) {
    material.color.set('#d59044');material.emissive.set('#ff9c36');material.emissiveIntensity=2.7;
  }
  if(name.includes('Night beyond'))material.emissiveIntensity=.065;
  if(name.includes('Salmon') || name.includes('Tuna')) {
    material.roughness=1;material.envMapIntensity=.8;
    if('clearcoat' in material){material.clearcoat=.14;material.clearcoatRoughness=.28;material.specularIntensity=.5;}
  }
  if(name.includes('Nori')) {material.roughness=1;material.envMapIntensity=.5;}
  if(name.includes('Pearl rice')) {
    material.color.setRGB(.90,.84,.71);material.roughness=1;material.envMapIntensity=.55;
  }
  if(name.includes('Ikura')) {
    material.roughness=.17;material.envMapIntensity=1.1;
    if('clearcoat' in material)material.clearcoat=.65;
  }
  if(name.includes('brass')) {material.metalness=.87;material.roughness=.85;material.envMapIntensity=1.1;}
  if(name.includes('champagne steel')) {material.metalness=.78;material.roughness=1;material.envMapIntensity=.8;}
  if(name.includes('celadon') || name.includes('ceramic') || name.includes('lacquer')) {
    material.roughness=1;material.envMapIntensity=.8;
    if('clearcoat' in material){material.clearcoat=.45;material.clearcoatRoughness=.16;}
  }
  if(name.includes('Honey oak')) {
    material.roughness=1;material.envMapIntensity=.65;
    if('clearcoat' in material){material.clearcoat=.28;material.clearcoatRoughness=.28;}
  }
}

export function makePlastic(source) {
  const material=new THREE.MeshPhysicalMaterial({
    name:'Clear molded food cover · thin PET',
    color:0xeadbc8, metalness:0, roughness:source.roughnessMap ? .4 : .018,
    roughnessMap:source.roughnessMap,
    normalMap:source.normalMap, normalScale:new THREE.Vector2(.18,.18),
    transmission:0, thickness:.022, ior:1.47,
    attenuationColor:new THREE.Color('#fff5e7'),attenuationDistance:18,
    transparent:true, opacity:.62, depthWrite:false,
    envMapIntensity:1.5, side:THREE.FrontSide,
    clearcoat:.5,clearcoatRoughness:.055,
    specularIntensity:1,
  });
  // Thin PET keeps its contents sharp. Reflected light increases toward grazing
  // angles, while broad softboxes and the rounded lip describe the clear shell.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      `float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.8);
       diffuseColor.a*=.055+.945*rim;
       #include <alphatest_fragment>`);
  };
  return material;
}
