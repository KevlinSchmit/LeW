import * as THREE from 'three';

/** Small, firm reflection cards: a game asset rig, without softbox bloom. */
export function makeReflectionStudio(renderer) {
  const studio=new THREE.Scene();
  studio.background=new THREE.Color('#211c17');
  const cards=[];
  for(const [position,size,color] of [
    [[-8,6,4],[.35,3],'#bc9266'],
  ]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
    card.position.set(...position);card.lookAt(0,1,0);studio.add(card);cards.push(card);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);
  const texture=pmrem.fromScene(studio,.04).texture;
  for(const card of cards){card.geometry.dispose();card.material.dispose();}
  pmrem.dispose();return texture;
}

/** Keep brushwork visible and reserve specular response for material identity. */
export function refineSurface(material) {
  const name=material.name.toLowerCase();
  if(material.normalScale)material.normalScale.setScalar(.16);
  material.envMapIntensity=.035;
  if('clearcoat' in material)material.clearcoat=0;
  if('specularIntensity' in material)material.specularIntensity=.10;
  if(name.includes('washi')){
    material.color.set('#dfd09a');material.emissive.set('#e6cb8c');material.emissiveIntensity=1.1;
  }else if(name.includes('night beyond')){
    material.color.set('#1d2428');material.emissiveIntensity=.035;
  }else if(name.includes('salmon') || name.includes('tuna') || name.includes('tamagoyaki')){
    material.roughness=.96;material.envMapIntensity=.025;
    if('specularIntensity' in material)material.specularIntensity=.08;
  }else if(name.includes('rice') || name.includes('nori')){
    material.roughness=1;material.envMapIntensity=.04;
  }else if(name.includes('ikura')){
    material.roughness=.55;material.envMapIntensity=.12;
  }else if(name.includes('brass')){
    material.metalness=.65;material.roughness=.5;material.envMapIntensity=.32;
  }else if(name.includes('steel')){
    material.metalness=.4;material.roughness=.65;material.envMapIntensity=.14;
  }else if(name.includes('celadon') || name.includes('ceramic') || name.includes('lacquer')){
    material.roughness=.98;material.envMapIntensity=.025;
  }else{
    material.roughness=Math.max(material.roughness,.8);
  }
  if(material.map){
    // Native texel density stays visible up close, with mipmaps for distant props.
    material.map.magFilter=THREE.NearestFilter;
    material.map.minFilter=THREE.LinearMipmapLinearFilter;
  }
}

export function makePlastic(source,bottle=false) {
  const material=new THREE.MeshPhysicalMaterial({
    name:bottle ? 'Bottle glass · thick green edges' : 'Clear molded food cover · thin PET',
    color:bottle ? '#9ba98c' : '#e0dfc5',metalness:0,roughness:bottle ? .09 : .18,
    normalMap:source.normalMap,normalScale:new THREE.Vector2(.025,.025),
    transmission:0,thickness:bottle ? .10 : .018,ior:bottle ? 1.52 : 1.46,
    transparent:true,opacity:1,depthWrite:false,envMapIntensity:bottle ? .30 : .18,
    side:THREE.FrontSide,clearcoat:0,specularIntensity:bottle ? .35 : .20,
  });
  // Clear center, firm rim: keep the painted food sharp through the thin shell.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      `float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.2);
       diffuseColor.a*=${bottle ? '.09+.68*rim' : '.025+.34*rim'};
       #include <alphatest_fragment>`);
  };
  material.customProgramCacheKey=()=>bottle ? 'painted-bottle-v1' : 'painted-pet-v1';
  return material;
}
