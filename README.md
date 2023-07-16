# HexGrid Generator

⚠️ This project is still under **heavy development** and things might be broken⚠️. 

This project was inspired by [Terrain Grid System](https://assetstore.unity.com/packages/tools/terrain/terrain-grid-system-2-244921).
The result of the generated grid depends heavily on the config values, and it's likely that
there is a set of config values that fits your environment well. Works especially well
with things like hilly landscapes. For urban environments more parameter tweaking is necessary.

**Detailed Docs coming the future**


to add your own model go into `EnvironmentRenderer.tsx`
and add it like this:

```jsx
<group ref={envRef}>
  <BVHRenderer>
    <Model5 ref={groundRef} position={[50, -10, -25]} scale={[.05, .05, .05]}/>
  </BVHRenderer>
</group>
```
