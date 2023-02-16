import {useEffect} from "react";
import {useThree} from "@react-three/fiber";
import {resetPathfinding} from "../grid/functions";
import {
  cellMeshes,
  finder,
  instancedMeshGridRef, pathInstances,
  pathMeshes,
  physicalGridRef,
  startCellIdRef,
  targetCellIdRef
} from "../grid/globals";
import {renderOptions} from "../HexGrid";
import {Color} from "three";


const cellColor = new Color();
export const cellColorValues: number[] = [];

let waitingForPath = false;


export default function GridRenderer() {
  const raycaster = useThree(({raycaster}) => raycaster);

  // TODO: for path finding we need to link each face contained in a cell to the cell

  useEffect(() => {
    // right click to halt pathfinding - path will be deleted if clicked outside the grid
    const onContextMenu = () => {
      const intersects = raycaster.intersectObject(instancedMeshGridRef.current!);
      if (intersects.length) resetPathfinding(true);
      else resetPathfinding(false);
    }
    window.addEventListener('contextmenu', onContextMenu);
    // -----------------------------------------------------------------------------


    // click on cell to select start cell for path finding
    const onClick = () => {
      if (instancedMeshGridRef.current) {
        const intersects = raycaster.intersectObject(instancedMeshGridRef.current!);
        const [intersection] = intersects;
        const instanceId = intersection ? intersection.instanceId : null;
        if (instanceId == null) return;

        startCellIdRef.current = intersection.object.userData.cellIds[instanceId];
        console.log(startCellIdRef.current);
      }
    }
    window.addEventListener('click', onClick);
    // -----------------------------------------------------------------------------


    const onMouseMove = async () => {
      if (!renderOptions.displayPathFinding || !instancedMeshGridRef.current) return;

      const intersects = raycaster.intersectObject(instancedMeshGridRef.current);
      const [intersection] = intersects;

      const instanceId = intersection ? intersection.instanceId : null;
      if (instanceId == null) return;
      if (startCellIdRef.current == null) return;
      if (waitingForPath) return;

      targetCellIdRef.current = intersection.object.userData.cellIds[instanceId];
      waitingForPath = true;
      const path = await finder.findPath(startCellIdRef.current, targetCellIdRef.current!);
      waitingForPath = false;

      // first reset all colors
      pathInstances.forEach(idx => {
        cellColorValues[idx] = 0xffffff;
      });
      // then get the new instances
      pathInstances.clear();
      pathInstances.addMany(...path.map(id => instancedMeshGridRef.current!.userData.instanceIndexByCellId[id]));
      // and set the new colors
      pathInstances.forEach(idx => {
        cellColorValues[idx] = 0xff0000;
      });
      cellColorValues.forEach((v, i) => {
        instancedMeshGridRef.current!.setUniformAt("diffuse", i, cellColor.set(v));
      });
    }
    // hover over a cell to select it as target cell for path finding
    window.addEventListener("mousemove", onMouseMove)
    // -----------------------------------------------------------------------------

    // cleanup
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('click', onClick);
      window.removeEventListener("mousemove", onMouseMove);
    }
  }, []);


  return null;
}