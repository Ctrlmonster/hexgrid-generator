// =====================================================================================================================
import {BufferAttribute, BufferGeometry, Color, Intersection, Mesh, Object3D, Vector3} from "three";
import {heightMapConfig, renderOptions} from "../HexGrid";
import {CornersByCenterByHex, idByCenterIntersection} from "./buildGridDataStructure";
import {sharedCellDefaultMaterial} from "./globals";

/*
Contains a function that creates the hexagon meshes from a height field
and a function to create the buffer geometry for a single hexagon
*/


export type PhysicalGrid = { [id: string]: Mesh };


export function createHexGridMeshFromHeightField(scene: Object3D, cellsByHex: CornersByCenterByHex): PhysicalGrid {
  // stores the mesh by id, also we store the id in mesh.userData
  const physicalGrid: PhysicalGrid = {};

  for (const [hex, cells] of cellsByHex) {
    for (const [centerIntersection, cornerIntersections] of cells) {
      // if an intersection did not get an id when we build the grid graph, we will not create a mesh for it
      if (!idByCenterIntersection.has(centerIntersection)) continue;

      const bufferGeometry = createBufferGeometryFromIntersections(cornerIntersections, centerIntersection);
      const mesh = new Mesh(bufferGeometry, sharedCellDefaultMaterial);

      mesh.position.set(
        ...new Vector3(
          centerIntersection.point.x,
          centerIntersection.point.y,
          centerIntersection.point.z
        )./*multiplyScalar(1 + heightMapConfig.zFightOffset).*/toArray()
      );
      scene.add(mesh);
      // we saved the id by the intersection earlier - this way we can now associate
      // each mesh with the cell id, which is used for path finding.
      const id = idByCenterIntersection.get(centerIntersection)!;
      mesh.userData = {id};
      physicalGrid[id] = mesh;
    }
  }
  // we no longer need the map
  //idByCenterIntersection.clear();

  return physicalGrid;
}


export function createBufferGeometryFromIntersections(corners: Intersection[], center: Intersection): BufferGeometry {
  if (corners.length !== 6) {
    throw new Error('there need to be exactly 6 intersections to create a hex geometry');
  }


  const transformPos = (point: Vector3, normal: Vector3) =>
    new Vector3(
      point.x - center.point.x,
      point.y - center.point.y,
      point.z - center.point.z
    ).multiplyScalar(heightMapConfig.cellGapFactor).add(normal.clone().multiplyScalar(heightMapConfig.zFightOffset));

  //const point0 = new Vector3().addVectors(corners[0].point, new Vector3(...center.face!.normal.toArray()).multiplyScalar(0.1));
  const point0 = transformPos(corners[0].point, corners[0].face!.normal);
  const point1 = transformPos(corners[1].point, corners[1].face!.normal);
  const point2 = transformPos(corners[2].point, corners[2].face!.normal);
  const point3 = transformPos(corners[3].point, corners[3].face!.normal);
  const point4 = transformPos(corners[4].point, corners[4].face!.normal);
  const point5 = transformPos(corners[5].point, corners[5].face!.normal);


  // TODO: create a function that takes the normals of 4 adjacent vertices and interpolates their normals
  //  for smoother lighting - the challenge here is that we need the vertices from different cells to get all 4
  const bufferGeometry = new BufferGeometry();
  const color = [0, 0, 1, 0.5];
  const vertices = [
    // triangle A: points 3, 1, 0
    {pos: point3, normal: center.face!.normal, color},
    {pos: point1, normal: center.face!.normal, color},
    {pos: point0, normal: center.face!.normal, color},
    // triangle B: intersections 3, 2, 1
    {pos: point3, normal: center.face!.normal, color},
    {pos: point2, normal: center.face!.normal, color},
    {pos: point1, normal: center.face!.normal, color},
    // triangle C: intersections 4, 3, 0
    {pos: point4, normal: center.face!.normal, color},
    {pos: point3, normal: center.face!.normal, color},
    {pos: point0, normal: center.face!.normal, color},
    // triangle D: intersections 5, 4, 0
    {pos: point5, normal: center.face!.normal, color},
    {pos: point4, normal: center.face!.normal, color},
    {pos: point0, normal: center.face!.normal, color},
  ];
  // What about uvs?
  const positions = new Float32Array(vertices.flatMap((vertex) => [vertex.pos.x, vertex.pos.y, vertex.pos.z]));
  const normals = new Float32Array(vertices.flatMap((vertex) => [vertex.normal.x, vertex.normal.y, vertex.normal.z]));
  const colors = new Float32Array(vertices.flatMap((vertex) => [vertex.color[0], vertex.color[1], vertex.color[2], vertex.color[3]]));
  bufferGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  bufferGeometry.setAttribute('normal', new BufferAttribute(normals, 3));
  bufferGeometry.setAttribute('color', new BufferAttribute(colors, 4));
  return bufferGeometry;
}

// =====================================================================================================================
