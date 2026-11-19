import * as THREE from 'three';
import { paintTerminalDeck, paintTerminalSides } from './counter-terminal-paint.js';

// The rear printer shoulder flows into the single sloping display and key deck.
const deckSections = [
  [-1.65,.89,.93],[-1.58,1.04,1.02],[-1.45,1.14,1.10],[-1.37,1.17,1.12],
  [-1.32,1.18,1.115],[-1.22,1.18,1.09],[-1.17,1.18,1.068],[-1.08,1.17,1.05],
  [-.90,1.16,1.01],[.08,1.105,.805],[1.08,1.031,.591],[1.42,.991,.516],
  [1.56,.924,.478],[1.63,.79,.422],
];
const widthSamples = [-1,-.82,-.70,-.58,-.36,-.18,0,.18,.36,.58,.70,.82,1];
const wallSections = [
  [0,1,1,0,0],[.10,1.040,1.017,0,54],[.22,1.047,1.021,0,141],
  [.37,1.039,1.004,.115,185],[.49,1.039,1.003,.123,239],[.59,1.025,1.010,0,278],
  [.65,1.019,1.006,0,295],[.91,.955,.960,0,418],[1,.848,.891,0,512],
];
const floorY = -.077;

function makeSurface() {
  const positions = [], uv = [], indices = [], groups = [];
  const vertex = (x,y,z,u,v) => {
    positions.push(x,y,z);
    uv.push(u,v);
    return positions.length / 3 - 1;
  };
  const quad = (a,b,c,d) => indices.push(a,b,d,b,c,d);
  const section = (first, materialIndex) => groups.push([first,indices.length - first,materialIndex]);

  // The printed opening also has a shallow dip in the printer lid.
  const deck = deckSections.map(([z, width, y], row) => widthSamples.map(a => {
    const printerDepth = row === 4 || row === 5 ? .059 * THREE.MathUtils.smoothstep(.81 - Math.abs(a),0,.14) : 0;
    const x = a * width;
    return vertex(x,y - printerDepth,z,(x+1.26)/2.52,1-(z+1.74)/3.48);
  }));
  for (let row = 1; row < deck.length; row++) for (let col = 1; col < widthSamples.length; col++) {
    quad(deck[row-1][col-1],deck[row][col-1],deck[row][col],deck[row-1][col]);
  }
  section(0,0);

  const front = deckSections.at(-1);
  const rear = deckSections[0];
  const profiles = [
    widthSamples.toReversed().map(a => [a,...front]),
    widthSamples.map(a => [a,...rear]),
    deckSections.toReversed().map(row => [-1,...row]),
    deckSections.map(row => [1,...row]),
  ];
  const first = indices.length;
  for (const [side, profile] of profiles.entries()) {
    const rows = wallSections.map(([drop,sx,sz,recess,pixelY]) => profile.map(([a,z,w,y],i) => {
      const frontPocket = side === 0 ? recess * THREE.MathUtils.smoothstep(.84 - Math.abs(a),0,.15) : 0;
      const grip = Math.abs(a) ** 4 * Math.max(0,1-Math.abs(z+.42)*1.1) * Math.sin(drop*Math.PI) ** 3;
      const x = w*a*(sx - .068*grip);
      const f = (side < 2 ? (a+1)/2 : i/(profile.length-1));
      return vertex(x,THREE.MathUtils.lerp(y,floorY,drop)+.088*grip,
        z*sz-frontPocket,(side*128 + 1 + f*126)/512,1-pixelY/512);
    }));
    for (let row = 1; row < rows.length; row++) for (let col = 1; col < profile.length; col++) {
      quad(rows[row-1][col-1],rows[row-1][col],rows[row][col],rows[row][col-1]);
    }
    const bottom = rows.at(-1);
    const pivot = vertex(0,floorY,0,(side*128+64)/512,0);
    for (let i = 1; i < bottom.length; i++) indices.push(bottom[i-1],bottom[i],pivot);
  }
  section(first,1);
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  shell.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  shell.setIndex(indices);
  for (const group of groups) shell.addGroup(...group);
  shell.computeVertexNormals();
  return shell;
}

function swipeGuide() {
  // Both lips and the trough belong to one continuous swept piece.
  const profile = [[-.028,-.105],[0,.010],[.058,.046],[.084,.017],
    [.088,-.036],[.130,-.032],[.148,.048],[.196,.062],[.225,.021],[.205,-.096]];
  const stations = [[-.93,1.08,.868,.45],[-.78,1.12,.851,1],[.56,1.01,.572,1],[.83,.969,.504,.48]];
  const positions = [], indices = [];
  for (const [z,x,y,scale] of stations) for (const [u,v] of profile) {
    positions.push(x+u*scale,y+v*scale,z);
  }
  const stride = profile.length;
  for (let row = 1; row < stations.length; row++) for (let col = 0; col < stride; col++) {
    const a = (row-1)*stride+col, b = (row-1)*stride+(col+1)%stride;
    indices.push(a,a+stride,b,b,a+stride,b+stride);
  }
  const start = positions.length/3;
  positions.push(1.12,.84,-.93,1.01,.48,.83);
  for (let i=0; i<stride; i++) {
    const j = (i+1)%stride, last = (stations.length-1)*stride;
    indices.push(start,i,j,start+1,last+j,last+i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createCounterTerminal() {
  const prop = new THREE.Group();
  prop.name = 'POS · silver payment terminal';
  const {map,bump,roughness} = paintTerminalDeck();
  const silver = new THREE.MeshStandardMaterial({
    name:'POS · painted LCD deck', map, bumpMap:bump, roughnessMap:roughness,
    bumpScale:.022, roughness:.73, metalness:.14,
    emissive:0xd0d7c9, emissiveMap:map, emissiveIntensity:.19,
  });
  const sides = new THREE.MeshStandardMaterial({
    name:'POS · molded silver and charcoal', map:paintTerminalSides(), roughness:.68,
    metalness:.06, emissive:0x778c82, emissiveIntensity:.055,
  });
  const guide = new THREE.MeshStandardMaterial({
    name:'POS · charcoal swipe guide', color:0x253034, roughness:.58,
  });
  const shell = new THREE.Mesh(makeSurface(),[silver,sides]);
  shell.name = 'Continuous POS housing and inset chip reader';
  const rail = new THREE.Mesh(swipeGuide(),guide);
  rail.name = 'Recessed magnetic card guide';
  for (const part of [shell,rail]) {
    part.castShadow = part.receiveShadow = true;
    prop.add(part);
  }
  const line = new THREE.Mesh(shell.geometry,new THREE.MeshBasicMaterial({
    name:'POS thin silhouette ink',color:0x1b1715,side:THREE.BackSide,
  }));
  line.name = 'Fine black contour';
  line.scale.set(1.010,1.011,1.009);
  line.position.y = -.005;
  line.raycast = () => {};
  shell.add(line);
  return prop;
}

export function replaceCounterTerminal(model) {
  const existing = model.children.find(part => part.name.startsWith('POS'));
  const terminal = createCounterTerminal();
  terminal.position.copy(existing.position);
  terminal.quaternion.copy(existing.quaternion);
  terminal.scale.copy(existing.scale);
  existing.removeFromParent();
  model.add(terminal);
}
