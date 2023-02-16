import {EffectComposer, Bloom} from "@react-three/postprocessing";


export default function EffectsComponent() {
  return null;


  /*
  return <>
    <EffectComposer>
      <Bloom mipmapBlur/>
    </EffectComposer>
  </>
  */
}


/*
import {Effects} from "@react-three/drei";
import {useControls} from "leva";
import {extend, ReactThreeFiber} from "@react-three/fiber";
import {OutlinePass, SSAOPass, UnrealBloomPass} from "three-stdlib";
extend({UnrealBloomPass, OutlinePass, SSAOPass});
declare global {
  namespace JSX {
    interface IntrinsicElements {
      unrealBloomPass: ReactThreeFiber.Node<UnrealBloomPass, typeof UnrealBloomPass>;
      outlinePass: ReactThreeFiber.Node<OutlinePass, typeof OutlinePass>;
      sSAOPass: ReactThreeFiber.Node<SSAOPass, typeof SSAOPass>;
    }
  }
}

export default function EffectsComponent() {
  const bloomProps = useControls('Bloom', {
      enable: {
        value: false
      },
      luminanceThreshold: {
        value: 0.14,
        min: 0,
        max: 2,
        label: 'threshold'
      },
      intensity: {value: 1, min: 0, max: 10},
      radius: {value: 1, min: 0, max: 1},
    },
    {collapsed: true}
  )

  return (
    <Effects disableGamma={true}>
      <unrealBloomPass
        enabled={bloomProps.enable}
        strength={bloomProps.intensity}
        threshold={bloomProps.luminanceThreshold}
        radius={bloomProps.radius}
      />
    </Effects>
  );
}
*/