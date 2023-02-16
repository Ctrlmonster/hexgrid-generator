import {BVHRenderer, getMeshes} from "./BVHRenderer";
import Model5 from "../modelComponents/Free_fire_clocktower_freefire";
import {useControls} from "leva";
import {renderOptions} from "../HexGrid";
import {Model} from "../modelComponents/Fantastic_demo_level3_merged";
import {Group} from "three";
import {useEffect, useRef} from "react";
import {useSnapshot} from "valtio";
import {ENVIRONMENT_REF} from "../grid/globals";

export default function EnvironmentRenderer() {
  const envRef = useRef<Group>(null!);
  useSnapshot(renderOptions);

  useEffect(() => {
    ENVIRONMENT_REF.current = envRef.current;
  }, []);

  useEffect(() => {
    const meshes = getMeshes(envRef.current);
    meshes.forEach((mesh) => {
      // @ts-ignore
      mesh.material.wireframe = renderOptions.renderEnvAsWireFrame;
    });
  }, [renderOptions.renderEnvAsWireFrame]);


  return (
    <group ref={envRef}>
      <BVHRenderer>
        {
          /*
            <Model2 position={[0, 0, 0]} scale={[.5, .5, .5]}/>
            <Model4 position={[10, -5, 0]} scale={[.01, .01, .01]}/>
            <Model3 position={[0, 0, 0]} scale={[.5, .5, .5]}/>
            <Model1 visible={true} position={[0, 2, 0]} scale={[.5, .5, .5]}/>
        <Model5 position={[0, 0, 0]} scale={[1, 1, 1]}/>

           */
        }


        <Model position={[0, 5, 0]}/>

      </BVHRenderer>
    </group>
  )
}