import {Orientation} from 'honeycomb-grid'
import {Html, TransformControls} from "@react-three/drei";
import {proxy, useSnapshot} from 'valtio';
import {
  Color, DepthModes,
  DoubleSide,
  FrontSide,
  Group,
  Mesh, MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3
} from "three";
import {useEffect, useRef, useState} from "react";
import {folder, useControls} from "leva";
import {CELL_COLOR, CELL_COLOR_HIGHLIGHTED, sharedCellDefaultMaterial, sharedCellPathMaterial} from "./grid/globals";


/*

TODO: Ordered list of things to do
  * Stacked Cell Parameter is not working correctly (?)
  * add something like first hit only into the algo
  * Prefer higher corner values (similar to stacked center intersections)
  * Make number of obstacle intersections check per cell a parameter (where N=1 means only check cell center)
  * display size of grid in stats
  * add all configs to leva
  * add 2d grid version to the creator plane
  * add info about number of geometries in stats

 */

// ----------------------------------------------
// global structures that are shared between modules

// TODO: prob. rename file to creator plane
// ----------------------------------------------

// grid creation parameters
const RAY_CAST_START_HEIGHT = 30;
const GRID_COLS = 10;
const GRID_ROWS = 10;
const OFFSET_X = -17.9;
const OFFSET_Z = -0.3781;
const FIRST_HIT_ONLY = false;
const Z_FIGHT_OFFSET = .01;
const CELL_RADIUS = 1.5;
const CELL_ORIENTATION = Orientation.POINTY as Orientation;
const MAX_HEIGHT_CENTER_TO_CORNERS = 1.0;
const MAX_HEIGHT_NEIGHBOR_TO_CENTER = 2.0;
const MIN_HEIGHT_DIFF_STACKED_CELLS = 5.0;
const RAY_CAST_Y_DIRECTION = -1;

const INNER_CELL_RADIUS_FACTOR = 0.88;
const CENTER_ADAPTION_OBSTACLE_FACTOR = 0.63;
const MERGE_STACKED_CORNERS = true;
const PRINT_GEOMETRY_HOLE_WARNINGS = false;

// new value, if hex corners have a smaller height diff than this value,
// merge their positions (to the lower one)
const MIN_HEIGHT_DIFF_STACKED_CORNERS = 1.5;

// --------------------------------------------------------------------------
const OBSTACLE_HEIGHT_CENTER = 1;
const OBSTACLE_CENTER_RAY_START_HEIGHT = 2;
const OBSTACLE_HEIGHT_NEIGHBOR = 1.1;
const OBSTACLE_NEIGHBOR_RAY_START_HEIGHT = 2;


// --------------------------------------------------------------------------

// rendering parameters
const DOUBLE_SIDED_CELL_MATERIALS = true;
const RENDER_ENV_AS_WIRE_FRAME = false;
const RENDER_CELLS_AS_WIRE_FRAME = false;
const CELL_RENDER_OPACITY = 1;
const DEBUG_NEIGHBOR_INTERSECTIONS = false;
const DEBUG_CENTER_INTERSECTIONS = false;
const DISPLAY_PATHFINDING = true;
const CELL_GAP_FACTOR = 0.98;

// --------------------------------------------------------------------------

const modes: ["translate", "scale"] = ['translate', 'scale', /*"rotate"*/]; // no rotation needed for now
const planeColor = ['#4654f8', 'hotpink'];
export const planeConfig = proxy({
  mode: (modes[0] as "translate" | "scale"),
  color: planeColor[0], visible: true
});

const calcWidthFromCols = (cols: number, cellRadius: number) => cellRadius * 1.5 * cols;
const calcHeightFromRows = (rows: number, cellRadius: number) => cellRadius * 1.5 * rows;
const calcColsFromWidth = (width: number, cellRadius: number) => Math.trunc(width / (cellRadius * 1.5));
const calcRowsFromHeight = (height: number, cellRadius: number) => Math.trunc(height / (cellRadius * 1.5));
const calcOffSetX = (width: number, x: number, cellRadius: number) => x - ((width / 2) + cellRadius * 1.5);
const calcOffSetZ = (height: number, z: number, cellRadius: number) => z - (height / 2) + cellRadius * 1.5;

