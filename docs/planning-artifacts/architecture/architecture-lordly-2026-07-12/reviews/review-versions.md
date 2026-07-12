# Review: Stack Versions & Stack-Adjacent Claims — Reality Check

- **Target:** `ARCHITECTURE-SPINE.md` — Stack table (claims "Verified current on 2026-07-12 (web)"), scaffold seed, AD-7 hosting claims
- **Method:** Live verification on 2026-07-12 against npm registry dist-tags, Microsoft TypeScript devblog, endoflife.date/nodejs, phaser.io news + phaserjs GitHub, Cloudflare developer docs
- **Verdict:** **Mostly verified, with three stale rows.** 8 of 11 stack rows and both Cloudflare bets check out against live sources. But the table's own claim of being "verified current on 2026-07-12" is falsified by the Node, pnpm, and TypeScript rows — all three describe the world of roughly late 2025, not July 2026. The architecture decisions themselves survive; the version pins need a refresh pass.

---

## Findings

### F1 — HIGH — Node "22 LTS" is no longer the current LTS; Node 24 is Active LTS

**Spine says:** `Node | 22 LTS`

**Reality (endoflife.date/nodejs, 2026-07):** Node **24 is the Active LTS** (since Oct 2025; active support to 2026-10-20, security to 2028-04-30). Node 22 entered **Maintenance LTS on 2025-10-21** — bugfix/security only, EOL 2027-04-30. Node 26 is Current.

Node 22 is not wrong-as-in-broken (still supported until April 2027), but pinning a maintenance-line major for a greenfield project starting now is stale, and calling it "22 LTS" in a table stamped "verified current on 2026-07-12" is inaccurate — that verification did not happen or did not look. **Recommend: Node 24 LTS.** No spine decision depends on a Node 22-specific feature, so this is a one-cell fix.

### F2 — HIGH — pnpm "latest 10.x" is false; pnpm 11 is the latest major

**Spine says:** `pnpm (workspaces) | latest 10.x`

**Reality (npm dist-tags):** `latest` → **11.12.0**. The 10.x line sits at 10.34.5 under `latest-10`, and a 12.0.0-alpha already exists under `next-12`. pnpm 10 has been superseded by a full stable major.

"Latest 10.x" was true in 2025; it is not true now. Workspaces are unaffected either way. **Recommend: pnpm 11.x** (or explicitly justify pinning the 10 maintenance line, which nothing in the spine does).

### F3 — MEDIUM — TypeScript row is stale on both halves: 6.x stable doesn't exist, and TS 7 is GA (and is npm `latest`)

**Spine says:** `TypeScript | 5.9/6.x line (TS 7 deferred — see Deferred)` and Deferred: "revisit when Vite/Vitest plugins confirm TS7 support; pinning 5.9/6.x costs nothing now."

