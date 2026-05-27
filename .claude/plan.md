# IssueFlow NestJS Homework Implementation Plan

## Context
Implement the full IssueFlow ticket management backend using the NestJS/TypeScript starter at `issueflow-typescript/`. Requirements are specified in the README.md. Two supporting tools need to be created first: an SDLC skill and a prompts hook+skill.

---

## Part 0: Tooling Setup (before any code)

All tooling files are stored **inside the project** at `issueflow-typescript/`:

### File layout
```
issueflow-typescript/
  plan.md                        ← copy of this plan (project-visible)
  .claude/
    settings.json                ← project-level hook config
    skills/
      sdlc.md                    ← /sdlc skill
      curate-prompts.md          ← /curate-prompts skill
  .prompts-raw.md                ← auto-logged prompts (gitignored)
```

### Tool A: Hook — Auto-log prompts
Create `issueflow-typescript/.claude/settings.json`:
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"## Prompt\\n$(date -u +%Y-%m-%dT%H:%M:%SZ)\\nModel: claude-sonnet-4-6\\n\\n$CLAUDE_USER_PROMPT\\n---\" >> .prompts-raw.md"
          }
        ]
      }
    ]
  }
}
```
Add `.prompts-raw.md` to `.gitignore`.

### Tool B: Skill — `/curate-prompts`
Create `issueflow-typescript/.claude/skills/curate-prompts.md`:
- Reads `.prompts-raw.md`, selects significant interactions grouped by phase
- States model: `claude-sonnet-4-6` at the top
- Writes curated `prompts.md`

### Tool C: Skill — `/sdlc`
Create `issueflow-typescript/.claude/skills/sdlc.md`:
- Guides through each SDLC phase one at a time:
  1. Create `requirements.md` from specs → branch `docs/requirements` → commit → PR → **pause, wait for merge**
  2. Create `design.md` from requirements → branch `docs/design` → commit → PR → **pause, wait for merge**
  3. Create `tasks.md` (tests included per task) → branch `docs/tasks` → commit → PR → **pause, wait for merge**
  4. For each task: branch → implement → write tests → verify → PR → **pause, wait for merge**
- Each phase requires explicit user confirmation before proceeding to next

### Tool D: `plan.md`
Copy this plan into `issueflow-typescript/plan.md` so it's visible in the repo.

### Tool E: `CLAUDE.md`
Create `issueflow-typescript/CLAUDE.md` at the start of work — persistent instructions for Claude in this project:
- Model: claude-sonnet-4-6
- SDLC workflow: branch per task, PR before proceeding
- Code standards: clean code, SOLID principles, NestJS best practices
- Always ask user before making architectural/design decisions
- Always write tests alongside implementation
- Log all significant prompts via the hook

---

## Part 1: SDLC Document Phases (each = 1 branch + PR)

### Branch: `docs/requirements`
Create `issueflow-typescript/requirements.md`:
- Functional requirements (all APIs from README)
- Non-functional requirements (validation, error handling, tests)
- Constraints (NestJS, TypeORM, PostgreSQL)
- Out of scope

### Branch: `docs/design`
Create `issueflow-typescript/design.md` — **interactive phase**:
- Claude presents each design decision with best-practice options and asks the user to choose before writing
- Topics covered (each as a separate question):
  1. Module structure (feature modules vs. shared modules)
  2. Entity design & relationships (TypeORM decorators, M2M join table)
  3. Auth strategy (JWT stateless vs. blacklist-based logout)
  4. Soft delete approach (TypeORM `@DeleteDateColumn` vs. manual `deletedAt`)
  5. Audit log pattern (interceptor vs. service-level calls)
  6. File storage strategy (DB bytea vs. local disk vs. S3-compatible)
  7. Scheduler approach (`@nestjs/schedule` cron vs. queue-based)
  8. Error handling strategy (global filter vs. per-service)
- Best practice recommendation given for each choice before asking

### Branch: `docs/tasks`
Create `issueflow-typescript/tasks.md`:
- One task per feature module
- Each task includes: description, files to create, acceptance criteria, **tests to write** (unit + E2E)

---

## Part 2: Implementation Tasks (each = 1 branch + PR, with tests)

Each task follows: **implement with clean code + SOLID principles → write tests → verify → PR → wait for merge**

| # | Branch | Scope | Tests |
|---|--------|-------|-------|
| 1 | `task/setup` | App config, TypeORM, all entities, enums, global exception filter, ValidationPipe | TypeORM connection test; entity schema validation |
| 2 | `task/users` | UsersModule CRUD (repository pattern, DTOs, service/controller separation) | Unit: UsersService (mock repo); E2E: /users endpoints |
| 3 | `task/auth` | AuthModule JWT login/logout/me (JwtStrategy, guard, blacklist) | Unit: AuthService; E2E: /auth endpoints, guard rejection |
| 4 | `task/projects` | ProjectsModule CRUD + soft delete + workload (clean service layer) | Unit: ProjectsService; E2E: /projects + soft delete + workload |
| 5 | `task/tickets` | TicketsModule CRUD + soft delete + isOverdue computed field | Unit: TicketsService; E2E: /tickets + filter + isOverdue |
| 6 | `task/comments` | CommentsModule + @mention parsing (pure parser utility, testable) | Unit: mention parser + CommentsService; E2E: /tickets/:id/comments |
| 7 | `task/audit-logs` | AuditLogsModule + integration into all services | Unit: AuditLogService; E2E: /audit-logs filters |
| 8 | `task/dependencies` | Ticket blocker dependencies (circular dependency guard) | Unit: dependency logic; E2E: /tickets/:id/dependencies |
| 9 | `task/attachments` | File upload/delete (multer, stream handling) | Unit: AttachmentsService; E2E: multipart upload |
| 10 | `task/csv` | Export + Import CSV (streaming export, error accumulation on import) | Unit: CSV parser; E2E: export file + import with errors report |
| 11 | `task/scheduler` | Auto-escalation + auto-assignment (injected services, testable in isolation) | Unit: scheduler logic with mocked dependencies |
| 12 | `task/docs` | run.md + prompts.md via `/curate-prompts` | Manual verification |

**Clean code standards applied to every task:**
- Single Responsibility per service/controller/module
- DTOs for all inputs (class-validator decorators)
- No business logic in controllers
- Repository pattern via TypeORM repositories (injected, mockable)
- Consistent error handling via global `HttpExceptionFilter`
- No magic strings — use enums and constants

---

## Stack
- **Framework**: NestJS 10 (installed)
- **ORM**: TypeORM 0.3.20 + PostgreSQL
- **Auth**: `@nestjs/jwt`, `passport-jwt`
- **Scheduling**: `@nestjs/schedule`
- **Missing packages**: `npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/schedule && npm install -D @types/passport-jwt`

---

## Entities Summary

| Entity | Key Fields |
|--------|-----------|
| `User` | id, username, email, fullName, role (DEVELOPER/ADMIN), passwordHash |
| `Project` | id, name, description, ownerId, deletedAt |
| `Ticket` | id, title, description, status, priority, type, projectId, assigneeId, dueDate, deletedAt |
| `Comment` | id, ticketId, authorId, content, mentionedUsers (M2M User) |
| `AuditLog` | id, action, entityType, entityId, performedBy, actor, timestamp |
| `TicketDependency` | ticketId, blockedById |
| `Attachment` | id, ticketId, filename, contentType, data (bytea) |

---

## Verification
1. `docker compose up -d` → PostgreSQL up
2. `npm install` → dependencies ready
3. `npm run start:dev` → server on port 3000
4. `npm run test` → all unit tests pass
5. `npm run test:e2e` → all E2E tests pass
6. Test overdue escalation and auto-assignment manually
