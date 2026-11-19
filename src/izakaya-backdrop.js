import * as THREE from 'three';
import { artPrint, bulbHalo, menuSlip, plasterTexture, textilePrint, wallSign, woodTexture } from './izakaya-prints.js';

const rearFace = -26.25;
const base = -1.14;
const dado = 2.79;
const ceiling = 13.6;

function matte(color,map,glow=.48) {
  return new THREE.MeshStandardMaterial({color,map,roughness:.94,
    emissive:0xffffff,emissiveMap:map,emissiveIntensity:glow});
}

function box(parent,name,width,height,depth,x,y,z,material) {
  const part=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
  part.name=name;
  part.position.set(x,y,z);
  part.receiveShadow=true;
  parent.add(part);
  return part;
}

function mount(host,name,x,z,angle) {
  host.clear();
  host.scale.set(1,1,1);
  host.updateWorldMatrix(true,false);
  const group=new THREE.Group();
  group.name=name;
  group.position.copy(host.worldToLocal(new THREE.Vector3(x,0,z)));
  group.rotation.y=angle;
  host.add(group);
  return group;
}

function wall(parent,span,paint,wood,rail) {
  box(parent,'Golden limewash',span,ceiling-dado,.24,0,(ceiling+dado)/2,-.12,paint);
  const grain=wood.map.clone();
  grain.wrapS=THREE.RepeatWrapping;
  grain.repeat.set(span/8,1);
  grain.needsUpdate=true;
  const panels=matte(0xffffff,grain,.30);
  box(parent,'Stained plank wainscoting',span,dado-base,.29,0,(dado+base)/2,-.11,panels);
  box(parent,'Dado cap',span,.22,.30,0,dado,.025,rail);
  box(parent,'Skirting',span,.24,.18,0,base+.12,.055,rail);
}

function print(parent,name,texture,x,y,width,height,angle,framed=false) {
  const mount=new THREE.Group();
  mount.name=name;
  mount.position.set(x,y,framed ? .121 : .045);
  mount.rotation.z=angle;
  parent.add(mount);
  if(framed)box(mount,'Dark stained frame',width+.15,height+.15,.15,0,0,-.098,
    new THREE.MeshStandardMaterial({color:0x39251c,roughness:.78}));
  const geometry = new THREE.PlaneGeometry(width,height,6,8);
  const points = geometry.attributes.position;
  for(let i=0;i<points.count;i++){
    const u=points.getX(i)/width+.5, v=points.getY(i)/height+.5;
    points.setZ(i,.033*(1-v)**4*(.3+.7*u) + .008*Math.sin(u*Math.PI*1.7+v*3));
  }
  geometry.computeVertexNormals();
  const sheet=new THREE.Mesh(geometry,matte(0xffffff,texture,.67));
  sheet.receiveShadow=true;
  mount.add(sheet);
  return mount;
}

const dishes=[
  ['まぐろ',420],['炙りサーモン',480],['玉子焼き',320],['いくら',560],
  ['しめ鯖',440],['海老',400],['あさり汁',360],['穴子',520],
  ['鯵のたたき',540],['枝豆',280],['冷酒',600],['たい',480],
];

function menu(parent,start,y,items,seed=0) {
  items.forEach((dish,i)=>{
    const [label,price]=dishes[dish];
    const tilt=[-.018,.012,-.009,.019,-.023][(i+seed)%5];
    print(parent,'Menu · '+label,menuSlip(label,price,i+seed),start+i*1.16,
      y+.075*Math.sin(i*1.9+seed),1.045,2.48,tilt);
  });
}

function tickets(parent,center,seed) {
  for(let i=0;i<7;i++){
    const [label,price]=dishes[(i+seed)%dishes.length];
    const x=center+(i-3)*.53;
    const y=2.72-.57*Math.sin((i+.6)*Math.PI/8)-.13*((i+seed)%3);
    const tag=print(parent,'Pinned tasting slip',menuSlip(label,price,i+seed),
      x,y,.36,.65,.30*Math.sin(i*1.95+seed));
    tag.position.z=.07;
  }
}

