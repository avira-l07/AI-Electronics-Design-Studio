# 3D workspace review and corrections — v8.1

Reviewed the supplied v8 implementation on 22 October 2026. Its original `npm test` command did not exercise the 3D editor. Syntax checks could not detect the runtime, persistence and geometry bugs below.

## Corrected

- Replaced removed Three.js global/CDN build URLs and custom orbit implementation with pinned, same-origin Three.js 0.161.0 ES modules and official OrbitControls. Vendored source retains the MIT license; `npm run vendor:3d` recreates the files/schema.
- Registered the 3D tool before API-mode boot so direct `#/workspace?tool=3d` links work. Added a dashboard shortcut and guide entry.
- Added a bounded portable assembly model: `assembly3d` version 1, millimetre positions/dimensions, degree rotations, at most 200 objects, finite input and relational dimension checks. Only catalogue geometry identifiers can be built. The API validates the same catalogue/schema.
- Assemblies now use ordinary project persistence, versions, undo/redo, snapshots, duplicate/import/export, backups and Trash. A separate untracked localStorage scene is no longer the source of truth. Valid legacy scene keys are converted on opening their 3D editor and retained unchanged. Open a legacy scene once before backing it up as a portable project. Invalid legacy data is not overwritten and can be downloaded for recovery.
- Missing and explicitly empty scenes both clear the previous project's objects. Empty scenes no longer resurrect old parts. Scene switching validates/builds before replacing the displayed objects.
- Canvas reattachment retains a renderer through ordinary tool changes, stops rendering off-screen and disconnects old resize observers. Async entry is checked against the project and current tab. Keyboard bindings no longer accumulate; shortcuts are inactive in account pages, forms and dialogs. WebGL loss is handled explicitly; hardware contexts cannot be guaranteed never to be lost.
- Added a transform root so mesh-local construction offsets survive placement/rebuilding. Preserved visibility and wireframe after rebuilding. Material changes include optical roughness/metalness; they do not provide a physical material model.
- Added bounded numeric transforms and integer tooth limits. Invalid rebuilds retain the existing geometry. Camera presets now work with official controls. Fit assembly frames visible parts, including larger/off-origin geometry.
- Bearings, bushes, pulleys, couplers and hex nuts now have actual central openings. Box beams have a hollow cross-section. Gears use a continuous extruded illustrative tooth outline with a bore, rather than intersecting tooth boxes and a filled centre. These are not involute gear calculations or manufacturer-certified components.
- Corrected sketch-to-3D scaling and rectangle-centre placement. Extrusion preserves input dimensions rather than silently increasing them. Rectangles use an 8 mm default depth; circles use 25 mm. Unsupported sketch entities are skipped and excessive/invalid input is rejected before adding a partial extrusion.
- Made BOM sync idempotent. Dimension/material variants remain separate, matching entered prices survive, and manually entered rows are retained. Clearing 3D-generated BOM lines works without deleting manual rows. Repeated sync no longer increments counts.
- Explode is a display aid. Saved positions and exports remain assembled. New insertion avoids initially overlapping existing parts. Deletion/Clear are recoverable through project undo and saved revisions.
- Corrected STL/OBJ scene-unit conversion (previously 10× too small), declared millimetres and Z-up, retained world transforms, sanitized OBJ group names, and exported visible parts only. Rendering controls and overlays are excluded.
- Rebuilt mobile grid placement, added accessible part buttons and labels, improved low-contrast text, compacted phone controls and retained a 360px-high phone viewport. Full backup imports allow up to 20 MB to accommodate pretty-printed assemblies/revisions.

## Executed validation

- **47 API tests passed**, including 3D creation/update/empty-scene round-trip, revision preservation, export, all catalogue defaults and malformed/unbounded input rejection. One existing Starlette/httpx deprecation warning remains.
- `npm test` passes, including all existing checks and new 3D tests using the shipped Three.js geometry implementation. Those checks cover all 20 finite meshes, real centre openings, millimetre/Z-up export extents, local mesh offsets, explosion isolation, project/empty-scene isolation, BOM variants/prices/idempotency, sketch extrusion placement, non-overlapping insertion, corrupt legacy data, snapshots and keyboard cleanup.
- All first-party JavaScript passes syntax checks; whitespace checks pass. The installed npm dependency audit reported zero advisories at installation time; this is not a security guarantee.
- Interactive browser validation confirmed WebGL initialization from local modules, insertion, dimension rebuilding, exact placement, tool switching, undo/redo, reload persistence, new-project isolation, camera framing and a 390px phone layout without document-wide horizontal overflow. No JavaScript errors were reported in the final reviewed page.
- Standalone Playwright coverage now discovers 16 desktop/phone cases. Source/discovery was checked; that runner and remote CI execution were not run locally.

## Limits and deployment

These are editable **concept meshes**, not a full CAD kernel or fabrication package. Some multi-mesh components retain intersecting surfaces; exports have not been Boolean-unioned, certified watertight, or tested in external slicers/CAD applications. Threads, involute tooth accuracy, tolerances, manufacturer-specific fits, constraints/mates, structural/thermal simulation and STEP/BREP export remain future work. Validate and repair an exported mesh as necessary before manufacturing.

The hosted Sites publication serves browser-local mode. Server-mode assembly persistence is implemented/tested in the Python API but needs its separate production deployment. Existing site audience is preserved; no hosting visibility, payment setting or premium entitlement was changed.
