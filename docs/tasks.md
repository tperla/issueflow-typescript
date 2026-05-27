# IssueFlow – Implementation Tasks

Each task = one branch + one PR. Follow: implement → write tests → `npm run test` + `npm run test:e2e` → PR → wait for merge.

---

## Task 0 – Project Setup (`task/setup`)

**Description:** Bootstrap the application infrastructure shared by all feature modules.

**Files to create/modify:**
- `src/app.module.ts` — import all feature modules, configure TypeORM, ValidationPipe, HttpExceptionFilter
- `src/common/filters/http-exception.filter.ts` — global exception filter returning `{ statusCode, message, error }`
- `src/common/enums/` — `user-role.enum.ts`, `ticket-status.enum.ts`, `ticket-priority.enum.ts`, `ticket-type.enum.ts`, `audit-action.enum.ts`, `audit-actor.enum.ts`, `audit-entity-type.enum.ts`
- `src/config/typeorm.config.ts` — TypeORM datasource config using `compose.yml` credentials: `host=localhost, port=5432, username=issueflow, password=issueflow, database=issueflow, synchronize=true`
- `src/entities/` — all TypeORM entities: `User`, `Project`, `Ticket`, `Comment`, `AuditLog`, `TicketDependency`, `Attachment`
- `test/setup.ts` — E2E test database setup/teardown helpers

**Acceptance criteria:**
- `docker compose up -d` starts PostgreSQL successfully
- App boots without errors (`npm run start:dev`)
- TypeORM connects using `compose.yml` credentials and auto-creates all tables
- Global `ValidationPipe` rejects invalid input with 400
- Global `HttpExceptionFilter` returns consistent `{ statusCode, message, error }` shape
- All enums defined and exported

**Tests:**
- Unit: TypeORM config loads correct values from environment
- E2E: App bootstraps, `/auth/login` with missing body returns 400 with validation error shape

---

## Task 1 – Users Module (`task/users`)

**Description:** CRUD for user management.

**Files to create:**
- `src/users/users.module.ts`
- `src/users/users.controller.ts` — GET /users, GET /users/:userId, POST /users, POST /users/update/:userId, DELETE /users/:userId
- `src/users/users.service.ts`
- `src/users/dto/create-user.dto.ts` — `username`, `email`, `fullName`, `role` (IsEnum UserRole)
- `src/users/dto/update-user.dto.ts` — optional `fullName`, `role`

**Acceptance criteria:**
- List all users returns array
- Get by ID returns 404 if not found
- Create validates role enum; rejects unknown roles with 400
- Update and delete return 200 OK

**Tests:**
- Unit: `UsersService` — mock `UserRepository`; test create, findAll, findOne (found + 404), update, delete
- E2E: all 5 endpoints; assert 404 on unknown userId; assert 400 on invalid role

---

## Task 2 – Auth Module (`task/auth`)

**Description:** JWT login/logout/me with in-memory token blacklist.

**Files to create:**
- `src/auth/auth.module.ts`
- `src/auth/auth.controller.ts` — POST /auth/login, POST /auth/logout, GET /auth/me
- `src/auth/auth.service.ts` — login (bcrypt compare, sign JWT), logout (add to blacklist), getMe
- `src/auth/strategies/jwt.strategy.ts` — validates token, checks blacklist
- `src/auth/guards/jwt-auth.guard.ts`
- `src/auth/dto/login.dto.ts` — `username`, `password`

**Acceptance criteria:**
- Login with valid credentials returns `{ accessToken, tokenType: "Bearer", expiresIn: 3600 }`
- Login with wrong password returns 401
- Logout invalidates token; subsequent requests with that token return 401
- GET /auth/me requires valid JWT; returns current user object
- Passwords stored as bcrypt hashes

**Tests:**
- Unit: `AuthService` — mock `UsersService` and `JwtService`; test login success, wrong password, blacklist behaviour
- E2E: full login→me→logout→me flow; assert 401 after logout

---

## Task 3 – Projects Module (`task/projects`)

**Description:** Project CRUD, soft delete, restore, and workload endpoint.

**Files to create:**
- `src/projects/projects.module.ts`
- `src/projects/projects.controller.ts` — GET /projects, GET /projects/:id, POST /projects, PATCH /projects/:id, DELETE /projects/:id, GET /projects/deleted, POST /projects/:id/restore, GET /projects/:id/workload
- `src/projects/projects.service.ts`
- `src/projects/dto/create-project.dto.ts` — `name`, `description`, `ownerId`
- `src/projects/dto/update-project.dto.ts` — optional `name`, `description`

