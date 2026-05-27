# IssueFlow – Prompts Log

**Model**: claude-sonnet-4-6

---

## Phase 0: Tooling Setup

**2026-05-26T18:12Z**
> _(session initialized)_
Set up Claude Code project, configured UserPromptSubmit hook to log prompts to `.claude/logs/prompts-raw.md`.

**2026-05-26T18:16Z**
> "ok but move prompt-raw inside a specific folder. insert plan.md to claude folder"
Moved prompt log to `.claude/logs/`, moved planning docs into `.claude/` folder.

**2026-05-26T18:17Z**
> "ok move the sdlc files to specific folder"
Moved SDLC skill files to `.claude/skills/`.

**2026-05-26T18:20Z**
> "test if gh cli work to merge the branch"
Verified GitHub CLI (`gh`) can merge branches; confirmed PR flow works end-to-end.

---

## Phase 1: Requirements

**2026-05-27T14:13Z**
> "Make sure everything is in this branch push. And please open a new branch because after going through the requirements - requirements.md, I see that things are missing. Update a ticket - A ticket can't be updated simultaneously by two users (or more) [...] These are the things I noticed that are not there..."
Cross-checked all requirements from `TDP_issueflow_requirements` against `requirements.md` and `README.md`; added missing constraints: optimistic locking, `@mention` mechanism, CSV format, auto-assignment rules, JWT expiry/blacklist, file upload limits, workload endpoint.

**2026-05-26T18:31Z**
> "merge it"
Merged requirements PR after review.

---

## Phase 2: Design

**2026-05-26T18:32Z**
> "pull main and start phase 2"
Started `design.md` covering architecture, module structure, data model, API contract.

**2026-05-26T18:36Z**
> "feature modules"
Chose NestJS feature module pattern (one module per domain) over monolithic service structure.

**2026-05-26T18:37Z**
> "decorator-based with explicit join table"
Selected `@ManyToMany` with explicit join table for comment mentions over implicit TypeORM pivot.

**2026-05-26T18:39Z**
> "check again the readme.md file to be sure that we dont need the db to store the jwt"
Confirmed stateless JWT with in-memory blacklist (no DB token storage needed).

**2026-05-26T18:39Z**
> "yes go ahead with stateless JWT"
Decided on in-memory token blacklist for logout; simpler and fits single-instance deployment.

**2026-05-26T18:42Z**
> "DeleteDateColumn (recommended)"
Chose TypeORM `@DeleteDateColumn` soft-delete over a manual `isDeleted` boolean flag.

**2026-05-26T18:42Z**
> "service-level calls"
Chose service-level audit log calls over a TypeORM subscriber to keep audit logic explicit and testable.

**2026-05-26T18:43Z**
> "db bytea"
Decided to store file attachments as PostgreSQL `bytea` in the DB rather than disk/S3, per project scope.

**2026-05-26T18:44Z**
> "@nestjs/schedule cron"
Chose `@nestjs/schedule` with `@Cron` decorator for the escalation background job.

**2026-05-26T18:44Z**
> "global exception filter"
Confirmed global `HttpExceptionFilter` for consistent `{ statusCode, message, error }` error shape.

---

## Phase 3: Tasks

**2026-05-27T15:29Z**
> "yes start phase 3"
Generated `tasks.md` with 10 implementation tasks (Task 0–9), each with files, acceptance criteria, and test requirements.

**2026-05-27T15:36Z**
> "do you use compose.yml to connect to postgres db? i dont see any references for it in the tasks or design.md"
Added explicit `compose.yml` DB credentials to `design.md` and all relevant task descriptions; merged as PR #5.

---

## Phase 4: Implementation

### Task 0 – Project Setup

**2026-05-27T15:41Z**
> "yes start task 0"
Bootstrapped NestJS app: all entities, enums, TypeORM config, global pipes/filters, admin seed on startup.

**2026-05-27T15:57Z**
> "i installed docker, continue to check task 1"
Verified Docker was running; TypeORM auto-created all tables; confirmed app boots cleanly.

**2026-05-27T16:05Z**
> "i tried to run the app and go to http://localhost:3000//auth/login and instead of getting status code of 400 i got 404"
Fixed double-slash URL in manual test; `POST /auth/login` with missing body correctly returns 400.

**2026-05-27T16:07Z**
> "how can i run the e2e test by myself"
Explained `npm run test:e2e` command; requires DB running via `docker compose up -d`.

---

### Task 1 – Users Module

**2026-05-27T16:08Z**
> "merge the PR and start task 1"
Implemented Users CRUD: GET/POST/PATCH/DELETE with role enum validation, unit + E2E tests.

---

### Task 2 – Auth Module

**2026-05-27T16:27Z**
> "merge the PR and start task 2"
Implemented JWT auth: login/logout/me, bcrypt password check, in-memory blacklist, JwtStrategy.

**2026-05-27T16:38Z**
> "i want to create new user and check the api with postman. give me a query requests for postman"
Created initial Postman collection with Auth and Users folders, `{{baseUrl}}` and `{{token}}` variables.

