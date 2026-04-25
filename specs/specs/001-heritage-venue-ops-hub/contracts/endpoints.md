# Endpoint Contracts: HeritageVenue Operations Hub

**Branch**: `001-heritage-venue-ops-hub` | **Date**: 2026-04-02  
**Transport**: HTTP (HTML fragments for HTMX, full pages for initial loads)  
**Auth**: Session cookie (Flask-Login) on all endpoints except login/health

---

## Conventions

- All state-changing endpoints require a valid CSRF token via `X-CSRFToken` header or form field
- HTMX requests include `HX-Request: true` header; endpoints return HTML fragments for HTMX, full pages otherwise
- Error responses: 400 (validation), 401 (unauthenticated), 403 (unauthorized/CSRF), 404 (not found), 422 (form errors — returns form partial with error messages), 429 (rate limit)
- Rate limit: 60 requests/minute/user (default), 429 with `Retry-After` header when exceeded
- Request signatures: `X-Signature` + `X-Signature-Timestamp` headers required on admin configuration endpoints

---

## 1. Authentication (`/auth`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/auth/login` | Public | Login page | — | 200: Full login page |
| POST | `/auth/login` | Public | Authenticate | Form: `username`, `password` | 302 -> dashboard; 422: form with error |
| POST | `/auth/logout` | Any | Sign out | CSRF token | 302 -> `/auth/login` |
| GET | `/auth/change-password` | Any | Password change form | — | 200: Password form |
| POST | `/auth/change-password` | Any | Submit password change | Form: `current_password`, `new_password`, `confirm_password` | 302 -> dashboard; 422: form with validation errors |

**Error cases**:
- Invalid credentials: 422 with "Invalid username or password"
- Account locked: 422 with "Account locked. Try again in X minutes"
- Password policy violation: 422 with specific requirement not met

---

## 2. Membership (`/membership`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/membership/members` | MembershipAgent | List members | Query: `q` (search), `page` | 200: Member list (partial or full) |
| GET | `/membership/members/new` | MembershipAgent | Enrollment form | — | 200: Enrollment form |
| POST | `/membership/members` | MembershipAgent | Create member | Form: member fields + entitlement fields | 201: Member detail partial; 422: form with errors |
| GET | `/membership/members/<id>` | MembershipAgent | Member detail | — | 200: Member detail with entitlements |
| POST | `/membership/members/<id>/edit` | MembershipAgent | Update member | Form: editable fields | 200: Updated detail; 422: form with errors |
| GET | `/membership/members/<id>/entitlements` | MembershipAgent | List entitlements | — | 200: Entitlements partial |
| POST | `/membership/members/<id>/entitlements` | MembershipAgent | Add entitlement | Form: `type_label`, `initial_quantity`, `valid_from`, `valid_until` | 201: Updated entitlements list; 422: form with errors |
| POST | `/membership/members/<id>/redeem` | MembershipAgent | Redeem entitlement | Form: `entitlement_id`, `quantity`, `idempotency_token` | 200: Redemption confirmation; 409: rejection reason |
| POST | `/membership/members/<id>/blacklist` | Admin | Toggle blacklist | Form: `is_blacklisted`, `reason` | 200: Updated member detail |
| POST | `/membership/members/<id>/tier` | MembershipAgent | Change tier | Form: `tier_id` | 200: Updated member detail |
| POST | `/membership/members/<id>/points` | MembershipAgent | Adjust points | Form: `amount`, `reason` | 200: Updated member detail |
| POST | `/membership/members/<id>/stored-value` | MembershipAgent | Adjust balance | Form: `amount_cents`, `reason` | 200: Updated member detail |

**Redemption error responses (409)**:
- `{"reason": "Entitlement expired on YYYY-MM-DD"}`
- `{"reason": "Entitlement fully used — 0 remaining"}`
- `{"reason": "Member is flagged — redemption not permitted"}`

---

