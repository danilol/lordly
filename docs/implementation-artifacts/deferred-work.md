# Deferred Work

## Product wishes (PO, 2026-07-12) — to scope in a future planning pass

- **Tech-debt story before epic 2** (Danilo, during story 1.5 planning): before the first epic-2 story starts, insert a dedicated refactoring / cleanup / performance-improvement story. Natural scope inputs when it's created: everything in this file's deferred sections (lint tooling + AST purity guard, vite-config consolidation, template cruft, seed-bound constant dedup, chassis-stub notes), **the blurry-font investigation below**, plus any hotspots the epic-1 retrospective surfaces. Formalize via `correct-course` or at the epic-1 retrospective so it lands in sprint-status ahead of story 2.1.

- **"Nice documentation about the project"** (Danilo, during epic 1). The plan already carries NFR3's artifacts (README, `docs/rules.md` arriving with story 2.4's Help screen, ADRs, engine doc comments) — but the PO wants to go beyond that baseline. Candidate scope to discuss when planned (e.g. via `correct-course` or when epic 2 closes): a proper docs site or polished docs/ index, architecture walkthrough for outsiders, gameplay/rules showcase, screenshots/GIFs in the README, contributor guide. Not a current-sprint concern.

- **Position-dependent move variety per class** (Danilo, after playing the story-1.9 build on Android Chrome — "forgot to add on the project briefing"). Today each class has one attack behavior and only its *action count* varies by row (`BALANCE.classes[cls].actions.{front,mid,back}`, per FR13). The wish: the *move itself* also varies by row — e.g. Knight front row → 2× "Sword Slash" (full melee), mid row → 1× "Sword Slash", back row → 1-2× "Shield Cover" (a defensive move: raise defense or block one attack) instead of attacking; Mage front row → "Staff Attack" (a weak physical poke, since a squishy caster shouldn't be in melee range), mid row → 1× spell cast, back row → 2× spell cast (full caster value from safety). **RESOLVED via `correct-course` (2026-07-13, see `docs/planning-artifacts/sprint-change-proposal-2026-07-13.md`):** formalized as PRD FR32/FR33 and a new post-MVP **Epic 4** stub in `epics.md`; the full per-class per-row table and the exact Guard mechanic remain an open design question for Epic 4's PM/Architect scoping pass.

- **Move names/flavor text per class** (Danilo, same session) — cosmetic layer on top of the above: "Sword Slash" (Knight/Mercenary), "{element} Cast" (Witch/Mage spells), "Sniper Arrow" (Archer), etc., surfaced in the class-selection UI (Draft scene) with a clearer, more highlighted display of what each class does *per row*. Bundles naturally with the position-dependent-move-variety item above — the flavor text is most valuable once the moves actually differ by row, so it rides along into Epic 4 rather than shipping standalone.

- **Battle log visible on the Battle scene** (Danilo, same session) — an expand/collapse panel under the board showing the scrolling text log of what's happening (not just the animated sprites), so a player can review what just occurred. **RESOLVED via `correct-course` (2026-07-13):** added as a new AC on story 2.2 ("The animated battle scene") in `epics.md` — no engine change, reads the scene's existing `BattleLog`.

- **Endless vs. limited-turn match mode** (Danilo, same session) — clarified as: wipeout (or a time limit) as one mode, alongside today's single-engagement/limited-turns mode as the other. **RESOLVED via `correct-course` (2026-07-13):** story 1.10's AC2 amended in `epics.md` to make mode a real player-facing choice (Standard vs. Wipeout) instead of a dev/debug-only toggle — story 1.10 is still `backlog`/unstarted, so no rework needed.

- **Archer should be strong against ALL magical units — mage, cleric, AND witch** (Danilo, 2026-07-13, after losing to a witch comp while playtesting the story-1.10 wipeout build: "we need to make archer good against mage and cleric and witch, so magical units"). Today FR14's triangle gives the archer advantage over the **mage only** (×1.5); cleric and witch sit outside the triangle (×1.0 both ways) — though the archer already counters casters *positionally* via FR9's rearmost-row sniping. This is an FR14 **rules change**, not a number tweak: `BALANCE.rpsBeats` is a one-target-per-class map, so "archer beats three classes" changes the balance-data *shape* (→ `balanceVersion` bump + hash re-pin + golden re-records, AD-8 discipline) and the PRD's triangle definition. Design questions to settle when scoped: one-way advantage (archer deals ×1.5 to casters) vs. full pairs (casters also take ×0.75 disadvantage... i.e. deal less to archer)? Does "beats" stay reciprocal in wording ("Archer beats Mage" already exists — extend or generalize to "Archer beats casters")? And the NFR4 sim harness MUST re-verify the ≤65% dominance band afterward — a 3-class advantage could easily make archer dominant. Worth also checking whether the felt problem is archer weakness or **witch strength** (AGI 26 first-strike + sleep/confusion) — the sim sweep can distinguish. Formalize via `correct-course` (PRD FR14 amendment + a balance story).

- ~~**Font still reads as blurry on Danilo's actual Android device**~~ **ADDRESSED (story 2.0 AC2, reclassified ACCESSIBILITY at the epic-1 retro):** `crispText` is now `devicePixelRatio`-aware (floor `TEXT_RESOLUTION = 3`, `?textres=N` diagnostic override for on-device comparison) and a `MIN_FONT_PX = 10` floor raised the ten 8–9px micro-labels. **Final sign-off = Danilo reading his own phone** (the story's acceptance gate); if it still reads blurry there, reopen with the on-device `?textres` comparison data.

