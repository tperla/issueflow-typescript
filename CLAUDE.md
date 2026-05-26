# CLAUDE.md – IssueFlow TypeScript Project Instructions

## Model
claude-sonnet-4-6

## SDLC Workflow
- One branch per task/phase, PR before proceeding to the next
- Always pause after creating a PR and wait for user to confirm merge
- Use `/sdlc` skill to guide through phases
- Use `/curate-prompts` skill at the end to generate `prompts.md`

## Code Standards
- NestJS best practices: feature modules, dependency injection
- SOLID principles: single responsibility, open/closed, etc.
- Clean code: meaningful names, small functions, no magic strings
- DTOs for all inputs with `class-validator` decorators
- No business logic in controllers — all logic lives in services
- Repository pattern via injected TypeORM repositories (mockable)
- Consistent error handling via global `HttpExceptionFilter`
- Use enums for status, priority, type, role, etc.

## Testing
- Write unit tests alongside every service (mock repositories)
- Write E2E tests for every controller (supertest)
- Run `npm run test` and `npm run test:e2e` before every PR
- Tests must pass before creating a PR

## Design Decisions
- Always ask the user before making architectural or design decisions not already documented in `design.md`
- Present best-practice options with a recommendation before asking

## Prompts
- All prompts are auto-logged to `.prompts-raw.md` via the UserPromptSubmit hook
- Run `/curate-prompts` at the end of the project to generate `prompts.md`

## Database
- PostgreSQL via TypeORM 0.3.20
- Connection: host=localhost, port=5432, user=issueflow, password=issueflow, db=issueflow
- Start DB: `docker compose up -d`

## Missing Packages to Install
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/schedule
npm install -D @types/passport-jwt
```
