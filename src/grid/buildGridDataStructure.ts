import {InstancedUniformsMesh} from 'three-instanced-uniforms-mesh';
import {defineHex, Grid, Hex, rectangle} from "honeycomb-grid";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group, InstancedMesh,
  Intersection, Matrix4,
  Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
  Object3D, Scene,
  SphereGeometry,
  Vector2,
  Vector3
} from "three";
import {castRay, HexGridIntersections} from "./createHeightField";
import {gridConfig, renderOptions} from "../HexGrid";
import TypedSet from "../helper/TypedSet";
import {
  adaptedCellCentersById,
  centerIntersectionsInstancedMeshesRef,
  ENVIRONMENT_REF, gridGraphRef,
  neighborIntersectionsMeshRefs, neighborStripMaterialBlocked, neighborStripMaterialFree, pathFinder, sceneRef
} from "./globals";
import TypedMap from "../helper/TypedMap";


export function createGrid2d({
                               cellRadius,
                               cellOrientation,
                               offsetX,
                               offsetZ,
                               gridCols,
                               gridRows
                             }: typeof gridConfig) {
  // ________________________________________________________________
  // 1. Create a hex class:
  const Tile = defineHex({
    dimensions: cellRadius,
    orientation: cellOrientation,
    // origin is the top left corner of the rect grid (the offsets are actually in
    // reverse world space dir, that's why we flip them)
    origin: {x: -offsetX, y: -offsetZ}
  });
// 2. Create a grid by passing the class and a "traverser" for a rectangular-shaped grid:
  return new Grid(Tile, rectangle({width: gridCols, height: gridRows}));
  // ________________________________________________________________
}


function getNeighborsIn2dGrid(hex: Hex, grid2d: Grid<Hex>) {
  const neighbors = [];
  for (let i = 0; i < 6; i++) {
    const n = grid2d.neighborOf(hex, i, {allowOutside: false});
    if (n) neighbors.push(n);
  }
  return neighbors;
}


export function centerIntersectionBombing(centerPos: Vector3,
                                          cellRadius: number,
                                          radiusFactor: number,
                                          obstacleHeight: number, // small but larger than max dist to corner
                                          startHeight: number, // needs to be smaller than min dist between stacked cells
                                          dir: Vector3,
                                          environmentRef: Object3D,
                                          scene: Scene,
                                          debugIntersections: boolean) {


  const FIRST_HIT_ONLY = true;
  const innerRadius = cellRadius * radiusFactor;
  let numObstacles = 0;
  const obstacleIntersections = [];

  const finalStep = new Vector3(); // centerPos + finalStep = new center position (adapted center)

  const color = new Color();
  const sphereGeometry = new SphereGeometry(cellRadius / 50, 8, 8);
  const sphereMaterial = new MeshBasicMaterial({
    depthTest: false,
    side: DoubleSide,
    transparent: true,
    opacity: 0.5
  });
  const instanceMatrices: Matrix4[] = [];
  const instanceColors = [];

  const numSectors = 18;
  const numRings = 8;
  const dAlpha = 2 * Math.PI / numSectors;
  const dR = innerRadius / numRings;

  let alpha = 0;

  for (let i = 0; i < numSectors; i++) {
    let foundObstacleInSector = false;

    for (let r = 0; r <= numRings; r++) {
      const x = r * dR * Math.cos(alpha);
      const y = r * dR * Math.sin(alpha);

      const startPos = new Vector3(
        centerPos.x + x,
        centerPos.y + startHeight,
        centerPos.z + y
      );
      const intersections = castRay(environmentRef, startPos, dir, FIRST_HIT_ONLY)
        .filter(intersection => intersection.object instanceof Mesh);
      // for each point we take the top intersection (all others are irrelevant)
      const intersection = intersections[0];

      if (!intersection) { // we just throw a warning and continue
        if (gridConfig.printGeometryHoleWarnings) {
          console.warn(`No intersection found at x: ${startPos.x} y: ${startPos.y} z: ${startPos.z}. There is likely a hole in your environment geometry.`);
        }
        continue;
      }
      // check every mesh intersection if it's higher than the obstacle height
      // importantly we don't check the absolute height, because we're interested in obstacles higher (not lower)
      // than the center position
      const isObstacle = (intersection.point.y - centerPos.y) >= obstacleHeight;

      if (debugIntersections) {
        const instanceMatrix = new Matrix4();
        instanceMatrix.setPosition(intersection.point);
        instanceMatrices.push(instanceMatrix);
        instanceColors.push(isObstacle ? 0xff0000 : 0x00ff00);
      }

      if (isObstacle) {
        // We want to continue to the next circle segment here to now skew the weighting!
        // add the intersection points above obstacle dist to the center
        // we weight the distance inversely, the closer the point to the center, the larger the weight

        if (!foundObstacleInSector) { // we do this bc. normally we would have broken the loop here
          const point = intersection.point.clone().setY(centerPos.y); // we don't care about the height diff
          const step = centerPos.clone().sub(point);

          obstacleIntersections.push(point);
          const dist = step.length();

          // if dist < innerRadius then the obstacle is too close. We will want to go the
          // difference between dist and radius, so that we're exactly in range requirement
          const stepLen = (dist < innerRadius) ? innerRadius - dist : 0;
          step.setLength(stepLen);
          finalStep.add(step);
          numObstacles++;
        }

        // This break is important because it determines the weighting of the center of mass.
        // We might want to just continue the loop for the visuals, but not add them to the weighting
        foundObstacleInSector = true;
        if (!debugIntersections) {
          break;
        }
      }
    }
    alpha += dAlpha;
  }
  // --------------------------------------------------------------------------------

  const finalCenter = (numObstacles > 0)
    ? centerPos.clone().add(finalStep.multiplyScalar(1 / (numObstacles)))
    : centerPos.clone();

  // TODO: instead we should check whether the distance to all intersections is larger than the inner radius
  // we check if any obstacles are still too close to the center, after adapting its position
  const cellIsBlocked = obstacleIntersections.some(
    (point) => point.distanceTo(finalCenter) < (innerRadius * gridConfig.centerAdaptionObstacleFactor)
  );

  if (debugIntersections) {
    // one extra instance for the center
    const instanceMatrix = new Matrix4();
    instanceMatrix.setPosition(finalCenter);
    instanceMatrix.scale(new Vector3(5, 5, 5));
    instanceMatrices.push(instanceMatrix);
    instanceColors.push(cellIsBlocked ? 0xff0000 : 0x0000ff);

    // create helper function for flattening the matrix into a buffer
    const matrixValues = new Float32Array(instanceMatrices.length * 16);
    // Loop through the instance matrices to extract the values
    for (let i = 0; i < instanceMatrices.length; i++) {
      const matrix = instanceMatrices[i];
      const values = matrix.elements;
      // Store the values in the matrixValues array
      for (let j = 0; j < values.length; j++) {
        matrixValues[i * 16 + j] = values[j];
      }
    }
    const sphereInstancedMesh = new InstancedUniformsMesh(sphereGeometry, sphereMaterial, instanceMatrices.length);
    sphereInstancedMesh.instanceMatrix.set(matrixValues);

    for (let i = 0; i < instanceColors.length; i++) {
      sphereInstancedMesh.setUniformAt('diffuse', i, color.set(instanceColors[i]));
    }
    scene.add(sphereInstancedMesh);
    centerIntersectionsInstancedMeshesRef.current.push(sphereInstancedMesh);
  }

  return {isBlocked: cellIsBlocked, center: finalCenter};
}


