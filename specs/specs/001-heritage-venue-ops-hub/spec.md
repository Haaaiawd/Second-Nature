# Feature Specification: HeritageVenue Operations Hub

**Feature Branch**: `001-heritage-venue-ops-hub`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Design a HeritageVenue Operations Hub to run a fully offline venue business that sells memberships, publishes visitor content, and manages on-hand merchandise across one or more storage locations. Users sign in with a locally verified username and password and then work through role-based screens built with HTMX for fast, page-without-refresh interactions..."

## Clarifications

### Session 2026-04-02

- Q: How are "designated supervisors" for sensitive folders determined — per-folder ACL, a global Supervisor role, or a hybrid? → A: Per-folder ACL. Administrators assign specific users as supervisors on each sensitive folder individually.
- Q: How many concurrent users must the system support while meeting latency targets? → A: Up to 10 concurrent users (small-to-medium venue staffing).
- Q: What password policy should be enforced for staff accounts? → A: Minimum 8 characters, requiring uppercase + lowercase + at least one digit or symbol.
- Q: Are membership tiers fixed or configurable, and how do points relate to tier progression? → A: Admin-configurable tiers with points thresholds; promotion is manual by Membership Agent (no automatic upgrade/downgrade).
- Q: What happens after repeated failed login attempts? → A: Temporary lockout after 5 consecutive failed attempts; account auto-unlocks after 15 minutes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Authentication and Role-Based Access (Priority: P1)

A staff member opens the HeritageVenue Operations Hub on a local workstation. They enter their username and password, which is verified entirely offline against locally stored credentials. After signing in, they see only the screens and actions permitted by their assigned role (Administrator, Inventory Clerk, Content Editor, Reviewer, or Membership Agent). Unauthorized navigation attempts are blocked with a clear "access denied" message. Sessions expire after a configurable inactivity timeout.

**Why this priority**: Authentication and role-based access control are the foundational gate for every other feature. Without secure sign-in and role enforcement, no other subsystem can function safely.

**Independent Test**: Can be fully tested by creating users with different roles, signing in, and verifying that each role sees only its permitted screens and that invalid credentials are rejected.

**Acceptance Scenarios**:

1. **Given** a registered staff user with the role "Inventory Clerk", **When** they enter valid credentials, **Then** they are signed in and see only inventory-related screens.
2. **Given** a signed-in Content Editor, **When** they attempt to navigate to an Administrator-only screen, **Then** the system displays an "access denied" message and does not reveal the page content.
3. **Given** a signed-in user whose session has been idle beyond the configured timeout, **When** they perform any action, **Then** the system redirects them to the sign-in screen with a "session expired" message.
4. **Given** a visitor with no account, **When** they attempt to access any operational screen, **Then** the system redirects to the sign-in page.

---

### User Story 2 - Membership Enrollment and Entitlement Redemption (Priority: P1)

A Membership Agent enrolls a new visitor as a member, creating a profile with name, contact details, membership tier, points balance, stored-value balance (USD), and one or more entitlement packages (e.g., "10 guest passes valid through December 2026"). Later, the member presents at the venue to redeem an entitlement. The agent selects the member, picks the entitlement, and submits the redemption. The system deducts from the entitlement count and confirms success. If the entitlement is expired, fully used, or the member is blacklisted, the redemption fails immediately with a specific on-screen reason.

**Why this priority**: Membership revenue and on-site entitlement redemption are core business operations. They must work reliably and offline to serve visitors at the point of service.

**Independent Test**: Can be tested by enrolling a member, assigning entitlement packages, and attempting redemptions under normal, expired, exhausted, and blacklisted conditions.

**Acceptance Scenarios**:

