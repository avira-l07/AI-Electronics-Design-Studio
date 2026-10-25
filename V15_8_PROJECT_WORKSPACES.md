# v15.8 — Separate category projects from the active workspace

26 October 2026. Fix for the report that choosing Car engine opens the previous drone.

## Cause

The category cards only selected a brief. Every category's “Open manual 3D workspace” link opened the currently active project, so choosing Car engine followed by that link resumed the drone. The assembly was not corrupted; the navigation conflated a new design direction with the existing project.

## Changes

- Each category now offers **Start new [category] project**. A name dialog explicitly describes the result before creation.
- Car engine, ship, LoRa and the other categories create separate empty 3D projects with a category brief and planning tasks. They copy the neutral project defaults, never the active assembly, sketches, BOM, groups, joints or revision history.
- The Drone category creates a separate copy of the actual FPV showcase starter.
- **Resume current project** is a separate secondary action that names the current project. Selecting a card alone still never changes or creates saved data.
- The status label and description explicitly distinguish an empty category workspace from an available starter. No generated engine model is claimed.
- Cancelling leaves the active project intact. Creation errors stay in the dialog and allow a retry; duplicate form submission is blocked.
- Account mode loads the profile's project collection before presenting category creation. The first workspace navigation after creation therefore retains the new project instead of re-selecting an older active assembly.
- Guest login returns to the selected category using a whitelisted category identifier and the existing allowed local return route.
- Cache version is 15.8. No backend schema, migration, payment or Premium policy changes.

## Verification

- All 12 JavaScript suites pass, including validation of all 12 category project payloads, independent copies and existing persistence rollback checks.
- 30 desktop/phone browser checks pass across the category and account/team suites. They cover the exact 136-part drone → empty car-engine reproduction; cancel; original-drone read-back; model isolation across engine/ship/LoRa; the real drone starter; server creation failure/retry; reload; guest return category; authentication and account permissions.
- API-backed browser checks use isolated local synthetic accounts. This does not activate hosted backend services.
- The public asset guard passes for 53 assets. Syntax checks and Git whitespace checks pass.
- Manual browser screenshots confirm the two explicit actions and an empty engine workspace while the previous drone remains unchanged.

## Remaining capability

A ready-made car-engine assembly and specialist engine analysis are not implemented. Users can build manually or import geometry into the new empty project. This fix prevents the previous drone from being mistaken for an engine model; it does not introduce automatic engine generation.
