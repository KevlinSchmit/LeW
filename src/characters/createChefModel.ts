import * as THREE from 'three';
import { sleevePanel, sleeveShadow, elbowCrease, cuffRoll, chestTension, jacketDrape, waistCompression, necklineFit, clothInk, wrapFacing } from './chef-jacket';
import { centerX, floorY, pixelsPerMeter, profiles, shoulderLevels, type Section } from './chef-shape';

type RGB = [number, number, number];
type Point = [number, number, number];
type PixelSource = { data: Uint8ClampedArray; width: number; height: number };
export type ChefTextures = { front: PixelSource; atlas: PixelSource };
export type ChefOptions = { textures?: ChefTextures; stage?: 'blockout'|'form'|'material'; };
type Kind = 'cloth' | 'skin' | 'hair' | 'shoe';
type Surface = {
  id: string;
  rows: readonly Section[];
  kind: Kind;
  pivot: Point;
  side?: 1 | -1;
  columns?: number;
  shape?: number;
  arc?: number;
  front?: number;
  passes?: 'form';
  modify?: (point: Point, angle: number, t: number, row: Section) => Point;
  folds?: Record<string,(p:Point, angle:number, t:number, row:Section)=>Point>;
  swatch?: (u: number, v: number, point: Point) => [number, number];
};

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, f: number) => a + (b - a) * f;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x-a)/(b-a));
  return t*t*(3-2*t);
};
const gauss = (x: number, w: number) => Math.exp(-Math.pow(x/w, 2));
const meters = (p: Point) => new THREE.Vector3(p[0]/pixelsPerMeter, (floorY-p[1])/pixelsPerMeter, p[2]/pixelsPerMeter);
const power = (x: number, n: number) => Math.sign(x)*Math.pow(Math.abs(x),n);

const palette: Record<Kind, RGB> = {
  cloth:[208,201,190], skin:[180,132,100], hair:[48,43,39], shoe:[56,51,45]
};
const roughness: Record<Kind, number> = {cloth:.91, skin:.79, hair:.85, shoe:.73};

function samplePoint(def: Surface, u: number, t: number, fold?: string): Point {
  const rowIndex = t*(def.rows.length-1);
  const index = Math.min(def.rows.length-2, Math.floor(rowIndex));
  const a = def.rows[index], b = def.rows[index+1];
  const row = a.map((value,i)=>mix(value,b[i],rowIndex-index)) as unknown as Section;
  const [y,x,z,rx,front,rear] = row;
  const theta = (u*2-1)*(def.arc ?? Math.PI);
  const sn = Math.sin(theta), cs = Math.cos(theta), n = def.shape ?? 1;
  const point: Point = [x+power(sn,n)*rx,y,z+power(cs,n)*(cs>=0 ? front:rear)];
  const cut = def.modify?.(point,theta,t,row) ?? point;
  const [finalX, finalY, finalZ] = (fold && def.folds) ? def.folds[fold](cut,theta,t,row) : cut;
  return [finalX*(def.side ?? 1), finalY, finalZ];
}

function read(source: PixelSource, x: number, y: number): RGB {
  const x0 = Math.max(0,Math.min(source.width-2, Math.floor(x)));
  const y0 = Math.max(0,Math.min(source.height-2, Math.floor(y)));
  const fx = clamp(x-x0), fy = clamp(y-y0);
  const offset = (y0*source.width+x0)*4;
  const line = source.width*4;
  return [0,1,2].map(c=>mix(mix(source.data[offset+c],source.data[offset+4+c],fx),
    mix(source.data[offset+line+c],source.data[offset+line+4+c],fx),fy)) as RGB;
}