function garland(parent) {
  const cable=new THREE.MeshBasicMaterial({color:0x614631});
  const socket=new THREE.MeshStandardMaterial({color:0x6b5034,roughness:.61});
  const glass=new THREE.MeshBasicMaterial({color:0xffe2ab});
  const haloMaterial=new THREE.MeshBasicMaterial({map:bulbHalo(),transparent:true,
    blending:THREE.AdditiveBlending,depthWrite:false});
  const haloGeometry=new THREE.PlaneGeometry(1.12,1.12);
  const bulbGeometry=new THREE.SphereGeometry(1,10,7);
  // The wires are nailed to the wall at different heights. Each span has its
  // own droop and bulb spacing, like strings added at different times.
  const anchors=[
    [-30,8.72,.20],[-24.9,8.37,.28],[-18.3,9.17,.25],[-13.6,8.71,.19],
    [-6.8,9.10,.26],[-1.4,8.53,.37],[4.2,9.23,.19],[10.6,8.65,.33],
    [14.6,9.15,.28],[21.8,8.73,.29],[26.5,9.02,.19],[30,8.49,.29],
  ];
  const sag=[.32,.44,.36,.69,.27,.61,.40,.33,.61,.45,.29];
  const bulbs=[
    [.39,.81],[.17,.52,.84],[.67],[.15,.44,.79],[.34,.86],[.26,.54,.92],
    [.22,.66,.89],[.35,.82],[.13,.48,.73],[.41,.88],[.60],
  ];
  const drops=[.10,.30,.16,.46,.22,.33,.11,.42,.16];
  const diameters=[.21,.28,.18,.31,.22,.25,.16,.27,.19];
  for(let span=0;span<bulbs.length;span++){
    const left=new THREE.Vector3(...anchors[span]),right=new THREE.Vector3(...anchors[span+1]);
    const middle=left.clone().lerp(right,.46);
    middle.y-=sag[span];
    middle.z+=.24;
    const wire=new THREE.CatmullRomCurve3([left,middle,right]);
    const cableMesh=new THREE.Mesh(new THREE.TubeGeometry(wire,22,.018,6,false),cable);
    cableMesh.name='Sagging bulb cable';
    parent.add(cableMesh);

    bulbs[span].forEach((fraction,i)=>{
      const p=wire.getPoint(fraction);
      const kind=(i*5+span*3)%drops.length;
      const drop=drops[kind],diameter=diameters[kind],r=diameter/2;
      box(parent,'Hanging bulb lead',.024,drop,.025,p.x,p.y-drop/2,p.z,cable);
      box(parent,'Brass bulb socket',.107,.11,.108,p.x,p.y-drop-.043,p.z,socket);
      const bulb=new THREE.Mesh(bulbGeometry,glass);
      bulb.name='Amber string bulb';
      bulb.position.copy(p);
      bulb.position.y-=drop+.08+r*.95;
      bulb.scale.set(r,r*(1.13+.10*(kind%3)),r);
      parent.add(bulb);

      const halo=new THREE.Mesh(haloGeometry,haloMaterial);
      halo.position.copy(bulb.position);
      halo.position.z+=r+.04;
      halo.scale.setScalar(.62+diameter*2.2);
      parent.add(halo);
      if(i===1 && span%2===1){
        const bounce=new THREE.PointLight(0xffd28d,17+diameter*23,7,2);
        bounce.name='Amber bulb spill on wall';
        bounce.position.copy(bulb.position);
        bounce.position.z+=1.22;
        parent.add(bounce);
      }
    });
  }
}

function banner(parent,image,title,x,y,z,w,h,angle) {
  const banner = new THREE.Group();
  banner.name='Dyed cotton pennant · '+title;
  banner.position.set(x,y,z);
  banner.rotation.z=angle;
  parent.add(banner);
  const material=matte(0xffffff,textilePrint(image,title),.66);
  material.side=THREE.DoubleSide;
  const geometry=new THREE.PlaneGeometry(w,h,12,15), p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const u=p.getX(i)/w+.5, v=p.getY(i)/h+.5;
    p.setZ(i,(.24+.06*(1-v))*Math.sin(Math.PI*u)*Math.sin(4*u+v));
    p.setY(i,p.getY(i)+.21*(1-v)**7*(1-Math.abs(2*u-1)));
  }
  geometry.computeVertexNormals();
  banner.add(new THREE.Mesh(geometry,material));
  const cord=new THREE.MeshBasicMaterial({color:0x755135});
  box(banner,'Wooden pennant rod',w+.24,.078,.09,0,h/2,0,cord);
  const drop=ceiling-y-h/2;
  for(const side of [-1,1])box(banner,'Pennant drop cord',.026,drop,.024,side*w*.39,h/2+drop/2,0,cord);
}

