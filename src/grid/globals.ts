import {spawn, Worker} from "threads";
import {PathFindingModule} from "./pathfinding";

import path from "./pathfinding?url";
import {BufferGeometry, Material, Mesh, MeshBasicMaterial, Object3D, Scene} from "three";
import TypedSet from "../helper/TypedSet";
import {PhysicalGrid} from "./buildGridMesh";
import {GridGraph} from "./buildGridDataStructure";
import {InstancedUniformsMesh} from "three-instanced-uniforms-mesh";
import {Vector3} from "@react-three/fiber";

export const finder = await spawn<PathFindingModule>(new Worker(path, {type: "module"}));

export const ENVIRONMENT_REF: { current: Object3D } = {current: null!};

export const CELL_COLOR = "#ff8b00";
export const CELL_COLOR_HIGHLIGHTED = "#1b5717";
export const sharedCellPathMaterial = new MeshBasicMaterial({color: CELL_COLOR_HIGHLIGHTED});
export const sharedCellDefaultMaterial = new MeshBasicMaterial({
  vertexColors: true,
  color: CELL_COLOR_HIGHLIGHTED,
  transparent: true,
  depthTest: false,
});
export const sceneRef: { current: null | Scene } = {current: null};
export const cellMeshes: Mesh[] = [];
export const pathMeshes = new TypedSet<Mesh>();
export const pathInstances = new TypedSet<number>();
export const physicalGridRef: { current: PhysicalGrid | null } = {current: null};
export const startCellIdRef: { current: null | string } = {current: null};
export const targetCellIdRef: { current: null | string } = {current: null};
export const gridGraphRef: { current: null | GridGraph } = {current: null};
export const neighborIntersectionsInstancedMeshesRef:
  { current: InstancedUniformsMesh<MeshBasicMaterial>[], strips: Mesh<BufferGeometry, MeshBasicMaterial>[] } = {
  current: [],
  strips: []
};
export const centerIntersectionsInstancedMeshesRef:
  { current: InstancedUniformsMesh<MeshBasicMaterial>[] } = {current: []};
export const adaptedCellCentersById: { [p: string]: { x: number, y: number, z: number } } = {};
export const instancedMeshGridRef: { current: null | InstancedUniformsMesh<MeshBasicMaterial> } = {current: null};


// @ts-ignore
window.adaptedCellCentersById = adaptedCellCentersById;
// @ts-ignore
window.physicalGridRef = physicalGridRef;
// @ts-ignore
window.sceneRef = sceneRef;
// @ts-ignore
window.gridGraphRef = gridGraphRef;