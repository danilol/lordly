# Deferred Work

## Product wishes (PO, 2026-07-12) — to scope in a future planning pass

- **Tech-debt story before epic 2** (Danilo, during story 1.5 planning): before the first epic-2 story starts, insert a dedicated refactoring / cleanup / performance-improvement story. Natural scope inputs when it's created: everything in this file's deferred sections (lint tooling + AST purity guard, vite-config consolidation, template cruft, seed-bound constant dedup, chassis-stub notes), **the blurry-font investigation below**, plus any hotspots the epic-1 retrospective surfaces. Formalize via `correct-course` or at the epic-1 retrospective so it lands in sprint-status ahead of story 2.1.

- **"Nice documentation about the project"** (Danilo, during epic 1). The plan already carries NFR3's artifacts (README, `docs/rules.md` arriving with story 2.4's Help screen, ADRs, engine doc comments) — but the PO wants to go beyond that baseline. Candidate scope to discuss when planned (e.g. via `correct-course` or when epic 2 closes): a proper docs site or polished docs/ index, architecture walkthrough for outsiders, gameplay/rules showcase, screenshots/GIFs in the README, contributor guide. Not a current-sprint concern.

- **Position-dependent move variety per class** (Danilo, after playing the story-1.9 build on Android Chrome — "forgot to add on the project briefing"). Today each class has one attack behavior and only its *action count* varies by row (`BALANCE.classes[cls].actions.{front,mid,back}`, per FR13). The wish: the *move itself* also varies by row — e.g. Knight front row → 2× "Sword Slash" (full melee), mid row → 1× "Sword Slash", back row → 1-2× "Shield Cover" (a defensive move: raise defense or block one attack) instead of attacking; Mage front row → "Staff Attack" (a weak physical poke, since a squishy caster shouldn't be in melee range), mid row → 1× spell cast, back row → 2× spell cast (full caster value from safety). **RESOLVED via `correct-course` (2026-07-13, see `docs/planning-artifacts/sprint-change-proposal-2026-07-13.md`):** formalized as PRD FR32/FR33 and a new post-MVP **Epic 4** stub in `epics.md`; the full per-class per-row table and the exact Guard mechanic remain an open design question for Epic 4's PM/Architect scoping pass.

- **Move names/flavor text per class** (Danilo, same session) — cosmetic layer on top of the above: "Sword Slash" (Knight/Mercenary), "{element} Cast" (Witch/Mage spells), "Sniper Arrow" (Archer), etc., surfaced in the class-selection UI (Draft scene) with a clearer, more highlighted display of what each class does *per row*. Bundles naturally with the position-dependent-move-variety item above — the flavor text is most valuable once the moves actually differ by row, so it rides along into Epic 4 rather than shipping standalone.

- **Battle log visible on the Battle scene** (Danilo, same session) — an expand/collapse panel under the board showing the scrolling text log of what's happening (not just the animated sprites), so a player can review what just occurred. **RESOLVED via `correct-course` (2026-07-13):** added as a new AC on story 2.2 ("The animated battle scene") in `epics.md` — no engine change, reads the scene's existing `BattleLog`.

- **Endless vs. limited-turn match mode** (Danilo, same session) — clarified as: wipeout (or a time limit) as one mode, alongside today's single-engagement/limited-turns mode as the other. **RESOLVED via `correct-course` (2026-07-13):** story 1.10's AC2 amended in `epics.md` to make mode a real player-facing choice (Standard vs. Wipeout) instead of a dev/debug-only toggle — story 1.10 is still `backlog`/unstarted, so no rework needed.

- **Font still reads as blurry on Danilo's actual Android device** (reported during the story-1.9 Android Chrome confirmation, despite the `crispText`/`TEXT_RESOLUTION = 3` fix shipped in story 1.8). Story 1.8's review explicitly dismissed `devicePixelRatio`-aware scaling as "a micro-opt" over the fixed `TEXT_RESOLUTION = 3` choice — this real-device report suggests the fixed multiplier may not be enough on Danilo's specific device/DPI, and is worth a closer look (rendering at `devicePixelRatio`-scaled resolution, or a higher fixed multiplier) rather than being re-dismissed. Candidate for the epic-1 retro or a quick investigation before epic 2's polish work.

## Deferred from: code review of story-1.1 (2026-07-12)

- No lint/format step in the CI quality gate — only typecheck/test/coverage run today; adding ESLint/Prettier (or equivalent) is a scope decision for a future story, not required by story 1.1's ACs.
- `pnpm-workspace.yaml`'s `allowBuilds` allowlist is hand-maintained (esbuild, sharp, workerd — currently all legitimately required by wrangler's dependency tree). A future dependency bump that introduces a new native postinstall script not yet listed will hard-fail `pnpm install --frozen-lockfile` in CI with `ERR_PNPM_IGNORED_BUILDS`, unrelated to any code change in that PR.
- `apps/web/src/main.ts`'s `StartGame('game-container')` call has no try/catch or fallback UI if Phaser/WebGL initialization throws. This is pre-existing vendored template code (phaserjs/template-vite-ts), out of scope per story 1.1's scope fence ("keep the template's demo scene as-is for now... do NOT start building game scenes here").
- `packages/engine/tsconfig.json` and `apps/web/tsconfig.json` differ in strictness flags (`noUnusedLocals`/`noUnusedParameters` only in web, `noUncheckedIndexedAccess` only in engine) with no documented rationale for the asymmetry. Low urgency; revisit if it causes friction.

