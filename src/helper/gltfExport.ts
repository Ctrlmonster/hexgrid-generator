import {BoxGeometry, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry} from "three";
// @ts-ignore
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";


// adapted from the following three js example:
// https://github.com/mrdoob/three.js/blob/master/examples/misc_exporter_gltf.html


const link = document.createElement('a');
link.style.display = 'none';
document.body.appendChild(link); // Firefox workaround, see #6594

function save(blob: Blob, filename: string) {
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

const params = {
  trs: true, // translation, rotation, scale
  onlyVisible: false,
  binary: false,
  maxTextureSize: 4096,
};

function saveString(text: string, filename: string) {
  save(new Blob([text], {type: 'text/plain'}), filename);
}

function saveArrayBuffer(buffer: BufferSource, filename: string) {
  save(new Blob([buffer], {type: 'application/octet-stream'}), filename);
}

export function exportGLTF(input: Object3D) {
  const gltfExporter = new GLTFExporter();
  gltfExporter.parse(
    input,
    function (result: any) {
      console.log(result); // is always empty - nodes are just empty objects
      if (result instanceof ArrayBuffer) {
        saveArrayBuffer(result, 'scene.glb');
      } else {
        const output = JSON.stringify(result, null, 2);
        saveString(output, 'scene.gltf');
      }
    },
    params
  );
}

