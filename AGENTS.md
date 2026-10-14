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
personal order access, and admin authorization when changing related behavior.

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

Keep local `.env` values, passwords, and JWTs out of source and tool output.
Preserve existing local configuration. Seed is additive and does not reset
prices or inventory. Keep the working database volume; ordinary shutdown uses
`docker compose stop db`, not volume removal.

Keep Russian teaching documentation consistent with the implemented API and
milestone scope. Update relevant run instructions when behavior changes.
Do not regenerate PDFs, reports, or the archive manifest for unrelated edits.
