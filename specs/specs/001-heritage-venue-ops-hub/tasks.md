# Tasks: HeritageVenue Operations Hub

**Input**: Design documents from `/specs/001-heritage-venue-ops-hub/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/endpoints.md, quickstart.md

**Tests**: Tests are included per Constitution Principle III (Comprehensive Testing) as specified in plan.md. Unit tests in `unit_tests/` and API integration tests in `API_tests/`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `heritage_venue/` at repository root (fullstack server-rendered Flask app)
- Tests: `heritage_venue/unit_tests/`, `heritage_venue/API_tests/`
- Templates: `heritage_venue/templates/`
- Static: `heritage_venue/static/`
- Migrations: `heritage_venue/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency management, and base project structure

- [ ] T001 Create the `heritage_venue/` root directory and all subdirectories per plan.md project structure (`app/`, `app/core/`, `app/models/`, `app/services/`, `app/auth/`, `app/membership/`, `app/inventory/`, `app/cms/`, `app/documents/`, `app/admin/`, `templates/`, `templates/partials/`, `templates/auth/`, `templates/membership/`, `templates/inventory/`, `templates/cms/`, `templates/documents/`, `templates/admin/`, `static/css/`, `static/js/`, `static/img/`, `migrations/`, `unit_tests/`, `API_tests/`) with `__init__.py` files in all Python packages
- [ ] T002 Create `heritage_venue/requirements.txt` with all dependencies: Flask>=3.0, Flask-Login>=0.6.3, Flask-WTF>=1.2, argon2-cffi>=23.1.0, Flask-Limiter>=3.5.0, Flask-APScheduler>=1.13.0, python-magic>=0.4.27, cryptography>=42.0.0, Pillow>=10.2.0, pikepdf>=8.0.0, simhash, datasketch, gunicorn>=22.0, python-dotenv>=1.0, pytest, pytest-cov
- [ ] T003 [P] Create `heritage_venue/.gitignore` excluding `__pycache__/`, `instance/`, `*.db`, `*.pyc`, `.env`, `/data/`, `*.key`
- [ ] T004 [P] Create `heritage_venue/app/config.py` with Config, DevConfig, ProdConfig, TestConfig classes loading from environment variables (SECRET_KEY, DATABASE_PATH, UPLOAD_PATH, BACKUP_PATH, ENCRYPTION_KEY_PATH, FLASK_ENV) with defaults per quickstart.md
- [ ] T005 [P] Download and vendor HTMX 2.0.x minified JS to `heritage_venue/static/js/htmx.min.js` for offline operation
- [ ] T006 [P] Create `heritage_venue/static/css/style.css` with base application styles for a desktop-width venue operations dashboard (navigation sidebar, content area, tables, forms, flash messages, modals)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Implement `heritage_venue/app/core/database.py` with `get_db()` (connection-per-request using `g`), `close_db()`, `init_db()`, and SQLite pragmas (`PRAGMA journal_mode=WAL`, `PRAGMA busy_timeout=10000`, `PRAGMA foreign_keys=ON`, `PRAGMA synchronous=NORMAL`), migration runner that executes SQL files from `migrations/` in order
- [ ] T008 Create `heritage_venue/migrations/001_initial_schema.sql` with all 23 tables (User, Member, MembershipTier, EntitlementPackage, Redemption, ContentItem, ContentVersion, Folder, FolderACL, Document, Warehouse, Bin, InventoryItem, Batch, InventoryLedgerEntry, Order, OrderLine, Reservation, AuditLog, Configuration, DistributedLock, IdempotencyKey, MergeProposal), all indexes from data-model.md, immutability triggers on InventoryLedgerEntry and AuditLog (prevent UPDATE/DELETE), and computed views for inventory_balance and inventory_available
- [ ] T009 Create `heritage_venue/migrations/002_seed_data.sql` with default admin user (username: `admin`, Argon2id hash of `Admin@1234`), default configuration entries (session_timeout_minutes=30, rate_limit_per_minute=60, max_upload_size_mb=50, backup_retention_count=30, lockout_max_attempts=5, lockout_duration_minutes=15, inventory_variance_percent=2, inventory_variance_units=5, dedup_confidence_threshold=70, disk_space_min_mb=100, allowed_file_extensions JSON array), and default membership tiers (Bronze/Silver/Gold)
- [ ] T010 [P] Implement `heritage_venue/app/extensions.py` with shared Flask extension instances: LoginManager, CSRFProtect, Limiter (in-memory storage, 60/minute default)
- [ ] T011 [P] Implement `heritage_venue/app/core/security.py` with Argon2id hash/verify functions (time_cost=3, memory_cost=65536, parallelism=4), HMAC-SHA256 request signing/verification with 5-minute replay window, CSP header injection via `@app.after_request` with nonce generation
- [ ] T012 [P] Implement `heritage_venue/app/core/locking.py` with `acquire_lock(resource_key, owner_id, ttl=15)`, `release_lock(resource_key, owner_id)`, `reap_expired_locks()` using INSERT OR FAIL into DistributedLock table, context manager wrapper with polling retry
- [ ] T013 [P] Implement `heritage_venue/app/core/scheduler.py` with APScheduler BackgroundScheduler setup, separate SQLite file for job store, registration of scheduled jobs (publish check every 60s, lock reaper every 30s, idempotency cleanup every 3600s)
- [ ] T014 [P] Implement `heritage_venue/app/core/file_validation.py` with `validate_upload(file_storage)` that checks file extension against allowed list from Configuration, magic-byte detection via python-magic, extension-to-MIME matching, and 50 MB size limit enforcement
- [ ] T015 [P] Implement `heritage_venue/app/core/encryption.py` with Fernet key generation (`generate_key_if_missing(path)`), `encrypt_file(data, key)`, `decrypt_file(data, key)` functions, key file loading with `chmod 600` protection
- [ ] T016 [P] Implement `heritage_venue/app/core/watermark.py` with `watermark_image(image_bytes, username, timestamp)` using Pillow semi-transparent text overlay and `watermark_pdf(pdf_bytes, username, timestamp)` using pikepdf
- [ ] T017 Implement `heritage_venue/app/models/user.py` with User dataclass, `find_by_username(db, username)`, `find_by_id(db, id)`, `create_user(db, ...)`, `update_user(db, ...)`, `list_users(db)`, `increment_failed_attempts(db, user_id)`, `reset_failed_attempts(db, user_id)`, `set_locked_until(db, user_id, timestamp)`, `disable_user(db, user_id)`, `enable_user(db, user_id)` using parameterized SQL
- [ ] T018 [P] Implement `heritage_venue/app/models/system.py` with Configuration `get_config(db, key)`, `set_config(db, key, value, user_id)`, `get_all_config(db)` functions; AuditLog `create_entry(db, user_id, action, target_type, target_id, detail, ip_address)`, `query_log(db, filters, page)` functions; IdempotencyKey `check_and_store(db, token, resource_type, resource_id, response_code, response_body)`, `cleanup_expired(db)` functions
- [ ] T019 Implement `heritage_venue/app/services/audit_service.py` with `log_action(action, target_type, target_id, detail)` that wraps AuditLog model, auto-populates user_id from current_user and ip_address from request
- [ ] T020 Implement `heritage_venue/app/__init__.py` with `create_app(config_name)` factory function that: loads config, initializes extensions (LoginManager, CSRFProtect, Limiter), registers database teardown, runs migrations on first request, registers all 6 blueprints (auth, membership, inventory, cms, documents, admin), sets up CSP after_request handler, configures user_loader callback, implements health check endpoint at `/health`, and root redirect at `/`
- [ ] T021 Implement `heritage_venue/templates/base.html` with full HTML layout: nav sidebar with role-based menu items, HTMX script include, CSRF token in `hx-headers` on body, CSP nonce for inline script, flash message partial include, content block, HTMX responseHandling config for 422 swaps
- [ ] T022 [P] Create `heritage_venue/templates/partials/_flash.html` for flash message rendering, `heritage_venue/templates/partials/_pagination.html` for paginated list controls
- [ ] T023 Create `heritage_venue/wsgi.py` as Gunicorn entry point: `from app import create_app; app = create_app()`
- [ ] T024 [P] Create `heritage_venue/Dockerfile` using `python:3.11-slim` base, install system deps (libmagic1 for python-magic), copy requirements.txt and install, copy app code, expose port 5000, CMD gunicorn with `--bind 0.0.0.0:5000 --workers 1 --threads 4 wsgi:app`
- [ ] T025 [P] Create `heritage_venue/docker-compose.yml` with single service, build context, port 5000:5000, named volumes for `app_data:/data/db`, `app_uploads:/data/uploads`, bind mount for backups, environment variables per quickstart.md
- [ ] T026 [P] Create `heritage_venue/run_tests.sh` that runs `python -m pytest unit_tests/ API_tests/ -v --tb=short`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Staff Authentication and Role-Based Access (Priority: P1) MVP

