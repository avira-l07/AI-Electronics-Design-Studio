# Free and Pro — implemented feature split

24 October 2026. The owner requested that cloud deployment be held until a host/domain is supplied. Prices, merchant credentials and live charging are not active.

| Capability | Free | Pro |
| --- | --- | --- |
| Existing custom 3D modelling, part catalogue and drone concept | Included | Included |
| Extrude/cut/union, revolve/taper/twist, mirror/pattern, nonlinear point/segment constraints and saved analytic curve definitions | Included | Included |
| Profile fillets/chamfers, extrusion shells, parallel sweeps, convex lofts, face-plane snapshots | Included within documented modelling limits | Included |
| Guided face attachment, drag-and-snap, pre-insertion size previews, expanded workspace and isolation | Included | Included |
| Multi-select/groups, alignment, measurements and simple joints | Included | Included |
| STL/OBJ import/export and personal parts library | Included within existing mesh limits | Same mesh limits |
| Mesh inspection, density-based mass/centre of mass estimates and inspection JSON | Included | Included |
| Clearance, sampled walls, repair copies, tolerance stacks and acceptance kit | Included within documented screening limits | Included |
| Slider-crank/DC resistor, beam/shaft/drone/fatigue/thermal/RC/point-mass flight calculation lab | Included | Included |
| BOM, evidence, local revisions, device backups and report exports | Included | Included |
| Secure account profiles, after backend deployment | 1 | 5 |
| Account project storage, after backend deployment | Included; existing 1,000-project account capacity and 1 MiB API request limit | Same current storage/body limits |
| Existing optional live AI explanations, if configured | Up to 10 requests/hour | Up to 10 requests/hour |
| Live AI modelling proposals, if configured | Not included | Up to 5 requests/hour; failures also consume quota |
| Accept invitations, view/comment on projects, edit if granted editor role | Included, while owner has active Pro | Included |
| Invite/manage collaborators on owned projects | Not included | Up to 10 collaborators/project |
| Project review/comments and version-checked shared JSON editing | Participate according to granted role | Manage owned project roles and participate |
| Shared 3D presence and transform/name/visibility edits, after backend deployment | Participate by granted role | Manage owned team projects and participate |
| Engineering certification, full FEA or STEP/BREP | Not offered | Not offered |

Existing local modelling capabilities have not been moved behind a paywall. Backend `api/product.py` defines the paid capabilities; AI modelling and owner team-management endpoints enforce subscription eligibility on every request. A browser profile or payment redirect cannot grant Pro.

## Payment status

Stripe is the prepared provider. Checkout/webhook/portal code and synthetic lifecycle tests already exist. Configuration now rejects missing/identical plan IDs and refuses live keys unless the operator explicitly enables `ALLOW_LIVE_BILLING` after merchant, price and lifecycle acceptance.

No real Stripe account, price object, webhook endpoint or subscription was created here. There are no merchant credentials in the workspace. The static preview continues to collect no payment. Test-mode activation needs the deployed HTTPS backend and the owner's Stripe test configuration; live activation also needs final prices, commercial terms and live acceptance.

## Collaboration boundaries

Invitations are in-app and require an existing verified account. No invitation emails are sent. Recipients explicitly accept. Viewers read/comment; editors can submit validated, version-checked project JSON. Revocation, bans, owner downgrade and project Trash are checked on subsequent requests. Trashing revokes team grants; restoring the project does not silently restore those grants. The shared 3D workspace polls every two seconds, merges unrelated part edits and retains same-part conflicts for review. Geometry/joint authoring stays in the owner workspace. This was verified locally with three synthetic accounts and desktop/phone browser contexts; hosted accounts and physical devices are unverified.

The personal parts library is still stored on the device and has a separate JSON backup. Physical density overrides and calculation-lab inputs are preserved through exported reports, not automatically added to project metadata.
