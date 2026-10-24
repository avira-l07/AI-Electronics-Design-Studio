# Zero-cost beta delivery — v15.3

24 October 2026. Budget: no paid services, no live charges and no paid AI calls.
The owner has authorized a free-tier beta. Actual hosted deployment depends on
account access and provider acceptance; this document distinguishes prepared
code, local verification and outstanding external work.

## Use the working local demonstration now

From `D:/AI Electronics Design Studio/engineering-studio`:

```powershell
.venv\Scripts\python.exe scripts/run-free-demo.py
```

Open `http://127.0.0.1:4203/#/login` while that command is running.

- Synthetic accounts: `owner@example.com`, `editor@example.com`, `viewer@example.com`.
- Shared synthetic password: `Synthetic demo password 739!`.
- The owner receives seven days of complimentary Pro, with no automatic renewal.
- Create projects, edit sketches/parts, save/reload, switch profiles and try team
  invitations/roles using separate browser profiles for the synthetic accounts.
- The server binds only to loopback and labels the UI as a local demonstration.
  Do not enter private/customer data. It is not a public deployment template.
- Ordinary signup still requires verification; no public token inbox or
  verification bypass was added. The three seed accounts are synthetic fixtures.
- By default no email is delivered, no payment is collected and AI is disabled.
- Isolated state and generated local keys live in ignored `tmp/local-free-demo/`.
  The existing development database, `.env` and browser preview data are untouched.
- `--check` verifies migration 0005, real account login, Pro profile limits and
  disabled providers without starting a server.

## Requested workstreams

| Item | Delivered in this iteration | Still not completed |
| --- | --- | --- |
| 1. Backend | Render Free blueprint, strict startup, Neon URL normalization/TLS requirement, migration 0005 startup and working local demo | No Render credentials/integration or authenticated Neon profile. No hosted database, HTTPS endpoint or backup restoration has been provisioned/verified |
| 2. Accounts | Real local login/profile/cloud-mode saves, consistent account/token locking, Resend HTTPS adapter and durable outbox retry | Real mailbox delivery, verified sender/domain, Google OAuth credentials/callback and physical-device acceptance |
| 3. Plans/payments | Operator-only expiring complimentary Pro; no Payment record/provider call; strict beta config rejects billing activation/live keys/paid AI | Merchant account/prices and actual Stripe test checkout/webhooks/refunds/cancellation acceptance. Commercial prices are not fabricated |
| 4. Collaboration | Existing real local multi-account tests; complimentary beta owner can manage teams; opt-in real PostgreSQL race harness and manual CI workflow | Hosted PostgreSQL execution/load, real users/devices and adverse-network acceptance |
| 5. Manufacturing/performance | Fixed owner loading above the retained recipe-cache lifecycle; deterministic eviction tests plus real geometry/browser checks; independent export parser checks retained | Actual CAD/slicer/toolpaths, fabrication/metrology, physical lower-memory devices and native browser/GPU exhaustion behavior |
| 6. Advanced CAD | Reliable loading and subsequent transforms of assemblies whose earlier recipe results were evicted | General constraints/solid operations, richer joints, exact STEP/BREP and validated FEA/CFD/SPICE are still engineering projects. Free open-source foundations exist; these are not simply paid-tier switches |
| 7. Stitch | Existing brief/reference bundle retained | No generated Stitch redesign file or connected Stitch tool was supplied; no redesign is claimed as integrated |
| 8. AI | Optional loopback Ollama adapter for installed phi4-mini:3.8b; actual inference, closed-solid kernel check and browser preview/apply/save/reload passed; paid providers disabled | Hosted live modelling and broader prompt/quality/performance acceptance. One synthetic part is not general AI or engineering validation |

## Reliability corrections

### Account/token locks

Verification, reset, MFA and email confirmation now resolve the account ID,
lock the account first, then lock and refresh the token. This matches session
revocation. Used/expired checks, factor validation and revocation remain intact.
Regression checks inspect actual ORM lock ordering and refresh a previously
cached token after another transaction consumes it. Real PostgreSQL races have
a separate acceptance harness; SQLite success is not labelled PostgreSQL proof.

### Large custom assemblies