**Goal**: Staff can sign in with local credentials, see only role-permitted screens, sessions expire after configurable timeout, unauthorized access is blocked

**Independent Test**: Create users with different roles, sign in, verify role-specific screen access, verify invalid credentials rejected, verify session timeout behavior, verify account lockout after 5 failed attempts

### Implementation for User Story 1

- [ ] T027 [US1] Implement `heritage_venue/app/services/auth_service.py` with `authenticate(db, username, password)` (checks account status, lockout, verifies Argon2id hash, resets/increments failed attempts, sets locked_until after 5 failures), `change_password(db, user_id, current, new)` with policy enforcement (8+ chars, upper+lower+digit/symbol), `check_session_timeout(session)` using configurable timeout from Configuration table
- [ ] T028 [US1] Implement `heritage_venue/app/auth/forms.py` with LoginForm (username, password fields with validators) and ChangePasswordForm (current_password, new_password, confirm_password with match validation and policy enforcement)
- [ ] T029 [US1] Implement `heritage_venue/app/auth/__init__.py` with blueprint registration (`auth_bp`, url_prefix `/auth`)
- [ ] T030 [US1] Implement `heritage_venue/app/auth/routes.py` with: GET/POST `/auth/login` (renders full page or HTMX partial, handles authentication, lockout display, redirect to dashboard), POST `/auth/logout` (logout and redirect), GET/POST `/auth/change-password` (form rendering and password change with policy validation), `@app.before_request` session timeout check that redirects to login with "session expired" message
- [ ] T031 [P] [US1] Create `heritage_venue/templates/auth/login.html` with login form (username, password, CSRF token, error display for invalid credentials and lockout messages)
- [ ] T032 [P] [US1] Create `heritage_venue/templates/auth/change_password.html` with password change form (current, new, confirm fields, policy requirements display, validation error rendering)
- [ ] T033 [US1] Implement role-based access control decorator in `heritage_venue/app/core/security.py`: `role_required(*roles)` decorator that checks `current_user.roles` against required roles, returns 403 "Access denied" page/partial for unauthorized access
- [ ] T034 [US1] Create `heritage_venue/templates/admin/dashboard.html` as the role-aware dashboard landing page at `/dashboard` that displays role-specific navigation and summary widgets based on current_user.roles
- [ ] T035 [US1] Implement unit tests in `heritage_venue/unit_tests/test_auth_service.py`: test successful authentication, test invalid password, test account lockout after 5 failures, test auto-unlock after 15 minutes, test password policy enforcement (too short, no uppercase, no digit/symbol), test disabled account rejection, test session timeout detection
- [ ] T036 [US1] Implement API tests in `heritage_venue/API_tests/test_auth_endpoints.py`: test login page renders, test successful login redirects to dashboard, test invalid login returns 422, test locked account returns 422 with lockout message, test logout redirects to login, test password change with valid/invalid inputs, test unauthenticated access redirects to login, test role-based access returns 403 for unauthorized roles, test session expiry redirects with message, test live role removal from signed-in user causes redirect on next request (Edge Case 5)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Staff can sign in, see role-appropriate screens, and sessions are managed securely.

---

## Phase 4: User Story 2 - Membership Enrollment and Entitlement Redemption (Priority: P1)

**Goal**: Membership Agents can enroll members, assign entitlements, redeem entitlements with proper validation (expired/exhausted/blacklisted), manage tiers and points

**Independent Test**: Enroll a member with entitlement packages, attempt redemptions under normal/expired/exhausted/blacklisted conditions, verify remaining counts update correctly

### Implementation for User Story 2

