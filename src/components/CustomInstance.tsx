import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Intersection,
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
import {heightMapConfig} from "../HexGrid";
import {defineHex} from "honeycomb-grid";
import {cellColorValues} from "./GridRenderer";

extend({InstancedUniformsMesh});

// =============================================================================
// we start with creating a custom hexagon geometry (6 points)

// The forth coord is the idx if the hex corner - we're not using it right now
// but the idea is that it could replace the position checks inside the vert shader
// at some point, we'll need to replace the default vertex shader with a custom one
// to make position a Vec4 instead of a Vec3. Need to figure out how that can work
// with creating derived materials though
type Points = [x: number, y: number, z: number, w: number][];
const piThird = Math.PI / 3;
// inside our shader we need 0 to be exactly 0, so we round to 10 decimal places
const precision = 10000000000;
const round = (n: number) => Math.round(n * precision) / precision;


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
    dimensions: heightMapConfig.cellRadius,
    orientation: heightMapConfig.cellOrientation,
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

function createHexagonGeometry(points: Points) {
  const bufferGeometry = new BufferGeometry();
  const vertices = genVerticesFromPoints(points);
  const positions = new Float32Array(vertices.flat());
  // TODO: interpolate normals
  const normals = new Float32Array(vertices.map(([x, y, z]) => [0, 1, 0]).flat());
  bufferGeometry.setAttribute('position', new BufferAttribute(positions, 4));
  bufferGeometry.setAttribute('normal', new BufferAttribute(normals, 3));
  return bufferGeometry;
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
  const instanceIndexByCellId: {[p: string]: number} = {};
  const heightOffsets = [];
  const instanceMatrices = [];
  const scaleVec = new Vector3(1, 1, 1).multiplyScalar(heightMapConfig.cellGapFactor);

  let idx = 0;
  for (const [hex, cells] of cellsByHex) {
    for (const [centerIntersection, cornerIntersections] of cells) {
      // create a matrix for the cell position
      const matrix = new Matrix4();
      const {point} = centerIntersection;
      matrix.setPosition(point.x, 0, point.z);
      matrix.scale(scaleVec);
      instanceMatrices.push(...matrix.toArray());
      // --------------------------------------------------------
      // create offset vectors for the corners (two Vec3 for six corners)
      heightOffsets.push(createOffsetVectors(cornerIntersections));
      // --------------------------------------------------------
      const id = idByCenterIntersection.get(centerIntersection)!;
      cellIds.push(id);
      instanceIndexByCellId[id] = idx;
      cellColorValues.push(0xffffff);
      idx++;
    }
  }

  const mesh = new InstancedUniformsMesh(
    createHexagonGeometry(genPoints()),
    createHexagonMaterial(), // could pass pointy vs flat here too
    idx
  );
  mesh.instanceMatrix.set(instanceMatrices);
  mesh.userData.cellIds = cellIds; // this way we can use the idx to get the cell id
  mesh.userData.instanceIndexByCellId = instanceIndexByCellId; // this way we can use the cell id to get the instance idx


  // set height uniforms for each instance
  heightOffsets.forEach((heightOffsets, i) => {
    mesh.setUniformAt('offsetEast', i, heightOffsets.offsetEast);
    mesh.setUniformAt('offsetWest', i, heightOffsets.offsetWest);
  });

  scene.add(mesh);
  return mesh;
}


