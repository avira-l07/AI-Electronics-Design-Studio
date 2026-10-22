# Engineering Studio: status and remaining work

Reviewed on 23 October 2026 against the current source, prior executed checks, and deployment records. This report does not claim new test execution or production certification.

## Current position

The product is a working engineering concept-workspace prototype. It has real local project workflows, a limited 3D assembly editor and selected engineering calculators. It now includes a first custom mesh solid modeller. It is not yet a complete CAD application or an operational paid cloud service.

Three different states must stay distinct:

- **Working in the hosted frontend:** browser-local projects, concept tools and product interface.
- **Implemented in source and tested locally:** the Python API, authenticated cloud persistence, security controls and payment-provider adapters.
- **Not built or not operationally verified:** general CAD modelling, broad engineering simulation, live production services and paid engineering capabilities.

The hosted static publication does not run the Python backend. Hosting access control is separate from application accounts. Local preview URLs beginning with 127.0.0.1 require the local server to be running.

## Working frontend

- Landing, signup/login preview, dashboard, profile, pricing, upgrade, checkout simulation, confirmation, billing preview and Premium dashboard preview.
- Project library with search, filters, sorting, pins, duplication and project exports.
- Five starters: slider-crank, DC resistor, enclosure, actuator brief and quadcopter assembly.
- Browser-local project storage, JSON import/export, device backups, recoverable Trash and restoration.
- Edit undo/redo, saved revision snapshots, comparison and restoration.
- Research/evidence notes and change-dependent staleness markers.
- BOM editing, CSV exports, unquoted component prices and batch planning costs.
- HTML reports, SVG/DXF sketch export and motion CSV export.
- Themes, accents, density preferences, reduced motion, workspace search, keyboard navigation and responsive layouts.

The static account screens do not provide secure user identity. Checkout records are simulations; they do not grant paid access. Browser storage does not provide cross-device synchronization.

## Working engineering and 3D scope

- Ideal slider-crank displacement, velocity and acceleration calculations with playback, angle controls, configurable samples and plots.
- Ideal DC series/parallel resistor-network calculations with current, voltage, resistance and power results.
- Sketch rectangles, circles, lines, labels, dimension annotations, layers, selection, movement, resizing and individual deletion. Dimensions describe geometry; they are not geometric constraints.
- A WebGL assembly editor with 32 catalogue entries including custom solids, orbit/pan/zoom, fitted camera presets and part selection.
- Per-part dimension rebuilding, numeric position/rotation, visual material choices, visibility, wireframe, duplication and deletion.
- Rectangles and circles can become simple 3D solids through extrusion.
- Temporary exploded views, project-integrated scene persistence and idempotent BOM synchronization.
- STL/OBJ reference-mesh exports in millimetres and Z-up coordinates.
- A 120-component quadcopter concept with six cumulative assembly previews, stage-grouped part tree, two frame plates, four arms, landing feet, four motors, alternating propellers, electronics, a battery, straps and individual hardware.

Assemblies currently allow at most 200 objects. Material choices mainly affect appearance. Parts have illustrative geometry, not verified manufacturer fits or physical material properties. Mesh export is not STEP/BREP export, and exported assemblies are not guaranteed Boolean-unioned or watertight. The drone is a packaging concept without flight dynamics, wiring connectivity or structural validation.

## Backend source that is not live on the static site

- FastAPI, SQLAlchemy and relational models; SQLite for development/tests and PostgreSQL deployment configuration.
- Argon2id passwords, email verification, expiring password reset, short-lived JWT access cookies and rotating opaque refresh cookies.
- Revocable sessions/devices, logout everywhere, TOTP/recovery codes and a Google OIDC adapter.
- Request validation, ownership checks, CSRF controls, security headers, rate limits, lockout, audit records and login-alert queues.
- Account-owned profiles and projects, Free/Premium profile quotas, update-version conflicts, Trash and restoration.
- Stripe checkout/portal adapter, signed webhook processing, idempotency, subscription state transitions, expiry, cancellation, refund handling, trial/coupon integration and provider invoice links.
- Notifications, account export/deletion, admin search, bans, recorded revenue summaries and audit export.
- Optional AI explanation endpoint and expiring/revocable read-only share snapshots. Both default off.
- Migrations, Docker/Compose/Caddy configuration, a separate mail/reconciliation worker and CI workflow source.

An adapter or deployment file is not evidence that its external service is running. Paid billing remains disabled by default. No production SMTP, Google, Stripe, OpenAI, PostgreSQL, backup job or monitoring system is established by the static publication.

## Custom solid milestone delivered

The v9 update delivers closed polygon drawing/exact vertices, grid snapping, XZ/XY/YZ work planes, editable extrusion depth, cylindrical/box cutting tools, through-holes, pockets, union/intersection, editable/suppressible/reorderable feature history, preview volume/surface area, saved recipes, and mouse move/rotate handles with 1 mm / 15 degree snapping. Rebuilding runs in a dedicated worker with input, feature, triangle and time limits. A sixth starter demonstrates the workflow. See V9_MODELLING_REVIEW.md for validation and boundaries.

## Remaining 3D modelling work

**Delivered first modelling milestone:**

1. Closed polygon profiles and exact vertex editing, with invalid-profile feedback. Arcs and connected curve sketches remain future work.
2. XZ/XY/YZ work-plane selection. Selecting arbitrary faces/planes remains future work.
3. Extrusion with user-entered depth and direction; edit the originating sketch and regenerate the result.
4. Holes, pockets and solid union/subtraction/intersection.
5. Mouse move/rotate handles and snapping. Alignment, multi-selection and grouping remain future work.
6. A dependable feature/operation history whose edits rebuild later geometry.
7. Tests and recovery for invalid geometry, failed operations and saved-model compatibility.