- [ ] T037 [P] [US2] Implement `heritage_venue/app/models/member.py` with Member dataclass and queries: `create_member(db, ...)`, `find_by_id(db, id)`, `find_by_member_number(db, number)`, `search_members(db, query, page)`, `update_member(db, ...)`, `toggle_blacklist(db, member_id, is_blacklisted, reason, user_id)`, `adjust_points(db, member_id, amount)`, `adjust_stored_value(db, member_id, amount_cents)`; MembershipTier queries: `list_tiers(db)`, `create_tier(db, ...)`, `update_tier(db, ...)`; EntitlementPackage queries: `create_entitlement(db, ...)`, `find_entitlements_by_member(db, member_id)`, `decrement_entitlement(db, entitlement_id, quantity)`; Redemption queries: `create_redemption(db, ...)`; member_number generation `HV-YYYYMMDD-NNNN`
- [ ] T038 [US2] Implement `heritage_venue/app/services/member_service.py` with: `enroll_member(data)` (validates fields, generates member_number, creates member + entitlement packages in transaction), `redeem_entitlement(member_id, entitlement_id, quantity, idempotency_token)` (acquires distributed lock on `entitlement:{member_id}`, checks blacklist/expiry/remaining, decrements in transaction, creates Redemption record, logs audit), `add_entitlement(member_id, data)`, `change_tier(member_id, tier_id)`, `adjust_points(member_id, amount, reason)`, `adjust_stored_value(member_id, amount_cents, reason)`, `toggle_blacklist(member_id, is_blacklisted, reason)` with audit logging for all operations
- [ ] T039 [US2] Implement `heritage_venue/app/membership/forms.py` with MemberForm (name, contact, tier, points, stored_value, entitlement fields with validation), RedemptionForm (entitlement_id, quantity, hidden idempotency_token), EntitlementForm (type_label, initial_quantity, valid_from, valid_until with date validation), BlacklistForm, TierChangeForm, PointsAdjustForm, StoredValueAdjustForm
- [ ] T040 [US2] Implement `heritage_venue/app/membership/__init__.py` with blueprint registration (`membership_bp`, url_prefix `/membership`)
- [ ] T041 [US2] Implement `heritage_venue/app/membership/routes.py` with all endpoints per contracts/endpoints.md Section 2: GET/POST `/membership/members` (list/create), GET `/membership/members/new` (form), GET/POST `/membership/members/<id>` (detail/edit), GET/POST `/membership/members/<id>/entitlements` (list/add), POST `/membership/members/<id>/redeem` (with idempotency), POST `/membership/members/<id>/blacklist` (Admin only), POST `/membership/members/<id>/tier`, POST `/membership/members/<id>/points`, POST `/membership/members/<id>/stored-value`; all with HTMX partial/full page dual-mode and proper role checks
- [ ] T042 [P] [US2] Create `heritage_venue/templates/membership/list.html` with member search, paginated table, HTMX-powered search with `hx-get`
- [ ] T043 [P] [US2] Create `heritage_venue/templates/membership/detail.html` with member info display, entitlement list, redemption form with idempotency token, blacklist status, points/stored-value adjustments, tier display
- [ ] T044 [P] [US2] Create `heritage_venue/templates/membership/form.html` with enrollment/edit form including entitlement package fields, validation error display
- [ ] T045 [US2] Implement unit tests in `heritage_venue/unit_tests/test_member_service.py`: test enroll member with valid data, test member_number generation format, test redeem entitlement success (count decrements), test redeem expired entitlement (rejected with reason), test redeem exhausted entitlement (rejected with "0 remaining"), test redeem blacklisted member (rejected), test concurrent redemption serialization (lock mechanism), test add entitlement to existing member, test tier change, test points/stored-value adjustment, test blacklist toggle
- [ ] T046 [US2] Implement API tests in `heritage_venue/API_tests/test_membership_endpoints.py`: test member list requires MembershipAgent role, test enrollment creates member with entitlements, test member detail renders correctly, test redemption success returns 200, test redemption failure returns 409 with specific reason, test duplicate idempotency token returns same result, test blacklist toggle requires Admin role, test points adjustment, test stored-value adjustment

**Checkpoint**: User Stories 1 AND 2 should both work independently. Core business operations (authentication + membership) are functional.

---

## Phase 5: User Story 3 - Inventory Receiving, Bin Placement, and Multi-Batch Tracking (Priority: P2)

**Goal**: Inventory Clerks can record goods receipts with batch tracking, view on-hand by warehouse/bin/batch, see safety-stock warnings

**Independent Test**: Perform goods receipt, verify ledger entry created, confirm bin-level and batch-level quantities, trigger safety-stock warning

### Implementation for User Story 3

- [ ] T047 [P] [US3] Implement `heritage_venue/app/models/inventory.py` with InventoryItem dataclass and queries: `create_item(db, ...)`, `find_by_id(db, id)`, `find_by_sku(db, sku)`, `list_items(db, query, page)`, `get_balance_by_item(db, item_id)` (using inventory_balance view); Batch queries: `create_batch(db, ...)`, `find_batch(db, ...)`, `list_batches(db, item_id, warehouse_id, bin_id)`; InventoryLedgerEntry queries: `create_entry(db, ...)`, `query_ledger(db, filters, page)` with parameterized SQL; Warehouse/Bin queries: `list_warehouses(db)`, `create_warehouse(db, ...)`, `list_bins(db, warehouse_id)`, `create_bin(db, ...)`
- [ ] T048 [US3] Implement `heritage_venue/app/services/inventory_service.py` with: `receive_goods(data)` (validates inputs, creates or finds Batch, creates immutable ledger entry with movement_type='receive', updates on-hand, audit logs), `get_dashboard_data()` (aggregates stock levels per item with available = on_hand - reserved, computes safety-stock warnings where available < threshold), `get_item_balance(item_id)` (warehouse/bin/batch breakdown), `query_ledger(filters)` (paginated ledger view)
- [ ] T049 [US3] Implement `heritage_venue/app/inventory/forms.py` with ReceiveForm (item_id, warehouse_id, bin_id, batch_number, quantity, arrival_date, expiration_date, cost_per_unit with validation)
- [ ] T050 [US3] Implement `heritage_venue/app/inventory/__init__.py` with blueprint registration (`inventory_bp`, url_prefix `/inventory`)
- [ ] T051 [US3] Implement receiving-related routes in `heritage_venue/app/inventory/routes.py`: GET `/inventory/dashboard` (stock levels + safety warnings), GET `/inventory/items` (item list), GET/POST `/inventory/receive` (receiving form and submission), GET `/inventory/ledger` (ledger view with filters); all with dual-mode HTMX/full-page and InventoryClerk role check
- [ ] T052 [P] [US3] Create `heritage_venue/templates/inventory/dashboard.html` with stock level summary table, safety-stock warning panel (highlighted items below threshold), warehouse breakdown, HTMX partial refresh
- [ ] T053 [P] [US3] Create `heritage_venue/templates/inventory/receive.html` with goods receipt form (item selection, warehouse/bin pickers, batch details, cost)
- [ ] T054 [P] [US3] Create `heritage_venue/templates/inventory/ledger.html` with filterable, paginated ledger table (date range, item, warehouse filters)
- [ ] T055 [P] [US3] Create `heritage_venue/templates/partials/_safety_warnings.html` with safety-stock warning display component for dashboard inclusion
- [ ] T056 [US3] Implement unit tests in `heritage_venue/unit_tests/test_inventory_service.py` (receiving subset): test receive_goods creates ledger entry and batch, test on-hand balance increments after receipt, test safety-stock warning triggers when available < threshold, test ledger entries are immutable (no UPDATE/DELETE)
- [ ] T057 [US3] Implement API tests in `heritage_venue/API_tests/test_inventory_endpoints.py` (receiving subset): test dashboard requires InventoryClerk role, test receive form renders, test goods receipt creates entry and returns 201, test ledger shows receipt entry, test dashboard shows safety-stock warnings