function bake(def: Surface, reference: ChefTextures): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const w = canvas.width = def.id === 'torso' || def.id === 'head' ? 512 : 256;
  const h = canvas.height = def.rows.at(-1)![0]-def.rows[0][0] > 180 ? 512 : 256;
  const ctx = canvas.getContext('2d')!;
  const buffer = ctx.createImageData(w,h);
  const forearm = def.id.startsWith('forearm-'), hand = def.id.startsWith('hand-');
  const sign = def.side ?? 1;
  const armSample = (y: number, lateral: number) => {
    const station = clamp((y-432)/84);
    const safeY = mix(432,516,station);
    const center = 149+(safeY-386)*54/143;
    return read(reference.front,centerX-518+sign*(center+lateral*mix(12,6,station)),safeY-8);
  };
  const jacket=def.id==='torso' || def.id.startsWith('sleeve-');
  const wristColor = forearm || hand ? armSample(516,0) : null;
  for (let j=0; j<h; j++) {
    const v = j/(h-1);
    for (let i=0; i<w; i++) {
      const u = i/(w-1), theta = (2*u-1)*(def.arc ?? Math.PI);
      const point = samplePoint(def,u,v);
      const [x,y] = point;
      const swatchU = def.id === 'apron' || def.id === 'hair' ? u : .5+.5*Math.sin(theta);
      const backCoord = def.swatch?.(swatchU,v,point);
      const tint = 2*Math.sin(theta*29+v*6)*Math.sin(v*69+u*48);
      let back = backCoord ? read(reference.atlas,backCoord[0]-1003,backCoord[1]-25) :
        palette[def.kind].map(channel=>channel+tint) as RGB;
      if (backCoord && def.kind==='cloth' && back[0]<139) {
        // The shaped atlas islands have dark gutters around their perimeter.
        // A swatch close to a gutter falls back to fabric from the same panel.
        back=read(reference.atlas,backCoord[0]-1003,Math.max(28,backCoord[1]-25));
        if(back[0]<139)back=read(reference.atlas,214,65);
      }
      if (backCoord && def.kind==='skin' && back[0]<130) {
        back=read(reference.atlas,375,94);
      }
      let sampleX = x;
      let sampleY = y;
      if(def.id==='neck' && y>177){
        // Keep white pixels from the photographed collar out of the throat.
        // Follow the taper of exposed skin in the reference on both sides.
        sampleY=y>215?215+20*Math.tanh((y-215)/20):y;
        const half=Math.max(4,Math.min(28,(248-sampleY)*.52-2));
        const core=.62*half,margin=half-core;
        if(Math.abs(x)>core)sampleX=Math.sign(x)*(core+margin*Math.tanh((Math.abs(x)-core)/margin));
      }
      if (def.id === 'sash' && Math.abs(x)<20) sampleX += 36;
      if (def.id === 'apron' && y<546 && Math.abs(x)<40) sampleX += x<0 ? -42:42;
      let source = read(reference.front,sampleX+centerX-518,sampleY-8);
      let weight = (def.front ?? 1)*smooth(.11,.56,Math.cos(theta));
      if (def.id === 'head') weight = smooth(.10,.48,Math.cos(theta));
      // Suppress background bleed at silhouettes, cap tops, and recessed overlaps.
      if (def.kind === 'skin' && def.id !== 'head' && source[0]-source[2]<(def.id==='neck'?27:18)) weight=0;
      if (def.kind === 'cloth' && source[0]-source[2]>37) weight=0;
      if (def.kind === 'cloth' && source[0]<145) {
        const isLettering = def.id==='torso' && x>27 && x<69 && y>260 && y<342;
        if (!isLettering) weight *= smooth(121,147,source[0]);
      }
      if (def.kind === 'shoe' && source[0]>95) weight *= 1-smooth(95,123,source[0]);
      if (def.id==='cap' && y<27 && Math.abs(x)>20) weight *= .5;
      if (def.id.startsWith('shoe') && y>1033) {
        const sole = 1-.24*smooth(1033,1037,y);
        source = source.map(channel=>channel*sole) as RGB;
        for (let c=0;c<3;c++) back[c] *= sole;
      }
      if (def.kind==='cloth' && weight<1) {
        const textile = read(reference.atlas,155+142*(.5+.5*Math.sin(theta*2+v*2.3)),
          184+84*v);
        const grain = Math.sin(theta*57+v*110)*Math.sin(theta*39-v*83)
          + .55*Math.sin(theta*173+v*191)*Math.sin(theta*91-v*176);
        const weaveTone = (textile[0]-205)*.23+2.1*grain;
        const foldTone = garmentFold(def.id,swatchU,v,y);
        for(let c=0;c<3;c++)back[c] += weaveTone+foldTone;
      }
      if (forearm || hand) {
        // The reference has a hard cutout and a sleeve across the projected
        // arm. Sample inside the exposed skin, never across those borders.
        // The heel and distal forearm share a circumferential wrist colour.
        const skin = forearm ? armSample(y,Math.sin(theta)) : wristColor!;
        const wristBlend = forearm ? smooth(.65,.97,v) : 1;
        const detail = hand ? .26*smooth(.14,.65,v) : 0;
        for (let c=0;c<3;c++) {
          const base=mix(skin[c],wristColor![c],wristBlend);
          source[c]=base+detail*THREE.MathUtils.clamp(back[c]-base,-25,25);
        }
        weight=1;
      }
      if(jacket) {
        // Keep the reference calligraphy. Let the animated panel normals carry
        // most of the folds instead of projecting static photographic shadows.
        const lettering=def.id==='torso' && x>27 && x<69 && y>260 && y<342
          ? (1-smooth(88,161,source[0]))*smooth(.20,.58,Math.cos(theta)) : 0;
        const fiber=mix(back[0],source[0],weight)-205;
        const grain=THREE.MathUtils.clamp(fiber*.23,-10,7);
        const sleeveSeam=def.id.startsWith('sleeve-')
          ? 20*gauss(y-(412-14*Math.sin(theta)),1.25)
          : 25*gauss(Math.abs(theta)-Math.PI,.021)+Math.max(0,-Math.cos(theta))*(
              13*gauss(y-299+.64*(Math.abs(x)-53)+5,5.8)*gauss(Math.abs(x)-57,29)
              +11*gauss(Math.abs(x)-48-.25*(y-387)+3,4.3)*gauss(y-392,47));
        const base=[234,229,216];
        for(let c=0;c<3;c++) source[c]=mix(base[c]+grain-sleeveSeam,source[c],lettering);
        weight=1;
      }
      const offset = (j*w+i)*4;
      for(let c=0;c<3;c++) buffer.data[offset+c] = mix(back[c],source[c],weight);
      buffer.data[offset+3] = 255;
    }
  }
  ctx.putImageData(buffer,0,0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildGeometry(def: Surface, pivot: THREE.Vector3, stage: string, fold?:string) {
  const longitude = stage==='blockout' ? 12 : def.columns ?? 24;
  const subdivisions = stage==='blockout' ? 1 : def.id==='hair' ? 14
    : def.id.startsWith('sleeve-') || def.id==='torso' ? 5 : def.id==='head' || def.id.startsWith('forearm-') ? 3 : 2;
  const latitude = (def.rows.length-1)*subdivisions;
  const positions: number[] = [], uv: number[] = [], index: number[] = [];
  function add(p: THREE.Vector3,u: number,v: number) {
    positions.push(p.x,p.y,p.z);
    uv.push(u,1-v);
  }
  const triangle = (a:number,b:number,c:number) => {
    if (def.side===-1) index.push(a,c,b);
    else index.push(a,b,c);
  };
  for (let j=0;j<=latitude;j++){
    for (let i=0;i<=longitude;i++){
      const u=i/longitude, v=j/latitude;
      add(meters(samplePoint(def,u,v,fold)).sub(pivot),u,v);
      if(j<latitude && i<longitude){
        const a=j*(longitude+1)+i, b=a+longitude+1;
        triangle(a,b,a+1);
        triangle(a+1,b,b+1);
      }
    }
  }
  const sleeve=def.id.startsWith('sleeve-');
  const vertexColors:number[]=[];
  if(sleeve) {
    for(let n=0;n<positions.length/3;n++)vertexColors.push(1,1,1);
    let previous=latitude*(longitude+1);
    // Turn the fabric back into the sleeve. There is an open lumen around
    // the forearm, a 0.9-pixel hem and a shaded inside facing.
    for(const [inset,t,shade] of [[.9,1,.84],[1.15,.986,.65],[1.3,.949,.58],[1.5,.87,.51],[1.4,.76,.48]]) {
      const first=positions.length/3;
      for(let i=0;i<=longitude;i++){
        const u=i/longitude,a=(u*2-1)*Math.PI,pt=samplePoint(def,u,t,fold);
        pt[0]-=(def.side??1)*inset*Math.sin(a);
        pt[2]-=inset*Math.cos(a);
        add(meters(pt).sub(pivot),u,t);
        vertexColors.push(shade,shade,shade);
        if(i<longitude){
          triangle(previous+i,first+i,previous+i+1);
          triangle(previous+i+1,first+i,first+i+1);
        }
      }
      previous=first;
    }
  } else if (!def.arc) {
    for (const j of def.id==='torso'?[latitude]:[0,latitude]) {
      const center = new THREE.Vector3();
      const v=j/latitude;
      const start = positions.length/3;
      for (let i=0;i<=longitude;i++){
        const point = meters(samplePoint(def,i/longitude,v)).sub(pivot);
        add(point,i/longitude,v);
        if(i<longitude) center.addScaledVector(point,1/longitude);
      }
      const c = positions.length/3;
      if (def.id==='cap' && j===0) center.y += 2.6/pixelsPerMeter;
      add(center,.5,v);
      for (let i=0;i<longitude;i++){
        if(j===0) triangle(c,start+i,start+i+1);
        else triangle(c,start+i+1,start+i);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if(vertexColors.length){
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(vertexColors,3));
    if(!fold){
      const shade:number[]=[];
      for(let j=0;j<=latitude;j++){
        const t=j/latitude,level=t*(def.rows.length-1), row=Math.min(Math.floor(level),def.rows.length-2);
        const h=mix(def.rows[row][0],def.rows[row+1][0],level-row);
        for(let i=0;i<=longitude;i++)shade.push(...sleeveShadow((2*i/longitude-1)*Math.PI,h,def.side??1));
      }
      for(let i=0;i<5*(longitude+1);i++)shade.push(0,0);
      geometry.setAttribute('clothCrease',new THREE.Float32BufferAttribute(shade,2));
    }
  }
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  if (!def.arc) {
    const normals = geometry.getAttribute('normal');
    for(let j=0;j<=(sleeve?latitude+5:latitude);j++) {
      const a=j*(longitude+1), b=a+longitude;
      const n = new THREE.Vector3().fromBufferAttribute(normals,a)
        .add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
      normals.setXYZ(a,n.x,n.y,n.z);
      normals.setXYZ(b,n.x,n.y,n.z);
    }
  }
  geometry.userData.grid={longitude,latitude};
  if(!fold && def.folds && stage!=='blockout'){
    geometry.morphTargetsRelative=true;
    for(const name of Object.keys(def.folds)){
      const target=buildGeometry(def,pivot,stage,name);
      for(const channel of ['position','normal'] as const){
        const src=geometry.getAttribute(channel), dst=target.getAttribute(channel);
        const delta=new Float32Array(src.count*3);
        for(let i=0;i<delta.length;i++)delta[i]=dst.array[i]-src.array[i];
        const attr=new THREE.BufferAttribute(delta,3);attr.name=name;
        (geometry.morphAttributes[channel]??=[]).push(attr);
      }
      target.dispose();
    }
  }
  return geometry;
}

// Remap the back jacket to the full atlas silhouette, including the neck band
// and the cloth under each arm. At each height, use the interior of its outline.
function backJacket(u:number,_v:number,p:Point): [number,number] {
  const h=clamp((p[1]-191)/267);
  const y=mix(32,167,h);
  const halfWidth=y<40?mix(14,22,clamp((y-32)/8)):
    y<49?mix(22,41,clamp((y-40)/9)):mix(41,56,smooth(49,79,y));
  return [1219+(u*2-1)*halfWidth,y];
}

function garmentFold(id:string,u:number,v:number,y:number) {
  const side = Math.abs(u-.5)*2;
  if(id==='torso') {
    const lower = smooth(335,441,y);
    const hipFold = (y-430+16*Math.sin(u*6.5))*1.4;
    const waist = lower*(17*gauss(hipFold+11,7)-18*gauss(hipFold,8)
      +11*gauss(hipFold-13,8));
    const scapula = gauss(y-290,50)*(-11*gauss(side-.64-.09*Math.sin(y*.075),.086)
      +9*gauss(side-.47,.14));
    const seam = -5*gauss(side,.025)*smooth(197,245,y);
    return waist+scapula+seam;
  }
  if(id.startsWith('sleeve')) {
    const diagonal = side-.22-.33*v;
    const creases = Math.sin(Math.PI*v)*(10*gauss(diagonal+.07,.08)
      -13*gauss(diagonal,.07)+7*gauss(side-.77+.16*v,.13));
    const cuff = -9*gauss(y-410-14*side,5)+6*gauss(y-417-14*side,5);
    return creases+cuff;
  }
  if(id==='apron')return 6*Math.sin(u*24+v*4)*smooth(.1,.65,v);
  return 0;
}


export function createChefModel(options: ChefOptions = {}): THREE.Group {
  const stage = options.stage ?? 'material';
  const root = new THREE.Group();
  root.name = 'Sushi Chef';
  const parts: THREE.Group[] = [];
  const meshes: THREE.Mesh[] = [];
  const pivots = new Map<THREE.Object3D,THREE.Vector3>([[root,new THREE.Vector3()]]);
  let fabricRoughness: THREE.DataTexture | null = null;
  if (stage==='material') {
    const size = 64;
    const weave = new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const value=241+5*Math.cos(x*Math.PI/2)*Math.sin(y*Math.PI/2)+3*Math.sin((x+y)*Math.PI/8);
      const offset=(y*size+x)*4;
      weave.set([value,value,value,255],offset);
    }
    fabricRoughness = new THREE.DataTexture(weave,size,size);
    fabricRoughness.wrapS = fabricRoughness.wrapT = THREE.RepeatWrapping;
    fabricRoughness.repeat.set(7,5);
    fabricRoughness.magFilter = THREE.LinearFilter;
    fabricRoughness.minFilter = THREE.LinearMipmapLinearFilter;
    fabricRoughness.generateMipmaps = true;
    fabricRoughness.needsUpdate = true;
  }

  function add(def: Surface, parent: THREE.Group = root) {
    const node = new THREE.Group();
    const pivot = meters(def.pivot);
    node.name = def.id;
    node.userData.componentId = def.id;
    node.position.copy(pivot).sub(pivots.get(parent)!);
    parent.add(node);
    pivots.set(node,pivot);
    parts.push(node);
    if (stage==='blockout' && def.passes==='form') return node;
    const map = stage==='material' && options.textures ? bake(def,options.textures) : null;
    const color = map ? 0xffffff : stage==='material' ? new THREE.Color().setRGB(...palette[def.kind].map(v=>v/255) as RGB,THREE.SRGBColorSpace) : 0xb2b2b2;
    const material = new THREE.MeshStandardMaterial({
      color,map,roughness:roughness[def.kind],metalness:0,vertexColors:def.id.startsWith('sleeve-'),
      roughnessMap:def.kind==='cloth' ? fabricRoughness : null,
      flatShading:stage==='blockout' || def.id.startsWith('shoe') || def.id.startsWith('hand'),
      side:def.arc ? THREE.DoubleSide : THREE.FrontSide
    });
    const geometry=buildGeometry(def,pivot,stage);
    if(stage==='material' && options.textures && (def.id==='torso'||def.id.startsWith('sleeve-'))){
      material.userData.clothInk=clothInk(def.id==='torso',def.side??1,geometry,pivot);
    }
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = def.id+' surface';
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData = { componentId: def.id, materialId: def.kind };
    meshes.push(mesh);
    node.add(mesh);
    return node;
  }

  const torso = add({id:'torso',rows:profiles.torso,kind:'cloth',pivot:[0,447,0],columns:64,shape:.74,
    folds:{leftDraw:(p,a,t,r)=>chestTension(p,a,t,r,1),rightDraw:(p,a,t,r)=>chestTension(p,a,t,r,-1),waistFold:waistCompression},
    swatch:backJacket, modify:([x,y,z],theta,t)=>{
      const cs = Math.cos(theta);
      const level = t*(profiles.torso.length-1);
      if (level<shoulderLevels.length) {
        const i=Math.floor(level), f=level-i;
        const [sternum,shoulder,spine]=shoulderLevels[i].map((value,j)=>
          mix(value,shoulderLevels[i+1]?.[j] ?? profiles.torso[i+1][0],f));
        // The front dips to the V at the sternum. Behind it, the trapezius
        // carries the neck into the shoulder rather than spanning the neck with a lid.
        const across = 1-Math.abs(Math.sin(theta));
        y = mix(shoulder,cs>=0 ? sternum : spine,Math.pow(across,cs>=0 ? 1.15 : 1.6));
        z -= 18*gauss(level,.8)*Math.max(0,cs)*smooth(0,.78,Math.abs(Math.sin(theta)));
      }
      [x,z]=necklineFit(x,y,z,theta,level);
      z+=Math.sign(cs)*jacketDrape(x,y,theta);
      return [x,y,z];
    }});
  if(stage!=='blockout'){
    const body=meshes.find(m=>m.userData.componentId==='torso')!;
    const {longitude,latitude}=body.geometry.userData.grid;
    const geo=wrapFacing(body.geometry,longitude,latitude,pivots.get(torso)!);
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,side:THREE.DoubleSide});
    const facing=new THREE.Mesh(geo,mat);
    facing.name='Wrap collar';facing.userData={componentId:'collar',materialId:'cloth'};
    facing.castShadow=true;torso.add(facing);meshes.push(facing);
  }
  const neck = add({id:'neck',rows:profiles.neck,kind:'skin',pivot:[0,214,0],
    modify:([x,y,z],theta)=>{
      const front=Math.max(0,Math.cos(theta));
      const tendon=Math.abs(x)-mix(17,7,smooth(175,242,y));
      z+=front*(3.2*gauss(tendon,5)*gauss(y-213,26)-2*gauss(x,8)*gauss(y-238,9));
      return [x,y,z];
    }},torso);
  const head = add({id:'head',rows:profiles.skull,kind:'skin',pivot:[0,171,0],columns:52,shape:.85,
    modify:([x,y,z],theta)=>{
      const front = smooth(.22,.87,Math.cos(theta));
      const ax=Math.abs(x);
      const brow=5*gauss(ax-20,13)*gauss(y-97-.07*ax,5);
      const eye=-6.5*gauss(ax-21,10)*gauss(y-108,6);
      const bridge=11*gauss(x+1,8)*gauss(y-119,17);
      const tip=19*gauss(x+1,7.5)*gauss(y-132,5.4);
      const alae=6*gauss(ax-8,4)*gauss(y-134,3.7);
      const cheeks=4*gauss(ax-33,12)*gauss(y-122,9);
      const mouth=3.6*gauss(x,16)*gauss(y-153,4)-2.1*gauss(x,14)*gauss(y-154,1.6);
      z+=front*(brow+eye+bridge+tip+alae+cheeks+mouth);
      return [x,y,z];
    }},neck);
  // This portion of the scalp starts under the cap. Its perimeter follows the
  // skull cross-section at each height so the exposed temples and nape stay attached.
  const hairRows: readonly Section[] = [[74,0,0,1,1,1],[145,0,0,1,1,1]];
  add({id:'hair',rows:hairRows,kind:'hair',pivot:[0,82,-10],columns:36,arc:2.26,passes:'form',front:0,
    swatch:(u,v)=>[mix(1009,1123,u),mix(399,468,v)], modify:(_point,theta,t)=>{
      const angle=theta+Math.PI;
      const side=Math.abs(Math.sin(angle)), rear=-Math.cos(angle);
      const hairline=mix(109,144,smooth(-.5,1,rear)) - 7*gauss(side-.92,.14);
      const y=mix(72,hairline,t);
      const sample=profiles.skull.findIndex(row=>row[0]>=y);
      const a=profiles.skull[sample-1], b=profiles.skull[sample];
      const [,,center,width,face,back]=a.map((v,i)=>mix(v,b[i],(y-a[0])/(b[0]-a[0])));
      const sn=Math.sin(angle), cs=Math.cos(angle);
      return [power(sn,.85)*(width+2.5),y,center+power(cs,.85)*((cs>=0 ? face:back)+3)];
    }},head);
  add({id:'cap',rows:profiles.cap,kind:'cloth',pivot:[0,79,0],columns:24,shape:.76,
    swatch:(u,v)=>[mix(1300,1406,.5+.5*Math.sin(2*Math.PI*u)),mix(45,62,v)],
    modify:([x,y,z],theta,t)=>[x,y+(1-smooth(0,.55,t))*9*Math.pow(Math.abs(Math.sin(theta)),1.7),z-7*Math.max(0,-Math.cos(theta))]},head);
  const trouserSwatch = (u:number,y:number): [number,number] =>
    [mix(1018,1064,u),mix(190,375,smooth(493,970,y))];
  const waist = add({id:'trousers',rows:profiles.waist,kind:'cloth',pivot:[0,520,0],front:0,
    swatch:(u,_v,p)=>trouserSwatch(u,p[1]),
    modify:([x,y,z],theta,t)=>[x,y,z+12*smooth(.35,1,t)*smooth(0,.75,-Math.cos(theta))]});
  const sash = add({id:'sash',rows:profiles.sash,kind:'cloth',pivot:[0,470,0],columns:32,shape:.76,
    swatch:(u,v)=>[mix(1144,1212,u),mix(178,193,v)]});
  add({id:'apron',rows:profiles.apron,kind:'cloth',pivot:[0,486,0],columns:40,arc:2.95,shape:.79,
    swatch:(u,v)=>[mix(1155,1305,u),mix(205,296,v)],modify:([x,y,z],theta,t)=>{
      const pleat=2.4*Math.sin(10*theta+t*4.5)+1.4*Math.sin(18*theta-t*3);
      z+=pleat*Math.sin(Math.PI*t/2)*Math.cos(theta);
      x+=pleat*Math.sin(theta)*.45;
      y-=t*t*10*Math.pow(Math.abs(Math.sin(theta)),4);
      return [x,y,z];
    }},sash);
  const knot = add({id:'knot',rows:profiles.knot,kind:'cloth',pivot:[0,471,69],passes:'form',
    swatch:(u,v)=>[mix(1220,1236,u),mix(181,195,v)]},sash);

  for (const side of [1,-1] as const) {
    const suffix=side===1?'l':'r';
    add({id:'ear-'+suffix,rows:profiles.ear,kind:'skin',pivot:[side*47,120,-2],side,
      columns:16,passes:'form',swatch:(u,v)=>[mix(1135,1150,u),mix(401,441,v)],
      modify:([x,y,z],theta)=>{
        z -= 4.5*Math.max(0,Math.cos(theta))*gauss(y-127,9)*gauss(x-53,5);
        x -= 3.2*smooth(.12,.8,Math.sin(theta))*gauss(y-127,9)*gauss(z+4,8);
        return [x,y,z];
      }},head);
    const sleeve = add({id:'sleeve-'+suffix,rows:profiles.sleeve,kind:'cloth',pivot:[side*91,243,0],side,
      columns:44,shape:.81,swatch:(u,v)=>[mix(1310,1331,u),mix(111,145,v)],
      modify:(p,a,t,r)=>sleevePanel(p,a,t,r,side),folds:{elbowFold:(p,a,t,r)=>elbowCrease(p,a,t,r,side), ...(side===1 ? { cuffRoll } : {})}},torso);
    const forearm = add({id:'forearm-'+suffix,rows:profiles.forearm,kind:'skin',pivot:[side*155,410,0],side,columns:24,
      swatch:(u,v)=>[mix(1363,1397,u),mix(96,144,v)],
      modify:([x,y,z],theta,t,row)=>{
        // Perpendicular section planes and a round, concentric wrist keep
        // the forearm silhouette smooth when the palm turns over.
        const end = smooth(.58,1,t);
        const center = mix(row[1],149+(y-386)*54/143,end);
        const depth = mix(row[2],2+(y-386)*9/143,end);
        const dx = mix(x-row[1],13.3*Math.sin(theta),end);
        const dz = mix(z-row[2],13.3*Math.cos(theta),end);
        return [center+dx,y-dx*54/143-dz*9/143,depth+dz];
      }},sleeve);
    add({id:'hand-'+suffix,rows:profiles.fist,kind:'skin',pivot:[side*199,531,10],side,columns:14,shape:.74,swatch:(u,v)=>[mix(1355,1398,u),mix(280,315,v)],
      modify:([x,y,z],theta,t,row)=>{
        y -= (x-row[1])*(.17+.10*smooth(.6,1,t));
        const thumb=6*gauss(y-564,14)*gauss(x-191,9)*Math.max(0,Math.cos(theta));
        return [x,y,z+thumb];
      }},forearm);
    add({id:'tail-'+suffix,rows:profiles.tail,kind:'cloth',pivot:[side*10,482,80],side,
      columns:12,shape:.65,passes:'form',swatch:(u,v)=>[mix(1183,1200,u),mix(209,249,v)],
      modify:([x,y,z],theta,t,row)=>[x,y-(x-row[1])*t*.21,z+2.1*Math.cos(3*theta)]},knot);
    const leg = add({id:'leg-'+suffix,rows:profiles.leg,kind:'cloth',pivot:[side*45,525,-5],side,columns:26,shape:.84,
      swatch:(u,_v,p)=>trouserSwatch(u,p[1]),
      modify:([x,y,z],theta,t,row)=>{
        // Boxier inner quarters of the upper legs overlap the crotch loft.
        const waistBlend = 1-smooth(514,567,y);
        if (x<row[1]) {
          const cs=Math.cos(theta);
          z=mix(z,row[2]+power(cs,.24)*(cs>=0?row[4]:row[5]),waistBlend);
        }
        const wav = t*(3*Math.sin(theta*4+1.5)*gauss(y-836,39)
            +4*Math.sin(theta*4+y*.089)*gauss(y-929,47));
        z+=wav*Math.cos(theta);
        if(y>958) y-=4*Math.abs(Math.sin(theta))*smooth(958,973,y);
        return [x,y,z];
      }},waist);
    add({id:'shoe-'+suffix,rows:profiles.shoe,kind:'shoe',pivot:[side*86,970,-10],side,columns:12,shape:.72,
      swatch:(u,v)=>[mix(1352,1409,.5+.5*Math.sin(u*Math.PI*2)),mix(402,414,v)],
      modify:([x,y,z],theta,t,row)=>{
        x+=.18*(z-row[2]);
        y-=11*clamp((t-.5)*2)*(1-Math.max(0,Math.cos(theta)));
        return [x,y,z];
      }},leg);
  }
  root.userData.sculptRuntime = {
    parts, meshes, facing:'+Z', scale:'meters',
    restTranslations:parts.map(node=>node.position.clone()),
    dispose() {
      fabricRoughness?.dispose();
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.map?.dispose();
        material.dispose();
      }
    },
  };
  return root;
}

export async function loadChefTextures(frontUrl: string, atlasUrl: string): Promise<ChefTextures> {
  async function load(src: string): Promise<PixelSource> {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', {willReadFrequently:true})!;
    ctx.drawImage(image,0,0);
    return ctx.getImageData(0,0,canvas.width,canvas.height);
  }
  const [front,atlas] = await Promise.all([load(frontUrl),load(atlasUrl)]);
  return {front,atlas};
}
