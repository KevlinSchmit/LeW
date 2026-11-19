import * as THREE from 'three';

// Separate pieces baked into one Blender mesh without rebaking UVs or normals.
export function partitionMesh(mesh, classify) {
  const source=mesh.geometry;
  const position=source.attributes.position;
  const index=source.index;
  const count=index?.count ?? position.count;
  const point=new THREE.Vector3(), center=new THREE.Vector3();
  const parts=new Map();
  mesh.updateMatrix();
  for (let i=0;i<count;i+=3) {
    const triangle=[i,i+1,i+2].map(n=>index ? index.getX(n) : n);
    center.set(0,0,0);
    for (const vertex of triangle) center.add(point.fromBufferAttribute(position,vertex));
    center.multiplyScalar(1/3).applyMatrix4(mesh.matrix);

    const key=classify(center);
    if (!parts.has(key)) parts.set(key,{vertices:new Map(),indices:[]});
    const {vertices,indices}=parts.get(key);
    for (const vertex of triangle) {
      if (!vertices.has(vertex)) vertices.set(vertex,vertices.size);
      indices.push(vertices.get(vertex));
    }
  }
  const meshes=new Map();
  for (const [key,{vertices,indices}] of parts) {
    const geometry=new THREE.BufferGeometry();
    for (const [name,attribute] of Object.entries(source.attributes)) {
      const data=new Float32Array(vertices.size*attribute.itemSize);
      for (const [from,to] of vertices) for (let i=0;i<attribute.itemSize;i++) {
        data[to*attribute.itemSize+i]=attribute.getComponent(from,i);
      }
      geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,attribute.itemSize));
    }
    geometry.setIndex(indices);
    const piece=mesh.clone(false);
    piece.geometry=geometry;
    meshes.set(key,piece);
  }
  return meshes;
}
