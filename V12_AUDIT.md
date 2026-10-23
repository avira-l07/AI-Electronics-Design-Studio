# v12 delivery and integration audit

Reviewed 24 October 2026. Scope: the six remaining-work tracks in the owner's screenshot. This report distinguishes implemented code, executed local checks and external acceptance that has not occurred.

## What changed

| Requested track | Implemented and checked | Still unfinished |
| --- | --- | --- |
| Team workflows across accounts/devices | Three independently authenticated accounts use the actual loopback FastAPI server and isolated SQLite database. Desktop and phone browser contexts exercise invitations, acceptance, presence, edits, conflicts, viewer restrictions and revocation. | These are synthetic local accounts and emulated viewports, not physical devices, real public accounts or a hosted PostgreSQL deployment. Cloud deployment remains on hold. |
| Simultaneous shared 3D editing | Dedicated shared 3D workspace with orbit navigation, live part selection/presence, transform/name/visibility editing and 2-second polling. Unrelated object edits merge under a project row lock. Same-object conflicts reject with 409 and preserve/download the draft. | No WebSocket/CRDT transport, shared geometry authoring, live drag gizmos, pointer cursors or joint-driven shared transforms. Geometry/joint edits stay in the owner workspace. The static hosted site cannot supply the account server. |
| Curves, constraints and CAD operations | Saved analytic circular arcs and quadratic Bézier definitions with bounded mesh tessellation; point/segment nonlinear constraint solver for fixed, horizontal, vertical, distance, coincidence, angle, equal length, parallel and perpendicular rules. Local-rank freedom/redundancy diagnostics. Picked triangle-face plane snapshots. Rectangle profile corner fillets/chamfers, open-top extrusion shells, parallel-section polyline sweeps and convex two-profile lofts. | Tangent/radius/concentric curve constraints and a general CAD solver, arbitrary 3D-edge fillets/chamfers, arbitrary-face shelling, curved path frames, multi-section/spline lofts, associative face references and STEP/BREP. |
| Manufacturing checks | Detailed triangle distance plus closed-shell containment screening, sampled wall thickness, conservative repair previews/copies, worst-case shaft/hole tolerance stacks, editable process limits and material/process evidence notes. Repair preserves originals and supports ordinary undo. | General self-intersection/union repair, guaranteed global minimum wall thickness, verified material properties, comprehensive GD&T/process validation and certification. |
| CAD/slicer and physical acceptance | Seven actual application export fixtures, each STL and OBJ, independently parsed with Trimesh. A downloadable 30 × 20 × 5 mm coupon with a 6 mm through-hole, acceptance JSON and instructions is included under Fit & mesh tools. | No installed CAD/slicer executable was found. No actual CAD/slicer toolpath, printer/machined part or physical measurement was tested. These gates remain explicitly unverified. |
| Expanded simulation/calculations | Added uniformly loaded simply supported beam, modified Goodman fatigue screen, steady plane-wall conduction/convection, RC low-pass/step response with frequency plot and constant-thrust tilted point-mass flight motion with ground-crossing detection. Explicit assumptions, units and JSON results. | Mesh-linked FEA, nonlinear/contact/buckling analysis, fatigue-life/spectrum prediction, transient thermal FEA/CFD, SPICE/nonlinear circuits, six-degree-of-freedom flight/control/propeller validation. |

## Important bugs and integration protections

- **Concurrent-account server stalls:** the request-rate database guard previously executed blocking database operations inside async middleware. Under real concurrent ASGI browser requests, SQLite lock waits could block the event loop needed to finish another transaction. The guard now runs in a thread pool. The actual multi-account browser test reproduces the original failure and passes after this fix; serial TestClient checks alone did not reveal it.
- **Lost shared work:** full-project optimistic saves remain version checked. Shared changes use complete before/after object snapshots, matching unique IDs and strict editable fields; stale snapshots cannot overwrite another user's part. A project lock serializes merges against ordinary owner saves. Joint-linked objects are rejected rather than silently breaking kinematics.
- **Authorization drift:** every shared read, edit and presence update rechecks authentication, active profile, membership/acceptance, role, owner status and Pro ownership where required. Viewer controls are disabled; the backend independently enforces restrictions. Terminal access errors stop presence and disable edits while retaining the draft.
- **Presence privacy/lifecycle:** display names and selected part IDs are returned only to authorized participants; email/device identifiers are not returned. Presence is keyed by project/session/tab, expires from display after 20 seconds, and stale rows are removed after 60 seconds on a subsequent pulse. Leave is best effort. Revocation, Trash and account deletion remove relevant presence; revoked sessions are filtered on read.
- **Shared/local autosave separation:** the shared scene does not enter the ordinary local project list/autosave. Closing tells owners to refresh their account workspace before further owner edits; version checks protect stale copies.
- **Invalid modelling data:** new curves, frames, constructions and constraints have bounded, mirrored JS/Python validation. Recipe fixtures generated through the real JS kernel also pass Python validation. Invalid paths, folded loft correspondence, nonorthogonal frames and consumed shell profiles fail without replacing saved geometry.
- **Changed curve vertex indices:** changing profile topology requires clearing analytic curves/constraints first. Saved curve definitions remain editable rather than being silently flattened.
- **Unsafe repair claims:** repair removes duplicate/degenerate triangles, welds within a bounded tolerance and consistently orients connected faces. Nonmanifold/nonorientable input is rejected. It does not invent missing faces, union components or repair intersections. Nested shells require orientation review. A repaired copy is a bounded imported mesh, not editable CAD history.
- **Overstated clearance/thickness:** full triangle distances include crossing edges and containment screening across disconnected components. Open meshes are labelled surface-only. Cost is capped at 300,000 triangle pairs. Wall checking samples at most 96 inward face-centre rays; it cannot certify that every local thin feature was detected.
- **Numerical/physical assumptions:** simulation inputs are finite/bounded, reported results reject non-finite values, negative absolute temperatures are rejected, and flight ground crossings invalidate later free-flight predictions. Fatigue strength must be entered for the chosen life/corrections; the app does not invent a fatigue-life curve from visual material names.
- **Theme contrast:** visual QA found the modeller's sticky header could use dark background with light-theme dark text. It now follows the active theme. Shared/review dialogs also use theme-aware surfaces and responsive controls.
- **Schema readiness:** migration 0004 adds presence without replacing projects. Migration, production health and deployment preflight agree on versions 0001–0004. Migration tests remove/recreate the presence table and verify repeatability and project preservation.

