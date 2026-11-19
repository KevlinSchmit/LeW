import * as THREE from 'three';

const yAxis = new THREE.Vector3(0, 1, 0);
const xAxis = new THREE.Vector3(1, 0, 0);
const surfaceRadius = .665;
const sides = 48;
const rows = 12;

export function prepareEmptyCup(cup) {
  cup.getObjectByName('Green_tea_surface')?.removeFromParent();
  const trim = cup.children.find(part => part.material?.name === 'Celadon glaze');
  // The GLB batches the old tea meniscus and the ceramic foot together.
  const positions = trim.geometry.attributes.position;
  const source = trim.geometry.index;
  const indices = [];
  const vertex = new THREE.Vector3();
  trim.updateMatrix();
  for (let i = 0; i < (source?.count ?? positions.count); i += 3) {
    const triangle = [i, i + 1, i + 2].map(n => source ? source.getX(n) : n);
    if (triangle.every(n => vertex.fromBufferAttribute(positions, n).applyMatrix4(trim.matrix).y < .5)) {
      indices.push(...triangle);
    }
  }
  trim.geometry = trim.geometry.clone();
  trim.geometry.setIndex(indices);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(.487, sides),
    new THREE.MeshStandardMaterial({name: 'Celadon cup interior', color: 0xb0ad7f, roughness: .62}));
  bottom.name = 'Empty cup ceramic bottom';
  bottom.position.y = .267;
  bottom.rotation.x = -Math.PI / 2;
  bottom.receiveShadow = true;
  cup.add(bottom);
}

