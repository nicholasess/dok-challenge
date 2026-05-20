# AGENTS.md

## Global Instructions

- Follow `/Users/nicholaseduardo/.codex/RTK.md`.
- Prefix shell commands with `rtk`.
- Keep instructions, docs, comments, and user-facing repo guidance in English unless the user asks otherwise.

## Project Context

- This is a NestJS 9 TypeScript backend using pnpm.
- Runtime source lives in `src/`. Unit tests live beside source files as `*.spec.ts`. E2E tests live beside the source they verify as `*.e2e-spec.ts`.
- Build output and generated files should stay out of source control.

## Key Documents

- Read `docs/business-rules.md` before implementing domain, provider, payment, validation, or error-handling behavior.
- Read `docs/architecture.md` before adding modules, folders, providers, or changing request flow. It defines module structure, layer responsibilities, error mapping, and testing strategy.
- Keep code, tests, and README examples aligned with `docs/business-rules.md`.
- If `PRD.md` and `docs/business-rules.md` conflict, stop and ask which source should win before implementing.

## Commands

- Install dependencies: `rtk pnpm install`
- Run dev server: `rtk pnpm run start:dev`
- Build: `rtk pnpm run build`
- Unit tests: `rtk pnpm exec jest`
- E2E tests: `rtk pnpm run test:e2e`
- Lint: `rtk pnpm run lint`
- Format: `rtk pnpm run format`

## Testing Expectations

- Add or update unit tests when changing service behavior.
- Add or update controller tests when changing route behavior.
- Add or update e2e tests for request/response contract changes.
- Keep test files close to the source they verify. Unit tests as `*.spec.ts`, e2e tests as `*.e2e-spec.ts`, both beside the source module.

## Change Discipline

- Inspect the existing files before editing.
- Keep changes scoped to the requested task.
- Do not rewrite generated starter files just for style cleanup unless the task requires it.
- Do not remove user changes from the working tree.
- Update README or API docs when behavior, commands, or setup changes.