## Verification

- Full JavaScript regression suite passed, including actual Manifold kernel geometry and new numeric benchmarks.
- **108 API tests passed**, including role/downgrade/revocation/CSRF, object merge conflicts, presence expiry/deletion and JS/Python recipe parity.
- **52 desktop/phone browser cases passed**, including the actual loopback three-account workflow. A further 20 targeted browser cases passed after the final dialog/control changes.
- **14 export files passed** independent parsing: original custom solid, shell, sweep, loft, analytic corner profile, face frame and coupon, each STL and OBJ. Checks include watertightness, winding, positive volume and transformed millimetre/Z-up bounds.
- First-party JavaScript syntax and whitespace checks passed. An existing Starlette/httpx test deprecation warning remains. This pass does not claim an independent dependency/security audit or remote CI execution.

Repeat with `npm test`, `.venv/Scripts/python.exe -m pytest api/tests -q`, and `STUDIO_BROWSER_CHANNEL=chrome npm run test:e2e` on this Windows machine. CI uses installed Playwright Chromium. For independent parsing, install `tests/mesh-validation-requirements.txt` into `tmp/mesh-validator`, generate with `STUDIO_EXPORT_FIXTURES=1 node tests/assembly.cjs`, then run `python tests/check-exports.py`.

## Free/Pro and deployment

All new local CAD, manufacturing and analytical calculation tools remain Free. Pro owners manage up to ten collaborators; invited Free members may use the shared canvas according to their granted role. No new payment or provider activation occurred. Host/domain deployment remains explicitly held by the owner. The published Sites frontend is a device-local preview; publishing static assets does not deploy the FastAPI/PostgreSQL service or change the Site audience.

## Remaining acceptance gates, in order

1. When the owner supplies the host/domain: staged HTTPS/PostgreSQL/SMTP deployment, migrations, real-device/account tests, load/contention tests, monitoring and backup/restore rehearsal.
2. Actual CAD/slicer review plus a physically manufactured/measured coupon. Record software versions, material/process, instrument and chosen tolerances in the acceptance file.
3. Independent security review and production dependency/advisory/accessibility/performance checks, provider sandbox acceptance, final prices and commercial terms before paid launch.
4. General CAD kernel capabilities and richer collaborative geometry/joints.
5. Validated mesh-linked multiphysics, broader circuit solving and full flight dynamics.

## Formula/kernel references

- [Manifold CrossSection](https://manifoldcad.org/alpha/docs/jsuser/classes/CrossSection.html): section offsets and extrusion. The locally vendored 3.5.1 declarations and actual kernel tests are the implementation reference.
- [NASA fatigue analysis reference](https://ntrs.nasa.gov/api/citations/20230004376/downloads/20230004376.pdf): modified Goodman relation; application strength/correction inputs remain explicit assumptions.
- [MIT heat-transfer equation sheet](https://ocw.mit.edu/courses/2-051-introduction-to-heat-transfer-fall-2015/e32f70f7e00f34953447b606cea0421f_MIT2_051F15_EqnSheet_Q2_v3.pdf): conduction/convection resistance.
- [Analog Devices RC filter lab](https://wiki.analog.com/university/courses/engineering_discovery/lab_5): ideal RC cutoff/frequency response.
- [NASA NDARC theory](https://ntrs.nasa.gov/api/citations/20160012474/downloads/20160012474.pdf): ideal rotor momentum-theory basis; no claim of validated vehicle performance.

## Release security checklist and edge cases

- [x] Server authorization and owner-plan checks on shared requests; viewer edits, unknown/unaccepted/revoked members, owner downgrade and CSRF rejection tested.
- [x] Project locking/version checks and object snapshots; unrelated edits merge, stale same-object/full-project saves reject, invalid IDs/immutable fields reject, UI drafts remain downloadable.
- [x] Bounded finite declarative inputs, matching frontend/backend validation, no user executable geometry and worker time limits.
- [x] Presence expiry, closed-tab leave, session filtering, revocation, Trash and account-deletion cleanup; names escaped in UI.
- [x] Existing account/payment/auth regressions pass. No real secrets, providers or audience changes were introduced.
- [ ] Production PostgreSQL contention/load, physical devices/network interruption, independent security review, Python advisory review and backup restoration.

Additional staged edge cases to exercise: simultaneous owner geometry edits versus shared transforms; role/profile changes mid-request; provider/network outages and ambiguous successful saves; sleep/resume and many-device presence; very large assemblies within per-part limits; near-coplanar triangle geometry, nested shells, disconnected components and thin features missed between sample rays; nearly degenerate arcs, overconstrained sketches and loft correspondence changes; extreme real material/load inputs, experimental correlation, and manufacturing process drift. Local automated cases cover selected instances, not every physical or concurrent scenario.