// TODO: we can store the result of this for each pair of neighbors
export function neighborIntersectionBombing(cellRadius: number,
                                            centerPositionA: Vector3,
                                            centerPositionB: Vector3,
                                            obstacleHeight: number,
                                            startHeight: number,
                                            neighborStripWidthFactor: number,
                                            neighborStripLenFactor: number,
                                            environmentRef: Object3D,
                                            scene: Scene,
                                            debugIntersections: boolean) {

  /*
  Idea: Similar to centerIntersectionBombing, we now bomb the area connecting to cells
  with intersections to check if it's blocked, thereby determining if two cells can be
  neighbors in the pathfinding graph. That connecting area is rectangular width the
  width of the inner circle radius and height bridging the gap between two potential
  neighbors inner circles. The height side is parallel to the vector between two cells
  center points. That connecting vector halves the width side of the rectangle.

  // innerRadius is supposed to be a param, but we could set it to be side_len / 2
  // which seems like a sensible value

  alpha = PI / 6
  WIDTH_PARAM <= 1
  side_len = 2 * sin(alpha) * cellRadius
  l1 = WIDTH_PARAM * side_len * 2
  l2 = 2 * (cos(alpha) * cellRadius - innerRadius)

  vecBetweenCells = vec.from(a).to(b)
  defining 4 points now:

  vecToStartOfStrip = vecBetweenCells.setLen(innerRadius);
  orthogonalVec = vecBetweenCells.orthogonal()
  a1 = vecToStartOfStrip + orthogonalVec.setLen(l1/2)
  a2 = vecToStartOfStrip - orthogonalVec.setLen(l1/2)
  a3 = a1 + vecBetweenCells.setLen(l2)
  a4 = a2 + vecBetweenCells.setLen(l2)
   */

  // we're adding a len parameter for the strips
  // 4 -> means full, 1 means 0
  // param needs to map 0 to 1 and 1 to 4
  // result = param * 4 + 1
  const convertParamToLen = (param: number) => param * 4 + 1;

  const alpha = Math.PI / 6;
  const sideLen = 2 * Math.sin(alpha) * cellRadius;
  const innerRadius = sideLen / convertParamToLen(neighborStripLenFactor);
  const l1 = neighborStripWidthFactor * sideLen;
  const l2 = 2 * (Math.cos(alpha) * cellRadius - innerRadius);

  const vecBetweenCells = new Vector2().subVectors(
    new Vector2(centerPositionA.x, centerPositionA.z),
    new Vector2(centerPositionB.x, centerPositionB.z)
  );

  const vecToStartOfStrip = vecBetweenCells.clone().setLength(innerRadius);
  const orthogonalVec = new Vector2(-vecBetweenCells.y, vecBetweenCells.x).multiplyScalar(-1);
  const a1 = vecToStartOfStrip.clone().add(orthogonalVec.clone().setLength(l1 / 2));
  const a2 = vecToStartOfStrip.clone().sub(orthogonalVec.clone().setLength(l1 / 2));
  const a3 = a1.clone().add(vecBetweenCells.clone().setLength(l2));
  const a4 = a2.clone().add(vecBetweenCells.clone().setLength(l2)); // only needed for visualization

  //================================================================================================
  // now we need to do intersection tests for the area between the four points
  const sphereGeometry = new SphereGeometry(cellRadius / 50, 8, 8);
  const sphereMaterial = new MeshBasicMaterial({color: 0xffffff});
  const instanceMatrices = [];
  const intersectedPointIndices = [];
  const instanceColors = [];

  const numStepsHorizontal = 6;
  const numStepsVertical = 6;
  const FIRST_HIT_ONLY = true;

  const baseHeight = (centerPositionA.y + centerPositionB.y) / 2;
  const startPos = new Vector3(a1.x, startHeight, a1.y);
  const castPos = new Vector3().copy(centerPositionB);
  castPos.setY(baseHeight);

  const dir = new Vector3(0, -1, 0);
  const dirA1_temp = new Vector2().subVectors(a2, a1);
  const dirA1 = new Vector3(dirA1_temp.x, 0, dirA1_temp.y);
  const dirA3_temp = new Vector2().subVectors(a3, a1);
  const dirA3 = new Vector3(dirA3_temp.x, 0, dirA3_temp.y);
  const distA1 = dirA1.length();
  const distA3 = dirA3.length();
  const stepSizeA1 = distA1 / numStepsHorizontal;
  const stepSizeA3 = distA3 / numStepsVertical;

  // Update: instead of just flagging the strip as blocked when we find
  // a single intersection, we add little wiggle room. Say when 5% of
  // all intersections tests fail, the path is blocked. This way we don't
  // immediately flag a path when a single check fails (i.e. because of geometry holes)
  let numberOfChecks = 0; // we count the num of checks
  let numberOfObstacles = 0;

  for (let i = 0; i <= numStepsHorizontal; i++) {
    for (let j = 0; j <= numStepsVertical; j++) {
      const stepA1 = dirA1.clone().setLength(stepSizeA1 * i);
      const stepA3 = dirA3.clone().setLength(stepSizeA3 * j);
      castPos.copy(centerPositionB).add(startPos).add(stepA1).add(stepA3);

      const intersections = castRay(environmentRef, castPos, dir, FIRST_HIT_ONLY)
        .filter(intersection => intersection.object instanceof Mesh);
      // for each point we take the top intersection (all others are irrelevant)

      const intersection = intersections[0];
      // if there was no intersection there is probably a hole in the mesh
      if (!intersection) { // we just throw a warning and continue
        if (gridConfig.printGeometryHoleWarnings) {
          console.warn(`No intersection found at x: ${castPos.x} y: ${castPos.y} z: ${castPos.z}. There is likely a hole in your environment geometry.`);
        }
        continue;
      }

      const isObstacle = Math.abs(intersection.point.y - baseHeight) >= obstacleHeight;
      numberOfChecks++;
      if (isObstacle) numberOfObstacles++;

      if (debugIntersections) {
        // create an instance for the intersection point
        const instanceMatrix = new Matrix4();
        instanceMatrix.setPosition(intersection.point);
        instanceMatrices.push(instanceMatrix);
        instanceColors.push(isObstacle ? 0xff0000 : 0x00ff00);
      }

      // check if the intersection point is higher than the obstacle height
      if (isObstacle) {
        if (debugIntersections) intersectedPointIndices.push(j * numStepsHorizontal + i);
      }
    }
  }

  const maxNumberOfObstacles = Math.max(numberOfChecks * gridConfig.neighborStripIntersectionTolerance, 1);
  const pathBlocked = numberOfObstacles >= maxNumberOfObstacles;

  if (debugIntersections) {
    const matrixValues = new Float32Array(instanceMatrices.length * 16);
    // Loop through the instance matrices to extract the values
    for (let i = 0; i < instanceMatrices.length; i++) {
      const matrix = instanceMatrices[i];
      const values = matrix.elements;
      // Store the values in the matrixValues array
      for (let j = 0; j < values.length; j++) {
        matrixValues[i * 16 + j] = values[j];
      }
    }
    const sphereInstancedMesh = new InstancedUniformsMesh(sphereGeometry, sphereMaterial, instanceMatrices.length);
    sphereInstancedMesh.instanceMatrix.set(matrixValues);
    const color = new Color();
    instanceColors.forEach((colorValue, i) => sphereInstancedMesh.setUniformAt('diffuse', i, color.set(colorValue)));
    scene.add(sphereInstancedMesh);
    neighborIntersectionsMeshRefs.points.push(sphereInstancedMesh);

    // ----------------------------------------

    // if no obstacle was found, create a buffer geometry for the whole rectangular area that
    // was checked for intersections. Remember to correctly create two triangles for the geometry
    const zFightOffset = 0.1;
    const geometry = new BufferGeometry();
    const vertices = new Float32Array([
      // first triangle
      a1.x, centerPositionB.y, a1.y,
      a2.x, centerPositionB.y, a2.y,
      a3.x, centerPositionA.y, a3.y,
      // second triangle
      a2.x, centerPositionB.y, a2.y,
      a3.x, centerPositionA.y, a3.y,
      a4.x, centerPositionA.y, a4.y,
    ]);
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    /*
    const material = new MeshBasicMaterial({
      color: pathBlocked ? 0xff0000 : 0x00ff00,
      side: DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthTest: false
    });
    */
    const material = pathBlocked ? neighborStripMaterialBlocked : neighborStripMaterialFree;
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(centerPositionB.clone().setY(zFightOffset));
    scene.add(mesh);
    neighborIntersectionsMeshRefs.strips.push(mesh);
  }


  return pathBlocked;
}


