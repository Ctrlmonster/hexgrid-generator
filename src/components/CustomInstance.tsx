import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide, FrontSide, InstancedBufferAttribute,
  Intersection, Matrix3,
  Matrix4, MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  Vector3
} from "three";
// @ts-ignore
import {createDerivedMaterial} from "troika-three-utils";
import {InstancedUniformsMesh} from "three-instanced-uniforms-mesh";
import {extend, useFrame, useThree} from "@react-three/fiber";
import {CornersByCenterByHex, idByCenterIntersection} from "../grid/buildGridDataStructure";
import {PhysicalGrid} from "../grid/buildGridMesh";
import {gridConfig, renderOptions} from "../HexGrid";
import {defineHex} from "honeycomb-grid";
import {cellInstanceVertex, cellInstanceVertexAlt} from "../misc/shader";
import {defaultCellMaterial, derivedCellMaterial, cellColorValues} from "../grid/globals";

extend({InstancedUniformsMesh});

// =============================================================================
// we start with creating a custom hexagon geometry (6 points)

// The forth coord is the idx if the hex corner - we're not using it right now
// but the idea is that it could replace the position checks inside the vert shader
// at some point, we'll need to replace the default vertex shader with a custom one
// to make position a Vec4 instead of a Vec3. Need to figure out how that can work
// with creating derived materials though
type Points = [x: number, y: number, z: number, w: number][];

const genVerticesFromPoints = (points: Points) => {
  return [
    // first triangle
    points[3], points[1], points[0],
    // second triangle
    points[3], points[2], points[1],
    // third triangle
    points[4], points[3], points[0],
    // fourth triangle
    points[5], points[4], points[0],
  ];
}


function genPoints(): Points {
  const Tile = defineHex({
    dimensions: gridConfig.cellRadius,
    orientation: gridConfig.cellOrientation,
    // origin is the top left corner of the rect grid (the offsets are actually in
    // reverse world space dir, that's why we flip them)
    //origin: {x: -heightMapConfig.offsetX, y: -heightMapConfig.offsetZ}
  });

  const t = new Tile();
  // map to x, z and include idx as w
  const res = t.corners.map(({x, y}, i) => [x, 0, y, i]);
  console.log(res);
  return res as Points;
}

function createHexagonGeometry(points: Points, offsets: number[]) {
  const bufferGeometry = new BufferGeometry();
  const vertices = genVerticesFromPoints(points);
  const positions = new Float32Array(vertices.flat());

  console.log(positions);

  // Could do more to calculate normals, but for now we just use a flat normal
  const normals = new Float32Array(vertices.map(([x, y, z]) => [0, 1, 0]).flat());
  const vertexIndices = new Float32Array(vertices.map((_, i) => i));

  bufferGeometry.setAttribute('position', new BufferAttribute(positions, 4));
  bufferGeometry.setAttribute('normal', new BufferAttribute(normals, 3));

  // TODO: if gl_VertexID doesn't work, we can use this to access the offset value
  // bufferGeometry.setAttribute('vertexIndex', new BufferAttribute(vertexIndices, 1));
  //bufferGeometry.setAttribute('offset', new InstancedBufferAttribute(new Float32Array(offsets), 1));

  bufferGeometry.setAttribute('offset', new InstancedBufferAttribute(new Float32Array(offsets), 1));

  return bufferGeometry;
}

function createOffsetArray(cornerIntersections: Intersection[]) {
  /*
  // first triangle
    points[3], points[1], points[0],
    // second triangle
    points[3], points[2], points[1],
    // third triangle
    points[4], points[3], points[0],
    // fourth triangle
    points[5], points[4], points[0],
   */
  // return like this
  return [
    cornerIntersections[3].point.y, cornerIntersections[1].point.y, cornerIntersections[0].point.y,
    /*cornerIntersections[3].point.y,*/ cornerIntersections[2].point.y, /*cornerIntersections[1].point.y,*/
    cornerIntersections[4].point.y,/* cornerIntersections[3].point.y, cornerIntersections[0].point.y,*/
    cornerIntersections[5].point.y,/* cornerIntersections[4].point.y, cornerIntersections[0].point.y,*/
  ];

  /*
  return [
    cornerIntersections[0].point.y,
    cornerIntersections[1].point.y,
    cornerIntersections[2].point.y,
    cornerIntersections[3].point.y,
    cornerIntersections[4].point.y,
    cornerIntersections[5].point.y,
  ]*/
}