**Checkpoint**: Inventory receiving is functional. Clerks can record goods and view stock levels with warnings.

---

## Phase 6: User Story 4 - Inventory Transfer, Shipment, and Reservation (Priority: P2)

**Goal**: Transfers between warehouses, order creation with inventory reservation (idempotent), shipment, cancellation with auto-release, variance-threshold approval for adjustments

**Independent Test**: Create orders that reserve inventory, verify available quantity reduced, cancel order and confirm release, attempt shipment causing negative stock (refused), submit duplicate reservation (only one created)

### Implementation for User Story 4

- [ ] T058 [P] [US4] Extend `heritage_venue/app/models/inventory.py` with Order dataclass and queries: `create_order(db, ...)`, `find_order(db, id)`, `list_orders(db, status, page)`, `update_order_status(db, order_id, status)`; OrderLine queries: `create_order_line(db, ...)`; Reservation queries: `create_reservation(db, ...)`, `release_reservations(db, order_id)`, `find_active_reservations(db, item_id, warehouse_id, bin_id, batch_id)`; extend ledger queries for transfer and shipment entries
- [ ] T059 [US4] Extend `heritage_venue/app/services/inventory_service.py` with: `transfer_goods(data)` (validates source has sufficient available qty, creates paired transfer_out + transfer_in ledger entries with reference_ledger_id, uses distributed lock on source batch), `create_order(data, idempotency_token)` (checks idempotency, creates order + lines, reserves inventory per line, creates 'reserve' ledger entries, uses distributed lock on batch), `ship_order(order_id)` (validates order status is 'approved', checks available >= reserved, creates 'ship' ledger entries, updates order status), `cancel_order(order_id)` (releases all reservations, creates 'release' ledger entries, updates order status), `approve_order(order_id)` (pending -> approved), `submit_adjustment(data)` (compares expected vs actual qty, auto-approves if within variance threshold, creates pending approval if exceeds), `approve_adjustment(adjustment_id, user_id)`, `reject_adjustment(adjustment_id, reason)`, `cycle_count(data)` (records actual qty, computes difference, delegates to submit_adjustment)
- [ ] T060 [US4] Extend `heritage_venue/app/inventory/forms.py` with TransferForm (source/dest warehouse+bin, item, batch, quantity), OrderForm (line items with item/qty/source, hidden idempotency_token), AdjustmentForm (item, warehouse, bin, batch, expected_qty, actual_qty, note)
- [ ] T061 [US4] Implement transfer/order/adjustment routes in `heritage_venue/app/inventory/routes.py`: GET/POST `/inventory/transfer`, POST `/inventory/adjust`, POST `/inventory/cycle-count` (records actual qty, auto-computes expected from on-hand, delegates to adjustment logic per FR-050), GET `/inventory/approvals` (Admin), POST `/inventory/approvals/<id>/approve` (Admin), POST `/inventory/approvals/<id>/reject` (Admin), GET/POST `/inventory/orders`, GET `/inventory/orders/<id>`, POST `/inventory/orders/<id>/approve` (Admin, pending -> approved per FR-051), POST `/inventory/orders/<id>/ship`, POST `/inventory/orders/<id>/cancel`; all with proper role checks and HTMX dual-mode
- [ ] T062 [P] [US4] Create `heritage_venue/templates/inventory/transfer.html` with transfer form (source/dest warehouse and bin selectors, item/batch picker, quantity)
- [ ] T063 [P] [US4] Create `heritage_venue/templates/inventory/orders.html` with order list (status filter), order creation form with dynamic line items and idempotency token
- [ ] T064 [US4] Extend unit tests in `heritage_venue/unit_tests/test_inventory_service.py` (transfer/order subset): test transfer creates paired ledger entries, test transfer refused for insufficient stock, test order creation reserves inventory, test available quantity reduced by reservation, test order cancellation releases reservations, test ship order deducts inventory, test ship refused when available < requested, test idempotency token prevents duplicate reservation, test adjustment within variance auto-approves, test adjustment exceeding variance requires approval, test cycle count auto-creates adjustment
- [ ] T065 [US4] Extend API tests in `heritage_venue/API_tests/test_inventory_endpoints.py` (transfer/order subset): test transfer submission returns 201 or 409, test order creation with idempotency, test duplicate idempotency returns same result, test order approve (pending -> approved) requires Admin, test ship order success (only from approved), test ship order insufficient stock returns 409, test cancel order releases reservations, test cycle-count endpoint creates adjustment, test approval queue requires Admin, test approve/reject adjustment

**Checkpoint**: Full inventory management is operational. Receiving, transfers, orders, reservations, and adjustments all work with concurrency safety.

---

## Phase 7: User Story 5 - CMS Content Lifecycle with Versioning and Rollback (Priority: P2)

**Goal**: Content Editors create/edit content with attribution, submit for review, Reviewers approve/reject, scheduled publishing, version history with one-click rollback

**Independent Test**: Create draft, submit for review, approve, publish, withdraw, archive, rollback to prior version, verify complete history at each step

### Implementation for User Story 5

