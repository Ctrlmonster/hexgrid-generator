import px from "/images/skybox/Sky_Anime_01_Day_a/px.png";
import nx from "/images/skybox/Sky_Anime_01_Day_a/nx.png";
import py from "/images/skybox/Sky_Anime_01_Day_a/py.png";
import ny from "/images/skybox/Sky_Anime_01_Day_a/ny.png";
import pz from "/images/skybox/Sky_Anime_01_Day_a/pz.png";
import nz from "/images/skybox/Sky_Anime_01_Day_a/nz.png";
import {Suspense} from "react";
import {Environment} from "@react-three/drei";


export default function Skybox() {
  return (
    <Suspense fallback={<color attach="background" args={["#b5a9d3"]}/>}>
      <Environment
        files={[
          px,
          nx,
          py,
          ny,
          pz,
          nz
        ]}
        background={true}
      />
    </Suspense>
  )
}