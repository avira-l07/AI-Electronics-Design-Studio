# v14 — visual workbench and usability review

24 October 2026. This update improves the existing 3D editor. It does not introduce a new CAD kernel or activate cloud services.

## What changed

- The workspace opens before the longer list of engineering utilities. Its project header, named tool groups, attachment guide, parts browser, canvas, inspector and status strip form one workbench.
- Light and dark themes now cover the library, inspector, assembly controls and numeric fields. Larger fields, clearer text, material swatches and selected-part metadata improve editing.
- Card and list layouts use actual geometry thumbnails. The layout preference persists on this device. Category/search controls stay above an independently scrolling parts list.
- A searchable tool finder reaches 37 existing modelling, assembly, validation, import/export, history and service actions, including from expanded view. Use **Ctrl+/ or Command+/**; arrow keys navigate results and Enter runs a tool. Empty searches and disabled actions are handled.
- A floating camera dock offers Iso, Top, Front and Fit. Grid state is exposed to assistive technology. Expanding frames the visible assembly while preserving its viewing direction, except during an attachment preview.
- Neutral canvas lighting and a larger ground surface improve shape contrast and avoid a distracting floor edge in normal assembly views.
- The inspector shows the selected part's material/type and dimensions first, followed by transforms, materials and actions. Customize/Assembly navigation and narrow-layout panel buttons expose their selected state.
- Workspace help explains part selection, customization, both attachment methods, camera navigation, multiple selection and shortcuts.
- Modified browser shortcuts such as Ctrl+F no longer accidentally trigger single-letter modelling controls. Existing Ctrl/Command+D duplication is retained.

## Corrections made during review

1. Minimum-content rows and explicit card heights prevent the new thumbnail cards collapsing in a short library panel.
2. An inherited phone rule set the parts panel to a horizontal flex row. The workbench explicitly restores a vertical layout, with the list scrolling inside its allocated height.
3. Tool-finder actions close their search dialog before opening the selected tool. Existing modal initialization restores the submit action for the next dialog.
4. Expanding previously increased canvas space without reframing, leaving large assemblies unnecessarily small. The new expansion pass frames visible objects and keeps geometry/project data unchanged.

## Verification

- All JavaScript test suites pass, covering geometry, persistence, imports/exports, groups/joints, calculation models and surface mating.
- Dedicated browser checks cover finder filtering/empty results/keyboard execution, advanced dialogs in expanded view, card sizing and persisted layouts, grid/camera/help controls, inspector navigation, light/dark preferences and retained dimension edits.
- Existing browser regressions exercise pre-insertion previews, direct canvas selection, both attachment workflows, cancellation, undo, reload, assembly search and visibility handling.
- Manual in-app-browser review includes the 120-component drone starter, filtered catalogue cards, selected-part dimensions and expanded framing.
- Final full desktop/phone browser suite: **71 passed, 1 skipped** (72 cases). The skip is native HTML library dragging on the phone viewport; placed-part dragging and face attachment run on both layouts.
- All JavaScript suites, changed-script syntax checks and `git diff --check` pass. The backend source was unchanged; its earlier 108-test API result is historical evidence, not a new API run for this UI update.

## Boundaries

- Narrow-view tests use browser viewport emulation; physical touchscreen hardware has not been tested. Native HTML library dragging remains desktop-specific; click/preview insertion and placed-part drag/face attachment are alternative paths.
- The finder launches existing tools; it does not add unrestricted CAD operations. STL/OBJ remain reference mesh exports under the existing engineering/manufacturing limits.
- The account backend, hosted collaboration, live AI and payment activation remain held or unconfigured as documented in the main roadmap. Audience/access settings are preserved.
- All new local UI controls remain Free. The existing Free/Pro entitlement split is unchanged.

## Try it

1. Save any open dimension edit, then reload the updated site.
2. Open 3D Editor and choose **Expand** in its header.
3. Pick a category, use **Preview & size**, and add a part.
4. Click a placed part to customize it; use **Attach faces** or **Drag & snap** to connect it.
5. Open **Find a tool** for imports, mesh inspection, calculations, reusable parts and exports.