## Deferred from: code review of story-1.1, second pass (2026-07-12)

- CI's corepack bootstrap depends on the runner image's preinstalled Node still bundling corepack; corepack has been removed from newer Node distributions, so a future ubuntu-latest image bump could break the `corepack enable` step. Revisit if/when CI fails with "corepack: command not found".
- `pnpm -r typecheck` silently skips any workspace package that lacks a `typecheck` script (it only hard-fails when no package has it). No clean guard exists; recheck when a third workspace package is added.
- Template cruft in apps/web: `phasermsg` marketing banner in the prod Vite config (also prints its success banner even when the build fails), `Game.ts` demo text containing a phaser.io address, and duplicated dev/prod Vite configs carrying dead keys (`manualChunks` unused by the dev server, `server.port` unused by `vite build`). The demo scene and template structure are replaced in stories 1.2/2.x.

## Deferred from: code review of story-1.3 (2026-07-12)

- The engine purity guard is regex-based and inherently bypassable (e.g. computed member access, aliased imports). An ESLint `no-restricted-globals`/`no-restricted-imports` config or AST-based import-graph check would be categorically stronger; fold into the lint-tooling decision already deferred from story 1.1's review.

## Deferred from: code review of story-1.4 (2026-07-12)

- Chassis `BattleEnded`/`hpPct`/`EngagementEnded.hp` are hardcoded stubs (all-full-HP draw) type-indistinguishable from real judged output. Story 1.5 makes them real; no shell consumes the log until 1.9. Revisit only if a consumer appears before 1.5.
- Seed-range bound `0xffffffff` is duplicated in `validate.ts` and `rng.ts` with divergent error types (InvalidMatchSetupError vs RangeError). Validate-first ordering makes it correct today; fold into a shared constant when rng.ts is next touched.

## Deferred from: code review of story-1.5 (2026-07-12)

- Engine hot-path allocation churn: per-swing candidate projection in `takeTurn`, `judgedView` materialized on every turn and twice at battle end. Harmless at 6 units; matters for NFR4's headless sim-harness throughput (story 1.7 runs thousands of battles). Input for the pre-epic-2 tech-debt story.
- Judging-symmetry property proves symmetry only for asymmetric rosters (mirror-tie setups are filtered because the coin flip is not side-symmetric). A complementary invariant — "the coin flip is the SOLE source of mirror-match asymmetry" — needs a test harness that can control/inject the flip. Design note for the tech-debt story.

## Deferred from: code review of story-1.8 (2026-07-13)

- Navigation is one-way with a dead-end: Home→Draft→Placement→Reveal has no back-navigation, and the Reveal placeholder has no exit (the player is stranded until a tab reload). Explicitly deferred to story 1.9, which owns the real post-submit screens (Reveal/Battle/Result) and the Result→Rematch→Home navigation. 1.8 ships as a demoable one-way milestone. When 1.9 lands, ensure: a Home/back affordance exists from every scene, and Placement→Draft back-nav (if wanted) accounts for the forward-only element stream (re-adding re-rolls).