export function filterOutCellIslands(cellsByHex: CornersByCenterByHex, masterGrid: GridGraph) {
  // for this we will take some start cell (we have to be sure that is not an island somehow)
  // and then perform pathfinding to each cell in the grid. We speed this up by remembering
  // the cells that we already encountered because they were part of some previous path

  // ---------------------------------------------------------------------------------------------------
  // ------------------------------------------------------ ---------------------------------------------
  // the start id is important, because we don't know that it itself isn't part of some island AND
  // we don't even know if that cell exists anymore after removing cells from idByCenterIntersection.
  // If process doesn't work, choose a different start id and try again
  const startId = "cell-10";
  // ---------------------------------------------------------------------------------------------------
  // ---------------------------------------------------------------------------------------------------


  const visitedIds = new TypedSet([startId]);

  for (const [hex, cornersByCenter] of cellsByHex) {
    for (const [centerIntersection] of cornersByCenter) {
      const id = idByCenterIntersection.get(centerIntersection);

      if (id) {
        if (visitedIds.has(id)) {
          continue;
        }
        try {
          const path = pathFinder.current.find(startId, id).map(cell => cell.data.id);

          if (path.length === 0) {
            // REMOVING CELLS
            cornersByCenter.delete(centerIntersection);
            idByCenterIntersection.delete(centerIntersection);
            continue;
          }

          visitedIds.addMany(...path);
        } catch (e) {
          // REMOVING CELLS
          cornersByCenter.delete(centerIntersection);
          idByCenterIntersection.delete(centerIntersection);

        }
      } else {
        console.error("no id found for center intersection");
      }
    }
  }

}


