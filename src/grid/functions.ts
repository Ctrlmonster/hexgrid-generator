import {
  cellMeshes, centerIntersectionsInstancedMeshesRef,
  ENVIRONMENT_REF,
  finder, gridGraphRef, instancedMeshGridRef, neighborIntersectionsInstancedMeshesRef,
  pathMeshes,
  physicalGridRef, sceneRef,
  sharedCellDefaultMaterial,
  startCellIdRef,
  targetCellIdRef
} from "./globals";
import {heightMapConfig, planeConfig} from "../HexGrid";
import {Scene} from "three";
import {
  buildGridFromHexGridIntersections,
  buildGridGraph,
  createGrid2d,
  filterOutObstructedCells
} from "./buildGridDataStructure";
import {computeHexGridIntersections} from "./createHeightField";
import {createHexGridMeshFromHeightField} from "./buildGridMesh";
import {createCellInstances} from "../components/CustomInstance";


export function getCellMeshFromId(id: string) {
  return physicalGridRef.current![id];
}

export function getMeshesOfCellAndNeighborsFromId(id: string) {
  const cell = getCellMeshFromId(id);
  const neighbors = gridGraphRef.current![id].neighbors.map(id => getCellMeshFromId(id));
  return {cell, neighbors};
}


export function resetPathfinding(keepPath: boolean) {
  startCellIdRef.current = null;
  targetCellIdRef.current = null;
  if (!keepPath) {
    pathMeshes.forEach(mesh => mesh.material = sharedCellDefaultMaterial);
    pathMeshes.clear();
  }
}

function resetIntersectionInstances() {
  neighborIntersectionsInstancedMeshesRef.current.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.material.dispose();
    mesh.dispose();
  })
  neighborIntersectionsInstancedMeshesRef.current.length = 0;
  neighborIntersectionsInstancedMeshesRef.strips.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  })
  neighborIntersectionsInstancedMeshesRef.strips.length = 0;
  // -------------------------------------------------------------
  centerIntersectionsInstancedMeshesRef.current.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.material.dispose();
    mesh.dispose();
  });
  centerIntersectionsInstancedMeshesRef.current.length = 0;
}

function resetGridAndPathfinding(scene: Scene) {
  // -------------------------------------------------------------
  // reset previous
  resetPathfinding(false);
  resetIntersectionInstances();
  physicalGridRef.current = null;
  // delete all previous meshes
  for (const cellMesh of cellMeshes) {
    // dispose geom, we keep the material because it is shared
    cellMesh.geometry.dispose();
    scene.remove(cellMesh);
  }
  cellMeshes.length = 0;
  // -------------------------------------------------------------
}


export async function build3dGridWithPathfinding(scene: Scene) {
  resetGridAndPathfinding(scene);
  // ---------------------------------------------------
  const grid2d = createGrid2d(heightMapConfig);
  // find all intersections of the 2d grid with the scene
  const hexGridIntersections = computeHexGridIntersections(
    ENVIRONMENT_REF.current,
    grid2d,
    heightMapConfig
  );
  // build the data structure of intersections points - basically the 3d grid
  const cellsByHex = buildGridFromHexGridIntersections(
    hexGridIntersections,
    heightMapConfig.minHeightDiffStackedCells,
    heightMapConfig.maxHeightCenterToCorner
  );

  // we remove all cells that are obstructed by obstacles
  filterOutObstructedCells(cellsByHex);
  // merge corners that have very small height difference

  // build a data structure that can be used for path finding
  gridGraphRef.current = buildGridGraph(cellsByHex, grid2d, heightMapConfig.maxHeightNeighborToCenter);
  // use the 3d points to build cell meshes
  instancedMeshGridRef.current = createCellInstances(cellsByHex, scene);
  planeConfig.visible = false;

  await finder.setupPathFinding(gridGraphRef.current);

  /*

  physicalGridRef.current = createHexGridMeshFromHeightField(scene, cellsByHex);
  cellMeshes.push(...Object.values(physicalGridRef.current));
*/
  // hide the creator plane after the grid is built

}
