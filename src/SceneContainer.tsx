import {MeshTransmissionMaterial, OrbitControls} from "@react-three/drei";
import {useEffect} from "react";
import {invalidate, useThree} from "@react-three/fiber";
import Skybox from "./components/Skybox";
import SceneLights from "./components/SceneLights";
import EffectsComponent from "./components/EffectsComponent";
import EnvironmentRenderer from "./components/EnvironmentRenderer";
import HelperComponents from "./components/HelperComponents";
import GridRenderer from "./components/GridRenderer";
import {CreatorPlane, heightMapConfig} from "./HexGrid";
import {cellMeshes, physicalGridRef, sceneRef} from "./grid/globals";
import {centerIntersectionBombing, neighborIntersectionBombing} from "./grid/buildGridDataStructure";
import {Color, Vector2} from "three";
import {CustomInstance} from "./components/CustomInstance";



export default function SceneContainer() {
  const {camera, scene} = useThree(({camera, scene}) => ({camera, scene}));
  useEffect(() => {
    camera.position.set(-20, 50, 20);
    camera.lookAt(0, 0, -50);
    window.addEventListener("mousemove", () => invalidate());
    // we need to make the scene globally available for the download button
    sceneRef.current = scene;

  }, []);

  return (
    <>


      <EnvironmentRenderer/>
      <CreatorPlane/>


      <GridRenderer/>

      <Skybox/>
      <EffectsComponent/>
      <SceneLights/>


      <HelperComponents/>
      <OrbitControls enableDamping={false} makeDefault={true}/>
    </>
  )
}