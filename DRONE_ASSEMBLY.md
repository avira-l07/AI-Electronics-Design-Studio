# Quadcopter assembly update

The Starter templates page now includes an editable 120-component quadcopter packaging concept. Creating a copy opens the 3D editor and leaves other projects intact.

Assembly sequence:
1. Hardware: 92 screws, washers, nuts and spacers at their assembly positions.
2. Frame: two centre plates, four drilled arms and four landing feet (102 components visible).
3. Motors: four brushless outrunner envelopes (106).
4. Electronics: ESC, flight controller and receiver board (109).
5. Power: battery envelope and two retaining straps (112).
6. Complete drone: two CW and two CCW propellers, plus four retaining nuts (120).

All components have independent dimensions, material and transforms. The assembly tree groups them by step. Step previews preserve saved visibility and positions; STL/OBJ exports restore the complete set of steps while respecting deliberately hidden components. Exploded views remain temporary. BOM sync groups equivalent parts and preserves matching quoted prices. New projects start with all prices unquoted.

The parts library now has 31 entries, including 11 new drone/hardware definitions and a Carbon fibre visual material. Frontend and API validation share the generated catalogue schema. The drone is included in project backups, revisions and JSON imports/exports.

Usability fixes: frame the entire model on first entry, fit Top/Front/Iso presets to visible geometry, preserve the selected project on reload, reopen assemblies directly in the 3D editor, keep the assembly tree scrollable with a large BOM, and improve model lighting.

Validation: frontend calculation, template, storage, editing and geometry suites pass; 48 API tests pass. Geometry checks cover all 31 catalogue definitions, motor screw/arm hole alignment, separate propeller envelopes, six non-destructive preview steps, full assembly export and idempotent BOM sync. Browser checks cover creating a starter, step navigation, Top/Iso views, editing dimensions, undo and reload selection.

This is an illustrative packaging model. It has no flight dynamics, electrical connectivity or structural simulation. Component ratings, real manufacturer fits, fastener engagement, wiring and physical assembly readiness require separate engineering review. The geometry is not a validated flight-ready design.
