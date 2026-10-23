# Engineering Studio — priority and delivery checklist

Reviewed: 23 October 2026. Based on the current source, v9 modelling review and previous executed validation. This checklist does not claim a new test run.

Latest implementation: [v10 workspace review](V10_WORKSPACE_REVIEW.md). The five requested tracks now have a delivered, bounded implementation; expanded professional CAD remains separate.

Latest v11: see V11_AUDIT.md and FREE_AND_PRO.md. Cloud deployment is on hold by owner request. Live provider activation is pending infrastructure/merchant configuration.

## Current stage

Working browser-local engineering workspace and custom mesh-modelling alpha. The backend exists in source but is not deployed by the static site. Secure cloud accounts and real paid subscriptions are not operational on that site.

**Status meanings:** Complete = delivered within the stated limits. Partial = some implementation exists but the milestone is unfinished. Not started = remaining implementation. Awaiting owner decision/setup = needs product definitions or service configuration. Partial does not mean a background job or implementation is currently running.

## What we have completed

- [x] Product pages: landing, pricing, signup/login preview, dashboard, profile, upgrade, checkout simulation, confirmation, billing preview and Premium dashboard preview.
- [x] Local projects: search/filter/sort/pin, duplicate, JSON import/export, device backup, recoverable Trash, undo/redo and revision snapshots/compare/restore.
- [x] Workspace UI: responsive layouts, themes, density, reduced motion, keyboard navigation and workspace search.
- [x] Engineering basics: ideal slider-crank motion and ideal DC series/parallel resistor calculations, plots and reports; BOM editing/CSV and planning costs.
- [x] Basic 2D sketch objects, layers and descriptive dimensions; SVG/DXF export.
- [x] 3D assembly: 32 catalogue entries, parametric parts, mouse/numeric movement and rotation, snapping, visual materials, visibility, cameras, exploded view and BOM sync.
- [x] Custom mesh solids: original polygon profiles/exact vertices, three work planes, extrusion, box/cylinder cuts/unions/intersections, holes/pockets/bosses and editable feature history.
- [x] Custom-solid preview volume/surface area, guarded rebuild worker, saved recipes and recovery from invalid edits.
- [x] Multi-select, persistent groups/shared transforms, alignment and world/picked-point measurements.
- [x] Bounded STL/OBJ import and a personal reusable-parts library with its own portable backup.
- [x] Basic sketch constraints/sampled curves, revolve/taper/twist, mirror/linear pattern and fixed/hinge/slider joints.
- [x] Six starters including the 120-component drone concept and custom solid modelling; STL/OBJ mesh export.
- [x] Backend implementation and local tests for accounts, sessions, profiles/quotas, authorization, project persistence, Stripe lifecycle, notifications, admin tools, optional AI explanations and read-only sharing. Delivery of this code does not make these services live.

The drone is a packaging concept. Materials are primarily visual. Mesh exports and calculations are not manufacturing or flight certification.

## What is partially complete

| Workstream | Already available | What remains | State |
| --- | --- | --- | --- |
| Custom CAD | Extrusion/Boolean history, grouping/alignment/measurement, basic constraints/curves, revolve/taper/twist/mirror/pattern and simple joints | General sketch solver, analytic curves, face-based planes and richer CAD/assembly operations | Partial; v10 batch delivered |
| Parts and interchange | Catalogue/recipes, STL/OBJ export, bounded STL/triangulated-OBJ import and personal library | More formats, sourced manufacturer parts, nested subassemblies and external compatibility checks | Partial; v10 batch delivered |
| Accounts and cloud | API, database models, security controls, deployment configuration | Real deployment, email/OAuth acceptance, cross-device acceptance and operations | Partial; awaiting service setup |
| Billing | Preview screens and Stripe backend adapter | Owner-defined paid capabilities/prices, entitlement gates and actual provider lifecycle testing | Partial; awaiting owner decisions/setup |
| AI and sharing | Optional explanation API and read-only snapshot endpoint | Live provider/deployment acceptance; geometry generation and collaborative editing | Partial; advanced features not started |
| Quality and release | Local API/JavaScript suites and interactive browser checks | Full browser runner/CI, production database/TLS/load/accessibility checks and independent review | Partial |

The v10 implementation delivers the requested first batch. No background implementation job is running after delivery; remaining milestones require further work.

## What to do next, in preference order

