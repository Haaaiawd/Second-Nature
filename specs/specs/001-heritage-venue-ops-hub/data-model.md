# Data Model: HeritageVenue Operations Hub

**Branch**: `001-heritage-venue-ops-hub` | **Date**: 2026-04-02

---

## Entity Relationship Overview

```
User ──┬── AuditLog
       ├── ContentItem ── ContentVersion
       ├── Document ── Folder (hierarchical)
       └── Member ── EntitlementPackage ── Redemption

Warehouse ── Bin ── Batch
                └── InventoryLedgerEntry
                      └── Reservation ── Order

Configuration (key-value)
DistributedLock (serialization)
IdempotencyKey (dedup)
```

---

## Entities

### 1. User

Represents a staff member who can sign in and perform role-based operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| username | Text | UNIQUE, NOT NULL, max 64 chars | Login credential |
| password_hash | Text | NOT NULL | Argon2id hash |
| display_name | Text | NOT NULL, max 128 chars | Human-readable name |
| roles | Text | NOT NULL | Comma-separated role list (Admin, InventoryClerk, ContentEditor, Reviewer, MembershipAgent) |
| status | Text | NOT NULL, default 'active' | active / disabled |
| failed_login_attempts | Integer | NOT NULL, default 0 | Consecutive failed logins |
| locked_until | Timestamp | Nullable | Auto-unlock time after lockout |
| created_at | Timestamp | NOT NULL, default now | Account creation time |
| updated_at | Timestamp | NOT NULL, default now | Last modification time |

**Validation rules**:
- Username: alphanumeric + underscores, 3-64 characters
- Password: minimum 8 chars, >= 1 uppercase, >= 1 lowercase, >= 1 digit or symbol (validated at creation/change, not stored)
- Roles: at least one valid role required
- Lockout: triggered after 5 consecutive failed attempts, auto-unlocks after 15 minutes

---

### 2. Member

A venue visitor enrolled in the membership program.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| member_number | Text | UNIQUE, NOT NULL | Human-readable member ID |
| first_name | Text | NOT NULL, max 128 chars | First name |
| last_name | Text | NOT NULL, max 128 chars | Last name |
| email | Text | Nullable, max 256 chars | Contact email |
| phone | Text | Nullable, max 32 chars | Contact phone |
| tier_id | Integer | FK -> MembershipTier.id, NOT NULL | Current membership tier |
| points_balance | Integer | NOT NULL, default 0, >= 0 | Tier points |
| stored_value_usd | Decimal | NOT NULL, default 0.00, >= 0 | Stored value in USD (stored as integer cents) |
| is_blacklisted | Boolean | NOT NULL, default false | Blacklist flag |
| blacklist_reason | Text | Nullable | Reason for blacklisting |
| blacklisted_at | Timestamp | Nullable | When flagged |
| blacklisted_by | Integer | FK -> User.id, Nullable | Who flagged |
| created_by | Integer | FK -> User.id, NOT NULL | Enrollment agent |
| created_at | Timestamp | NOT NULL, default now | Enrollment time |
| updated_at | Timestamp | NOT NULL, default now | Last modification |

**Validation rules**:
- `stored_value_usd` stored as integer cents to avoid floating-point issues
- When `is_blacklisted` is true: redemption and check-in are blocked, but history is viewable
- `member_number` generated automatically (format: `HV-YYYYMMDD-NNNN`)

---

### 3. MembershipTier

Admin-configurable membership tier definitions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| name | Text | UNIQUE, NOT NULL, max 64 chars | Tier name (e.g., "Bronze", "Silver") |
| points_threshold | Integer | NOT NULL, >= 0 | Points needed for this tier |
| sort_order | Integer | NOT NULL | Display ordering |
| created_at | Timestamp | NOT NULL, default now | Creation time |

**Validation rules**:
- Tier promotion/demotion is manual by Membership Agent (no automatic progression)
- Points threshold is informational for agents; system does not auto-promote

---

### 4. EntitlementPackage

A redeemable benefit assigned to a member.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| member_id | Integer | FK -> Member.id, NOT NULL | Owning member |
| type_label | Text | NOT NULL, max 128 chars | e.g., "Guest Pass", "Audio-Guide Rental" |
| initial_quantity | Integer | NOT NULL, > 0 | Original allotment |
| remaining_quantity | Integer | NOT NULL, >= 0 | Current remaining |
| valid_from | Date | NOT NULL | Start of validity window |
| valid_until | Date | NOT NULL | End of validity window |
| created_by | Integer | FK -> User.id, NOT NULL | Agent who assigned |
| created_at | Timestamp | NOT NULL, default now | Assignment time |

