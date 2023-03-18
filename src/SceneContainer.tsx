import {Decal, MeshTransmissionMaterial, OrbitControls, useTexture} from "@react-three/drei";
import {useEffect, useRef} from "react";
import {invalidate, useThree} from "@react-three/fiber";
import Skybox from "./components/Skybox";
import SceneLights from "./components/SceneLights";
import EffectsComponent from "./components/EffectsComponent";
import EnvironmentRenderer from "./components/EnvironmentRenderer";
import HelperComponents from "./components/HelperComponents";
import GridRenderer from "./components/GridRenderer";
import {CreatorPlane, heightMapConfig} from "./HexGrid";
import {cellMeshes, mergedGridMesh, sceneRef} from "./grid/globals";
import {centerIntersectionBombing, neighborIntersectionBombing} from "./grid/buildGridDataStructure";
import {Color, Vector2, Vector3} from "three";
import {CustomInstance} from "./components/CustomInstance";


export default function SceneContainer() {
  const {camera, scene} = useThree(({camera, scene}) => ({camera, scene}));
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      camera.position.set(-20, 50, 20);
      camera.lookAt(0, 0, -50);
    }
    firstRender.current = false;
    window.addEventListener("mousemove", () => invalidate());
    // we need to make the scene globally available for the download button
    sceneRef.current = scene;

  }, []);

  return (
    <>


      <EnvironmentRenderer/>
      <CreatorPlane/>
      {
        /*
        <mesh position={[0, 10, 0]}>
          <boxGeometry/>
          <Decal
            debug // Makes "bounding box" of the decal visible
            position={[0, 1, 0]} // Position of the decal
            rotation={[0, 0, 0]} // Rotation of the decal (can be a vector or a degree in radians)
            scale={2} // Scale of the decal
            map={texture}
          />
        </mesh>
         */
      }

      <GridRenderer/>

      <Skybox/>
      <EffectsComponent/>
      <SceneLights/>


      <HelperComponents/>
      <OrbitControls enableDamping={false} makeDefault={true}/>
    </>
  )
}