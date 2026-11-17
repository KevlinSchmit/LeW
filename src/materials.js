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

/** Small warm emitters seen only in the varnished wood, with crisp card edges. */
export function makeWoodReflections(renderer) {
  const room=new THREE.Scene();room.background=new THREE.Color('#100a05');
  const cards=[];
  for(const [position,size,power] of [
    [[-4,7,-10],[1.0,2.4],4.0],[[3,8,-9],[.65,1.8],2.6],
  ]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(...size),
      new THREE.MeshBasicMaterial({color:new THREE.Color(1,.68,.30).multiplyScalar(power),side:THREE.DoubleSide}));
    card.position.set(...position);card.lookAt(0,0,0);room.add(card);cards.push(card);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);
  const texture=pmrem.fromScene(room,0).texture;
  for(const card of cards){card.geometry.dispose();card.material.dispose();}
  pmrem.dispose();return texture;
}

/** Analytic rectangular reflections retain firm edges instead of a blurred env mip. */
function woodGlints(material) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vWoodWorldPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWoodWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 vWoodWorldPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 woodN=normalize(inverseTransformDirection(normal,viewMatrix));
      vec3 woodV=normalize(cameraPosition-vWoodWorldPosition);
      vec3 woodRay=reflect(-woodV,woodN);
      float woodT=(7.-vWoodWorldPosition.y)/max(woodRay.y,.0001);
      vec3 woodHit=vWoodWorldPosition+woodRay*woodT;
      float woodMask=0.;
      for(int i=0;i<2;i++){
        vec2 center=i==0?vec2(-5.6,-7.0):vec2(8.3,-8.5);
        vec2 size=i==0?vec2(1.6,.80):vec2(1.3,.90);
        vec2 delta=abs(woodHit.xz-center);
        vec2 inside=1.-smoothstep(size,size+vec2(.04,.08),delta);
        woodMask+=inside.x*inside.y;
      }
      float woodFresnel=.25+.75*pow(1.-max(dot(woodN,woodV),0.),3.);
      outgoingLight+=vec3(1.,.60,.22)*woodMask*woodFresnel*.85*step(0.,woodRay.y);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'wood-varnish-sharp-v1';
}

/** Keep brushwork visible and reserve specular response for material identity. */
export function refineSurface(material) {
  const name=material.name.toLowerCase();
  if(material.normalScale)material.normalScale.setScalar(.16);
  material.envMapIntensity=.035;
  if('clearcoat' in material)material.clearcoat=0;
  if('specularIntensity' in material)material.specularIntensity=.10;
  if(name.startsWith('chef')){
    material.roughness=.98;material.envMapIntensity=.015;
    if('specularIntensity' in material)material.specularIntensity=.03;
    if(name.includes('indigo woven')){material.emissiveMap=material.map;material.emissive.set('#b4c0df');material.emissiveIntensity=.45;}
  }else if(name.includes('honey oak')){
    // A smooth protective film sits over the painted, lightly textured wood.
    material.metalness=0;material.roughness=.32;material.envMapIntensity=.18;
    material.normalScale?.setScalar(.07);
    material.clearcoat=.85;material.clearcoatRoughness=.055;
    material.specularIntensity=.65;
    woodGlints(material);
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

/** Inverted hulls give the low-poly chef a readable black silhouette. */
export function outlineChef(root) {
  const outline=new THREE.MeshBasicMaterial({name:'CHEF · black outline',color:0x080605,side:THREE.BackSide});
  outline.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed=vec3(position+normal*.028);');
  };
  outline.customProgramCacheKey=()=> 'chef-outline-v1';
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(const mesh of meshes){
    const hull=new THREE.Mesh(mesh.geometry,outline);hull.name='Chef silhouette ink';
    hull.userData.chefOutline=true;hull.raycast=()=>{};hull.castShadow=false;hull.receiveShadow=false;
    mesh.add(hull);
  }
}
