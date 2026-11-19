import * as THREE from 'three';

const material=(color,roughness=.78,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function group(parent,name) {
  const g=new THREE.Group(); g.name=name; parent.add(g); return g;
}
function mesh(parent,geometry,mat,x=0,y=0,z=0) {
  const m=new THREE.Mesh(geometry,mat); m.position.set(x,y,z);
  m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
function box(parent,mat,x,y,z,w,h,d) {return mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
function fin(parent,points,mat) {
  const s=new THREE.Shape();
  points.forEach(([x,z],i)=>i ? s.lineTo(x,-z) : s.moveTo(x,-z));
  s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.022,bevelEnabled:false});
  g.rotateX(-Math.PI/2);
  return mesh(parent,g,mat,0,.12,0);
}

// A dressed salmon lying on its side. Adjacent portions share identical rim
// coordinates. Their orange cut faces only become visible as the cuts separate.
function makeFish(tray) {
  const fish=group(tray,'WholeSalmon');
  fish.position.y=.123;
  const profile=[[-1.02,.05,.055],[-.87,.12,.09],[-.63,.225,.145],[-.38,.29,.17],
    [0,.335,.19],[.35,.33,.18],[.62,.27,.15],[.82,.22,.13],[1.02,.07,.075],[1.07,.012,.02]];
  function section(x) {
    let i=0;
    while(i<profile.length-2 && x>profile[i+1][0])i++;
    const [a,b]=profile.slice(i,i+2),t=(x-a[0])/(b[0]-a[0]);
    return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];
  }
  const cuts=[-.61,-.34,-.07];
  const stations=[profile[0][0],...cuts,profile.at(-1)[0]];
  const flank=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.12,side:THREE.DoubleSide});
  const flesh=material(0xee835e), fat=material(0xffc6a0);
  flesh.side=fat.side=THREE.DoubleSide;
  const colors=[0x345c63,0x72949a,0xaac1b9,0xe0dbc7].map(c=>new THREE.Color(c));
  const pieces=[];
  const ring=(x,a)=>{
    const [w,h]=section(x);
    return [x,.14+h*.95*Math.sin(a),w*Math.cos(a)];
  };
  for(let j=0;j<stations.length-1;j++) {
    const p=group(fish,'SalmonPortion'+j); pieces.push(p);
    const start=stations[j],end=stations[j+1];
    const rows=[start,...profile.map(r=>r[0]).filter(x=>x>start && x<end),end];
    const positions=[],tints=[],indices=[];
    for(const [k,x] of rows.entries()) for(let i=0;i<=28;i++) {
      const a=i*2*Math.PI/28,zone=(1-Math.cos(a))*.5;
      const band=zone*2.99,n=Math.floor(band);
      const color=colors[n].clone().lerp(colors[n+1],band-n);
      color.multiplyScalar(1+.05*Math.sin(15*x+2*a));
      positions.push(...ring(x,a));tints.push(color.r,color.g,color.b);
      if(k<rows.length-1 && i<28) {
        const q=k*29+i;
        indices.push(q,q+30,q+29,q,q+1,q+30);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
    // Looking along +X, the ring travels from +Z toward +Y.
    for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    geo.setIndex(indices);geo.computeVertexNormals();mesh(p,geo,flank);
    const markings=[];
    for(let spot=0;spot<53;spot++){
      const x=-.89+((spot*.618034)%1)*1.46;
      if(x<start+.02 || x>end-.02)continue;
      const angle=.29+((spot*.381966+Math.sin(spot*4.14)*.24+1)%1)*.91;
      const onSkin=(u,a)=>{const p=ring(u,a);p[1]+=.0025;p[2]+=.0025;return p;};
      for(let k=0;k<7;k++){
        const edge=i=>onSkin(x+.016*Math.cos(2*Math.PI*i/7),angle+.063*Math.sin(2*Math.PI*i/7));
        markings.push(...onSkin(x,angle),...edge(k),...edge(k+1));
      }
    }
    const spots=new THREE.BufferGeometry();
    spots.setAttribute('position',new THREE.Float32BufferAttribute(markings,3));spots.computeVertexNormals();
    const spotMat=material(0x46676b);spotMat.side=THREE.DoubleSide;
    if(markings.length)mesh(p,spots,spotMat);
    for(const [x,sign] of [[start,-1],[end,1]]) {
      const [w,h]=section(x);
      const disc=new THREE.CircleGeometry(1,28);
      disc.rotateY(sign*Math.PI/2);disc.scale(1,h*.95,w);
      mesh(p,disc,flesh,x,.14,0);
      for(const f of [-.54,0,.54]) {
        const arc=[];
        for(let k=0;k<=8;k++) {
          const z=(k/4-1)*w*.76;
          arc.push(new THREE.Vector3(x+sign*.0015,.14+h*(f+.22*(1-Math.abs(z/w))),z));
        }
        mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc),8,.008,4,false),fat);
      }
    }
  }
  const finMat=material(0x526f70);
  fin(pieces[0],[[-.96,0],[-1.33,-.26],[-1.27,-.03],[-1.36,.24],[-1.01,.10]],finMat);
  fin(pieces[3],[[.35,-.24],[.03,-.48],[-.04,-.29]],finMat);
  const eyeX=.82,eyeZ=-.045;
  const eye=mesh(pieces[3],new THREE.SphereGeometry(.076,14,8),material(0xdac493),eyeX,.265,eyeZ);
  eye.scale.y=.40;
  const pupil=mesh(pieces[3],new THREE.SphereGeometry(.045,12,8),material(0x172425,.28),eyeX,.291,eyeZ);
  pupil.scale.y=.42;
  const gill=Array.from({length:9},(_,i)=>{
    const a=.25+2.5*i/8, [x,y,z]=ring(.61-.07*Math.sin(a),a);
    return new THREE.Vector3(x,y+.004,z);
  });
  mesh(pieces[3],new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gill),12,.012,5,false),finMat);
  return {pieces,cuts};
}