- [ ] T066 [P] [US5] Implement `heritage_venue/app/models/content.py` with ContentItem dataclass and queries: `create_content(db, ...)`, `find_by_id(db, id)`, `list_content(db, status, content_type, query, page)`, `update_status(db, id, new_status)`, `set_scheduled_publish(db, id, datetime)`, `update_fingerprint(db, id, simhash)`; ContentVersion queries: `create_version(db, ...)`, `list_versions(db, content_item_id)`, `find_version(db, version_id)`, `get_next_version_number(db, content_item_id)`; MergeProposal dataclass and queries: `create_proposal(db, ...)`, `find_proposal(db, id)`, `list_proposals(db, status)`, `update_proposal_status(db, id, status, reviewer_id, comment)`, `set_surviving_item(db, id, item_id)`
- [ ] T067 [US5] Implement `heritage_venue/app/services/cms_service.py` with: `create_content(data)` (creates ContentItem + initial ContentVersion v1 in draft, computes simhash fingerprint, audit logs), `update_content(content_id, data)` (creates new version, updates current_version_id), `submit_for_review(content_id)` (draft -> in_review, creates version entry), `approve_content(content_id, comment)` (in_review -> approved, Reviewer role check, creates version entry), `reject_content(content_id, comment)` (in_review -> draft, records rejection comment in version), `publish_content(content_id)` (approved -> published, creates version entry), `schedule_publish(content_id, datetime)` (sets scheduled_publish_at on approved items), `withdraw_content(content_id)` (published -> withdrawn), `archive_content(content_id)` (withdrawn -> archived), `rollback_to_version(content_id, version_id)` (copies target version content as new version, preserves full history), `check_scheduled_publishes()` (called by scheduler, publishes overdue approved items with scheduled_publish_at <= now, handles read-only mode deferral)
- [ ] T068 [US5] Implement `heritage_venue/app/cms/forms.py` with ContentForm (title, content_type select, body textarea, media file upload, external_url, copyright_attribution required, validation), ReviewForm (comment), ScheduleForm (scheduled_publish_at datetime picker)
- [ ] T069 [US5] Implement `heritage_venue/app/cms/__init__.py` with blueprint registration (`cms_bp`, url_prefix `/cms`)
- [ ] T070 [US5] Implement CMS routes in `heritage_venue/app/cms/routes.py` per contracts Section 4: GET/POST `/cms/content` (list/create), GET `/cms/content/new`, GET/POST `/cms/content/<id>` (detail/edit), POST `/cms/content/<id>/submit-review`, POST `/cms/content/<id>/approve` (Reviewer), POST `/cms/content/<id>/reject` (Reviewer), POST `/cms/content/<id>/publish`, POST `/cms/content/<id>/schedule`, POST `/cms/content/<id>/withdraw`, POST `/cms/content/<id>/archive`, POST `/cms/content/<id>/rollback/<version_id>`, GET `/cms/content/<id>/history`, GET `/cms/review-queue` (Reviewer); all with role checks and HTMX dual-mode
- [ ] T071 [P] [US5] Create `heritage_venue/templates/cms/list.html` with content list filterable by status/type, search, pagination, HTMX partial refresh
- [ ] T072 [P] [US5] Create `heritage_venue/templates/cms/detail.html` with content display, status badge, action buttons (submit/approve/reject/publish/withdraw/archive based on status and role), version history list with rollback buttons
- [ ] T073 [P] [US5] Create `heritage_venue/templates/cms/form.html` with content creation/edit form (title, type selector, body, media upload, external URL, copyright attribution required field)
- [ ] T074 [P] [US5] Create `heritage_venue/templates/cms/review_queue.html` with list of items in "in_review" status for Reviewer role
- [ ] T075 [US5] Implement unit tests in `heritage_venue/unit_tests/test_cms_service.py`: test create content with attribution, test version numbering (sequential), test submit for review transitions to in_review, test approve transitions to approved, test reject returns to draft with comment, test publish from approved, test scheduled publish executes at time, test scheduled publish deferred during read-only mode and publishes overdue items in order upon recovery (Edge Case 2), test withdraw from published, test archive from withdrawn, test rollback creates new version preserving history, test invalid transitions rejected (e.g., publish from draft), test copyright_attribution required
- [ ] T076 [US5] Implement API tests in `heritage_venue/API_tests/test_cms_endpoints.py`: test content list requires ContentEditor, test create content with attribution returns 201, test create without attribution returns 422, test full lifecycle (create -> review -> approve -> publish), test rollback endpoint, test review queue requires Reviewer role, test schedule publish, test version history endpoint

**Checkpoint**: CMS is fully operational. Content goes through the complete lifecycle with versioning, rollback, and scheduled publishing.

---

## Phase 8: User Story 7 - Security Controls and Rate Limiting (Priority: P2)

**Goal**: CSRF enforcement on all mutations, XSS prevention via output encoding, HMAC signatures on privileged endpoints, rate limiting (60/min), circuit-breaker read-only mode on disk issues

**Independent Test**: Submit forms without CSRF (rejected), inject script content (escaped on output), exceed rate limit (throttled), simulate disk-full (read-only message)

### Implementation for User Story 7

- [ ] T077 [US7] Implement circuit-breaker logic in `heritage_venue/app/core/database.py`: `check_disk_health()` function that checks if database is locked or disk free space is below `disk_space_min_mb` Configuration value (default 100 MB), `is_read_only_mode()` flag, `@app.before_request` check that blocks write operations with "read-only mode" response when circuit-breaker is active, auto-recovery when condition clears (disk space rises above threshold or lock released)
- [ ] T078 [US7] Implement HMAC signature validation middleware in `heritage_venue/app/core/security.py`: `@require_signature` decorator for privileged endpoints (admin config, backup create, backup restore) that validates `X-Signature` and `X-Signature-Timestamp` headers with 5-minute replay window
- [ ] T079 [US7] Add rate-limit configuration in `heritage_venue/app/extensions.py`: configure Flask-Limiter with `key_func` that uses `current_user.id` for authenticated users or `request.remote_addr` for anonymous, default 60/minute, custom 429 error handler that returns rate-limit message with Retry-After header (HTMX-aware partial)
- [ ] T080 [US7] Implement API tests in `heritage_venue/API_tests/test_security.py`: test POST without CSRF token returns 403, test XSS content is escaped in output (inject `<script>alert('x')</script>`, verify rendered as text), test rate limit returns 429 after 60 requests, test HMAC signature required on admin config endpoint, test invalid/expired signature rejected, test read-only mode message on simulated disk-full

**Checkpoint**: Security controls are in place. CSRF, XSS, rate limiting, HMAC signatures, and circuit-breaker all enforced.

---

## Phase 9: User Story 6 - Document Management with Access Controls and Watermarking (Priority: P3)

**Goal**: Hierarchical folder structure, sensitive folder ACL, watermarked downloads from sensitive folders, audit logging of all view/download events

