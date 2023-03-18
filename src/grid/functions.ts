import {
  cellMeshes, centerIntersectionsInstancedMeshesRef,
  ENVIRONMENT_REF,
  finder, gridGraphRef, GROUND_REF, instancedMeshGridRef, neighborIntersectionsInstancedMeshesRef,
  pathMeshes,
  mergedGridMesh, sceneRef,
  sharedCellDefaultMaterial,
  startCellIdRef,
  targetCellIdRef
} from "./globals";
import {heightMapConfig, planeConfig} from "../HexGrid";
import {Color, Scene} from "three";
import {
  buildGridFromHexGridIntersections,
  buildGridGraph,
  createGrid2d,
  filterOutCellIslands,
  filterOutObstructedCells, resetCellId
} from "./buildGridDataStructure";
import {computeHexGridIntersections} from "./createHeightField";
//import {createHexGridMeshFromHeightField} from "./buildGridMesh";
import {createCellInstances} from "../components/CustomInstance";
import {createHexGridMeshFromHeightField} from "./buildGridMesh";

/*
// this was relevant before we started using instances for cells
export function getCellMeshFromId(id: string) {
  return physicalGridRef.current![id];
}

export function getMeshesOfCellAndNeighborsFromId(id: string) {
  const cell = getCellMeshFromId(id);
  const neighbors = gridGraphRef.current![id].neighbors.map(id => getCellMeshFromId(id));
  return {cell, neighbors};
}
*/

export function resetPathfinding(keepPath: boolean) {
  startCellIdRef.current = null;
  targetCellIdRef.current = null;
  if (!keepPath) {
    pathMeshes.forEach(mesh => mesh.material = sharedCellDefaultMaterial);
    pathMeshes.clear();
  }
}

function resetGridInstances() {
  if (instancedMeshGridRef.current) {
    sceneRef.current!.remove(instancedMeshGridRef.current);
    instancedMeshGridRef.current.material.dispose();
    instancedMeshGridRef.current.dispose();
    instancedMeshGridRef.current = null;
  }
}

function resetIntersectionInstances() {
  neighborIntersectionsInstancedMeshesRef.current.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.material.dispose();
    mesh.dispose();
  });
  neighborIntersectionsInstancedMeshesRef.current.length = 0;
  neighborIntersectionsInstancedMeshesRef.strips.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.geometry.dispose(); // strips are actual meshes, not instanced meshes
    mesh.material.dispose();
  });
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
  resetCellId();
  resetPathfinding(false);
  resetIntersectionInstances();
  resetGridInstances();
  if (mergedGridMesh.current) {
    mergedGridMesh.current.geometry.dispose();
    scene.remove(mergedGridMesh.current);
    mergedGridMesh.current = null;
  }
  // delete all previous meshes
  // cell meshes are no longer relevant since we're using instances (I think)
  // remove this in that case
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
    GROUND_REF.current,
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
  if (heightMapConfig.checkForObstacles) filterOutObstructedCells(cellsByHex);
  // merge corners that have very small height difference

  // build a data structure that can be used for path finding
  gridGraphRef.current = buildGridGraph(cellsByHex, grid2d, heightMapConfig.maxHeightNeighborToCenter);


  // filter out any islands - areas that cannot be reached from the rest of the grid
  if (heightMapConfig.noCellIslands) filterOutCellIslands(cellsByHex, gridGraphRef.current);


  // use the 3d points to build cell meshes
  instancedMeshGridRef.current = createCellInstances(cellsByHex, scene);
  planeConfig.visible = false;

  await finder.setupPathFinding(gridGraphRef.current);


  // actual meshes
  mergedGridMesh.current = createHexGridMeshFromHeightField(scene, cellsByHex);
  //cellMeshes.push(...Object.values(physicalGridRef.current));
  // ---------------------------------------------------

}


export const computeColorGradient = (() => {
  const colorsByNumber = new Map();

  function compute(numColors: number) {
    if (colorsByNumber.has(numColors)) {
      return colorsByNumber.get(numColors);
    }

    const colors = [];
    const hueStep = 300 / numColors;
    const saturation = 100;
    const lightness = 50;

    for (let i = 0; i < numColors; i++) {
      const hue = i * hueStep;
      const color = new Color(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      colors.push(color);
    }


    colorsByNumber.set(numColors, colors);
    return colors;
  }

  return compute;
})();