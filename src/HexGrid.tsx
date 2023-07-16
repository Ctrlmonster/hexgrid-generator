import {Grid, Hex, Orientation} from 'honeycomb-grid'
import {Html, Instance, Instances, TransformControls} from "@react-three/drei";
import {proxy, useSnapshot} from 'valtio';
import {DoubleSide, FrontSide, InstancedMesh, Mesh, Vector3} from "three";
import {MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef} from "react";
import {folder, useControls} from "leva";
import {
  CELL_COLOR, cellColorValues,
  defaultCellMaterial,
  derivedCellMaterial,
  instancedMeshGridRef,
  mergedGridMesh, pathInstances,
  sceneRef
} from "./grid/globals";
import {createGrid2d} from "./grid/buildGridDataStructure";
import {useFrame} from "@react-three/fiber";


/*

TODO: Ordered list of things to do
  Must have:
  * Figure out how you're going to draw the grid in game! (idea: take the
  merged grid mesh and give it a transparent material that has only the grid
  lines on it, then play with the depth buffer settings to make occlusion work well.
  Then we can draw cell instances with alpha and color depending on the game state)
  * Add button to export structure which can be used to setup path finding
  * Add polygon offset values to leva controls
  * Prepare bezier curves for path between cells
  * Fix holes in generated Grid (solved?)
  * Smooth cell normals (idea for how to do this: Track all normals of a vertex
  for each triangle in participates in. At the end we can interpolate all of them.)
  * Tweak obstacle bombing parameters (when a cell counts as blocked)
  * Optimize neighbor obstacle checking (i.e. don' check a pair twice)
  * Create vertex shader dependent on hex origin (pointy vs flat)
  -------------------------------------------
  Nice to have:
  * add functionality to delete cells from grid
  * add option to draw cells on environment (prob needs complete rewrite)
  * Increase leva ui width and rename parameters
  * display size of grid in stats
  * fix 2d grid version to the creator plane
  * add info about number of geometries in stats
 */


// grid creation parameters
const RAY_CAST_START_HEIGHT = 30;
const GRID_COLS = 30;
const GRID_ROWS = 30;
const OFFSET_X = -30;
const OFFSET_Z = -30;
const FIRST_HIT_ONLY = false;
const Z_FIGHT_OFFSET = .5;
const CELL_RADIUS = 1.5;
const CELL_ORIENTATION = Orientation.POINTY as Orientation;
const MAX_HEIGHT_CENTER_TO_CORNERS = 1.0;
const MAX_HEIGHT_NEIGHBOR_TO_CENTER = 1.3;
const MIN_HEIGHT_DIFF_STACKED_CELLS = 5.0;
const RAY_CAST_Y_DIRECTION = -1;

const INNER_CELL_RADIUS_FACTOR = 0.79;
const CENTER_ADAPTION_OBSTACLE_FACTOR = 0.54;
const NEIGHBOR_STRIP_WIDTH_FACTOR = 0.5;
const NEIGHBOR_STRIP_LEN_FACTOR = 0.5;
const NEIGHBOR_STRIP_INTERSECTION_TOLERANCE = 0.05;
const MERGE_STACKED_CORNERS = true;
const PRINT_GEOMETRY_HOLE_WARNINGS = false;
const CHECK_FOR_OBSTACLES = true;
const CHECK_FOR_OBSTACLES_BETWEEN_CELLS = true;
const NO_CELL_ISLANDS = true;
// new value, if hex corners have a smaller height diff than this value,
// merge their positions (to the lower one)
const MIN_HEIGHT_DIFF_STACKED_CORNERS = 1.5;

// --------------------------------------------------------------------------
const OBSTACLE_HEIGHT_CENTER = 1;
const OBSTACLE_CENTER_RAY_START_HEIGHT = 2;
const OBSTACLE_HEIGHT_NEIGHBOR = 1;
const OBSTACLE_NEIGHBOR_RAY_START_HEIGHT = 1.5;
// --------------------------------------------------------------------------