**Independent Test**: Upload documents to folders with different access levels, verify restricted users blocked, download from sensitive folder and check watermark, review audit logs

### Implementation for User Story 6

- [ ] T081 [P] [US6] Implement `heritage_venue/app/models/document.py` with Folder dataclass and queries: `create_folder(db, ...)`, `find_folder(db, id)`, `list_subfolders(db, parent_id)`, `get_folder_tree(db)`; FolderACL queries: `add_acl(db, folder_id, user_id, granted_by)`, `remove_acl(db, folder_id, user_id)`, `get_acl(db, folder_id)`, `user_has_access(db, folder_id, user_id)` (returns True if user is Admin or in ACL for sensitive folders, True for all authenticated on non-sensitive); Document queries: `create_document(db, ...)`, `find_by_id(db, id)`, `list_by_folder(db, folder_id)`, `delete_document(db, id)`
- [ ] T082 [US6] Implement `heritage_venue/app/services/document_service.py` with: `create_folder(name, parent_id, is_sensitive)`, `manage_acl(folder_id, user_id, action)` (add/remove, Admin only), `upload_document(folder_id, file)` (calls `validate_upload()` from core/file_validation.py for extension+magic-byte+size checks, checks folder access, encrypts via core/encryption.py if sensitive folder, stores to UPLOAD_PATH, creates Document record with is_encrypted flag, audit logs), `view_document(document_id)` (checks access, audit logs view event, returns metadata), `download_document(document_id)` (checks access, decrypts if encrypted, watermarks if sensitive folder using watermark module, streams response, audit logs download event), `delete_document(document_id)` (Admin only, removes file and record). Note: T106 later adds edge-case error messages and the encryption-key startup check; this task builds the complete happy-path flow using core modules from Phase 2.
- [ ] T083 [US6] Implement `heritage_venue/app/documents/forms.py` with UploadForm (folder_id, file field with validation), FolderForm (name, parent_id, is_sensitive checkbox), ACLForm (user_id, action select add/remove)
- [ ] T084 [US6] Implement `heritage_venue/app/documents/__init__.py` with blueprint registration (`documents_bp`, url_prefix `/documents`)
- [ ] T085 [US6] Implement document routes in `heritage_venue/app/documents/routes.py` per contracts Section 5: GET `/documents/browse` (folder tree + document list), POST `/documents/folders` (Admin), POST `/documents/folders/<id>/acl` (Admin), POST `/documents/upload` (access-checked), GET `/documents/<id>/view` (access-checked, audit logged), GET `/documents/<id>/download` (access-checked, watermarked if sensitive, audit logged), DELETE `/documents/<id>` (Admin); all with HTMX dual-mode
- [ ] T086 [P] [US6] Create `heritage_venue/templates/documents/browse.html` with hierarchical folder tree navigation, document list per folder, upload button, folder creation controls (Admin), ACL management for sensitive folders (Admin), sensitivity badge display
- [ ] T087 [US6] Implement unit tests in `heritage_venue/unit_tests/test_document_service.py`: test upload to non-sensitive folder, test upload to sensitive folder encrypts file, test download from sensitive folder returns watermarked content, test non-Admin user blocked from sensitive folder without ACL, test Admin always has access, test ACL-listed user can access sensitive folder, test audit log created on view and download, test file validation rejects invalid uploads
- [ ] T088 [US6] Implement API tests in `heritage_venue/API_tests/test_document_endpoints.py`: test browse renders folder tree, test folder creation requires Admin, test upload to accessible folder returns 201, test upload to restricted folder returns 403, test download from sensitive folder returns watermarked file, test ACL management requires Admin, test audit log entries created, test delete requires Admin

**Checkpoint**: Document management is fully operational with access controls, watermarking, and audit trails.

---

## Phase 10: User Story 8 - Backup, Restore, and Configuration Center (Priority: P3)

**Goal**: Administrators manage system-wide config, create encrypted backups, restore with integrity verification, automatic retention enforcement

**Independent Test**: Create backup, verify encrypted and date-stamped, restore and confirm data integrity, change a config threshold and observe effect

### Implementation for User Story 8

- [ ] T089 [US8] Implement `heritage_venue/app/services/backup_service.py` with: `create_backup()` (uses configured BACKUP_PATH from app config, sqlite3 Connection.backup() for hot copy, encrypts with Fernet, generates SHA-256 checksum, creates date-stamped filename, writes manifest JSON, uses distributed lock to prevent concurrent backups, enforces retention by deleting oldest when count exceeds configured limit, audit logs), `restore_backup(backup_file)` (verifies SHA-256 checksum, decrypts, runs PRAGMA integrity_check on restored DB, applies restored data, audit logs), `list_backups()` (reads from configured BACKUP_PATH, returns sorted list with timestamps and sizes), `delete_backup(filename)`, `enforce_retention()` (removes oldest when count > configured limit)
- [ ] T090 [US8] Implement admin configuration and backup routes in `heritage_venue/app/admin/routes.py`: GET `/admin/dashboard` (admin summary), GET/POST `/admin/users` (user management with create), POST `/admin/users/<id>/edit`, POST `/admin/users/<id>/disable`, POST `/admin/users/<id>/enable`, GET/POST `/admin/warehouses` (warehouse management), POST `/admin/warehouses/<id>/bins` (add bin), GET/POST `/admin/config` (configuration center with HMAC-signed POST), GET/POST `/admin/tiers` (membership tier management), GET `/admin/audit-log` (searchable audit log with filters), GET `/admin/backup` (backup list), POST `/admin/backup/create` (HMAC-signed), POST `/admin/backup/restore` (HMAC-signed), DELETE `/admin/backup/<filename>`; all with Admin role check
- [ ] T091 [US8] Implement `heritage_venue/app/admin/__init__.py` with blueprint registration (`admin_bp`, url_prefix `/admin`)
- [ ] T092 [US8] Implement `heritage_venue/app/admin/forms.py` with UserForm (username, password, display_name, roles checkboxes), ConfigForm (dynamic key-value fields for each configuration entry), TierForm (name, points_threshold, sort_order), WarehouseForm (name, address), BinForm (label)
- [ ] T093 [P] [US8] Create `heritage_venue/templates/admin/users.html` with user list table, create user form, disable/enable toggles
- [ ] T094 [P] [US8] Create `heritage_venue/templates/admin/config.html` with configuration settings form (all configurable values grouped by category: session, security, inventory, upload, backup, dedup)
- [ ] T095 [P] [US8] Create `heritage_venue/templates/admin/backup.html` with backup list (date, size), create backup button, restore file selector, retention info display
- [ ] T096 [P] [US8] Create `heritage_venue/templates/admin/tiers.html` with tier list (name, points threshold, sort order), create/edit forms
- [ ] T097 [P] [US8] Create `heritage_venue/templates/admin/warehouses.html` with warehouse list, bin management per warehouse, create forms
- [ ] T098 [P] [US8] Create `heritage_venue/templates/admin/audit_log.html` with filterable, paginated audit log (user, action, target, date range filters)
- [ ] T099 [US8] Implement unit tests in `heritage_venue/unit_tests/test_backup_service.py`: test backup creates encrypted date-stamped file, test backup manifest contains SHA-256 checksum, test restore verifies integrity before applying, test concurrent backup rejected, test retention removes oldest when limit exceeded, test restore from corrupted file fails gracefully
- [ ] T100 [US8] Implement API tests in `heritage_venue/API_tests/test_admin_endpoints.py`: test all admin routes require Admin role, test user creation with valid/invalid data, test user disable/enable, test config update requires HMAC signature, test config change takes effect immediately, test backup create returns 200, test backup restore returns 200, test tier CRUD, test warehouse/bin CRUD, test audit log filters work

