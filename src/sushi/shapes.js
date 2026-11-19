import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './paint.js';

const tau=Math.PI*2;
const ink=new THREE.MeshBasicMaterial({name:'Sushi · black profile ink',color:0x120f0c,side:THREE.BackSide});
const power=(n,e)=>Math.sign(n)*Math.abs(n)**e;

function geometry(positions,uv,indices){
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function ringPoint(a,rx,rz,curve,jitter){
  const wrinkle=1+jitter*(.56*Math.sin(a*5+.4)+.44*Math.cos(a*9-1.1));
  return [rx*power(Math.cos(a),curve)*wrinkle,rz*power(Math.sin(a),curve)*wrinkle];
}

// Sections are [height, half width, half depth], in the dish coordinate system.
function body(rings,{segments=12,curve=.83,jitter=.035,open=false,closedBottom=!open}={}){
  const pos=[], uv=[], idx=[], n=segments+1;
  for(const [r,[height,rx,rz]] of rings.entries()){
    for(let j=0;j<=segments;j++){
      const a=j/segments*tau;
      const [x,z]=ringPoint(a,rx,rz,curve,jitter);
      const y=height+jitter*.31*Math.cos(5*a+.8*r);
      pos.push(x,y,z);
      uv.push(j/segments,r/(rings.length-1));
      if(r<rings.length-1 && j<segments){
        const i=r*n+j;
        idx.push(i,i+n,i+1,i+1,i+n,i+n+1);
      }
    }
  }
  for(const r of [0,rings.length-1]){
    if(r===0 ? !closedBottom : open)continue;
    const [height,rx,rz]=rings[r];
    const center=pos.length/3;
    pos.push(0,height,0);
    uv.push(.5,.5);
    for(let j=0;j<=segments;j++){
      const [x,z]=ringPoint(j/segments*tau,rx,rz,curve,jitter);
      pos.push(x,height+jitter*.31*Math.cos(j/segments*tau*5+.8*r),z);
      uv.push(.5+x/(2*rx),.5-z/(2*rz));
      if(j>0){
        if(r===0)idx.push(center,center+j,center+j+1);
        else idx.push(center,center+j+1,center+j);
      }
    }
  }
  return geometry(pos,uv,idx);
}

function cap(radius,depth,height,curve,segs){
  const pos=[0,height,0],uv=[.5,.5],idx=[];
  for(let i=0;i<=segs;i++){
    const [x,z]=ringPoint(i/segs*tau,radius,depth,curve,0);
    pos.push(x,height,z);
    uv.push(.5+.5*x/radius,.5-.5*z/depth);
    if(i>0)idx.push(0,i+1,i);
  }
  return geometry(pos,uv,idx);
}

function slice(sections,thickness,dome=.075){
  const p=[],uv=[],ids=[], spans=7,n=sections.length*spans;
  for(const bottom of [false,true]){
    for(const [i,[x,y,d,z=0]] of sections.entries()) for(let j=0;j<spans;j++){
      const v=j/(spans-1)*2-1;
      p.push(x,y+dome*(1-v*v)-.13*v*v+(bottom?-thickness:0),z+d*v);
      uv.push(i/(sections.length-1),j/(spans-1));
      const a=p.length/3-1;
      if(i<sections.length-1 && j<spans-1){
        if(bottom)ids.push(a,a+spans,a+1,a+1,a+spans,a+spans+1);
        else ids.push(a,a+1,a+spans,a+1,a+spans+1,a+spans);
      }
    }
  }
  const st=(a,b)=>ids.push(a,b+n,b,a,a+n,b+n);
  for(let i=0;i<sections.length-1;i++){
    st((i+1)*spans,i*spans);
    st(i*spans+spans-1,(i+1)*spans+spans-1);
  }
  for(let j=0;j<spans-1;j++){
    st(j,j+1);
    st(n-1-j,n-2-j);
  }
  return geometry(p,uv,ids);
}

function ribbon(top,x){
  const pos=[],uv=[],idx=[],sides=18;
  for(const [i,width] of [-.146,.146].entries()) for(let j=0;j<=sides;j++){
    const a=j/sides*tau,z=Math.cos(a)*.635;
    const y=.25+(top-.25)*(.5+.5*Math.sin(a));
    pos.push(x+width+.016*Math.sin(a),y,z);
    uv.push(i,j/sides);
    const a0=pos.length/3-1,n=sides+1;
    if(i===0&&j<sides)idx.push(a0,a0+n,a0+1,a0+1,a0+n,a0+n+1);
  }
  return geometry(pos,uv,idx);
}

function pebble(x,y,z,curve=.91){
  return body([[0,x*.64,z*.64],[y*.19,x,z],[y*.77,x*.95,z*.94],[y,x*.55,z*.58]],
    {segments:8,curve,jitter:.035});
}

function smallLeaf(w,h){
  return body([[0,w*.22,.017],[h*.28,w,.028],[h*.77,w*.69,.025],[h,w*.12,.014]],{segments:6,curve:1.1});
}

function finishParts(parts,paints,name){
  const group=new THREE.Group();
  group.name=name+' · low poly food';
  const buckets=new Map(),hulls=[];
  for(const p of parts){
    const geom=p.geometry.index?p.geometry.toNonIndexed():p.geometry;
    geom.applyMatrix4(p.matrix);
    if(!buckets.has(p.key))buckets.set(p.key,[]);
    buckets.get(p.key).push(geom);
    if(p.outline){
      const hull=geom.clone();
      const attr=hull.attributes.position,norm=hull.attributes.normal;
      for(let i=0;i<attr.count;i++)attr.setXYZ(i,
        attr.getX(i)+norm.getX(i)*.010,attr.getY(i)+norm.getY(i)*.010,attr.getZ(i)+norm.getZ(i)*.010);
      hulls.push(hull);
    }
  }
  for(const [key,geometries] of buckets){
    const mesh=new THREE.Mesh(mergeGeometries(geometries,false),paints[key]);
    mesh.name=key+' · painted food';
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
  }
  if(hulls.length){
    const contour=new THREE.Mesh(mergeGeometries(hulls,false),ink);
    contour.name='Sushi outline';
    contour.raycast=()=>{};
    group.add(contour);
  }
  for(const geometries of buckets.values())for(const item of geometries)item.dispose();
  hulls.forEach(g=>g.dispose());
  parts.forEach(({geometry:g})=>g.dispose());
  return group;
}

function builder(paints,name){
  const servings=[[]];
  let parts=servings[0];
  const axis=new THREE.Object3D();
  function add(key,geometry,p=[0,0,0],turn=[0,0,0],outline=true,transform){
    axis.position.fromArray(p);
    axis.rotation.set(...turn);
    axis.updateMatrix();
    const matrix=axis.matrix.clone();
    if(transform)matrix.premultiply(transform);
    parts.push({key,geometry,matrix,outline});
  }
  function nextPiece() {
    if (!parts.length) return;
    parts=[];
    servings.push(parts);
  }
  function finish() {
    if (servings.length===1) return finishParts(servings[0],paints,name);
    const dish=new THREE.Group();
    dish.name=name+' · individual sushi pieces';
    dish.userData.individualSushi=true;
    for (const portion of servings) dish.add(finishParts(portion,paints,name));
    return dish;
  }
  return {add,nextPiece,finish};
}

function nigiriBase(add,width=1){
  add('rice',body([[.235,.66*width,.37],[.315,.91*width,.49],[.65,.975*width,.51],[.79,.71*width,.405]],
    {curve:.76,jitter:.058}));
}

const toppings={
  ebi:[[-1.19,.76,.24],[-1.06,.89,.42],[-.77,1.03,.51],[-.45,1.07,.55],
    [-.08,1.08,.55],[.23,1.02,.50],[.53,.95,.46],[.80,.78,.35],[1.07,.70,.19],[1.20,.64,.11]],
  saba:[[-1.20,.65,.14],[-1.04,.89,.40],[-.72,1.03,.53],[-.31,1.09,.58],
    [.17,1.09,.59],[.62,1.01,.54],[.98,.84,.43],[1.16,.70,.31]],
  unagi:[[-1.28,.69,.27],[-1.14,.86,.50],[-.76,.99,.53],[-.28,1.06,.54],
    [.19,1.09,.53],[.62,.99,.52],[1.02,.86,.52],[1.24,.81,.42]],
  tako:[[-1.21,.73,.40,-.06],[-1.06,.91,.47,-.045],[-.69,1.04,.543,-.02],[-.21,1.10,.57,.025],
    [.24,1.10,.56,.04],[.69,.98,.54,.05],[1.01,.80,.54,.069],[1.15,.71,.41,.04]],
  hokkigai:[[-1.15,.65,.24,-.07],[-.97,.82,.42,-.04],[-.64,1.04,.62,0],[-.34,1.15,.64,.04],
    [.12,1.05,.51,.07],[.44,.98,.44,.08],[.70,.86,.33,.11],[1.03,.72,.18,.15],[1.20,.65,.08,.19]],
};

function nigiri(add,kind){
  nigiriBase(add,kind==='ebi'?.92:1);
  const material={ebi:'shrimp',saba:'mackerel',unagi:'eel',tako:'octopus',hokkigai:'clam'}[kind];
  add(material,slice(toppings[kind],.133,kind==='ebi'?.08:.04));
  if(kind==='ebi'){
    for(const s of [-1,1]){
      add('shrimp',slice([[.99,.65,.105,s*.082],[1.15,.59,.12,s*.12],
        [1.35,.54,.141,s*.221],[1.49,.48,.085,s*.30],[1.58,.459,.009,s*.355]],.049,.016));
    }
  }
  if(kind==='tako'){
    add('nori',ribbon(1.171,-.16));
    const points=[[.23,.88,.550],[.43,.83,.56],[.65,.76,.576],[.88,.69,.59],[1.03,.60,.572]];
    for(const [i,p] of points.entries()){
      add('octopus',pebble(.10-i*.007,.052,.082-i*.005),p,[1.25,0,.17],false);
    }
  }
  if(kind==='unagi'){
    add('nori',ribbon(1.166,.08));
    const random=seeded(211);
    for(let i=0;i<10;i++){
      const x=-.97+random()*1.9;
      const y=.979+.121*(1-Math.abs(x));
      add('sesame',pebble(.040,.019,.021),[x,y,.13+random()*.24],[0,random()*tau,.3],false);
    }
  }
}

function hotate(add){
  nigiriBase(add,.92);
  for(const side of [-1,1]){
    add('scallop',body([[.65,.32,.36],[.75,.49,.57],[1.04,.46,.56],[1.15,.33,.459]],
      {segments:13,curve:.85,jitter:.029}),[side*.444,0,side*.033],[0,side*.18,side*.074]);
  }
}

function wakameRibbon(knots,width,twist){
  const positions=[],uv=[],indices=[],steps=11;
  const path=new THREE.CatmullRomCurve3(knots);
  const point=new THREE.Vector3(),tangent=new THREE.Vector3(),across=new THREE.Vector3();
  const up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    path.getPoint(t,point);
    path.getTangent(t,tangent);
    across.crossVectors(up,tangent).normalize().applyAxisAngle(tangent,.57*Math.sin(t*7+twist));
    const halfWidth=width*.5*(.21+.79*Math.sin(Math.PI*t)**.63);
    for(const side of [-1,0,1]){
      const offset=halfWidth*side;
      positions.push(point.x+across.x*offset,point.y+across.y*offset+(side===0?.007:0),point.z+across.z*offset);
      uv.push(t,(side+1)/2);
    }
    if(i===0)continue;
    const previous=(i-1)*3, current=i*3;
    for(let j=0;j<2;j++)indices.push(previous+j,current+j,previous+j+1,previous+j+1,current+j,current+j+1);
  }
  return geometry(positions,uv,indices);
}