1. **Given** a Membership Agent is signed in, **When** they complete the enrollment form with valid member details and at least one entitlement package, **Then** the member profile is created with correct tier, points, stored-value balance, and entitlements.
2. **Given** a member with 10 remaining guest passes valid through 2026-12-31, **When** the agent redeems 1 guest pass on 2026-06-15, **Then** the remaining count decreases to 9 and a success confirmation is displayed.
3. **Given** a member whose "audio-guide rental" entitlement expired on 2026-03-01, **When** the agent attempts to redeem on 2026-04-02, **Then** the system rejects the redemption with the message "Entitlement expired on 2026-03-01."
4. **Given** a member with 0 remaining guest passes, **When** the agent attempts to redeem, **Then** the system rejects with "Entitlement fully used — 0 remaining."
5. **Given** a member who is on the blacklist, **When** the agent attempts any redemption or check-in, **Then** the system blocks the action with "Member is flagged — redemption not permitted" while still allowing the agent to view the member's history for dispute resolution.

---

### User Story 3 - Inventory Receiving, Bin Placement, and Multi-Batch Tracking (Priority: P2)

An Inventory Clerk receives a shipment of merchandise at a warehouse. They record the arrival by selecting the warehouse and destination bin, entering the item, quantity, batch number, arrival date, shelf-life/expiration date, and cost per unit. The system creates an immutable ledger entry for the receipt. The clerk can later view on-hand quantities broken down by warehouse, bin, and batch. Safety-stock warnings appear when projected on-hand falls below the configured threshold for any item.

**Why this priority**: Merchandise management is a primary revenue stream. Accurate receiving with batch tracking ensures stock visibility and prevents loss from expired goods.

**Independent Test**: Can be tested by performing a goods receipt, verifying the ledger entry is created, confirming bin-level and batch-level quantities, and triggering a safety-stock warning by setting a threshold above the on-hand quantity.

**Acceptance Scenarios**:

