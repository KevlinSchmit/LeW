import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// A spoonful of grated root: a scalloped foot, folded sides and an off-center peak.
export function createWasabiMound(){
  const noise=new ImprovedNoise(), vertices=[], colors=[], indices=[];
  const rings=34, sides=96;
  const shadow=new THREE.Color(0x759628), flesh=new THREE.Color(0xc6db58), color=new THREE.Color();
  for(let i=0;i<=rings;i++){
    const r=i/rings;
    for(let j=0;j<sides;j++){
      const a=2*Math.PI*j/sides, u=r*Math.cos(a), w=r*Math.sin(a);
      const broad=noise.noise(3*u,3*w,4.2);
      const grit=noise.noise(18*u,18*w,8.7);
      const rim=1+.07*Math.sin(5*a+.5)+.045*Math.cos(9*a)+.065*broad;
      const body=Math.pow(1-r,.72);
      const x=.205*u*rim-.034*body, z=.175*w*rim+.018*body;
      const fold=Math.sin(15*r+3*broad+2*w)*.012;
      const y=.218*body+Math.min(1,7*(1-r))*(.044*broad+.021*grit+fold);
      vertices.push(x,Math.max(.001,y),z);
      color.copy(shadow).lerp(flesh,THREE.MathUtils.clamp(.50+.49*broad+.32*grit+.12*body,0,1));
      colors.push(color.r,color.g,color.b);
      if(i<rings){
        const k=i*sides+j, next=i*sides+(j+1)%sides;
        indices.push(k,next,k+sides,next,next+sides,k+sides);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mound=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}));
  // Close the underside of the ink shell so its rim also reads from overhead.
  const shell=geometry.clone();
  const rimStart=rings*sides;
  const shellIndices=indices.slice();
  for(let j=1;j<sides-1;j++)shellIndices.push(rimStart,rimStart+j,rimStart+j+1);
  shell.setIndex(shellIndices);
  const ink=new THREE.Mesh(shell,new THREE.MeshBasicMaterial({color:0x110f0b,side:THREE.BackSide}));
  ink.name='Wasabi ink contour';
  ink.scale.set(1.075,1.045,1.075);
  mound.add(ink);
  return mound;
}