function inari(add,nextPiece){
  for(const [index,x,z,yaw] of [[0,-.74,.24,-.14],[1,.72,-.26,.19]]){
    nextPiece();
    const transform=new THREE.Object3D();
    transform.position.set(x,0,z);
    transform.rotation.y=yaw;
    transform.updateMatrix();
    const part=(key,mesh,position,rotation,outline)=>{
      add(key,mesh,position,rotation,outline,transform.matrix);
    };
    // The wall curls inward into a real opening, with a closed resting base.
    part('tofu',body([
      [.23,.535,.315],[.27,.628,.399],[.36,.706,.437],[.54,.729,.461],
      [.72,.725,.460],[.855,.719,.452],[.916,.701,.440],[.94,.666,.419],
      [.926,.634,.386],[.884,.613,.370],[.79,.597,.354],[.63,.569,.328],
    ],{segments:20,curve:.57,jitter:.041,open:true,closedBottom:true}));
    part('rice',body([
      [.49,.47,.295],[.70,.573,.346],[.824,.603,.368],[.903,.559,.341],[.933,.405,.246],
    ],{segments:16,curve:.68,jitter:.041}),undefined,undefined,false);
    const random=seeded(6291+index*124);
    for(let i=0;i<13;i++){
      const a=tau*i/13+.26*random();
      const p=.84+random()*.14;
      const w=.030+random()*.023, d=.016+random()*.013;
      part('rice',body([[0,w*.68,d*.7],[.012,w,d],[.023,w*.67,d*.63]],{segments:6,jitter:.015}),
        [.551*p*Math.cos(a),.89+random()*.049,.336*p*Math.sin(a)],[.14,a,-.26],false);
    }
    for(let i=0;i<27;i++){
      const turn=random()*tau;
      const phase=random()*tau;
      const sweep=1.9+random()*3.1;
      const reach=.19+random()*.29;
      const cx=(random()-.5)*.43, cz=(random()-.5)*.21;
      const rise=.065+random()*.27;
      const knots=[];
      for(let j=0;j<=6;j++){
        const t=j/6, a=phase+t*sweep;
        const sx=reach*Math.cos(a), sz=reach*(.36+.13*Math.sin(turn))*Math.sin(a);
        let px=cx+sx*Math.cos(turn)-sz*Math.sin(turn);
        let pz=cz+(sx*Math.sin(turn)+sz*Math.cos(turn))*.68;
        const spread=Math.max(1,Math.hypot(px/.641,pz/.397));
        px/=spread;
        pz/=spread;
        knots.push(new THREE.Vector3(px,.913+rise*Math.sin(Math.PI*t)**.78+.047*Math.sin(t*sweep+phase),pz));
      }
      part(i%5>2?'wakameLight':'wakame',wakameRibbon(knots,.055+random()*.049,turn),
        undefined,undefined,false);
    }
  }
}

