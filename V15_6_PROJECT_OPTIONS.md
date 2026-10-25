# 3D project-type options (v15.6)

26 October 2026. Adds the category options requested by the owner. Assignment of future features to Premium is deferred until the owner specifies the split.

## Delivered

- New public resource page: `#/project-types`.
- Twelve project directions: car engine; ship & boat; LoRa device; robotic arm; drone; CNC & machines; electronics enclosure; electric vehicle; pumps & valves; weather station; solar & energy; custom 3D project.
- Search by name/component description and filter by engineering field, with an empty-result recovery action.
- Illustrated category cards, a selected-direction panel, typical components and clear limits on the current concept tools.
- Selection links such as `#/project-types?type=lora` survive reload. Unknown category values fall back to a valid option and are not interpolated into markup.
- Navigation from the public header, account sidebar, 3D toolbar and workspace tool finder.
- Light/dark styling using the existing shared colour tokens, keyboard-operable category buttons and responsive desktop/phone layouts. On narrow screens a selected card brings its details into view.
- A link back to the existing manual 3D editor, preserving the active project. Account-server guests are directed through login when they choose to open the editor.

## Scope and plan status

This is an options/catalogue interface. Selecting a category does **not** generate a model, add a starter assembly, alter saved geometry, upgrade an account or initiate checkout. The diagrams are concept illustrations, not previews of generated geometry. Category-specific model generation, guided domain starters and specialist analysis remain future work.

The current manual design tools and existing Free/Pro entitlements remain unchanged. No new category is assigned to Premium and no payment or paid service is activated. Backend `api/product.py`, billing logic and database schema are unchanged.

The public resource route does not expose account projects: backend workspace and project endpoints retain their existing authentication checks. Browsing the new page makes no project/payment mutation request.

## Verification

- All 12 JavaScript suites passed, including existing modelling, assembly, export, storage and worker recovery checks.
- Public-file guard passed for 51 assets, including the new project-types JS/CSS.
- Twelve focused browser checks passed across desktop, phone and the actual local account server. They cover selection/search/filter/deep links, project preservation, manual-editor navigation, public resource access, login return, unchanged Free entitlement and continued denial of protected endpoints.
- Desktop/phone screenshots were inspected in light and dark themes. Screenshot animations are disabled so captures show settled theme colours.
- Full browser regression: **140 passed, 2 expected skips** out of 142 desktop/phone cases. The skipped phone cases remain the native catalogue drag check and the duplicate heavy clearance timing check.
- All top-level frontend JavaScript modules passed node --check. No backend Python source changed; the previous API baseline is 186 passes, not a new API run for this interface-only change.

## Next decisions

1. Owner specifies which future creation capabilities and categories belong in Free or Premium.
2. Select the first domain starter to implement, with explicit geometry, editing and acceptance requirements.
3. Continue the existing backend deployment and external engineering acceptance checklist independently.