// rendering parameters
const DISPLAY_MERGED_GRID = false;
const DISPLAY_CELL_INSTANCES = true;
const DOUBLE_SIDED_CELL_MATERIALS = true;
const RENDER_ENV_AS_WIRE_FRAME = false;
const RENDER_CELLS_AS_WIRE_FRAME = false;
const CELL_RENDER_OPACITY = 0.5;
const PATH_RENDER_OPACITY = CELL_RENDER_OPACITY;
const DEBUG_NEIGHBOR_INTERSECTIONS = false;
const DEBUG_CENTER_INTERSECTIONS = false;
const DISPLAY_PATHFINDING = true;
const CELL_GAP_FACTOR = 0.97;

const ENABLE_POLYGON_OFFSET = true;
const POLYGON_OFFSET_FACTOR = -5;
const POLYGON_OFFSET_UNITS = -200;

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
export const gridConfig = proxy({
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
  noCellIslands: NO_CELL_ISLANDS,
  maxHeightCenterToCorner: MAX_HEIGHT_CENTER_TO_CORNERS,
  maxHeightNeighborToCenter: MAX_HEIGHT_NEIGHBOR_TO_CENTER,
  minHeightDiffStackedCells: MIN_HEIGHT_DIFF_STACKED_CELLS,
  checkForObstacles: CHECK_FOR_OBSTACLES,
  checkForObstaclesBetweenCells: CHECK_FOR_OBSTACLES_BETWEEN_CELLS,
  obstacleHeightCenter: OBSTACLE_HEIGHT_CENTER,
  obstacleCenterRayStartHeight: OBSTACLE_CENTER_RAY_START_HEIGHT,
  obstacleNeighborRayStartHeight: OBSTACLE_NEIGHBOR_RAY_START_HEIGHT,
  obstacleHeightNeighbor: OBSTACLE_HEIGHT_NEIGHBOR,
  innerCellRadiusFactor: INNER_CELL_RADIUS_FACTOR,
  printGeometryHoleWarnings: PRINT_GEOMETRY_HOLE_WARNINGS,
  centerAdaptionObstacleFactor: CENTER_ADAPTION_OBSTACLE_FACTOR,
  neighborStripWidthFactor: NEIGHBOR_STRIP_WIDTH_FACTOR,
  neighborStripLenFactor: NEIGHBOR_STRIP_LEN_FACTOR,
  neighborStripIntersectionTolerance: NEIGHBOR_STRIP_INTERSECTION_TOLERANCE,
  minHeightDiffStackedCorners: MIN_HEIGHT_DIFF_STACKED_CORNERS,
  mergeStackedCorners: MERGE_STACKED_CORNERS,
  debugNeighborIntersections: DEBUG_NEIGHBOR_INTERSECTIONS,
  debugCenterIntersections: DEBUG_CENTER_INTERSECTIONS,
});


function updateRadiusDependentValues(position: Vector3) {
  gridConfig.gridCols = calcColsFromWidth(gridConfig.width, gridConfig.cellRadius);
  gridConfig.gridRows = calcRowsFromHeight(gridConfig.height, gridConfig.cellRadius);
  gridConfig.offsetX = calcOffSetX(gridConfig.width, position.x, gridConfig.cellRadius);
  gridConfig.offsetZ = calcOffSetZ(gridConfig.height, position.z, gridConfig.cellRadius);
}

function updateHeightMapDataFromControls(scale: Vector3, position: Vector3) {
  gridConfig.width = startWidth * scale.x;
  gridConfig.height = startHeight * scale.z;
  updateRadiusDependentValues(position);
  gridConfig.rayStartHeight = position.y + RAY_CAST_Y_DIRECTION * 2; // TODO: instead exclude the creator plane from raycasting
}

// @ts-ignore
window.heightMapConfig = gridConfig;


export const renderOptions = proxy({
  displayMergedGrid: DISPLAY_MERGED_GRID,
  displayCellInstances: DISPLAY_CELL_INSTANCES,
  doubleSidedCellMaterials: DOUBLE_SIDED_CELL_MATERIALS,
  renderEnvAsWireFrame: RENDER_ENV_AS_WIRE_FRAME,
  renderCellsAsWireFrame: RENDER_CELLS_AS_WIRE_FRAME,
  cellRenderOpacity: CELL_RENDER_OPACITY,
  pathRenderOpacity: PATH_RENDER_OPACITY,
  cellColor: CELL_COLOR,
  displayPathFinding: DISPLAY_PATHFINDING,
  polygonOffset: ENABLE_POLYGON_OFFSET,
  polygonOffsetFactor: POLYGON_OFFSET_FACTOR,
  polygonOffsetUnits: POLYGON_OFFSET_UNITS,
});