function cup(add,x,z,{rx=.53,rz=.39,top=.94,seed=4}={}){
  const turn=[0,(seed%5)*.16,0];
  add('rice',body([[.245,rx*.73,rz*.75],[.37,rx*.81,rz*.81],[top-.18,rx*.78,rz*.78]],
    {segments:14,jitter:.02,curve:.80}),[x,0,z],turn,false);
  add('nori',body([[.243,rx*.93,rz*.93],[.38,rx,rz],[top-.061,rx*1.035,rz*1.035],
    [top,rx*.982,rz*.982],[top-.037,rx*.919,rz*.919],[top-.20,rx*.89,rz*.89]],
    {segments:14,open:true,jitter:.057,curve:.73}),[x,0,z],turn);
}

function uni(add){
  cup(add,0,0,{rx:.81,rz:.53,top:.94});
  for(const [i,[x,z,w,h,a]] of [[-.46,-.08,.28,.25,-.36],[-.18,-.08,.38,.39,.38],
    [.22,-.08,.33,.46,-.12],[.52,.01,.24,.33,-.49],[-.05,.25,.43,.255,.13],[.37,.23,.25,.26,.51]].entries()){
    add('uni',pebble(w,h,.257),[x,.85+(i%2)*.02,z],[.07,a,.11-i*.034],false);
  }
}