**Checkpoint**: Configuration center and backup/restore are operational. System is fully manageable by Administrators.

---

## Phase 11: User Story 9 - CMS Deduplication and Entity Resolution (Priority: P3)

**Goal**: Content Editors identify near-duplicate content items via fingerprinting, propose merges with confidence scores, Reviewers approve merges, conflict resolution prefers most-recent non-blank fields, full merge audit trail

**Independent Test**: Create two near-duplicate content items, run dedup scan, verify match with confidence score, approve merge, verify merged result retains correct fields with audit trail

### Implementation for User Story 9

- [ ] T101 [US9] Implement `heritage_venue/app/services/dedup_service.py` with: `compute_simhash(text)` (generates 64-bit SimHash fingerprint), `compute_minhash(text)` (generates MinHash signature using datasketch), `scan_duplicates()` (compares all content items using SimHash Hamming distance for candidate screening, then MinHash Jaccard similarity for precision, returns pairs above configurable threshold with confidence scores), `propose_merge(item_a_id, item_b_id, field_selections)` (creates MergeProposal with field-level resolution decisions per FR-048: prefer most recently published non-blank fields), `approve_merge(proposal_id)` (Reviewer executes merge: creates new version on surviving item with resolved fields, marks deprecated item as archived, records full audit trail of which fields came from which source per FR-049), `reject_merge(proposal_id, reason)`
- [ ] T102 [US9] Extend `heritage_venue/app/cms/routes.py` with deduplication endpoints per contracts Section 4 Deduplication: GET `/cms/dedup` (dedup tool interface), POST `/cms/dedup/scan` (run scan, return candidate pairs with scores), POST `/cms/dedup/merge` (propose merge, ContentEditor), POST `/cms/dedup/merge/<id>/approve` (Reviewer), POST `/cms/dedup/merge/<id>/reject` (Reviewer)
- [ ] T103 [P] [US9] Create `heritage_venue/templates/cms/dedup.html` with dedup interface: scan button, candidate pair list with confidence scores, side-by-side comparison view, field-by-field source selection for merge, merge proposal submit
- [ ] T104 [US9] Implement unit tests in `heritage_venue/unit_tests/test_dedup_service.py`: test SimHash produces consistent fingerprints, test similar content produces similar fingerprints (low Hamming distance), test MinHash Jaccard similarity matches expected range, test scan identifies near-duplicates above threshold, test merge proposal applies most-recent non-blank field resolution, test merge audit trail records field sources, test merge requires Reviewer approval
- [ ] T105 [US9] Implement API tests in `heritage_venue/API_tests/test_cms_endpoints.py` (dedup subset): test dedup scan returns candidate pairs, test merge proposal creation, test merge approval by Reviewer, test merge rejection, test merged result has correct fields

**Checkpoint**: Deduplication tool is operational. Content quality management is complete.

---

## Phase 12: User Story 10 - File Upload Validation and Encryption at Rest (Priority: P3)

**Goal**: Upload validation by extension + magic-byte, 50 MB limit, configurable allowed formats, sensitive files encrypted at rest

**Independent Test**: Upload valid/invalid files (wrong extension, oversized, disallowed type, mismatched magic bytes), verify only valid accepted, inspect raw stored sensitive files are encrypted

### Implementation for User Story 10

- [ ] T106 [US10] Harden file validation error handling in `heritage_venue/app/services/document_service.py`: add specific user-facing error messages to `upload_document()` for each validation failure ("File type does not match extension", "File exceeds the 50 MB limit", "File type not allowed"), ensure `validate_upload()` checks allowed_file_extensions from Configuration table at runtime (not cached), handle edge case of file with no extension (magic-byte only detection). Note: T082 already built the core upload flow with validation and encryption; this task adds error-message specificity and edge-case handling only.
- [ ] T107 [US10] Implement startup check in `heritage_venue/app/__init__.py` for encryption key: on app creation, call `generate_key_if_missing(ENCRYPTION_KEY_PATH)` from core/encryption.py, refuse to start if key file is missing/corrupted and sensitive files exist, log clear error message
- [ ] T108 [US10] Implement unit tests in `heritage_venue/unit_tests/test_file_validation.py`: test valid PNG accepted (correct extension + magic bytes), test renamed executable rejected (extension mismatch), test oversized file rejected (> 50 MB), test disallowed file type rejected, test file with no extension uses magic-byte detection only, test allowed_file_extensions config is respected
- [ ] T109 [US10] Extend API tests in `heritage_venue/API_tests/test_document_endpoints.py` (file validation subset): test upload valid file returns 201, test upload mismatched magic bytes returns 400, test upload oversized file returns 400, test upload disallowed type returns 400, test encrypted file on disk is unreadable without key

**Checkpoint**: File upload security is fully enforced. All uploads validated and sensitive files encrypted at rest.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, final documentation, and cleanup

