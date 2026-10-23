# v10 — assembly editing, imported parts and richer mesh modelling

Implemented on 23 October 2026. This is a bounded extension of the existing modeller. It does not complete the full professional CAD roadmap or activate cloud accounts/payments.

## Requested work and delivered behavior

| Request | Delivered | Boundary |
| --- | --- | --- |
| Run the full browser suite and fix failures | Replaced the Python test server that timed out on this machine with a bounded Node static server; corrected CI dependency-install ordering; expanded desktop/phone acceptance coverage. | Local execution is verified separately from remote CI. |
| Multi-select, grouping, alignment and measurement | Individual tree checkboxes, Ctrl/Shift selection, group selection, persistent groups, batch movement, shared mouse Move/Rotate pivot, duplicate/delete groups, align min/centre/max to the last-selected reference, world bounds, centre distance and two picked surface-point distance. | Groups are editing sets, not nested subassemblies. Bounding-box separation is labelled and is not an exact surface-clearance calculation. Point measurements are temporary. |
| STL/OBJ import and reusable personal parts | ASCII/binary STL and triangulated OBJ import; explicit source units/up axis; centred/base placement; saved triangle geometry, scale, duplication, project undo/revisions/backups and exports. A separate personal library saves catalogue/custom/imported parts, inserts copies and imports/exports its own JSON backup. | No CAD feature recovery from imported meshes. OBJ faces must be triangulated. External materials and links are ignored. Personal library is device-local and has a separate backup. |
| Improve sketches with curves and constraints | Sampled quadratic Bézier edge tool; horizontal, vertical, edge-length and fixed-vertex constraints with bounded projection solving, residual checks and conflict rejection. Constraints are saved with custom-solid recipes. | This is the custom-solid profile editor, not a rewrite of the separate SVG Sketch tab. Curves become editable polygon vertices. No analytic spline/arc history, general dimensional solver or face-based planes. Clear constraints before changing vertex topology. |
| Advanced solid operations and assembly joints | Revolve, tapered/twisted extrusion, mirror and linear patterns using the actual mesh kernel. Fixed, hinge and slider joints store parent-local rest poses and limits, propagate parent movement and reject cycles/duplicate parents. | Hinge pivots at the parent origin; slider uses its local axis. Kinematic posing only, without force/contact/dynamic simulation. Fillets/chamfers/shells, general sweep/loft, arbitrary part-to-part Booleans and exact STEP/BREP remain open. |

## Where to use the features

- **3D Editor → Import STL / OBJ** or **My reusable parts**.
- **Assembly tree** checkboxes select individual objects. Ordinary group selection selects its members; Alt-click selects one member. The last selected part is the alignment reference.
- **Assembly tools** contains group/ungroup, millimetre batch offsets, alignment, measurements and Save part to library. Mouse Move/Rotate handles use a shared pivot for a multi-selection.
- **Joints**: select parent first and child second, choose fixed/hinge/slider and a local axis, then create. Hinge/slider limits must include the initial value zero. Adjust its value to pose the assembly. Remove a joint to move its child independently.
- **Draw your own 3D part / Edit profile & features**: expand Base operation, Sketch constraints & curved edge, or Mirror & linear pattern.
- For a revolve, draw a radial profile using U ≥ 0; V is axial height. The resulting axis is W, mapped by the chosen work plane. Existing through-all tools must be changed to finite-depth tools before revolving.

## Limits and persistence

- Existing projects remain compatible; assemblies still use version 1 with optional bounded mesh/group/joint fields.
- Existing limits: 200 assembly objects; 3–64 profile vertices; 16 box/cylinder features.
- New limits: 32 sketch constraints; four solid modifiers; 2–8 instances per linear pattern and at most 32 combined instances.
- Imports: 2 MiB source files, 6,000 nondegenerate triangles per part, 12,000 imported triangles per assembly; source units mm/cm/m/in and Y/Z up. Mesh coordinates must fit within ±5000 mm after conversion/centering. Imported scale is 0.1–20.
- Personal library: 24 entries, 12,000 imported triangles total and 2 MB serialized JSON. Invalid/corrupt saved library data is preserved and can be exported before replacement.
- Project recipes, meshes, groups and joints are validated at both frontend and API boundaries. No executable user expressions, external mesh resources or scripts are evaluated.
- Oversized duplication, malformed geometry, joint cycles, missing endpoints and out-of-range poses are rejected. Deleting a part removes its joint links and cleans groups with fewer than two members.
- Browser storage capacity and the API's existing 1 MiB request limit remain relevant, especially with mesh-heavy revisions. Export projects/libraries and prune snapshots when needed. The static publication still uses browser-local project storage.

## Verification

**Final local results:** all 32 desktop/phone browser tests passed; all JavaScript suites passed; 92 API tests passed (one existing Starlette/httpx deprecation warning). The final browser run includes the original 20 cases plus 12 new desktop/phone cases. Remote CI was not executed here. Coverage added for this release includes:

- Real kernel revolve volume, tapered-frustum volume, twisted-extrusion volume, mirror/pattern behavior and instance limits; the existing actual cut/union/intersection and legacy-recipe suites remain in place.
- ASCII/binary STL, negative OBJ indices, units/orientation, malformed indices, nontriangular OBJ faces, invalid coordinates, degenerate triangles, size limits and imported-geometry round-trip.
- Solved constraint residuals, fixed points, conflicting constraints, sampled curve vertices and invalid saved constraint data.
- Group movement/duplication/deletion, reference alignment, fixed/hinge/slider propagation, endpoint cleanup, cycle rejection and oversized mesh duplication without mutation.
- Browser workflows on desktop/phone for group movement/undo/reload, actual picked surface measurements, mesh import/personal-library insertion, constrained curved profiles/modifiers, revolve and joint values/limits.
- API project/snapshot/account-export round-trip for imported geometry, groups and joints, plus malformed payload rejection.

Remote CI, real production infrastructure/provider acceptance, external slicer/CAD acceptance and independent security review are still separate release gates.

Implementation: `dist/studio-3d.js`, `dist/mesh-parts.js`, `dist/sketch-constraints.js`, `dist/solid-model.js`, `dist/solid-editor.js`, matching API validators and regression tests.
