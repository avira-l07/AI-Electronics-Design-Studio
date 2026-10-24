# Engineering Studio — status and remaining work

Latest v15.4: [user-perspective audit](UX_AUDIT_2026-10-24.md) reviews all supplied UX findings and delivers the confirmed fixes. Public resource browsing does not expose account projects; unapplied form drafts do not silently save. The v15.3 free-beta architecture and outstanding cloud/manufacturing/CAD limits remain below.

Current follow-up v15.3: [zero-cost beta delivery](FREE_BETA_DELIVERY.md). The owner has authorized a free-tier beta, with paid services/live charges still disabled. Account/token lock ordering and the custom-assembly cache lifecycle are corrected in source. A synthetic loopback demo is runnable now. Render Free/Neon preparation is provided; actual cloud/provider acceptance remains blocked by missing access/configuration. The v15.2 review below is historical context.

Optional installed-model Ollama proposals are now available in that local demo. Actual inference, closed-solid geometry and preview/apply/save/reload passed with a synthetic plate. Cloud AI remains disabled; a local success is not general AI quality or manufacturing acceptance.

Reviewed 24 October 2026 against release v15.2. See the [current status audit](PROJECT_STATUS_AUDIT_2026-10-24.md) for fresh verification and priorities. Latest changes: [v15.2 security/recovery](api/RESIDUAL_RISK_REVIEW.md), [v15.1 authentication/invitations](api/THREAT_REPORT_AUDIT.md) and [v15 color/effects](V15_COLOR_AND_EFFECTS.md). Earlier [v14 workbench](V14_WORKBENCH_REVIEW.md) and [v13 usability](V13_USABILITY_REVIEW.md) features remain delivered. The site is an engineering concept workspace with working local tools and a tested account-server implementation. The static publication does not deploy FastAPI/PostgreSQL. Cloud deployment remains held at the owner's request.

| Screenshot workstream | Current state | Remaining boundary |
| --- | --- | --- |
| Team workflows | Actual local HTTP server + three separate authenticated accounts pass desktop/phone browser workflows. | Physical devices, real hosted accounts and production PostgreSQL remain unverified. |
| Shared 3D | Presence and transform/name/visibility edits poll every two seconds. Independent objects merge; same-object conflicts retain drafts. | No shared geometry/joint authoring or WebSocket/CRDT; account backend not live. |
| Advanced CAD | Analytic curve recipes, nonlinear point/segment constraints, face snapshots and bounded corners/shell/sweep/loft are implemented. | General CAD kernel features, curve constraints, arbitrary 3D-edge operations, associative references and STEP remain open. |
| Manufacturing | Triangle-distance/containment screening, sampled walls, conservative repair copies, fit stacks and evidence export. | No guarantee of all intersections/thin regions, certified materials or fabrication suitability. |
| Export/hardware acceptance | 14 actual application STL/OBJ files pass independent parsing. Reference coupon and acceptance kit included. | CAD/slicer execution, toolpaths and physical measurements are unverified. |
| Simulation | Additional beam/fatigue/thermal/RC/point-mass flight models pass numeric benchmarks. | Full FEA/CFD/SPICE, fatigue-life prediction and six-DOF flight validation remain open. |

Fresh status verification: 142 API cases, all 12 JavaScript suites and 14 independently parsed STL/OBJ exports passed. The full desktop/phone browser suite finished with 97 passed and one expected desktop-only native library drag skip on phone. The API tests use SQLite, so they do not establish PostgreSQL concurrency safety. The audit identifies inconsistent account/token lock ordering and the existing large-assembly cache lifecycle limit as reliability priorities before production. Migration 0005 is required for the current backend.

Use [PRIORITY_CHECKLIST.md](PRIORITY_CHECKLIST.md) for order and [V12_AUDIT.md](V12_AUDIT.md) for exact implementations, tests, limits and formula references. [FREE_AND_PRO.md](FREE_AND_PRO.md) defines entitlements: all new local engineering tools remain Free; Pro owners manage teams and invited Free accounts participate by role. Prices/live payments and AI provider activation remain pending configuration and acceptance.
