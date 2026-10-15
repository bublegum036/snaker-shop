# Working in this workspace

## Project map

This is a Russian-language teaching bundle for a sneaker-shop backend.
Read `README.md` and `assignment.md` for context and requirements.
Git is initialized at the workspace root.

## Git workflow

Prepare and verify each agreed stage, then let the user review its code and
architecture before committing. The user explicitly requested on 2026-10-14
that commits must wait for their review; do not auto-commit completed stages.
Once approved, create a local commit describing that stage. Keep unfinished
changes out of stage-completion commits. Do not push, publish, or configure
a remote without explicit user authorization. The current workflow is local only.

## Communication

The user is an Angular frontend developer learning backend development.
Communicate in Russian and give a brief explanation at each stage: what it
does and why it is needed here. Use Angular/TypeScript analogies when useful,
and explain unfamiliar backend terms before relying on them.
Append new learning questions, answers, and corrections to the local ignored
`BACKEND-LEARNING-NOTES.md` as the conversation progresses. Keep this file
untracked; do not stage or publish it.
When asking the user to switch accounts in Swagger, include the login JSON
with the previously suggested fictional study credentials. If the actual
password is not known, state that the example works only if it was used at
registration. Do not save passwords or tokens in learning notes or reports.

- `presentation/sneaker-practice/`: runnable FastAPI backend, milestone guides, migrations, seed, and verification scripts.
- `frontend/`: Vue 3 / TypeScript / Vite application, Vue Router, Pinia; run instructions and stage notes in its README.
- `presentation/sneaker-backend.html` and adjacent JavaScript/CSS: offline interactive course presentation.
- `presentation/sneaker-*-examples/`: earlier instructional examples.
- `presentation/sneaker-backend-checks/`: presentation browser checks.
- `plans/sneaker-shop/`: presentation plan and slide map.
- `MANIFEST.sha256`: original bundle checksums; edits make affected entries stale.

## Backend development

Run backend commands from `presentation/sneaker-practice/`.
The stack is Python 3.11+, FastAPI, synchronous SQLAlchemy 2, PostgreSQL 17,
Psycopg, Alembic, and JWT authentication. Dependencies are pinned in
`requirements.txt`; older requirements files belong to earlier milestones.

Use the project README for full setup. Typical commands with an activated venv:

```sh
python -m pip install -r requirements.txt
python -m pip check
# Copy .env.example to .env only if .env does not already exist.
python setup_jwt.py
docker compose up -d --wait
python -m alembic upgrade head
python -m app.seed
python -m uvicorn app.final_main:app --reload --port 8000
```

`app.final_main:app` is the final entry point. `app.main:app` and the other
milestone entry points are instructional examples; preserve their purpose.
Do not assume the workspace-root `.venv` contains the backend dependencies.

Keep HTTP handling in `app/routers/`, validation in `app/schemas/`, business
logic in `app/services/`, and persistence definitions in `app/models/`.
Use Alembic migrations for schema changes. Follow existing synchronous session
and transaction patterns, especially `app/services/unit_of_work.py`.
Preserve atomic checkout, consistent locking, stock validation, price snapshots,
purchase-time name/size snapshots, personal order access, and admin authorization when changing related behavior.

## Verification

Choose checks appropriate to the changed milestone, from the backend directory:

```sh
python verify_m23.py
python verify_m45.py
python verify_final.py
```

Read the relevant script and milestone guide before running it. These checks
require a running PostgreSQL instance and permission to create and delete their
temporary databases. The final verifier also installs dependencies in a fresh
temporary environment. Existing verification reports describe earlier runs;
do not present them as evidence of a new run.

For presentation changes, consult `presentation/sneaker-backend-checks/README.md`;
its local package exposes `npm run check`. Preserve adjacent assets needed for
offline operation. Keep JSON prompt/report data and their presentation-facing
JavaScript copies consistent when editing them.

## Data and documentation