## Deferred from: story-1.10 dev (2026-07-13)

- **Sim-harness wipeout sweep** — `sim/sweep.ts` stays `mode: 'single'` (story 1.10 scope fence). Wipeout shifts balance dynamics for real: poison archetypes gain value (dots persist across engagements and tick at every natural end — FR19's Witch synergy), and sustain comps (Cleric equilibria) hit the engagement cap instead of losing. The NFR4 dominance-band verification (≤65%) has never been run under wipeout. Add a mode knob to the sweep and re-verify when balance work is next scoped (natural bundle: the archer-vs-casters FR14 item above, which already requires a sweep).

## Deferred from: code review of story-1.1 (2026-07-12)

- ~~No lint/format step in the CI quality gate~~ **RESOLVED (story 2.0):** ESLint (flat config, incl. an AST purity layer for the engine) + Prettier check run in CI between typecheck and coverage.
- `pnpm-workspace.yaml`'s `allowBuilds` allowlist is hand-maintained (esbuild, sharp, workerd — currently all legitimately required by wrangler's dependency tree). A future dependency bump that introduces a new native postinstall script not yet listed will hard-fail `pnpm install --frozen-lockfile` in CI with `ERR_PNPM_IGNORED_BUILDS`, unrelated to any code change in that PR.
- ~~`apps/web/src/main.ts` has no try/catch or fallback UI if Phaser init throws~~ **RESOLVED (story 2.0):** init wrapped; plain-DOM fallback message on failure.
- ~~engine/web tsconfig strictness asymmetry~~ **RESOLVED (story 2.0):** flags symmetrized both ways (zero new errors surfaced); the one remaining divergence (`strictPropertyInitialization: false` on web, for Phaser's init()/create() lifecycle) now carries a rationale comment in the config.

## Deferred from: code review of story-1.1, second pass (2026-07-12)

- CI's corepack bootstrap depends on the runner image's preinstalled Node still bundling corepack; corepack has been removed from newer Node distributions, so a future ubuntu-latest image bump could break the `corepack enable` step. Revisit if/when CI fails with "corepack: command not found".
- `pnpm -r typecheck` silently skips any workspace package that lacks a `typecheck` script (it only hard-fails when no package has it). No clean guard exists; recheck when a third workspace package is added.
- ~~Template cruft in apps/web (phasermsg banner, duplicated vite configs, dead keys)~~ **RESOLVED (story 2.0):** configs consolidated onto `vite/config.base.mjs`, banner deleted, dead keys removed. (The `Game.ts` demo text was already gone before this story.)

## Deferred from: code review of story-1.3 (2026-07-12)

- ~~The engine purity guard is regex-based and inherently bypassable~~ **RESOLVED (story 2.0):** AST layer added in `eslint.config.mjs` (no-restricted-imports/globals/properties/syntax scoped to `packages/engine/src/**`); the regex sieve stays as belt-and-suspenders (it also locks the dependency list and source-file census).

## Deferred from: code review of story-1.4 (2026-07-12)

- Chassis `BattleEnded`/`hpPct`/`EngagementEnded.hp` are hardcoded stubs (all-full-HP draw) type-indistinguishable from real judged output. Story 1.5 makes them real; no shell consumes the log until 1.9. Revisit only if a consumer appears before 1.5.
- ~~Seed-range bound `0xffffffff` duplicated in `validate.ts` and `rng.ts`~~ **RESOLVED (story 2.0):** one exported `MAX_SEED` in rng.ts, consumed by validate.ts and sim/run.ts (it had actually triplicated). Error types stay layer-appropriate by design.

## Deferred from: code review of story-1.5 (2026-07-12)

- ~~Engine hot-path allocation churn (`candidatesOf`/`judgedView` projections)~~ **RESOLVED (story 2.0), with a finding:** projections deleted (UnitState now structurally satisfies MeleeCandidate/JudgedUnit) and throughput MEASURED — sweep median 812 ms before vs 792–819 ms after at runsPerPair=500: **no measurable gain**. The "matters for sim throughput" hypothesis was empirically false at 6 units (V8's generational GC absorbs short-lived projections); kept anyway as a net code deletion, goldens byte-identical.
- Judging-symmetry property proves symmetry only for asymmetric rosters (mirror-tie setups are filtered because the coin flip is not side-symmetric). A complementary invariant — "the coin flip is the SOLE source of mirror-match asymmetry" — needs a test harness that can control/inject the flip. Design note for the tech-debt story.

## Deferred from: code review of story-1.8 (2026-07-13)

- Navigation is one-way with a dead-end: Home→Draft→Placement→Reveal has no back-navigation, and the Reveal placeholder has no exit (the player is stranded until a tab reload). Explicitly deferred to story 1.9, which owns the real post-submit screens (Reveal/Battle/Result) and the Result→Rematch→Home navigation. 1.8 ships as a demoable one-way milestone. When 1.9 lands, ensure: a Home/back affordance exists from every scene, and Placement→Draft back-nav (if wanted) accounts for the forward-only element stream (re-adding re-rolls).
