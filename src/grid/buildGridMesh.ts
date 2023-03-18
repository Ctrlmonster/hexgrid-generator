// =====================================================================================================================
import {
  BufferAttribute,
  BufferGeometry,
  BufferGeometryUtils,
  Color,
  Intersection,
  Mesh,
  Object3D,
  Vector3
} from "three";
import {heightMapConfig, renderOptions} from "../HexGrid";
import {CornersByCenterByHex, idByCenterIntersection} from "./buildGridDataStructure";
import {idByFaceIndex, sharedCellDefaultMaterial} from "./globals";
import {mergeBufferGeometries} from "three-stdlib";

/*
Contains a function that creates the hexagon meshes from a height field
and a function to create the buffer geometry for a single hexagon
*/


export type PhysicalGrid = { [id: string]: Mesh };


export function createHexGridMeshFromHeightField(scene: Object3D, cellsByHex: CornersByCenterByHex) {
  // Instead of creating lots of meshes, we merge all geometries together to one big grid geometry
  // that we can then use for raycasting.
  const geometries = [];
  const numFacesPerCell = 4;
  idByFaceIndex.clear(); // clear in case we're re-building the grid


  let faceIdx = 0;
  for (const [hex, cells] of cellsByHex) {
    for (const [centerIntersection, cornerIntersections] of cells) {
      // if an intersection did not get an id when we build the grid graph, we will not create a mesh for it
      if (!idByCenterIntersection.has(centerIntersection)) {
        console.error("no id for center intersection", centerIntersection);
        continue; // this shouldn't happen anymore, that's why we throw an error
      }
      const bufferGeometry = createBufferGeometryFromIntersections(cornerIntersections, centerIntersection);
      geometries.push(bufferGeometry);
      // we link of each the geometry faces to the cell id
      const id = idByCenterIntersection.get(centerIntersection)!;
      for (let i = 0; i < numFacesPerCell; i++) {
        idByFaceIndex.set(faceIdx + i, id);
      }
      faceIdx += numFacesPerCell;
    }
  }

  const resultGeometry = mergeBufferGeometries(geometries);
  if (!resultGeometry) {
    throw "failed to build grid geometry";
  }
  // does not have to be added to the scene tree to perform raycasts on it
  const gridMesh = new Mesh(resultGeometry, sharedCellDefaultMaterial);

  // TODO: include grid gap parameter into merged mesh (probably by making the individual geometry a bit larger)
  // scene.add(gridMesh);
  // Using the bvh for raycasting leads to totally unexpected behaviour
  //gridMesh.geometry.computeBoundsTree(); // compute bvh for merged geometry

  return gridMesh;
}


export function createBufferGeometryFromIntersections(corners: Intersection[], center: Intersection): BufferGeometry {
  if (corners.length !== 6) {
    throw new Error('there need to be exactly 6 intersections to create a hex geometry');
  }


  const transformPos = (point: Vector3, normal: Vector3) =>
    new Vector3(
      point.x, /*point.x - center.point.x,*/
      point.y, /*point.y - center.point.y,*/
      point.z, /*point.z - center.point.z*/
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