The owner editor builds each custom mesh immediately after preparation instead
of warming all recipes and then looking them up in an evicting 32 MiB cache.
Unchanged custom geometry is cloned from the existing scene for synchronous
transform/group operations, with independent geometry/material ownership so
disposing the previous scene does not invalidate the new one. Failed loads keep
the prior scene and dispose staged meshes; original project JSON stays available.
The retained cache/queue limits and worker watchdog are not removed. This does
not guarantee survival of every oversized native GPU/browser allocation.

The single-process free backend also limits mutating handlers to two concurrent
requests, bounding simultaneous Argon2 work separately from request-rate limits.
Excess writes receive HTTP 429 with a short Retry-After value; this is deliberate
small-beta backpressure, not distributed capacity or a load-test guarantee.

Complimentary-access confirmation no longer claims a verified Stripe payment.
Checkout, billing portal and cancellation API routes reject disabled billing on
the server, so direct API calls cannot bypass the disabled beta buttons. Account
deletion recognizes complimentary subscriptions without calling Stripe for them.

## Free cloud setup, once accounts are available

1. Create/select Neon **Free** PostgreSQL. Keep a direct migration connection and
   use TLS; configure the application URL with `sslmode=require`. Do not use a
   pooled endpoint that rejects startup `options` for the PostgreSQL test harness.
2. Import `deploy/render.free.yaml` as the blueprint path. It defines one Free web
   service and no worker, cron job, persistent disk or paid database. Automatic
   deploy-on-push is disabled. Use the provider's supplied hostname; a purchased
   domain is not required for hosting. Render needs access to a supported Git
   repository containing this source; the existing Sites Git repository is not
   automatically connected to Render. No source-control account was connected
   or repository published by this iteration.
3. Set `DATABASE_URL`, stable random `JWT_SECRET` (48+ characters), a Fernet
   `ENCRYPTION_KEY`, `RESEND_API_KEY`, `MAIL_FROM` and verified platform
   `TRUSTED_PROXY_IPS`. Set secrets in environment settings, never chat/Git/URLs.
   Use `Fernet.generate_key()` to generate the encryption key locally. Don't
   replace it on each boot or existing encrypted outbox/MFA values become unreadable.
4. The launcher derives `APP_ORIGIN` from `RENDER_EXTERNAL_URL` if not supplied.
   It rejects wildcard/world-wide proxy trust, missing TLS database configuration
   and insecure environment choices. Proxy CIDRs must come from the actual host;
   no unverified value is invented. Verify HTTPS, apparent client IPs and cookies.
5. Configure Resend's free allowance and turn off transactional overages. A
   verified sending domain is required for general recipient delivery; a provider
   test sender is restricted. If the owner has no verified domain or acceptable
   free sender, general real email remains a separate setup dependency.
6. Keep `BILLING_ENABLED=false`, `ALLOW_LIVE_BILLING=false`, `AI_ENABLED=false`.
   Run `python -m api.cli grant-beta --email TEST_ACCOUNT --days 7` with the
   **free beta** environment to explicitly grant a verified tester complimentary
   Pro. There is no public grant endpoint. Expiry restores normal Free limits.
7. Test real signup/verification/reset, profile isolation, save conflicts,
   session revocation and team downgrade/revocation on the actual deployment.
8. Export project JSON regularly. Full database backup/restore still needs an
   actual database and PostgreSQL client tools; no automatic free backup job is
   claimed. Store private exports outside the public frontend and rehearse restore.

No cloud account, hosted server or paid resource was created by preparing these files. The
existing Sites publication remains a static preview with its audience preserved.

## Optional local AI — no paid API or model download

This computer already has Ollama and `phi4-mini:3.8b`. Start its local service in
one PowerShell window with cloud disabled:

```powershell
$env:OLLAMA_HOST='127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD='true'
$env:OLLAMA_NUM_PARALLEL='1'
$env:OLLAMA_MAX_QUEUE='2'
$env:OLLAMA_NOPRUNE='true'
$env:OLLAMA_KEEP_ALIVE='0'
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" serve
```

In another window, from this repository:

```powershell
.venv\Scripts\python.exe scripts/run-free-demo.py --local-ai
```

