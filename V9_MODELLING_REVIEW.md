# Custom solid modelling — first modelling milestone

Implemented and reviewed on 23 October 2026. The existing Site audience is preserved. This update completes a bounded custom mesh-modelling workflow; it does not complete the entire engineering-platform roadmap.

## What users can do

- Create an original closed polygon by clicking vertices on the profile canvas, with optional grid snapping. Select, move and remove vertices, enter exact U/V coordinate pairs, and resize the profile. Rectangle, circular polygon and L-profile starting outlines are also available.
- Choose XZ, XY or YZ work planes and enter the extrusion depth. U/V describe the profile; W is its extrusion direction. The XZ profile uses +U = +X and +V = -Z, with extrusion along +Y.
- Add cylindrical or box-shaped tools with subtract, union and intersection operations. Through cuts follow the base extrusion depth; positioned finite-depth tools support pockets and bosses. Tools have dimensions, position and rotation.
- Edit, suppress, reorder and remove up to 16 features without flattening the saved model. Base profiles support 3–64 vertices.
- Inspect the rebuilt solid in a separate orbitable preview with geometric volume, surface area and triangle count. A failed draft retains and labels the last valid preview. The original assembly part remains unchanged until a successful save.
- Add the result to an assembly, edit the recipe later, duplicate it, undo changes, save revisions, back up/import/export and regenerate it after reopening.
- Use mouse Move/Rotate handles with optional 1 mm translation and 15-degree rotation snapping. Numeric transforms remain available. Drag completion saves a recoverable project edit; helpers are excluded from mesh exports.
- Use the new Custom solid modelling starter: an original profile, two through-holes and a raised union boss. There are now six starters and 32 library entries.

The main entry is **3D Editor → Draw your own 3D part**. Selecting a custom solid exposes **Edit profile & features**. The Design page for a modelling starter explains the model instead of showing an empty sketch or unrelated mechanism.

## Implementation

- `dist/solid-model.js`: bounded declarative recipes, polygon validation, recipe fingerprinting for BOM variants, kernel evaluation, geometry conversion and worker client/cache.
- `dist/solid-editor.js` and `.css`: draft editor, profile drawing, feature history, preview and guarded asynchronous save.
- `dist/solid-worker.js`: DOM-free geometry worker with a 20-second startup/rebuild limit and failure handling.
- `dist/vendor/manifold/`: pinned Manifold 3.5.1 JS/WASM with its Apache 2.0 license. `scripts/vendor-solid.cjs` recreates these files from the lockfile installation.
- `dist/studio-3d.js`: assembly persistence, custom recipe rebuilding, same-project checks after async work, editor integration and official Three.js transform controls.
- `api/solid_data.py`: matching structural and polygon validation. The API stores recipe data; it does not execute client scripts or run the geometry kernel.

Recipes extend assembly records only for `custom_solid`. Ordinary catalogue records cannot carry arbitrary model data. Unknown fields, non-finite coordinates, crossed/touching outlines, duplicate feature IDs, invalid operations, unsupported dimensions and excessive feature counts are rejected. The existing assembly/project bounds still apply. Geometric evaluation can additionally reject empty or failed Boolean results.

The model is rebuilt from its recipe; rendered mesh data is not the persistence source. Custom BOM variants include a bounded fingerprint of the geometric recipe. Feature labels/IDs do not reset an otherwise matching quoted price. Browser worker cache buffers are copied before Three.js scales or renders them.

## Script policy and worker isolation

The packaged engine generates bindings at runtime. It runs only inside the dedicated worker. In API mode, the ordinary page retains `script-src 'self'`; JavaScript eval and WebAssembly eval are not added to the page policy. Only `/solid-worker.js` receives the scoped worker policy needed by the engine. The worker loads same-origin assets and accepts validated recipe data, not executable user text. Manifold objects are explicitly deleted after evaluation.

This is not a general security certification. Worker containment, validation and limits reduce exposure; dependency updates, fuzzing, wider performance testing and independent review remain appropriate release work. A terminated worker preserves saved recipes and previously built models; the next request can restart it.

## Executed verification

- **66 API tests passed**, including custom-solid project/snapshot persistence, malformed recipes, catalogue/model separation and main-page versus worker script policies. The existing Starlette/httpx deprecation warning remains.
- All JavaScript suites passed. The actual shipped kernel is tested for extrusion volume, through holes, pockets, union/intersection volumes, feature suppression, both polygon windings, all work-plane orientations and closed indexed topology on a cut solid.
- Tests cover invalid outlines and limits, failed-operation isolation, geometry-specific BOM variants, recipe duplication and assembly round-trip, exported object counts and worker-cache scale preservation.
- All first-party JavaScript passed syntax checks. Git whitespace checks passed.
- Interactive browser verification used a local server with a strict main-page script policy. It covered a starter with actual cut/union geometry, editing a hole from 8 to 10 mm, saving/reloading its feature, a snapped 16 mm mouse translation and undo, and a new six-vertex hand-drawn L-profile extruded to 16 mm with a through-hole. The original hand-drawn part regenerated after save/reload.
- Browser suite source now discovers 20 desktop/phone cases. Discovery was checked; the standalone runner and remote CI were not executed here. This is separate from the interactive browser checks.

## Remaining work

This is mesh solid modelling, not an exact BREP/STEP CAD implementation. Circular profiles/tools are polygon approximations. The feature system edits each custom part; it does not yet perform Booleans between arbitrary existing assembly parts or imported meshes. Multiple disconnected solid regions can result from a union.

Arcs/splines, constrained sketches, arbitrary face-based work planes, revolve/sweep/loft, fillets/chamfers/shells, patterns, assembly mates, multi-selection/grouping/alignment, custom file import, STEP export, physical materials/mass, simulation, and external manufacturing acceptance remain future work. STL/OBJ export retains its mesh-format limitations and is not fabrication certification.

Cloud backend deployment, real email/Google/Stripe/AI acceptance, premium definitions, team collaboration, production monitoring/backups and the broader electronics/engineering roadmap remain open. See `PROJECT_STATUS_AND_ROADMAP.md`.

## Upstream references

- [Manifold geometry library](https://manifoldcad.org/docs/html/)
- [Manifold WASM source and bindings](https://github.com/elalish/manifold/tree/master/bindings/wasm)
- Three.js 0.161.0 official OrbitControls/TransformControls source, shipped locally with the existing MIT license.
