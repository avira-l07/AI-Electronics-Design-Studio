# Submitted threat-report audit — v15.1

24 October 2026. Reviewed the supplied report against the checked-out source and isolated local test accounts. No external account probing, real email delivery, provider calls or customer-data access was performed.

## Verdicts

| Claim | Assessment | Action / boundary |
| --- | --- | --- |
| Team invitations reveal account existence | **Confirmed in the previous implementation.** Only existing verified recipients created pending `ProjectMember` rows, observable through the owner's member list and collaborator capacity. The report's Free-account scenario is incorrect: owner invitation management already requires Pro and is limited to ten invitations/hour. | Replaced account-dependent pending memberships with email-addressed `ProjectInvitation` rows for every invited address. Members disclose account IDs only after acceptance. Pending lists show the sender's own submitted email, opaque invitation ID, role and expiry, with no existence/verification status. Capacity accounts for all pending invitations uniformly. |
| Five incorrect passwords can deny the legitimate owner login | **Confirmed in the previous implementation.** The lock applies to the account across IPs. Persistent abuse could renew it; it did not revoke already authenticated sessions, and password reset was already available. | Keep account-wide attack detection, IP quotas and password hashing. During the step-up period, a correct password proceeds through existing MFA or a ten-minute email confirmation. The new confirmation link is hashed at rest, single-use, epoch-bound, and revoked by reset/logout-everywhere. Opening its page alone does not log in: the user must explicitly confirm. An existing unexpired link is retained, rather than invalidated by another attempt. |
| Preview login protects local projects but can be bypassed | **Local privacy risk is real; the account-security premise is incorrect.** Static mode explicitly uses password-free preview navigation. An email match is not authentication and does not grant access to backend accounts. Local projects use `engineering-studio-v1`, rather than the report's `studio-projects-v1`. | Added explicit account-page, dashboard and editor notices that anyone using the same browser profile can read local projects. Ending a preview session does not encrypt, erase or lock local data. Use separate OS/browser profiles for shared machines. No cosmetic password gate or encryption claim was added. |
| Stored project payloads execute JavaScript | **Not established by the submitted report.** It supplies no affected sink or working payload; `innerHTML` alone does not establish XSS. The reviewed name/comment/layer/text sinks escape text, and numeric sketch/model fields are validated. | Added browser regressions for imported HTML/event-handler strings in project names, sketch text/layers, evidence and 3D labels, plus rejection of attribute strings in numeric geometry. Existing project validation, prototype-key filtering and typed model validation remain. Passing these cases is not proof that every possible XSS path has been eliminated. |
| Worker CSP permits JavaScript/WASM evaluation | **Accurate configuration, documented compatibility exception.** The exception is returned only for `/solid-worker.js` under the API server. The vendored Manifold engine contains generated `new Function` bindings. WASM's narrower permission alone does not permit those bindings. | Retained the bounded worker exception to avoid breaking modelling. Main-page API responses still exclude both eval permissions; worker recipes remain validated data, not executable scripts. A future dependency upgrade should attempt to remove the JavaScript-eval requirement and retest actual solids. Static Sites hosting does not receive the API's response headers. |
| Production trusts arbitrary forwarded IP headers | **Not confirmed.** `ip_hash()` uses ASGI `request.client.host`. The supplied Uvicorn deployment trusts forwarded headers only from the fixed private Caddy address and loopback; only the proxy publishes public ports. | Added an API regression showing that rotating arbitrary `X-Forwarded-For` headers does not change the quota identity. Operators must preserve the trusted-proxy allowlist and verify it on the eventual host. |

## Invitation lifecycle and migration

`api/models.py` adds `project_invitations`. `api/collaboration.py` creates invitations without looking up an unaccepted target account. Verified recipients see matching invitations in their own inbox and explicitly accept; only then is a membership grant created. Existing accepted collaborators can still have their roles updated by the owner.

The owner can cancel a pending invitation without knowing whether an account exists. Invitations expire after seven days, are removed by operational cleanup, and cannot survive project Trash as an active grant. Account deletion removes invitations addressed to that account; deleting owned projects cascades their invitations. Account export includes invitations sent or received by that user.

`python -m api.migrate` applies schema version **0005**, converting legacy pending memberships into private email invitations and retaining accepted grants. The migration is repeatable and preserves project contents. Back up the database and run the reviewed migration before starting the upgraded backend. Do not call development `init-db` as a production migration.

## Sign-in behavior

Normal verified-account sign-in is unchanged. Wrong passwords never create confirmation tokens. When an account is in the attack-detection period, an owner with the correct password can use an already enabled second factor; otherwise a confirmation message enters the encrypted email outbox. No session cookie is issued until the required factor succeeds.

The confirmation route checks token purpose, expiry, single use, user epoch, verification, ban and deletion state. If MFA has since been enabled, it is still required. Links use the URL fragment, are removed from the current route after success and are not automatically submitted on page load. Real delivery requires the deployed SMTP worker; locally verified outbox contents are not a live mail acceptance test.

## Additional regression fixed

Browser testing also exposed a shared-workspace race: the Apply button remained enabled while presence polling held the shared busy flag, so its handler could silently ignore a click. Apply now displays its unavailable state during a poll and is restored according to the current role, joint restrictions and access state afterward. This keeps a click from being silently discarded by that poll. Remote polling also no longer refreshes an editor’s inspector fields implicitly: the editor explicitly reloads the selected part, while read-only viewer fields continue to update. If a selected part disappears, the editor’s draft is retained and Apply is disabled.

## Verification

- Full API regression suite: **125 passed**, including account recovery, token revocation/expiry/concurrent single use, registered/absent/unverified invitation observables, equal capacity behavior, recipient access, cancellation/expiry/Trash, proxy-header spoofing and repeatable legacy migration. SQLite was used; production PostgreSQL concurrency remains an acceptance task.
- `npm test`: all eleven JavaScript regression suites passed, including actual solid-kernel operations, project/import validation, geometry, saves, placement and export checks.
- Browser verification: **24 distinct checks passed across final focused runs**: 18 static import/privacy/recovery checks and six real API-backed account/team checks across desktop and phone viewports. This includes explicit email sign-in confirmation, pending-invitation cancellation, shared merge/conflict handling, retained editor drafts and access revocation. Synthetic accounts and isolated browser contexts were used. The final runs used a separate preview port/artifact directory after the shared preview stopped; early test-fixture failures and the discovered polling races were resolved.
- Changed JavaScript syntax checks, Python compilation and `git diff --check` pass.
- One existing Starlette/httpx test-client deprecation warning remains. No dependency versions were changed as part of this review.

## Publication and remaining operational work

The user-requested backend/cloud deployment hold remains in effect. Frontend notices and integration screens can be published to the existing static site; backend fixes are source changes until the account server is deployed with migration 0005. No site-access policy, billing activation, prices or Free/Pro entitlements were changed.

Before production acceptance: verify real SMTP recovery and link handling; HTTPS/cookies and trusted proxy addresses; PostgreSQL concurrent acceptance/token consumption; account/session isolation on real devices; dependency advisories; backups and restore; monitoring of failed sign-ins, outbox backlog and rate-limit saturation. This is a targeted source review and regression exercise, not a penetration-test certification.

## Primary references

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): generic responses, account-wide throttling and avoiding lockout-based denial of access.
- [MDN CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy): JavaScript evaluation and WebAssembly evaluation are distinct permissions.
