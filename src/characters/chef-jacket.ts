import * as THREE from 'three';
import { floorY, pixelsPerMeter, profiles, type Section } from './chef-shape';

type Point = [number,number,number];
type Pass = 'form'|'ink'|'shade';
const gaussian=(x:number,w:number)=>Math.exp(-((x/w)**2));
const ease=THREE.MathUtils.smoothstep;
const mix=THREE.MathUtils.lerp;
function angleTo(a:number,b:number) {
  const d=a-b;
  return d>Math.PI ? d-2*Math.PI : d < -Math.PI ? d+2*Math.PI : d;
}

// All three passes measure the same signed distance across a fold. The pen
// follows the concave side, and lifts before the fabric flattens at either end.
function crease(d:number,w:number,envelope:number,depth:number,pass:Pass) {
  if(envelope<.008 || Math.abs(d)>w*4)return 0;
  const q=d/w;
  if(pass==='form')return envelope*depth*(gaussian(q-.8,1.3)-1.12*gaussian(q+.52,.72));
  if(pass==='shade')return envelope*depth*.13*gaussian(q+.60,.74);
  const end=ease(envelope,.17,.85);
  const halfWidth=(.25+.45*end)*Math.min(1,depth/3.2);
  const distance=Math.abs(d+.64*w);
  return end*(1-ease(distance,Math.max(0,halfWidth-.23),halfWidth+.23));
}

function shoulderFold(a:number,h:number,side:number,pass:Pass) {
  const shoulder=gaussian(angleTo(a,.27),.62);
  const cap=h-(278+6*side)-21*Math.sin(a-.16)-4*Math.sin(2*a+.4);
  return crease(cap,7.1,shoulder,3.1,pass);
}

function bending(a:number,h:number,side:number,pass:Pass) {
  const sn=Math.sin(a),cs=Math.cos(a);
  const inner=gaussian(angleTo(a,-.18),.78),flank=gaussian(angleTo(a,-1.58),.54);
  const fork=gaussian(angleTo(a,1.44+.11*side),.52);
  return crease(h-352-13*sn,6.2,inner,4.4,pass)
    +crease(h-379+16*sn,6,inner,5.7,pass)
    +crease(h-400+8*sn,5.1,inner,3.4,pass)
    +crease(h-371+16*cs,7.2,flank,3.8,pass)
    +crease(h-370-20*Math.sin(a-.45)-3*side,5.8,fork,2.9,pass);
}

export function sleevePanel([x,y,z]:Point,a:number,t:number,row:Section,side:number):Point {
  const sn=Math.sin(a),cs=Math.cos(a),dx=x-row[1];
  const drape=shoulderFold(a,row[0],side,'form')-2.8*gaussian(angleTo(a,-1.32),.46)*gaussian(t-.36,.23);
  return [x+sn*drape,y-dx*mix(-.22,.38,ease(t,.12,.70))
    +1.8*Math.cos(2*a+.3)*ease(t,.55,1),z+cs*drape];
}

export function elbowCrease([x,y,z]:Point,a:number,_t:number,row:Section,side:number):Point {
  const sn=Math.sin(a),cs=Math.cos(a),h=row[0];
  const inner=gaussian(angleTo(a,-.18),1.05);
  const drawUp=4*gaussian(angleTo(a,0),.80)*gaussian(h-380,32);
  const fold=.93*bending(a,h,side,'form')-1.8*gaussian(angleTo(a,2.66),.78)*gaussian(h-374,26);
  const gather=inner*(2.9*gaussian(h-365+9*sn,14)-2.1*gaussian(h-395+7*sn,9));
  return [x+sn*fold,y+gather-drawUp,z+cs*fold];
}

export function cuffRoll([x,y,z]:Point,a:number,t:number):Point {
  const hem=ease(t,.72,1);
  const grip=.68+.32*gaussian(angleTo(a,0),.86);
  const lift=13*hem*grip;
  const rim=2.6*gaussian(t-.982,.054)*grip;
  return [x-.40*lift+rim*Math.sin(a),y-lift,z+rim*Math.cos(a)];
}

export function sleeveShadow(a:number,h:number,side:number) {
  return [shoulderFold(a,h,side,'shade'),bending(a,h,side,'shade')];
}

