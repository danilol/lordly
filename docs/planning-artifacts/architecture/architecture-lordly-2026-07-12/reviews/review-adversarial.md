---
type: adversarial-review
target: ../ARCHITECTURE-SPINE.md
reviewer: adversarial-lens
created: '2026-07-12'
verdict: NOT BUILD-READY — 6 incompatible-pair holes, 2 of them critical
---

# Adversarial Review — Architecture Spine, Lord Battle Tactics

**Method:** I play two independent AI agents, each handed one unit of work and this spine. Both obey every AD and every convention *to the letter*. If their outputs cannot link, run, or agree on data, the spine has a hole — because "they should have talked to each other" is not an architecture, it's a hope. Every finding below is a concrete compliant-vs-compliant collision, grounded in the PRD (FR3, FR13, FR16, FR18, FR20, FR22, FR24, FR25, FR28).

**Verdict: the spine's core bet (pure engine, log-replay shell) is sound and I could not break AD-1/AD-2/AD-3 themselves. Everything I broke lives in what the spine *doesn't* say: the shapes and streams that flow across the seams it so proudly draws.** Six holes, two critical. All closable with tight ADs; fixes proposed inline.

---

## Finding 1 — CRITICAL: Nobody owns the element roll, so the player's Witch changes element between draft and battle

**The pair:** the *Draft scene team* (apps/web) vs the *engine resolve team* (packages/engine).

The Capability Map says: *"Draft + elements (FR1–FR3) | web/scenes + engine types/rng | element roll uses the match seed (AD-1)"*. That sentence has two compliant readings, and each team will take the one that makes its own module cleaner:

- **Draft team's reading:** FR3 says the element is assigned "as each unit is added" and the owner "sees the roll immediately." So the Draft scene imports `engine/rng`, seeds it with the match seed, draws four-way rolls as the player taps class cards, stores the elements in `MatchState`, and passes a `MatchSetup` that *contains* per-unit elements. Fully compliant: all randomness from the injected seeded PRNG (AD-1), engine types imported not redeclared (AD-4).
- **Engine team's reading:** AD-1 says `resolveBattle(setup, seed)` is a pure function and *all* randomness flows from the injected PRNG. FR20 lists the seed as the single random source. So `resolveBattle` derives the element rolls itself from the seed — that's what `rng.ts: stream derivation` is *for* — and `MatchSetup` carries compositions and placements only. Also fully compliant.

**The collision:** integrate them and one of two things happens. (a) `MatchSetup` has elements the engine ignores and re-rolls — the player drafted a Fire Witch (Weaken), the battle resolves her as Water (Sleep), violating FR3 and FR16 silently. (b) The engine expects elements in the setup that the draft team's type doesn't... no wait — AD-4 says the type lives in the engine, so the *type* will be whatever the engine team wrote, and the draft team's on-screen rolls become cosmetic lies. Either way FR3's "the owner sees the roll immediately (before placement, so the formation can adapt to it)" is broken: the formation adapted to a roll the battle doesn't honor.

**Bonus collision inside the same hole:** even if both teams agree the shell rolls, FR3's "as each unit is added" is UI-interaction-ordered. Player adds Knight, removes it, adds Witch — did the removal's roll consume a stream draw? Team A re-rolls on re-add (stream position = interaction count); Team B rolls per slot index (stream position = slot). Both compliant. Now the AI team (Finding 2) consumes "the next" values from the same seed and the whole match's randomness depends on how many times the player fidgeted in draft — unreplayable from (setup, seed) unless elements are stored data, which nothing mandates.

**Fix — new AD-9 (Elements are data, rolled once, by the shell, on a named stream):**
> `MatchSetup` explicitly includes each unit's rolled element; `resolveBattle` treats elements as *input data* and never rolls them. The engine exports `rollElement(stream): Element`; the shell calls it at draft time on the `elements/<side>` stream (see AD-10), exactly once per final army slot (re-rolled draws for removed units are immaterial because the result is *stored*, not re-derived). Replay (FR28, AD-8) reproduces elements because they travel inside the persisted `MatchSetup`, never from the seed. Publish the full `MatchSetup` shape (fields, side labels, army-size param per NFR6) in `engine/types.ts` as a versioned contract — it is the single most-shared object in the system and today the spine never once says what's in it.

