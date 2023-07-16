import {BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D, Scene} from "three";
import TypedSet from "../helper/TypedSet";
import {CellNode, GridGraph} from "./buildGridDataStructure";
import {InstancedUniformsMesh} from "three-instanced-uniforms-mesh";
import {PathFinder} from "ngraph.path";


// cell material(s)
export const CELL_COLOR = "#000000";
export const defaultCellMaterial = new MeshBasicMaterial({
  color: CELL_COLOR,
  transparent: true,
  opacity: 0,
});
// derived cell material extends default cell material
export const derivedCellMaterial: { current: MeshBasicMaterial | null } = {current: null};
export const cellColorValues: number[] = [];

// ---------------------------------------------------------------------------------------------------------------------

// path finding
export const pathFinder: { current: PathFinder<CellNode> } = {current: null!};
export const startCellIdRef: { current: null | string } = {current: null};
export const targetCellIdRef: { current: null | string } = {current: null};
export const pathInstances = new TypedSet<number>(); // instance id of cells in path
// ---------------------------------------------------------------------------------------------------------------------

// mesh refs
// origin cell mesh ref (used by instances)
export const instancedMeshGridRef: { current: null | InstancedUniformsMesh<MeshBasicMaterial> } = {current: null};
// merged grid mesh ref (used for raycasting and exportable via button)
export const mergedGridMesh: { current: Mesh | null } = {current: null};
// whole scene
export const sceneRef: { current: null | Scene } = {current: null};
// environment ref (excluding grid meshes)
export const ENVIRONMENT_REF: { current: Object3D } = {current: null!};
// ground ref - extra mesh for raycasting when building the grid
export const GROUND_REF: { current: Group } = {current: null!};
// ---------------------------------------------------------------------------------------------------------------------

// intersection tests / visualization
export const centerIntersectionsInstancedMeshesRef: { current: InstancedUniformsMesh<MeshBasicMaterial>[] } =
  {current: []};
export const neighborIntersectionsMeshRefs:
  { points: InstancedUniformsMesh<MeshBasicMaterial>[], strips: Mesh<BufferGeometry, MeshBasicMaterial>[] } =
  {points: [], strips: []};

export const neighborStripMaterialBlocked = new MeshBasicMaterial({
  color: 0xff0000,
  side: DoubleSide,
  transparent: true,
  opacity: 0.5,
  depthTest: false
});
export const neighborStripMaterialFree = new MeshBasicMaterial({
  color: 0x00ff00,
  side: DoubleSide,
  transparent: true,
  opacity: 1,
  depthTest: false
});

// ---------------------------------------------------------------------------------------------------------------------

// data structures to be exported with mesh
export const adaptedCellCentersById: { [p: string]: { x: number, y: number, z: number } } = {};
export const idByFaceIndex = new Map();
// graph data structure - necessary for path finding setup and includes cell pos + adapted center pos
export const gridGraphRef: { current: null | GridGraph } = {current: null};

// ---------------------------------------------------------------------------------------------------------------------


// @ts-ignore
window.adaptedCellCentersById = adaptedCellCentersById;
// @ts-ignore
window.physicalGridRef = mergedGridMesh;
// @ts-ignore
window.sceneRef = sceneRef;
// @ts-ignore
window.gridGraphRef = gridGraphRef;