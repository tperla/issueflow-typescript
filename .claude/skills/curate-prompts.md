# /curate-prompts

Curate the raw prompt log into a clean, readable `prompts.md` file.

## Instructions

1. Read `.prompts-raw.md` to get all raw prompt entries
2. Filter out trivial or repetitive prompts; keep only significant interactions
3. Group the selected prompts by SDLC phase:
   - Phase 0: Tooling Setup
   - Phase 1: Requirements
   - Phase 2: Design
   - Phase 3: Tasks
   - Phase 4+: Implementation (one section per task)
4. Write `prompts.md` with the following structure:

```markdown
# IssueFlow – Prompts Log

**Model**: claude-sonnet-4-6

## Phase 0: Tooling Setup
...selected prompts...

## Phase 1: Requirements
...selected prompts...

## Phase 2: Design
...selected prompts...

## Phase 3: Tasks
...selected prompts...

## Phase 4: Implementation
### Task N – <name>
...selected prompts...
```

5. Each prompt entry should include:
   - Timestamp
   - The prompt text (truncated to ~200 chars if very long)
   - A one-line summary of the outcome/response

6. Overwrite `prompts.md` with the curated result.
