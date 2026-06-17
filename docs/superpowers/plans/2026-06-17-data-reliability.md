# Data Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated data health checks, wire them into GitHub Actions, and document the current StarVista data reliability path.

**Architecture:** Keep validation as a small TypeScript CLI under `scripts/`, with pure logic in `scripts/lib/` and Vitest coverage. GitHub Actions should run the same `npm run verify:data` command after data generation and before deploy build.

**Tech Stack:** Astro, TypeScript, tsx, Vitest, GitHub Actions, GitHub Pages.

---

## File Responsibilities

- `scripts/lib/verify-data.ts`: Pure validation logic for manifest freshness, repo detail coverage, and snapshot continuity.
- `scripts/verify-data.ts`: CLI wrapper that reads `DATA_DIR`, threshold arguments, and exits non-zero with readable errors.
- `tests/verify-data.test.ts`: TDD coverage for healthy data, stale manifest, missing repo detail, stale/latest snapshot, and snapshot gaps.
- `package.json`: Add `verify:data`.
- `.github/workflows/update-data.yml`: Change cron to a non-zero minute and run `npm run verify:data` after generation.
- `.github/workflows/deploy.yml`: Run `npm run verify:data` after restoring `public/data` and before build.
- `README.md`: Explain automatic data updates and verification.
- `DEVELOPMENT_PLAN.md`: Reflect actual Phase 0-5 status and Phase 4 data-window gate.

## Tasks

### Task A: Data Verification CLI and Tests

- [ ] Write failing tests in `tests/verify-data.test.ts`.
- [ ] Verify the new tests fail because `verifyData` is missing.
- [ ] Implement `scripts/lib/verify-data.ts` with a typed `verifyData` function returning issue objects.
- [ ] Implement `scripts/verify-data.ts` as a CLI with `--data-dir`, `--max-age-hours`, and `--now` options.
- [ ] Add `verify:data` to `package.json`.
- [ ] Run targeted test: `npm test -- tests/verify-data.test.ts`.

### Task B: GitHub Actions Integration

- [ ] Change `Update Data` schedule from `0 2 * * *` to `17 2 * * *`.
- [ ] Add a `Verify generated data` step after `Generate data` in `.github/workflows/update-data.yml`.
- [ ] Add a `Verify restored data` step after `Install dependencies` or data restore in `.github/workflows/deploy.yml`, before `Build`.
- [ ] Ensure both steps use `DATA_DIR: public/data` and `npm run verify:data`.

### Task C: Documentation

- [ ] Update `DEVELOPMENT_PLAN.md` with a current status section: Phase 0-5 mostly implemented; Phase 4 trend code awaits the 2026-06-20 seven-day window.
- [ ] Document that automatic snapshots started on 2026-06-13 and must not be backfilled with fabricated history.
- [ ] Update `README.md` with daily Actions/data branch behavior, `npm run verify:data`, and the 2026-06-20 trend validation checklist.

## Verification

- [ ] `npm run format`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run verify:data`
- [ ] `gh run list --repo MightyKartz/StarVista --workflow "Update Data" --limit 5`
- [ ] `gh run list --repo MightyKartz/StarVista --workflow "Deploy" --limit 5`

## Pull Request

- [ ] Commit message: `chore: add data reliability checks`
- [ ] Push `codex/data-reliability`.
- [ ] Open draft PR titled `[codex] add data reliability checks`.