function makeKnife(stage) {
  const knife=group(stage,'ChefKitchenKnife');
  const grip=material(0x57402d),ferrule=material(0x282b29),flat=material(0xd8e5e7,.34,.30);
  const handle=new THREE.CylinderGeometry(.116,.14,.92,8);
  handle.rotateX(Math.PI/2);
  mesh(knife,handle,grip);
  const collar=new THREE.CylinderGeometry(.119,.122,.17,8);collar.rotateX(Math.PI/2);
  mesh(knife,collar,ferrule,0,0,.39);
  // The cutting edge, spine and polished bevel meet at an actual tapered tip.
  const pos=[],colors=[];
  const stations=[[.46,-.215,.095,.034],[.77,-.218,.10,.031],[1.13,-.198,.09,.022],[1.40,-.135,.073,.014],[1.62,.035,.038,.003]];
  for(const side of [-1,1]) {
    for(let i=0;i<stations.length-1;i++) {
      const [a,b]=stations.slice(i,i+2);
      const rail=([z,low,top,width])=>[[side*.002,low,z],[side*width,low+.055,z],[side*width,top,z]];
      const [r,s]=[rail(a),rail(b)];
      for(let band=0;band<2;band++) {
        const tint=new THREE.Color(band ? 0x9aadb2 : 0xf0f6ec);
        const facets=[r[band],s[band],s[band+1],r[band],s[band+1],r[band+1]];
        if(side===1)facets.reverse();
        for(const pt of facets) {
          pos.push(...pt);colors.push(tint.r,tint.g,tint.b);
        }
      }
    }
  }
  for(let i=0;i<stations.length-1;i++){
    const [az,,ay,aw]=stations[i], [bz,,by,bw]=stations[i+1];
    for(const pt of [[-aw,ay,az],[-bw,by,bz],[bw,by,bz],[-aw,ay,az],[bw,by,bz],[aw,ay,az]]) {
      pos.push(...pt);colors.push(.85,.92,.94);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
  flat.emissive.setHex(0x697e83);flat.emissiveIntensity=.24;
  flat.vertexColors=true;flat.side=THREE.DoubleSide; mesh(knife,g,flat);
  return knife;
}

// Locations are in worktop space. The board rests on a low shelf behind
// the bench, with clear standing room between the shelf and the chef.
export const fishWell={x:0,z:-1.42,wellZ:-3.84,width:11.0,depth:9.04,boardY:-4.60};
export const boardGrip={x:1.38,y:.10,z:.13};

export function serviceFloor(table,floorHeight,halfWidth=20.4) {
  const top=table.getWorldPosition(new THREE.Vector3());
  const cx=top.x+fishWell.x, cz=top.z+fishWell.wellZ;
  const shape=new THREE.Shape();
  function rectangle(path,x0,y0,x1,y1) {
    path.moveTo(x0,y0);path.lineTo(x1,y0);path.lineTo(x1,y1);path.lineTo(x0,y1);path.closePath();
  }
  rectangle(shape,-halfWidth,-13.45,halfWidth,26.55);
  const hole=new THREE.Path();
  rectangle(hole,cx-fishWell.width/2,-cz+fishWell.depth/2,cx+fishWell.width/2,-cz-fishWell.depth/2);
  shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.36,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);
  const floor=new THREE.Mesh(geometry,material(0x645345,.94));
  floor.name='Service floor';floor.position.y=floorHeight-.36;floor.receiveShadow=true;
  return floor;
}

export function makeFishStation(chef,table) {
  const stage=group(chef,'FishPrepStation');
  stage.position.copy(chef.worldToLocal(table.getWorldPosition(new THREE.Vector3())));
  stage.scale.setScalar(1/chef.getWorldScale(new THREE.Vector3()).x);
  const tray=group(stage,'SalmonCuttingBoard'), wood=material(0xb79569);
  box(tray,wood,0,.038,0,2.96,.076,.91);
  for(const side of [-1,1])box(tray,wood,side*1.48,.047,boardGrip.z,.36,.094,.25);
  const {pieces,cuts}=makeFish(tray), knife=makeKnife(stage);
  const rack=material(0x775437), lining=material(0x575a53,.80);
  const {width,depth,boardY,wellZ:z}=fishWell;
  const well=group(stage,'Prep bay lining');
  const floorY=-1.14-table.position.y;
  const footing=chef.position.y-table.position.y, h=floorY-footing;
  box(well,lining,0,footing-.07,z,width,.14,depth);
  for(const side of [-1,1]) {
    box(well,lining,side*(width/2+.05),footing+h/2,z,.10,h,depth+.20);
    box(well,lining,0,footing+h/2,z+side*(depth/2+.05),width,h,.10);
  }
  // A cantilevered shelf keeps the tray in front of the bent knees. Its
  // runners attach to the rear posts, leaving both side grips accessible.
  const shelf=group(stage,'Low fish shelf');
  box(shelf,rack,0,boardY-.05,fishWell.z,3.22,.10,1.05);
  box(shelf,rack,0,boardY-.16,-.47,5.2,.16,.16);
  for(const side of [-1,1])box(shelf,rack,side*1.24,boardY-.16,-1.10,.13,.15,1.39);
  box(stage,rack,-2.25,-.015,-.63,.39,.09,.50);
  for(const x of [-2.31,-2.19])box(stage,rack,x,.10,-.74,.065,.21,.25);
  return {stage,tray,knife,pieces,cuts};
}