function updateGridStyle() {
  if (sceneRef.current && instancedMeshGridRef.current) {
    if (renderOptions.displayCellInstances) {
      const res = sceneRef.current.getObjectById(instancedMeshGridRef.current.id)
      if (res == undefined) sceneRef.current.add(instancedMeshGridRef.current!)
    } else {
      sceneRef.current.remove(instancedMeshGridRef.current!)
    }
  }
  if (sceneRef.current && mergedGridMesh.current) {
    if (renderOptions.displayMergedGrid) {
      const res = sceneRef.current.getObjectById(mergedGridMesh.current.id)
      if (res == undefined) sceneRef.current.add(mergedGridMesh.current)
    } else {
      sceneRef.current.remove(mergedGridMesh.current);
    }
  }

  defaultCellMaterial.side = renderOptions.doubleSidedCellMaterials ? DoubleSide : FrontSide;
  defaultCellMaterial.wireframe = renderOptions.renderCellsAsWireFrame;
  defaultCellMaterial.opacity = renderOptions.cellRenderOpacity;
  defaultCellMaterial.color.set(renderOptions.cellColor);
  defaultCellMaterial.polygonOffset = renderOptions.polygonOffset;
  defaultCellMaterial.polygonOffsetFactor = renderOptions.polygonOffsetFactor;
  defaultCellMaterial.polygonOffsetUnits = renderOptions.polygonOffsetUnits;
  defaultCellMaterial.needsUpdate = true;

  if (derivedCellMaterial.current) {
    derivedCellMaterial.current.side = defaultCellMaterial.side;
    derivedCellMaterial.current.wireframe = defaultCellMaterial.wireframe;
    derivedCellMaterial.current.opacity = defaultCellMaterial.opacity;
    derivedCellMaterial.current.color.set(defaultCellMaterial.color);
    derivedCellMaterial.current.polygonOffset = defaultCellMaterial.polygonOffset;
    derivedCellMaterial.current.polygonOffsetFactor = defaultCellMaterial.polygonOffsetFactor;
    derivedCellMaterial.current.polygonOffsetUnits = defaultCellMaterial.polygonOffsetUnits;
    derivedCellMaterial.current.needsUpdate = true;
  }

  for (let i = 0; i < cellColorValues.length; i++) {
    cellColorValues[i] = defaultCellMaterial.color.getHex();
    //instancedMeshGridRef.current?.setUniformAt("opacity", i, defaultCellMaterial.opacity);

    if (pathInstances.has(i)) {
      instancedMeshGridRef.current!.setUniformAt("opacity", i, renderOptions.pathRenderOpacity);
    } else {
      instancedMeshGridRef.current!.setUniformAt("opacity", i, renderOptions.cellRenderOpacity);
    }
  }
}


