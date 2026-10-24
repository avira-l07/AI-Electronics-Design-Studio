# v15 — color combinations and effects

24 October 2026. A shared color system now connects the design workspace, 3D workbench, navigation, dashboard, forms and dialogs.

## Palette

| Role | Forest / light | Forest / dark |
| --- | --- | --- |
| Page | Warm ivory `#f3f3ed` | Graphite `#111e23` |
| Panels | Warm white `#fffefb` | Slate teal `#1a2c30` |
| Navigation | Evergreen `#142f29` | Deep teal `#10272a` |
| Primary action | Evergreen `#28634f`, white text | Sage `#c2dda7`, dark text |
| Drawing surface | Mist `#eaf0e9` | Graphite blue `#20343b` |
| Attention text | Ochre `#805b21` | Warm amber `#f0cb86` |
| Error text | Brick `#a13e36` | Soft coral `#f3b2a9` |

The existing Cobalt preference has matching blue accents, cool neutral surfaces, navy navigation and a pale-blue primary action in dark mode. Forest/Cobalt and Light/Dark remain user preferences; the update does not reset them.

`dist/color-system.css` supplies semantic variables shared with the older studio and solid-editor variables. More specific theme selectors prevent legacy hardcoded colors from overriding the new palette. This fixes the pale logo lettering on a pale badge and dashboard cards that retained the old green fill. The 3D workbench now respects Cobalt, including its header, toolbar, primary actions, attachment controls and inspector.

Engineering material colors are preserved. Drawing labels gain theme-aware contrast; sketch-editor grid/outline colors match the surrounding tools. Geometry, calculation formulas and export code are unchanged.

## Effects

- Short 150 ms color, border and shadow transitions make hover/focus changes easier to follow.
- Clickable project/template/settings cards lift by two pixels on hover.
- Dialogs enter with a five-pixel, 150 ms fade/movement; the backdrop has a restrained blur.
- Navigation uses a selected rail marker, editing controls have clear focus outlines, and the drawing uses a quiet dot grid.
- No continuous decorative canvas animation was added. Both the operating-system reduced-motion preference and the saved studio preference disable decorative animations/transitions. Explicit mechanism playback remains a user-controlled engineering tool.

## Verification scope

Browser checks cover all four theme/accent combinations at desktop and phone viewport sizes, sampled text/control contrast against computed background colors, retained design/dimension edits, settings persistence and both reduced-motion paths. Samples include the logo, dashboard headline/metrics, design labels and SVG annotations, primary actions, sidebar selection and 3D editing controls. The sampled text pairs must reach 4.5:1; this is not a claim of a complete WCAG audit.

Final Chrome regression run: **45 passed, 1 skipped** across desktop and phone layouts. The skipped case uses desktop HTML library drag; the pointer-based part drag/snap and two-face attachment cases pass on both layouts. Syntax checks and `git diff --check` pass. Visual review also caught and fixed low-contrast dark-mode calculation values and a playback selector that retained a white background; these now have contrast assertions.

Regression coverage also exercises custom-solid editing, electronics, project recovery, part previews, tool discovery, both attachment workflows and undo/reload. Physical touchscreen hardware and backend deployment remain outside this styling update.

All new appearance controls remain Free. Site audience and the backend deployment hold remain unchanged.

Choose **Preferences → Forest/Cobalt → Light/Dark** to compare the combinations. **Reduce motion** is available in the same page.
