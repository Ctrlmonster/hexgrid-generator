import {Vector3} from "three";


const flatHexShader = `
      // west side of the hexagon
      if (position.x < 0.0) {
        // north-west
        if (position.z > 0.0) {
          position.y += offsetWest[0];  
        }
        else {
          // west
          if (position.z == 0.0) {
            position.y += offsetWest[1];
          }
          // south-west 
          else {
            position.y += offsetWest[2];
          }
        }
      } 
      // ----------------------------------
      // east side of the hexagon
      else {
        // north-east
        if (position.z > 0.0) {
          position.y += offsetEast[0];
        }
        else {
          // east
          if (position.z == 0.0) {
            position.y += offsetEast[1];
          }
          // south-east
          else {
            position.y += offsetEast[2];
          }
        }
      }   
    `;


export const cellInstanceVertex = {
  uniforms: {
    offsetWest: {value: new Vector3()},
    offsetEast: {value: new Vector3()},
  },
  // similar to offsetWest and offsetEast we'll need normal Vectors
  vertexDefs: `
      attribute float heightOffsets;
      uniform vec3 offsetWest;
      uniform vec3 offsetEast;
    `,
  // TODO: we could pass two different shader strings, depending on whether
  //  the cell is pointy or flat
  vertexTransform: flatHexShader
};


// ================================================================================


// ================================================================================

// this is not valid glsl:
//position.y += offsets[gl_InstanceID * 6 + gl_VertexID];
// this is how we can access the offsets array:


const flatHexShaderAlt = `
   position.y += offset;
`;


export const cellInstanceVertexAlt = {
  vertexDefs: `
      attribute float offset;
      `,
  vertexTransform: flatHexShaderAlt
}

