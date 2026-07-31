---
baseline_commit: c62c00b9bf047027fb3a446e2bb2b9a05db7864b
---

# Story 5.8: Flow corrections and the board-code decision

Status: done

## Story

As a player,
I want the rough edges smoothed — no wasted resolves, no redundant chrome, one badge language,
so that the game feels finished, not iterated.

## Acceptance Criteria

1. **The Reveal double-resolve is gone.** Given the Reveal double-resolve (deferred at 4.13's review), when the fix lands, then Reveal reads the initial roster from `committedSetup` without resolving, Fight! performs the single resolve, and the end-to-end determinism tests stay green.
2. **The board identifies by sprite.** Given the PO's board-code wish (2026-07-17) and its recorded UX-spine conflict, when the amendment lands, then EXPERIENCE.md/epic-4-dossier §7's "board keeps codes" is superseded with a dated note, Reveal/Battle boards identify units by sprite alone, the crown/guard markers re-anchor cleanly, and `unitCodeStyle` survives for whatever text remains on tiles — verified on Danilo's device.
3. **One badge language, pinned.** Given the element-badge inconsistency (deferred since 2.1), when this story closes, then every scene uses the dot-only compact badge (one treatment everywhere), plus any flow items from Danilo's device list at story creation; no engine change, no version bump.

**AC restatements — deliberate, flagged so an AC-fidelity audit doesn't read them as errors.** AC2 drops
"**Sally's** amendment": `epics.md:1138` assigns the spine amendment to the UX designer, and Task 5 gives it
to the dev agent instead — the 5.6/5.7 precedent, where the implementing agent wrote the dated amendments.
AC3 drops "(FR3 — one treatment everywhere)" because FR3 contains no such clause; the rule is the UX
spine's (see Task 3). Both changes are wording only; the required work is unchanged.

**AC2 direction CONFIRMED by Danilo at story creation (2026-07-29):** sprite alone — codes leave the
board tiles and the spine is superseded. Not a dev-start question; build it.

**AC3 is a VERIFY-AND-PIN block, not a code migration (recon finding, independently re-verified).** The
deferral text at `deferred-work.md:96` describes the 2026-07-13 tree: element WORDS on Draft/Placement/
Battle cards. Those words are already gone — they went out with the card-width shrinks in stories 2.3 and
4.2, and **all seven** element surfaces call the one dot-only helper (`addElementBadge`, `config/ui.ts:132-140`).
Verified twice by grep: no element word is drawn anywhere, and **`setTint` appears nowhere in
`apps/web/src`** (the "element as tint" idea was never built). The only `'Fire'`/`'Wind'` literals are
`BLAST_ELEMENT_WORD` (`constants.ts:959-964`), which names MOVES ("Ice Blast") on the Battle move plate —
a different channel, out of scope. So AC3's real content: **prove it and keep it proven** (there is
currently ZERO test coverage of the badge treatment), close the stale deferral entries, fix the FR3
mis-citation, and add the dot to the one surface that lacks it.

**AC3's "plus any flow items from Danilo's device list":** asked and answered (2026-07-29) — **exactly ONE
item scoped in: Reveal's tactic-picker rows must meet FR30's 44px tap floor** (Task 4). It earned its place
because its own deferral text says "revisit… when Reveal is next laid out" and this story lays out Reveal
twice over. Everything else on the swept list is fenced out by name below.

## ⚠️ Hazards that will bite you — read before touching anything

1. **The monster loom breaks naive re-anchoring.** `unitDisplaySize` (`constants.ts:35-36`) scales monster
   sprites by `MONSTER_LOOM_SCALE = 1.5` (`:25`), and Epic 5 grew the roster from 1 monster to **10**
   (FR1 allows 2 per army — so this is the common case now, not an edge case). On Reveal a small sprite is
   38px at y−13 (spans y−32…y**+6**) but a monster is `round(38×1.5) = 57`px (spans y−41.5…y**+15.5**).
   Any Reveal text moved to y+8 lands INSIDE a loomed silhouette. Same story in Battle: 42px → 63px,
   spanning y−49.5…y+13.5. **Every vertical move in this story must state both spans.** This is the
   army-row/monster-comp coupling class the repo has a standing rule about, and a device pass misses it
   unless Danilo happens to draft a monster.
2. **The Guard marker never joins the status row.** `applyGuardMarker` (`BattleScene.ts:795-806`) creates 🛡
   at local `(0, −34)` then calls `layoutStatusIcons(v)` (`:805`) — but that loop (`:771-774`) iterates only
   `v.statuses.values()`, and Guard lives in the separate `v.guardMarker` field (`:71-72`). So the shield is
   **never assigned a slot X** and sits permanently at x=0 while spells pack from x−20 in 14px steps
   (−20, −6, +8). The comment claiming it "shares the same left-of-sprite row as spell icons" is false.
   The everyday defect is that **🛡 reads as off-row on its own**; an actual overlap needs three concurrent
   statuses (x=0 collides with slot 2 at +8).
3. **`RevealScene` has bare `pointerup` handlers** at `:172` (the picker bar) and `:220` (every option row)
   — the exact bug class story 5.7 fixed as a HIGH in `addButton` (`ui.ts:239-251`: a release whose
   pointerdown landed elsewhere used to fire the tap). Tasks 1, 2 and 4 all touch this scene.

## Tasks / Subtasks

