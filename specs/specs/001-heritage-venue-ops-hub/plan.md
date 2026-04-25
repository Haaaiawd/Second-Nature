# Implementation Plan: HeritageVenue Operations Hub

**Branch**: `001-heritage-venue-ops-hub` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-heritage-venue-ops-hub/spec.md`

## Summary

Build a fully offline venue operations hub as a Flask + HTMX + SQLite web application. The system serves five staff roles (Administrator, Inventory Clerk, Content Editor, Reviewer, Membership Agent) with local authentication, membership management with entitlement redemption, multi-warehouse inventory with immutable ledger tracking, a CMS with version-controlled content lifecycle, secure document management with watermarking, and a configuration/backup center. All data is persisted in SQLite with WAL mode. The application is delivered as a single Docker container per Constitution Principle I.

## Technical Context

**Language/Version**: Python 3.11  
**Primary Dependencies**: Flask >= 3.0, Flask-Login >= 0.6.3, Flask-WTF >= 1.2, argon2-cffi >= 23.1.0, Flask-Limiter >= 3.5.0, Flask-APScheduler >= 1.13.0, python-magic >= 0.4.27, cryptography >= 42.0.0, Pillow >= 10.2.0, pikepdf >= 8.0.0, simhash, datasketch, gunicorn >= 22.0, python-dotenv >= 1.0  
**Storage**: SQLite (WAL mode, `PRAGMA busy_timeout=10000`, `PRAGMA foreign_keys=ON`, `PRAGMA synchronous=NORMAL`)  
**Testing**: pytest + pytest-cov for unit tests, pytest + requests/Flask test client for API integration tests  
**Target Platform**: Linux (Docker container), accessed via desktop browser on LAN  
**Project Type**: fullstack (server-rendered web application)  
**Performance Goals**: All operations < 5 seconds at 10 concurrent users (SC-001 through SC-016)  
**Constraints**: Fully offline, single SQLite file, 1 Gunicorn worker + 4 threads, max 50 MB file upload  
**Scale/Scope**: 10 concurrent users, ~10K members, ~50K content versions, ~100K ledger entries, 6 blueprints, ~20 templates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Docker-First Containerized Delivery | PASS | Single `docker-compose.yml` with one service, `python:3.11-slim` base image, named volumes for SQLite + uploads, no private registries, no host dependencies |
| II | Production-Grade Architecture | PASS | Blueprint-per-module (6 blueprints), centralized models/services layers, routes are thin controllers, no business logic in route handlers, semantic directory names (`/models`, `/services`, `/auth`, etc.) |
| III | Comprehensive Testing | PASS | `unit_tests/` for services + business logic, `API_tests/` for endpoint validation + permission checks, `run_tests.sh` at project root |
| IV | Robust Error Handling & Observability | PASS | Structured error responses (400/401/403/404/409/422/429), user-friendly HTMX error feedback, audit log for critical flows, no debug prints |
| V | Strict Prompt Fidelity | PASS | All 54 functional requirements (FR-001 through FR-054, including sub-items) addressed in design, no features dropped, no technology substitutions weakening requirements |
| VI | Security & Input Validation | PASS | Argon2id password hashing, parameterized SQL (raw sqlite3), CSRF on all mutations, CSP headers, server-side validation on all inputs, no plaintext passwords |
| VII | Documentation Completeness | PASS | README.md with startup commands + service URLs + verification steps, `questions.md` for ambiguity record, quickstart.md for step-by-step |
| VIII | Clean Deliverable Hygiene | PASS | `.gitignore` for `__pycache__/`, `instance/`, `*.db`, `node_modules/`; `requirements.txt` for all deps; no TODO placeholders or debug statements |

### Post-Design Re-Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Docker-First | PASS | `docker-compose.yml` defined in quickstart.md, single service, explicit port 5000, `--workers 1 --threads 4` for SQLite compatibility |
| II | Architecture | PASS | 23 entities in data-model.md, 6 blueprint modules, services layer handles all business logic |
| III | Testing | PASS | Test structure defined in quickstart.md project layout |
| IV | Error Handling | PASS | Endpoint contracts define error codes for every endpoint; rate limiting returns 429; circuit-breaker returns read-only message |
| V | Prompt Fidelity | PASS | All FR-001 through FR-054 mapped to endpoints in contracts; deduplication, watermarking, encryption, idempotency all addressed |
| VI | Security | PASS | HMAC signatures on admin endpoints, CSRF via Flask-WTF, argon2-cffi, python-magic for file validation, Fernet for encryption |
| VII | Documentation | PASS | quickstart.md covers startup, verification, environment variables |
| VIII | Hygiene | PASS | requirements.txt, .gitignore, no scaffolding TODOs |

## Project Structure

### Documentation (this feature)

```text
specs/001-heritage-venue-ops-hub/
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions and rationale
├── data-model.md        # Phase 1: 23 entities with fields, constraints, indexes
├── quickstart.md        # Phase 1: startup + verification guide
├── contracts/
│   └── endpoints.md     # Phase 1: all HTTP endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
heritage_venue/
├── app/
│   ├── __init__.py              # create_app() factory
│   ├── config.py                # Config classes (Dev/Prod/Test)
│   ├── extensions.py            # Flask-Login, CSRFProtect, Limiter instances
│   ├── core/
│   │   ├── __init__.py
│   │   ├── database.py          # get_db(), close_db(), migrations, pragmas
│   │   ├── security.py          # Argon2 hashing, HMAC signing, CSP headers
│   │   ├── locking.py           # Distributed lock (acquire/release/reap)
│   │   ├── scheduler.py         # APScheduler setup (publish check, reaper)
│   │   ├── file_validation.py   # Magic-byte + extension validation
│   │   ├── encryption.py        # Fernet encrypt/decrypt for files + backups
│   │   └── watermark.py         # Pillow (images) + pikepdf (PDFs) watermarking
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py              # User dataclass + queries
│   │   ├── member.py            # Member, MembershipTier, EntitlementPackage
│   │   ├── inventory.py         # InventoryItem, Batch, Ledger, Order, Reservation
│   │   ├── content.py           # ContentItem, ContentVersion
│   │   ├── document.py          # Document, Folder, FolderACL
│   │   └── system.py            # Configuration, AuditLog, Lock, IdempotencyKey
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py      # Login, lockout, password change
│   │   ├── member_service.py    # Enrollment, redemption, blacklist, points
│   │   ├── inventory_service.py # Receive, transfer, ship, reserve, adjust
│   │   ├── cms_service.py       # Content CRUD, workflow, rollback, scheduling
│   │   ├── document_service.py  # Upload, folder CRUD, ACL, download + watermark
│   │   ├── backup_service.py    # Backup create/restore/retention
│   │   ├── dedup_service.py     # SimHash/MinHash scoring, merge proposals
│   │   └── audit_service.py     # Audit log writes and queries
│   ├── auth/
│   │   ├── __init__.py          # Blueprint registration
│   │   ├── routes.py            # Login, logout, change password
│   │   └── forms.py             # LoginForm, ChangePasswordForm
│   ├── membership/
│   │   ├── __init__.py
│   │   ├── routes.py            # Member CRUD, redemption, blacklist
│   │   └── forms.py             # MemberForm, RedemptionForm, etc.
│   ├── inventory/
│   │   ├── __init__.py
│   │   ├── routes.py            # Dashboard, receive, transfer, orders
│   │   └── forms.py             # ReceiveForm, TransferForm, OrderForm
│   ├── cms/
│   │   ├── __init__.py
│   │   ├── routes.py            # Content CRUD, workflow, dedup
│   │   └── forms.py             # ContentForm, ReviewForm, MergeForm
│   ├── documents/
│   │   ├── __init__.py
│   │   ├── routes.py            # Browse, upload, download, folder mgmt
│   │   └── forms.py             # UploadForm, FolderForm
│   └── admin/
│       ├── __init__.py
│       ├── routes.py            # Users, warehouses, config, backup, tiers
│       └── forms.py             # UserForm, ConfigForm, BackupForm
├── templates/
│   ├── base.html                # Layout: HTMX script, CSRF header, nav
│   ├── partials/
│   │   ├── _flash.html          # Flash messages
│   │   ├── _pagination.html     # Pagination controls
│   │   └── _safety_warnings.html # Inventory warnings
│   ├── auth/
│   │   ├── login.html
│   │   └── change_password.html
│   ├── membership/
│   │   ├── list.html
│   │   ├── detail.html
│   │   ├── form.html
│   │   └── partials/
│   ├── inventory/
│   │   ├── dashboard.html
│   │   ├── receive.html
│   │   ├── transfer.html
│   │   ├── ledger.html
│   │   ├── orders.html
│   │   └── partials/
│   ├── cms/
│   │   ├── list.html
│   │   ├── detail.html
│   │   ├── form.html
│   │   ├── review_queue.html
│   │   ├── dedup.html
│   │   └── partials/
│   ├── documents/
│   │   ├── browse.html
│   │   └── partials/
│   └── admin/
│       ├── dashboard.html
│       ├── users.html
│       ├── warehouses.html
│       ├── config.html
│       ├── backup.html
│       ├── tiers.html
│       ├── audit_log.html
│       └── partials/
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── htmx.min.js         # Vendored HTMX 2.0.x (offline)
│   └── img/
├── migrations/
│   ├── 001_initial_schema.sql   # All 23 tables, triggers, views, indexes
│   └── 002_seed_data.sql        # Default admin, default config, default tiers
├── unit_tests/
│   ├── test_auth_service.py
│   ├── test_member_service.py
│   ├── test_inventory_service.py
│   ├── test_cms_service.py
│   ├── test_document_service.py
│   ├── test_backup_service.py
│   ├── test_dedup_service.py
│   ├── test_locking.py
│   └── test_file_validation.py
├── API_tests/
│   ├── test_auth_endpoints.py
│   ├── test_membership_endpoints.py
│   ├── test_inventory_endpoints.py
│   ├── test_cms_endpoints.py
│   ├── test_document_endpoints.py
│   ├── test_admin_endpoints.py
│   └── test_security.py          # CSRF, rate limit, CSP, signature checks
├── run_tests.sh                  # Runs both unit_tests/ and API_tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── wsgi.py                       # gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 4 app:create_app()
├── .gitignore
├── README.md
└── questions.md                  # Business logic ambiguity record
```

**Structure Decision**: Single-project fullstack layout. Flask serves both HTML templates (via Jinja2 + HTMX) and the backing logic. No separate frontend build step. This matches the offline, server-rendered architecture described in the spec and avoids unnecessary complexity from a frontend/backend split.

**Delivery Structure** (Constitution VII/VIII): The final archive will use `fullstack/` as the project directory per the Constitution Delivery Structure Standard:
```text
archive_root/
├── fullstack/               # Project code (heritage_venue/ contents)
│   ├── app/
│   ├── templates/
│   ├── static/
│   ├── migrations/
│   ├── unit_tests/
│   ├── API_tests/
│   ├── run_tests.sh
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── README.md
├── prompt.md
├── sessions/
│   └── trajectory.json
├── questions.md
└── docs/
    ├── design.md
    └── api-spec.md
```
During development, the source lives at repository root as `heritage_venue/`. The delivery packaging step renames/moves it to `fullstack/`.

## Complexity Tracking

No constitution violations to justify. The design uses a single Docker service, a single database (SQLite), a single application process (Gunicorn with threads), and a straightforward layered architecture. All constitution principles pass without exceptions.