---

## Finding 2 — CRITICAL: One seed, three hungry consumers, zero stream discipline — and the AI's seed is entangled with the player's hidden rolls

**The pair:** the *engine AI team* (AD-6: `ai(strategyPool, seed) → composition + placement`) vs the *Draft/battle consumers of the same seed* — with the *sim harness team* (NFR4) as collateral damage.

The conventions fix exactly one thing about the seed: the shell generates it with `crypto.getRandomValues` at match start. `rng.ts` whispers "stream derivation" in a file-tree comment — a comment is not a contract. So:

- **AI team, compliant:** AD-6 gives the signature `(strategy pool, seed)`. They pass the match seed. Draws strategy index + placement jitter from it, positions 0..k of the stream.
- **Draft team, compliant:** rolls player elements from the match seed, positions 0..5 of the stream.
- **Battle team, compliant:** AD-1, confusion misfires and FR13 coin flips from the injected PRNG — the match seed, positions 0..n.

Three modules, one linear stream, no offsets defined. The element the player rolls *changes which strategy the AI picks* (or vice versa, depending on call order that no AD fixes). Every module passes its own unit tests perfectly; the integrated match is order-of-invocation-dependent, and FR28 replay reproduces it only if the replay path calls everything in the same order the live path did — an invariant that exists nowhere.

