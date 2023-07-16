import {
  centerIntersectionsInstancedMeshesRef,
  gridGraphRef,
  GROUND_REF,
  instancedMeshGridRef,
  mergedGridMesh,
  neighborIntersectionsMeshRefs,
  pathFinder,
  sceneRef,
  startCellIdRef,
  targetCellIdRef
} from "./globals";
import {gridConfig, planeConfig} from "../HexGrid";
import {Color, Scene} from "three";
import {
  buildGridFromHexGridIntersections,
  buildGridGraph,
  CellNode,
  createGrid2d,
  filterOutCellIslands,
  filterOutObstructedCells,
  GridGraph, idByCenterIntersection,
  resetCellId
} from "./buildGridDataStructure";
import {computeHexGridIntersections} from "./createHeightField";
import {createCellInstances} from "../components/CustomInstance";
import {createHexGridMeshFromHeightField} from "./buildGridMesh";
import createGraph from "ngraph.graph";
import {nba} from "ngraph.path";


export function resetPathfinding() {
  startCellIdRef.current = null;
  targetCellIdRef.current = null;
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
  neighborIntersectionsMeshRefs.points.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.material.dispose();
    mesh.dispose();
  });
  neighborIntersectionsMeshRefs.points.length = 0;
  neighborIntersectionsMeshRefs.strips.forEach(mesh => {
    sceneRef.current!.remove(mesh);
    mesh.geometry.dispose(); // strips are actual meshes, not instanced meshes
    mesh.material.dispose();
  });
  neighborIntersectionsMeshRefs.strips.length = 0;
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
  resetPathfinding();
  resetIntersectionInstances();
  resetGridInstances();
  if (mergedGridMesh.current) {
    mergedGridMesh.current.geometry.dispose();
    scene.remove(mergedGridMesh.current);
    mergedGridMesh.current = null;
  }
}


// Setting up pathfinding on the main thread real quick to make this faster
const getDistance = (a: CellNode, b: CellNode) => {
  return Math.sqrt((a.point.x - b.point.x) ** 2 + (a.point.y - b.point.y) ** 2 + (a.point.z - b.point.z) ** 2);
}

function setupPathFinding(masterGrid: GridGraph) {
  // setup graph
  const graph = createGraph();
  for (const [id, data] of Object.entries(masterGrid)) {
    graph.addNode(id, data);
    for (const neighborId of data.neighbors) {
      graph.addLink(id, neighborId);
    }
  }
  // ------------------------------------------------------
  // setup pathfinder using Euclidean distance (seems to give better results for the 3d grid)
  return nba<CellNode, CellNode>(graph, {
    distance(fromNode, toNode) {
      return getDistance(fromNode.data, toNode.data);
    },
    heuristic(fromNode, toNode) {
      return getDistance(fromNode.data, toNode.data);
    }
  });
}


export async function build3dGridWithPathfinding(scene: Scene) {
  resetGridAndPathfinding(scene);
  // ---------------------------------------------------
  const grid2d = createGrid2d(gridConfig);

  // find all intersections of the 2d grid with the scene
  const hexGridIntersections = computeHexGridIntersections(
    GROUND_REF.current,
    grid2d,
    gridConfig
  );
  // build the data structure of intersections points - basically the 3d grid
  const cellsByHex = buildGridFromHexGridIntersections(
    hexGridIntersections,
    gridConfig.minHeightDiffStackedCells,
    gridConfig.maxHeightCenterToCorner
  );

  // we remove all cells that are obstructed by obstacles
  if (gridConfig.checkForObstacles) filterOutObstructedCells(cellsByHex);
  // merge corners that have very small height difference

  // build a data structure that can be used for path finding
  gridGraphRef.current = buildGridGraph(cellsByHex, grid2d, gridConfig.maxHeightNeighborToCenter);
  pathFinder.current = setupPathFinding(gridGraphRef.current);


  // filter out any islands - areas that cannot be reached from the rest of the grid
  if (gridConfig.noCellIslands) filterOutCellIslands(cellsByHex, gridGraphRef.current);

  /*console.log(JSON.stringify(Array.from(idByCenterIntersection.entries())));*/

  // use the 3d points to build cell meshes
  instancedMeshGridRef.current = createCellInstances(cellsByHex, scene);
  planeConfig.visible = false;

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