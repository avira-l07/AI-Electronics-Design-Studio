# v13 — assembly and customization usability review

Reviewed 24 October 2026 following the owner's report that parts were hard to attach, customize and see. The owner selected both drag-and-snap and click-two-faces attachment.

## Problems reproduced

| Friction | Previous behaviour | Change |
| --- | --- | --- |
| Clicking a visible part did nothing | Orbit mode rejected normal selection clicks. Users had to discover a separate Select tool. | A normal canvas click selects a part in Orbit mode. A drag orbits; double-click focuses the part. Existing move/rotate handles remain available. |
| Connecting parts required coordinate work | Multi-select, numeric transforms and joints did not position mating faces automatically. | Guided face picking with a ghost preview, gap/turn controls and explicit Apply. Drag-and-snap aligns a moving selection's world-bottom reference to a target surface. Desktop library drag can insert directly on a surface or ground. |
| Hard to know what a library entry looked like | Small schematic icons and a long category list. | Actual catalogue-geometry thumbnails, category/search filters and a separate Preview & size action. Search includes names, descriptions, IDs and category. |
| Customization happened after insertion | Clicking a library entry immediately placed a default-sized component. | Orbit a preview, edit valid dimensions/material, then Add customized part. Changes rebuild the preview on field change; Update preview is also available. |
| Dimension controls were buried | Assembly controls appeared before the inspector. | Selected-part dimensions appear first, with Focus/Attach/Detach shortcuts. Customize and Assembly list jump controls, plus placed-part search, reduce scrolling. |
| Too little space to see the model | Global navigation, a wrapped toolbar and stacked panels competed for the viewport, especially in the app's narrow browser. | Expand workspace gives the editor the available window; narrow layouts switch between parts and editing panels while retaining a canvas. Focus selected, Isolate and Show all help find parts. |
| Editing could hide the preview | In the narrow app panel, scrolling to dimension inputs scrolled the preview canvas out of view. | The preview model remains visible while the dimension section scrolls independently; the Add action stays visible. Verified manually in the in-app browser and through viewport assertions. |

## How to use the new workflow

1. Choose **Expand workspace** when you need more space.
2. Filter the library by category or name. **Preview & size** opens the actual geometry with editable dimensions/material; add it when ready. Direct click-to-add still works.
3. **Attach faces:** click the moving face, then a stationary target face. Review the ghost, gap and turn. Choose **Attach now**. You can orbit between picks. Face-centre alignment can be disabled to use the picked points.
4. **Drag & snap:** hold and drag a placed part onto a visible target. Its world-bottom reference snaps to the target surface. Dropping on empty canvas performs a free move in the camera-facing drag plane. Desktop users may drag catalogue parts directly onto a surface or ground.
5. **Keep attached** creates existing fixed-joint relationships, so moving the parent carries its descendants. **Detach** removes an incoming attachment before repositioning. Undo/redo and saved project JSON retain the result.
6. **Focus selected**, **Isolate selected**, **Show all**, and assembly search help navigate a larger project. F focuses the selection; Escape cancels attachment or leaves the expanded view.

## Data and interaction protections

- Surface placement uses world millimetres and complete rigid transforms, including arbitrary initial rotations, face-normal opposition, user gap and rotation around the target normal.
- Face picking and ghost previews do not change saved geometry. Apply is explicit. Cancelling, including Escape while a gap field is focused, restores the original view without saving a placement.
- Dragging saves one committed operation at release. A click without a drag does not create a move. Releasing outside the canvas cancels.
- Selected groups and joint descendants move together. An incoming joint from outside the moving set must be detached first. Targeting a moving descendant is rejected; normal assembly validation rejects invalid/cyclic/oversized results.
- Each preview captures its project and assembly signature. A changed assembly cannot receive a stale attachment draft.
- Ghost meshes share original geometry but clone materials. Cleanup disposes only temporary materials and marker geometry, preserving the original part meshes.
- STL/OBJ export is blocked while an attachment preview is unapplied. Users must apply or cancel first, preventing a visible preview from being mistaken for exported geometry.
- Isolation is a view action; it does not silently change saved visibility or the export assembly. Show all explicitly restores hidden parts and remains undoable if saved visibility changes.
- Part previews capture the project identity before insertion. Dimensions and material are validated before a part is added. No account/server schema or entitlement change was needed; attachments use the existing fixed-joint format.

## Verification

- Full browser regression: **63 passed, 1 skipped** out of 64 cases. The skip is native HTML library dragging in the phone project; placed-part pointer dragging and face attachment run in both desktop and phone viewports. These are browser layout/mouse-pointer checks, not physical touch-device acceptance.
- **108 API tests passed.** Backend code and schemas are unchanged; the full account/project regression was rerun.
- All JavaScript suites passed; all 14 existing STL/OBJ export files also passed independent parsing again. This is not external CAD/slicer acceptance. Numeric benchmarks cover world-space attachment, arbitrary rotations, gap/turn, grouped descendants, fixed-joint offsets and invalid/cyclic cases.
- Targeted usability reruns cover preview visibility, cancellation, detach/undo/reload, direct library drop, assembly filtering and view isolation. The final targeted rerun passed 11 cases, with the same desktop-only library-drag case skipped on phone.
- Manual in-app-browser review checked ordinary mesh selection, expanded narrow layout, library filtering and changing dimensions while keeping the preview visible.
- The tests use isolated browser contexts/local preview data. The owner's hosted project was not used as the test assembly.

## Remaining limits

- Surface snapping is a positioning aid. It does not infer compatible connectors, coaxial hole/shaft relationships, screw threads, mechanical fit or collisions.
- A picked curved mesh surface uses its triangle normal. A face centre is the area-weighted centre of the coplanar mesh patch; it can fall in a hole or between disconnected coplanar regions.
- Drag snapping uses the moving selection's world bounding-box bottom. For a specific mating face or an irregular/rotated component, use Attach faces instead.
- Fixed connections retain relative poses rather than associative face references. Recheck contact after changing dimensions; Detach and reattach when needed.
- Native library drag is intended for desktop. Physical touch hardware, very large imported meshes and user testing on the owner's actual project still need acceptance.
- Existing cloud deployment, real payments/AI activation and engineering/manufacturing acceptance gates remain unchanged. See V12_AUDIT.md for that broader status.