function createHexagonMaterial() {
  const baseMaterial = new MeshBasicMaterial({
    color: 0x0000ff,
    side: DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.5,
  })
  const derivedMaterial = createDerivedMaterial(
    baseMaterial,
    {
      uniforms: {
        offsetWest: {value: new Vector3()},
        offsetEast: {value: new Vector3()},
      },
      vertexDefs: `
      uniform vec3 offsetWest;
      uniform vec3 offsetEast;
    `,
      // TODO: we could pass two different shader strings, depending on whether
      //  the cell is pointy or flat
      vertexTransform: `
      // west side of the hexagon
      if (position.x < 0.0) {
        // north-west
        if (position.z > 0.0) {
          position.y += offsetWest.x;  
        }
        else {
          // west
          if (position.z == 0.0) {
            position.y += offsetWest.y;
          }
          // south-west 
          else {
            position.y += offsetWest.z;
          }
        }
      } 
      // ----------------------------------
      // east side of the hexagon
      else {
        // north-east
        if (position.z > 0.0) {
          position.y += offsetEast.x;
        }
        else {
          // east
          if (position.z == 0.0) {
            position.y += offsetEast.y;
          }
          // south-east
          else {
            position.y += offsetEast.z;
          }
        }
      }   
    `
    }
  );
  return derivedMaterial;
}

/*

const NUM_INSTANCES = 10;
const instanceMatrices = new Float32Array(NUM_INSTANCES * 16);

// creating matrices for each instance
for (let i = 0; i < NUM_INSTANCES; i++) {
  const matrix = new Matrix4();
  matrix.setPosition(i * 2, 10, 0);
  instanceMatrices.set(matrix.toArray(), i * 16);
}


const hexGeometry = createHexagonGeometry(genPoints());
const derivedMaterial = createHexagonMaterial();
const mesh = new InstancedUniformsMesh(
  hexGeometry,
  derivedMaterial,
  NUM_INSTANCES
);
mesh.instanceMatrix.set(instanceMatrices);
const variation = 1.2;
const instanceHeightOffsets = Array.from(instanceMatrices).map(() => ({
  offsetEast: new Vector3(variation * Math.random() - variation / 2, variation * Math.random() - variation / 2, variation * Math.random() - variation / 2),
  offsetWest: new Vector3(variation * Math.random() - variation / 2, variation * Math.random() - variation / 2, variation * Math.random() - variation / 2),
}))

function copyHeightInformationIntoUniforms() {
  instanceMatrices.forEach((_, i) => {
    mesh.setUniformAt('offsetEast', i, instanceHeightOffsets[i].offsetEast);
    mesh.setUniformAt('offsetWest', i, instanceHeightOffsets[i].offsetWest);
  });
}
copyHeightInformationIntoUniforms();
*/

// =============================================================================


export function CustomInstance() {
  return (null
    //<primitive object={mesh}/>
  )
}


/*
Regarding normals:

Each vertex's default normal is that of the face it originally intersected with. Now this leads to abrupt
lighting changes between cells. To get smoother normals we need all the normal that the vertex has in other
triangles and interpolate them to get the final vertex normal. To do this we'll have to save all the different
normals a vertex has when building the cells and adjust the normals after that in a final step


 */


/*

// =============================================================================
const baseMaterial = new MeshStandardMaterial({color: 0xffcc00, side: DoubleSide})
const customMaterial = createDerivedMaterial(
  baseMaterial,
  {
    timeUniform: 'elapsed',
    uniforms: {
      uOffset: {value: 1.0},
      uOffsetVec: {value: new Vector2(1.0, 1.0)},
    },
    vertexDefs: `
      uniform float uOffset;
    `,

    // Add GLSL to tweak the vertex... notice this modifies the `position`
    // and `normal` attributes, which is normally not possible!
    vertexTransform: `
      float waveAmplitude = 0.1;
      float waveX = uv.x * PI * 4.0 - mod(elapsed / 300.0, PI2);
      float waveZ = sin(waveX) * waveAmplitude;
      normal.xyz = normalize(vec3(-cos(waveX) * waveAmplitude, 0.0, 1.0));
      position.z += waveZ;
      position.x += uOffset;
    `
  }
)

const matrix = new Matrix4();
matrix.setPosition(0, 10, 0);

const matrixValues = new Float32Array(16);
matrix.toArray(matrixValues);

const mesh = new InstancedUniformsMesh(
  new PlaneGeometry(10, 10, 64, 1),
  customMaterial,
  1
);
mesh.instanceMatrix.set(matrixValues);


// =============================================================================



 */