**Validation rules**:
- `valid_until` must be >= `valid_from`
- `remaining_quantity` must never go below 0
- Redemption is rejected if: `valid_until < today`, `remaining_quantity == 0`, or `member.is_blacklisted == true`

**State transitions**: None (quantity decremented via Redemption records)

---

### 5. Redemption

Records each entitlement redemption event.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| entitlement_id | Integer | FK -> EntitlementPackage.id, NOT NULL | Which entitlement |
| member_id | Integer | FK -> Member.id, NOT NULL | Which member |
| quantity | Integer | NOT NULL, > 0 | Units redeemed |
| redeemed_by | Integer | FK -> User.id, NOT NULL | Agent who performed |
| redeemed_at | Timestamp | NOT NULL, default now | Redemption time |
| note | Text | Nullable | Optional notes |

**Validation rules**:
- Serialized per member via distributed lock (resource key: `entitlement:{member_id}`)
- After insert, `EntitlementPackage.remaining_quantity` is decremented within the same transaction

---

### 6. ContentItem

A piece of visitor-facing content managed through the CMS workflow.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| content_type | Text | NOT NULL, CHECK IN ('text','image','audio','video','link') | Content category |
| title | Text | NOT NULL, max 256 chars | Content title |
| status | Text | NOT NULL, default 'draft' | Current lifecycle status |
| current_version_id | Integer | FK -> ContentVersion.id, Nullable | Active version |
| copyright_attribution | Text | NOT NULL | Copyright/source attribution |
| scheduled_publish_at | Timestamp | Nullable | Scheduled publish time |
| simhash_fingerprint | Integer | Nullable | 64-bit SimHash for deduplication |
| created_by | Integer | FK -> User.id, NOT NULL | Original author |
| created_at | Timestamp | NOT NULL, default now | Creation time |
| updated_at | Timestamp | NOT NULL, default now | Last modification |

**State transitions**:
```
Draft -> In Review -> Approved -> Published -> Withdrawn -> Archived
                  \-> Rejected (back to Draft)
Rollback: Any version -> creates new version, status follows same workflow
```

**Validation rules**:
- `copyright_attribution` is required; cannot save without it (FR-018)
- `scheduled_publish_at` only valid when status is 'approved'
- Status: `draft`, `in_review`, `approved`, `published`, `withdrawn`, `archived`
- Rejection is not a separate status; a rejected item reverts to `draft` with the rejection comment recorded in the ContentVersion record (FR-019)

---

### 7. ContentVersion

An immutable snapshot of a content item at a point in time.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| content_item_id | Integer | FK -> ContentItem.id, NOT NULL | Parent content |
| version_number | Integer | NOT NULL | Sequential version (1, 2, 3...) |
| title | Text | NOT NULL | Title at this version |
| body | Text | Nullable | Text body / description |
| media_path | Text | Nullable | Path to media file |
| external_url | Text | Nullable | External link URL |
| copyright_attribution | Text | NOT NULL | Attribution at this version |
| status_from | Text | NOT NULL | Status before this version |
| status_to | Text | NOT NULL | Status after this version |
| review_comment | Text | Nullable | Reviewer comment (if applicable) |
| author_id | Integer | FK -> User.id, NOT NULL | Who made this change |
| created_at | Timestamp | NOT NULL, default now | Version creation time |

**Validation rules**:
- Immutable after creation (no UPDATE/DELETE)
- `version_number` auto-incremented per content_item_id
- Rollback creates a new version with content copied from the target version

---

### 8. Folder

A hierarchical container for documents with access controls.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| name | Text | NOT NULL, max 256 chars | Folder name |
| parent_id | Integer | FK -> Folder.id, Nullable | Parent folder (null = root) |
| is_sensitive | Boolean | NOT NULL, default false | Restricts access |
| created_by | Integer | FK -> User.id, NOT NULL | Creator |
| created_at | Timestamp | NOT NULL, default now | Creation time |

**Validation rules**:
- Sensitive folders: accessible only by Admins + users listed in FolderACL
- Non-sensitive folders: accessible by all authenticated staff

---

### 9. FolderACL

Per-folder access control list for sensitive folders.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| folder_id | Integer | FK -> Folder.id, NOT NULL | Which folder |
| user_id | Integer | FK -> User.id, NOT NULL | Authorized user |
| granted_by | Integer | FK -> User.id, NOT NULL | Admin who granted |
| granted_at | Timestamp | NOT NULL, default now | Grant time |