export function filterOutObstructedCells(cellsByHex: CornersByCenterByHex) {
  for (const [hex, cornersByCenter] of cellsByHex) {
    for (const [initCenterIntersection] of cornersByCenter) {
      const {isBlocked, center} = centerIntersectionBombing(
        initCenterIntersection.point,
        gridConfig.cellRadius,
        gridConfig.innerCellRadiusFactor,
        gridConfig.obstacleHeightCenter,
        gridConfig.obstacleCenterRayStartHeight,
        new Vector3(0, -1, 0),
        ENVIRONMENT_REF.current,
        sceneRef.current!,
        gridConfig.debugCenterIntersections
      )

      if (isBlocked) {
        // remove the cell from the map
        cornersByCenter.delete(initCenterIntersection);
        if (cornersByCenter.size === 0) cellsByHex.delete(hex)
      } else {
        // TODO: this is prob not what we wanna do!!! we just want to store it for some later purpose
        // might actually be fine, since we don't have a vertex at the center (maybe we're interested in this)
        // otherwise copy the center point
        //initCenterIntersection.point.copy(center);
        const cellId = getCellId(initCenterIntersection);
        adaptedCellCentersById[cellId] = center;
      }
    }
  }
}


// * important point: characters don't have to walk on the grid, they could walk on the
//  environment. the grid is just there to do path finding. So we need to

export type CornersByCenterByHex = TypedMap<Hex, Map<Intersection, Intersection[]>>;

