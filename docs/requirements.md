# IssueFlow – Requirements

## 1. Functional Requirements

### 1.1 Users
- **FR-U1**: List all users (`GET /users`) → array of user objects
- **FR-U2**: Get user by ID (`GET /users/:userId`) → user object or 404
- **FR-U3**: Create user (`POST /users`) with `username`, `email`, `fullName`, `role` (DEVELOPER | ADMIN) → created user
- **FR-U4**: Update user (`POST /users/update/:userId`) with optional `fullName`, `role` → 200 OK
- **FR-U5**: Delete user (`DELETE /users/:userId`) → 200 OK
- **FR-U6**: Get mentions for a user (`GET /users/:userId/mentions`) with optional `page`, `pageSize` → paginated comment list, ordered newest first

**Constraints:**
- Role must be one of: `ADMIN`, `DEVELOPER`

### 1.2 Authentication
- **FR-A1**: Login (`POST /auth/login`) with `username` and `password` → `accessToken`, `tokenType`, `expiresIn`
- **FR-A2**: Logout (`POST /auth/logout`) — invalidates current JWT → 200 OK
- **FR-A3**: Get current user (`GET /auth/me`) — requires valid JWT → user object
- **FR-A4**: On startup, if no admin user exists, seed one from env vars `SEED_ADMIN_USERNAME` (default: `admin`), `SEED_ADMIN_EMAIL` (default: `admin@issueflow.dev`), `SEED_ADMIN_PASSWORD` (default: `admin123`); operation is idempotent

### 1.3 Projects
- **FR-P1**: List all projects (`GET /projects`) → array (excludes soft-deleted)
- **FR-P2**: Get project by ID (`GET /projects/:projectId`) → project or 404
- **FR-P3**: Create project (`POST /projects`) with `name`, `description`, `ownerId` → created project
- **FR-P4**: Update project (`PATCH /projects/:projectId`) with optional `name`, `description` → 200 OK
- **FR-P5**: Soft-delete project (`DELETE /projects/:projectId`) → 200 OK
- **FR-P6**: List soft-deleted projects (`GET /projects/deleted`) → array (ADMIN only)
- **FR-P7**: Restore soft-deleted project (`POST /projects/:projectId/restore`) → 200 OK (ADMIN only)
- **FR-P8**: Get project workload (`GET /projects/:projectId/workload`) → array of `{ userId, username, openTicketCount }` sorted by `openTicketCount` ascending

### 1.4 Tickets
- **FR-T1**: List tickets by project (`GET /tickets?projectId=:id`) → array (excludes soft-deleted), includes computed `isOverdue`
- **FR-T2**: Get ticket by ID (`GET /tickets/:ticketId`) → ticket or 404, includes `isOverdue`
- **FR-T3**: Create ticket (`POST /tickets`) with `title`, `description`, `status`, `priority`, `type`, `projectId`, optional `assigneeId`, `dueDate` → created ticket
- **FR-T4**: Update ticket (`PATCH /tickets/:ticketId`) with optional fields → 200 OK
- **FR-T5**: Soft-delete ticket (`DELETE /tickets/:ticketId`) → 200 OK
- **FR-T6**: List soft-deleted tickets (`GET /tickets/deleted?projectId=:id`) → array (ADMIN only)
- **FR-T7**: Restore soft-deleted ticket (`POST /tickets/:ticketId/restore`) → 200 OK (ADMIN only)
- **FR-T8**: Export tickets to CSV (`GET /tickets/export?projectId=:id`) → CSV file with fields: id, title, description, status, priority, type, assigneeId
- **FR-T9**: Import tickets from CSV (`POST /tickets/import`) multipart form with `file` (CSV) and `projectId` → `{ created, failed, errors[] }`
- **FR-T10**: `isOverdue` flag — set to `true` when a ticket reaches `CRITICAL` priority and is still overdue (past `dueDate`); visible in all GET responses