**The FR24 knife-twist:** AD-6 brags that AI blindness is "enforced by construction, not discipline." False, as specified. The AI is a pure function of a seed *from which the player's element rolls are also derived*. The AI's inputs "cannot include the player's draft" — but they include a value that *determines part of it* (the player's elements, hidden until reveal per FR3). A compliant, even non-malicious AI implementation is statistically correlated with the player's hidden rolls; a cheeky one can literally compute them (`rng.ts` is right there in the same package). By-construction blindness requires by-construction stream independence, which the spine does not construct.

**The sim-harness casualty:** NFR4's harness plays AI vs AI. Compliant harness code calls `ai(pool, seed)` for side A and `ai(pool, seed)` for side B — same signature, same seed, it's a pure function, what else would you pass? Both sides pick the identical archetype every game. The balance data (Goal 2's instrument!) becomes a mirror-match generator and nobody notices until the tuning is already wrong.

**Fix — new AD-10 (Named seed streams, raw seed untouchable):**
> `engine/rng` exports `deriveStream(seed, label)` (pure-rand split/derivation) with a *closed* set of labels: `elements/A`, `elements/B`, `ai/B` (and `ai/A` for the harness), `battle`. No code outside `rng.ts` may consume the raw seed. AD-6's AI signature becomes `(strategyPool, stream)` where the stream is `deriveStream(seed, 'ai/<side>')` — independent by construction from `elements/*`, making FR24's by-construction claim actually true and giving the sim harness two distinct AI streams for free. `resolveBattle` uses only `battle`. Property test to mandate alongside NFR2's list: element rolls invariant under AI-stream consumption and vice versa.

---

## Finding 3 — HIGH: "Side + grid cell" ids with no side names and no coordinate frame — the animator and the engine render two different battles

**The pair:** the *Battle scene animator* (apps/web) vs the *engine event author* (packages/engine).

Conventions: *"Units are identified by stable slot ids (side + grid cell) assigned at reveal."* Three unexploded bombs in one sentence:

1. **"Assigned at reveal."** Reveal is a *shell scene* (AD-5). So the shell assigns unit identity — but the engine authors `BattleLog` events that must reference units, and the engine never sees the Reveal scene. Two compliant readings: shell stamps ids into `MatchSetup` before calling the engine; or the engine derives ids from board positions and "at reveal" is merely when the *UI first shows* them. If the shell's format is `player:front-left` and the engine's is `B:r0c2`, the animator matches zero events to zero sprites. This is the same disease as Finding 1: identity assigned at a seam with no owner.
2. **Which sides exist?** The engine, per AD-6/NFR6, knows "two submitted boards" — it has no concept of *player* vs *AI*. So engine events say `side: 'A' | 'B'` (or attacker/defender, or 0/1 — unspecified). Who is A? The animator team decides player = A (first argument). The flow-controller team built `MatchSetup` with the AI first because the AI commits first (FR5, it must commit blind). Compliant + compliant = **the History screen shows you losing every match you won**, because the stored `winner: 'A'` (AD-8) means opposite things to writer and reader. FR18's judging-symmetry property test will pass beautifully while the product lies.
3. **Mirrored columns (FR7).** "Your left column faces the enemy's right, rendered as one straight lane." Are event positions owner-local (each side's own left/center/right) or lane-global? Engine team, compliant, emits owner-local — that's how targeting rules (FR7–FR12) are written. Animator team, compliant, reads the log's `position` as lane coordinates — that's what it's drawing. Every arrow on the corner lanes flies to the wrong column; the Archer visibly snipes a unit that then takes no damage while the actual victim's HP bar drops across the screen.

**Fix — new AD-11 (Side and coordinate contract):**
> Sides are `'A'` (the local player / link-play match initiator) and `'B'` (opponent), fixed at `MatchSetup` construction and stored as such everywhere — engine, `MatchState`, history, future server protocol. All positions in domain types and `BattleLog` events are **owner-local** `(side, row: front|middle|back, col: left|center|right)`; the lane-mirroring transform is presentation-only and lives in exactly one shell function. Slot ids are `<side>:<row>-<col>`, computed by a single engine-exported function from `MatchSetup` — "assigned at reveal" is deleted from the conventions (reveal *displays* identity, nothing assigns anything in a scene).

---

## Finding 4 — HIGH: The BattleLog event union can't express half the battle the PRD specifies

**The pair:** the *engine event author* vs the *Battle scene animator*, second round — this time over granularity.

The convention enumerates the union: `UnitAttacked | UnitHealed | StatusApplied | UnitDied | EngagementEnded | BattleEnded`, and AD-2 decrees *"anything the UI needs to show must be an event in the log"* and the player *"never re-derives game state."* Read those together and enumerate what FR13/FR16/FR18/FR22 require the UI to show. The union loses:

- **Confusion misfire (FR16 Wind).** A confused Mage blasts *its own* fullest row. Compliant engine author encodes it as `UnitAttacked` with attacker and targets on the same side — it *is* an attack. Compliant animator, seeing attacker.side === target.side, concludes the log is corrupt (or worse, silently renders a normal-looking friendly blast with no confusion cue). FR16's whole drama — the misfire — is invisible. Was it a misfire or an engine bug? The log cannot say.
- **Fizzle (FR16: "the action fizzles and is spent").** No event type fits. Author A emits nothing → the initiative timeline visibly skips a unit's turn and the animator's pacing (and the player's trust) hiccups. Author B invents `ActionFizzled` → violates the enumerated union, or "extends" it, meaning the union was never a contract at all.
- **Sleep-skipped actions (FR16 Water) / dead units' lost actions (FR13).** Same shape: the *absence* of an action is a visible fact (FR21: "status effects show icons," the player watches their Sleep pay off) with no event to carry it.
- **Pass boundaries (FR13).** The multihit split — Knight swings, the whole timeline weaves, Knight swings again — is the PRD's named mechanic. Nothing delimits passes in the log. One animator paces by pass, inventing boundaries by re-deriving AGI order (explicitly forbidden: "never re-derives game state"); another plays events at a flat rate and the multihit split reads as nothing.
- **Mage row blast fan-out (FR10).** One cast, up to three victims. One `UnitAttacked` with `targets: []`, or three consecutive `UnitAttacked`? Author picks three-events (simpler); animator assumes one-event-per-action for the speed control's tick unit (FR23) and initiative pacing → one blast animates as three separate casts and ×2 speed math is wrong. Both compliant; the convention's `...` payload ellipsis decides nothing.
- **Poison tick (FR16 Earth: end of engagement, *before* FR18 judging).** `UnitAttacked` with no attacker? `StatusApplied` again? Undefined.
- **`BattleEnded` payload.** FR22 requires winner + both final HP percentages; FR18 requires a representable **draw**. The convention's `...` hides all of it. The storage module (AD-8: "stores ... winner") will type `winner` from whatever the engine team shipped; if that's `'A' | 'B'` because the author forgot FR18's draw, the first tied match either crashes the Result scene or records a lie in history. (And per Finding 3, even a correct `'A'` may be read backwards.)

**Fix — new AD-12 (BattleLog is a closed, published contract):**
> The event union is *exhaustive and versioned* in `engine/types.ts`, extended to cover every visible fact in FR13/FR16–FR18/FR21–FR23: add `PassStarted`, `ActionMisfired` (wrapping the substituted action), `ActionFizzled`, `ActionSkipped` (cause: sleep|dead), `StatusTicked` (poison), and fix cardinality: **exactly one event per (actor, action)**, multi-target effects carry `targets: Array<{unit, damage, hpAfter}>`. `BattleEnded` carries `{ result: 'A' | 'B' | 'draw', hpPct: { A: number, B: number } }`. Rule of thumb stated in the AD: *if a playtester can see it or a test must assert it, it is an event, not an inference.* Golden-battle snapshots (NFR2) then freeze this contract for free.

---

## Finding 5 — HIGH: Nobody may call `resolveBattle` — or everybody may — and replay re-entry corrupts history

**The pair:** the *flow controller / MatchState owner* (AD-5) vs the *Battle scene* vs the *History scene* (FR28 replay, AD-8).

Two conventions in a pincer: AD-2 says the engine resolves up front and the Battle scene is "a pure player of the log"; the mutation convention says *"`MatchState` is mutated only by the flow controller."* Nobody says **who invokes `resolveBattle`**. Watch two compliant teams deadlock:

- **Battle scene team:** the scene needs the log; AD-3 lets any shell code import the engine; so the scene calls `resolveBattle` on create, keeps the log locally, plays it. Compliant. But now the log — and the outcome — live in a scene-local variable. The Result scene needs winner + HP% (FR22) and the storage module needs setup/seed/winner (AD-8). The Battle scene *cannot* write them into `MatchState` (mutation convention!). So it passes the log via `scene.start('Result', { log })` — Phaser's data bag — which is `MatchState`-truth-by-another-door, precisely the "scattered per-scene copies of match truth" AD-5 exists to prevent. Compliant with the letter, guts the intent.
- **Flow controller team:** the controller resolves at reveal, stores `battleLog` in `MatchState`, hands scenes the state. Compliant. But it *assumed* the Battle scene doesn't resolve — if both teams built independently, the battle resolves **twice** (harmlessly identical, FR20, so no test ever catches the duplicated architecture) and each half of the app reads a different copy.

**The replay corruption:** FR28/AD-8 replays run the same Battle scene from History. Nothing marks a `MatchState` as *replay*. The storage module team, compliant, writes a history entry "when a match completes" — i.e., whenever the flow reaches Result. Replay an old battle → flow reaches Result → a **new** entry is appended for a 2-week-old match with today's date, and since only 10 entries are kept (FR28), **replaying your history destroys your history** — each replay evicts a real match. Every module to spec; the product eats itself.

**Fix — new AD-13 (One engine caller; replay is a mode):**
> The flow controller is the *only* shell component that calls `resolveBattle` (and `engine/ai`). It resolves once, at reveal-complete, and the log rides inside `MatchState` (it's plain data — AD-5 already requires serializability). Scenes never call the engine and never receive domain data outside `MatchState`. `MatchState` gains a required `mode: 'live' | 'replay'` discriminant set at flow start; the history write happens in exactly one place — the flow controller, on first entry to Result, `mode === 'live'` only. History-screen replays construct a `mode: 'replay'` state from the stored entry.

---

## Finding 6 — MEDIUM: `lordly.v1.*` is a namespace, not a schema — two writers, no key map, no draw, no size discipline

**The pair:** the *storage module* (AD-8) vs *every other shell feature that touches persistence* — starting with the Battle scene's speed preference (FR23) and the History scene.

AD-8 fixes a prefix and a history payload. It does not fix:

- **The key layout.** Storage team A: one key, `lordly.v1.history` = JSON array, trimmed to 10 on write. Storage team B: `lordly.v1.history.<n>` ring buffer plus `lordly.v1.history.index`. History-scene team reads whichever they imagined. Both compliant with "localStorage under a versioned namespace." Nothing arbitrates.
- **Who else may write.** FR23's speed setting wants to persist (a player who chose ×2 wants it kept). Compliant Battle-scene author writes `lordly.v1.settings.speed` directly — it's the blessed namespace, and AD-8 never says the storage module is the sole writer. Now schema knowledge is smeared across scenes, and the "unknown/older namespaces are ignored" rule has two enforcers with two opinions. When someone bumps to `lordly.v2` for a history-shape change, the settings key silently dies with it (or doesn't, if the scene author hardcoded `v1` — worse).
- **The entry shape vs FR28's letter.** FR28 stores "winner, both compositions, date, seed." AD-8 stores "full `MatchSetup`, seed, winner, and balance-data version." A team implementing FR28 verbatim omits *placements* — and replay (the entire point of storing the seed, per FR28's own assumption note) is impossible. AD-8 wins, but the spine should say FR28's list is the *display* subset, and the entry shape should be a named engine-adjacent type, not four prose nouns. Also: `winner` must be `'A' | 'B' | 'draw'` (Findings 3–4) and `date` ISO 8601 (conventions) — say it in one place.
- **Quota.** Ten entries × full `MatchSetup` + seed is small; but if a team decides to cache the `BattleLog` "so replay doesn't re-run the engine" (a compliant optimization nobody forbade — and one that *breaks* AD-8's balance-version rule, since a stale cached log replays outdated rules as if current), entries balloon and the balance-version gate is bypassed entirely.

**Fix — tighten AD-8 (Storage module is the sole persistence gateway):**
> All localStorage access goes through `web/storage` — scenes and flow import its typed API, never `localStorage`. The module publishes the complete `lordly.v1` key manifest (`history`, `settings`, …) and the `HistoryEntry` type: `{ setup: MatchSetup, seed, result: 'A'|'B'|'draw', date: ISO8601, balanceVersion }`. Explicitly: **no `BattleLog` is ever persisted** — replay always re-runs the engine (that's AD-2's whole economy), gated on `balanceVersion === engine.BALANCE_VERSION`. FR28's field list is the History-screen display projection, not the stored shape.

---

## Minor jabs (no AD needed, but say a word each)

- **Seed representation.** `crypto.getRandomValues` yields bytes; `pure-rand` wants a numeric seed; JSON (history) mangles >2^53 integers. Since `Seed` is an engine type (AD-4), define it once — e.g. 32-bit unsigned int — and this never bites. One sentence in conventions.
- **"Match start" is undefined.** Seed is generated "at match start" — tap on *Play*, or Draft-scene entry? Matters only because everything else hangs off the seed; pin it to flow-controller match creation (fits AD-13).
- **Rematch (FR22) seed.** "Straight to a fresh draft" — new seed, obviously, and FR3's re-roll assumption implies it; but "obviously" is how this review got six findings. One clause: rematch = new match = new seed.

---

## Scorecard

| # | Hole | Colliding pair | Severity | Fix |
| --- | --- | --- | --- | --- |
| 1 | Element roll ownership / MatchSetup shape undefined | Draft scene ↔ engine resolve | **Critical** | AD-9 |
| 2 | No seed-stream derivation contract; AI seed entangled with hidden rolls (FR24); harness mirror-matches | engine/ai ↔ draft ↔ battle ↔ sim harness | **Critical** | AD-10 |
| 3 | Side identity + coordinate frame unfixed; ids "assigned at reveal" | Battle animator ↔ engine event author (↔ history reader) | **High** | AD-11 |
| 4 | BattleLog union can't express misfire/fizzle/sleep/pass/blast-fan-out/draw | engine event author ↔ Battle animator ↔ storage | **High** | AD-12 |
| 5 | No designated `resolveBattle` caller; replay re-entry rewrites history | flow controller ↔ Battle scene ↔ History scene | **High** | AD-13 |
| 6 | Namespace without schema: key layout, second writers, entry shape, log-caching loophole | storage module ↔ History/Battle scenes | **Medium** | AD-8 tightened |

**Bottom line for the future `apps/server` (link-play):** Findings 1–4 are exactly the seams the server will stand on — `MatchSetup` wire shape, stream derivation for server-side verification, side identity across two real clients, and a log contract the server must reproduce bit-identically (AD-1's promise). Close them now while they cost a paragraph each; after the MVP ships they cost a migration, and AD-8 pointedly refuses to migrate.