**Constraints**: UNIQUE(folder_id, user_id)

---

### 10. Document

A file uploaded to the document management system.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| folder_id | Integer | FK -> Folder.id, NOT NULL | Parent folder |
| filename | Text | NOT NULL, max 256 chars | Original filename |
| storage_path | Text | NOT NULL | Path on disk (possibly encrypted) |
| file_size | Integer | NOT NULL | Size in bytes |
| mime_type | Text | NOT NULL | Detected MIME type |
| is_encrypted | Boolean | NOT NULL, default false | Encrypted at rest flag |
| uploaded_by | Integer | FK -> User.id, NOT NULL | Uploader |
| uploaded_at | Timestamp | NOT NULL, default now | Upload time |

**Validation rules**:
- File size <= 50 MB (FR-038)
- Extension must match magic-byte detected MIME (FR-037)
- MIME type must be in allowed list (FR-039)
- Files in sensitive folders are encrypted at rest (FR-040)

**Download flow for encrypted + watermarked files** (FR-026 + FR-040):
1. Decrypt file from disk into memory (never write decrypted content to a temp file)
2. Apply watermark (username + timestamp) to the in-memory content (Pillow for images, pikepdf for PDFs)
3. Stream the watermarked content to the client
4. Log the download event to AuditLog (FR-027)

---

### 11. Warehouse

A physical storage location.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| name | Text | UNIQUE, NOT NULL, max 128 chars | Warehouse name |
| address | Text | Nullable, max 512 chars | Physical address |
| is_active | Boolean | NOT NULL, default true | Active/inactive |
| created_at | Timestamp | NOT NULL, default now | Creation time |

---

### 12. Bin

A specific placement location within a warehouse.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| warehouse_id | Integer | FK -> Warehouse.id, NOT NULL | Parent warehouse |
| label | Text | NOT NULL, max 64 chars | Bin label (e.g., "B-12") |
| is_active | Boolean | NOT NULL, default true | Active/inactive |
| created_at | Timestamp | NOT NULL, default now | Creation time |

**Constraints**: UNIQUE(warehouse_id, label)

---

### 13. InventoryItem

A merchandise product tracked in the system.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| name | Text | NOT NULL, max 256 chars | Product name |
| sku | Text | UNIQUE, NOT NULL, max 64 chars | Stock keeping unit |
| description | Text | Nullable | Product description |
| safety_stock_threshold | Integer | NOT NULL, default 0, >= 0 | Warning threshold |
| is_active | Boolean | NOT NULL, default true | Active/inactive |
| created_at | Timestamp | NOT NULL, default now | Creation time |

---

### 14. Batch

A specific lot of an inventory item tied to a warehouse/bin.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| item_id | Integer | FK -> InventoryItem.id, NOT NULL | Which product |
| warehouse_id | Integer | FK -> Warehouse.id, NOT NULL | Location |
| bin_id | Integer | FK -> Bin.id, NOT NULL | Specific bin |
| batch_number | Text | NOT NULL, max 64 chars | Batch/lot number |
| arrival_date | Date | NOT NULL | When received |
| expiration_date | Date | Nullable | Shelf-life expiration |
| cost_per_unit | Integer | NOT NULL, >= 0 | Cost in cents USD |
| created_at | Timestamp | NOT NULL, default now | Creation time |

**Constraints**: UNIQUE(item_id, warehouse_id, bin_id, batch_number)

---

### 15. InventoryLedgerEntry

An immutable record of an inventory movement. Append-only.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| item_id | Integer | FK -> InventoryItem.id, NOT NULL | Which product |
| warehouse_id | Integer | FK -> Warehouse.id, NOT NULL | Location |
| bin_id | Integer | FK -> Bin.id, NOT NULL | Specific bin |
| batch_id | Integer | FK -> Batch.id, NOT NULL | Which batch |
| movement_type | Text | NOT NULL, CHECK IN ('receive','transfer_in','transfer_out','adjust','ship','reserve','release') | Type of movement |
| quantity | Integer | NOT NULL | Positive for inbound, negative for outbound |
| order_id | Integer | FK -> Order.id, Nullable | Related order (if applicable) |
| reference_ledger_id | Integer | FK -> InventoryLedgerEntry.id, Nullable | Paired entry (for transfers) |
| idempotency_token | Text | Nullable | Dedup token |
| approved_by | Integer | FK -> User.id, Nullable | Approver (for adjustments) |
| note | Text | Nullable | Free-text note |
| created_by | Integer | FK -> User.id, NOT NULL | Who performed |
| created_at | Timestamp | NOT NULL, default now | Movement time |