For frontend stages, run `npm run build` from `frontend/` with a compatible
Node.js (use frontend/.nvmrc: 24.19.0; ESLint 10 needs Node 20.19+,
22.13+ or 24+). Run `npm run lint` for frontend changes. Use `npm run check`
for lint, build and all isolated frontend scenarios; `npm run lint:fix` changes
source and must be reviewed. ESLint covers JS/TS/Vue and Stylelint covers CSS
and Vue style blocks; preserve both configurations and fix violations instead
of adding blanket disables. For authentication changes,
also run `npm run check:auth`; these isolated checks do not touch real accounts.
For cart changes, also run `npm run check:cart`; for checkout changes run
`npm run check:checkout` too; for order-history changes run `npm run check:orders`.
For admin-order changes run `npm run check:admin-orders`; backend admin-order
changes also require the disposable `verify_admin_orders.py` or full verifier.
For admin-product changes run `npm run check:admin-products`; for inventory
changes run `npm run check:admin-inventory`. Preserve role guards,
confirmation before deletion and explicit reconciliation after uncertain writes.
Use the shared ConfirmDialog for confirmations without changing page flow.
Explicit action successes across account, cart and admin flows use the shared
notifications store/host and expire after 3000ms. Keep persistent errors and
checkout receipts as page content; background reads should not emit success toasts.
Run `npm run check:notifications` when changing notifications or their timers. Preserve pending checkout keys across retries and
reloads, scope them to the user, and block cart mutations until the result is known.
Preserve server totals,
session isolation and the rule that uncertain additive POSTs are not auto-retried.
Keep session tokens and passwords out of source, logs, screenshots, and reports.
Use `*.api.ts` for domain API modules, `*.store.ts` for Pinia stores, and
`http.client.ts` for the shared HTTP client. Keep component styles and their
media queries in `<style scoped>`; global styles are for theme, base rules,
shared controls and utilities.
Keep user-facing component text in adjacent `ComponentName.texts.ts` modules
using `as const` objects and typed formatting functions. Keep store/API messages
in adjacent `*.texts.ts` modules too; templates should reference these constants.
Technical strings (routes, CSS classes, event names, API codes) stay with logic.
Keep each component and its texts in a `ComponentName/` folder, grouped under
`components/catalog/`, `components/cart/`, `components/auth/` or
`components/layout/`, `components/orders/`, `components/admin/` or
`components/common/`. Give each page its own `views/ViewName/` folder too.
Import `.vue` files directly; do not add a barrel file for every component.
Keep the root `src/App.vue` and shared API/store/router modules in their roles.
Keep page-local loading in `composables/orders/<composableName>/` or
`composables/admin/<composableName>/`,
with adjacent texts. Cancel reads on disposal and reset them when the session changes.
Group each Pinia store with its texts in `stores/<domain>/`, for example
`stores/cart/cart.store.ts` and `stores/cart/cart.store.texts.ts`.
Update direct imports and isolated SSR check paths when moving stores.

Keep local `.env` values, passwords, and JWTs out of source and tool output.
Preserve existing local configuration. Leave unknown legacy order snapshots null;
do not backfill them from the current catalog or rewrite cached checkout responses. Seed is additive and does not reset
prices or inventory. Keep the working database volume; ordinary shutdown uses
`docker compose stop db`, not volume removal.

Keep Russian teaching documentation consistent with the implemented API and
milestone scope. Update relevant run instructions when behavior changes.
Do not regenerate PDFs, reports, or the archive manifest for unrelated edits.

For inventory writes, reuse ProductSize fields, allow stock 0, and send only
changed PATCH fields. Editing size alone must not resubmit a stale stock value.
Preserve server restrictions on referenced variant rename/deletion.

Keep personal order reads scoped to the owner even for administrators. Use
separate admin order read routes with role checks in both HTTP and transaction.
Status changes require confirmation, allow only the next transition, and must
not alter stock, order item snapshots or saved checkout responses.


## Browser E2E checks

Frontend E2E lives in frontend/e2e/ with playwright.config.ts. Run
`npm run test:e2e` from frontend after `nvm use`; Chromium must be installed
with `npx playwright install chromium`. These agreed automated browser tests
use real FastAPI/PostgreSQL, three Chromium viewports and generated accounts.
Keep them separate from the DB-free `npm run check` command.

Preserve the disposable database runner, nonce readiness check through /api,
non-reused test servers (14200/18000) and cleanup on termination. Never point
purchase tests at the working servers on 4200/8000 or reuse personal accounts.
The runner must set DATABASE_URL before importing app modules and may delete
only the database it successfully created. Keep trace/video/auth-state exports
off and generated test results ignored; do not persist passwords or JWTs.
Run E2E for changes to its runner/config/specs or browser interaction flows.
Viewport assertions do not establish real-device coverage or native select
popup positioning; state those limitations explicitly when reporting results.


## Shared local development

Run `make dev`, `make status`, `make stop` from the workspace root on macOS/Linux.
Make wraps scripts/dev.py (stdlib Python supervisor) and check_local_backend.py
(backend venv, read-only configuration/database revision check).
Use `make check-launcher` for supervisor changes; verify lifecycle with separate
ports (`make dev API_PORT=18001 WEB_PORT=14201`) while preserving working servers.
`make check` selects compatible Node and runs the frontend lint/build/scenarios.

Preserve private Unix control socket/flock, child process group ownership,
occupied-port refusal, readiness through the frontend proxy and synchronous stop.
Never kill processes by port/name or adopt pre-existing servers. Keep .local/
untracked. PostgreSQL remains running after stop; never remove its volume.
Normal dev startup does not migrate/seed or overwrite environment files.
`make migrate` and `make seed` are explicit separate actions, not startup hooks.