**Constraints:**
- Status must be one of: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`
- Priority must be one of: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- Type must be one of: `BUG`, `FEATURE`, `TECHNICAL`
- A ticket cannot be updated once its status is `DONE`
- Status transitions are forward-only: `TODO → IN_PROGRESS → IN_REVIEW → DONE`; backward transitions must be rejected
- A ticket cannot be updated simultaneously by two users — optimistic locking must be enforced
- A ticket cannot transition to `DONE` if it has unresolved blocker dependencies

### 1.5 Comments
- **FR-C1**: Get comments for ticket (`GET /tickets/:ticketId/comments`) → array with `mentionedUsers`
- **FR-C2**: Add comment (`POST /tickets/:ticketId/comments`) with `authorId`, `content` → created comment with parsed `mentionedUsers`
- **FR-C3**: Update comment (`PATCH /tickets/:ticketId/comments/:commentId`) with `content` → 200 OK; re-evaluates mentions (new mentions created, removed mentions deleted)
- **FR-C4**: Delete comment (`DELETE /tickets/:ticketId/comments/:commentId`) → 200 OK
- **FR-C5**: `@username` mentions in comment content are parsed case-insensitively, validated against existing users, and stored as M2M relation

**Constraints:**
- A comment cannot be edited simultaneously by two users — optimistic locking must be enforced

### 1.6 Audit Logs
- **FR-AL1**: Get audit logs (`GET /audit-logs`) with optional query params: `entityType`, `entityId`, `action`, `actor` → filtered list
- **FR-AL2**: All state-changing operations (create, update, delete, restore) on Users, Projects, Tickets, Comments, Attachments automatically generate an audit log entry
- **FR-AL3**: Each entry records: `action`, `entityType`, `entityId`, `performedBy` (userId or null), `actor` (USER | SYSTEM), `timestamp`

### 1.7 Ticket Dependencies
- **FR-D1**: Add dependency (`POST /tickets/:ticketId/dependencies`) with `{ blockedBy: ticketId }` → 200 OK
- **FR-D2**: List dependencies (`GET /tickets/:ticketId/dependencies`) → array of blocking tickets with id, title, status
- **FR-D3**: Remove dependency (`DELETE /tickets/:ticketId/dependencies/:blockerId`) → 200 OK
- **FR-D4**: Circular dependency prevention — adding A blocks B when B already blocks A (directly or transitively) must be rejected

**Constraints:**
- Both tickets must exist and belong to the same project

### 1.8 Attachments
- **FR-AT1**: Upload attachment (`POST /tickets/:ticketId/attachments`) multipart/form-data with `file` → `{ id, ticketId, filename, contentType }`
- **FR-AT2**: Delete attachment (`DELETE /tickets/:ticketId/attachments/:attachmentId`) → 200 OK
- **FR-AT3**: Attachment binary data stored in DB (bytea column)

**Constraints:**
- Maximum file size: 10 MB; uploads exceeding this limit must be rejected
- Allowed file types: `image/png`, `image/jpeg`, `application/pdf`, `text/plain`; all other types must be rejected

### 1.9 Auto-Escalation (Scheduler)
- **FR-S1**: A background scheduler runs periodically (every hour)
- **FR-S2**: For each overdue ticket (past `dueDate`) whose priority is below `CRITICAL`: escalate priority one level (LOW→MEDIUM→HIGH→CRITICAL)
- **FR-S3**: Escalation is logged in the audit log with `actor: SYSTEM`

**Constraints:**
- Escalation is idempotent: a `CRITICAL` ticket is never escalated further
- Escalation only applies to tickets for which `dueDate` has been set
- A manual priority change via `PATCH /tickets/:id` resets the auto-escalation state: `isOverdue` is cleared and the next cycle re-evaluates from the new priority
- Escalation does not change a ticket's `status`; only `priority` and `isOverdue` are modified

### 1.10 Auto-Assignment (Scheduler)
- **FR-S4**: On ticket creation, if `assigneeId` is not provided, auto-assign to the DEVELOPER in that project with the fewest open (non-DONE) tickets
- **FR-S5**: Ties in workload count are broken by user registration order (oldest registrant first)
- **FR-S6**: If no DEVELOPER exists in the project, ticket is created with `assigneeId = null` without error
- **FR-S7**: Each auto-assignment is logged in the audit log with `actor: SYSTEM`, `action: AUTO_ASSIGN`

**Constraints:**
- Only users with role `DEVELOPER` are candidates; `ADMIN` users are excluded
- Auto-assignment can be overridden at any time via `PATCH /tickets/:id` with an explicit `assigneeId`
- Auto-assignment is triggered only on ticket creation when `assigneeId` is absent — not on ticket update

---

## 2. Non-Functional Requirements

- **NFR-12**: All endpoints (including POST create operations) return `200 OK` on success; NestJS default `201 Created` is explicitly overridden for consistency with the API contract
- **NFR-1**: Input validation on all POST/PATCH endpoints using `class-validator` decorators on DTOs; invalid input returns 400 with descriptive error messages
- **NFR-2**: All errors return consistent JSON: `{ statusCode, message, error }` via a global exception filter
- **NFR-3**: 404 returned when a resource is not found
- **NFR-4**: Unit tests for all service classes (mocked repositories)
- **NFR-5**: E2E tests for all controllers (supertest against a test database)
- **NFR-6**: All `npm run test` and `npm run test:e2e` must pass
- **NFR-7**: Password stored as bcrypt hash; plain text passwords never persisted
- **NFR-8**: JWT tokens expire after 1 hour; logout invalidates via in-memory blacklist
- **NFR-11**: All API endpoints (including Users CRUD) are protected by JWT authentication; unauthenticated requests return 401
- **NFR-9**: CSV import accumulates per-row errors and returns them without aborting the whole import
- **NFR-10**: CSV format must correctly handle commas and quotes inside field values (RFC 4180 compliant)

---

## 3. Constraints

- **C1**: Framework — NestJS 10 (TypeScript)
- **C2**: ORM — TypeORM 0.3.20
- **C3**: Database — PostgreSQL (via Docker Compose)
- **C4**: Auth — `@nestjs/jwt` + `passport-jwt` (JwtStrategy)
- **C5**: Scheduling — `@nestjs/schedule`
- **C6**: File upload — `multer` (already in package.json)
- **C7**: CSV — `csv-parse` + `csv-stringify` (already in package.json)
- **C8**: `synchronize: true` for TypeORM in development (schema auto-created)

---

## 4. Out of Scope

- Hard (permanent) deletion of projects or tickets via the API
- Role-based access control beyond what is specified (e.g. fine-grained permissions)
- Email notifications for mentions or escalations
- UI / frontend
- Production deployment configuration (no TLS, no env-based secrets management beyond basic .env)
- Refresh tokens
- Pagination on endpoints other than `/users/:userId/mentions`