**Validation rules**:
- Immutable: UPDATE and DELETE prevented by SQLite triggers
- Negative inventory check: before any outbound entry, verify `SUM(quantity) - reserved >= requested_qty` within transaction
- Adjustments exceeding variance threshold (2% or 5 units, whichever greater) require `approved_by` to be set

**Computed views**:
```
-- Current on-hand per item/location/batch
inventory_balance = SELECT item_id, warehouse_id, bin_id, batch_id, SUM(quantity) AS on_hand
                    FROM inventory_ledger_entry
                    GROUP BY item_id, warehouse_id, bin_id, batch_id

-- Available quantity per item (aggregated across all locations) for safety-stock warnings (FR-032)
inventory_available = SELECT ib.item_id,
                        SUM(ib.on_hand) AS total_on_hand,
                        COALESCE(r.reserved, 0) AS total_reserved,
                        SUM(ib.on_hand) - COALESCE(r.reserved, 0) AS available
                      FROM inventory_balance ib
                      LEFT JOIN (
                        SELECT item_id, SUM(quantity) AS reserved
                        FROM reservation
                        WHERE status = 'active'
                        GROUP BY item_id
                      ) r ON r.item_id = ib.item_id
                      GROUP BY ib.item_id
```

---

### 16. Order

A request to ship merchandise.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| order_number | Text | UNIQUE, NOT NULL | Human-readable order ID |
| status | Text | NOT NULL, default 'pending' | pending / approved / shipped / canceled |
| created_by | Integer | FK -> User.id, NOT NULL | Creator |
| created_at | Timestamp | NOT NULL, default now | Creation time |
| updated_at | Timestamp | NOT NULL, default now | Last status change |

**State transitions**:
```
pending -> approved -> shipped
pending -> canceled
approved -> canceled
```

---

### 17. OrderLine

Individual line items on an order.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| order_id | Integer | FK -> Order.id, NOT NULL | Parent order |
| item_id | Integer | FK -> InventoryItem.id, NOT NULL | Which product |
| quantity | Integer | NOT NULL, > 0 | Requested quantity |
| warehouse_id | Integer | FK -> Warehouse.id, NOT NULL | Source warehouse |
| bin_id | Integer | FK -> Bin.id, NOT NULL | Source bin |
| batch_id | Integer | FK -> Batch.id, NOT NULL | Source batch |

---

### 18. Reservation

A hold on inventory for a pending order.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| idempotency_token | Text | UNIQUE, NOT NULL | Dedup token (UUID4) |
| order_id | Integer | FK -> Order.id, NOT NULL | Related order |
| item_id | Integer | FK -> InventoryItem.id, NOT NULL | Reserved product |
| warehouse_id | Integer | FK -> Warehouse.id, NOT NULL | Location |
| bin_id | Integer | FK -> Bin.id, NOT NULL | Specific bin |
| batch_id | Integer | FK -> Batch.id, NOT NULL | Specific batch |
| quantity | Integer | NOT NULL, > 0 | Reserved units |
| status | Text | NOT NULL, default 'active' | active / released |
| created_at | Timestamp | NOT NULL, default now | Reservation time |
| released_at | Timestamp | Nullable | Release time |

**Validation rules**:
- On order cancellation: all reservations for that order are set to `released`, `released_at = now`
- Corresponding `release` ledger entry created when released

---

### 19. AuditLog

Records significant system events.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| user_id | Integer | FK -> User.id, NOT NULL | Who performed the action |
| action | Text | NOT NULL | Action type (login, logout, view_document, download_document, config_change, redemption, etc.) |
| target_type | Text | Nullable | Entity type (document, member, content_item, etc.) |
| target_id | Integer | Nullable | Entity ID |
| detail | Text | Nullable | Additional context (JSON) |
| ip_address | Text | Nullable | Client IP |
| created_at | Timestamp | NOT NULL, default now | Event time |

**Validation rules**:
- Append-only (no UPDATE/DELETE)
- Every document view/download must create an entry (FR-027)
- Login/logout events include IP address

---

### 20. Configuration

System-wide settings stored as key-value pairs.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | Text | PK | Setting name |
| value | Text | NOT NULL | Setting value (JSON-encoded for complex values) |
| description | Text | Nullable | Human-readable explanation |
| updated_by | Integer | FK -> User.id, Nullable | Last modifier |
| updated_at | Timestamp | NOT NULL, default now | Last change time |