const startWidth = calcWidthFromCols(GRID_COLS, CELL_RADIUS);
const startHeight = calcHeightFromRows(GRID_ROWS, CELL_RADIUS);
const startX = startWidth / 2 + OFFSET_X + CELL_RADIUS * 1.5;
const startZ = startHeight / 2 + OFFSET_Z - CELL_RADIUS * 1.5;


// create an object that can be used to update the height map data
// this object will be used when creating the height map
export const heightMapConfig = proxy({
  cellRadius: CELL_RADIUS,
  gridRows: GRID_ROWS,
  gridCols: GRID_COLS,
  offsetX: OFFSET_X,
  offsetZ: OFFSET_Z,
  width: calcWidthFromCols(GRID_ROWS, CELL_RADIUS),
  height: calcHeightFromRows(GRID_COLS, CELL_RADIUS),
  rayStartHeight: RAY_CAST_START_HEIGHT,
  rayCastYDirection: RAY_CAST_Y_DIRECTION,
  firstHitOnly: FIRST_HIT_ONLY,
  zFightOffset: Z_FIGHT_OFFSET,
  cellGapFactor: CELL_GAP_FACTOR,
  cellOrientation: CELL_ORIENTATION,
  maxHeightCenterToCorner: MAX_HEIGHT_CENTER_TO_CORNERS,
  maxHeightNeighborToCenter: MAX_HEIGHT_NEIGHBOR_TO_CENTER,
  minHeightDiffStackedCells: MIN_HEIGHT_DIFF_STACKED_CELLS,
  obstacleHeightCenter: OBSTACLE_HEIGHT_CENTER,
  obstacleCenterRayStartHeight: OBSTACLE_CENTER_RAY_START_HEIGHT,
  obstacleNeighborRayStartHeight: OBSTACLE_NEIGHBOR_RAY_START_HEIGHT,
  obstacleHeightNeighbor: OBSTACLE_HEIGHT_NEIGHBOR,
  innerCellRadiusFactor: INNER_CELL_RADIUS_FACTOR,
  printGeometryHoleWarnings: PRINT_GEOMETRY_HOLE_WARNINGS,
  centerAdaptionObstacleFactor: CENTER_ADAPTION_OBSTACLE_FACTOR,
  minHeightDiffStackedCorners: MIN_HEIGHT_DIFF_STACKED_CORNERS,
  mergeStackedCorners: MERGE_STACKED_CORNERS,
});

function updateRadiusDependentValues(position: Vector3) {
  heightMapConfig.gridCols = calcColsFromWidth(heightMapConfig.width, heightMapConfig.cellRadius);
  heightMapConfig.gridRows = calcRowsFromHeight(heightMapConfig.height, heightMapConfig.cellRadius);
  heightMapConfig.offsetX = calcOffSetX(heightMapConfig.width, position.x, heightMapConfig.cellRadius);
  heightMapConfig.offsetZ = calcOffSetZ(heightMapConfig.height, position.z, heightMapConfig.cellRadius);
}

function updateHeightMapDataFromControls(scale: Vector3, position: Vector3) {
  heightMapConfig.width = startWidth * scale.x;
  heightMapConfig.height = startHeight * scale.z;
  updateRadiusDependentValues(position);
  heightMapConfig.rayStartHeight = position.y + RAY_CAST_Y_DIRECTION * 2; // TODO: instead exclude the creator plane from raycasting
}

// @ts-ignore
window.heightMapConfig = heightMapConfig;