**Acceptance criteria:**
- Standard list excludes soft-deleted records
- GET /projects/deleted returns only soft-deleted (ADMIN only)
- Restore recovers a soft-deleted project (ADMIN only)
- GET /projects/:id/workload returns `[{ userId, username, openTicketCount }]` sorted by `openTicketCount` ascending
- All mutations emit an audit log entry

**Tests:**
- Unit: `ProjectsService` — mock repos; test CRUD, soft delete, restore, workload query
- E2E: full CRUD; soft delete → verify hidden from list → restore → verify visible; workload endpoint

---

## Task 4 – Tickets Module (`task/tickets`)

**Description:** Ticket CRUD, soft delete, restore, status lifecycle, DONE lock, optimistic locking, isOverdue, CSV export/import.

**Files to create:**
- `src/tickets/tickets.module.ts`
- `src/tickets/tickets.controller.ts` — GET /tickets, GET /tickets/:id, POST /tickets, PATCH /tickets/:id, DELETE /tickets/:id, GET /tickets/deleted, POST /tickets/:id/restore, GET /tickets/export, POST /tickets/import
- `src/tickets/tickets.service.ts`
- `src/tickets/dto/create-ticket.dto.ts` — all fields with enum validation
- `src/tickets/dto/update-ticket.dto.ts` — all optional fields
- `src/tickets/dto/import-tickets.dto.ts`
- `src/tickets/helpers/csv.helper.ts` — RFC 4180 export/import using `csv-stringify`/`csv-parse`

**Acceptance criteria:**
- Status transitions enforce `TODO → IN_PROGRESS → IN_REVIEW → DONE`; reject backward moves with 400
- Updates to a DONE ticket return 409
- Optimistic locking: concurrent update with stale `version` returns 409
- `isOverdue` returned on all GET responses
- CSV export streams correct headers and data; handles commas/quotes in values
- CSV import returns `{ created, failed, errors[] }`; errors accumulated per row without aborting
- All mutations emit audit log entries

**Tests:**
- Unit: `TicketsService` — test status transition enforcement, DONE lock, isOverdue logic, CSV parse/export
- E2E: CRUD; status transition valid + invalid; DONE lock; export → import roundtrip; soft delete/restore

---

## Task 5 – Comments Module (`task/comments`)

**Description:** Comments on tickets with @mention parsing, optimistic locking.

**Files to create:**
- `src/comments/comments.module.ts`
- `src/comments/comments.controller.ts` — GET /tickets/:ticketId/comments, POST /tickets/:ticketId/comments, PATCH /tickets/:ticketId/comments/:commentId, DELETE /tickets/:ticketId/comments/:commentId
- `src/comments/comments.service.ts`
- `src/comments/helpers/mention-parser.helper.ts` — extract `@username` tokens (case-insensitive), resolve to User entities
- `src/comments/dto/create-comment.dto.ts` — `authorId`, `content`
- `src/comments/dto/update-comment.dto.ts` — `content`

**Acceptance criteria:**
- `mentionedUsers` populated on create and returned in GET responses
- On update, mention list re-evaluated: new mentions created, removed mentions deleted
- `@USERNAME` and `@username` match the same user (case-insensitive)
- Non-existent @mentions are silently ignored (no 400)
- Optimistic locking: concurrent edit with stale `version` returns 409
- Mutations emit audit log entries

**Tests:**
- Unit: `MentionParser` — test extraction, case-insensitivity, unknown username ignored; `CommentsService` with mock repos
- E2E: create comment with mention → verify mentionedUsers; update removes mention → verify removed; GET /users/:id/mentions

---

## Task 6 – Audit Logs Module (`task/audit-logs`)

**Description:** Read-only audit log endpoint with filtering.

**Files to create:**
- `src/audit-logs/audit-logs.module.ts`
- `src/audit-logs/audit-logs.controller.ts` — GET /audit-logs
- `src/audit-logs/audit-logs.service.ts` — `log(dto)` method used by all other services; `findAll(filters)`
- `src/audit-logs/dto/create-audit-log.dto.ts`
- `src/audit-logs/dto/filter-audit-log.dto.ts` — optional `entityType`, `entityId`, `action`, `actor`

**Acceptance criteria:**
- GET /audit-logs returns all logs unfiltered
- Each query param filters correctly (individually and combined)
- `AuditLogsModule` exports `AuditLogsService` for use by other modules

