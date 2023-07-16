import {OrbitControls} from "@react-three/drei";
import {useEffect, useRef} from "react";
import {invalidate, useThree} from "@react-three/fiber";
import Skybox from "./components/Skybox";
import SceneLights from "./components/SceneLights";
import EffectsComponent from "./components/EffectsComponent";
import EnvironmentRenderer from "./components/EnvironmentRenderer";
import HelperComponents from "./components/HelperComponents";
import GridRenderer from "./components/GridRenderer";
import {CreatorPlane} from "./HexGrid";
import {sceneRef} from "./grid/globals";
import {PerspectiveCamera} from "three";


export default function SceneContainer() {
  const {camera, scene} = useThree(({camera, scene}) => ({camera, scene}));
  const firstRender = useRef(true);


  useEffect(() => {
    camera.near = 0.5;
    camera.far = 500;
    (camera as PerspectiveCamera).fov = 70;

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
      <GridRenderer/>

      <Skybox/>
      <EffectsComponent/>
      <SceneLights/>


      <HelperComponents/>
      <OrbitControls enableDamping={false} makeDefault={true}/>
    </>
  )
}