# Reliability and interface review — 22 October 2026

This update preserves the existing Sites audience. The owner will change visibility separately.

## Fixed and added

- Non-destructive startup validation for saved projects, Trash, preview profiles and demo receipts. Malformed project data no longer crashes the app or gets replaced with a sample project. Storage access errors show recovery guidance.
- Backups & recovery is available from the library, preferences and account pages. Full device backups include active projects, revision snapshots and Trash. Import previews the number of copies, validates all entries and keeps existing projects. Recovery preserves original malformed data in an additional browser key before writing readable projects. Download the original data first; a browser recovery copy is not an external backup.
- A genuinely empty library now stays empty. The workspace offers project creation/templates instead of silently creating another project. Export and revision actions are disabled until a project exists.
- Sketch projects show their actual geometry in project cards, have their own library filter and retain the correct design model after imports.
- Dialogs await asynchronous saves, prevent duplicate submission and retain input when the action fails. Project imports now use the same validated creation adapter in local and server modes.
- Server navigation, collection reloads, project creation and profile switching wait for queued saves. Failed/conflicting saves preserve in-memory edits and offer export/return-to-editor instead of loading over them. Closing/reloading the page warns while saves are pending or failed. The browser decides whether to display this warning; it is not a durable server backup.
- Aligned project import bounds with backend collection, revision, shape and quantity limits. Invalid/overflowing circuit results and enormous integers return validation errors. Local persistence checks every project, preventing an invalid edit in another project from being written with a later valid edit.
- BOM CSV text neutralizes spreadsheet formula prefixes. Raw JSON exports preserve the original values.
- Public landing actions open the workspace directly; device profiles remain optional in local mode. Removed text assuming the site is always owner-private. Site hosting visibility and application account access remain distinct.
- Added a missing-page view, named dialogs/close controls, workspace skip link, larger phone controls, horizontally scrolling tool tabs, readable mobile inputs and clearer device-backup status.

## Verification

- 35 Python API tests passed with real hashing, session/CSRF/ownership/payment and project lifecycle checks. Payment and optional AI provider calls remain mocked. One existing Starlette/httpx deprecation warning remains.
- `npm test` passed: mechanics/circuit arithmetic, starter validation and rollback, corruption/blocked-storage preservation, backup round-trip validation, nested revisions, spreadsheet formula protection, async modal completion/failure/double-submit and ordered versioned saves/conflict recovery.
- All shipped JavaScript passed syntax checks and Git whitespace checks passed.
- Interactive browser checks: last-project Trash to an empty library, empty workspace, creating an enclosure starter, sketch-specific cards, desktop and 390px phone layout, backup download and import of active plus trashed projects as copies, and existing-project preservation. No JavaScript errors were reported in the reviewed tab.
- The standalone browser suite now discovers 12 desktop/phone cases, including corruption recovery and backup import. Test source/discovery was checked; that runner was not executed locally. CI execution is not claimed.

## Deployment boundary

The hosted site still serves the browser-local application. The Python API changes require separate backend deployment. Backend hosting, PostgreSQL/container operations, real email, live Stripe/OpenAI/Google integration checks, production monitoring and backups remain external setup work. No paid feature set or price was invented, and payment collection remains off by default.

This is a focused reliability pass, not a claim that all future product work or independent security review is complete. See `GAP_CLOSURE.md` and `deploy/README.md` for the broader remaining scope.