export function jacketDrape(x:number,y:number,a:number,pass:Pass='form') {
  const cs=Math.cos(a),front=Math.max(0,cs),back=Math.max(0,-cs),ax=Math.abs(x);
  const waist=ease(y,348,416)*(1-ease(y,433,452))*(front+.72*back);
  const leftPull=x+53-.25*(y-409),rightPull=x-39+.30*(y-404);
  const junction=1-.96*Math.max(gaussian(leftPull+5,12),gaussian(rightPull+6,12));
  const diagonal=gaussian(ax-76,16)*gaussian(y-299,35)*(front+.72*back)*ease(ax,50,72);
  return crease(leftPull,8.5,waist,3.3,pass)
    +crease(rightPull,10,waist,2.8,pass)
    +crease(y-298-.56*(ax-72),10,diagonal,2.5,pass)
    +crease(y-299+.64*(ax-53),9.5,back*gaussian(ax-57,30)*gaussian(y-301,55),5.3,pass)
    +crease(ax-48-.25*(y-387),7,back*gaussian(y-392,52)*gaussian(ax-53,34),4.5,pass)
    +crease(y-431-8*Math.sin(x*.041),7.8,front*gaussian(x-8,40)*junction,3.0,pass)
    +crease(y-408+x*.27+3.8*Math.sin(.056*x+.2),7.3,front*gaussian(x+28,32)*junction,2.2,pass);
}

function chestDraw(x:number,y:number,side:number,pass:Pass) {
  const across=x*side,panel=gaussian(across-74,23)*gaussian(y-297,39)*ease(across,50,73);
  return crease(y-290+.78*(across-72),8,panel,4.4,pass);
}

export function chestTension([x,y,z]:Point,a:number,_t:number,_r:Section,side:number):Point {
  const cs=Math.cos(a),lift=chestDraw(x,y,side,'form');
  return [x+side*.20*lift,y-2.7*gaussian(x*side-72,27)*gaussian(y-297,39),z+cs*lift];
}

function waistDraw(x:number,y:number,cs:number,pass:Pass) {
  const exposure=Math.max(0,cs)+.31*Math.max(0,-cs);
  const gap=1-.88*Math.max(gaussian(x+58-.25*(y-409),12),gaussian(x-33+.30*(y-404),12));
  const belt=ease(y,365,395)*(1-ease(y,443,457))*exposure*gap;
  return crease(y-410+.17*x+3.2*Math.sin(.043*x+.4),8,belt,4.2,pass)+crease(y-432-.12*x-4.3*Math.cos(x*.047),7,belt,3.0,pass);
}

export function waistCompression([x,y,z]:Point,a:number):Point {
  const cs=Math.cos(a),belt=ease(y,365,395)*(1-ease(y,443,457));
  return [x,y-1.4*Math.max(0,cs)*belt,z+waistDraw(x,y,cs,'form')];
}

// This is a linear coverage map, with one channel per pose control. The
// renderer mixes the channels using the very weights that deform the panel.
export function clothInk(body:boolean,side:number,geometry:THREE.BufferGeometry,pivot:THREE.Vector3) {
  const width=1024,height=768,data=new Uint8Array(width*height*4);
  const {longitude,latitude}=geometry.userData.grid;
  const pos=geometry.getAttribute('position');
  const originX=pivot.x*pixelsPerMeter,originY=floorY-pivot.y*pixelsPerMeter;
  for(let j=0;j<height;j++){
    const t=1-(j+.5)/height;
    const level=t*(profiles.sleeve.length-1),row=Math.floor(level);
    const h=mix(profiles.sleeve[row][0],profiles.sleeve[row+1][0],level-row);
    for(let i=0;i<width;i++){
      const u=(i+.5)/width,a=(2*u-1)*Math.PI,k=4*(j*width+i);
      if(body){
        const fx=u*longitude,fy=t*latitude,col=Math.floor(fx),r=Math.floor(fy),s=fx-col,b=fy-r;
        const v0=r*(longitude+1)+col,v1=v0+longitude+1;
        const base=s+b<=1?v0:v1+1, wa=s+b<=1?s:1-s, wb=s+b<=1?b:1-b;
        const a1=s+b<=1?v0+1:v1,a2=s+b<=1?v1:v0+1,w0=1-wa-wb;
        const x=originX+pixelsPerMeter*(w0*pos.getX(base)+wa*pos.getX(a1)+wb*pos.getX(a2));
        const y=originY-pixelsPerMeter*(w0*pos.getY(base)+wa*pos.getY(a1)+wb*pos.getY(a2));
        const cs=Math.cos(a);
        data[k]=255*Math.min(1,jacketDrape(x,y,a,'ink'));
        data[k+1]=255*Math.min(1,chestDraw(x,y,1,'ink')*Math.abs(cs));
        data[k+2]=255*Math.min(1,chestDraw(x,y,-1,'ink')*Math.abs(cs));
        data[k+3]=255*Math.min(1,waistDraw(x,y,cs,'ink'));
      }else{
        data[k]=255*Math.min(1,shoulderFold(a,h,side,'ink'));
        data[k+1]=255*Math.min(1,bending(a,h,side,'ink'));
      }
    }
  }
  const tex=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  tex.wrapS=THREE.RepeatWrapping;
  tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=true;tex.anisotropy=4;tex.needsUpdate=true;
  return tex;
}