// we expect hexGridIntersections to include at least one intersection for every corner of every hex
export function buildGridFromHexGridIntersections(hexGridIntersections: HexGridIntersections,
                                                  minHeightDiffStackedCells: number,
                                                  maxHeightCenterToCorner: number): CornersByCenterByHex {
// now with all the intersections for each corner of each hex
// we can build the cells that we can use to build geometries.
// high-level overview of the algorithm:
// we start by going through all center intersections of every hex. For every corner intersection
// we sort the intersections of that corner by height difference to the center.
// intersection as "incomplete", which means no geometry will be build for this center intersection.
// After that is done we filter out the center intersections marked as incomplete.
// Now we go through each corner and each corners intersection and reserve the
// corner intersection for the center intersection that is closest to the ray origin, that
// doesn't have a corner intersection reserved yet. When we're done we should have
// a list of center intersections, each associated with 6 unique corner intersections
// (no corner intersection is used by more than one center intersection).
// With this list in hand we can build the geometry for each hex.

  const cornersByCenterByHex = new TypedMap<Hex, Map<Intersection, Intersection[]>>();
  // we store all intersections of a corner that get used by the end so that we
  // can merge ones that have too little height difference
  const usedIntersectionsByCorner: { [p: string]: TypedSet<Intersection> } = {};
  // store each corner that uses an intersection the intersection
  const usersByIntersection = new TypedMap<Intersection, TypedSet<Intersection>>();

  for (const [hex, hexResult] of hexGridIntersections) {
    // center intersection -> corner intersections = cell
    const cornersByCenter = new Map<Intersection, Intersection[]>();
    const {centerIntersections, intersectionsByCorner} = hexResult;
    // we will use this to filter out incomplete center intersections (cornersByCenter) later
    const incompleteCenterIntersections = new Set<Intersection>();
    // we will use this to keep track of which corner intersections are
    // already reserved for some center intersection (of this center)
    const reservedIntersections = new Set<Intersection>();
    // --------------------------------------------------------------------------------------------------
    // filtering out intersections that are too close to each other. Keeping the ones that are
    // closer to the ray origin. This seems to be working so far.
    for (let i = centerIntersections.length - 1; i > 0; i--) {
      const current = centerIntersections[i];
      const previous = centerIntersections[i - 1];
      if (Math.abs(current.point.y - previous.point.y) < minHeightDiffStackedCells) {
        centerIntersections.pop();
      }
    }
    // --------------------------------------------------------------------------------------------------

    // start by going through all center intersections
    for (const centerIntersection of centerIntersections) {
      let centerIntersectionIncomplete = false;
      // create a new list of corner intersections for this center intersection
      cornersByCenter.set(centerIntersection, []);
      const centerY = centerIntersection.point.y;
      // for each corner we will keep a list of all corner intersections
      // sorted by height difference with the current center intersection
      const sortedIntersectionsByCorner: { [p: string]: Intersection[] } = {};
      // now we go through all corners
      for (const [key, intersectionsOfCorner] of Object.entries(intersectionsByCorner)) {
        // and sort the intersections of this corner by smallest height difference to center
        // TODO: here we want to instead select the one closest to the ray origin that is still in range
        // =============================================================================================================
        const validIntersectionsOfCorner = intersectionsOfCorner.filter((intersection) =>
          Math.abs(intersection.point.y - centerY) <= maxHeightCenterToCorner);
        // check if there are no valid intersections (all are above the max range)
        if (validIntersectionsOfCorner.length === 0) {
          centerIntersectionIncomplete = true;
          cornersByCenter.delete(centerIntersection);
          break; // break out, there can be no cell built for this center intersection
        }
        // sort by the smallest distance to the rays' origin
        validIntersectionsOfCorner.sort((a, b) => a.distance - b.distance);
        sortedIntersectionsByCorner[key] = validIntersectionsOfCorner;
        // =============================================================================================================
      }
      // continue to the next center intersection
      if (centerIntersectionIncomplete) {
        continue;
      }

      // now we need to determine for each corner intersection which center intersection it belongs to
      for (const [cornerKey] of Object.entries(intersectionsByCorner)) {
        // we have filtered the intersections for this corner by distance, now we
        // also make sure that it's not reserved for another intersection of this center
        const availableIntersectionsForCorner = sortedIntersectionsByCorner[cornerKey]
          .filter((intersection) => !reservedIntersections.has(intersection));
        // if there are no available intersections for this corner, we mark this center
        // intersection as incomplete because we can't build a geometry if there isn't
        // an intersection for every corner of a given center intersection.
        if (availableIntersectionsForCorner.length === 0) {
          incompleteCenterIntersections.add(centerIntersection);
          break;
        }
        // otherwise we find the best intersection, reserve it and store it for this center intersection
        const bestIntersectionForCorner = availableIntersectionsForCorner[0];
        reservedIntersections.add(bestIntersectionForCorner);
        cornersByCenter.get(centerIntersection)!.push(bestIntersectionForCorner);

        // -----------------------------------------------------------------------
        // store the intersection for this corner so that we can merge them later
        if (usedIntersectionsByCorner[cornerKey]) {
          usedIntersectionsByCorner[cornerKey].add(bestIntersectionForCorner);

        } else {
          usedIntersectionsByCorner[cornerKey] = new TypedSet<Intersection>([bestIntersectionForCorner]);
        }
        // register the center intersection as a user of this corner
        if (usersByIntersection.has(bestIntersectionForCorner)) {
          usersByIntersection.get(bestIntersectionForCorner)!.add(centerIntersection);
        } else {
          usersByIntersection.set(bestIntersectionForCorner, new TypedSet<Intersection>([centerIntersection]));
        }
        // -----------------------------------------------------------------------
      }

      for (const [centerIntersection, cornerIntersections] of cornersByCenter) {
        if (incompleteCenterIntersections.has(centerIntersection) || cornerIntersections.length < 6) {
          cornersByCenter.delete(centerIntersection);
          // TODO: prob delete from usersByIntersection and usedIntersectionsByCorner
        }
      }
    }
    // save the result (all center intersections with their associated corner intersections) for this hex
    // throw away empty results
    if (cornersByCenter.size > 0) {
      cornersByCenterByHex.set(hex, cornersByCenter);
    }
  }


  // now we know which center intersections share which corner intersections.
  if (gridConfig.mergeStackedCorners)
    mergeStackedCorners(cornersByCenterByHex, usedIntersectionsByCorner, usersByIntersection);

  // when we now iterate over all used corner intersections for a given hex corner and check
  // which have a too small height difference, we can for the users, replace their corner with the
  // merged one


  // ===============================================================================================
  // ===============================================================================================
  // Testing the result:
  // check if every center intersection has 6 corner intersections
  // check if every corner intersection is used exactly once per hex
  for (const [hex, cornersByCenter] of cornersByCenterByHex) {
    const visitedCornerIntersections = new Set<Intersection>();
    for (const [centerIntersection, cornerIntersections] of cornersByCenter) {
      if (cornerIntersections.length !== 6) {
        console.log(cornerIntersections.length);
        throw new Error('not 6');
      }
      cornerIntersections.forEach((cornerIntersection) => {
        if (visitedCornerIntersections.has(cornerIntersection)) {
          // TODO: this happens with the big model - check if this assertion is still valid
          //throw new Error('already visited');
        }
        visitedCornerIntersections.add(cornerIntersection);
      });
    }
  }
  // additional sanity check one can do: does offsetting the grid lead to the same number of cells?
  // It's expected that the number of cells will vary because the corners are
  // intersecting different parts of the environment geometry.
  const numberOfCells = Array.from(cornersByCenterByHex.values())
    .map((cornersByCenter) => cornersByCenter.size)
    .reduce((a, b) => a + b, 0);

  console.log(`number of cells in original grid: ${cornersByCenterByHex.size} - number of cell geometries: ${numberOfCells}`);

  // ===============================================================================================
  // ===============================================================================================
  return cornersByCenterByHex;
}


