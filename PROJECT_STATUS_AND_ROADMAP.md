# Engineering Studio — status and remaining work

Reviewed 24 October 2026. Latest [v13 usability review](V13_USABILITY_REVIEW.md): guided and drag-based attachment, pre-insertion previews and a canvas-focused layout are delivered. The site is an engineering concept workspace with working local tools and a tested account-server implementation. The static publication does not deploy FastAPI/PostgreSQL. Cloud deployment remains held at the owner's request.

| Screenshot workstream | Current state | Remaining boundary |
| --- | --- | --- |
| Team workflows | Actual local HTTP server + three separate authenticated accounts pass desktop/phone browser workflows. | Physical devices, real hosted accounts and production PostgreSQL remain unverified. |
| Shared 3D | Presence and transform/name/visibility edits poll every two seconds. Independent objects merge; same-object conflicts retain drafts. | No shared geometry/joint authoring or WebSocket/CRDT; account backend not live. |
| Advanced CAD | Analytic curve recipes, nonlinear point/segment constraints, face snapshots and bounded corners/shell/sweep/loft are implemented. | General CAD kernel features, curve constraints, arbitrary 3D-edge operations, associative references and STEP remain open. |
| Manufacturing | Triangle-distance/containment screening, sampled walls, conservative repair copies, fit stacks and evidence export. | No guarantee of all intersections/thin regions, certified materials or fabrication suitability. |
| Export/hardware acceptance | 14 actual application STL/OBJ files pass independent parsing. Reference coupon and acceptance kit included. | CAD/slicer execution, toolpaths and physical measurements are unverified. |
| Simulation | Additional beam/fatigue/thermal/RC/point-mass flight models pass numeric benchmarks. | Full FEA/CFD/SPICE, fatigue-life prediction and six-DOF flight validation remain open. |

Verification: 52 full desktop/phone browser cases, 108 API cases and all JavaScript suites passed. The expanded browser test exposed and now covers an actual concurrent-request event-loop/SQLite lock failure that serial API tests missed.

Use [PRIORITY_CHECKLIST.md](PRIORITY_CHECKLIST.md) for order and [V12_AUDIT.md](V12_AUDIT.md) for exact implementations, tests, limits and formula references. [FREE_AND_PRO.md](FREE_AND_PRO.md) defines entitlements: all new local engineering tools remain Free; Pro owners manage teams and invited Free accounts participate by role. Prices/live payments and AI provider activation remain pending configuration and acceptance.