export function createTeaWater(cup, scene) {
  const surfaceGeometry = new THREE.RingGeometry(0, surfaceRadius, sides, 22);
  surfaceGeometry.rotateX(-Math.PI / 2);
  const surfaceMaterial = new THREE.MeshPhysicalMaterial({
    name: 'Amber tea with surface reflections', color: 0xa9631a, emissive: 0x693307,
    emissiveIntensity: .16, roughness: .23, clearcoat: 1, clearcoatRoughness: .09,
    envMapIntensity: .85,
  });
  const impact = new THREE.Vector3(-.17, 0, -.06);
  const seconds = {value: 0}, turbulence = {value: 0};
  surfaceMaterial.onBeforeCompile = shader => {
    shader.uniforms.waterSeconds = seconds;
    shader.uniforms.turbulence = turbulence;
    shader.vertexShader = 'varying vec2 vWater;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvWater = position.xz;');
    shader.fragmentShader = 'uniform float waterSeconds, turbulence; varying vec2 vWater;\n'
      + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 uv = vWater / .665;
        float bank = smoothstep(.35,.99,length(uv));
        float pool = .78 + .43*exp(-dot(uv-vec2(.27,.19),uv-vec2(.27,.19))*2.8);
        diffuseColor.rgb *= pool * (1. - bank*.31);
        float distanceToDrop = length(vWater - vec2(-.17,-.06));
        float phase = distanceToDrop*32. - waterSeconds*11.4;
        float glint = smoothstep(.88,1.,cos(phase + .38*sin(vWater.x*10.))) *
          (1.-smoothstep(.08,.67,distanceToDrop));
        float scattered = .37 + .63*smoothstep(-.4,.4,uv.x + uv.y);
        diffuseColor.rgb += vec3(.36,.166,.026)*glint*(.12+.66*turbulence)*scattered;
      `);
  };
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  surface.name = 'Rising tea surface';
  surface.receiveShadow = true;
  surface.visible = false;
  cup.add(surface);
  const surfacePositions = surfaceGeometry.attributes.position;
  surfacePositions.setUsage(THREE.DynamicDrawUsage);
  const originalSurface = new Float32Array(surfacePositions.array);

  const tubeRings = 45, tubeSides = 10;
  const streamGeometry = new THREE.BufferGeometry();
  const streamVertices = new THREE.Float32BufferAttribute((tubeRings + 1) * tubeSides * 3, 3);
  streamVertices.setUsage(THREE.DynamicDrawUsage);
  streamGeometry.setAttribute('position', streamVertices);
  const streamUVs = [];
  for (let i = 0; i <= tubeRings; i++) for (let j = 0; j < tubeSides; j++) {
    streamUVs.push(Math.cos(j/tubeSides*Math.PI*2), i/tubeRings);
  }
  streamGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(streamUVs, 2));
  const streamIndices = [];
  for (let i = 0; i < tubeRings; i++) {
    for (let j = 0; j < tubeSides; j++) {
      const a = i*tubeSides+j, b = i*tubeSides+(j+1)%tubeSides;
      streamIndices.push(a,b,a+tubeSides,b,b+tubeSides,a+tubeSides);
    }
  }
  streamGeometry.setIndex(streamIndices);
  const liquidMaterial = new THREE.MeshPhysicalMaterial({
    name: 'Translucent golden stream and splash', color: 0xe7a042, emissive: 0xe17c1c,
    emissiveIntensity: .2, roughness: .13, clearcoat: 1, clearcoatRoughness: .08,
    transparent: true, opacity: .74, depthWrite: false, side: THREE.DoubleSide,
  });
  const stream = new THREE.Mesh(streamGeometry, liquidMaterial);
  const jetMaterial = liquidMaterial.clone();
  jetMaterial.name = 'Thin translucent tea stream';
  jetMaterial.color.set(0xf8c47d);
  jetMaterial.emissive.set(0xc4792c);
  jetMaterial.emissiveIntensity = .085;
  jetMaterial.side = THREE.FrontSide;
  jetMaterial.opacity = .64;
  jetMaterial.onBeforeCompile = shader => {
    shader.uniforms.waterSeconds = seconds;
    shader.vertexShader = 'varying vec2 vJet;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvJet = uv;');
    shader.fragmentShader = 'uniform float waterSeconds; varying vec2 vJet;\n'
      + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float stripe = exp(-pow((vJet.x+.49+.09*sin(vJet.y*28.-waterSeconds*15.))*9.,2.));
        float shimmer = .47 + .53*pow(.5+.5*cos(vJet.y*94.-waterSeconds*44.),3.);
        diffuseColor.rgb += stripe*shimmer*vec3(.44,.31,.13);
        float atLip=1.-smoothstep(.005,.115,vJet.y);
        diffuseColor.a = mix(diffuseColor.a*(.65+.35*stripe), .98, atLip);
      `);
  };
  stream.material = jetMaterial;
  stream.name = 'Tea stream from spout';
  stream.visible = false;
  stream.frustumCulled = false;
  stream.renderOrder = 4;
  scene.add(stream);

  const splashSides = 28;
  const splashIndices = [];
  for (let band = 0; band < 2; band++) {
    for (let i = 0; i < splashSides; i++) {
      const a = band*splashSides+i, b = band*splashSides+(i+1)%splashSides;
      splashIndices.push(a,b,a+splashSides,b,b+splashSides,a+splashSides);
    }
  }
  const sheets = Array.from({length: 3}, () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(splashSides*3*3,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(splashIndices);
    const sheet = new THREE.Mesh(geometry, liquidMaterial.clone());
    sheet.name = 'Rising sheet of splashed tea';
    sheet.frustumCulled = false;
    sheet.renderOrder = 5;
    sheet.visible = false;
    surface.add(sheet);
    return sheet;
  });
  const dropletCount = 32;
  const droplets = new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5), liquidMaterial, dropletCount);
  droplets.name = 'Ballistic tea droplets';
  droplets.frustumCulled = false;
  droplets.renderOrder = 6;
  surface.add(droplets);
  const drop = new THREE.Object3D();
  const random = index => THREE.MathUtils.euclideanModulo(Math.sin(index*193.58)*36724.23, 1);

  function fillSurface(fill, time, strength) {
    surface.visible = fill > .001;
    surface.position.y = THREE.MathUtils.lerp(.279, 1.17, fill);
    if (!surface.visible) return;
    seconds.value = time;
    turbulence.value = strength;
    const radiusScale = THREE.MathUtils.lerp(.735, .989, fill);
    const waveTime = time*11.4;
    for (let i = 0; i < surfacePositions.count; i++) {
      const x = originalSurface[i*3]*radiusScale, z = originalSurface[i*3+2]*radiusScale;
      const r = Math.hypot(x-impact.x, z-impact.z);
      const wall = Math.max(0,1-Math.hypot(x,z)/(surfaceRadius*radiusScale));
      const phase = r*32-waveTime;
      const wave = (Math.sin(phase)+.32*Math.sin(r*53-time*17.3))*(.004+.022*strength);
      const crater = -.048*strength*Math.exp(-r*r/.0037);
      surfacePositions.setXYZ(i,x,(wave+crater)*Math.sqrt(wall),z);
    }
    surfacePositions.needsUpdate = true;
    surfaceGeometry.computeVertexNormals();

    for (const [index, sheet] of sheets.entries()) {
      const phase = (time*3.4+index*.333)%1;
      sheet.visible = strength > .035 && phase < .81;
      if (!sheet.visible) continue;
      const crest = Math.sin(Math.PI*phase)*(.13-.043*phase)*strength;
      const radius = .04 + phase*.21;
      const attribute = sheet.geometry.attributes.position;
      sheet.material.opacity = strength*(1-phase)*.69;
      for (let band = 0; band < 3; band++) {
        for (let i = 0; i < splashSides; i++) {
          const angle = i/splashSides*Math.PI*2;
          const teeth = .38 + .62*Math.pow(.5+.5*Math.sin(angle*7 + index*1.18),2);
          const swell = radius*(.89+.12*Math.cos(angle*3 + index)) + band*.023;
          const height = band===0 ? .003 : crest*teeth*(band===1 ? .78 : 1);
          attribute.setXYZ(band*splashSides+i,impact.x+Math.cos(angle)*swell,
            height,impact.z+Math.sin(angle)*swell);
        }
      }
      attribute.needsUpdate = true;
      sheet.geometry.computeVertexNormals();
    }
    droplets.visible = strength > .025;
    if (!droplets.visible) return;
    for (let i = 0; i < dropletCount; i++) {
      const flight = .25 + random(i+94)*.24;
      const age = (time/flight+random(i+3))%1;
      const angle = i*2.399963;
      const spread = .12 + age*(.17+random(i+50)*.22);
      const y = strength*(.10+random(i+39)*.28)*4*age*(1-age);
      const radius = (.013+random(i+27)*.016) * strength * Math.sin(Math.PI*age)**.3;
      drop.position.set(impact.x+Math.cos(angle)*spread, y, impact.z+Math.sin(angle)*spread);
      drop.scale.set(radius,radius*(1.3+.6*Math.abs(.5-age)),radius*.88);
      drop.rotation.set(Math.sin(angle)*age,0,Math.cos(angle)*age);
      drop.updateMatrix();
      droplets.setMatrixAt(i,drop.matrix);
    }
    droplets.instanceMatrix.needsUpdate = true;
  }

  const point = new THREE.Vector3(), tangent = new THREE.Vector3(), across = new THREE.Vector3();
  const normal = new THREE.Vector3(), delta = new THREE.Vector3(), end = new THREE.Vector3();
  const lipEnd = new THREE.Vector3();
  function pour(from, head, tail) {
    stream.visible = head > tail;
    if (!stream.visible) return;
    end.copy(impact).setY(surface.position.y+.005);
    cup.localToWorld(end);
    delta.subVectors(end,from);
    const lipLength = Math.min(.12,head);
    lipEnd.set(from.x+delta.x*lipLength,
      from.y-.12*lipLength+(delta.y+.12)*lipLength*lipLength,
      from.z+delta.z*lipLength);
    const flowTime = seconds.value;
    for (let i = 0; i <= tubeRings; i++) {
      const fraction = i/tubeRings;
      const u = THREE.MathUtils.lerp(tail,head,fraction);
      point.set(from.x + delta.x*u, from.y - .12*u + (delta.y+.12)*u*u, from.z + delta.z*u);
      const motion = u*u*(1-u)*.10;
      point.x += Math.sin(u*19-flowTime*18)*motion;
      point.z += Math.cos(u*16-flowTime*16)*motion;
      tangent.set(delta.x,-.12+2*(delta.y+.12)*u,delta.z).normalize();
      across.crossVectors(tangent,xAxis).normalize();
      normal.crossVectors(tangent,across);
      const pressure = .89 + .13*Math.sin(u*33-flowTime*19) + .1*Math.cos(u*59-flowTime*26);
      const mouth = .64 + .36*THREE.MathUtils.smoothstep(u,0,.073);
      const radius = (.053/(1+1.35*u))*pressure*mouth;
      for (let j = 0; j < tubeSides; j++) {
        const angle = j/tubeSides*Math.PI*2;
        const a = Math.cos(angle)*radius*(.83+.13*Math.sin(u*13-flowTime*9));
        const b = Math.sin(angle)*radius;
        streamVertices.setXYZ(i*tubeSides+j,point.x+across.x*a+normal.x*b,
          point.y+across.y*a+normal.y*b,point.z+across.z*a+normal.z*b);
      }
    }
    streamVertices.needsUpdate = true;
    streamGeometry.computeVertexNormals();
  }

  return {surface, fillSurface, pour, lipEnd,
    get flowingFromLip() {return stream.visible;},
    stop: () => { stream.visible = surface.visible = false; }};
}