export const renderOptions = proxy({
  doubleSidedCellMaterials: DOUBLE_SIDED_CELL_MATERIALS,
  renderEnvAsWireFrame: RENDER_ENV_AS_WIRE_FRAME,
  renderCellsAsWireFrame: RENDER_CELLS_AS_WIRE_FRAME,
  cellRenderOpacity: CELL_RENDER_OPACITY,
  cellColor: CELL_COLOR,
  cellColorHighlighted: CELL_COLOR_HIGHLIGHTED,
  debugNeighbourIntersections: DEBUG_NEIGHBOR_INTERSECTIONS,
  debugCenterIntersections: DEBUG_CENTER_INTERSECTIONS,
  displayPathFinding: DISPLAY_PATHFINDING,
});

function updateGridStyle() {
  sharedCellDefaultMaterial.side = renderOptions.doubleSidedCellMaterials ? DoubleSide : FrontSide;
  //sharedCellDefaultMaterial.wireframe = renderOptions.renderCellsAsWireFrame;
  //sharedCellDefaultMaterial.opacity = renderOptions.cellRenderOpacity;
  //sharedCellDefaultMaterial.color.set(renderOptions.cellColor);
  //sharedCellDefaultMaterial.needsUpdate = true;

  sharedCellPathMaterial.side = renderOptions.doubleSidedCellMaterials ? DoubleSide : FrontSide;
  //sharedCellPathMaterial.opacity = renderOptions.cellRenderOpacity;
  //sharedCellPathMaterial.color.set(renderOptions.cellColorHighlighted);
  //sharedCellPathMaterial.needsUpdate = true;
}


