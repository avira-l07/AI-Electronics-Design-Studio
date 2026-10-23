# Engineering Studio — current delivery checklist

Reviewed 24 October 2026. Current evidence: [v12 audit](V12_AUDIT.md). Historical milestone reports remain in the repository. Completed means the bounded implementation below; it does not mean professional CAD or manufacturing certification.

## Delivered and locally verified

- [x] Local projects, recovery/Trash, backups, undo/revisions, BOM, reports and product navigation.
- [x] Editable custom solids, catalogue/drone concept assembly, imports/exports, personal part library, groups/alignment/measurement and fixed/hinge/slider joints.
- [x] Saved analytic arc/quadratic definitions with tessellation; bounded nonlinear point/segment constraints and local freedom/redundancy diagnostics.
- [x] Face-plane snapshots; rectangle profile corner fillets/chamfers; extrusion shells, parallel-section sweeps and convex two-profile lofts.
- [x] Manufacturing topology/mass checks, detailed triangle distances/containment screen, sampled walls, conservative repaired copies, worst-case fit and evidence exports.
- [x] Beam, shaft, thrust/energy, fatigue-screen, steady thermal, RC and constant-thrust point-mass motion calculations with explicit assumptions.
- [x] Shared 3D transform/name/visibility workspace with presence, unrelated-object merging, retained same-object conflicts and viewer restrictions.
- [x] Actual loopback three-account browser workflow, using isolated synthetic accounts and desktop/phone contexts. Fixed blocking database access in async rate-limit middleware.
- [x] 52 full browser cases, 108 API cases, all JS suites and 14 independently parsed STL/OBJ exports passed. A further 20 targeted browser cases passed after final dialog changes.
- [x] Additive presence migration 0004, schema-health/preflight agreement, role/revocation/expiry/privacy checks and portable recipe validation.
- [x] CAD/slicer/physical acceptance coupon, editable acceptance record and instructions.

## Held until owner supplies deployment details

1. HTTPS host/domain, PostgreSQL, SMTP and operational worker deployment. Do not provision while the hold is active.
2. Real-device/account cloud checks, PostgreSQL concurrency/load testing, monitoring and backup/restore rehearsal.
3. Stripe test account/prices and sandbox lifecycle acceptance; final commercial terms before explicit live enablement.
4. Live AI/OAuth configuration and provider/outage/budget acceptance.

## Remaining engineering work, in priority order

1. External CAD/slicer/toolpath review and physically manufactured/measured coupon, with chosen tolerances and material/process evidence. No suitable executable or physical equipment was available here.
2. Independent security/dependency review, production accessibility/performance and remote CI acceptance.
3. Richer collaborative geometry/joint authoring, live transform handles and transport/load improvements. Current shared edits are polled; joint-linked parts are protected from unsupported edits.
4. General curve constraints, associative face/edge references, arbitrary 3D fillets/chamfers/shells, curved-frame sweeps, multi-section lofts and STEP/BREP.
5. General intersection/mesh repair and union validation, guaranteed wall minima, material/tolerance/process validation.
6. Mesh-linked structural/thermal simulation, fatigue life/load spectra, broader nonlinear/SPICE circuit solving and full flight/control dynamics.
7. Cloud personal-part sync and project-persisted calculation/density inputs; current separate library/report exports remain the portable record.

No background implementation or deployment is implied by an unfinished item. Free/Pro scope is in [FREE_AND_PRO.md](FREE_AND_PRO.md).
