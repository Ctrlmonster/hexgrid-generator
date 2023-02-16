import createGraph, {Graph} from "ngraph.graph";
import {nba, PathFinder} from "ngraph.path";
import {CellNode, GridGraph} from "./buildGridDataStructure";


const getDistance = (a: CellNode, b: CellNode) => {
  return Math.sqrt((a.point.x - b.point.x) ** 2 + (a.point.y - b.point.y) ** 2 + (a.point.z - b.point.z) ** 2);
}

let pathFinder: PathFinder<CellNode> | null = null;
let graph: Graph<CellNode> | null = null;

function setupPathFinding(masterGrid: GridGraph) {
  /*
  if (pathFinder != null) {
    console.warn("pathfinder already exists")
    return;
  }*/
  // setup graph
  graph = createGraph();
  for (const [id, data] of Object.entries(masterGrid)) {
    graph.addNode(id, data);
    for (const neighborId of data.neighbors) {
      graph.addLink(id, neighborId);
    }
  }
  // ------------------------------------------------------
  // setup pathfinder using euclidean distance (seems to give better results for the 3d grid)
  pathFinder = nba<CellNode, CellNode>(graph, {
    distance(fromNode, toNode) {
      return getDistance(fromNode.data, toNode.data);
    },
    heuristic(fromNode, toNode) {
      return getDistance(fromNode.data, toNode.data);
    }
  });
}


const findPath = async (startCellId: string, targetCellId: string, /*pathFinder: PathFinder<Cell>*/) => {
  try {
    //const now = performance.now();
    const path = pathFinder!.find(String(startCellId), String(targetCellId));
    //console.log(`pathfinding IN worker took ${performance.now() - now}ms`);
    return path.map((cell) => cell.data.id);
  } catch (e) {
    console.log(e);
    // no path possible
    console.log("no path possible");
    return [];
  }

}

/*
self.onmessage = (e) => {
  const {type, payload} = e.data;
  console.log("received data from main thread");
  if (type === "setupPathFinding") {
    setupPathFinding(payload);
    self.postMessage({type: "setupPathFindingDone"});
  } else if (type === "findPath") {
    findPath(payload.startCellId, payload.targetCellId).then((path) => {
      self.postMessage({type: "pathFound", payload: path});
    });
  }
}*/


import {expose} from "threads/worker";

const func = {
  setupPathFinding,
  findPath,
}
export type PathFindingModule = typeof func;
expose(func);