## 3. Inventory (`/inventory`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/inventory/dashboard` | InventoryClerk | Dashboard with stock levels + warnings | — | 200: Dashboard page |
| GET | `/inventory/items` | InventoryClerk | List inventory items | Query: `q`, `page` | 200: Item list |
| POST | `/inventory/items` | Admin | Create item | Form: `name`, `sku`, `safety_stock_threshold` | 201: Item detail; 422: errors |
| GET | `/inventory/receive` | InventoryClerk | Receiving form | — | 200: Receive form |
| POST | `/inventory/receive` | InventoryClerk | Record receipt | Form: `item_id`, `warehouse_id`, `bin_id`, `batch_number`, `quantity`, `arrival_date`, `expiration_date`, `cost_per_unit` | 201: Ledger entry confirmation |
| GET | `/inventory/transfer` | InventoryClerk | Transfer form | — | 200: Transfer form |
| POST | `/inventory/transfer` | InventoryClerk | Initiate transfer | Form: source/dest warehouse+bin, `item_id`, `batch_id`, `quantity` | 201: Pending transfer; 409: insufficient stock |
| GET | `/inventory/ledger` | InventoryClerk | View ledger entries | Query: `item_id`, `warehouse_id`, `date_from`, `date_to`, `page` | 200: Ledger list |
| POST | `/inventory/adjust` | InventoryClerk | Submit count adjustment | Form: `item_id`, `warehouse_id`, `bin_id`, `batch_id`, `expected_qty`, `actual_qty`, `note` | 201: Adjustment (or pending approval); 422: errors |
| POST | `/inventory/cycle-count` | InventoryClerk | Perform cycle count | Form: `item_id`, `warehouse_id`, `bin_id`, `batch_id`, `actual_qty`, `note` | 201: Cycle count recorded (auto-creates adjustment vs expected on-hand, subject to variance approval per FR-035); 422: errors |
| GET | `/inventory/approvals` | Admin | Pending approvals list | — | 200: Approval queue |
| POST | `/inventory/approvals/<id>/approve` | Admin | Approve adjustment | — | 200: Approved confirmation |
| POST | `/inventory/approvals/<id>/reject` | Admin | Reject adjustment | Form: `reason` | 200: Rejected confirmation |

### Orders & Reservations

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/inventory/orders` | InventoryClerk | List orders | Query: `status`, `page` | 200: Order list |
| POST | `/inventory/orders` | InventoryClerk | Create order | Form: line items + `idempotency_token` | 201: Order detail (reserves inventory); 409: insufficient stock |
| GET | `/inventory/orders/<id>` | InventoryClerk | Order detail | — | 200: Order with reservations |
| POST | `/inventory/orders/<id>/approve` | Admin | Approve order | — | 200: Order approved (pending -> approved); 409: invalid state transition |
| POST | `/inventory/orders/<id>/ship` | InventoryClerk | Ship order | — | 200: Shipped confirmation; 409: insufficient available stock or order not approved |
| POST | `/inventory/orders/<id>/cancel` | InventoryClerk | Cancel order | — | 200: Canceled (reservations released); 409: already shipped |

---

## 4. CMS (`/cms`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/cms/content` | ContentEditor | List content items | Query: `status`, `type`, `q`, `page` | 200: Content list |
| GET | `/cms/content/new` | ContentEditor | Create content form | — | 200: Content form |
| POST | `/cms/content` | ContentEditor | Create content item | Form: `title`, `content_type`, `body`, `copyright_attribution`, media file | 201: Content detail (draft); 422: errors |
| GET | `/cms/content/<id>` | ContentEditor | Content detail + history | — | 200: Content detail with version list |
| POST | `/cms/content/<id>/edit` | ContentEditor | Update content (new version) | Form: updated fields | 200: Updated detail; 422: errors |
| POST | `/cms/content/<id>/submit-review` | ContentEditor | Submit for review | — | 200: Status updated to "in_review" |
| POST | `/cms/content/<id>/approve` | Reviewer | Approve content | Form: `comment` (optional) | 200: Status updated to "approved" |
| POST | `/cms/content/<id>/reject` | Reviewer | Reject content | Form: `comment` (required) | 200: Status updated to "draft" |
| POST | `/cms/content/<id>/publish` | ContentEditor | Publish immediately | — | 200: Status updated to "published" |
| POST | `/cms/content/<id>/schedule` | ContentEditor | Schedule publish | Form: `scheduled_publish_at` | 200: Scheduled confirmation |
| POST | `/cms/content/<id>/withdraw` | ContentEditor | Withdraw from publication | — | 200: Status updated to "withdrawn" |
| POST | `/cms/content/<id>/archive` | ContentEditor | Archive content | — | 200: Status updated to "archived" |
| POST | `/cms/content/<id>/rollback/<version_id>` | ContentEditor | Rollback to version | — | 200: New version created from target |
| GET | `/cms/content/<id>/history` | ContentEditor | Version history | — | 200: Version list partial |
| GET | `/cms/review-queue` | Reviewer | Items awaiting review | — | 200: Review queue list |