**Default entries**:
- `session_timeout_minutes`: 30
- `rate_limit_per_minute`: 60
- `max_upload_size_mb`: 50
- `backup_retention_count`: 30
- `lockout_max_attempts`: 5
- `lockout_duration_minutes`: 15
- `inventory_variance_percent`: 2
- `inventory_variance_units`: 5
- `dedup_confidence_threshold`: 70
- `disk_space_min_mb`: 100
- `allowed_file_extensions`: `[".pdf",".jpg",".jpeg",".png",".tif",".tiff",".mp3",".mp4",".doc",".docx"]`

---

### 21. DistributedLock

Short-lived serialization records for critical operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| resource_key | Text | PK | Lock identifier (e.g., "entitlement:42") |
| owner_id | Text | NOT NULL | Request/session identifier |
| acquired_at | Timestamp | NOT NULL, default now | Acquisition time |
| expires_at | Timestamp | NOT NULL | TTL expiry (default +15 seconds) |

---

### 22. IdempotencyKey

Stores processed idempotency tokens to prevent duplicate operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| token | Text | PK | UUID4 token |
| resource_type | Text | NOT NULL | Operation type (reservation, redemption) |
| resource_id | Integer | Nullable | ID of created resource |
| response_code | Integer | NOT NULL | HTTP status of original response |
| response_body | Text | Nullable | JSON snapshot of original response |
| created_at | Timestamp | NOT NULL, default now | When processed |
| expires_at | Timestamp | NOT NULL | Cleanup deadline (default +24 hours) |

---

### 23. MergeProposal

Records proposed and executed content merges from the deduplication tool (FR-047, FR-049).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Integer | PK, auto-increment | Unique identifier |
| item_a_id | Integer | FK -> ContentItem.id, NOT NULL | First candidate |
| item_b_id | Integer | FK -> ContentItem.id, NOT NULL | Second candidate |
| confidence_score | Real | NOT NULL | Similarity score (0.0 - 1.0) |
| field_resolutions | Text | NOT NULL | JSON mapping of field -> source item for each resolved field |
| status | Text | NOT NULL, default 'pending' | pending / approved / rejected / executed |
| proposed_by | Integer | FK -> User.id, NOT NULL | Editor who proposed |
| reviewed_by | Integer | FK -> User.id, Nullable | Reviewer who approved/rejected |
| review_comment | Text | Nullable | Reviewer comment |
| surviving_item_id | Integer | FK -> ContentItem.id, Nullable | Item that survives after merge |
| created_at | Timestamp | NOT NULL, default now | Proposal time |
| resolved_at | Timestamp | Nullable | Approval/rejection/execution time |

**Validation rules**:
- `item_a_id` != `item_b_id`
- Status transitions: pending -> approved -> executed, or pending -> rejected
- `field_resolutions` JSON records which field value came from which source item (full audit trail per FR-049)
- Conflict resolution prefers most recently published, non-blank fields (FR-048)

---

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| Member | idx_member_number | member_number | Fast lookup by member number |
| Member | idx_member_blacklist | is_blacklisted | Filter blacklisted members |
| EntitlementPackage | idx_entitlement_member | member_id | Lookup entitlements by member |
| ContentItem | idx_content_status | status | Filter by lifecycle status |
| ContentItem | idx_content_scheduled | scheduled_publish_at, status | Scheduled publish query |
| ContentVersion | idx_version_content | content_item_id, version_number | Version history lookup |
| Document | idx_document_folder | folder_id | List documents in folder |
| InventoryLedgerEntry | idx_ledger_item_loc | item_id, warehouse_id, bin_id, batch_id | Balance computation |
| InventoryLedgerEntry | idx_ledger_created | created_at | Time-range queries |
| Reservation | idx_reservation_order | order_id | Lookup reservations by order |
| Reservation | idx_reservation_active | item_id, warehouse_id, bin_id, batch_id, status | Available qty computation |
| AuditLog | idx_audit_user | user_id | Lookup by user |
| AuditLog | idx_audit_target | target_type, target_id | Lookup by target entity |
| AuditLog | idx_audit_created | created_at | Time-range queries |
| DistributedLock | idx_lock_expires | expires_at | Reaper query |
| IdempotencyKey | idx_idemp_expires | expires_at | Cleanup query |
| FolderACL | idx_acl_folder | folder_id | Lookup ACL by folder |
| MergeProposal | idx_merge_status | status | Filter pending proposals |