- [ ] T110 [P] Create `heritage_venue/README.md` with project overview, architecture description (Flask + HTMX + SQLite), startup instructions (docker compose up --build), default admin credentials, service map (http://localhost:5000, /health), test execution command (docker compose exec app bash run_tests.sh), environment variables table, project structure overview
- [ ] T111 [P] Create `heritage_venue/questions.md` documenting all business logic ambiguity resolutions from spec.md clarifications section
- [ ] T112 Verify and fix all blueprint registrations in `heritage_venue/app/__init__.py` ensure all 6 blueprints (auth, membership, inventory, cms, documents, admin) are properly imported and registered with correct URL prefixes
- [ ] T113 Review all templates for consistent HTMX patterns: verify `hx-headers` CSRF injection works on all forms, verify dual-mode (full page vs partial) works on all endpoints, verify 422 response handling renders form errors inline
- [ ] T114 [P] Run full test suite via `heritage_venue/run_tests.sh` and fix any failures across all unit_tests/ and API_tests/
- [ ] T115 [P] Verify Docker build succeeds: `docker compose build` completes without errors
- [ ] T116 Run quickstart.md verification steps: start app, health check, sign in as admin, create test user, enroll member, test redemption, inventory receipt, content lifecycle, run tests
- [ ] T117 Security audit: verify no plaintext passwords in code/logs, no debug prints, no TODO placeholders, CSRF on all mutations, CSP headers present, rate limiting active, parameterized SQL everywhere (no string interpolation)
- [ ] T118 Performance spot-check: verify all operations complete within 5 seconds at single-user load per SC-001 through SC-016
- [ ] T119 [P] SC-012 scale validation: create a seed script `heritage_venue/unit_tests/seed_scale_data.py` that generates 10K members, 50K content versions, and 100K inventory ledger entries, then run backup and restore via backup_service and assert both complete within 10 minutes (SC-012)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) - No dependencies on other stories - **MVP**
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) - Independent of other stories
- **US3 (Phase 5)**: Depends on Foundational (Phase 2) - Independent of other stories
- **US4 (Phase 6)**: Depends on Foundational (Phase 2) + US3 (shares inventory models/service)
- **US5 (Phase 7)**: Depends on Foundational (Phase 2) - Independent of other stories
- **US7 (Phase 8)**: Depends on Foundational (Phase 2) - Cross-cutting security, can be implemented alongside other stories
- **US6 (Phase 9)**: Depends on Foundational (Phase 2) - Builds full document upload flow using core/file_validation and core/encryption from Phase 2
- **US8 (Phase 10)**: Depends on Foundational (Phase 2) - Independent, but admin routes serve as the management interface for all stories
- **US9 (Phase 11)**: Depends on US5 (CMS models and service must exist)
- **US10 (Phase 12)**: Depends on US6 (hardens error messages in document_service.py built by T082) + adds encryption key startup check
- **Polish (Phase 13)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **US3 (P2)**: Can start after Phase 2 - No dependencies on other stories
- **US4 (P2)**: Depends on US3 (extends inventory models/service) - Should follow US3
- **US5 (P2)**: Can start after Phase 2 - No dependencies on other stories
- **US7 (P2)**: Can start after Phase 2 - Cross-cutting, ideally done early
- **US6 (P3)**: Can start after Phase 2 - uses core/file_validation and core/encryption modules directly
- **US8 (P3)**: Can start after Phase 2 - Independent
- **US9 (P3)**: Depends on US5 (CMS must exist for dedup)
- **US10 (P3)**: Depends on US6 (hardens document_service.py error paths built by T082)

### Within Each User Story

- Models before services
- Services before routes
- Routes before templates
- Core implementation before tests
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003, T004, T005, T006)
- All Foundational tasks marked [P] can run in parallel (T010-T016, T018, T022, T024-T026)
- Once Foundational phase completes, US1, US2, US3, US5, US7, US8 can all start in parallel
- US4 must wait for US3; US9 must wait for US5; US10 must wait for US6
- Within each story, all templates marked [P] can be created in parallel
- Models in the same story marked [P] can be created in parallel

---

## Parallel Example: User Story 1

```bash
# Launch template creation in parallel:
Task: "Create login.html in heritage_venue/templates/auth/login.html"
Task: "Create change_password.html in heritage_venue/templates/auth/change_password.html"
```

## Parallel Example: User Story 3

```bash
# Launch template creation in parallel:
Task: "Create dashboard.html in heritage_venue/templates/inventory/dashboard.html"
Task: "Create receive.html in heritage_venue/templates/inventory/receive.html"
Task: "Create ledger.html in heritage_venue/templates/inventory/ledger.html"
Task: "Create _safety_warnings.html in heritage_venue/templates/partials/_safety_warnings.html"
```

## Parallel Example: Foundational Phase

```bash
# Launch all independent core modules in parallel:
Task: "Implement extensions.py in heritage_venue/app/extensions.py"
Task: "Implement security.py in heritage_venue/app/core/security.py"
Task: "Implement locking.py in heritage_venue/app/core/locking.py"
Task: "Implement scheduler.py in heritage_venue/app/core/scheduler.py"
Task: "Implement file_validation.py in heritage_venue/app/core/file_validation.py"
Task: "Implement encryption.py in heritage_venue/app/core/encryption.py"
Task: "Implement watermark.py in heritage_venue/app/core/watermark.py"
Task: "Implement system.py in heritage_venue/app/models/system.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Authentication)
4. **STOP and VALIDATE**: Test US1 independently (login, roles, lockout, timeout)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add US1 (Auth) -> Test independently -> Deploy/Demo (MVP!)
3. Add US2 (Membership) -> Test independently -> Deploy/Demo
4. Add US3 (Inventory Receiving) -> Test independently -> Deploy/Demo
5. Add US4 (Inventory Transfer/Orders) -> Test independently -> Deploy/Demo
6. Add US5 (CMS) -> Test independently -> Deploy/Demo
7. Add US7 (Security Controls) -> Test independently -> Deploy/Demo
8. Add US6 (Documents) + US10 (File Validation) -> Test independently -> Deploy/Demo
9. Add US8 (Backup/Config) -> Test independently -> Deploy/Demo
10. Add US9 (Deduplication) -> Test independently -> Deploy/Demo
11. Polish -> Final validation -> Release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Auth) -> US7 (Security)
   - Developer B: US2 (Membership) -> US8 (Backup/Config)
   - Developer C: US3 (Inventory Receiving) -> US4 (Transfer/Orders)
   - Developer D: US5 (CMS) -> US9 (Dedup)
   - Developer E: US6 (Documents) -> US10 (File Validation)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All SQL MUST use parameterized queries (never string interpolation)
- All passwords MUST use Argon2id hashing via argon2-cffi
- All file uploads MUST go through file_validation before storage
- HTMX requests detected via HX-Request header; return partial for HTMX, full page otherwise
- Constitution Principle III: unit_tests/ and API_tests/ directories with run_tests.sh