**Reality (npm dist-tags + Microsoft devblog):**
- **TypeScript 7.0 went GA on 2026-07-08** — four days before the spine's stated verification date — and **7.0.2 is npm `latest`**. A bare `npm i -D typescript` today installs TS 7, not 5.9/6.x. The spine reads as if TS 7 is a future event.
- **There is no stable 6.x on npm.** `registry.npmjs.org/typescript/6.0.0` is a 404; the `beta` dist-tag points at `6.0.0-beta`. The stable JS-based line is **5.9.x**. So "5.9/6.x line" names a line that is half beta. (Microsoft's 7.0 announcement does frame 6.0 as the stable-defaults bridge release and recommends migrating to 6.0 first, but the npm artifact is still `6.0.0-beta` as of today.)

**The deferral decision itself is sound and is now *confirmed* rather than assumed:** Microsoft's own GA post says workflows using Vue, MDX, Astro, Svelte, and embedded-language tooling (Volar) "will likely not yet be able to leverage TypeScript 7", and the stable programmatic API only arrives in 7.1 — so Vitest/plugin-ecosystem lag is real. Keep the deferral, but rewrite the row to match reality, e.g.: "TypeScript ~5.9 (pin explicitly — npm `latest` is now 7.0; TS 7 GA 2026-07-08 but deferred until 7.1 API lands and Vitest/toolchain confirm support; adopt 6.0 as bridge when it leaves beta)." The explicit-pin instruction matters: with 7.0.2 as `latest`, an unpinned install silently lands on TS 7.

### F4 — LOW — Table implies `@fast-check/vitest` is "4.x"; its actual version is 0.4.1

**Spine says:** `fast-check / @fast-check/vitest | 4.x`

**Reality (npm):** `fast-check` latest is **4.9.0** — "4.x" correct. `@fast-check/vitest` **exists** but its latest is **0.4.1** (0.x line); the "4.x" label doesn't apply to it. Compatibility verified: its peerDependencies are `vitest: ^4.1.0` and `fast-check: ^3.0.0 || ^4.0.0` — a clean fit with the spine's Vitest 4.1.x and fast-check 4.x pins. Cosmetic table fix: split the row or annotate (`@fast-check/vitest 0.4.x, peers vitest ^4.1`).

### F5 — LOW — Phaser CLI verified, but its Vite+TS template ships lagging deps (Phaser 4.0.0, Vite 6, TS 5.7)

**Spine says:** Scaffold via `npm create @phaserjs/game@latest` (official CLI, Vite + TypeScript template).

**Reality:** The CLI **exists** (`@phaserjs/create-game`, latest 1.3.2), is officially invoked exactly as written, and offers Vite templates in JS and TS (docs recommend "Web Bundler → Vite" for first-timers). However, `phaserjs/template-vite-ts` currently pins `phaser: 4.0.0`, `vite: ^6.3.1`, `typescript: ~5.7.2` — behind the spine's Phaser 4.2.x / Vite 8.x / TS pins. The scaffold claim holds; add one sentence that the first commit after scaffolding bumps deps to the spine's pins.

---

## Verified correct (live sources, 2026-07-12)

| Claim | Result |
| --- | --- |
| Phaser 4.2.x latest | ✅ npm `latest` = **4.2.1** |
| Phaser 4 for new projects (official guidance) | ✅ Phaser 4 GA'd April 2026; official phaser.io "Phaser 3 vs Phaser 4" (May 2026): "If you're starting a new project, there's no reason to start on Phaser 3." 4.1.0 "Salusa" and 4.2.x followed. The spine's Phaser 4 bet is officially endorsed, not early-adopter risk. |
| Vite 8.x latest | ✅ npm `latest` = **8.1.4** (`previous` = 7.3.6) |
| Vitest 4.1.x stable | ✅ npm `latest` = **4.1.10**; 5.0 exists only as `beta` (5.0.0-beta.6), so 4.1.x is correctly the stable pin |
| fast-check 4.x | ✅ npm `latest` = **4.9.0** |
| pure-rand 8.x | ✅ npm `latest` = **8.4.2** |
| vite-plugin-pwa 1.x | ✅ npm `latest` = **1.3.0**; peerDependencies include `vite ^8.0.0` (supports 3–8) and Workbox 7.4.1+ — compatible with the Vite 8 pin |
| wrangler "latest" | ✅ current major is **4** (`latest` = 4.110.0); spine wisely doesn't pin a major here |
| Workers static assets on free tier | ✅ Cloudflare docs: "Requests to static assets are free and unlimited"; no storage fees; only Worker script invocations bill. Available on the free plan. |
| Durable Objects on free plan, WebSockets (multiplayer bet) | ✅ Cloudflare docs: DOs available on Workers Free plan — **SQLite storage backend only** (KV backend requires paid). Free limits: 100k requests/day, 13,000 GB-s/day, 5M rows read/day, 100k rows written/day, 5 GB storage. WebSockets supported, with hibernation available to cut duration billing. The link-play epic's platform bet holds; the future `apps/server` design should assume SQLite-backed DOs and note the 100k req/day ceiling. |

## Not independently confirmable (acceptable)

- **Cloudflare static-asset platform limits** (file count / max file size) live on a separate limits page not checked here — irrelevant to a small PWA, but the deploy story should confirm at build time.
- **pnpm 11 workspace behavior changes vs 10** — not audited; `pnpm-workspace.yaml` semantics are stable across both.

## Bottom line

No named technology is fictitious or misfit — every package, CLI, and platform capability in the spine exists and fits its role, and the two riskiest bets (Phaser 4 for new projects; DO WebSockets on the free plan) are confirmed by official sources. But three of eleven stack rows (Node, pnpm, TypeScript) contradict the table's own "verified current on 2026-07-12" stamp, and the TypeScript row misses a GA that happened four days before that date. Fix the three rows, add the explicit-TS-pin warning (npm `latest` is now TS 7), and the Stack section is genuinely web-verified rather than asserted.
