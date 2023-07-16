import {Canvas} from "@react-three/fiber";
import SceneContainer from "../SceneContainer";
import {Leva, useControls} from "leva";
import {exportGLTF} from "../helper/gltfExport";
import {build3dGridWithPathfinding} from "../grid/functions";
import {mergedGridMesh, sceneRef} from "../grid/globals";
import {useEffect} from "react";


function App() {
  const {renderOnDemand} = useControls({
    renderOnDemand: true,
  });


  useEffect(() => {
    console.log("zy");
  }, []);

  return (
    <div className="AppContainer">
      <Leva/>
      <Canvas style={{zIndex: 0}} dpr={1}
              frameloop={(renderOnDemand) ? "demand" : "always"}
              shadows={true}
              gl={{
                powerPreference: "high-performance",
                antialias: false,
                stencil: false,
                depth: false
              }}>
        <SceneContainer/>
      </Canvas>

      <div className={"flex absolute top-0 left-0 m-5 text-white font-bold text-xl"}>
        {/* @ts-ignore */}
        <div onClick={() => mergedGridMesh.current && exportGLTF(mergedGridMesh.current)}
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