export function CreatorPlane() {
  const planeSnap = useSnapshot(planeConfig);
  const controlsRef = useRef<any>(null!);

  const renderConfig: typeof renderOptions = useControls("Rendering", {
    displayMergedGrid: {label: "Merged Grid", value: DISPLAY_MERGED_GRID},
    displayCellInstances: {label: "Cell Instances", value: DISPLAY_CELL_INSTANCES},

    polygonOffset: {label: "Polygon Offset", value: ENABLE_POLYGON_OFFSET},
    polygonOffsetFactor: {label: "Offset Factor", value: POLYGON_OFFSET_FACTOR, min: -1000, max: 1000},
    polygonOffsetUnits: {label: "Offset Units", value: POLYGON_OFFSET_UNITS, min: -50000, max: 50000},

    doubleSidedCellMaterials: {
      label: "Double Sided", value: DOUBLE_SIDED_CELL_MATERIALS,
      hint: "Sets the material.side property of the cell material to THREE.DoubleSide."
    },
    renderEnvAsWireFrame: {
      label: "Env. Wireframe", value: RENDER_ENV_AS_WIRE_FRAME,
      hint: "Set the material.wireframe property of the environment materials to true."
    },
    renderCellsAsWireFrame: {label: "Grid Wireframe", value: RENDER_CELLS_AS_WIRE_FRAME},
    cellRenderOpacity: {label: "Cell Opacity", value: CELL_RENDER_OPACITY, min: 0, max: 1},
    pathRenderOpacity: {label: "Path Opacity", value: PATH_RENDER_OPACITY, min: 0, max: 1},
    cellColor: {label: "Cell Color", value: CELL_COLOR},
    displayPathFinding: {label: "Display Path Finding", value: DISPLAY_PATHFINDING},
  }, {collapsed: true});

  useEffect(() => {
    Object.assign(renderOptions, renderConfig);
    updateGridStyle();
  }, [renderConfig]);


  const ctrls: Partial<typeof gridConfig> = useControls("Grid Creation", {
    misc: folder({
      noCellIslands: {
        label: "No Islands",
        value: NO_CELL_ISLANDS,
        hint: "If true, cells will be removed if they are not connected to the rest grid."
      },
      firstHitOnly: {label: "1st Ray Hit Only", value: FIRST_HIT_ONLY, hint: "Set Raycaster.onlyFirstHit"},
      zFightOffset: {
        label: "Z-Fight Offset", value: Z_FIGHT_OFFSET,
        hint: "Offset between cells and environment. Cells are offset along their normal by this value."
      },
      printGeometryHoleWarnings: {
        label: "Print Geometry Hole Warnings",
        value: PRINT_GEOMETRY_HOLE_WARNINGS,
        hint: "If true, warnings will be logged to the console if the geometry contains holes."
      },
    }, {collapsed: true}),


    cells: folder({
      cellProperties: folder({
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
      }, {collapsed: true}),

      mergeCorners: folder({
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

      }, {collapsed: true}),
      cutoffValues: folder({
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
      }, {collapsed: true}),

    }, {collapsed: true}),


    obstacleChecking: folder({
      checkForObstacles: {
        label: "Center Obstacles",
        value: CHECK_FOR_OBSTACLES,
        hint: "If true, the algorithm will check for obstacles in the environment and won't create cells that intersect " +
          "with obstacles."
      },
      checkForObstaclesBetweenCells: {
        label: "Neighb Obstacles",
        value: CHECK_FOR_OBSTACLES_BETWEEN_CELLS,
        hint: "If true, the algorithm will check for obstacles in the environment between two cells and won't create " +
          "a connection between the two, that can be used for path finding."
      },
      obstacleHeightCenter: {
        label: "C.Height",
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
        label: "N.Height",
        value: OBSTACLE_HEIGHT_NEIGHBOR,
        hint: "When checking for obstacles inside the area connecting two cells, any intersection with larger height difference " +
          "than this value will be considered an obstacle."
      },
      innerCellRadiusFactor: {
        max: 1,
        min: 0.1,
        label: "Inner Radius",
        value: INNER_CELL_RADIUS_FACTOR,
        hint: "The radius of the inner circle (the area that's supposed to be free) " +
          "is calculated by multiplying the cell radius with this value. Decrease this value to make cells more lenient" +
          "towards obstacles."
      },
      centerAdaptionObstacleFactor: {
        max: 1,
        min: 0.1,
        value: CENTER_ADAPTION_OBSTACLE_FACTOR,
        label: "C.Adaption Factor",
        hint: "This value multiplied by inner radius, determines how much distance an adapted center position " +
          "needs from all obstacle intersection to be considered non-blocked. Make this value smaller to be more " +
          "lenient towards obstacles. 1 means any obstacle intersection inside the cell will mark it as blocked."
      },
      neighborStripWidthFactor: {
        max: 1,
        min: 0.1,
        value: NEIGHBOR_STRIP_WIDTH_FACTOR,
        label: "N.Width Factor",
        hint: "This value determines how big the strip connecting two cells is. This strip must be free of obstacles" +
          "to make two cells neighbors. Decrease this value to make it easier for two cells to be neighbors."
      },
      neighborStripLenFactor: {
        max: 1,
        min: 0,
        value: NEIGHBOR_STRIP_LEN_FACTOR,
        label: "N.Length Factor",
        hint: "This value determines how long the strip connecting two cells is. This strip must be free of obstacles" +
          "to make two cells neighbors. Decrease this value to make it easier for two cells to be neighbors."
      },
      neighborStripIntersectionTolerance: {
        max: 1,
        min: 0,
        step: 0.01,
        value: NEIGHBOR_STRIP_INTERSECTION_TOLERANCE,
        label: "N.Tolerance",
        hint: "The percentage of intersections that must be blocked to consider a neighbor strip blocked. The minimum" +
          "will be 1 intersection. The maximum will be all intersections. " +
          "Decrease this value to make it easier for two cells to be neighbors."
      },
      debugNeighborIntersections: {label: "Debug Neighbour Intersections", value: DEBUG_NEIGHBOR_INTERSECTIONS},
      debugCenterIntersections: {label: "Debug Center Intersections", value: DEBUG_CENTER_INTERSECTIONS},
    }, {collapsed: false}),

  }, {collapsed: false});

  useEffect(() => {
    Object.assign(gridConfig, ctrls);
  }, [ctrls])


  useEffect(() => {
    if (!controlsRef.current?.object) return;
    updateRadiusDependentValues(controlsRef.current.object.position);
  }, [ctrls.cellRadius]);


  const planeRef = useRef<Mesh>(null!);

  return (
    <>
      {/* @ts-ignore */}
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
          ref={planeRef}
          rotation={[-Math.PI / 2, 0, 0]}
          onDoubleClick={() => {
            planeConfig.mode = modes[(modes.indexOf(planeConfig.mode) + 1) % modes.length];
            planeConfig.color = planeColor[(planeColor.indexOf(planeConfig.color) + 1) % planeColor.length];
          }}>
          <planeGeometry args={[startWidth, startHeight]}/>
          <meshBasicMaterial side={DoubleSide} color={planeSnap.color} opacity={0} transparent={true}/>

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


      <GridPreview controlsRef={controlsRef}/>

    </>
  )
}


