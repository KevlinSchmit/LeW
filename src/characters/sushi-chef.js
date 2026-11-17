import * as THREE from 'three';

// Original, deterministic geometry and painted canvas maps. Y is up, +Z is front.
// Dimensions are authored as a complete standing adult; the counter hides the legs.
export function createSushiChef() {
  const chef = new THREE.Group();
  chef.name = 'CHEF · procedural white-uniform sushi craftsman';
  chef.position.set(0, -1.25, -10.6);
  chef.scale.setScalar(.73);
  chef.userData = {
    procedural: true, static_character: true,
    reference: 'White cross-collar jacket, cloth cap, 寿司 embroidery and tied apron',
    landmarks: { hat: [0, 11.27, 0], chin: [0, 8.78, .37], chest: [0, 7.5, .7], waist: [0, 4.8, .7], feet: [.66, .22, .4] },
  };

  function paintedMap(name, paint, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    paint(ctx, size);
    const map = new THREE.CanvasTexture(canvas);
    map.name = name;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }
  // Seeded noise keeps the cloth identical across reloads and standalone exports.
  function weave(ctx, size, base, seed) {
    let state = seed;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size / 2; i++) {
      ctx.fillStyle = `rgba(${random() > .45 ? '255,251,242' : '89,83,75'},${random() * .07})`;
      ctx.fillRect(random() * size, random() * size, 1, 1 + random() * 2);
    }
    for (let x = 1; x < size; x += 3) {
      ctx.fillStyle = 'rgba(100,92,80,.025)'; ctx.fillRect(x, 0, 1, size);
    }
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, y, size, 1);
    }
    // Soft painted creases rather than random dark triangles on white fabric.
    for (const [x, y, angle, length] of [[.13,.15,-.25,.55],[.8,.1,.3,.6],[.3,.8,.6,.28],[.64,.7,-.3,.4]]) {
      ctx.save(); ctx.translate(x * size, y * size); ctx.rotate(angle);
      const g = ctx.createLinearGradient(-10, 0, 12, 0);
      g.addColorStop(0, 'rgba(104,96,84,0)'); g.addColorStop(.45, 'rgba(104,96,84,.14)');
      g.addColorStop(.6, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-10, 0, 22, length * size); ctx.restore();
    }
  }
  const clothMap = paintedMap('CHEF · ivory cotton weave', (c, s) => weave(c, s, '#e6e3db', 419));
  const apronMap = paintedMap('CHEF · apron linen', (c, s) => weave(c, s, '#d8d7d0', 813));
  const capMap = paintedMap('CHEF · folded cotton cap', (c, s) => weave(c, s, '#eae7df', 611));
  const skinMap = paintedMap('CHEF · warm skin brushwork', (c, s) => {
    weave(c, s, '#bd9574', 128);
    const g = c.createRadialGradient(s*.5,s*.6,0,s*.5,s*.6,s*.6);
    g.addColorStop(0, 'rgba(240,188,146,.24)'); g.addColorStop(1, 'rgba(83,56,40,.16)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  });
  const hairMap = paintedMap('CHEF · combed black hair', (c, s) => {
    c.fillStyle = '#292823'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      c.strokeStyle = i % 3 ? '#38362f' : '#1d1d1a'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(i * s / 90, s); c.quadraticCurveTo(i*s/90-20,s*.3,i*s/90+10,0); c.stroke();
    }
  });
  const material = (name, color, map, extra = {}) => new THREE.MeshStandardMaterial({
    name: `CHEF · ${name}`, color, map, roughness: .94, metalness: 0, ...extra,
  });
  // A small emissive bounce preserves neutral ivory in the dark restaurant.
  const cloth = material('ivory cross-collar cotton', '#ffffff', clothMap, { emissive: '#d8d9dc', emissiveMap: clothMap, emissiveIntensity: .25 });
  const apron = material('white tied apron', '#ffffff', apronMap, { emissive: '#d8d9dc', emissiveMap: apronMap, emissiveIntensity: .22 });
  const cap = material('white cloth cap', '#ffffff', capMap, { emissive: '#dedfe2', emissiveMap: capMap, emissiveIntensity: .25 });
  const skin = material('painted adult skin', '#ffffff', skinMap, { emissive: '#a7856e', emissiveMap: skinMap, emissiveIntensity: .12 });
  const skinShadow = material('skin creases', '#89694f', null);
  const hair = material('brushed black hair', '#ffffff', hairMap);
  const ink = material('charcoal embroidery and brows', '#24241f', null);
  const seam = material('warm gray tailoring', '#a5a093', clothMap);
  const shoe = material('black work shoes', '#262721', null);
  const lip = material('muted lips', '#88634f', null);
  const eye = material('eye whites', '#c8bb9f', null, { roughness: .7 });

  function mesh(name, geometry, mat, parent = chef, outline = true) {
    const object = new THREE.Mesh(geometry, mat);
    object.name = `Chef ${name}`;
    object.castShadow = object.receiveShadow = true;
    object.userData.noOutline = !outline;
    parent.add(object);
    return object;
  }
  // Elliptical cross sections make shoulders, jaw and tailored hems editable.
  function loft(name, rings, mat, n = 12, parent = chef) {
    const positions = [], uvs = [], indices = [];
    const bottom = rings[0][0], height = rings.at(-1)[0] - bottom;
    rings.forEach(([y, rx, rz, cx = 0, cz = 0], row) => {
      for (let j = 0; j <= n; j++) {
        const a = j * Math.PI * 2 / n;
        positions.push(cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz);
        uvs.push(j / n, (y - bottom) / height);
        if (row && j < n) {
          const k = row * (n + 1) + j;
          indices.push(k, k-n-1, k+1, k+1, k-n-1, k-n);
        }
      }
    });
    // Separate cap fans avoid the long skinny triangles of a single polygon fan.
    for (const row of [0, rings.length - 1]) {
      const [y, , , cx = 0, cz = 0] = rings[row];
      const center = positions.length / 3;
      positions.push(cx, y, cz); uvs.push(.5, .5);
      for (let j = 0; j < n; j++) {
        const a = row * (n + 1) + j;
        indices.push(...(row === 0 ? [center, a+1, a] : [center, a, a+1]));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices); g.computeVertexNormals();
    return mesh(name, g, mat, parent);
  }
  function ellipsoid(name, position, scale, mat, parent = chef, outline = true) {
    const o = mesh(name, new THREE.SphereGeometry(1, 12, 8), mat, parent, outline);
    o.position.set(...position); o.scale.set(...scale); return o;
  }
  function segment(name, start, end, r0, r1, mat, parent = chef) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), delta = b.clone().sub(a);
    const o = mesh(name, new THREE.CylinderGeometry(r1, r0, delta.length(), 10, 1), mat, parent);
    o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return o;
  }
  function patch(name, points, mat, parent = chef) {
    const g = new THREE.BufferGeometry(), p = [], uv = [];
    for (const [x, y, z] of points) { p.push(x, y, z); uv.push((x+2)/4, y/9); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const indices = [];
    for (let j = 1; j < points.length - 1; j++) indices.push(0, j, j+1);
    g.setIndex(indices); g.computeVertexNormals();
    const o = mesh(name, g, mat, parent, false);
    o.material.side = THREE.DoubleSide; return o;
  }
  function stitch(name, points, radius = .012, mat = seam, parent = chef) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(name, new THREE.TubeGeometry(path, Math.max(3, points.length*2), radius, 4, false), mat, parent, false);
  }

  for (const side of [-1, 1]) {
    const x = side * .66;
    loft('white trouser leg', [[.35,.39,.36,x,0],[2,.45,.41,x,0],[4.9,.53,.49,x,0]], cloth);
    ellipsoid('black work shoe', [x,.22,.24], [.45,.23,.81], shoe);
  }
  loft('wrap jacket', [[4.7,1.19,.56],[5.35,1.32,.63],[6.5,1.43,.66],[7.65,1.63,.64],[8.14,1.55,.49],[8.32,1.1,.44]], cloth);
  loft('neck', [[8.1,.36,.32],[8.85,.39,.36],[9.32,.43,.38]], skin);
  // The chest opening, overlapping lapels and diagonal jacket closure are geometry.
  patch('V neck opening', [[-.50,8.32,.45],[0,7.28,.70],[.50,8.32,.45]], skin);
  const outerLapel = [[-.48,8.65,.40],[-.82,8.30,.57],[.40,5.22,.67],[.72,5.35,.58]];
  const innerLapel = [[.45,8.65,.40],[.80,8.31,.57],[-.17,6.98,.73],[-.42,7.18,.72]];
  patch('underlapping collar', outerLapel, cloth);
  patch('overlapping collar', innerLapel, cloth);
  stitch('collar fold', [[.45,8.66,.42],[-.02,7.80,.69],[-.42,7.18,.745]], .015);
  stitch('diagonal jacket seam', [[-.48,8.65,.42],[.09,7.05,.74],[.58,5.28,.67]], .012);
  for (const side of [-1, 1]) {
    segment('short broad sleeve', [side*1.41,7.77,0], [side*2.45,6.05,.03], .64, .58, cloth);
    segment('turned sleeve hem', [side*2.39,6.17,.03], [side*2.48,5.98,.04], .60, .59, cap);
    segment('bare forearm', [side*2.46,6.04,.04], [side*2.94,4.43,.24], .34, .24, skin);
    ellipsoid('relaxed fist', [side*2.98,4.14,.29], [.32,.39,.29], skin);
    ellipsoid('thumb', [side*2.72,4.23,.44], [.14,.25,.16], skin, chef, false);
    for (let i=0; i<3; i++) {
      const x = side*(2.82+i*.12);
      stitch('finger crease', [[x,4.04,.55],[x+side*.015,3.91,.48]], .008, skinShadow);
    }
  }
  // A flared apron follows the reference; its lower part is occluded by the counter.
  patch('long apron', [[-1.2,4.95,.59],[-1.38,1.84,.63],[1.38,1.84,.63],[1.2,4.95,.59]], apron);
  stitch('apron hem', [[-1.34,1.92,.65],[0,1.89,.70],[1.34,1.92,.65]], .015);
  for (const side of [-1,1]) stitch('apron pleat', [[side*.88,4.77,.64],[side*.76,3.6,.70],[side*.98,2.05,.66]], .012);
  loft('wrapped white waist sash', [[4.65,1.26,.65],[4.80,1.29,.67],[5.01,1.26,.65]], cap);
  stitch('sash fold', [[-1.16,4.81,.34],[0,4.81,.70],[1.16,4.81,.34]], .013);
  ellipsoid('front sash knot', [0,4.78,.77], [.20,.19,.15], cap);
  for (const side of [-1, 1]) {
    patch('hanging sash tie', [[side*.06,4.76,.82],[side*.34,3.97,.80],[side*.57,4.01,.76],[side*.19,4.75,.81]], cap);
    stitch('sash tie seam', [[side*.12,4.66,.84],[side*.40,4.04,.81]], .008);
  }

  const head = new THREE.Group(); head.name = 'Chef adult head'; head.position.y = -.25; chef.add(head);
  loft('angular adult face', [[9.03,.25,.27,0,.12],[9.16,.42,.37,0,.09],[9.43,.55,.46,0,.04],[9.83,.67,.52],[10.22,.70,.53],[10.64,.63,.49],[10.84,.49,.40]], skin, 16, head);
  for (const side of [-1,1]) {
    ellipsoid('ear', [side*.69,9.86,-.015], [.17,.28,.16], skin, head);
    stitch('ear inner fold', [[side*.76,10.02,.11],[side*.79,9.86,.13],[side*.72,9.72,.13]], .018, skinShadow, head);
    // Narrow almond eyes and heavy brows give an adult, calm, focused expression.
    const x = side*.29;
    patch('almond eye', [[x-.18,10.10,.508],[x,10.155,.566],[x+.18,10.10,.508],[x,10.055,.566]], eye, head);
    ellipsoid('dark iris', [x,10.106,.566], [.051,.055,.018], ink, head, false);
    stitch('upper eyelid', [[x-.17,10.115,.526],[x,10.16,.581],[x+.16,10.115,.526]], .016, hair, head);
    stitch('lower eyelid', [[x-.15,10.06,.529],[x,10.04,.567],[x+.15,10.06,.529]], .009, skinShadow, head);
    patch('strong straight brow', [[side*.10,10.28,.55],[side*.14,10.37,.55],[side*.51,10.34,.39],[side*.53,10.27,.39],[side*.28,10.30,.55]], hair, head);
    stitch('cheek crease', [[side*.30,9.93,.54],[side*.37,9.79,.49]], .01, skinShadow, head);
    stitch('mouth fold', [[side*.17,9.71,.56],[side*.25,9.53,.50]], .009, skinShadow, head);
    // Sideburns remain visible under the low cloth cap.
    patch('sideburn', [[side*.62,10.56,.17],[side*.69,10.53,.08],[side*.68,9.99,.10],[side*.59,10.12,.29]], hair, head);
  }
  const noseGeometry = new THREE.BufferGeometry();
  noseGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.09,10.20,.53, .09,10.20,.53, -.15,9.83,.54, .15,9.83,.54, 0,9.85,.78, 0,9.74,.62,
  ], 3));
  noseGeometry.setIndex([0,2,4,0,4,1,1,4,3,2,5,4,3,4,5]); noseGeometry.computeVertexNormals();
  mesh('modeled nose', noseGeometry, skin, head, false);
  for (const side of [-1,1]) ellipsoid('nostril', [side*.105,9.79,.62], [.042,.018,.018], skinShadow, head, false);
  stitch('upper lip', [[-.20,9.48,.48],[-.08,9.51,.55],[0,9.49,.57],[.08,9.51,.55],[.20,9.48,.48]], .018, lip, head);
  stitch('mouth line', [[-.20,9.45,.49],[0,9.48,.58],[.20,9.45,.49]], .012, skinShadow, head);
  stitch('lower lip', [[-.13,9.42,.52],[0,9.40,.56],[.13,9.42,.52]], .016, lip, head);
  stitch('chin crease', [[-.11,9.24,.45],[0,9.22,.49],[.11,9.24,.45]], .008, skinShadow, head);
  loft('dark swept hair', [[10.40,.66,.50],[10.71,.70,.54,0,-.03],[10.92,.52,.41,0,-.04]], hair, 16, head);
  loft('low cylindrical cloth hat', [[10.60,.715,.56,0,-.015],[10.73,.73,.57,0,-.015],[11.40,.69,.54,0,-.015],[11.52,.59,.48,0,-.015]], cap, 16, head);
  loft('hat folded band', [[10.60,.727,.571,0,-.015],[10.77,.737,.581,0,-.015]], cloth, 16, head);
  for (const a of [-.95,0,.95]) {
    stitch('hat panel seam', [[Math.sin(a)*.73,10.79,Math.cos(a)*.58-.015],[Math.sin(a)*.69,11.37,Math.cos(a)*.54-.015]], .008, seam, head);
  }

  // Hand-drawn vector strokes keep the embroidered kanji independent of system fonts.
  const badgeMap = paintedMap('CHEF · 寿司 chest embroidery', (c, s) => {
    c.clearRect(0, 0, s, s); c.strokeStyle = '#23231f'; c.lineCap = 'round'; c.lineJoin = 'round';
    c.scale(s/100, s/100); c.lineWidth = 3.6;
    const draw = pts => { c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.stroke(); };
    // 寿
    for (const [x0,x1,y] of [[32,70,13],[28,74,23],[23,78,34]]) draw([[x0,y],[x1,y-1]]);
    draw([[52,5],[50,23],[43,37],[29,47]]);
    draw([[37,42],[76,41]]); draw([[63,35],[63,57],[57,56]]); draw([[43,48],[48,53]]);
    // 司
    draw([[29,65],[74,65],[73,94],[66,95]]); draw([[34,74],[63,74]]);
    draw([[38,81],[38,91],[61,91],[61,81],[38,81]]);
  });
  const badge = new THREE.MeshStandardMaterial({ name: 'CHEF · 寿司 embroidery', map: badgeMap, transparent: true, alphaTest: .1, roughness: 1, depthWrite: false });
  const embroidery = mesh('寿司 chest embroidery', new THREE.PlaneGeometry(.62, 1.13), badge, chef, false);
  embroidery.position.set(-.87,7.28,.595); embroidery.rotation.y = -.30;
  embroidery.renderOrder = 1;
  chef.updateMatrixWorld(true);
  return chef;
}