| Order | Deliverable | State | Completion gate |
| --- | --- | --- | --- |
| 1 | Finish the release verification baseline | Local full suite executed; remote CI remains | Run the full desktop/phone browser suite and CI; verify representative custom-part and drone save/reopen/undo/export flows; record results and fix failures. |
| 2 | Add practical assembly editing: multi-select, group, align and measurement | Delivered in v10 within documented limits | Multiple parts move together predictably; alignment and measurements use explicit units; undo, revisions and reload preserve results. |
| 3 | Add custom STL/OBJ import and a reusable personal parts library | Delivered in v10 within documented limits | Bounded file/triangle sizes, explicit units/orientation, malformed-file recovery, persistent imported geometry and reliable duplicate/export behavior. |
| 4 | Improve sketch-driven modelling | Basic constraints and sampled curves delivered; broader CAD remains | Add arcs/curves, dimensional/geometric constraints and face-based work planes incrementally; edits regenerate saved models with actionable errors. |
| 5 | Expand solid and assembly tools | Revolve/taper/twist/mirror/pattern and simple joints delivered; broader CAD remains | Deliver mirror/pattern and revolve first; then separately scope sweep/loft, chamfer/fillet/shell, part-to-part Booleans, mates and collision/clearance checks. Validate each operation before claiming support. |
| 6 | Validate engineering properties and manufacturing handoff | Mesh screening, mass/centroid estimates and independent STL/OBJ parser checks delivered; process/material acceptance remains | Add density-based mass/centre of mass and tolerances; mesh diagnostics and actual external slicer/CAD import checks. Decide the exact BREP/STEP architecture separately. |
| 7 | Activate a private cloud beta | On hold at owner request; host/domain pending | Deploy API/PostgreSQL/HTTPS and worker; verify real auth/email/OAuth, profiles, cross-device saves, conflicts, migrations/rollback and backup restoration. Establish monitoring and alerts. |
| 8 | Make the premium product operational | Free/Pro split and backend gates implemented; prices/provider activation pending | Define paid engineering capabilities/prices/limits, enforce entitlements on the server and verify actual checkout, webhook ordering/duplicates, renewal/failure/cancellation/refund and invoice/receipt flows. |
| 9 | Expand useful engineering calculations | Beam/shaft/drone analytical models delivered; broader validated simulation remains | Add load/torque/motor sizing and drone thrust/power/endurance with explicit assumptions and benchmark cases. Broader mechanisms and circuit connectivity follow. |
| 10 | Add live AI and team workflows | Guarded modelling proposals and in-app teams implemented locally; live services/shared canvas remain | Acceptance-test existing AI explanations/shares, then add validated prompt-to-model previews/rollback, invitations, roles and comments. Real-time concurrent editing needs a separate conflict strategy. |
| 11 | Scope larger platform tracks separately | Not started | Validated FEA/thermal, full circuit simulation, PCB design, flight dynamics, verified manufacturer libraries and marketplace/public gallery each need an agreed scope and independent validation. |

Order 7 service provisioning can proceed alongside CAD work when infrastructure is available. Order 8 depends on cloud acceptance and the owner's paid-feature choices. Order 11 is optional expansion, not a prerequisite for a useful modelling beta. Publishing/access changes remain with the owner.

## Next modification batch

The requested first batch is implemented. Next priorities within CAD are richer curve/constraint editing and face-based work planes, then selectively validated fillet/chamfer/shell/sweep/loft, nested subassemblies and better joint references. Manufacturing compatibility and remote CI remain separate verification work.

## Evidence and boundaries

Latest v11 validation: **40 desktop/phone browser tests passed**, **all JavaScript suites passed**, and **104 API tests passed**. Independent STL/OBJ parser checks also passed. Coverage includes the original flows and new group/measurement/import/library/constraint/solid-operation/joint workflows. Remote CI remains unverified. See V10_WORKSPACE_REVIEW.md for limits.

Real payment/email/OAuth/AI calls, production PostgreSQL/container/TLS acceptance and backup restoration are not proven by mocked/synthetic local tests. No overall completion percentage or delivery date is assigned because the remaining scope contains separate CAD, infrastructure and engineering projects.

Details: [Project status and roadmap](PROJECT_STATUS_AND_ROADMAP.md), [v9 modelling review](V9_MODELLING_REVIEW.md), [API validation](api/VALIDATION.md), [deployment guide](deploy/README.md).
