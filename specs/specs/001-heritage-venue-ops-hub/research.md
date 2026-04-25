# Research: HeritageVenue Operations Hub

**Branch**: `001-heritage-venue-ops-hub` | **Date**: 2026-04-02  
**Purpose**: Resolve all technical unknowns and select implementation patterns before design.

---

## 1. Application Architecture (Flask + HTMX + SQLite)

**Decision**: Blueprint-per-module with centralized models/services layers, raw `sqlite3` with WAL mode, HTMX 2.0.x vendored locally.

**Rationale**: Blueprints keep routes thin (controllers only). Centralized models/services prevent circular imports across modules (e.g., `User` is shared by auth, admin, membership). Raw SQL gives full control over SQLite-specific pragmas (WAL, busy_timeout, foreign_keys) without ORM overhead. HTMX is vendored (~14KB) for fully offline operation.

**Alternatives considered**:
- Flask-SQLAlchemy ORM: Hides SQLite-specific features, adds overhead. Rejected.
- Models inside each blueprint: Causes circular imports when modules interact. Rejected.
- Full SPA (React/Vue): Violates the HTMX requirement, adds build tooling complexity for an offline app. Rejected.

---

## 2. SQLite Concurrency (10 Users)

**Decision**: WAL journal mode + `BEGIN IMMEDIATE` transactions + connection-per-request + `busy_timeout=10000`.

**Rationale**: WAL allows concurrent readers + one writer without blocking. `BEGIN IMMEDIATE` prevents deadlocks from read-to-write lock upgrades. `busy_timeout=10000` makes SQLite retry automatically for up to 10 seconds. For 10 concurrent users, this is well within SQLite's comfort zone without pooling.

**Configuration**:
- `PRAGMA journal_mode=WAL`
- `PRAGMA busy_timeout=10000`
- `PRAGMA foreign_keys=ON`
- `PRAGMA synchronous=NORMAL` (safe with WAL, ~2-3x faster writes)

**Alternatives considered**:
- PostgreSQL: Superior concurrency but violates offline/zero-external-services requirement. Rejected.
- SQLAlchemy connection pooling: Unnecessary at this scale; connection creation is ~0.1ms. Rejected.

---

## 3. Session Management

**Decision**: Flask's built-in signed cookie sessions (via `itsdangerous`) + Flask-Login for authentication state.

**Rationale**: For 10 users, session payload is tiny (user ID + flags). Signed cookies require zero database I/O for session reads. Flask-Login provides `login_required`, `current_user`, and session freshness. Persistent `SECRET_KEY` stored in a file ensures sessions survive restarts.

**Alternatives considered**:
- Flask-Session with SQLite backend: Adds a DB query on every request for no benefit at this scale. Rejected.
- JWT tokens: Anti-pattern for server-rendered apps; no session invalidation. Rejected.

---

## 4. HTMX Integration Patterns

**Decision**: CSRF token injected globally via `hx-headers` on `<body>`, dual-mode endpoints (full page vs. partial via `HX-Request` header detection), `422` status for validation errors.

**Rationale**: The `hx-headers` approach applies CSRF to all HTMX verbs (POST/PUT/DELETE) without per-form configuration. Detecting `HX-Request` lets endpoints serve both full-page (first load) and partial (HTMX swap) responses. HTMX 2.0 `responseHandling` config enables 422 swap for validation error forms.

**Alternatives considered**:
- Per-form hidden CSRF input only: Doesn't work for `hx-get`/`hx-delete` without form body. Rejected as sole approach.
- flask-htmx extension: One-line wrapper around a header check; not worth the dependency. Rejected.

---

## 5. Password Hashing

**Decision**: `argon2-cffi` (Argon2id variant) with `time_cost=3, memory_cost=65536 (64 MB), parallelism=4`.

**Rationale**: Argon2id is the OWASP-recommended algorithm, winner of the Password Hashing Competition. Memory-hardness (64 MB) resists GPU attacks better than bcrypt (fixed 4 KB). Critical for an offline system where stolen database = offline brute-force.

**Alternatives considered**:
- bcrypt: Still secure, simpler tuning, good fallback if argon2 C bindings cause build issues.
- Werkzeug `generate_password_hash`: Uses pbkdf2 by default, weaker against GPU attacks.

---

## 6. CSRF Protection

**Decision**: `Flask-WTF` global `CSRFProtect` checking both form fields and `X-CSRFToken` header.

**Rationale**: Flask-WTF's `CSRFProtect` handles the CSRF check globally for all state-changing requests. HTMX sends the token via the `X-CSRFToken` header (configured in `base.html`). Standard forms include the hidden `csrf_token()` field.

**Alternatives considered**:
- Double-submit cookie pattern: More complex, less necessary with server-side session state. Rejected.
- Manual implementation: CSRFProtect is battle-tested, not worth reinventing. Rejected.

---

## 7. Request Signature Validation

**Decision**: HMAC-SHA256 using Python's `hmac` + `hashlib` stdlib with constant-time comparison and 5-minute replay window.

