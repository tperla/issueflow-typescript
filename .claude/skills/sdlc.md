# /sdlc

Guide through the IssueFlow SDLC phases one at a time, pausing for user confirmation between each phase.

## Phases

### Phase 1 – Requirements (`docs/requirements`)
1. Create `requirements.md` from the README/specs
2. `git checkout -b docs/requirements`
3. `git add requirements.md && git commit -m "docs: add requirements"`
4. Create PR: `gh pr create --title "docs: requirements" --body "..."`
5. **STOP** — inform user: "Requirements PR created. Please review and merge, then reply 'merged' to continue."

### Phase 2 – Design (`docs/design`) — **Interactive**
After user confirms Phase 1 merged:
1. Ask the user each design question one at a time (wait for answer before next):
   1. Module structure: feature modules (recommended) vs. shared modules
   2. Entity design: TypeORM decorators + M2M join table approach
   3. Auth strategy: JWT stateless (recommended) vs. blacklist-based logout
   4. Soft delete: `@DeleteDateColumn` (recommended) vs. manual `deletedAt`
   5. Audit log pattern: interceptor vs. service-level calls (recommended)
   6. File storage: DB bytea (recommended for simplicity) vs. local disk vs. S3
   7. Scheduler: `@nestjs/schedule` cron (recommended) vs. queue-based
   8. Error handling: global filter (recommended) vs. per-service
2. Create `design.md` based on user's answers
3. Branch → commit → PR → **STOP**

### Phase 3 – Tasks (`docs/tasks`)
After user confirms Phase 2 merged:
1. Create `tasks.md` with one task per feature module
2. Each task includes: description, files, acceptance criteria, tests
3. Branch → commit → PR → **STOP**

### Phase 4+ – Implementation Tasks
After user confirms Phase 3 merged, for each task in `tasks.md`:
1. `git checkout -b task/<name>`
2. Implement with clean code + SOLID principles
3. Write unit and E2E tests
4. `npm run test` and `npm run test:e2e` — verify all pass
5. Update `issueflow-postman-collection.json`:
   - Glob `src/**/*.controller.ts` and read each file to find new/changed routes (base path, HTTP verb, sub-path, ADMIN-only guards)
   - Read the current collection to see what already exists
   - For each new route not yet in the collection:
     - Add a folder (named after the resource) or add requests to an existing folder
     - Use `{{baseUrl}}` for the host and existing `{{variables}}` for IDs
     - Add a `test` script on 201 responses to auto-save the new resource ID to a collection variable
     - Use `formdata` body mode for file uploads, `raw` + `application/json` for JSON endpoints
     - Note ADMIN-only endpoints in the request name
   - Add any new collection-level variables needed for new ID placeholders
   - Write the updated collection back to `issueflow-postman-collection.json`
6. Commit and create PR → **STOP** — wait for user to merge before next task

## Rules
- Never skip a phase without explicit user confirmation
- Always run tests before creating a PR
- Ask before making architectural or design decisions not covered by the design doc
- Log significant prompts via the auto-hook (no manual action needed)
