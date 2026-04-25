# Quickstart: HeritageVenue Operations Hub

**Branch**: `001-heritage-venue-ops-hub` | **Date**: 2026-04-02

---

## Prerequisites

- Docker and Docker Compose installed
- No other services required (fully offline)

---

## One-Command Start

```bash
docker compose up --build
```

The application will be available at **http://localhost:5000**.

---

## Default Admin Account

On first startup, the system seeds an initial Administrator account:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Admin@1234` |

**Change this password immediately** via the Admin dashboard.

---

## Service Map

| Service | URL | Description |
|---------|-----|-------------|
| Web Application | http://localhost:5000 | Main application (Flask + HTMX) |
| Health Check | http://localhost:5000/health | JSON health status |

---

## Project Structure

```
heritage_venue/
├── app/
│   ├── __init__.py              # create_app() factory
│   ├── config.py                # Configuration classes
│   ├── extensions.py            # Flask extension instances
│   ├── core/
│   │   ├── database.py          # SQLite connection, migrations, pragmas
│   │   ├── security.py          # Password hashing, HMAC signing, CSP
│   │   ├── locking.py           # Distributed lock manager
│   │   ├── scheduler.py         # APScheduler setup
│   │   ├── file_validation.py   # Magic-byte + extension validation
│   │   ├── encryption.py        # Fernet encrypt/decrypt for files + backups
│   │   └── watermark.py         # Pillow (images) + pikepdf (PDFs) watermarking
│   ├── models/                  # Domain models (dataclasses)
│   ├── services/                # Business logic layer
│   │   ├── auth_service.py
│   │   ├── member_service.py
│   │   ├── inventory_service.py
│   │   ├── cms_service.py
│   │   ├── document_service.py
│   │   ├── backup_service.py
│   │   └── dedup_service.py
│   ├── auth/                    # Blueprint: authentication
│   ├── membership/              # Blueprint: membership management
│   ├── inventory/               # Blueprint: inventory operations
│   ├── cms/                     # Blueprint: content management
│   ├── documents/               # Blueprint: document management
│   └── admin/                   # Blueprint: admin & config
├── templates/
│   ├── base.html                # Layout with HTMX + CSRF setup
│   ├── partials/                # Shared HTMX partials
│   ├── auth/
│   ├── membership/
│   ├── inventory/
│   ├── cms/
│   ├── documents/
│   └── admin/
├── static/
│   ├── css/
│   ├── js/
│   │   └── htmx.min.js         # Vendored (offline)
│   └── img/
├── migrations/                  # Sequential SQL migration scripts
│   ├── 001_initial_schema.sql
│   └── 002_seed_data.sql
├── unit_tests/                  # Unit tests (Constitution III)
├── API_tests/                   # API integration tests (Constitution III)
├── run_tests.sh                 # Single test runner (Constitution III)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── wsgi.py                      # Gunicorn entry point
└── README.md
```

---

## Verification Steps

### 1. Start the application
```bash
docker compose up --build
```
Wait for the "Running on http://0.0.0.0:5000" message.

### 2. Health check
```bash
curl http://localhost:5000/health
# Expected: {"status": "ok"}
```

### 3. Sign in
Open http://localhost:5000 in a browser. Log in with `admin` / `Admin@1234`.

### 4. Create a test user
Navigate to Admin > Users. Create a user with role "MembershipAgent".

### 5. Enroll a member
Sign in as the MembershipAgent. Navigate to Membership > New Member. Fill in details and add an entitlement package.

### 6. Test redemption
From the member detail page, redeem an entitlement. Verify the count decreases.

### 7. Inventory receipt
Sign in as an InventoryClerk. Navigate to Inventory > Receive. Record a goods receipt.

### 8. Content lifecycle
Sign in as a ContentEditor. Create a draft, submit for review. Sign in as a Reviewer, approve it. Sign in as Editor, publish it. Verify version history.

### 9. Run tests
```bash
docker compose exec app bash run_tests.sh
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | Auto-generated | Flask session signing key |
| `DATABASE_PATH` | `/data/db/heritage_venue.db` | SQLite database path |
| `UPLOAD_PATH` | `/data/uploads` | File upload storage |
| `BACKUP_PATH` | `/data/backups` | Backup storage |
| `ENCRYPTION_KEY_PATH` | `/data/db/.encryption.key` | Encryption key file |
| `FLASK_ENV` | `production` | Flask environment |

---

## Stopping

```bash
docker compose down
```

Data is persisted in Docker volumes (`app_data`, `app_uploads`). To also remove data:

```bash
docker compose down -v
```