**More advanced CAD scope:** revolve, sweep, loft, fillet, chamfer, shell, mirror/pattern, constrained sketches, assembly mates/joints, collision/clearance checks, measurement tools, physical materials, volume/mass/centre of mass and tolerances.

A browser-friendly modelling-kernel strategy must be selected and validated before promising robust CAD operations or exact CAD interchange. Mesh modelling and exact solid modelling have different capabilities. A full professional CAD replacement is a much larger scope than the first modelling milestone.

## Remaining component/library work

- Reliable custom mesh import, file/geometry limits, orientation/units handling and saved imported assets.
- Manufacturer-specific parts with source, licensing, dimensions and revision metadata.
- Searchable/user-owned parts, reusable subassemblies and editable component variants.
- Broader export/import compatibility, including a validated path for STEP/BREP if exact modelling is adopted.
- Mesh diagnostics/repair and external slicer/CAD acceptance tests.
- Performance work for larger assemblies; lifting the 200-object cap safely needs benchmarks and memory/rendering strategies.

## Remaining engineering tools

- Mechanisms beyond the existing slider-crank model and a general mechanism/joint representation.
- Loads, force, torque, motor/actuator sizing and efficiency calculations with explicit assumptions.
- Structural, thermal and other simulation only after selecting and validating appropriate solvers.
- Drone thrust/power/endurance/mass calculations and actual component selection; flight simulation is separate work.
- General schematic capture, electrical connectivity, broader component models and simulation, AC/transient analysis and motor-control workflows.
- Verification of units, solver validity, convergence, benchmark cases and engineering reports for each new calculation.

FEA, PCB design, flight simulation and general circuit simulation are separate major feature tracks. They are not prerequisites for an initial lightweight modelling release unless explicitly included in its scope.

## Remaining cloud and operational work

- Deploy a compatible API runtime and PostgreSQL behind the intended same-origin HTTPS frontend.
- Configure environment secrets, domains, trusted proxy settings and production cookies/headers.
- Rehearse migrations and rollback/recovery, PostgreSQL concurrency and failure cases.
- Establish real mail delivery and run/monitor the mail and reconciliation worker.
- Run actual Google sign-in and recovery flows with the configured provider.
- Verify cloud project save/load, multi-profile switching, quotas, version conflicts and cross-device use in staging.
- Schedule encrypted database backups and prove restoration; define retention and account-deletion behavior.
- Add error monitoring, performance metrics, operational alerts, logs and incident/secret-rotation procedures.
- Execute the standalone browser suite and CI in the real release environment; run load/accessibility/compatibility checks and independent security review.

## Remaining AI, sharing and teams

- Configure and test live AI explanations, provider failures, quotas, privacy controls and operating cost limits.
- AI-driven geometry creation/editing is not implemented. It needs structured modelling commands, validation, previews, rollback and clear provenance.
- Deploy and acceptance-test the existing read-only snapshot-sharing code.
- Invitations, memberships, per-project roles, comments, review/approval, presence, real-time multi-user editing and merge/conflict handling remain to build.
- Public galleries, embeds and marketplace/discovery workflows remain optional future product work.

## Remaining paid-product work

- Define the actual premium engineering features, plan limits, prices and trial terms. No premium feature set has been invented on the owner's behalf.
- Enforce every selected paid engineering capability at the appropriate backend boundary.
- Confirm provider/merchant availability and test actual checkout, verification-required and asynchronous payments, webhooks, duplicate/out-of-order events, renewals, expiry, failed payments, cancellation, refunds and the billing portal.
- Approve the product's invoice/tax, cancellation/refund, privacy, retention and support policies for the actual business.
- Validate receipts, notifications, coupons/trial eligibility and account-to-subscription reconciliation in staging.
- A Razorpay option would be additional implementation and validation; the current adapter is Stripe.

## Evidence and limits

The latest executed checks passed 66 API tests and the JavaScript calculation, template, recovery, save-flow and 3D geometry suites. Interactive browser checks covered creating the drone, stage controls, views, dimensions, undo, selected-project reload and saving a revision. The last reviewed geometry suite covered all 32 catalogue entries, motor screw/arm hole alignment, propeller-envelope separation, preview isolation, export and BOM behavior.

Provider calls in tests were mocked or synthetic. PostgreSQL/container/TLS production behavior, live payments/email/OAuth/AI, restore exercises, the standalone browser runner and remote CI were not established as passing by those results. Dependency audit records are historical snapshots, not ongoing guarantees.

## Recommended sequence and release gates

1. **First modelling alpha delivered:** sketch profile → extrude → hole/cut/union → edit → save/reload → export. Test complete user projects rather than only preset assembly.
2. **Usable CAD workflow:** transform handles/snapping, geometry history, measurement, reusable/imported parts and dependable export. Expand advanced operations selectively.
3. **Private cloud beta:** deploy/test accounts, PostgreSQL project storage, email, provider integrations, backups and monitoring. Existing backend code reduces the implementation work but does not replace staging acceptance.
4. **Paid release:** approved premium scope and pricing, server-enforced entitlements, actual payment lifecycle verification, release QA and operating/support policies.
5. **Advanced engineering platform:** validated simulation, richer electronics, AI modelling and collaboration in separately scoped increments.

A precise completion percentage or calendar estimate is not supported by the current scope. Finishing UI routes is a different amount of work from building a geometry kernel integration or validated simulation. The honest milestone is: functional concept prototype and first mesh modelling alpha achieved; a broader CAD workflow and operational paid release remain ahead.