// The top jacket ring fits the neck at the actual height of each point
// on the V. Continue that fitted opening smoothly into the first torso row.
export function necklineFit(x:number,y:number,z:number,a:number,level:number):[number,number] {
  if(level>=1)return [x,z];
  const rows=profiles.neck;
  const i=rows.findIndex(r=>r[0]>=y);
  if(i<=0)return [x,z];
  const p=rows[i-1],q=rows[i],t=(y-p[0])/(q[0]-p[0]);
  const sn=Math.sin(a),cs=Math.cos(a),d=cs>0?4:5;
  const rx=mix(p[3],q[3],t)+1.45,rz=mix(p[d],q[d],t)+1.65;
  // The sternomastoid relief is already part of the exposed neck surface.
  const neckX=sn*rx,tendon=Math.abs(neckX)-mix(17,7,ease(y,175,242));
  const relief=Math.max(0,cs)*(3.2*gaussian(tendon,5)*gaussian(y-213,26)-2*gaussian(neckX,8)*gaussian(y-238,9));
  return [mix(sn*rx,x,ease(level,0,1)),mix(mix(p[2],q[2],t)+cs*rz+relief,z,ease(level,0,1))];
}

type UV=[number,number];
type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;

// Two sewn facings share one nape seam. Across the chest the near flap
// continues to the sash and the underflap tapers into their intersection.
export function wrapFacing(torso:THREE.BufferGeometry,cols:number,rows:number,pivot:THREE.Vector3) {
  const pos=torso.getAttribute('position'),norm=torso.getAttribute('normal');
  const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
  const field=(uv:UV,attr:Attribute)=>{
    const x=uv[0]*cols,y=uv[1]*rows,i=Math.min(cols-1,Math.floor(x)),j=Math.min(rows-1,Math.floor(y));
    const s=x-i,t=y-j,a=j*(cols+1)+i,b=a+cols+1,low=s+t<=1;
    const sample=new THREE.Vector3().fromBufferAttribute(attr,low?a:b+1).multiplyScalar(low?1-s-t:s+t-1);
    return sample.addScaledVector(new THREE.Vector3().fromBufferAttribute(attr,low?a+1:b),low?s:1-s)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(attr,low?b:a+1),low?t:1-t);
  };
  function at(uv:UV) {
    const p=field(uv,pos).add(pivot).multiplyScalar(pixelsPerMeter);
    return {x:p.x,y:floorY-p.y};
  }
  function frontAt(x:number,y:number):UV {
    function uAt(v:number){
      let lo=.251,hi=.749;
      for(let k=0;k<15;k++){
        const u=(lo+hi)/2;
        if(at([u,v]).x<x)lo=u;else hi=u;
      }
      return (lo+hi)/2;
    }
    let lo=0,hi=1;
    for(let k=0;k<15;k++){
      const v=(lo+hi)/2;
      if(at([uAt(v),v]).y<y)lo=v;else hi=v;
    }
    const v=(lo+hi)/2;
    return [uAt(v),v];
  }
  const morphs=(torso.morphAttributes.position??[]).map((attr,i)=>({
    name:attr.name,position:attr,normal:torso.morphAttributes.normal[i],delta:[] as number[],normalDelta:[] as number[]
  }));
  const samples=[0,.025,.065,.19,.69,.96,1];
  const lift=[.68,1.07,1.38,1.60,1.38,.96,.52];
  const shades=['#352f29','#5e574c','#e9e3d5','#ede8db','#e9e4d6','#dfd8c8','#a69b89'].map(c=>new THREE.Color(c));
  const baseN:number[]=[];
  const binding=new THREE.Color('#736153');
  function vertex(uv:UV,k:number,over:number,turnIn=false){
    const p=field(uv,pos),n=field(uv,norm).normalize(),offset=(lift[k]+over)/pixelsPerMeter;
    p.addScaledVector(n,offset);
    if(turnIn){
      const angle=2*Math.PI*(uv[0]-.5);
      p.addScaledVector(new THREE.Vector3(-4*Math.sin(angle),-.85,-4.6*Math.cos(angle)),1/pixelsPerMeter);
    }
    positions.push(...p.toArray());baseN.push(...n.toArray());colors.push(...(turnIn?binding:shades[k]).toArray());
    uvs.push(samples[k],1-uv[1]);
    for(const m of morphs){
      const normalDelta=field(uv,m.normal);
      m.normalDelta.push(...normalDelta.toArray());
      m.delta.push(...field(uv,m.position).addScaledVector(normalDelta,offset).toArray());
    }
    return positions.length/3-1;
  }
  const tri=(a:number,b:number,c:number)=>{
    const A=new THREE.Vector3().fromArray(positions,3*a),B=new THREE.Vector3().fromArray(positions,3*b),C=new THREE.Vector3().fromArray(positions,3*c);
    const n=B.sub(A).cross(C.sub(A));
    if(n.lengthSq()<1e-22)return;
    if(n.dot(new THREE.Vector3().fromArray(baseN,3*a))>0)indices.push(a,b,c);else indices.push(a,c,b);
  };
  const tip=at([.5,0]),width=24,drop=12,slope=.40;
  for(const side of [-1,1]){
    const outer=frontAt(side*width,tip.y+drop);
    let previous:number[]=[];
    function section(inner:UV,outer:UV,over=0){
      const row=samples.map((s,k)=>vertex([mix(inner[0],outer[0],s),mix(inner[1],outer[1],s)],k,over));
      for(let k=1;k<previous.length;k++){
        tri(previous[k-1],row[k-1],previous[k]);tri(previous[k],row[k-1],row[k]);
      }
      previous=row;
    }
    let lastEdge=-1,lastLining=-1;
    for(let j=0;j<=32;j++){
      const t=j/32,u=.5+(1-t)*side*.5,inside:UV=[u,0];
      let lo=0,hi=.29;
      const origin=field(inside,pos);
      for(let k=0;k<13;k++){
        const v=(lo+hi)/2;
        if(field([u,v],pos).distanceTo(origin)*pixelsPerMeter<width)lo=v;else hi=v;
      }
      const radial:UV=[u,(lo+hi)/2];
      if(t>.54){
        const p=at(inside),across=frontAt(p.x+side*width,p.y+drop);
        const blend=ease(t,.54,.85);
        radial[0]=mix(radial[0],across[0],blend);radial[1]=mix(radial[1],across[1],blend);
      }
      const over=side>0?1.25*ease(t,.81,1):0;
      section(inside,radial,over);
      const edge=previous[0],lining=vertex(inside,0,over,true);
      if(j>0){tri(lastEdge,lastLining,edge);tri(edge,lastLining,lining);}
      lastEdge=edge;lastLining=lining;
    }
    if(side>0){
      for(let j=1;j<=43;j++){
        const y=mix(tip.y,455,j/43),x=-slope*(y-tip.y);
        const endDrop=drop*(1-ease(y,420,455));
        section(frontAt(x,y),frontAt(x+width,y+endDrop),1.25*(1-ease(y,400,455)));
      }
    }else{
      const endY=tip.y+(width+slope*drop)/(2*slope),endX=-slope*(endY-tip.y);
      for(let j=1;j<9;j++){
        const f=j/9;
        section(frontAt(mix(0,endX,f)+.35*Math.sin(Math.PI*f),mix(tip.y,endY,f)),
          frontAt(mix(-width,endX,f),mix(at(outer).y,endY,f)));
      }
      const tipIndex=vertex(frontAt(endX,endY),5,0);
      for(let k=1;k<previous.length;k++)tri(previous[k-1],tipIndex,previous[k]);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
  // The fold is pressed flat. Surface normals shared with the shirt avoid a
  // visible lighting break where the two halves meet behind the neck.
  g.setAttribute('normal',new THREE.Float32BufferAttribute(baseN,3));
  g.morphTargetsRelative=true;
  for(const m of morphs){
    const delta=new THREE.Float32BufferAttribute(m.delta,3);delta.name=m.name;
    (g.morphAttributes.position??=[]).push(delta);
    const normalDelta=new THREE.Float32BufferAttribute(m.normalDelta,3);
    normalDelta.name=m.name;(g.morphAttributes.normal??=[]).push(normalDelta);
  }
  return g;
}