// ===============================================================================================


const THETA_START = Math.PI / 2;

function GridPreview({controlsRef}: { controlsRef: MutableRefObject<any> }) {

  const gridSnap = useSnapshot(gridConfig);
  const planeSnap = useSnapshot(planeConfig);

  useLayoutEffect(() => {
    console.log("Plane updated");
  }, [planeSnap]);

  useEffect(() => {
    // check if it's in scale mode
    if (controlsRef.current.mode === "scale") {
      console.log("updating grid");
      grid.current = createGrid2d(gridSnap);
    }
    if (orientation.current !== gridSnap.cellOrientation) {
      console.log("updating grid orientation");
      grid.current = createGrid2d(gridSnap);
      orientation.current = gridSnap.cellOrientation;
      thetaStart.current = orientation.current === Orientation.POINTY ? THETA_START : Math.PI / 3;
    }
  }, [gridSnap]);

  useFrame(() => {
    // we're copying the position manually, because we don't want to inherit the scale
    const position = controlsRef.current?.object.position;
    instancesRef.current?.position.set(position!.x, position!.y + 0.01, position!.z);
  });


  //const grid = useMemo(() => createGrid2d(gridSnap), [planeSnap]);
  const grid = useRef(createGrid2d(gridSnap));
  const orientation = useRef(gridSnap.cellOrientation);
  const instancesRef = useRef<InstancedMesh>(null!);
  const thetaStart = useRef(orientation.current === Orientation.POINTY ? THETA_START : Math.PI / 3);

  return (
    // @ts-ignore
    <Instances ref={instancesRef} position={[0, 0.01, 0]} limit={5000}>
      <circleGeometry args={[CELL_RADIUS, 6, thetaStart.current]}/>
      <meshBasicMaterial side={DoubleSide} transparent={true} opacity={0.35}/>
      {grid.current.toArray().map((hex, i) =>
        // @ts-ignore
        <Instance
          key={i}
          scale={.95}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[hex.x, 0, hex.y]}/>
      )}
    </Instances>
  )
}


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

export function HexGridFromPoints({points}: {points: Vector3[]}) {
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