# AI Engineering Design Studio

Browser-local engineering concept workspace. Serve `dist/` using any static HTTP server.

## Version 0.2

- Parameter-driven 2D slider-crank scene with playback, angle scrubbing, wireframe and SVG export.
- Full-cycle displacement chart and CSV samples with analytic velocity.
- Concept sketch canvas: rectangles, circles, lines, undo and SVG export; coordinates in mm.
- Ideal DC resistive circuit calculator with user-entered power-rating comparison.
- Original project creation, JSON import/export, editable BOM and CSV export.
- Revision snapshots, restore and parameter comparison.
- Evidence records with change-dependent outdated markers.
- Fabrication checklist, batch planning costs and standalone HTML project report.
- Quick-action palette, keyboard shortcut and responsive layouts.

Data remains in this browser's localStorage; export project JSON for backup or migration. Hosted access is owner-private. No cloud project synchronization, live AI, CAD kernel, finite-element solver or fabrication certification is included.

## Checks

Run `node tests/calculations.cjs` from this directory. Numerical checks cover full-cycle displacement and analytic velocity against finite differences; additional checks cover cost arithmetic, import validation and evidence invalidation. Browser QA covers parameter editing, electrical feedback, revisions, sketch pointer drawing and the build planner.

## Mechanics assumptions

Ideal rigid slider-crank with zero offset, no friction, loading, deformation or clearances. Stroke = 2r; full rotation requires L > r. Displacement from outer dead center is `r(1-cos θ) + L - sqrt(L²-r² sin² θ)`. Playback is deliberately slowed and independent of the operating RPM used in calculations. Generated SVGs are conceptual illustrations.
