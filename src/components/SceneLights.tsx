import {folder, useControls} from "leva";
import {useEffect, useRef} from "react";
import {CameraHelper, DirectionalLight, PointLight} from "three";
import {useThree} from "@react-three/fiber";


export default function SceneLights() {
  // add debug controls for light colorComponent and intensity

  const directionalLightRef = useRef<DirectionalLight>(null);
  const pointLightRef = useRef<PointLight>(null);
  const scene = useThree(state => state.scene);


  useEffect(() => {

    if (directionalLightRef.current) {
      // @ts-ignore
      //const shadowCameraHelper = new CameraHelper(directionalLightRef.current.shadow.camera);
      // scene.add(shadowCameraHelper)
    }

  }, [])

  const {
    dl_enabled, dl_helper_enabled, dl_castShadow, dl_intensity, dl_position, dl_color,
    al_enabled, al_intensity, al_color,
    pl_enabled, pl_intensity, pl_position, pl_color, pl_castShadow
  } = useControls("Lights", {
    'directionalLight': folder({
      dl_enabled: true,
      dl_helper_enabled: false,
      dl_castShadow: true,
      dl_color: "#ffffff",
      dl_intensity: 1.8,
      dl_position: [-50, 64, 0],
    }, {collapsed: true}),
    'ambientLight': folder({
      al_enabled: true,
      al_intensity: 3.3,
      al_color: "#9b9b9b",
    }, {collapsed: true}),
    'pointLight': folder({
      pl_enabled: false,
      pl_castShadow: true,
      pl_color: "#ffffff",
      pl_intensity: 1,
      pl_position: [10, 20, 10],
    }, {collapsed: true}),
  }, {collapsed: true});

  return (
    <>
      {al_enabled && <ambientLight color={al_color} intensity={al_intensity}/>}
      {dl_enabled && <directionalLight
        ref={directionalLightRef}
        color={dl_color}
        position={dl_position}
        intensity={dl_intensity}
        castShadow={dl_castShadow}
        shadow-mapSize-height={512}
        shadow-mapSize-width={512}
        shadow-camera-far={130}
        shadow-camera-near={60}
        shadow-camera-left={-40} // this is the arena size
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />}
      {directionalLightRef.current && dl_helper_enabled &&
        <cameraHelper args={[directionalLightRef.current.shadow.camera]}/>}

      {pl_enabled && <pointLight color={pl_color}
                                 position={pl_position}
                                 intensity={pl_intensity}
                                 castShadow={pl_castShadow}
                                 shadow-mapSize-height={512}
                                 shadow-mapSize-width={512}
      />}
    </>
  )
}