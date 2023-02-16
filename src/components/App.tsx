import {Canvas} from "@react-three/fiber";
import SceneContainer from "../SceneContainer";
import {Leva, useControls} from "leva";
import {exportGridMesh} from "../helper/gltfExport";
import {build3dGridWithPathfinding} from "../grid/functions";
import {cellMeshes, sceneRef} from "../grid/globals";


function App() {
  const {renderOnDemand} = useControls({
    renderOnDemand: true
  });


  return (
    <div className="AppContainer">
      <Leva/>
      <Canvas style={{zIndex: 0}} frameloop={(renderOnDemand) ? "demand" : "always"} shadows={true}>
        <SceneContainer/>
      </Canvas>

      <div className={"flex absolute top-0 left-0 m-5 text-white font-bold text-xl"}>
        {/* @ts-ignore */}
        <div onClick={() => cellMeshes.length && exportGridMesh(cellMeshes)}
             className={"bg-blue-500 py-2 px-4 hover:cursor-pointer " +
               "mr-5 rounded interaction-button"}>
          Save GridMesh
        </div>

        {/* @ts-ignore */}
        <div onClick={() => sceneRef.current && build3dGridWithPathfinding(sceneRef.current)}
             className={"bg-blue-500 py-2 px-4 hover:cursor-pointer rounded interaction-button"}>
          Build Grid
        </div>
      </div>


    </div>
  )
}

export default App