function mergeStackedCorners(cellsByHex: CornersByCenterByHex,
                             usedIntersectionsByCorner: { [p: string]: TypedSet<Intersection> },
                             usersByIntersection: TypedMap<Intersection, TypedSet<Intersection>>) {


  // when we now iterate over all used corner intersections for a given hex corner and check
  // which have a too small height difference, we can for the users, replace their corner with the
  // merged one

  /*
  High level idea:

  For each corner of a hex we check all intersections
  We sort the corner intersection by their height
  then we go through them and check if the distance between two is smaller than some value
  if it is they are a candidate pair to be merged. To be merged both of them have to be within
  the max height range to their center users.
  After two are merged neither of the corner intersections can be merged any further,
  because that would mean three cells are stacked within the min distance of merged corners,
  which is impossible because that value should always be way smaller than the min distance
  between stacked cells. Just to be safe we check this assumption inside an assertion.
 */

  if (gridConfig.minHeightDiffStackedCells <= gridConfig.minHeightDiffStackedCorners) {
    throw new Error('minHeightDiffStackedCells must be larger than minHeightDiffStackedCorners');
  }
  console.log(usedIntersectionsByCorner);
  console.log(usersByIntersection);
  const mergingCandidates: {
    cornerPair: [target: Intersection, other: Intersection],
    cornerKey: string,
    centerIntersections: Intersection[]
  }[] = [];


  for (const [cornerKey, cornerIntersections] of Object.entries(usedIntersectionsByCorner)) {
    cornerIntersections.sort((a, b) => b.point.y - a.point.y);

    let lastCorner: Intersection | null = null;


    cornerIntersections.forEach((cornerIntersection, _, all, i) => {
      if (!lastCorner) {
        lastCorner = cornerIntersection;
        return;
      }
      const dist = Math.abs(lastCorner.point.y - cornerIntersection.point.y);
      if (dist < gridConfig.minHeightDiffStackedCorners) {
        // we have candidates for merging - but we must first check the distance to the center.
        // get the user
        const usersA = usersByIntersection.get(cornerIntersection)!;
        const usersB = usersByIntersection.get(lastCorner)!;
        // both need to be in distance to the lower corner

        // cornerIntersection will be the possible merging target, because it has a lower y-coord,
        // and we will always merge from highest to lowest
        const allUsersInRangeA = usersA.every((user) => {
          const dist = Math.abs(user.point.y - cornerIntersection!.point.y);
          // the distance has to be smaller than the allowed dist between center and corner
          return dist < gridConfig.maxHeightCenterToCorner;
        })
        const allUsersInRangeB = usersB.every((user) => {
          const dist = Math.abs(user.point.y - cornerIntersection!.point.y);
          // the distance has to be smaller than the allowed dist between center and corner
          return dist < gridConfig.maxHeightCenterToCorner;
        });

        if (allUsersInRangeA && allUsersInRangeB) {
          // we found two candidates for merging!
          console.log("=====================================");
          console.log(`found two candidates for corner merging`);
          console.log(lastCorner.point);
          console.log(cornerIntersection.point);
          console.log("=====================================");

          // TODO: we will need to replace the corner in the users
          mergingCandidates.push({
            cornerPair: [cornerIntersection, lastCorner],
            cornerKey,
            centerIntersections: [...usersA, ...usersB]
          });
          lastCorner = null; // we need to reset the last corner
        }
      }
    });
  }


  // now we have all the merging candidates, we can merge them
  // we need to merge them inside the original cellsByHex

  console.log(mergingCandidates);
  console.log(cellsByHex);
  for (const candidatePair of mergingCandidates) {
    //const targetCorner = candidatePair[0];

    // for each center we find the entry in cellsByHex
    candidatePair.centerIntersections.forEach(center => {
      const cornersByCenter = cellsByHex.find((cornerByCenter, hex) => {
        // we need to store the hex and the user as well
        // update the corner for each using center

        // TODO: are we doing this right? Looks like we're checking for keys
        return cornerByCenter.has(center);
      });

      // cornersByCenter is undefined in error - should that be possible to happen?
      // this means that we are not finding the center in cellsByHex
      // this weird - would mean that candidatePair includes a center user that
      // is not to be found in cellsByHex

      if (!cornersByCenter) {
        console.log(candidatePair);
        return; // TODO: we continue here, because some of the centers have been deleted from cellsByHex
      }


      const corners = cornersByCenter!.get(center)!;
      const idx = corners.findIndex(corner => candidatePair.cornerPair.includes(corner));
      corners[idx] = candidatePair.cornerPair[0]; // we overwrite the corner
    });
  }

}


