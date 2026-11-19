import * as THREE from 'three';
import { makePorcelainFinishes } from './plate-patterns.js';

// From the underside to the center of the upper well. The raised foot and
// key line around the rolled outer lip hold up in silhouette when the dish turns.
const plateProfile = [
  [0,.044],[.46,.044],[.525,.016],[.552,.004],[.59,.004],[.613,.044],
  [.68,.056],[.80,.105],[.928,.185],[.984,.236],[1,.264],[.998,.280],
  [.980,.306],[.952,.314],[.902,.302],[.822,.269],[.731,.237],
  [.658,.225],[.575,.222],[0,.222],
];

function porcelainGeometry(radius,height) {
  const points=plateProfile.map(([r,y])=>new THREE.Vector2(r*radius,y*height));
  const geometry=new THREE.LatheGeometry(points,48);
  const {position,uv}=geometry.attributes;
  for(let i=0;i<uv.count;i++){
    const section=i%points.length;
    // Carry the transfer over the roll so its color is visible in a stack.
    const scale=(section>=11?.49:section===10?.475:.283)/radius;
    uv.setXY(i,.5+position.getX(i)*scale,.5-position.getZ(i)*scale);
  }
  return geometry;
}

function coverGeometry() {
  // The molded snap flange, slightly tapered skirt and two top rolls are
  // continuous in the same clear shell. The opening is at the bottom.
  const profile=[
    [1.79,.301],[1.843,.306],[1.855,.323],[1.850,.348],[1.821,.368],
    [1.808,.391],[1.796,.445],[1.790,.480],[1.776,.532],[1.759,.623],
    [1.720,1.124],[1.661,1.786],[1.637,1.940],
    [1.620,2.006],[1.585,2.034],[1.553,2.039],
    [1.533,2.021],[1.510,2.013],[1.480,2.020],
    [1.453,2.040],[1.426,2.043],[1.405,2.029],
    [1.378,2.011],[1.22,2.008],[.85,2.012],[.42,2.009],[0,2.005],
  ];
  return new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48);
}

function thinPet() {
  const material=new THREE.MeshPhysicalMaterial({
    name:'Clear molded food cover · thin PET',color:0xebeeed,roughness:.18,
    clearcoat:.55,clearcoatRoughness:.13,ior:1.48,specularIntensity:.5,
    transparent:true,depthWrite:false,envMapIntensity:.24,
  });
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vCoverLocal;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvCoverLocal=position;');
    shader.fragmentShader='varying vec3 vCoverLocal;\nfloat petBand(float x){return exp(-x*x);}\n'
      +shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 lidView=normalize(vViewPosition);
      float edge=pow(1.-clamp(dot(normalize(normal),lidView),0.,1.),2.6);
      float skirt=vCoverLocal.y;
      float r=length(vCoverLocal.xz);
      float rolled=petBand((skirt-.33)*41.)+.69*petBand((skirt-.45)*24.);
      float crown=smoothstep(1.94,2.033,skirt);
      rolled+=crown*(petBand((r-1.553)*48.)+.66*petBand((r-1.427)*64.));
      vec3 reflected=inverseTransformDirection(reflect(-lidView,normalize(normal)),viewMatrix);
      float strip=petBand((reflected.x+.35)*12.)*smoothstep(.13,.78,reflected.y);
      strip+=.58*petBand((reflected.x-.56)*16.)*smoothstep(.15,.88,reflected.y);
      strip*=.78+.22*sin(vCoverLocal.z*2.5+.6);
      float flow=.5+.5*sin(vCoverLocal.x*10.3+vCoverLocal.z*6.5+skirt*.62);
      float textureHint=pow(flow,10.)*crown*.017;
      diffuseColor.a=clamp(.028+.156*edge+.117*rolled+.231*strip+textureHint,.028,.52);
      outgoingLight=mix(outgoingLight,vec3(.55,.57,.55),.58);
      outgoingLight+=vec3(.59,.58,.51)*rolled*.49+vec3(.79,.77,.66)*strip*.79;
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'sushi thin molded pet v2';
  return material;
}

export function makeSushiTableware() {
  const porcelain=makePorcelainFinishes();
  const geometry=[
    porcelainGeometry(1.92,1),
    porcelainGeometry(1.6,.761),
    porcelainGeometry(1.5,.761),
  ];
  const lidGeometry=coverGeometry(), lidMaterial=thinPet();

  function plate(kind,design) {
    const dish=new THREE.Mesh(geometry[kind],porcelain[design%porcelain.length]);
    dish.name='Sushi plate · porcelain';
    dish.userData.sushiTableware=true;
    dish.castShadow=dish.receiveShadow=true;
    return dish;
  }
  function dressServing(serving,index){
    const lid=new THREE.Mesh(lidGeometry,lidMaterial);
    lid.name='Sushi cover · clear molded PET';
    lid.userData.sushiCover=true;
    lid.renderOrder=3;
    serving.add(plate(0,index),lid);
  }
  function dressStacks(stack){
    const columns=[...stack.children].sort((a,b)=>a.position.x-b.position.x);
    // Preserve the original fifteen and ten tiers, including the colors of the
    // upper browsing plates that visitors already recognize.
    const designs=[4,0,1,6,2];
    for(const [i,column] of columns.entries()){
      const superseded=[...column.children];
      column.clear();
      superseded.forEach(mesh=>mesh.geometry.dispose());
      for(let tier=0;tier<(i===0?15:10);tier++){
        const design=tier>=10 || i===1 ? designs[tier%5] : (tier+i)%porcelain.length;
        const dish=plate(i+1,design);
        dish.position.y=tier*.25;
        column.add(dish);
      }
    }
  }
  return {dressServing,dressStacks};
}
