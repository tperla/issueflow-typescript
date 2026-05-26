# IssueFlow – Design Document

## 1. Module Structure

**Decision: Feature modules**

One NestJS module per domain, each self-contained with its own controller, service, and repository:

- `UsersModule`
- `AuthModule`
- `ProjectsModule`
- `TicketsModule`
- `CommentsModule`
- `AuditLogsModule`
- `TicketDependenciesModule`
- `AttachmentsModule`
- `SchedulerModule`

A shared `DatabaseModule` provides TypeORM repository injection across modules.

---

## 2. Entity Design & Relationships

**Decision: Decorator-based with explicit join table**

All TypeORM entities use class decorators (`@Entity`, `@Column`, `@ManyToOne`, etc.). The `Comment ↔ User` many-to-many (mentions) relationship uses `@ManyToMany` with `@JoinTable`, creating an explicit `comment_mentioned_users` join table for full query control.

### Entity Overview

| Entity | Key Columns |
|--------|-------------|
| `User` | `id`, `username`, `email`, `fullName`, `role` (enum), `passwordHash` |
| `Project` | `id`, `name`, `description`, `ownerId`, `deletedAt` |
| `Ticket` | `id`, `title`, `description`, `status`, `priority`, `type`, `projectId`, `assigneeId`, `dueDate`, `deletedAt` |
| `Comment` | `id`, `ticketId`, `authorId`, `content`, `mentionedUsers` (M2M → User) |
| `AuditLog` | `id`, `action`, `entityType`, `entityId`, `performedBy`, `actor`, `timestamp` |
| `TicketDependency` | `ticketId`, `blockedById` (composite PK) |
| `Attachment` | `id`, `ticketId`, `filename`, `contentType`, `data` (bytea) |

### Enums

- `UserRole`: `DEVELOPER`, `ADMIN`
- `TicketStatus`: `TODO`, `IN_PROGRESS`, `DONE`
- `TicketPriority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `TicketType`: `BUG`, `FEATURE`, `TASK`
- `AuditAction`: `CREATE`, `UPDATE`, `DELETE`, `RESTORE`
- `AuditEntityType`: `USER`, `PROJECT`, `TICKET`, `COMMENT`, `ATTACHMENT`
- `AuditActor`: `USER`, `SYSTEM`

---

## 3. Authentication Strategy

**Decision: Stateless JWT + in-memory blacklist**

- Login issues a signed JWT with 1-hour expiry via `@nestjs/jwt`
- `JwtStrategy` (passport-jwt) validates tokens on protected routes
- Logout adds the token to an in-memory `Set` (blacklist) inside `AuthService`
- A custom `JwtAuthGuard` checks the blacklist before allowing access
- No DB round-trips for token validation

---

## 4. Soft Delete

**Decision: `@DeleteDateColumn`**

TypeORM's built-in soft delete is used on `Project` and `Ticket` entities:

- `@DeleteDateColumn() deletedAt: Date` — automatically populated on `softDelete()`
- All standard `find` queries automatically exclude soft-deleted records
- Restore via `repository.restore(id)`
- Deleted records accessible via `repository.find({ withDeleted: true })`

---

## 5. Audit Log Pattern

**Decision: Service-level calls**

Each service explicitly calls `AuditLogService.log(dto)` after every state-changing operation (create, update, delete, restore). This provides:

- Precise control over `entityId`, `performedBy`, and `actor` context
- Full testability (mock `AuditLogService` in unit tests)
- Clear, readable audit trail in each service method

`AuditLogService` is imported into each feature module via `AuditLogsModule` (exported provider).

---

## 6. File Storage

**Decision: DB bytea**

Attachment binary data is stored directly in PostgreSQL as a `bytea` column (`data: Buffer`) on the `Attachment` entity. This keeps all data in one place, requires no extra infrastructure, and fits the project scope.

Upload via `multer` (memory storage), download streamed directly from the DB column.

---

## 7. Scheduler

**Decision: `@nestjs/schedule` cron**

Background jobs are implemented as `@Cron`-decorated methods inside `SchedulerService`:

- **Auto-escalation**: runs periodically, finds overdue non-DONE tickets and bumps priority one level (LOW→MEDIUM→HIGH→CRITICAL), logs each change via `AuditLogService` with `actor: SYSTEM`
- **Auto-assignment**: finds unassigned tickets per project, assigns to the DEVELOPER with the fewest open tickets, logs via `AuditLogService` with `actor: SYSTEM`

Both methods are plain service methods — testable by calling them directly without needing to invoke the cron scheduler.

---

## 8. Error Handling

**Decision: Global exception filter**

A single `HttpExceptionFilter` is registered globally in `main.ts`. It catches all `HttpException` instances and returns a consistent response shape:

```json
{
  "statusCode": 404,
  "message": "Ticket not found",
  "error": "Not Found"
}
```

`ValidationPipe` (global) handles DTO validation errors and returns 400 with field-level messages. Services throw `HttpException` subclasses (`NotFoundException`, `BadRequestException`, etc.) — no error formatting in controllers.