**Tests:**
- Unit: `AuditLogsService` — test `log()` persists correctly; test `findAll()` filter combinations with mock repo
- E2E: trigger a create action → verify log entry appears; filter by entityType, action, actor

---

## Task 7 – Ticket Dependencies Module (`task/dependencies`)

**Description:** Blocker relationships between tickets with circular dependency guard and DONE transition block.

**Files to create:**
- `src/ticket-dependencies/ticket-dependencies.module.ts`
- `src/ticket-dependencies/ticket-dependencies.controller.ts` — POST /tickets/:ticketId/dependencies, GET /tickets/:ticketId/dependencies, DELETE /tickets/:ticketId/dependencies/:blockerId
- `src/ticket-dependencies/ticket-dependencies.service.ts` — add, list, remove, `hasCircularDependency()`, `hasUnresolvedBlockers()`

**Acceptance criteria:**
- Both tickets must exist and belong to the same project; reject with 400 otherwise
- Circular dependency detected and rejected with 409
- Attempting to transition a blocked ticket to DONE returns 409
- Remove dependency returns 200 OK

**Tests:**
- Unit: `hasCircularDependency()` — direct and transitive cases; `TicketDependenciesService` with mock repos
- E2E: add dependency → list → remove; circular dependency rejection; DONE block rejection

---

## Task 8 – Attachments Module (`task/attachments`)

**Description:** File upload and delete with type and size validation.

**Files to create:**
- `src/attachments/attachments.module.ts`
- `src/attachments/attachments.controller.ts` — POST /tickets/:ticketId/attachments, DELETE /tickets/:ticketId/attachments/:attachmentId
- `src/attachments/attachments.service.ts`
- `src/attachments/multer.config.ts` — memory storage, 10 MB limit, allowed MIME types filter

**Acceptance criteria:**
- Upload stores file in DB bytea column; returns `{ id, ticketId, filename, contentType }`
- Upload exceeding 10 MB rejected with 413
- Upload with disallowed MIME type rejected with 415
- Delete returns 200 OK; emits audit log entry

**Tests:**
- Unit: `AttachmentsService` — mock repo; test store and delete
- E2E: upload valid file → verify response; upload oversized file → 413; upload wrong type → 415; delete

---

## Task 9 – Scheduler Module (`task/scheduler`)

**Description:** Auto-escalation and auto-assignment background jobs.

**Files to create:**
- `src/scheduler/scheduler.module.ts`
- `src/scheduler/scheduler.service.ts` — `runEscalation()` and `runAutoAssignment()` as `@Cron`-decorated methods
- Logic:
  - **Escalation**: find overdue tickets with `dueDate` set, priority < CRITICAL, bump one level; set `isOverdue = true` when CRITICAL reached; log with `actor: SYSTEM`
  - **Auto-assignment**: on ticket creation (called from `TicketsService`), find least-loaded DEVELOPER in project (tie-break by registration order); log with `actor: SYSTEM`, `action: AUTO_ASSIGN`

**Acceptance criteria:**
- Escalation is idempotent (CRITICAL ticket not escalated again)
- Escalation only runs for tickets with `dueDate` set
- Manual priority change via PATCH clears `isOverdue`
- Auto-assignment assigns to least-loaded DEVELOPER; ties broken by oldest registrant
- Auto-assignment not triggered on ticket update
- Both jobs emit correct audit log entries

**Tests:**
- Unit: `SchedulerService` — mock `TicketsRepository`, `UsersRepository`, `AuditLogsService`; test escalation logic (all priority levels, idempotency, no dueDate skip); test auto-assignment (correct selection, tie-break, no DEVELOPERs case)
- E2E: call `runEscalation()` directly on a seeded overdue ticket → verify priority bumped and audit logged; create ticket without assigneeId → verify auto-assigned and audit logged

---

## Task 10 – Documentation (`task/docs`)

**Description:** Finalize project documentation.

**Files to create:**
- `run.md` — exact steps: install dependencies, start DB (`docker compose up -d`), build, run (`npm run start:dev`), run tests (`npm run test`, `npm run test:e2e`)
- `prompts.md` — generated via `/curate-prompts` skill

**Acceptance criteria:**
- `run.md` can be followed by a new developer from scratch to get the app running and tests passing
- `prompts.md` includes significant prompts grouped by phase with model stated

**Tests:**
- Manual: follow `run.md` steps in a clean environment and verify the app starts and tests pass