function createOffsetVectors(cornerIntersections: Intersection[]) {
  // Mappings for vert shader:
  // 0 => south east
  // 1 => east
  // 2 => north east
  // 3 => north west
  // 4 => west
  // 5 => south west

  // offSetEast.x => north east
  // offSetEast.y => east
  // offSetEast.z => south east

  // offSetWest.x => north west
  // offSetWest.y => west
  // offSetWest.z => south west

  const offsetEast = new Vector3(cornerIntersections[2].point.y, cornerIntersections[1].point.y, cornerIntersections[0].point.y);
  const offsetWest = new Vector3(cornerIntersections[3].point.y, cornerIntersections[4].point.y, cornerIntersections[5].point.y);
  return {offsetEast, offsetWest};
}


// we'll create a matrix for each hexagon.
export function createCellInstances(cellsByHex: CornersByCenterByHex, scene: Scene) {
  // we store the corner intersections to interpolate the normals in a second step
  const cellIds = []; // will be written into mesh.userData(?) - links id to idx
  const instanceIndexByCellId: { [p: string]: number } = {};
  const heightOffsetVectors = [];
  const heightOffsetsArr: number[] = []; // used for the alternative vertex shader (that is not yet working)
  const instanceMatrices = [];
  const scaleVec = new Vector3(1, 1, 1).multiplyScalar(gridConfig.cellGapFactor);


  let idx = 0;
  for (const [hex, cells] of cellsByHex) {
    for (const [centerIntersection, cornerIntersections] of cells) {
      // create a matrix for the cell position
      const matrix = new Matrix4();
      const {point} = centerIntersection;
      matrix.setPosition(point.x, gridConfig.zFightOffset, point.z);
      matrix.scale(scaleVec);
      instanceMatrices.push(...matrix.toArray());
      // --------------------------------------------------------
      // create offset vectors for the corners (two Vec3 for six corners)
      heightOffsetVectors.push(createOffsetVectors(cornerIntersections));
      heightOffsetsArr.push(...createOffsetArray(cornerIntersections));
      // --------------------------------------------------------
      const id = idByCenterIntersection.get(centerIntersection);
      if (id == undefined) {
        throw 'no id for center intersection';
      }
      cellIds.push(id);
      instanceIndexByCellId[id] = idx;
      cellColorValues.push(defaultCellMaterial.color.getHex());
      idx++;
    }
  }

  const mesh = new InstancedUniformsMesh(
    createHexagonGeometry(genPoints(), heightOffsetsArr),
    createHexagonMaterial(), // could pass pointy vs flat here too
    idx
  );

  mesh.instanceMatrix.set(instanceMatrices);
  mesh.userData.cellIds = cellIds; // this way we can use the idx to get the cell id
  mesh.userData.instanceIndexByCellId = instanceIndexByCellId; // this way we can use the cell id to get the instance idx

  /*
  // set height uniforms for each instance
  heightOffsetsArr.forEach((heightOffsets, i) => {
    mesh.setUniformAt('heightOffsets', i, heightOffsetsArr[i]);
  });
  */


  heightOffsetVectors.forEach((heightOffsets, i) => {
    mesh.setUniformAt('offsetEast', i, heightOffsets.offsetEast);
    mesh.setUniformAt('offsetWest', i, heightOffsets.offsetWest);
  });

  if (renderOptions.displayCellInstances) {
    scene.add(mesh);
  }
  return mesh;
}


function createHexagonMaterial() {
  const baseMaterial = defaultCellMaterial.clone();


  /*
  const baseMaterial = new MeshBasicMaterial({
    color: renderOptions.cellColor,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -200,
    wireframe: renderOptions.renderCellsAsWireFrame,

    transparent: true,
    opacity: renderOptions.cellRenderOpacity,
  })*/


  const derivedMaterial = createDerivedMaterial(
    baseMaterial,
    //cellInstanceVertexAlt <- alternative vertex shader, not yet working
    cellInstanceVertex
  );

  derivedCellMaterial.current = derivedMaterial;

  return derivedMaterial;
}