// =====================================================================================================================
// =====================================================================================================================

export type CellLean = {
  id: string, point: { x: number, y: number, z: number },
  adaptedCenter: { x: number, y: number, z: number }
};
export type CellNode = CellLean & { neighbors: string[] }
export type GridGraph = { [id: string]: CellNode };
export type Cell = Intersection & { id: string };


export const [getCellId, resetCellId] = (() => {
  const cellToId = new Map<Intersection, string>();
  let nextId = -1; // the first id will be 0

  function _resetCellId() {
    cellToId.clear();
    nextId = -1;
  }

  function _getCellId(intersection: Intersection) {
    if (cellToId.has(intersection)) return cellToId.get(intersection)!;
    else {
      nextId++;
      const id = `cell-${nextId}`;
      cellToId.set(intersection, id);
      return id;
    }
  }

  return [_getCellId, _resetCellId] as const;
})();


// same method for the graph version
function addNeighborsToMasterGridGraph(cellA: CellLean, cellB: CellLean, grid: GridGraph) {
  // check if the cell is already in the grid structure and if the neighbors was already added
  const idA = cellA.id;
  const neighborsA = grid[idA] ? grid[idA].neighbors : (grid[idA] = {...cellA, neighbors: []}).neighbors;
  neighborsA.includes(cellB.id) || neighborsA.push(cellB.id);
  // - do the same for the neighbor
  const idB = cellB.id;
  const neighborsB = grid[idB] ? grid[idB].neighbors : (grid[idB] = {...cellB, neighbors: []}).neighbors;
  neighborsB.includes(cellA.id) || neighborsB.push(cellA.id);
}


export const idByCenterIntersection = new Map<Intersection, string>();