function tobiko(add){
  cup(add,0,.04,{rx:.767,rz:.528,top:.89,seed:15});
  add('roe',body([[.79,.67,.448],[.89,.742,.489],[1.025,.62,.43],[1.086,.44,.33]],
    {segments:12,jitter:.058,curve:.79}),[0,0,.04],undefined,false);
  for(const [i,x] of [-.44,-.24,-.03].entries()){
    add('cuke',smallLeaf(.094,.70+i*.10),[x,.89,-.25],[-.44,.64,-.35+i*.15],true);
  }
}

function salmonCup(add){
  cup(add,0,0,{rx:.77,rz:.55,top:.83,seed:8});
  const random=seeded(732);
  const chunks=[[-.46,.01],[-.15,.22],[.17,.22],[.47,.04],[-.31,-.25],[.13,-.25],[.01,-.03],[.39,-.22]];
  for(const [i,[x,z]] of chunks.entries()){
    add('salmon',pebble(.224,.24+random()*.17,.217,.35),[x,.74+(i===6?.12:0),z],
      [random()*.57-.26,random()*1.1,random()*.45-.11],i<4);
  }
  for(let i=0;i<8;i++){
    const angle=i*.79;
    add('herbs',smallLeaf(.051,.17),[.35*Math.cos(angle),1.06,.29*Math.sin(angle)],
      [1.32,angle,i*.29],false);
  }
}