export function CreatorPlane() {
  const planeSnap = useSnapshot(planeConfig);
  const controlsRef = useRef<any>(null!);

  const renderConfig: typeof renderOptions = useControls("Rendering", {
    doubleSidedCellMaterials: {
      label: "Double Sided", value: DOUBLE_SIDED_CELL_MATERIALS,
      hint: "Sets the material.side property of the cell material to THREE.DoubleSide."
    },
    renderEnvAsWireFrame: {
      label: "Env. Wireframe", value: RENDER_ENV_AS_WIRE_FRAME,
      hint: "Set the material.wireframe property of the environment materials to true."
    },
    renderCellsAsWireFrame: {label: "Grid Wireframe", value: RENDER_CELLS_AS_WIRE_FRAME},
    cellRenderOpacity: {label: "Cell Opacity", value: CELL_RENDER_OPACITY},
    cellColor: {label: "Cell Color", value: CELL_COLOR},
    cellColorHighlighted: {label: "Cell Color Highlighted", value: CELL_COLOR_HIGHLIGHTED},
    debugNeighbourIntersections: {label: "Debug Neighbour Intersections", value: DEBUG_NEIGHBOR_INTERSECTIONS},
    debugCenterIntersections: {label: "Debug Center Intersections", value: DEBUG_CENTER_INTERSECTIONS},
    displayPathFinding: {label: "Display Path Finding", value: DISPLAY_PATHFINDING},
  }, {collapsed: true});


  useEffect(() => {
    Object.assign(renderOptions, renderConfig);
    updateGridStyle();
  }, [renderConfig]);


  const ctrls: Partial<typeof heightMapConfig> = useControls("Grid Creation", {
    firstHitOnly: {label: "1st Ray Hit Only", value: FIRST_HIT_ONLY, hint: "Set Raycaster.onlyFirstHit"},
    zFightOffset: {
      label: "Z-Fight Offset", value: Z_FIGHT_OFFSET,
      hint: "Offset between cells and environment. Cells are offset along their normal by this value."
    },
    cellGapFactor: {
      label: "Cell Gap Factor",
      hint: "The factor by which the cell radius is multiplied to calculate the gap between cells. 1 means no Gap",
      value: CELL_GAP_FACTOR, max: 1, min: 0.1
    },
    cellRadius: {label: "Cell Radius", value: CELL_RADIUS},
    cellOrientation: {
      label: "Hex Orientation", options: {flat: Orientation.FLAT, pointy: Orientation.POINTY},
      hint: "The Hex Cell Orientation. Rotates the hex cells by 90°."
    },
    maxHeightCenterToCorner: {
      label: "Cell Height Variance",
      value: MAX_HEIGHT_CENTER_TO_CORNERS,
      hint: "The maximum allowed height difference between a cell's center and any of its corners. " +
        "If the height difference is greater than this value, the algorithm won't create a cell."
    },
    // TODO. this should ONLY influence path finding - not the creation of the cells
    maxHeightNeighborToCenter: {
      label: "Neighb Height Variance",
      value: MAX_HEIGHT_NEIGHBOR_TO_CENTER,
      hint: "The maximum allowed height difference between two neighboring cells. " +
        "Cells won't be neighbors if the height difference between their centers is greater than this value. " +
        "This influences the graph structure that gets created for pathfinding."
    },
    minHeightDiffStackedCells: {
      label: "Min. Height Diff. for Stacked Cells",
      value: MIN_HEIGHT_DIFF_STACKED_CELLS,
      hint: "The minimum height difference between two stacked cells (cells are stacked if they have the same (x,z) " +
        "position, but differ on the y-axis. Cells won't be stacked if the height difference between them is less " +
        "than this value. If two cells are possible at the same (x, z) location, the one with the higher y-value " +
        "will be created."
    },
    mergeStackedCorners: {
      label: "Merge Stacked Corners",
      value: MERGE_STACKED_CORNERS,
      hint: "If true, corners that are stacked (see Min. Height Diff. for Stacked Corners) will be merged into one corner."
    },
    minHeightDiffStackedCorners: {
      label: "Min. Height Diff. for Stacked Corners",
      value: MIN_HEIGHT_DIFF_STACKED_CORNERS,
      hint: "The minimum height difference between two stacked corners (corners are stacked if they have the same " +
        "(x,z) position, but differ on the y-axis. If Corners are closer than this value, their Vertices will be merged.",
    },
    obstacleHeightCenter: {
      label: "Center Obstacle Height",
      value: OBSTACLE_HEIGHT_CENTER,
      hint: "When checking for obstacles inside the inner center radius, any intersection with larger height difference " +
        "than this value will be considered an obstacle."
    },
    obstacleCenterRayStartHeight: {
      label: "Ray Center Height ",
      value: OBSTACLE_CENTER_RAY_START_HEIGHT,
      hint: "The height at which the ray for checking for obstacles in the center area is cast."
    },
    obstacleNeighborRayStartHeight: {
      label: "Ray Neighb Height",
      value: OBSTACLE_NEIGHBOR_RAY_START_HEIGHT,
      hint: "The height at which the ray for checking for obstacles in the area connecting two cells is cast."
    },
    obstacleHeightNeighbor: {
      label: "Neighb Obstacle Height",
      value: OBSTACLE_HEIGHT_NEIGHBOR,
      hint: "When checking for obstacles inside the area connecting two cells, any intersection with larger height difference " +
        "than this value will be considered an obstacle."
    },
    innerCellRadiusFactor: {
      max: 1,
      min: 0.1,
      label: "Inner Cell Radius",
      value: INNER_CELL_RADIUS_FACTOR,
      hint: "The radius of the inner circle (the area that needs to be free of obstacles for a cell to be available) " +
        "is calculated by multiplying the cell radius with this value."
    },
    centerAdaptionObstacleFactor: {
      max: 1,
      min: 0.1,
      value: CENTER_ADAPTION_OBSTACLE_FACTOR,
      label: "Center Adaption Obstacle Factor",
      hint: "This value multiplied by inner radius, determines how much distance an adapted center position " +
        "needs from all obstacle intersection to be considered non-blocked. Make this value smaller to be more " +
        "lenient towards obstacles. 1 means any obstacle intersection inside the cell will mark it as blocked."
    },
    printGeometryHoleWarnings: {
      label: "Print Geometry Hole Warnings",
      value: PRINT_GEOMETRY_HOLE_WARNINGS,
      hint: "If true, warnings will be logged to the console if the geometry contains holes."
    },
  }, {collapsed: true});

  useEffect(() => {
    Object.assign(heightMapConfig, ctrls);
  }, [ctrls])


  /*
  const heightMapSnap = useSnapshot(heightMapConfig);
  useEffect(() => {
    // these are the values updated by the TransformControls
    // let's see if we can write into leva as well
    console.log(`width: ${heightMapSnap.width}, height: ${heightMapSnap.height}, offsetX: ${heightMapSnap.offsetX}, offsetZ: ${heightMapSnap.offsetZ}`);
  }, [heightMapSnap.width, heightMapSnap.height, heightMapSnap.offsetX, heightMapSnap.offsetZ]);
  */

  useEffect(() => {
    if (!controlsRef.current?.object) return;
    updateRadiusDependentValues(controlsRef.current.object.position);
  }, [ctrls.cellRadius]);


  return (
    // @ts-ignore
    <TransformControls
      visible={planeSnap.visible}
      size={planeSnap.visible ? 1 : 0.5}
      ref={controlsRef}
      onChange={() => {
        if (!controlsRef.current?.object) return;
        updateHeightMapDataFromControls(controlsRef.current.object.scale, controlsRef.current.object.position);
      }}
      mode={planeSnap.mode}
      position={[startX, RAY_CAST_START_HEIGHT + 5, startZ]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onDoubleClick={() => {
          console.log("xxx");
          planeConfig.mode = modes[(modes.indexOf(planeConfig.mode) + 1) % modes.length];
          console.log(planeConfig.mode);
          planeConfig.color = planeColor[(planeColor.indexOf(planeConfig.color) + 1) % planeColor.length];
        }}>
        <planeGeometry args={[startWidth, startHeight]}/>
        <meshBasicMaterial side={DoubleSide} color={planeSnap.color} opacity={0.5} transparent={true}/>

        <Html className={"relative"}>
          <div className={"interaction-button text-outline bg-transparent " +
            "text-white font-bold hover:cursor-pointer hover:text-orange-400 " +
            "absolute left-11 bottom-11"}
               style={{textTransform: "capitalize"}}
               onClick={() => planeConfig.visible = !planeConfig.visible}
          >
            {planeSnap.visible ? "Hide" : "Show"}({planeSnap.mode})
          </div>
        </Html>
      </mesh>
    </TransformControls>
  )
}


// ===============================================================================================

// different ways of rendering grid - keep as reference for now

/*


export function createDemoHex(): Point[] {
  const points = [];
  for (let i = 0; i < (Math.PI * 2 - 0.001); i += Math.PI / 3) {
    const x = Math.cos(i);
    const y = Math.sin(i);
    const point = {x, y};
    points.push(point);
    console.log(`current angle in degree: ${i * 180 / Math.PI}, in radian: ${Math.PI * 2 - i}`);
  }
  return points;
}

export function HexGridFromPoints({points}: { points: Vector3[] }) {
  return (
    <Instances limit={points.length} rotation={[-Math.PI / 2, 0, 0]}>
      <boxGeometry/>
      <meshBasicMaterial/>
      {points.map((point, i) =>
        <Instance
          key={i}
          color="black"
          scale={.1}
          position={[point.x, point.y, 0]}
        />
      )}
    </Instances>
  )
}

export function HexGrid() {
  return (
    <Instances rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[CELL_RADIUS, 6, THETA_START]}/>
      <meshBasicMaterial/>
      {grid.toArray().map((hex, i) =>
        <Instance
          key={i}
          color="blue"
          scale={.95}
          position={[hex.x, hex.y, 0]}
        />
      )}
    </Instances>
  )
}

*/
// =================================================================================================