### Deduplication

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/cms/dedup` | ContentEditor | Deduplication tool | — | 200: Dedup interface |
| POST | `/cms/dedup/scan` | ContentEditor | Run dedup scan | — | 200: Candidate pairs with scores |
| POST | `/cms/dedup/merge` | ContentEditor | Propose merge | Form: `item_a_id`, `item_b_id`, field selections | 201: Merge proposal (pending reviewer approval) |
| POST | `/cms/dedup/merge/<id>/approve` | Reviewer | Approve merge | — | 200: Merge executed |
| POST | `/cms/dedup/merge/<id>/reject` | Reviewer | Reject merge | Form: `reason` | 200: Merge rejected |

---

## 5. Documents (`/documents`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/documents/browse` | Any | Browse folder tree | Query: `folder_id` | 200: Folder tree + document list |
| POST | `/documents/folders` | Admin | Create folder | Form: `name`, `parent_id`, `is_sensitive` | 201: Folder detail |
| POST | `/documents/folders/<id>/acl` | Admin | Manage folder ACL | Form: `user_id`, `action` (add/remove) | 200: Updated ACL |
| POST | `/documents/upload` | Any (access-checked) | Upload document | Multipart: `folder_id`, file | 201: Document detail; 400: validation error |
| GET | `/documents/<id>/view` | Any (access-checked) | View document metadata | — | 200: Document detail (audit logged) |
| GET | `/documents/<id>/download` | Any (access-checked) | Download file | — | 200: File stream (watermarked if sensitive folder; audit logged) |
| DELETE | `/documents/<id>` | Admin | Delete document | — | 200: Deletion confirmation |

---

## 6. Admin (`/admin`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/admin/dashboard` | Admin | Admin dashboard | — | 200: Dashboard |
| GET | `/admin/users` | Admin | User management | — | 200: User list |
| POST | `/admin/users` | Admin | Create user | Form: `username`, `password`, `display_name`, `roles` | 201: User detail; 422: errors |
| POST | `/admin/users/<id>/edit` | Admin | Update user | Form: editable fields | 200: Updated detail |
| POST | `/admin/users/<id>/disable` | Admin | Disable user | — | 200: User disabled |
| POST | `/admin/users/<id>/enable` | Admin | Enable user | — | 200: User enabled |
| GET | `/admin/warehouses` | Admin | Warehouse management | — | 200: Warehouse list |
| POST | `/admin/warehouses` | Admin | Create warehouse | Form: `name`, `address` | 201: Warehouse detail |
| POST | `/admin/warehouses/<id>/bins` | Admin | Add bin | Form: `label` | 201: Bin detail |
| GET | `/admin/config` | Admin | Configuration center | — | 200: Config page |
| POST | `/admin/config` | Admin | Update config | Form: key-value pairs (signed request) | 200: Updated config |
| GET | `/admin/tiers` | Admin | Membership tier management | — | 200: Tier list |
| POST | `/admin/tiers` | Admin | Create/update tier | Form: `name`, `points_threshold`, `sort_order` | 201: Tier detail |
| GET | `/admin/audit-log` | Admin | View audit log | Query: `user_id`, `action`, `date_from`, `date_to`, `page` | 200: Audit log list |

### Backup & Restore

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/admin/backup` | Admin | Backup management page | — | 200: Backup list + controls |
| POST | `/admin/backup/create` | Admin | Create backup | Signed request (uses configured BACKUP_PATH) | 200: Backup created confirmation |
| POST | `/admin/backup/restore` | Admin | Restore from backup | Form: `backup_file` (signed request) | 200: Restore confirmation |
| DELETE | `/admin/backup/<filename>` | Admin | Delete a backup | — | 200: Deletion confirmation |

---

## 7. System (`/`)

| Method | Path | Role | Description | Request | Success Response |
|--------|------|------|-------------|---------|-----------------|
| GET | `/` | Any | Redirect to role dashboard | — | 302 -> appropriate dashboard |
| GET | `/health` | Public | Health check | — | 200: `{"status": "ok"}` or `{"status": "read_only", "reason": "..."}` |
| GET | `/dashboard` | Any | Role-aware dashboard | — | 200: Dashboard page filtered by user roles |