export function installIzakayaBackdrop(roof,back,left,right,halfWidth,art) {
  const paint=matte(0xffecd2,plasterTexture(),.76);
  const wood=matte(0xffffff,woodTexture());
  const rail=new THREE.MeshStandardMaterial({color:0x3c291d,roughness:.82,
    emissive:0x3c291d,emissiveIntensity:.25});
  const canopy=mount(roof,'Izakaya ceiling',0,-6.85,0);
  const span=2*(halfWidth+.4);
  const ceilingPaint=new THREE.MeshStandardMaterial({color:0x978061,roughness:1,
    emissive:0x6c522e,emissiveIntensity:.36});
  box(canopy,'Warm plaster ceiling',span,.32,39,0,ceiling+.16,0,ceilingPaint);
  for(const z of [-16,-10,-4,2,8])
    box(canopy,'Dark ceiling beam',span,.28,.26,0,ceiling-.12,z,rail);
  const rear=mount(back,'Izakaya rear wall',0,rearFace,0);
  wall(rear,span,paint,wood,rail);
  for (const [host,side] of [[left,-1],[right,1]]){
    const edge=mount(host,'Izakaya side wall',side*halfWidth,-7,-side*Math.PI/2);
    wall(edge,38.8,paint,wood,rail);
    print(edge,'Framed mackerel engraving',artPrint(art.mackerel,'しめ鯖'),-6.3,5.42,3.67,3.35,side*.038,true);
    print(edge,'Tempura lithograph',artPrint(art['shrimp-tempura'],'天ぷら','photo'),2.8,5.89,3.18,3.91,-side*.048);
    menu(edge,-3.84,4.53,[0,3,8,2],5);
    menu(edge,7.08,4.55,[4,5,7,9],10);
    tickets(edge,1.8,8);
  }

  print(rear,'Framed sushi tavern sign',wallSign('寿司酒場','江戸前  ・  旬の魚'),-7.47,7.00,6.52,1.62,-.013,true);
  print(rear,'Blue fish shop print',artPrint(art.bluefin,'本まぐろ'),-16.20,5.49,4.96,3.79,.054,true);
  print(rear,'Red octopus shop print',artPrint(art['grilled-octopus'],'炭火焼き','photo'),7.25,5.34,4.32,4.84,-.052,false);
  print(rear,'Mount Fuji woodblock',artPrint(art['mount-fuji'],'富士山','woodblock'),16.40,5.46,4.94,3.91,.039,true);
  print(rear,'Daily specials sign',wallSign('本日の肴','季節のおすすめ'),21.67,7.20,4.88,1.27,.013,true);
  print(rear,'Sake poster',artPrint(art['sake-still-life'],'地酒','photo'),-22.38,5.18,2.93,3.94,-.091);
  print(rear,'Blue fish wing print',artPrint(art.mackerel,'しめ鯖'),31.12,5.21,4.18,3.26,-.034);
  print(rear,'Mountain wing print',artPrint(art['shrimp-tempura'],'天ぷら','photo'),-32.08,5.15,3.33,4.32,.044);
  menu(rear,-11.74,4.61,[0,1,2,3,4,5],1);
  menu(rear,10.23,4.42,[8,9,11],8);
  menu(rear,19.39,4.62,[5,7,6,10,4],3);
  menu(rear,-27.57,4.62,[6,7,1],6);
  menu(rear,34.05,4.62,[11,3,1],7);
  tickets(rear,-15.9,4);
  tickets(rear,-7.5,7);
  tickets(rear,7.1,1);
  tickets(rear,18.7,8);
  garland(rear);
  banner(rear,art['octopus-pennant'],'祭',-12.22,9.41,3.05,2.91,4.10,-.125);
  banner(rear,art['crane-pennant'],'旬の鮨',10.28,9.72,2.54,2.43,4.58,.095);
  banner(rear,art['sake-pennant'],'地酒',19.79,10.08,2.88,2.90,3.90,-.068);
}
