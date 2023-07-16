import {EffectComposer, Bloom} from "@react-three/postprocessing";

export default function EffectsComponent() {
  //return null;

  return (
    <EffectComposer depthBuffer stencilBuffer={false} disableNormalPass multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1}/>
    </EffectComposer>
  )
}