1. **Given** an Inventory Clerk is signed in and selects Warehouse A, Bin B-12, **When** they record receipt of 100 units of "Heritage Mug" (Batch #2026-Q2, expiration 2027-06-30, cost $4.50), **Then** the system creates an immutable ledger entry and the on-hand for that item/warehouse/bin/batch reflects 100 units.
2. **Given** an item "Souvenir Magnet" has a safety-stock threshold of 50 units, **When** the projected on-hand across all warehouses drops to 30, **Then** the inventory dashboard displays a safety-stock warning for that item.
3. **Given** a completed receipt, **When** the clerk views the inventory ledger, **Then** the receipt entry is visible, uneditable, and shows all recorded details (item, quantity, batch, bin, warehouse, date, cost).

---

### User Story 4 - Inventory Transfer, Shipment, and Reservation (Priority: P2)

An Inventory Clerk initiates a transfer of goods from one warehouse/bin to another, or prepares a shipment against an order. When an order is created, the system reserves the required inventory (using an idempotency token to prevent double-reservation from repeated clicks). The available quantity shown to other users is reduced by the reserved amount. If the order is canceled, the reservation is automatically released. Shipments are refused if available quantity minus reserved quantity would fall below zero. Adjustments above the configurable variance threshold require approval.

**Why this priority**: Transfers, shipments, and reservations ensure accurate stock allocation and prevent overselling. Concurrency safety is critical in a multi-user environment.

**Independent Test**: Can be tested by creating orders that reserve inventory, verifying available quantity is reduced, canceling an order and confirming the release, and attempting a shipment that would cause negative stock.

**Acceptance Scenarios**:

1. **Given** Warehouse A, Bin B-12 has 100 units of "Heritage Mug", **When** a clerk initiates a transfer of 40 units to Warehouse B, Bin C-5, **Then** Warehouse A shows 60 units and Warehouse B shows 40 units after approval, with corresponding immutable ledger entries for both sides.
2. **Given** 80 available units of an item, **When** an order reserves 80 units, **Then** the available-to-promise quantity displays 0 and another shipment attempt for the same item is refused.
3. **Given** a reservation exists for 50 units against Order #1234, **When** Order #1234 is canceled, **Then** the 50 units are automatically released back to available stock.
4. **Given** a clerk submits the same reservation request twice in rapid succession (e.g., double-click), **When** both requests reach the server, **Then** only one reservation is created (idempotency token prevents duplication).
5. **Given** an inventory count reveals a discrepancy of 15 units (above the configured variance of 2% or 5 units, whichever is greater), **When** the clerk submits the adjustment, **Then** the system requires approval from an authorized user before applying the change.

---

### User Story 5 - CMS Content Lifecycle with Versioning and Rollback (Priority: P2)

A Content Editor creates a new content item (text article, image gallery, audio/video piece, or external link) and fills in required copyright/source attribution fields. The content is saved as a draft. The Editor submits it for review. A Reviewer approves or rejects the draft with comments. Approved content can be published immediately or scheduled for a future date. Published content can be withdrawn or archived. Any prior version can be restored with one click, and a visible change history shows all versions with timestamps and authors.

**Why this priority**: Visitor-facing content drives engagement and revenue. A structured workflow with attribution and rollback ensures quality and legal compliance.

**Independent Test**: Can be tested by creating a draft, submitting for review, approving, publishing, withdrawing, archiving, and rolling back to a prior version while verifying the change history at each step.

**Acceptance Scenarios**:

1. **Given** a Content Editor creates a new text article with title, body, and copyright attribution, **When** they save, **Then** it is stored as version 1 in "Draft" status.
2. **Given** a draft article, **When** the Editor submits for review, **Then** the status changes to "In Review" and appears in the Reviewer's queue.
3. **Given** a Reviewer views an "In Review" article, **When** they approve it, **Then** the status changes to "Approved" and the Editor can publish or schedule it.
4. **Given** an approved article scheduled for 2026-05-01 09:00, **When** that date/time arrives, **Then** the article automatically transitions to "Published" status.
5. **Given** a published article at version 5, **When** an Editor clicks "rollback to version 3," **Then** version 3 content is restored as a new version 6, version 5 remains in history, and the change history displays all 6 versions.
6. **Given** any content item, **When** a user views its change history, **Then** every version is listed with timestamp, author, and status transition.

---

### User Story 6 - Document Management with Access Controls and Watermarking (Priority: P3)

Staff upload operational documents (incident reports, contracts, photos, evidence) into a hierarchical folder structure. Access to folders is controlled: sensitive folders are restricted to Administrators and designated supervisors. When a staff member downloads a document from a sensitive folder, the downloaded file is watermarked with the staff member's username and a timestamp. Every view and download event is logged with the user identity, file path, and timestamp.

**Why this priority**: Secure document storage supports compliance, dispute resolution, and operational transparency. It is essential but secondary to core revenue operations.

**Independent Test**: Can be tested by uploading documents to folders with different access levels, verifying that restricted users cannot access sensitive folders, downloading a file and checking the watermark, and reviewing audit logs for view/download events.

**Acceptance Scenarios**:

1. **Given** an Administrator creates a folder "Incident Reports" and marks it as sensitive, **When** an Inventory Clerk attempts to access it, **Then** the system denies access with a clear message.
2. **Given** an Administrator downloads a file from a sensitive folder, **When** the file is delivered, **Then** it contains a visible watermark showing the Administrator's username and the download timestamp.
3. **Given** any staff member views or downloads any document, **When** the action completes, **Then** an audit log entry is created recording the user, file, action type, and timestamp.

---

### User Story 7 - Security Controls and Rate Limiting (Priority: P2)

All state-changing operations require a valid CSRF token. Output is encoded to prevent cross-site scripting. Privileged endpoints validate request signatures to detect tampering. Each user is limited to 60 requests per minute by default; exceeding this triggers a rate-limit response. If the local storage becomes unavailable or disk space is critically low, the system enters a read-only mode with a clear on-screen message explaining the degraded state.

**Why this priority**: Security controls protect data integrity and user trust. Rate limiting and circuit-breaker behavior prevent abuse and ensure graceful degradation in adverse conditions.

**Independent Test**: Can be tested by submitting state-changing requests without CSRF tokens (should fail), injecting script content into fields (should be escaped on output), exceeding the rate limit (should be throttled), and simulating a disk-full condition (should display read-only message).

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they submit a form without a valid CSRF token, **Then** the system rejects the request with a clear error.
2. **Given** a user enters `<script>alert('x')</script>` into a text field, **When** the content is rendered on any page, **Then** the script is escaped and displayed as plain text, not executed.
3. **Given** a user has made 60 requests in the last minute, **When** they make a 61st request, **Then** the system returns a rate-limit message indicating when they can retry.
4. **Given** the local storage is locked or disk space is critically low, **When** any user attempts a write operation, **Then** the system displays a "read-only mode" message and prevents data modification while still allowing read access.

---

### User Story 8 - Backup, Restore, and Configuration Center (Priority: P3)

An Administrator navigates to the configuration center to manage system-wide settings: safety-stock thresholds, backup retention (default 30 daily backups), roles, security parameters, file-upload limits, and allowed file formats. They initiate an offline backup that produces an encrypted, date-stamped bundle saved to the configured backup directory. To restore, they select a backup file and the system verifies integrity before applying it. All backup and restore operations run entirely offline.

**Why this priority**: Backup/restore and centralized configuration ensure business continuity and operational flexibility. They support the system but are not used during moment-to-moment operations.

**Independent Test**: Can be tested by creating a backup, verifying the file is encrypted and date-stamped, deleting data, restoring from the backup, and confirming data integrity. Configuration changes can be verified by modifying a threshold and observing the effect.

**Acceptance Scenarios**:

1. **Given** an Administrator initiates a backup to `/backups/`, **When** the backup completes, **Then** an encrypted, date-stamped file is created at the chosen path.
2. **Given** an Administrator selects a valid backup file, **When** they initiate a restore, **Then** the system verifies integrity, applies the data, and confirms success.
3. **Given** an Administrator changes the safety-stock threshold for "Heritage Mug" from 50 to 75, **When** the current on-hand is 60, **Then** the dashboard immediately shows a safety-stock warning for that item.
4. **Given** backup retention is set to 30, **When** the 31st daily backup is created, **Then** the oldest backup is automatically removed.

---

### User Story 9 - CMS Deduplication and Entity Resolution (Priority: P3)

A Content Editor suspects duplicate entries exist for the same attraction or hotel in the CMS. They open the deduplication tool, which normalizes URLs, computes content fingerprints, and matches key fields to generate a confidence score for potential duplicates. The Editor reviews the suggestions and initiates a merge. The merge requires Reviewer approval. Conflict resolution prefers the most recently published, non-blank fields. A full merge audit trail is preserved.

**Why this priority**: Deduplication improves content quality and visitor experience, but is a refinement tool rather than a core operational flow.

**Independent Test**: Can be tested by creating two near-duplicate content items, running the deduplication tool, reviewing the match score, approving a merge, and verifying the merged result retains the correct fields with a complete audit trail.

**Acceptance Scenarios**:

1. **Given** two content items exist with the same attraction name but slightly different descriptions and the same normalized URL, **When** the Editor runs the deduplication tool, **Then** the tool presents them as a candidate pair with a confidence score above the merge-suggestion threshold.
2. **Given** a candidate duplicate pair, **When** the Editor initiates a merge, **Then** the system creates a merge proposal that requires Reviewer approval.
3. **Given** a Reviewer approves a merge where Item A (published 2026-03-01) has a blank phone number and Item B (published 2026-02-15) has a phone number, **When** the merge executes, **Then** the surviving record uses the non-blank phone number from Item B and the more recently published fields from Item A, with a full audit trail of which fields came from which source.

---

### User Story 10 - File Upload Validation and Encryption at Rest (Priority: P3)

Staff upload files (media, documents, evidence). The system validates each upload by checking the file extension and performing magic-byte sniffing to confirm the actual file type matches. Uploads are capped at 50 MB per file. Allowed file formats are defined in the configuration center. Sensitive files are encrypted at rest using a locally stored key. The key file is protected by operating system file permissions.

**Why this priority**: File validation and encryption protect against malicious uploads and data breaches. Important for security posture but dependent on the upload features from other stories.

**Independent Test**: Can be tested by uploading valid and invalid files (wrong extension, oversized, disallowed type, mismatched magic bytes) and verifying that only valid files are accepted. Encryption can be verified by inspecting raw stored files.

**Acceptance Scenarios**:

1. **Given** a staff member uploads a 10 MB PNG image with correct extension and matching magic bytes, **When** the upload completes, **Then** the file is accepted and stored.
2. **Given** a staff member uploads a file named "report.pdf" that actually contains executable bytes, **When** the system inspects the magic bytes, **Then** the upload is rejected with "File type does not match extension."
3. **Given** a staff member uploads a 55 MB file, **When** the upload is attempted, **Then** the system rejects it with "File exceeds the 50 MB limit."
4. **Given** a sensitive document is stored, **When** the raw file on disk is examined outside the application, **Then** the content is encrypted and unreadable without the application key.

---

### Edge Cases

- What happens when two Membership Agents attempt to redeem the last remaining entitlement for the same member simultaneously? The system must serialize the requests using a lock mechanism so only one succeeds and the other receives "Entitlement fully used."
- What happens when the scheduled publish time arrives but the system is in read-only mode due to disk space? The publish is deferred and a warning is logged; when the system recovers, the overdue scheduled items are published in order.
- What happens when a backup is initiated while another backup is already in progress? The system rejects the second request with "Backup already in progress."
- What happens when a user uploads a file with no extension? The system uses magic-byte detection alone and matches against allowed types; if no match, the upload is rejected.
- What happens when an Administrator removes a role from a currently signed-in user? The user's current session permissions are updated on the next request, and they are redirected to the sign-in screen if they no longer have any valid role.
- What happens when an inventory transfer is submitted for a bin that does not exist? The system rejects the transfer with "Destination bin not found."
- What happens when the encryption key file is missing or corrupted? The system refuses to start or serve sensitive files and alerts the Administrator with a clear error.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication and Authorization
- **FR-001**: System MUST authenticate users with a locally verified username and password, operating entirely offline.
- **FR-001a**: System MUST enforce a password policy requiring a minimum of 8 characters, at least one uppercase letter, at least one lowercase letter, and at least one digit or symbol. Passwords that do not meet this policy MUST be rejected at creation and change time with a specific validation message.
- **FR-001b**: System MUST lock a user account after 5 consecutive failed login attempts. The account MUST automatically unlock after 15 minutes. During lockout, the system MUST reject login attempts with a message indicating the account is temporarily locked and when it will unlock.
- **FR-002**: System MUST enforce role-based access control with at least five roles: Administrator, Inventory Clerk, Content Editor, Reviewer, and Membership Agent.
- **FR-003**: System MUST expire idle sessions after a configurable timeout (default 30 minutes).
- **FR-004**: System MUST include a CSRF token on all state-changing requests and reject requests with missing or invalid tokens.
- **FR-005**: System MUST encode all output to prevent cross-site scripting.
- **FR-006**: System MUST enforce strict content security rules to reduce script injection risk.
- **FR-007**: System MUST validate request signatures (HMAC-based) on privileged endpoints to detect tampering. Privileged endpoints are: system configuration changes, backup creation, and backup restoration.
- **FR-008**: System MUST rate-limit each user to a configurable maximum (default 60 requests per minute) and return a rate-limit message when exceeded.
- **FR-009**: System MUST enter a read-only mode with a clear on-screen message when the local storage is locked or disk space is critically low (circuit-breaker behavior).

#### Membership Management
- **FR-010**: System MUST allow Membership Agents to create member profiles with name, contact details, membership tier, points balance, stored-value balance (USD), and one or more entitlement packages.
- **FR-011**: System MUST support entitlement packages with a defined type (e.g., "guest passes," "audio-guide rentals"), an initial quantity, a remaining quantity, and a validity window (start date and end date).
- **FR-012**: System MUST allow Membership Agents to redeem entitlements, decrementing the remaining count by the requested amount.
- **FR-013**: System MUST reject redemption with a specific on-screen reason if: (a) the entitlement is expired, (b) the remaining count is zero, or (c) the member is flagged on the blacklist.
- **FR-014**: System MUST support a configurable blacklist, managed exclusively by Administrators, that blocks redemption and check-in for flagged members while still allowing all staff to view the member's full history for dispute resolution.
- **FR-015**: System MUST support member tier points accrual and stored-value balance adjustments.
- **FR-015a**: System MUST allow Administrators to define membership tiers (name and points threshold) via the configuration center. Tiers are not hardcoded.
- **FR-015b**: System MUST allow Membership Agents to manually promote or demote a member's tier. The system MUST NOT automatically change a member's tier based on points balance.
- **FR-016**: System MUST serialize concurrent entitlement redemptions for the same member using a lock mechanism with a short TTL (default 15 seconds) to prevent race conditions.

#### Content Management System (CMS)
- **FR-017**: System MUST support five content types: text, image, audio, video, and external link.
- **FR-018**: System MUST require copyright/source attribution fields on all content items; content cannot be saved without attribution.
- **FR-019**: System MUST enforce the content lifecycle workflow: Draft -> In Review -> Approved -> Published -> Withdrawn -> Archived. A Reviewer may also reject content, which returns it to Draft status with the rejection comment recorded in the version history (In Review -> Draft via rejection).
- **FR-020**: System MUST support scheduled publishing where an approved content item is automatically published at a specified future date and time.
- **FR-021**: System MUST maintain a complete version history for each content item, recording the content snapshot, author, timestamp, and status transition for every change.
- **FR-022**: System MUST allow one-click rollback to any prior version, creating a new version entry (not overwriting history).
- **FR-023**: System MUST allow Reviewers to approve or reject content submissions with comments.

#### Document Management
- **FR-024**: System MUST allow staff to upload operational documents and evidence into a hierarchical folder structure.
- **FR-025**: System MUST enforce folder-level access controls where sensitive folders are restricted to Administrators and users explicitly listed on a per-folder access control list (ACL) maintained by Administrators.
- **FR-026**: System MUST apply a watermark (staff username and download timestamp) to files downloaded from sensitive folders.
- **FR-027**: System MUST log every document view and download event with user identity, file path, action type, and timestamp.

#### Inventory Management
- **FR-028**: System MUST support multi-warehouse and bin-level inventory placement.
- **FR-029**: System MUST support multi-batch tracking with batch number, arrival date, shelf-life/expiration date, and cost per unit.
- **FR-030**: System MUST write immutable ledger entries for all inventory movements (receive, transfer, adjust, ship).
- **FR-031**: System MUST prevent negative inventory by refusing any shipment or transfer where available quantity minus reserved quantity would fall below zero.
- **FR-032**: System MUST display safety-stock warnings on the inventory dashboard when available on-hand (current on-hand minus active reservations) for any item drops below its configured threshold.
- **FR-033**: System MUST reserve inventory upon order creation and automatically release reservations upon order cancellation.
- **FR-034**: System MUST use idempotency tokens for reservation requests to prevent duplicate reservations from repeated submissions.
- **FR-035**: System MUST require approval for inventory adjustments that exceed the configurable variance threshold (default: 2% of expected quantity or 5 units, whichever is greater).
- **FR-036**: System MUST serialize critical inventory operations (batch allocation, shipment) using a lock mechanism with short TTL to prevent concurrent conflicts.
- **FR-050**: System MUST support inventory cycle counts where a clerk records the actual quantity for an item/warehouse/bin/batch; the system compares it against the expected on-hand and auto-creates an adjustment ledger entry (subject to variance approval per FR-035).
- **FR-051**: System MUST support an order lifecycle with states: pending -> approved -> shipped, and pending -> canceled, and approved -> canceled. Order creation reserves inventory (per FR-033), shipment confirms the deduction, and cancellation releases reservations.
- **FR-052**: System MUST allow Administrators to manually disable or enable user accounts. A disabled user MUST NOT be able to sign in and MUST receive a clear "account disabled" message.

#### File Upload and Security
- **FR-037**: System MUST validate uploaded files by both file extension and magic-byte inspection to confirm the actual type matches the declared extension.
- **FR-038**: System MUST reject uploads exceeding 50 MB per file.
- **FR-039**: System MUST restrict uploads to file formats defined in the configuration center.
- **FR-040**: System MUST encrypt sensitive files at rest using a locally stored encryption key protected by operating system file permissions.

#### Backup and Configuration
- **FR-041**: System MUST support fully offline backup producing encrypted, date-stamped backup bundles saved to the configured backup directory (which maps to a host-accessible volume in containerized deployments).
- **FR-042**: System MUST support restore from a backup file with integrity verification before applying.
- **FR-043**: System MUST enforce backup retention policy (default 30 daily backups) by removing the oldest backup when the limit is exceeded.
- **FR-044**: System MUST provide a configuration center for Administrators to manage: safety-stock thresholds, backup retention, roles, security settings, session timeout, rate limits, and allowed file formats.
- **FR-053**: System MUST allow Administrators to view, search, and filter the audit log by user, action type, target entity, and date range.
- **FR-054**: System MUST allow Administrators to create new user accounts by setting a username, initial password, display name, and roles. The initial password is set by the Administrator; no invitation or forced-change-on-first-login flow is required for v1.

#### Deduplication and Entity Resolution
- **FR-045**: System MUST provide a deduplication tool for Content Editors that normalizes URLs and computes content fingerprints to identify potential duplicate content items.
- **FR-046**: System MUST present duplicate candidates with a confidence score based on fingerprint similarity and key-field matching.
- **FR-047**: System MUST require Reviewer approval for content merges.
- **FR-048**: System MUST apply conflict resolution rules during merge that prefer the most recently published, non-blank fields.
- **FR-049**: System MUST preserve a full merge audit trail recording which fields came from which source item.

### Key Entities

- **User**: A staff member with a username, hashed password, one or more roles, a status (active/disabled), a failed login attempt counter, and a lockout timestamp. Central to authentication and audit trails.
- **Member**: A venue visitor enrolled in the membership program. Has name, contact details, tier, points balance, stored-value balance (USD), blacklist flag, and related entitlement packages.
- **Entitlement Package**: A redeemable benefit assigned to a member. Has a type label, initial quantity, remaining quantity, validity start date, validity end date, and redemption history.
- **Content Item**: A piece of visitor-facing content (text, image, audio, video, or external link). Has a current version, lifecycle status, copyright attribution, and a list of content versions.
- **Content Version**: An immutable snapshot of a content item at a point in time. Records content body, author, timestamp, and status transition.
- **Document**: A file uploaded to the document management system. Belongs to a folder, has access control metadata, and an associated audit log.
- **Folder**: A hierarchical container for documents. Has a name, parent folder reference, sensitivity flag, and a per-folder access control list (ACL) of users authorized as supervisors for that folder, managed by Administrators.
- **Warehouse**: A physical storage location. Has a name, address, and contains bins.
- **Bin**: A specific placement location within a warehouse. Has a label and belongs to a warehouse.
- **Inventory Item**: A merchandise product tracked in the system. Has a name, SKU, safety-stock threshold, and current on-hand quantities by warehouse/bin/batch.
- **Batch**: A specific lot of an inventory item. Has a batch number, arrival date, expiration date, cost per unit, and is tied to a warehouse/bin.
- **Inventory Ledger Entry**: An immutable record of an inventory movement (receipt, transfer, adjustment, shipment). Records item, quantity, batch, source/destination, timestamp, and user.
- **Reservation**: A hold on inventory for a pending order. Has an idempotency token, item, quantity, order reference, and status (active/released).
- **Order**: A request to ship merchandise. Has a status (pending/approved/shipped/canceled), line items with item/quantity/source warehouse/bin/batch references, and associated reservations. Supports lifecycle: pending -> approved -> shipped, or pending/approved -> canceled.
- **Audit Log**: A record of significant system events (sign-in, document access, configuration change, redemption). Records user, action, target, timestamp. Searchable by Administrators via the audit log viewer (FR-053).
- **Configuration**: System-wide settings stored as key-value pairs. Includes thresholds, retention policies, rate limits, allowed file formats, security parameters, and membership tier definitions (name and points threshold per tier).
- **Lock**: A short-lived serialization record used to prevent concurrent conflicts on critical operations. Has a resource identifier, owner, and TTL.
- **Merge Proposal**: A record of a proposed content merge from the deduplication tool. References the two candidate content items, the field-level resolution decisions, approval status, reviewer, and a full audit trail of which fields came from which source (FR-049).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can sign in and reach their role-appropriate dashboard within 5 seconds on a standard workstation.
- **SC-002**: Membership Agents can complete a new member enrollment (including one entitlement package) in under 3 minutes.
- **SC-003**: Entitlement redemptions succeed or fail with a clear reason within 2 seconds, even under concurrent load from multiple agents.
- **SC-004**: 100% of redemption attempts against expired, exhausted, or blacklisted entitlements are rejected with a specific, human-readable reason.
- **SC-005**: Inventory receiving, transfer, and shipment operations complete within 5 seconds per transaction.
- **SC-006**: Zero instances of negative inventory occur under any operational scenario, including concurrent shipments and transfers.
- **SC-007**: Duplicate reservation attempts from repeated clicks result in exactly one reservation per idempotency token.
- **SC-008**: Content items traverse the full lifecycle (draft through archive) with every transition recorded in the version history.
- **SC-009**: One-click rollback restores a prior version within 3 seconds, and the complete version history remains intact.
- **SC-010**: 100% of document downloads from sensitive folders contain a visible watermark with username and timestamp.
- **SC-011**: 100% of document view and download events are recorded in the audit log.
- **SC-012**: Backup and restore operations complete successfully on a dataset of 10,000 members, 50,000 content versions, and 100,000 ledger entries within 10 minutes.
- **SC-013**: All state-changing requests without a valid CSRF token are rejected.
- **SC-014**: Uploaded files with mismatched extension and magic bytes are rejected 100% of the time.
- **SC-015**: The deduplication tool identifies duplicate content items with at least 85% precision when content overlap exceeds 80%.
- **SC-016**: The system enters read-only mode within 5 seconds of detecting a storage-locked or disk-full condition and resumes normal operation within 5 seconds of recovery.

## Assumptions

- The system operates entirely offline on a local network; no internet connectivity is required or assumed.
- Staff access the system from standard desktop workstations or laptops via a web browser on the local network.
- A single instance of the application serves one venue site; multi-site federation is out of scope.
- The initial user (Administrator) is created through a setup/seed process outside the normal UI; subsequent users are created by Administrators within the system.
- Password hashing uses a strong, industry-standard one-way algorithm; the specific algorithm is an implementation decision.
- The UI provides fast partial-page updates without full page reloads; the specific front-end approach is an implementation decision.
- Mobile-specific responsive design is out of scope for v1; the UI targets desktop-width screens.
- The 50 MB per-file upload limit applies to all file types uniformly.
- Stored-value balances are tracked in USD only; multi-currency support is out of scope.
- Scheduled publishing checks run on a periodic interval (e.g., every minute); exact timing precision to the second is not required.
- The encryption key for at-rest file encryption is generated once during initial setup and managed by the Administrator; key rotation is out of scope for v1.
- The deduplication confidence threshold for surfacing suggestions is configurable; the default is 70%.
- Watermarking is applied at download time using local image/PDF processing; the original file on disk is not modified. For file types that do not support visible watermarking (e.g., plain text, audio), the download audit log serves as the provenance record.
- The configurable session inactivity timeout defaults to 30 minutes.
- A staff member may hold multiple roles simultaneously (e.g., Administrator and Content Editor). Roles are stored as a comma-separated list on the user record; this is acceptable for v1 at 10-user scale but may need a junction table if role queries become complex in future versions.
- The system is designed for up to 10 concurrent users; all latency and concurrency targets (SC-001 through SC-016) must be met at this load level.