**Rationale**: Standard library, zero dependencies, full control. `hmac.compare_digest()` prevents timing attacks. Timestamp + max-age prevents replay attacks.

**Alternatives considered**:
- `itsdangerous` signed URLs: Designed for serialization, not per-request signing. Rejected.
- JWT: Overkill for a single-origin offline system. Rejected.

---

## 8. Rate Limiting

**Decision**: `Flask-Limiter >= 3.5.0` with in-memory storage, keyed by user ID (authenticated) or remote address (anonymous), default 60/minute.

**Rationale**: Decorator-based per-endpoint limits, automatic `429` responses with `Retry-After` headers. In-memory backend is sufficient for a single-process offline app (no Redis needed).

**Alternatives considered**:
- Manual SQLite-backed counter: Full control and restart persistence, but significant implementation effort. Rejected for v1.
- No rate limiting: Violates FR-008. Rejected.

---

## 9. Content Security Policy

**Decision**: Manual `@app.after_request` handler setting CSP headers. `script-src 'self'` + nonce for inline HTMX config script.

**Rationale**: HTMX works under strict CSP (no `eval()`). Manual approach avoids Flask-Talisman's default HTTPS redirect (undesirable on offline LAN). Nonce-based inline script allowance for the CSRF config block.

**Headers**: `default-src 'self'`, `script-src 'self' 'nonce-{nonce}'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `frame-ancestors 'none'`, `form-action 'self'`.

**Alternatives considered**:
- Flask-Talisman: Forces HTTPS redirect by default; must disable for LAN. Adds dependency for a 15-line function. Rejected.

---

## 10. File Upload Validation

**Decision**: `python-magic >= 0.4.27` for MIME detection via magic bytes, combined with extension allowlist and 50 MB size check.

**Rationale**: Extension-only validation is trivially bypassed. Magic-byte sniffing reads the file header to determine actual format. Combination provides defense-in-depth per FR-037.

**Alternatives considered**:
- `filetype` (pure Python): Fewer signatures, but avoids libmagic system dependency. Viable fallback.
- `mimetypes` (stdlib): Extension-based only, not suitable for security. Rejected.

---

## 11. File Encryption at Rest

**Decision**: `cryptography >= 42.0.0` with Fernet (AES-128-CBC + HMAC-SHA256). Key generated once at setup, stored with `chmod 600`.

**Rationale**: Fernet is a high-level, misuse-resistant API with authenticated encryption. For files up to 50 MB, loading into memory for encryption/decryption is acceptable. Key stored in a file protected by OS permissions per FR-040.

**Alternatives considered**:
- AES-256-GCM via `cryptography.hazmat`: Lower-level, more room for misuse. No practical benefit at this threat model. Rejected for v1.
- PyCryptodome: More algorithms, higher risk of misuse. Rejected.

---

## 12. Watermarking

**Decision**: `Pillow >= 10.2.0` for image watermarks, `pikepdf >= 8.0.0` for PDF watermarks.

**Rationale**: Pillow handles semi-transparent text overlay on images. pikepdf is more robust than PyPDF2/pypdf for complex PDFs. Watermark is applied at download time per FR-026; original file is not modified.

**Alternatives considered**:
- PyPDF2/pypdf: Less robust for complex PDFs. Rejected in favor of pikepdf.
- reportlab: Good for generating the watermark overlay, can be combined with pikepdf. Optional enhancement.

---

## 13. Account Lockout

**Decision**: SQLite-backed failed attempt tracking on the `user` table (failed_attempts counter + locked_until timestamp). Auto-unlock after 15 minutes per FR-001b.

**Rationale**: SQLite persistence ensures lockout survives server restarts (in-memory tracking would allow bypass by restarting). Consistent with the existing stack; no additional tables needed.

**Alternatives considered**:
- In-memory tracking: Lost on restart, allows bypass. Rejected.
- Progressive exponential backoff: Better UX, more complex. Deferred to v2.

---

## 14. Immutable Inventory Ledger

**Decision**: Append-only `inventory_ledger` table with SQLite triggers preventing UPDATE/DELETE. Current balances computed via SQL `VIEW` using `SUM(quantity)` grouped by item/warehouse/bin/batch.

**Rationale**: FR-030 requires immutable entries. Triggers provide a database-level safety net. The VIEW approach avoids materialized table complexity while being fast enough for 100K entries at 10-user scale.

**Alternatives considered**:
- Materialized balance table updated by trigger: Write amplification, not needed at this scale. Rejected.
- Application-level immutability only: Triggers provide defense-in-depth. Rejected as sole approach.

---

## 15. Idempotency Tokens

**Decision**: Dedicated `idempotency_key` table with UNIQUE constraint on token. Check-then-insert within the same transaction as the business operation. Client generates UUID4 per form render.

**Rationale**: FR-034/SC-007 require exactly-once semantics. The token is generated server-side per form load (as a hidden field), so double-clicks submit the same token. Expired tokens cleaned up hourly.

**Alternatives considered**:
- UNIQUE on business fields (item+order+warehouse): Fragile, doesn't generalize. Rejected.
- Redis-based: Violates offline constraint. Rejected.

---

## 16. Distributed Lock (SQLite-Backed)

**Decision**: `distributed_lock` table with `INSERT OR FAIL` semantics, TTL column (default 15s), and periodic reaper. Context manager wrapper with polling retry.

**Rationale**: FR-016/FR-036 require serialization of entitlement redemption and batch allocation. SQLite's write lock + a lock table provides per-resource mutual exclusion for 10 concurrent users.

**Alternatives considered**:
- `BEGIN EXCLUSIVE`: Locks entire database, too coarse-grained. Rejected.
- `threading.Lock`: No TTL, no restart persistence, no visibility. Rejected.
- File-based `fcntl.flock`: Platform-dependent, no per-resource granularity. Rejected.

---

## 17. Content Fingerprinting (Deduplication)

**Decision**: SimHash for fast candidate screening (64-bit fingerprint stored per content version), MinHash (via `datasketch`) for precise Jaccard similarity scoring on candidate pairs.

**Rationale**: FR-045/FR-046 require fingerprinting with configurable confidence threshold (default 70%). SimHash provides O(1) comparison via Hamming distance for building candidate pairs. MinHash refines precision for SC-015 (>=85% precision when overlap >80%).

**Libraries**: `simhash`, `datasketch`

**Alternatives considered**:
- MinHash only: No compact single fingerprint for storage/indexing. Rejected as sole approach.
- TF-IDF + cosine: Heavier computation, requires vocabulary index. Overkill. Rejected.
- Exact hash (SHA-256): Only catches identical content, not near-duplicates. Rejected.

---

## 18. Scheduled Task Execution

**Decision**: `Flask-APScheduler` with `BackgroundScheduler`, separate SQLite file for job store, 60-second interval for publish checks.

**Rationale**: FR-020 requires scheduled publishing. APScheduler persists job state across restarts, handles misfires (coalesce=True), and requires no external infrastructure. Separate SQLite file avoids lock contention with the main database.

**Scheduled jobs**: publish check (60s), lock reaper (30s), idempotency key cleanup (3600s).

**Alternatives considered**:
- Background `threading.Timer`: No persistence, no misfire handling. Rejected.
- OS cron: Adds operational complexity, awkward for packaged offline app. Rejected.
- Celery: Requires broker (Redis/RabbitMQ), violates offline constraint. Rejected.

---

## 19. Backup and Restore

**Decision**: Python `sqlite3.Connection.backup()` for hot copy + Fernet encryption + SHA-256 checksum + `PRAGMA integrity_check` verification. Manifest JSON file alongside each backup.

**Rationale**: FR-041/FR-042 require encrypted, date-stamped, integrity-verified backups. The `backup()` API creates a consistent snapshot without stopping the app. Fernet encryption reuses the same key management as file encryption at rest.

**Retention** (FR-043): Sort backups by timestamp, remove oldest when count exceeds configured limit (default 30).

**Alternatives considered**:
- `.dump` SQL export: Slower, larger, poor BLOB handling. Rejected.
- `VACUUM INTO`: Requires SQLite 3.27+, less portable. Rejected.

---

## 20. Docker Compose Setup

**Decision**: Single `docker-compose.yml` service, `python:3.11-slim` base image, Gunicorn with 1 worker + 4 threads, named volumes for database and uploads, bind mount for backups.

**Rationale**: Constitution Principle I requires `docker compose up` with zero manual intervention. SQLite requires single-writer process, so 1 Gunicorn worker with threads (not multi-worker). Named volumes persist data across container recreation. Bind mount for backups allows host access.

**Critical**: `--workers 1 --threads 4` — SQLite cannot handle multiple writer processes.

**Alternatives considered**:
- Multiple workers + PostgreSQL: Violates offline/SQLite constraint. Rejected.
- uwsgi: Works, but Gunicorn is simpler and better documented for Flask. Rejected.

---

## Dependency Summary

| Category | Library | Version | Purpose |
|----------|---------|---------|---------|
| Framework | Flask | >= 3.0 | Web framework |
| Auth | Flask-Login | >= 0.6.3 | Authentication state |
| CSRF/Forms | Flask-WTF | >= 1.2 | CSRF protection + forms |
| Password | argon2-cffi | >= 23.1.0 | Argon2id password hashing |
| Rate Limit | Flask-Limiter | >= 3.5.0 | Per-user rate limiting |
| Scheduler | Flask-APScheduler | >= 1.13.0 | Scheduled publish + cleanup |
| File Magic | python-magic | >= 0.4.27 | Magic-byte file validation |
| Encryption | cryptography | >= 42.0.0 | Fernet encryption (files + backups) |
| Images | Pillow | >= 10.2.0 | Image watermarking |
| PDF | pikepdf | >= 8.0.0 | PDF watermarking |
| Dedup | simhash | latest | SimHash fingerprinting |
| Dedup | datasketch | latest | MinHash Jaccard similarity |
| Server | gunicorn | >= 22.0 | Production WSGI server |
| Config | python-dotenv | >= 1.0 | Environment config |

All other dependencies (sqlite3, hmac, hashlib, uuid, json, pathlib) are Python stdlib.
