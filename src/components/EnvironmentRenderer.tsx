import {BVHRenderer, getMeshes} from "./BVHRenderer";
import Model5 from "../modelComponents/Jungle_environment";
import {renderOptions} from "../HexGrid";
import {Group} from "three";
import {useEffect, useRef} from "react";
import {useSnapshot} from "valtio";
import {ENVIRONMENT_REF, GROUND_REF} from "../grid/globals";


export default function EnvironmentRenderer() {
  const envRef = useRef<Group>(null!);
  const groundRef = useRef<Group>(null!);
  useSnapshot(renderOptions);

  useEffect(() => {
    ENVIRONMENT_REF.current = envRef.current;
    GROUND_REF.current = groundRef.current;
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
        <Model5 ref={groundRef} position={[50, -10, -25]} scale={[.05, .05, .05]}/>
      </BVHRenderer>
    </group>
  )
}