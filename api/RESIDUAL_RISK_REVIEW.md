# Follow-up residual-risk review — v15.2

24 October 2026. This reviews the second supplied report against the current source. The report's 124 API / three browser results are not the current verification total; its external execution timing cannot be established from pasted text alone. This work uses isolated local accounts and synthetic data, with no customer-file deletion, external probing or real email/provider requests.

## Findings

| Report item | Verdict | Current handling |
| --- | --- | --- |
| Local preview data survives logout | **True, already disclosed; a device privacy boundary.** Preview logout is not encryption or a storage wipe. | Added a deliberate **Backups & recovery → Clear Studio data from this browser** action. It requires typed `CLEAR` and an acknowledgement, offers a saved-device archive, clears only Studio-owned data, ends the local preview session and reloads other current preview tabs. No automatic destructive logout policy was enabled. |
| Schema-compliant geometry can consume excessive resources | **Residual risk is real, but existing controls were omitted.** The worker already had a 20-second boot/rebuild watchdog, finite dimensions, 64 outline vertices, 16 features, bounded patterns, output limits and a 200-part assembly limit. Shared transform merges prohibit geometry changes; an accepted editor's separate, version-checked whole-project JSON endpoint can change geometry. | Added a 32 MiB retained-result cache budget, deduplicated concurrent identical recipes and an eight-job worker queue limit. Shared previews have a 500,000-triangle actual-geometry budget, per-part failure isolation, explicit retry and amber position markers for unavailable geometry. The owner workspace offers project JSON export even if a solid cannot open. |
| Delayed SMTP can outlast a ten-minute confirmation | **Valid operational concern.** Delayed/unavailable mail can impair email-based verification and recovery. It is not evidence that a remote attacker can read a mailbox or intercept a session. | `LOGIN_CONFIRMATION_TTL_SECONDS` is configurable from 600–1800 seconds, default 1200 (20 minutes). Expiry remains measured from request time; it is not extended by retries or delivery. Existing MFA remains available. Real mail delivery latency, worker backlog and corporate filtering still need acceptance on the eventual host. |
| Mailbox access bypasses the password | **Overstated as a new passwordless trigger.** The app creates a confirmation link only after a correct password during step-up. An email address or wrong password cannot request one. A stolen live link is a bearer credential, and email-based password recovery already makes mailbox security important. | Retained single-use, epoch-bound tokens, expiry, explicit confirmation and required MFA when enabled. No authentication check was removed to accommodate mail delays. |
| A malicious extension can inspect an active workspace | **Real client/device threat, not an application-specific injection proof.** An extension with page access can inspect data the browser displays. | A normal website cannot reliably prevent a sufficiently privileged extension or compromised OS from reading data already available to the user. Use a trusted browser profile and appropriate device/extension policy. No misleading DOM obfuscation or cookie-security claim was added. |
| Caddy serves `.env`, database or backend source | **Not present in the supplied configuration.** Caddy reverse-proxies the API; the API's static root and Sites manifest point to `dist/`, not the repository root. | Added a `PublicFrontend` static policy that rejects hidden paths and database/key/server-source extensions even if accidentally copied into `dist/`. A publishing guard rejects hidden files, symlinks and private/runtime filenames before packaging. The local preview applies the same filename categories. |

## Device clearing boundaries

The removal control is available only in device-preview mode and never deletes server projects or authentication cookies. It removes saved project and Trash records, personal parts, local profile/demo orders, appearance preferences, legacy 3D records and recovery copies. It leaves an empty project-list marker plus a non-private clear-event marker so other current preview tabs can reload without restoring private in-memory data. Unrelated origin storage is preserved.

The optional archive contains raw saved Studio values, including personal parts and recovery copies. It is a private recovery archive, not the normal project-import format. Export unsaved work separately before clearing. The control does not remove existing downloads, browser history, other profiles/devices, cloud data or external backups, and does not claim forensic secure erasure. Older already-open versions may not listen for the clear event; close older Studio tabs.

## CAD recovery and resource boundaries

A failed shared part uses a small amber wire box as a **position marker**, not a representation of its shape, bounding dimensions, fabrication geometry or an exportable substitute. Applying shared edits to that unavailable part is disabled. Healthy parts and metadata remain available. Automatic polling does not repeatedly rebuild the same failed recipe; the user explicitly retries. The fallback never overwrites stored project JSON.

The retained typed-array cache is bounded by bytes as well as entry count. Identical in-flight rebuilds share a task; excess independent jobs are rejected. The existing watchdog terminates stalled workers, rejects their queued work and permits a fresh worker afterward. Large assemblies may require simplification when preview/cache budgets are exceeded; the original recipe remains exportable.

These guards reduce resource consumption and improve recovery after a reported worker failure. JavaScript cannot guarantee that a browser/GPU/OS process will survive every native out-of-memory condition. No test intentionally exhausted system memory. Worker timeout/recovery is tested with a deterministic fake worker; shared-preview fallback is tested with a synthetic worker error followed by a real simple-solid rebuild. Manufacturing and advanced modelling limitations remain unchanged.

## Mail and authentication boundaries

The new TTL is validated at startup and documented in `api/.env.example`. A longer bounded lifetime is a latency tradeoff, not a solution to SMTP outage. The outbox still requires its configured operational worker and monitoring; setting a value does not provision a mailbox or prove delivery. No real SMTP message was sent during this review.

The pasted report also mixes protections: Argon2id hashes passwords; it does not prevent SQL injection. Parameterized database operations and validation address that boundary. `HttpOnly` protects ordinary page scripts from reading cookie values, but does not stop same-origin script actions or a privileged extension from reading rendered data. Passing selected injection tests is not a certification that every possible XSS path is absent.

## Verification

- **142 API tests passed**, including TTL values/bounds, forged confirmation rejection, source/runtime path requests and actual synthetic private files placed inside a temporary public directory.
- All twelve JavaScript regression suites passed, including actual kernel modelling, existing engineering/import/export/placement behavior and the new cache/queue/watchdog/recovery guards. The publishing asset guard passes.
- **22 browser checks passed** on desktop and phone layouts: deliberate device removal/cancellation/archive download and peer-tab reload; owner JSON export on failed rebuild; shared per-part fallback and real retry; existing solid editing/import injection checks; and multi-account team/confirmation behavior. Tests used isolated Chrome contexts, a separate preview port and synthetic data. No real saved user projects were cleared.
- Changed JavaScript syntax, Python compilation and whitespace checks are included in the release verification.

## Deployment status

Frontend device privacy and recovery controls can be published to the existing static site without changing its audience. The user's backend/cloud deployment hold remains in effect. Configurable server TTL and the API static-file policy are source changes until the separate backend is deployed; migration 0005 remains required from the previous release. Billing, prices, provider activation and Free/Pro entitlements were not changed.

Before production acceptance: verify real SMTP delivery and delayed-link behavior, PostgreSQL concurrency, HTTPS/proxy behavior, managed-browser expectations, backup restoration and resource behavior on real lower-memory devices. The review is a targeted source and regression assessment, not a guarantee of immunity to all attacks.

## Primary references

- [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html): local-device access, untrusted stored data and worker resource risks.
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab): permitted extension access to active page data.