- [x] Task 1: Reveal stops resolving — the AD-13 fix (AC: 1)
  - [x] **Direction (decided; the story does NOT carry this as an open choice): pass the setup's own data
        to `drawUnit` — build no snapshot at all.** `drawUnit` (`RevealScene.ts:240-260`) reads exactly
        `side`, `placement`, `class`, `name`, `element`, and `id` — and `id` is used ONLY to match the crown
        (`:246`). So iterate the setup directly and hand `drawUnit` what it actually needs:
        ```
        for (const side of ['A','B'] as const)
          setup.armies[side].forEach((u, i) =>
            this.drawUnit(side, u, setup.placements[side][i]!, i === setup.leaders[side]));
        ```
        This is the shape the code on either side of it already uses: `PlacementScene.ts:303` iterates
        `state.playerArmy.forEach((unit, i) => …)` and compares the leader as `state.playerLeader === i`;
        `flow/historyModel.ts:53` renders comps off `entry.setup.armies` raw.
    - **REJECTED — a shell-side `rosterFromSetup(): UnitSnapshot[]`.** To satisfy the `UnitSnapshot` type it
      must compute `hp`/`maxHp` from `BALANCE.classes[cls].hp` — fields Reveal never renders (there is no
      HP bar on that board). That would be the story's only new shell-side BALANCE stat read, and it is the
      least defensible line against AD-2's "the renderer may read the setup, never re-derive a rule". It
      also needs a whole equivalence test whose only job is to police duplication this direction never
      creates. Rejected 2026-07-29 after the validation pass surfaced it.
    - **FENCED — exporting the engine's `buildUnits`.** DRY-est of all, bumps no version, changes no
      behavior — but it is a diff under `packages/engine/**`, which AC3 forbids. Not taken.
  - [x] Change `drawUnit`'s signature from `(unit: UnitSnapshot, setup?: MatchSetup)` to explicit
        parameters. Keep the leader test as a passed-in boolean — computing `` `${side}:${index}` `` just to
        string-compare it against `setup.leaders[side]` is the snapshot's convention, not Reveal's need.
  - [x] Keep the `phase !== 'committed'` guard at `:79`, but fix its stated REASON (`:76-78`, "resolve()
        throws if reached uncommitted") — that stops being true. The guard is still required: a derived
        render must not run with `committedSetup === undefined`. Do NOT reorder the `pickerOpen`/`tacticEls`
        reset at `:71-72` above the early return — that placement is a 4.13 review patch (singleton hygiene).
  - [x] **Pin the engine contract Reveal now depends on** (one test, no production duplication):
        `resolveBattle(setup).events[0].units` is in A-then-B army-index order, its ids are
        `` `${side}:${index}` ``, and `units[n].placement` deep-equals `setup.placements[side][index]` —
        over a **monster comp** and an **asymmetric comp** (a symmetric fixture passes a mirrored id
        convention — the chirality lesson). Build fixtures through the real `commit()` path, not by hand:
        a hand-built setup makes the placement equality vacuous, since `toAnchor` is currently an identity
        passthrough (`flow/placement.ts:32-34`).
  - [x] Regression net — `apps/web/test/match-flow.test.ts` must stay green. The full titles, so
        `vitest -t` actually matches: `'is idempotent — a second resolve returns the SAME log object, never
        re-resolving (AD-13)'` (:534), `'setTactic AFTER commit folds into committedSetup.tactics.A and
        invalidates the cached log (story 4.13 — picker moved to Reveal)'` (:190), and
        `'END-TO-END determinism: a post-commit tactic fold yields a BYTE-IDENTICAL battle to committing
        with that tactic from the start (the headline claim — story 4.13)'` (:231). **One deliberate edit
        to that file:** `:238`'s comment `// resolve at autonomous first (this is what RevealScene does)`
        becomes false. Keep the call (it is pinning the cache-drop), re-word the comment.
  - [x] Apply 5.7's HIGH lesson to this scene while you are in it: give `RevealScene.ts:172` and `:220` the
        down→up-on-the-same-object discipline (`ui.ts:239-251` is the pattern). Reachable here because
        `addHomeBack` installs a global `pointerdown` (`ui.ts:425`) and down-events lose their up across
        scene boundaries.
  - [x] Stale comments to update (a stale comment is a defect — the 5.6/5.7 lesson): `RevealScene.ts:41-42`
        ("reads the initial roster off the (once-)resolved `BattleLog`"), `:103-108` (the deferral note),
        `:230-239` (the NAME-surface contract — also changes under AC2), `BattleScene.ts:256` ("same cached
        log the Reveal scene resolved"), and `MatchFlow.ts:369-375`, whose docstring hangs `recordResult()`'s
        correctness on "Battle always resolves after Reveal" (`:374-375`). The invariant still holds —
        Battle is simply the sole FIRST resolver now — but the reasoning must be rewritten.
  - [x] Lint/knip fallout (both CI-blocking): `BattleStarted` becomes unused in `RevealScene.ts:3`;
        `UnitSnapshot` too if `drawUnit` no longer takes it.
- [x] Task 2: The board-code retirement (AC: 2)
  - [x] Remove the code text at the two board sites — the ONLY two: `BattleScene.ts:320` and
        `RevealScene.ts:251`. Board = the iso scenes only (`drawIsoBoard` has exactly two callers). **Cards
        keep their codes** — Draft tray (`DraftScene.ts:494`), Placement (`PlacementScene.ts:315` — a flat
        square grid, not an iso board), History (`:283`), Result chip (`:197`), the 5.7 stats sheet
        (`statsSheetOverlay.ts:38`), log narration (`narration.ts:39`). Per story 4.0's ruling the FR39f
        treatment governs solid TILES only.
  - [x] Reveal's soldier name: **monster-aware, because of Hazard 1.** *(Recorded deviation, 2026-08-01:
        this bullet's letter said "leave it at y+21 for monsters"; the shipped `revealNameOffsetY` DERIVES
        y+18 for the loomed span — 3px higher than the letter, still a smaller tile overhang than before
        (5.5px vs 8.5), and the overhung tile is guaranteed EMPTY by the monster's king-move reservation.
        Danilo accepted the monster read on device round 4. The clearance pin is CENTRE-based by design:
        glyph boxes may graze the sprite's transparent margins, which the device pass judged, not the test.)* A small sprite frees y+8 cleanly
        (sprite ends y+6); a loomed monster reaches y+15.5, so a name at y+8 would sit inside it. Move the
        name to y+8 for smalls and leave it at y+21 for monsters, deriving the test from `unitDisplaySize`
        — never a hardcoded 1.5. This also fixes a real pre-existing defect for smalls: at y+21 the name
        (10px → y+16…y+26) hangs off the tile's bottom vertex (y+17.5) onto the clash gap.
  - [x] **Add the geometry pin AC2 otherwise lacks** (cheap, and it is what would have caught Hazard 1
        automatically): the Reveal name's bottom stays inside the tile's bottom vertex, asserted for BOTH
        the small and the loomed sprite spans. Home: `apps/web/test/battle-view.test.ts`, beside the
        existing board-frame pins. Re-check `'Reveal: the player board stays above the tactics block
        (ARMY TACTICS y=342)'` (:190) and `'never lets the two boards overlap — there is always a clash
        gap'` (:178).
  - [x] Battle: **remove the code and change NOTHING else about the tile's positions.** The freed band is
        y≈−3…+11, which sits *entirely inside* a loomed monster's silhouette (y−49.5…y+13.5) — so "move the
        crown/dot pair off the artwork" is geometrically impossible for 10 of the roster's classes and is
        NOT attempted here. Leave crown at `(−16, −28)` and the element dot at `(+16, −28)`. Log the
        monster-aware chrome re-lay to `deferred-work.md` as its own item.
  - [x] Fix Hazard 2 — Guard joins the slot walk, **with the ordering specified so two implementations
        cannot differ: Guard always takes slot 0, spells pack after it.** That makes Guard's own position
        stable across status churn (the alternative, Guard-last, moves the shield whenever a status clears —
        the very bug `:770`'s comment records fixing). **State for the device pass: a Guard-alone unit's
        shield therefore moves from x=0 to x=−20. That is intended.**
  - [x] `unitCodeStyle` SURVIVES through exactly one remaining consumer — **`RevealScene.ts:255`**, the
        soldier name, which spreads it for color + stroke + strokeThickness and overrides family/size. That
        call is what keeps the three standalone exports `unitCodeStyle`, `CODE_STROKE_COLOR` and
        `CODE_STROKE_THICKNESS` alive against `pnpm knip`. (`PALETTE.codeTextPlayer/Enemy` are *properties*
        of one exported object — knip tracks exports, not properties, so they were never at risk.) After
        the change **BattleScene has zero text on a unit tile** (only glyphs: ♛, 🛡, status icons), so its
        `unitCodeStyle` and `CLASS_ABBREVIATIONS` imports (`:30`, `:23`) go, as does `RevealScene.ts:16`'s
        `CLASS_ABBREVIATIONS` import (`:251` was its sole use there).
  - [x] Re-point, don't delete, `constants.test.ts:103-125`. Both tests stay green (they test the function,
        not its call sites), but their rationale prose is about board CODES; the name still stands on a
        tile, so re-word them at the name. Their comment records that the tests exist because a 2026-07-28
        dead-export sweep found the tokens unconsumed — keep that history.
  - [x] Stale comments beyond the code lines: `BattleScene.ts:60` (`UnitView` doc — "sprite, **code**,
        badge, HP bar, status icons"), `:312` (`buildUnit` doc — "sprite + **class code** + element dot +
        HP bar"), `:851` ("takes bar, **code**, badge, and icons with it"), and `:805` (the Guard comment
        that Hazard 2 makes true).
- [x] Task 3: One badge language — verify, pin, close the record (AC: 3)
  - [x] VERIFY (expected to pass): all seven surfaces already route through `addElementBadge` — Draft
        `DraftScene.ts:494`, Placement `PlacementScene.ts:321`, Reveal `RevealScene.ts:259`, Battle
        `BattleScene.ts:321`, Result `ResultScene.ts:205`, History `HistoryScene.ts:288`, the 5.6 card
        `unitCardOverlay.ts:74`.
  - [x] **Add the missing dot: story 5.7's per-unit stats sheet** (`statsSheetOverlay.ts:25-45`) identifies
        a unit by sprite + soldier name + `Class · CODE` and shows no element — the one genuine gap.
        Decision confirmed by Danilo at dev start (2026-07-29): add it. Do NOT touch
        `unitCardOverlay.ts:73`'s deliberate omission on Draft grid-tile PREVIEW cards — elements roll at
        draft, so a preview has none (spec'd at `EXPERIENCE.md:222-223`, `DESIGN.md:268-269`).
  - [x] PIN the treatment, because nothing does today (`grep ELEMENT_COLORS|ELEMENT_BADGE apps/web/test` →
        zero hits; no test file mentions "badge"):
    - the geometry is the spine's — `ELEMENT_BADGE_RADIUS = 6` (12px diameter, `constants.ts:1001`) and the
      four hexes match `DESIGN.md:29-32` exactly (`constants.ts:989-994`);
    - **the higher-value guard — `ELEMENT_COLORS`/`ELEMENT_BADGE_RADIUS` have exactly ONE consumer,
      `addElementBadge`.** `expect()` cannot assert "nothing else imports this", so use the repo's
      raw-source pattern: `import.meta.glob('…', { query: '?raw', import: 'default', eager: true })` over
      `apps/web/src/**`, exactly as `apps/web/test/game-name.test.ts:18-19` and
      `packages/engine/test/purity.test.ts:39` do. Without that mechanism this degrades into a value test
      on four hexes, which is not the point — a scene reading the colors directly is how the inconsistency
      happened the first time.
  - [x] Close the stale deferral `deferred-work.md:96` with a dated RESOLVED note (the words went out in
        2.3/4.2; the treatment is now test-pinned), in the file's existing strikethrough-with-explanation
        style — the already-resolved badge-SHAPE sibling at `:103` is the template.
  - [x] **Close the other three STALE-OPEN entries while in that file** (each shipped elsewhere and was
        never annotated; a deferred-work file that lies about what is open is worse than none):
        `:47` landscape backgrounds → **shipped by 5.3**; `:63` the Result battle-stats summary →
        **shipped by 5.7**; `:165` the FR17 Wipeout-default PRD touch → **shipped by 5.0**. Also mark
        epic-4 retro action item 2 resolved in `sprint-status.yaml` — all three of its parts closed in 5.0
        while the item still reads `open`. **NOTE the two `?perf=1` captures are different things:** the
        one action item 2 covered ran 2026-07-24 in story 5.0; the one the fences below assign to 5.10 is
        the separate post-5.3 capture. They are not in conflict.
  - [x] Fix the mis-citation **as a dated note, not a rewrite** (Task 5's rule applies to shipped ACs too):
        FR3 (`prd.md:47`) specifies the seeded roll, the disclosure timing, the Witch coupling and "no
        combat effect in the MVP" — it says only that the element "is displayed" and mandates **no
        treatment**. "One treatment everywhere" is the UX spine's rule (`DESIGN.md:257`, `:211`, `:337`,
        `EXPERIENCE.md:82`). Annotate `epics.md:454` (epic 2, shipped) and `:1143` (this story) rather than
        editing their AC text.
- [x] Task 4: Reveal's tactic picker meets the FR30 tap floor (AC: 3 — the scoped-in flow item)
  - [x] The defect: option rows are `bh = 24`px (`RevealScene.ts:163`, used at `:204`/`:209`) — under
        FR30's 44px floor, so every tactic choice is a mis-tap risk. Shipped at 4.13, re-surfaced by 5.2's
        review, logged at `deferred-work.md:205`.
  - [x] **The arithmetic, because a naive bump does not fit.** Today: bar `bh 24` at `barY 356`;
        `enemyY = 386` (spans to 410); `optionsTop = enemyY + bh + 8 = 418`; 4 rows × 24 = 96 → rows end
        514, framed panel (pad 6) ends 520. Fight is `addButton` at `BASE_HEIGHT − 44 = 596` with
        `BUTTON_HEIGHT 56`, spanning **568–624**, top **568**. Available band = 568 − 418 = **150px**.
        Four 44px rows + 2×6 pad = **188px — IT DOES NOT FIT (38px deficit)**. (The code comment at `:150`
        guesses "≈ y502"/"≈ y552"; 568 is the real number — fix that comment too.)
  - [x] **RECOMMENDED: a 2×2 grid of 44px rows** — 2 rows × 44 = 88 + 12 pad = 100px ≤ 150px. It preserves
        the constraint the 2026-07-20 review placed on this block: options drop into the band BELOW both
        fixed lines so "the enemy stance never jumps away mid-choice" (`:143-146`). That is also why the
        5.7 modal shell is the WRONG tool despite being available — a modal would cover the enemy line the
        player is reacting to. WIDTH: at the bar's `bw 210` a column is ~102px and "Attack Strongest"
        (16 chars at 12px Arial ≈ 99px) leaves no margin, so widen the OPEN panel beyond the bar (~300px
        centred → ~144px columns) rather than shrinking type below the 12px it already uses. Derive the
        label budget from the longest `TACTIC_DISPLAY_NAME` (`constants.ts:583-588`), never a fiat string.
  - [x] **Add the clamp test the code's own comment asks for.** `RevealScene.ts:148-155` warns this is an
        "army-row coupling site": rows are laid out from `ALL_TACTICS.length` with **no clamp** against
        `BASE_HEIGHT` or the Fight button, and past ~6 tactics the list would ride over Fight. Nothing pins
        it. Pin it — the option block's bottom must stay above Fight's top, derived from
        `ALL_TACTICS.length`, `BUTTON_HEIGHT` and the button's Y — so a future tactic (the deferred
        tactic-roster extension is a live want) fails a test instead of a device session. This is the
        lasting value of the task.
  - [x] Device round on the new picker: the 2×2 read, whether the selected tactic is still obvious (the
        gold plate), and that the enemy line stayed put.
- [x] Task 5: The UX-spine supersession — dated, and the reason recorded (AC: 2, 3)
  - [x] Supersede with a dated note (never rewrite in place — the 4.0/5.2/5.6/5.7 precedent) every place
        that mandates a code on a board tile:
    - `…/ux-lordly-2026-07-13/EXPERIENCE.md:204` — "…the board keeps codes." **The primary target**, inside
      the "Epic 4 extension (added 2026-07-17)" block at `:193`.
    - `docs/planning-artifacts/epic-4-dossier/DOSSIER.md:163` — **epic-4's §7** (epic-5's dossier has no §7,
      so the AC's "dossier §7" is unambiguous): "…the board keeps 3-letter codes (13px space)…" — the
      13px-space rationale is exactly what crisper sprites retired. Sibling decision row: `:33` (D-3c).
    - `EXPERIENCE.md:203` — the Golem clause: "ONE HP bar + ONE code on that cell". The
      one-unit-never-two rule survives; the code half does not.
    - `EXPERIENCE.md:80` — "| Unit card / tile | … Always shows class code + element badge. |" The row's
      name includes "tile" while the iso board has its own row at `:84`; annotate it or the conflict
      re-opens later.
    - `DESIGN.md:107-121` — the FR39f token block, and `:107`'s `code: '{typography.label}'` token
      immediately above it. **Re-scope, do not delete**: the tokens still govern the Reveal NAME standing
      on a solid tile. Also `DESIGN.md:255` (names Reveal and Battle as code surfaces) and `:182` (whose
      "only codes on solid side-coloured BOARD tiles need the outline" becomes vacuous for codes, true for
      the name).
  - [x] Record WHY, not just what: Danilo, 2026-07-17, story-4.2 device session — "now that the image is
        clear and better, we can identify the class by the sprite. So we can remove them." The 4.0
        backing-store fix made sprites crisp enough that board codes read as redundant chrome. Confirmed as
        direction at 5.8's story creation (2026-07-29).
  - [x] `DESIGN.md:128-133`'s element-badge scene list still reads Draft/Placement/Reveal/Battle/History —
        it predates Result (badge since 2.3/4.2) and the 5.6/5.7 modal sheets. Amend it in the same pass as
        Task 3's new dot. While there, the resolved `[ASSUMPTION]` at `DESIGN.md:211` about reconciling the
        `constants.ts` hexes can go — that reconcile shipped in 2.1 and the hexes match exactly.
  - [x] `EXPERIENCE.md` gains the player-facing read for the board change and the new picker. Full paths
        only — never root-level files.
- [x] Task 6: Gate + device pass (AC: 1, 2, 3)
  - [x] Assert ZERO diff under `packages/engine/**`; `balanceVersion` 11 and `logVersion` 4 untouched;
        goldens byte-identical; balance hash unchanged.
  - [x] Full gate: `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm coverage` (engine ≥90% lines),
        `pnpm --filter web build`. **State the test-count arithmetic** (the tree stood at 729 after 5.7) —
        that is how the last two stories caught silently-dropped tests.
  - [x] Device pass with Danilo — the story stays in-progress until he accepts: both boards with codes
        gone (does a sprite alone read at a glance, especially classes sharing a silhouette?), **a MONSTER
        comp on Reveal** (Hazard 1 — the name's position differs there by design), the Reveal name's new
        slot, the 2×2 picker, and a Guard+poison unit to confirm the shield now sits on the status row.


### Review Findings (senior code review 2026-08-01 — 3 adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] [Review][Patch] HIGH: the OPEN tactic panel's gold band occludes the enemy tactic line — panel top 416 vs label glyphs 411–425 (9px buried at depth 99 over 0), a regression from pad 6→22 while the comments and tests still claim "the options drop BELOW both fixed lines"; anchor the panel below the enemy line's bottom (430), give the picker its own panelPad 18 (ornament 15.3 + margin; SHEET_PAD 22 overruns Fight by 2px), and PIN panel.y ≥ enemy bottom [flow/battleView.ts:150 + constants + battle-view.test.ts]
- [x] [Review][Patch] MEDIUM: `renderTactics()` synchronously destroys the DISPATCHING object inside its own pointerup (bar :208, rows :272 — `tacticEls` includes them) — the documented Phaser destroy hazard this repo already fixed for the Draft tabs with a one-tick defer (DraftScene.ts:193); apply the same [scenes/RevealScene.ts]
- [x] [Review][Patch] MEDIUM: the "every framed sheet" ornament pin covers 2 of 3 sheets and not the picker — UNIT_CARD and TACTIC_PICKER absent; and the Battle log's content inset is 14px vs the 15.33px band with a comment still saying "10px border" (EXPERIENCE.md's "every framed surface… content clears it" is false for the log by this diff's own arithmetic); extend the pin, bump the log inset, fix the comment [battle-stats.test.ts:466-480 + BattleScene.ts:1096-1101]
- [x] [Review][Patch] MEDIUM: the reveal-roster crown test is a TAUTOLOGY (find-by-in-range-id, already implied by the order test) and nothing anywhere verifies the ENGINE agrees who the leader is — `LeaderFell` carries side+unit, so cross-check `event.unit === side:leaders[side]` over seeds with a fixture guard [test/reveal-roster.test.ts:109-122]
- [x] [Review][Patch] MEDIUM: the RESULT_HINT band pin re-hardcodes the scene's literals (44, 64/2, 0.56, 0.79 live in BOTH files independently) while claiming to derive them — the 4.2 HistoryScene coupling failure mode rebuilt; tokenize Result's chip/heading anchors and share [test/battle-stats.test.ts:384-390 + scenes/ResultScene.ts]
- [x] [Review][Patch] MEDIUM: Task 3 checked [x] but epic-4 retro action item 2 still reads `open` in sprint-status.yaml — the claimed edit is absent [sprint-status.yaml:172-175]
- [x] [Review][Patch] MEDIUM: two Task-5-NAMED supersession sites never annotated — epic-4 DOSSIER.md:33 (D-3c "one HP bar + code at anchor") and DESIGN.md:182/:171 (the 5.2 amendment + guard/monster note still mandate board-tile codes) [docs]
- [x] [Review][Patch] MEDIUM: File List omits SEVEN changed files (check-frame-art.mjs, summarySheetOverlay, ui.ts, DraftScene, PlacementScene, ResultScene, battle-stats.test.ts) — rounds 3–6 narrated in the Change Log but never folded in [story record]
- [x] [Review][Patch] LOW: stale "sums to 246" comments in the tree that re-budgeted it to 262 — statsSheetOverlay.ts:48 and battle-stats.test.ts:484, plus the Completion Note's "exact 246px budget untouched" [comments]
- [x] [Review][Patch] LOW: test title still advertises "the footer hint inside the width" after this diff deleted the hint and its assertion [battle-stats.test.ts:421]
- [x] [Review][Patch] LOW: the ✕-clears-ornament pin is vacuous (reduces to pad+8>16, implied by the line above) and pins the glyph CENTRE — pin the 18px glyph's EDGE instead [battle-stats.test.ts:479]
- [x] [Review][Patch] LOW: the monster name ships at y+18, not the Task-2-mandated "leave at y+21" — device-accepted and BETTER (5.5px overhang vs 8.5), but recorded nowhere as a deviation; record it + the king-move dependency (the overhung tile is guaranteed empty) + that the clearance pin is CENTRE-based by design (glyph boxes may graze transparent sprite margins — device-accepted) [story + battleView.ts comment]
- [x] [Review][Patch] LOW: the Record's "sweep proving no element word anywhere" overstates the pin — the regex polices IDENTIFIER NAMES (ELEMENT_*WORD/LABEL/TEXT), not rendering; a scene drawing `unit.element` as raw text passes; re-word claim + test comment [ui-chrome.test.ts + record]
- [x] [Review][Patch] LOW: deferred-work's picker-ceiling entry says 5 tactics overrun Fight "by 8px" — actual 24px (and it changes again with the panel re-anchor); recompute [deferred-work.md]
- [x] [Review][Patch] LOW: ledger dates contradict (deferred heading 2026-07-29 over content dated 2026-08-01; EXPERIENCE amendment block dated 07-29 carrying round-3–6 content) and DESIGN.md's amended element-badge `note:` is four adjacent quoted scalars — not valid YAML [docs]
- [x] [Review][Patch] LOW: check-frame-art.mjs "must mirror" the slice constants by hand-copied literal with no equality check — the exact drift class this story pinned for element colours; raw-glob pin the script's values against the constants [scripts + ui-chrome.test.ts]
- [x] [Review][Patch] LOW: the guard slot-0 docblock claims churn-free but guard RAISE/DROP shifts every status icon by 14px (the undiscussed direction); document the trade [BattleScene.ts:757-760]
- [x] [Review][Patch] LOW: the fenced Battle-log deferred entry (:199) not annotated that the app-wide slice change altered the log's border geometry too [deferred-work.md]
- [x] [Review][Defer] Guard at slot 0 makes the 4th status-row icon (guard + 3 spells) graze the element badge one status earlier than before (slot 3 at x+22 vs badge x10–22; 3 statuses already grazed pre-change) — the same tile-chrome-budget family as the logged monster-aware re-lay; folded there [BattleScene.ts:804 + deferred-work.md] — deferred, pre-existing
- **Dismissed as noise (3):** the monster-name overhang/burial scenario (device-accepted explicitly, improved vs baseline, and the burial comp is impossible — the king-move reservation keeps all 8 neighbour cells empty); the glyph-box-vs-centre clearance semantics (device-accepted visuals; sprite display boxes carry transparent margins, and "fixing" it would move accepted renders); the one-consumer pin narrowing (openly recorded in the Dev Record with its rationale).

**Independently re-verified by the Acceptance Auditor:** engine ZERO hunks (`git diff c62c00b --stat packages/engine` empty); `BALANCE.version` 11 / `LOG_VERSION` 4 untouched; gate re-run — 750/750, typecheck/lint/knip green; test-count arithmetic exact (729+16+5); AC1/AC2 mechanics confirmed in the tree (no resolve() in Reveal, codes gone at exactly the two board sites, every card code untouched, guard slot-0, crown/dot unmoved with the re-lay logged).

## Dev Notes

### AC1 is an architecture violation, not a polish item

AD-13 (`ARCHITECTURE-SPINE.md:127-131`) exists to prevent exactly this. Its **Prevents** line opens with
"double resolution", and its rule states MatchFlow "is the **sole** caller of `resolveBattle`" and "a
battle is resolved exactly once per live match". Quote AD-13 in the fix's comment — it is why this is not
optional cleanup.

Reading the setup directly is AD-2-sanctioned, so no new precedent is set: "**static per-unit facts**
(class, element, name, monster footprint) come from `MatchSetup` … the renderer may read the setup, never
re-derive a rule" (`:41`).

### Honest framing — do not overclaim the win

On the NO-tactic-change path there is only ever ONE `resolveBattle` today, because `resolve()` is memoized
(`MatchFlow.ts:377-384`). The fix MOVES that resolve from Reveal's board draw to the Fight! tap. The
genuine saving is the tactic-changer path: `setTactic` nulls the cache (`:242`), so Battle pays for a
**second full resolve** while Reveal's log is discarded unused. Story 4.13 made that the guaranteed path
for every tactic-changer. Story 5.10's scene-ENTRY capture will therefore see the cost **shift**, not
vanish — say so, or the capture reads as a regression.

### What Reveal actually needs (so the direction is provably sufficient)

`drawUnit` (`RevealScene.ts:240-260`) reads exactly: `side`, `placement` (→ `unitTileCenter`), `class`
(sprite), `id` (leader-crown match only), `name`, `element`. **`hp`/`maxHp` are never read** — there is no
HP bar on that board. Everything else Reveal renders already comes from state: terrain from
`flow.getState().seed` (`:64`), the tactics block from `committedSetup.tactics` (`:159`), boards from
`drawIsoBoard` (`:100-101`).

### Other hazards

- **Replay is not on this path.** `startReplay()` hydrates `phase: 'committed'` + `committedSetup`
  (`MatchFlow.ts:105-124`) and routes straight to Battle (`HistoryScene.ts:231`) — Reveal is skipped. The
  render must still be correct for a hydrated setup.
- **`recordResult()` keeps its guard** (`MatchFlow.ts:399-407`, throws when `!this.log`). Reachable only
  via Result, which resolves first — no new throw path.
- **Determinism/AD-10 untouched** as long as nothing re-rolls: elements and names are stored data.
- **Old citations have drifted.** `deferred-work.md:23-25` and `4-13-…md:62` both cite `RevealScene.ts:81`;
  the resolve is at **:109**. Trust the symbol, not the line.

### Layout budget — with both sprite spans, per Hazard 1

Battle tile `ISO_BOARD` 74×37 (`constants.ts:800-802`), diamond local y−18.5…+18.5. Sprite 42px at y−18 →
**small spans y−39…y+3; monster (63px) spans y−49.5…y+13.5.** Stack: status glyphs and 🛡 y−34 · crown
y−28 (x−16) · element dot y−28 (x+16) · **code y+4** · HP bar 44×8 at y+14. Span y−34…+18 = 52px on an 18.5px
lane pitch (`ISO_BOARD.tileH / 2`; the source comment said 28 until the 5.3 review corrected it —
that was the pre-5.3 tile height, never a pitch) — tiles necessarily overlap, and the code's ~14px is the single
biggest available reduction. No numeric HP text on the tile.

Reveal tile `ISO_BOARD_REVEAL` 70×35 (`constants.ts:818-820`), diamond y−17.5…+17.5. Sprite 38px at y−13 →
**small spans y−32…y+6; monster (57px) spans y−41.5…y+15.5.** Stack: crown y−30 (16px here, 14px in
Battle) · element dot (x+16, y−26) · **code y+8** · name y+21. No HP bar, no status icons, no popups, no
move plate.

### Element badge — already single-sourced

`addElementBadge` (`config/ui.ts:132-140`) is a bare `scene.add.circle(x, y, ELEMENT_BADGE_RADIUS,
ELEMENT_COLORS[element])` — no word, no stroke, and its own comment states the rule ("Always a dot, never
a border or fill: side identity owns borders and HP fills"). `ELEMENT_COLORS` (`constants.ts:989-994`) and
`ELEMENT_BADGE_RADIUS` (`:1001`) each have exactly one consumer today. Keeping that true is the pin.

### Pre-existing a11y gap — NOT this story's scope, but log it

Element is a **colour-only channel** on every surface: four 12px dots, no shape/glyph/letter
differentiator, no in-game legend (`docs/rules.md:133-135` explains elements in words but never maps a
colour to one). `EXPERIENCE.md:119`'s accessibility floor requires a non-colour anchor for **side and
outcome** cues and pointedly does not cover elements — it even leans on the element dots as a side-tracking
helper. The PRD has no accessibility FR/NFR at all. Mitigating: FR3 gives element no combat effect for
every class but the Witch, and her actual spell is named in WORDS on her 5.6 card (`flow/unitCard.ts:111`,
pinned at `unit-card.test.ts:93`). Closing it properly (a Help-screen legend, or a letter in the dot) needs
a DESIGN.md amendment, since the spine forbids anything but a bare dot. **Log for Danilo; do not patch.**

### Scope fences

A full sweep of `deferred-work.md` (42 headings) plus every story's Change Log ran at story creation, so
this fences by NAME rather than by silence. Danilo's decisions (2026-07-29): the Reveal 44px picker is IN
(Task 4); everything else is OUT. NOT in this story: engine changes of any kind, version bumps, and new
mechanics or systems (Epic 5's standing fence); the element a11y gap; card-surface codes; **the Battle Log
panel**, whose two logged problems want one re-lay together (visual-vs-logical line overflow past the
9-slice border, `deferred-work.md:199`; and 5.3's recorded trade-off that the open panel now covers most of
the enlarged player board, `5-3-battle-backgrounds.md:115`); Home's hard-edged scrim (`:201`); the
inline-Draft-panel wish (`:258-274`, routes itself to its own design pass); the multi-touch audit
(`:276-291`, device-triggered — but if any gesture changes here, the epic-4 retro's gesture-audit agreement
applies); the board-orientation toggle (`:107`); the Phaser-harness tooling story and its riders
(`addButton`'s Phaser behaviour — which is why 5.7's HIGH is unpinned — and Draft-tab-strip coverage);
5.9's art/attribution/icon/`wordmark.jpg` items and `sprites.test.ts`'s frame constant; and 5.10's
post-5.3 `?perf=1` capture and conditional `balanceVersion` tick.

**Fenced with an owner named**, because "deferred" with no owner is how things ship stale: the four PRD
follow-ups the epic-5 dossier flags and refuses to own — FR38's monster-wave wording, FR15's table growth,
FR14's role vocabulary 7→10, and the humans-only leader rule (E5-D13) at FR35 — are **ASSIGNED TO STORY
5.10 by Danilo (2026-07-29)** and recorded in `sprint-status.yaml`'s 5.10 note. All doc-only; the pre-PvP
verdict is the last honest moment to make the PRD true before link-play reads it.

### Project Structure Notes

NEW: none in `src` (the chosen direction adds no file); one new test area for the engine-contract pin and
the badge pins. MODIFIED: `apps/web/src/scenes/RevealScene.ts`, `apps/web/src/scenes/BattleScene.ts`,
`apps/web/src/config/statsSheetOverlay.ts` (Task 3's dot), `apps/web/src/config/constants.ts` (the
`unitCodeStyle` scope comment), `apps/web/src/flow/MatchFlow.ts` (the memoization docstring at `:369-375`),
`apps/web/test/match-flow.test.ts` (the `:238` comment re-word), `apps/web/test/constants.test.ts`
(re-pointed prose + badge pins), `apps/web/test/battle-view.test.ts` (the Reveal name and picker-clamp
pins), `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` (dated
amendments), `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` (§7 dated supersession),
`docs/planning-artifacts/epics.md` (the FR3 mis-citation, as dated notes),
`docs/implementation-artifacts/deferred-work.md` (**four** entries closed + two new items logged), this
story, `sprint-status.yaml`. NOT modified: `packages/engine/**`, `rules.md`, MatchFlow's replay guard, any
card-surface code rendering.

### References

- [Source: docs/planning-artifacts/epics.md:1125-1143 — Story 5.8's three AC blocks; :951-955 — Epic 5's "no new systems" fence]
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md:127-131 — AD-13, whose "Prevents" names double resolution; :41 — AD-2's static-facts channel]
- [Source: docs/implementation-artifacts/deferred-work.md:23-25, :60-62, :96, :103, :199, :201, :205 — the deferrals this story closes, fences, or scopes in]
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md:80, :203-204 — the code-on-tile mandates; :82 — the element-badge row; :119 — the accessibility floor; :222-223 — the preview-card exception]
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md:107-121, :128-133, :182, :211, :255, :257, :337 — the FR39f tokens and the treatment rules]
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md:163 — §7's "board keeps 3-letter codes (13px space)"; :33 — D-3c]
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md:47 — FR3's ACTUAL text, with no treatment clause]
- [Source: packages/engine/src/resolve.ts:828-862 — buildUnits, the contract the pin asserts; types.ts:251-261 — UnitSnapshot]
- [Source: apps/web/src/config/constants.ts:25, :35-36 — MONSTER_LOOM_SCALE and unitDisplaySize, Hazard 1's source]
- [Source: apps/web/src/config/ui.ts:239-251 — addButton's down→up pair, story 5.7's HIGH and Hazard 3's pattern]
- [Source: apps/web/test/game-name.test.ts:18-19 — the raw-source glob pattern Task 3's one-consumer pin needs]
- [Source: docs/implementation-artifacts/5-7-the-battle-stats-summary.md#Dev-Agent-Record — the geometry-pin and stale-comment discipline]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — via the BMad `dev-story` workflow.

### Debug Log References

No probe scripts. Two claims from the story were re-verified against the tree before building on them:
`MONSTER_LOOM_SCALE = 1.5` at `constants.ts:25` with `unitDisplaySize` at `:35-36` (Hazard 1's arithmetic),
and the `import.meta.glob('?raw')` precedent at `game-name.test.ts:18-19` (Task 3's one-consumer pin).

### Completion Notes List

**AC1 — Reveal stops resolving.** `RevealScene.create()` now walks `committedSetup` directly
(`armies`/`placements`/`leaders`) and `drawUnit` takes `(side, unit, placement, isLeader)`. No snapshot is
built anywhere, so no engine logic is duplicated in the shell — the rejected `rosterFromSetup()` shape would
have had to compute `hp`/`maxHp` from `BALANCE` for two fields this board never draws. `BattleScene` is now
the first and usually only resolver, on the Fight! tap. AD-13's "double resolution" is gone.

What guards it: `apps/web/test/reveal-roster.test.ts` (NEW, 6 tests) pins the ENGINE CONTRACT Reveal now
leans on rather than a copy of the builder — `BattleStarted.units` is A-then-B in army-index order, ids are
`` `${side}:${index}` ``, and `units[n].placement` deep-equals `setup.placements[side][index]`, over a
five-smalls comp AND a golem comp, both built through the real `commit()` path (a hand-built setup would
make the placement assertion vacuous, since `toAnchor` is an identity passthrough today). Fixtures are
deliberately asymmetric and crown index 3, not 0 — a mirrored id convention or a hardcoded first-unit
leader would pass a symmetric fixture. All 63 `match-flow.test.ts` tests stay green; the one edit there is
`:238`'s comment, which claimed the resolve it performs is "what RevealScene does".

**AC2 — the board identifies by sprite.** The two `crispText` calls went (`BattleScene`, `RevealScene`).
Battle's tile now carries no text at all, so its `CLASS_ABBREVIATIONS`/`unitCodeStyle` imports went too;
`RevealScene` keeps `unitCodeStyle` for the soldier NAME, which is now that token's ONE consumer (recorded
in the token's own comment, so a future knip failure reads as "the name lost its stroke", not "dead
tokens").

The Reveal name moved up into the freed slot — **monster-aware**, via a new pure `revealNameOffsetY(cls)`
in `battleView.ts`. This is the story's Hazard 1 and it is not hypothetical: a small sprite ends at y+6 so
y+8 clears it, but a loomed monster reaches y+15.5 and a name at y+8 would sit inside the artwork. Ten of
the roster's classes are monsters. The pin asserts the name clears its sprite for EVERY class, that smalls
take the freed slot exactly, that monsters are pushed lower, and that a small's name now fits inside the
tile's bottom vertex (the pre-existing defect it fixes — at y+21 a 10px name overhung the tile onto the
clash gap).

Battle's crown and element dot were deliberately NOT moved. The freed band (y≈−3…+11) sits entirely inside
a loomed monster's silhouette (y−49.5…y+13.5), so "move the pair off the artwork" is geometrically
impossible for those ten classes — logged to `deferred-work.md` as the size-aware layout job it is rather
than guessed at.

**The Guard-marker bug (Hazard 2) is fixed.** `layoutStatusIcons` now places `v.guardMarker` at **slot 0**
and packs spell icons after it. Before, `applyGuardMarker` called that function but the loop only walked
`statuses`, so the shield was never assigned an X and sat at x=0 — off the row on its own. Guard takes slot
0 rather than last on purpose: last would move the shield every time a status cleared and the slots
collapsed, which is the churn the function was written to avoid. `removeGuardMarker` already re-packed, so
ending a stance collapses the row correctly. **Visible, intended change for the device pass: a Guard-alone
unit's shield moves from x=0 to x=−20.**

**AC3 — one badge language, now pinned.** The verification came out as the recon predicted: all seven
surfaces already used the dot-only helper, no element word exists, no `setTint` exists. So the work was the
missing half. `ui-chrome.test.ts` gains three pins: the spine geometry (12px dot, the four DESIGN hexes,
four distinct fills), **the colour table restricted to exactly ONE consumer** via a raw-source glob — the
guard that actually prevents per-scene drift, since `expect()` cannot see imports — and a sweep proving no
element word or sprite tint anywhere. The 5.7 per-unit stats sheet gained the dot it lacked (trailing its
class line, adding no row — the sheet's exact vertical budget stayed an equality (246 then; 262 after round 3's pad re-budget)); `UnitStats` carries `element` for it, excluded
from `SideTotals` so the totals contract and its completeness test are unaffected.

That one-consumer pin immediately earned its keep: it FAILED on my own change, because
`statsSheetOverlay` reads `ELEMENT_BADGE_RADIUS` to position the dot. The guard was then scoped to what
actually matters — reading the COLOURS is what lets a surface paint its own treatment; the radius is
geometry anyone may measure against without drawing anything.

**Task 4 — the Reveal picker meets FR30.** Bar and option cells are 44px, laid out as a 2×2 grid by a new
pure `tacticPickerLayout()`. The arithmetic in the story was right that a single column cannot work (the
band gives 150px; four stacked 44px rows need 188px), and the tests then corrected the story's OTHER
number: I had claimed six tactics would fit, and the clamp test failed at 576 > 568. So the record now
states the true ceiling — **four** — and asserts that a fifth overruns Fight's top, which makes a grown
`ALL_TACTICS` fail in CI and forces a deliberate re-lay. That closes the "no clamp against the Fight
button" warning the scene comment had carried unpinned since 4.13. The enemy line still sits directly
under the bar and options still drop below both lines (the 2026-07-20 FR6 pairing rule — also why the 5.7
modal shell is the wrong tool here: a modal would cover the line the player is reacting to).

**Hazard 3 fixed while in the scene:** the picker bar and every option row now require a down→up pair on
the same object — story 5.7's HIGH bug class, on the very handlers this story touched. A stray release can
no longer silently change the tactic the battle resolves with.

**Docs.** Board-code supersessions are dated notes, never rewrites: `EXPERIENCE.md`'s "the board keeps
codes" (with Danilo's own 2026-07-17 reasoning quoted), the Golem ONE-code clause, the unit-card/tile row
("always" is a CARD rule), the element-badge row; epic-4 `DOSSIER.md` §7's "board keeps 3-letter codes
(13px space)" — the 13px rationale being exactly what crisper sprites retired; `DESIGN.md`'s FR39f token
block RE-SCOPED (not deleted — the tokens now govern the Reveal name), plus the unit-card and element-badge
components and the badge component's stale scene list. A player-facing amendment covers both changes.
`epics.md` gets dated citation notes at 2.1's and 5.8's ACs recording that "one treatment everywhere" is
the spine's rule, not FR3's. `deferred-work.md`: **six** entries closed (the two this story implemented,
plus four stale-open ones that had shipped in 5.0/5.3/5.7 and were never annotated) and two new items
logged (the monster-aware Battle chrome re-lay; the picker's four-tactic ceiling).

**Gate:** typecheck, lint, knip, coverage — **745 tests** (729 after 5.7, **+16**: 6 new
`reveal-roster.test.ts`, +7 `battle-view.test.ts` (1 Reveal-name pin + 6 picker), +3 `ui-chrome.test.ts`
badge pins), engine **99.06% lines** — and the web build, all green. **Engine diff: 0 lines**, so
`balanceVersion` 11, `logVersion` 4, the balance hash and every golden are untouched by construction.

**REMAINING: Danilo's device pass** (Task 6 + Task 4's picker round) — the story stays in-progress until he
accepts. What to look at: both boards with the codes gone (does a sprite alone read at a glance, especially
classes that share a silhouette?), **a MONSTER comp on Reveal** (its name sits lower by design — that
difference is the point), the 2×2 tactic picker, and a Guard+poison unit to confirm the shield now sits on
the status row.

### File List

- `apps/web/src/scenes/RevealScene.ts` — reads `committedSetup` instead of resolving; `drawUnit` re-signed; board code removed; name re-anchored monster-aware; picker on the pure layout; both bare `pointerup` handlers hardened
- `apps/web/src/scenes/BattleScene.ts` — board code removed (+ its two imports); Guard joins the status row at slot 0; three stale comments corrected
- `apps/web/src/flow/battleView.ts` — NEW pure `revealNameOffsetY`, `tacticPickerLayout`, `Rect`/`TacticPickerLayout`
- `apps/web/src/flow/MatchFlow.ts` — `resolve()`'s docstring: Battle is the first resolver now; `recordResult()` depends on the setup invariant, not scene ordering
- `apps/web/src/flow/battleStats.ts` — `UnitStats.element` (excluded from `SideTotals`)
- `apps/web/src/config/statsSheetOverlay.ts` — the element dot
- `apps/web/src/config/constants.ts` — `TACTIC_PICKER`, `REVEAL_SPRITE_SIZE`/`_OFFSET_Y`, `REVEAL_NAME_OFFSET_Y`/`_GAP`; the FR39f/`unitCodeStyle` scope re-pointed at the Reveal name
- `apps/web/test/reveal-roster.test.ts` — NEW: the engine roster contract AC1 depends on (6 tests)
- `apps/web/test/battle-view.test.ts` — the Reveal name pin (both sprite spans) + the picker suite incl. the FR30 floor and the Fight-button clamp
- `apps/web/test/ui-chrome.test.ts` — the element-badge pins (geometry, one colour consumer, no word/no tint)
- `apps/web/test/constants.test.ts` — `unitCodeStyle` suite re-pointed at the Reveal name
- `apps/web/test/match-flow.test.ts` — one stale comment
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` + `DESIGN.md` — dated 5.8 amendments
- `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` — §7's board-code clause superseded
- `docs/planning-artifacts/epics.md` — dated FR3 citation notes (stories 2.1 and 5.8)
- `docs/implementation-artifacts/deferred-work.md` — 6 entries closed, 3 logged (the discoverability entry closed same-story after Danilo placed the hint)
- `docs/implementation-artifacts/5-8-flow-corrections-and-the-board-code-decision.md`, `docs/implementation-artifacts/sprint-status.yaml`

**Rounds 3–6 additions (folded in at the 2026-08-01 review — the Change Log narrated them but this list did not):**

- `apps/web/src/config/constants.ts` — PANEL_FRAME_SLICE 30→46, PANEL_ORNAMENT_PX/SHEET_PAD, the three sheets re-budgeted (STATS 262 / SUMMARY 360 / UNIT 198), RESULT_HINT/RESULT_HINT_Y, RESULT_ANCHORS, groundLabelStyle + GROUND_TEXT_STROKE_PX, COMP_HEADING_FONT_PX, BACK_AFFORDANCE_FONT_PX
- `apps/web/scripts/check-frame-art.mjs` — slice literal mirrored 30→46 (now pinned equal to the constant by test)
- `apps/web/src/config/summarySheetOverlay.ts` — footer hint removed (round 3)
- `apps/web/src/config/ui.ts` — addBackAffordance restyled through groundLabelStyle (bone + outline, every scene's ⌂ Home/? Rules)
- `apps/web/src/scenes/ResultScene.ts` — RESULT_HINT placed per Danilo (round 4); link/headings/hint through groundLabelStyle (round 5-6); anchors tokenized (review)
- `apps/web/src/scenes/DraftScene.ts` — title/hint/tabs/YOUR ARMY/tray hint/toast through groundLabelStyle (round 6)
- `apps/web/src/scenes/PlacementScene.ts` — title/instruction/enemy marker/row counts/flashes through groundLabelStyle (round 6)
- `apps/web/src/flow/battleStats.ts` — totals-line separators (round 3: middots → double spaces for the 300px inner width)
- `apps/web/test/battle-stats.test.ts` — ornament-clearance pins, RESULT_HINT band pin, re-pinned strings/budgets

### Change Log

- 2026-07-29: Story created (baseline c62c00b). Recon by four parallel agents; the element-word claim
  re-verified against the tree by grep rather than trusted from the deferral text.
- 2026-07-29: Fresh-context validation pass applied before dev. It audited ~70 citations (all but three
  exact — `5-3-…md:110`→`:115`, the idempotence test's full title, and a `PALETTE.codeText*` knip
  overclaim, all corrected) and returned four blockers, all folded in: **(1)** a THIRD implementation
  option for AC1 that the story had missed and that beats both offered ones — pass the setup's data
  straight to `drawUnit` and build no snapshot, which removes the shell-side `BALANCE` hp read for fields
  Reveal never renders AND the equivalence test whose only job was policing that duplication (the rejected
  option is recorded with its reason); **(2)** the monster-loom regression — a Reveal name at y+8 lands
  inside a loomed 57px monster sprite, which would have broken all 10 monster classes invisibly, so the
  re-anchor is now monster-aware with both spans stated and a geometry pin added; **(3)** File List /
  Project Structure gaps (MatchFlow.ts, epics.md, match-flow.test.ts missing; "two entries" vs four);
  **(4)** Task 2's Battle re-anchor was unspecified taste AND geometrically impossible for monsters, now
  reduced to what AC2 requires with the chrome re-lay logged instead. Also folded: the Guard slot ordering
  is specified (Guard = slot 0) with its intended visible change stated, the Guard bug's symptom corrected
  (off-row alone; overlap needs three statuses), `RevealScene`'s two bare `pointerup` handlers added as
  5.7's-HIGH bug class on the very scene this story rewrites, the one-consumer pin given a real mechanism
  (raw-source glob, `game-name.test.ts`'s precedent), four more stale comments named, two more spine
  supersession sites added, and the two different `?perf=1` captures disambiguated.
- 2026-07-29: DEV DONE except Danilo's device pass. AC1: Reveal renders off `committedSetup` and never
  resolves (AD-13's double resolution gone; Battle is the single resolver on Fight!) — no snapshot built, so
  nothing duplicated, with the engine's roster contract pinned instead. AC2: board codes retired at both
  sites, the Reveal name re-anchored MONSTER-AWARE (a loomed monster reaches y+15.5, so the freed y+8 slot
  is only safe for smalls — pinned for both spans), Battle's crown/dot deliberately left put because the
  freed band is inside a loomed silhouette, and the latent Guard-marker bug fixed (slot 0; a Guard-alone
  shield visibly moves to x−20). AC3: verified already-satisfied and PINNED (12px dot, the four hexes, the
  colour table restricted to one consumer via raw-source glob, no word/no tint), plus the element dot added
  to the 5.7 stats sheet. Task 4: the picker meets FR30 as a 2×2 grid, and its clamp test corrected my own
  arithmetic — six tactics do NOT fit, the ceiling is four, now asserted so a grown roster fails in CI.
  Also hardened the picker's two bare `pointerup` handlers (5.7's HIGH bug class on this very scene). Docs:
  four spine sites + dossier §7 superseded with dated notes, FR3's mis-citation recorded at both ACs, six
  deferred-work entries closed and two logged. Gate green: 745 tests (+16), engine 99.06% lines, engine diff
  0 lines. REMAINING: the device pass (both boards without codes, a MONSTER comp on Reveal, the 2×2 picker,
  a Guard+poison unit).
- 2026-08-01: Device rounds 3–6, ALL ACCEPTED ("loved it"). Round 3: content still sat on the gold —
  the round-2 fix was WRONG (naive `ornament/CHROME_SLICE_SCALE`; a 9-slice STRETCHES ornament beyond the
  slice, so a 344-wide sheet rendered ~26px of gold, not 14, and the depth varied with panel size).
  Real fix: PANEL_FRAME_SLICE 30 → 46 contains the whole ornament — a CONSTANT 15.3px band on every panel
  (visibly thinner + uniform chrome app-wide, accepted); SHEET_PAD 22 clears it; check-frame-art.mjs
  mirrored; ornament-clearance pins added. Same round: the summary sheet's footer hint KILLED on Danilo's
  verdict ("it's not a link, clickable, so it's very confusing") — structurally unfixable (a modal
  instructing a gesture that modal blocks); its 18px went back to the bars; totals-line separators became
  double spaces (the narrower 300px inner width); UNIT_CARD +4px so the radar's two clearances hold with
  real margin. Round 4: Danilo PLACED the hint himself — between the enemy army and Rematch, where the
  chips it names are visible and holdable; RESULT_HINT at y456, centre of the measured 43px band, pinned
  against Result's own layout fractions. Monster-name Reveal read accepted same round. Round 5: the small
  coloured labels on Result were "difficult to read" on the stone floor — new `groundLabelStyle` (hue
  kept, side colour is load-bearing; letterform carried by a dark outline — FR39f's own mechanism one
  scene over; GROUND_TEXT_STROKE_PX 2, thinner than the board's 3, pinned). Round 6: hint grey → bone per
  Danilo; the same treatment extended to Draft (title, hint, tabs, YOUR ARMY, tray hint, toast),
  Placement (title, instruction line, enemy marker, row counts, flashes) and the shared ⌂ Home / ? Rules
  affordances (one edit in addBackAffordance reaches every scene) — the root cause is systemic: six
  scenes draw on the bare stone with no scrim, only Reveal/Battle scrim their HUD. Text on opaque
  surfaces (panels, cards, cells) deliberately left alone. deferred-work: the discoverability entry
  closed with Danilo's own placement decision. Gate re-green: 750 tests (+5 from the round-3/5 pins),
  engine still 0 diff lines. Status -> review, awaiting the code-review pass.
- 2026-08-01: SENIOR CODE REVIEW — 18 patches ALL APPLIED, 1 deferred, 3 dismissed. The HIGH was MINE to
  own: the pad growth that fixed the frame overlap pushed the open picker panel's top OVER the enemy
  tactic line (glyphs' lower 9px buried at depth 99) — found independently by both hunters, missed by 751
  green tests because only the CELLS were pinned. Fixed by anchoring the panel below the enemy band
  (never `cellTop − pad`), picker pad 18 (clears the 15.3px ornament, clears Fight by 6px), and pinning
  `panel.y` against the enemy band. Also: one-tick-deferred renderTactics (the destroy-in-dispatch hazard
  the Draft tabs already fixed), the ornament pin extended to ALL THREE sheets with the ✕ pinned at its
  glyph EDGE (the old form was vacuous), the Battle log inset 14→16 with its "10px border" comment
  corrected, the crown test re-cut from a tautology into a real LeaderFell cross-check (30 seeds, both
  sides exercised — probed: 9/21/22/26 fall B, 28 falls A), RESULT_ANCHORS extracted so the hint/link
  pins share the scene's own tokens instead of copies, the checker's slice literals pinned equal to the
  constants, and the record-keeping batch (sprint action item 2 closed, D-3c row + two DESIGN.md sites
  superseded, File List completed with the seven round-3–6 files, the y+18-vs-y+21 monster deviation
  recorded, stale 246 comments, the honest scope of the element-word regex, ledger dates + the 8px→38px
  arithmetic, the YAML note as a folded scalar, the guard raise/drop churn documented). Deferred: guard+3
  statuses grazing the badge (tile-chrome-budget family, folded with the monster-aware re-lay entry).
  Dismissed: the monster-name overhang (device-accepted, improved, burial impossible under king-move),
  the glyph-box-vs-centre semantics (device-accepted), the radius-pin narrowing (already recorded).
  Auditor independently re-verified: engine ZERO hunks, versions untouched, gate green, test arithmetic
  exact. Final gate: 751 tests (+1: the checker-mirror pin; the LeaderFell re-cut replaced 1-for-1),
  typecheck/lint/knip/coverage/build green. Status -> done.