**2026-05-27T16:50Z**
> "i have this requirement 'The system must protect all API endpoints using JWT-based authentication', so all users api need also protect by jwt"
Added `JwtAuthGuard` + `RolesGuard` to all Users endpoints.

**2026-05-27T16:59Z**
> "what is your recommendation, should we make the create user api open without jwt, so everyone can insert new user or we need to seed auth user when app start?"
Recommended seeding admin on startup (avoids public registration endpoint).

**2026-05-27T17:01Z**
> "yes implement seed admin on startup. and update also the requirements.md design.md and tasks.md. and tests"
Added `OnApplicationBootstrap` seed in `AppService`; updated all docs; added unit tests for idempotency.

---

### Task 3 – Projects Module

**2026-05-27T17:12Z**
> "merge the PR and start task 3"
Implemented Projects CRUD, soft delete, restore, workload endpoint, audit logging.

**2026-05-27T17:22Z**
> "you can use postman mcp i want to create collection to check this"
Created structured Postman collection JSON file with Auth/Users/Projects folders and test scripts.

---

### Task 4 – Tickets Module

**2026-05-27T17:28Z**
> "merge the PR and start task 4"
Implemented Tickets: status lifecycle enforcement, DONE lock, optimistic locking (`version`), `isOverdue`, CSV export/import.

**2026-05-27T17:38Z**
> "update the postman collection"
Added Tickets folder (9 requests) to Postman collection; auto-capture `ticketId` from 201 response.

**2026-05-27T17:49Z**
> "update the sdlc skill: in Phase 4+ – Implementation Tasks add instruction to update postman collection tests"
Updated `.claude/skills/sdlc.md` Phase 4+ step 5 with inline Postman update instructions (no separate skill needed).

---

### Task 5 – Comments Module

**2026-05-27T17:50Z**
> "merge the PR and start task 5"
Implemented Comments: `@mention` parsing (case-insensitive), mention diff on update, optimistic locking.

**2026-05-27T17:59Z**
> "why didnt you used the skill to update the postman collection?"
Clarified that the SDLC skill now embeds Postman update instructions inline; updated collection with Comments folder.

**2026-05-27T18:01Z**
> "you dont have to make a new skill, we want to update the sdlc skill to use this instructions"
Confirmed approach: Postman update logic lives in `sdlc.md`, not a separate skill file.

---

### Task 6 – Audit Logs Module

**2026-05-27T18:09Z**
> "merge the PR and start task 6"
Implemented Audit Logs: read-only endpoint with `entityType`, `entityId`, `action`, `actor` filters.

**2026-05-27T18:14Z**
> "you update the postman collection?"
Confirmed Postman collection was updated as part of the task (per updated SDLC skill).

---

### Task 7 – Ticket Dependencies Module

**2026-05-27T18:15Z**
> "merge the PR and start task 7"
Implemented Ticket Dependencies: BFS circular dependency detection, blocker check before DONE transition, `forwardRef()` to resolve circular DI between TicketsModule and TicketDependenciesModule.

**2026-05-27T18:34Z**
> "explain why we use the version field in ticket?"
Explained optimistic locking: `version` is a TypeORM `@VersionColumn` auto-incremented on each save; a stale `version` in a PATCH request returns 409 to prevent lost-update race conditions.

---

### Task 8 – Attachments Module

**2026-05-27T18:37Z**
> "merge the PR and start task 8"
Implemented Attachments: Multer memory storage, 10 MB limit, MIME type validation (415), `bytea` DB storage, binary data stripped from API response.

---

### Task 9 – Scheduler Module

**2026-05-27T18:42Z**
> "merge the PR and start task 9"
Implemented Scheduler: daily escalation cron (LOW→MEDIUM→HIGH→CRITICAL, sets `isOverdue=true` at CRITICAL), auto-assignment to least-loaded DEVELOPER on ticket create.

**2026-05-27T18:59Z**
> "how can i test the scheduler?"
Explained three options: call `runEscalation()` directly (used in E2E tests), add a debug admin endpoint, or temporarily change the cron to `EVERY_MINUTE`.

**2026-05-27T19:07Z**
> "when i run the npm start i see logs about the scheduler running?"
Added NestJS `Logger` to `SchedulerService` so cron execution is visible in the terminal.

**2026-05-27T19:09Z**
> "i change to run every minute, wait a minute and dont see any change"
Root cause: the cron expression change was made locally but not saved to the file (file still had `EVERY_DAY_AT_MIDNIGHT`); the edit never persisted.

**2026-05-27T19:14Z**
> "i wait and i dont see the log and any changes, check if the change the CORN time work"
Confirmed file had `EVERY_DAY_AT_MIDNIGHT`; changed it to `EVERY_MINUTE` in the actual file; restarted app and verified escalation fired and ticket priority bumped.

**2026-05-27T19:16Z**
> "it works, revert to midnight"
Reverted cron back to `EVERY_DAY_AT_MIDNIGHT` for production.

---

### Task 10 – Documentation

**2026-05-27T19:16Z**
> "merge the PR and start task 10"
Created `run.md` with step-by-step setup instructions; generated `prompts.md` from raw log.