Log in as the synthetic owner, open the 3D workspace and choose **AI & team**.
Describe a polygon plate with optional round through holes, request a proposal,
inspect/edit it and explicitly choose **Add solid to assembly**. The proposal
itself does not change the project. Default startup omits this feature.

The adapter checks that the model is already installed, fixes the destination to
`127.0.0.1:11434`, ignores proxy environment variables, refuses redirects, bounds
response size/context/output, unloads the model after generation and permits one
inference at a time. It never calls a pull endpoint or falls back to OpenAI.
Public/production Ollama activation is rejected. Pro entitlement and the existing
five modelling requests/hour limit remain checked; failures consume quota too.
The frontend identifies local inference accurately. It sends the entered prompt;
the separate guide includes only its disclosed numeric context when opted in.

Two actual synthetic inferences were exercised: a plate with two holes passed the
Python recipe validator and real Manifold kernel closure/volume checks; the browser
flow then verified review without mutation, explicit apply, server save and reload.
The direct inference took 13.4 seconds here. This uses local GPU/RAM/electricity and
does not establish acceptable latency or quality on other computers or designs.
No model was downloaded and no paid/cloud AI request was made.

Repeat the explicit inference/kernel experiment only when desired:

```powershell
.venv\Scripts\python.exe tests/local-ai-acceptance.py
node tests/check-local-ai-geometry.cjs
```

## Email and sleeping-host limitations

`MAIL_TRANSPORT=resend` uses a fixed HTTPS endpoint with redirects disabled,
bounded timeout and a stable outbox-record idempotency key. Successful delivery
clears the encrypted payload; failures preserve it and defer retries. Provider
idempotency has a retention window; this is not exactly-once email certification.

`INLINE_MAIL=true` is allowed only for configured Resend delivery in free beta.
It attempts at most two pending messages after a modifying API response finishes.
It does not poll/keep the host awake. Sleeping/restarting the host or a lack of
new modifying requests delays retries. The existing explicit `send-mail` command
can drain the outbox; a separate always-on worker remains the production option.
No authenticated user is given arbitrary mail or token access.

Free Render services sleep after idle periods and lose local filesystem changes;
keep durable hosted data in PostgreSQL. Free Render Postgres expires after 30 days,
so the blueprint does not create one. Render's common SMTP restrictions and lack
of free workers are the reason for the HTTPS/request-triggered adaptation.

## PostgreSQL acceptance

```powershell
# Configure PG_ACCEPTANCE_URL securely for a dedicated test database first.
.venv\Scripts\python.exe tests/postgres-acceptance.py
```

The harness creates a randomly named disposable schema, applies migration 0005,
checks five simultaneous MFA/revocation races and removes only that schema. It
never falls back to the development database. Without the dedicated URL it exits
with **NOT RUN**. A manual `.github/workflows/postgres-acceptance.yml` can run the
same harness with a disposable PostgreSQL 17 service when the repository is in
an appropriate GitHub account. No remote workflow or billed CI run was triggered.

## Verification

Final local verification:

- **169 API tests passed**; one existing Starlette/httpx deprecation warning.
- **103 browser checks passed, one expected phone skip**. The full run initially
  passed 101 and exposed an overly broad confirmation-page test selector in two
  cases. After narrowing it, both cases passed on rerun; no failed cases remain.
- All **12 JavaScript suites** and the **47-public-asset guard** passed.
- **14 independent STL/OBJ parser checks** passed; this is not slicer acceptance.
- Real local demo login/3D checks passed at desktop/phone sizes.
- Actual local-model recipe/kernel/browser acceptance passed as described above.
- Both default and optional-local-AI launcher checks passed with migration 0005.
- Python compilation and the local free-blueprint resource guard passed.

No real provider email, Google authorization, Stripe transaction, physical
fabrication or hosted PostgreSQL acceptance is claimed.

The temporary demo, Ollama and browser servers used here were stopped after QA.
Use the documented commands to start your local demo again. The separately hosted
Sites frontend cannot access Ollama on a visitor's computer through this adapter.

## Official references

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://render.com/articles/fastapi-production-best-practices
- https://neon.com/pricing
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/pricing
- https://docs.ollama.com/api/generate
