// helper function that traverses a scene graph and returns all meshes
import {BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, Object3D} from "three";
import {ReactNode, useEffect, useRef} from "react";
import {acceleratedRaycast, computeBoundsTree, disposeBoundsTree} from "three-mesh-bvh";

// ---------------------------------------------------------------------------------------------
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

// ---------------------------------------------------------------------------------------------

export function getMeshes(object: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  object.traverse((obj) => {
    if (obj instanceof Mesh) {
      meshes.push(obj);
    }
  });
  return meshes;
}


export function BVHRenderer({children}: { children: ReactNode }) {
  const modelRef = useRef<Group>(null!);

  useEffect(() => {
    const meshes = getMeshes(modelRef.current);
    meshes.forEach((mesh) => {
      mesh.geometry.computeBoundsTree();
    });
    return () => {
      meshes.forEach((mesh) => {
        mesh.geometry.disposeBoundsTree();
      });
    }
  }, []);

  return (
    <group ref={modelRef}>
      {children}
    </group>
  )
}
