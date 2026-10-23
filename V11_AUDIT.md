# v11 implementation and integration audit

Reviewed 23 October 2026. This is a source review plus local automated validation, not independent security, engineering or production certification.

## Delivery status

1. **Manufacturing handoff: implemented and locally checked.** Inspect & mass screens visible assembled meshes for boundary/nonmanifold/inconsistent edges, degenerate/duplicate triangles and orientation. Closed, single-mesh parts can receive density-based mass and centroid estimates. Composite meshes and missing densities do not contribute a claimed assembly mass. Reports flag bounding-box overlaps and distinguish part sums from union volume. A conservative checked-STL action is disabled for flagged topology, reversed winding, composites or overlapping bounding boxes. Reference STL/OBJ exports remain available.
2. **Cloud deployment: explicitly on hold at the owner's request.** No host/domain or production configuration exists. No infrastructure or external service was provisioned. Added redacted `scripts/deployment-check.py` and migration 0003 support for collaboration tables. Production health now checks migration versions rather than only SELECT 1.
3. **Free/Pro scope: implemented; payment activation pending infrastructure/configuration.** See FREE_AND_PRO.md. Existing modelling remains Free. Pro adds five profiles, AI modelling and team ownership. Stripe integration remains disabled without merchant configuration and prices. Live-key activation has an explicit configuration guard.
4. **Engineering calculations: implemented.** Added rectangular cantilever tip-load bending/deflection, solid circular shaft torsion/power and drone static thrust/energy budgeting. Inputs include units, modulus/yield or efficiency/energy assumptions. Results export as JSON. These are analytical models, not FEA, fatigue, flight dynamics or hardware validation.
5. **AI modelling and collaboration: implemented and tested with local/mocked services; not live.** AI uses strict structured recipe output, structural validation, bounded geometry rebuilding and explicit preview/apply. Manual recipes exercise the same preview without an AI call. Teams have in-app acceptance, viewer/editor roles, comments, version-checked JSON edits, revocation and owner-plan checks. Real-time shared-canvas editing remains open.

## Important integration risks addressed

| Risk | Change / evidence | Remaining boundary |
| --- | --- | --- |
| Paying for repeated AI failures without consuming quota | AI-model quota and existing explanation quota are committed before remote calls; a regression test exhausts the budget through provider failures. | Provider-level spending caps and global abuse controls still need operational configuration. |
| Model output executing code or silently changing a design | Strict JSON recipe schema, no model tools/code, bounded polygon/hole validation, worker geometry preview and explicit Apply. Requests do not attach project notes/meshes/account data. | Live provider behavior is mocked; generated geometry is not engineering validation. |
| Stale/cancelled AI proposals targeting another project | Captured project/version and active-dialog checks before review/apply; standard versioned saves reject later server conflicts. | Real multi-session acceptance remains part of cloud staging. |
| Team users bypassing owner boundaries or keeping access after revocation/downgrade | Shared endpoints check project membership, accepted state, role, owner status and active Pro; edits lock the project and require the current version. | Existing user authentication serializes some requests; PostgreSQL contention/load still needs measurement. |
| New collaboration content omitted from privacy flows | Account export includes own comments/memberships. Deletion removes them; owned-project deletion cascades the new tables. Migration is additive/repeatable and preserves existing projects. | Retention/support policy and production backup/deletion rehearsals remain open. |
| Shared-edit conflicts losing the user's draft | HTTP 409 rejects stale versions. The review form retains text and downloads the current draft, allowing recovery before fetching another version. | Shared editing is explicit JSON submission, not a CRDT or simultaneous canvas. |
| Mesh closure being mistaken for a valid physical mass or printable assembly | Open/degenerate/duplicate/inconsistent meshes fail mass eligibility; unspecified composite density is not guessed; overlapping boxes are reported; strict export gate is conservative. | Self-intersections, internal overlaps, wall thickness, tolerances and process suitability are not comprehensively solved. |
| Units/axis/transform mistakes in manufacturing files | Actual application STL/OBJ outputs were parsed independently by Trimesh; volume, watertightness, winding and transformed mm/Z-up bounds passed. | No Cura/Prusa/Bambu/FreeCAD or actual printer acceptance was performed. Reports use editor Y-up coordinates and explicitly identify the export conversion. |
| Unexpected live charges due to configuration mistakes | Billing configuration validates distinct prices and rejects live keys without explicit operator enablement. Entitlements still come from verified provider state. | Merchant/price/tax setup and actual sandbox lifecycle acceptance remain launch blockers. No real payments were activated. |
| A deployment appearing healthy with a missing schema | Production health verifies migrations 0001–0003. Read-only preflight reports missing PostgreSQL/SMTP/Stripe/AI without printing secrets. | Actual cloud/TLS/PostgreSQL/worker/backups are on hold. |
| A queued close event disposing the newly opened modelling preview | Wait for the proposal dialog’s close event before opening the modeller; desktop/phone preview/apply/reload cases pass. | Shared dialog lifecycles need regression coverage whenever another tool reuses them. |
| New generated-part workflow presenting an edit action for a new part | Proposal review now explicitly opens as a new part; browser coverage checks that nothing is added until Apply. | The overall modeller remains a bounded mesh editor. |

## Verification evidence

**Final local results: 40 desktop/phone browser tests passed; 104 API tests passed; all JavaScript suites, first-party JS syntax and whitespace checks passed.** Checks include all existing JavaScript/API/browser suites plus mesh property benchmarks, beam/shaft/drone numerical cases, AI schema/provider payload checks, access-role/conflict/revocation/downgrade cases, privacy deletion and additive migration.

Independent export checks use isolated `trimesh==5.1.1` and `numpy==2.5.4` installed under ignored tmp/mesh-validator. Generate with `STUDIO_EXPORT_FIXTURES=1 node tests/assembly.cjs`; run `python tests/check-exports.py`. These are real exported files from the application's export functions, not hand-written substitutes. CI source now includes this check; remote CI is unverified.

Production JavaScript dependency audit returned zero reported advisories at this run (`npm audit --omit=dev`). This is a point-in-time advisory check, not proof that the application or all Python dependencies are free from vulnerabilities. The existing Starlette/httpx test deprecation warning remains.

## Held and unfinished release gates

- Cloud host/domain, HTTPS/API/PostgreSQL/SMTP/worker activation, real OAuth, backups with demonstrated restore, monitoring and concurrency/load acceptance.
- Stripe merchant configuration, test prices, actual sandbox checkout/webhook/renewal/cancellation/refund/dispute acceptance and final commercial terms before live activation. Automated post-dispute reinstatement requires further billing design/review.
- Live OpenAI key/model acceptance, refusal/incomplete/outage behavior with the actual configured model, operational budgets and global abuse monitoring.
- Full self-intersection/solid-union analysis, material/test-coupon verification, tolerances, mesh repair, slicer/process acceptance and real hardware validation.
- General CAD, analytic curves, richer joint references, real-time shared 3D editing and conflict merging remain larger workstreams.
- Independent security review, Python dependency advisory scanning, production accessibility/performance and remote CI.

**Audit conclusion:** the new local workflows and tested backend controls improve the prototype. It is not yet ready to claim live paid-cloud operation, manufacturing readiness or a complete professional engineering platform. The held service gates should be completed before public paid launch.

## Sources checked for integrations

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Responses JSON-schema format; local validation and explicit user review are additional application controls.
- [Stripe webhooks](https://docs.stripe.com/webhooks): signed events and asynchronous delivery remain the authority for billing.
- [Stripe testing](https://docs.stripe.com/testing): merchant sandbox acceptance is separate from mocked local payment tests.
