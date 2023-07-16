import {Intersection, Mesh, Object3D, Raycaster, Vector3} from "three";
import {Grid, Hex} from "honeycomb-grid";


// =====================================================================================================================
const genKey = (x: number, y: number) => `${x}|${y}`; // TODO: use, q/r instead of x/y

// for each corner I also want to store the three neighboring points
type HexIntersections = {
  hex: Hex,
  intersectionsByCorner: { [p: string]: Intersection[] },
  centerIntersections: Intersection[]
// if all intersections for a given corner are above a max distance, we mark that center
};


export const castRay = (() => {
  const raycaster = new Raycaster(); // re-using the raycaster
  function _castRay(scene: Object3D, startPos: Vector3, dir: Vector3, firstHitOnly: boolean) {
    raycaster.firstHitOnly = firstHitOnly;
    raycaster.set(startPos, dir);
    const allIntersections = raycaster.intersectObject(scene, true);
    return allIntersections.filter((intersection) => intersection.object instanceof Mesh);
  }

  return _castRay;
})();

export type HexGridIntersections = Map<Hex, HexIntersections>;
export const allIntersectionsByKey: { [p: string]: Intersection[] } = {}; // used to cache intersections

export function computeHexGridIntersections(scene: Object3D,
                                            grid: Grid<Hex>,
                                            config: {
                                              rayStartHeight: number,
                                              rayCastYDirection: number,
                                              firstHitOnly: boolean,
                                            }): HexGridIntersections {

  const {rayStartHeight, rayCastYDirection, firstHitOnly} = config;

  const dir = {x: 0, y: rayCastYDirection, z: 0} as Vector3;
  const resultsByHex = new Map<Hex, HexIntersections>();

  // we go through all hexes and for each corner of a giveyn hex
  // we cast a ray down to find the intersections with the environment.
  // since corners are shared by multiple hexes, we can optimize by only
  // casting a ray for each unique corner. We make one additional raycast
  // for the center of the hex, this will make it easier to associate
  // the corner intersections with the center intersections, and also
  // we need the normal of the center intersection for the geometry later on.
  for (const hex of grid) {
    const hexResult: HexIntersections = {hex, intersectionsByCorner: {}, centerIntersections: null!};
    for (const corner of hex.corners) {
      const {x, y} = corner;
      const key = genKey(x, y);
      if (allIntersectionsByKey[key]) {
        // we looked at this corner before, so we can reuse the result
        hexResult.intersectionsByCorner[key] = allIntersectionsByKey[key];
      } else {
        // we swap y and z because honey-comp only knows about two dimensions
        const startPos = {x, y: rayStartHeight, z: y} as Vector3;
        const intersections = castRay(scene, startPos, dir, firstHitOnly);
        allIntersectionsByKey[key] = intersections;
        hexResult.intersectionsByCorner[key] = intersections;
      }
    }
    // make one additional raycast from the center of the hex
    hexResult.centerIntersections = castRay(scene, {x: hex.x, y: rayStartHeight, z: hex.y} as Vector3, dir, firstHitOnly);
    // if no center intersection was found, we can skip this hex
    if (hexResult.centerIntersections.length > 0) {
      const everyCornerIntersected = Object.values(hexResult.intersectionsByCorner)
        .every((intersections) => intersections.length > 0);
      // if every corner of the hex has at least one intersection, we can add it to the results
      if (everyCornerIntersected) {
        resultsByHex.set(hex, hexResult);
      }
    }
  }
  return resultsByHex;
}

// =====================================================================================================================