function baked(add,nextPiece){
  for(const side of [-1,1]){
    nextPiece();
    const x=side*.56,z=side*.17;
    cup(add,x,z,{rx:.49,rz:.46,top:.76,seed:side+7});
    add('bake',body([[.63,.436,.41],[.80,.477,.433],[.99,.39,.36],[1.16,.23,.23],[1.21,.111,.107]],
      {curve:.85,jitter:.105,segments:11}),[x,0,z]);
    add('eel',slice([[-.30,1.042,.060],[0,1.197,.067],[.24,1.080,.070]],.023,.006),
      [x,0,z-.13],[0,side*.58,0],false);
    for(const t of [-.14,.075,.20])add('sesame',pebble(.043,.015,.025),[x+t,1.143-Math.abs(t)*.31,z+.13],[0,t*2,.13],false);
  }
}

function cutRoll(add,kind,pos,rot){
  const spec={
    tekka:[.425,.409,.70,.90,'nori'],
    california:[.56,.56,.77,.59,'roe'],
    philadelphia:[.55,.50,.80,.66,'salmon'],
  };
  const [rx,rz,len,curve,wrap]=spec[kind];
  const material=kind+'Face', s=14;
  add(wrap,body([[0,rx*.96,rz*.96],[len*.16,rx,rz],[len*.83,rx*.997,rz*.997],[len,rx*.96,rz*.96]],
    {segments:s,curve,jitter:0,open:true}),pos,rot);
  const transform=new THREE.Object3D();
  transform.position.fromArray(pos);
  transform.rotation.set(...rot);
  transform.updateMatrix();
  add(material,cap(rx*.96,rz*.96,len-.001,curve,s),undefined,undefined,false,transform.matrix);
  add(material,cap(rx*.96,rz*.96,.001,curve,s),undefined,[Math.PI,0,0],false,transform.matrix);
}

function rolls(add,kind,nextPiece){
  if(kind==='tekka'){
    cutRoll(add,kind,[-.59,.320,.40],[.17,-.23,.085]);
    nextPiece();
    cutRoll(add,kind,[.48,.294,.39],[.12,.15,-.065]);
    nextPiece();
    cutRoll(add,kind,[.02,.324,-.49],[.22,-.10,.09]);
  }else{
    const roeCoat=kind==='california';
    cutRoll(add,kind,[-.59,roeCoat?.83:.77,.33],[Math.PI/2-.32,.17,.12]);
    nextPiece();
    cutRoll(add,kind,[.53,roeCoat?.765:.717,roeCoat?.25:.08],[Math.PI/2-.20,-.11,-.14]);
    if(kind==='philadelphia'){
      for(const [i,x] of [.39,.57,.67].entries())
        add('herbs',smallLeaf(.042,.22),[x,1.24,.40],[1.39,-i*.5,-.4],false);
    }
  }
}

function temaki(add){
  const placement=new THREE.Object3D();
  placement.position.set(-.89,.30,-.15);
  placement.rotation.set(.37,0,-1.01);
  placement.updateMatrix();
  const cone=placement.matrix;
  add('nori',body([[0,.07,.065],[.23,.19,.17],[.75,.33,.29],[1.26,.545,.50],
    [1.52,.65,.57],[1.59,.633,.536],[1.42,.57,.47]],{segments:14,curve:1.18,jitter:.076,open:true}),
    undefined,undefined,true,cone);
  add('rice',body([[1.30,.50,.44],[1.51,.595,.50],[1.64,.50,.427],[1.69,.42,.356]],
    {segments:12}),undefined,undefined,false,cone);
  for(const [i,[x,z]] of [[-.22,.10],[.14,.15],[.22,-.12],[-.16,-.18],[-.005,-.06]].entries())
    add('salmon',pebble(.20,.194+.027*i,.156,.57),[x,1.57,z],[.18*i,-.20*i,.35],false,cone);
  add('cuke',smallLeaf(.111,.51),[.22,1.63,-.25],[-.24,.3,-.37],true,cone);
  add('herbs',smallLeaf(.10,.44),[-.23,1.66,-.17],[-.34,0,.46],true,cone);
}

const forms={hotate,inari,uni,tobiko,negisake:salmonCup,aburi:baked,temaki};

export function makeSushiFood(name,paints){
  const {add,nextPiece,finish}=builder(paints,name);
  if(toppings[name])nigiri(add,name);
  else if(forms[name])forms[name](add,nextPiece);
  else rolls(add,name,nextPiece);
  return finish();
}