export function buildGridGraph(cornersByCenterByHex: CornersByCenterByHex, grid2d: Grid<Hex>, maxHeightNeighborToCenter: number): GridGraph {
  const masterGridGraph: GridGraph = {};
  // Each hex in the 2d hex grid has multiple realized cells - hexagons that found a center intersection
  // as well as 6 corner intersections that lie within the maximum height difference to build a cell mesh.
  // Our goal with this algorithm now is to connect each realized cell with its real neighbors. For this
  // we have to check all the real cells for each hex and connect them to real cells of the neighboring
  // hexes that lie within a maximum height difference. Importantly, each cell can only have one cell
  // neighbor for each cardinal direction. We will have to find the best option by comparing height
  // differences between cells and their neighbors.

  const isBlockedByCombinedId = new Map<string, boolean>();

  // ===============================================================================================
  for (const [hex, cornersByCenter] of cornersByCenterByHex) {
    if (cornersByCenter.size === 0) { // sanity check
      throw new Error('cornersByCenter is empty - these should have been filtered out before');
    }

    // all cells (center intersections) for the current hex
    const centerCells = [...cornersByCenter.keys()];
    // get the theoretical neighbors in the hex grid of the current hex
    const neighborHexes = getNeighborsIn2dGrid(hex, grid2d);

    // now for each of those neighboring hexes
    for (const neighborHex of neighborHexes) {
      // we're getting every possible cell (that means completed intersections with the env. -> center + 6 corners)
      const neighbors = cornersByCenterByHex.get(neighborHex);
      // these are theoretical hexes (from the 2d grid), some hexes didn't have
      // complete intersections with the environment, we continue with the next hex in that case
      if (!neighbors) {
        continue;
      }

      // if completed cells exists, get the center intersections of them
      // TODO: somehow it's necessary to transform this to an array or we don't get same amount as meshes - why??.
      const neighborCells = [...neighbors.keys()];

      // Now we do the following: We calculate the distance between each center cell and the center of each neighbor
      // (for this hex). Then we sort that list of pairs by the smallest distance and create the connections. Each time
      // we create a connection, we mark both cells involved in the connection as taken and thereby remove the
      // possibility of them being used for another connection.
      // ---------------------------------------------------------------------------------------------------------------

      // First Step: build a sorted list of all connections and a pool of available cells ------------------------------
      const cellPool = new TypedSet<Intersection>();
      const possibleConnections = [];
      for (const centerCell of centerCells) {
        cellPool.add(centerCell);
        for (const neighborCell of neighborCells) {
          const distance = Math.abs(centerCell.point.y - neighborCell.point.y);
          // this is the base condition for being neighbors - the height difference can't be larger than some parameter
          if (distance > maxHeightNeighborToCenter)
            continue;


          // the second condition is - that the path between the two cells is not obstructed by obstacles

          const myId = getCellId(centerCell);
          const neighborId = getCellId(neighborCell);
          const adaptedCenterA = adaptedCellCentersById[myId];
          const adaptedCenterB = adaptedCellCentersById[neighborId];

          // make sure that we haven't checked this neighbor pair before
          const combinedStringA = myId + neighborId;
          const combinedStringB = neighborId + myId;

          const isBlocked = isBlockedByCombinedId.get(combinedStringA) || isBlockedByCombinedId.get(combinedStringB);
          if (isBlocked) continue;

          if (gridConfig.checkForObstaclesBetweenCells) {
            const isBlocked = neighborIntersectionBombing(
              gridConfig.cellRadius,
              new Vector3(adaptedCenterA.x, adaptedCenterA.y, adaptedCenterA.z),
              new Vector3(adaptedCenterB.x, adaptedCenterB.y, adaptedCenterB.z),
              gridConfig.obstacleHeightNeighbor,
              gridConfig.obstacleNeighborRayStartHeight,
              gridConfig.neighborStripWidthFactor,
              gridConfig.neighborStripLenFactor,
              ENVIRONMENT_REF.current,
              sceneRef.current!,
              gridConfig.debugNeighborIntersections
            );
            isBlockedByCombinedId.set(combinedStringA, isBlocked);
            isBlockedByCombinedId.set(combinedStringB, isBlocked);

            if (isBlocked) continue;
          }

          // if that condition is given, prepare the connection
          const connection = {cells: [centerCell, neighborCell], distance};
          possibleConnections.push(connection);
          cellPool.add(neighborCell);
        }
      } // finally we have to sort the conditions by smallest distance, before starting to realize them
      possibleConnections.sort((a, b) => a.distance - b.distance);
      // ---------------------------------------------------------------------------------------------------------------

      // Second Step: Go through the list and realize the connections while removing the involved cells from the pool
      for (const connection of possibleConnections) {
        const [cellA, cellB] = connection.cells;
        if (cellPool.has(cellA) && cellPool.has(cellB)) {
          // realize connection
          const myId = getCellId(cellA);
          const neighborId = getCellId(cellB);
          // we temporarily save the id inside the intersection object,
          // this will help build the final master grid structure later,
          // because we can associate each intersection with its id (and save the created mesh by its id)
          idByCenterIntersection.set(cellA, myId);
          idByCenterIntersection.set(cellB, neighborId);
          // ---------------------------------------------------------------------------------
          // save the connection between the cells in the grids graph
          const adaptedCenterA = adaptedCellCentersById[myId];
          const adaptedCenterB = adaptedCellCentersById[neighborId];
          addNeighborsToMasterGridGraph(
            {
              id: myId,
              point: {x: cellA.point.x, y: cellA.point.y, z: cellA.point.z},
              adaptedCenter: {x: adaptedCenterA.x, y: adaptedCenterA.y, z: adaptedCenterA.z}
            },
            {
              id: neighborId,
              point: {x: cellB.point.x, y: cellB.point.y, z: cellB.point.z},
              adaptedCenter: {x: adaptedCenterB.x, y: adaptedCenterB.y, z: adaptedCenterB.z}
            },
            masterGridGraph);
          // ---------------------------------------------------------------------------------
          // remove cells from the pool
          cellPool.deleteMany(cellA, cellB);
        }
      }
    }
  }
  // ===============================================================================================
  // before we're leaving, we'll remove all the center intersections that have no id assigned
  // which means they did not get any neighbors and are now isolated
  for (const [hex, cornersByCenter] of cornersByCenterByHex) {
    for (const [center, corners] of cornersByCenter) {
      if (!idByCenterIntersection.has(center)) {
        cornersByCenter.delete(center);
      }
    }
  }


  // ===============================================================================================
  // sanity check: every cell should have max 6 neighbors and at least 1
  for (const [id, entry] of Object.entries(masterGridGraph)) {
    if (entry.neighbors.length > 6) {
      console.error('cell has more than 6 neighbors', id);
    }
    if (entry.neighbors.length === 0) {
      console.error('cell has no neighbors', id);
    }
  }
  // ===============================================================================================
  return masterGridGraph
}
