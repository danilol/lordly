import { GameObjects, Scene, Time } from 'phaser';
import type { BattleEvent, BattleStarted, Side, SpellKind, UnitClass, UnitId, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BATTLE_BEAT_MS,
  BATTLE_ENEMY_LABEL,
  BATTLE_LEADER_FELL_BANNER,
  BATTLE_LOG_LABEL,
  BATTLE_PLAYER_LABEL,
  BATTLE_SKIP_LABEL,
  BATTLE_SPEEDS,
  battleSpeed,
  battleTurnLabel,
  engagementEndedLabel,
  PALETTE,
  MIN_FONT_PX,
  LEADER_CROWN_GLYPH,
  GUARD_MARKER_GLYPH,
  GUARD_MARKER_COLOR,
  GUARD_BLOCKED_CAPTION,
  CLASS_ABBREVIATIONS,
  POISON_TEXT,
  STATUS_COLORS,
  STATUS_GLYPHS,
  HEAL_TRACE_COLOR,
  statusTraceColor,
  ISO_TILES,
  unitCodeStyle,
} from '../config/constants';
import type { BattleSpeedId } from '../config/constants';
import { addElementBadge, addHomeBack, addUnitSprite, applyHiDpiCamera, crispText, prefersReducedMotion } from '../config/ui';
import { drawIsoBoard } from '../config/board';
import { attachPerfSampler } from '../config/perf';
import { beatDurationMs, buildBeatSchedule, eventTrace, unitTileCenter } from '../flow/battleView';
import type { TraceKind } from '../flow/battleView';
import { createStorage } from '../flow/storage';
import type { Beat } from '../flow/battleView';
import { createNarrationState, narrateEvent } from '../flow/narration';
import type { NarrationState } from '../flow/narration';
import { UNIT_TWEENS } from '../config/sprites';
import type { MatchFlow } from '../flow/MatchFlow';

/** The mutable render handles for one unit, keyed by `UnitId`. */
interface UnitView {
  /** Everything that belongs to the unit (sprite, code, badge, HP bar, status icons) — dies with it. */
  container: GameObjects.Container;
  /** The billboard sprite child — the tween target for lunge/hurt/death (the bar stays planted). */
  sprite: GameObjects.Sprite;
  hpFill: GameObjects.Rectangle;
  barWidth: number;
  maxHp: number;
  side: Side;
  cls: UnitClass;
  /** Persistent status icons (story 2.2 AC6), keyed by spell. */
  statuses: Map<SpellKind, GameObjects.Text>;
  /** The Guard stance marker (story 4.7, FR33) — separate from `statuses`: Guard isn't a Witch spell. */
  guardMarker?: GameObjects.Text;
  x: number;
  y: number;
  dead: boolean;
}

const BAR_W = 36;
const BAR_H = 8;
/**
 * How far a melee attacker steps IN toward its target and back, as a fraction
 * of the attacker→target vector (story 4.10 — replaces the old 12px in-place
 * nudge). ~60% reads as "stepped into the clash" without occluding or
 * overshooting the target; damped under reduced motion. A device-tuning
 * constant in the same spirit as the tween durations (open Q1 — confirm feel
 * on device). Heeds story 4.9: a monster attacker renders 1.5× larger, so the
 * step is a fraction of the true gap, keeping the big sprite planted.
 */
const MELEE_STEP_FRACTION = 0.6;
/** Reduced-motion melee step — a shorter jab, same beat (UX-DR6). */
const MELEE_STEP_FRACTION_REDUCED = 0.25;
/**
 * Absolute cap on the melee step travel (px). The fraction was tuned for
 * ~70px clash-gap steps — but a `staff` bonk is resolved by RANGED targeting
 * (Cleric's nobody-damaged fallback, resolve.ts) and a misfire strikes a
 * random ally, so the attacker→target vector can span most of the board
 * (~290px); 60% of that is a full-board dash, not a step (review 2026-07-20).
 * The cap leaves every normal clash step untouched.
 */
const MELEE_STEP_MAX_PX = 90;
/**
 * Melee step ONE-WAY duration at 1× (ms) — divided by the speed factor at play
 * time so the motion slows down with the longer beat instead of darting
 * (device feedback 2026-07-20: the fixed 140ms leg read too fast at 1× once
 * the travel grew from 12px to a real step). Round trip fits every beat:
 * 2×240 = 480ms ≤ 600ms at 1×; 2×120 = 240ms ≤ 300ms at 2×.
 */
const MELEE_STEP_MS = 240;
/** Fallback melee step (px along the clash diagonal) when the target view is gone (dead/unknown) — a nudge toward the enemy board, no vector to scale. */
const MELEE_STEP_FALLBACK_PX = 20;
/** Origin→target projectile crossing time (ms); damped under reduced motion. The arrow's existing pacing, now shared by every trace. */
const TRACE_MS = 180;
const TRACE_MS_REDUCED = 80;
/**
 * How each trace kind travels — EXHAUSTIVE over `TraceKind` (review
 * 2026-07-20): a future `MoveKind` is a compile error HERE, forcing a
 * conscious step-vs-projectile choice instead of silently falling into
 * either branch (the old stringly `kind === 'slash' || …` check).
 */
const TRACE_TRAVEL: Record<TraceKind, 'step' | 'projectile'> = {
  slash: 'step',
  bash: 'step',
  staff: 'step',
  arrow: 'projectile',
  blast: 'projectile',
  heal: 'projectile',
  spell: 'projectile',
};
/** How far a combat number floats up (px; damped under reduced motion). */
const FLOAT_PX = 22;
/** Crit combat numbers render larger than the 14px base (story 4.6) — still well above the ≥14px floor (UX-DR3). */
const CRIT_FONT_PX = 20;
/** The small "CRITICAL"/"DODGE" caption stacked over the number (story 4.6) — above the MIN_FONT_PX floor, readable at full speed. */
const CAPTION_FONT_PX = 11;
/** Lines kept in the Log panel (newest at the bottom — a scrolling window). 11 logical lines leaves headroom for word-wrapped long lines inside the panel (review). */
const LOG_PANEL_LINES = 11;

/**
 * Battle scene (AD-2/AD-13, story 2.2/ADR-0001): a PURE PLAYER of the
 * `BattleLog` on two isometric boards. It evaluates no combat rule — delete
 * the engine and no game logic remains here. It builds units from the
 * `BattleStarted` roster (keyed by `UnitId`), then walks `log.events` in
 * array order, one animated beat per event on the `battleView` schedule.
 * HP bars follow the authoritative `hpAfter`; popups show `damage`; the Log
 * panel narrates the SAME events (flow/narration — no new data). The bottom
 * bar owns pacing: tappable 1×/2× speed (persisted via AD-8) and skip (FR23).
 */
export class BattleScene extends Scene {
  private flow!: MatchFlow;
  /** The AD-8 gateway — the ONLY module allowed to touch localStorage. */
  private readonly storage = createStorage();
  private views = new Map<UnitId, UnitView>();
  private beats: Beat[] = [];
  /** Current playback speed factor (FR23). LOADED from settings in create() — the one field that loads instead of resetting (singleton-scene rule). */
  private speedFactor = 1;
  /** The speed buttons' rectangles, for selected-state redraws (labels keep one live color — review: the disabled token misread as "unavailable"). */
  private speedUi = new Map<BattleSpeedId, GameObjects.Rectangle>();
  /** Re-entry guard for the Skip button (review: a double-tap fired scene.start twice). */
  private transitioning = false;
  private currentIndex = 0;
  /** True when the beat now waiting is one that rendered nothing (see `render`'s return). */
  private currentSilent = false;
  private pendingTimer?: Time.TimerEvent;
  /** True while the NEXT beat is the redirected effect of an `ActionMisfired` one beat back (1.9 pairing). */
  private pendingMisfirePair = false;
  private passLabel!: GameObjects.Text;
  /** The two side HUD labels — kept as fields so a LeaderFell can tint the fallen side persistently (story 4.5). */
  private enemyLabel!: GameObjects.Text;
  private playerLabel!: GameObjects.Text;
  /** The currently-fading leader-fall banner, if any (review fix, story 4.5): destroyed before a new one is built, so two LeaderFell events landing close together (a mutual leader death) never stack two overlapping banners. */
  private activeLeaderBanner?: [GameObjects.Rectangle, GameObjects.Text];
  // Log panel (AC7): narration ledger + a keep-last-N window; never touches the beat timer.
  private narration: NarrationState = createNarrationState();
  private logLines: string[] = [];
  private logOpen = false;
  private logPanel!: GameObjects.Container;
  private logText!: GameObjects.Text;
  private reduceMotion = false;

  constructor() {
    super('Battle');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    // Story 3.4 (NFR1): a no-op unless `?perf=1` — per-FRAME fps sampling for
    // the performance-verdict benchmark, never the beat dispatcher below.
    attachPerfSampler(this);

    // Phaser scenes are SINGLETONS: create() re-runs on every scene.start but
    // fields persist. Reset every piece of transient playback state so nothing
    // leaks between battles (2.2 review; stale log lines/toggle bled between
    // matches; `views` kept destroyed containers). The ONE exception: the
    // playback speed LOADS from the persisted settings instead of resetting —
    // it is a preference, not battle state (FR23/AD-8, story 2.3).
    this.views.clear();
    this.beats = [];
    this.speedUi.clear();
    this.transitioning = false;
    this.currentIndex = 0;
    this.currentSilent = false;
    this.pendingTimer = undefined;
    this.pendingMisfirePair = false;
    this.activeLeaderBanner = undefined; // review fix: no stale banner reference carries into a fresh match
    this.narration = createNarrationState();
    this.logLines = [];
    this.logOpen = false;
    this.reduceMotion = prefersReducedMotion();
    this.speedFactor = battleSpeed(this.storage.loadSettings().battleSpeed).factor;

    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);

    // Slim top HUD: ‹ Home left, live turn/engagement label right (no big title — the boards are the show).
    addHomeBack(this);
    this.passLabel = crispText(this, BASE_WIDTH - 12, 22, '', { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.bodyText }).setOrigin(1, 0.5);

    // The stage: two iso boards (ADR-0001) + positional side anchors (non-color accessibility cue:
    // enemy always upper-left, you always lower-right). The front row reads from the tiles alone —
    // brighter fills + gold-lite edge (FR39e, story 4.0: the redundant FRONT text labels are gone).
    drawIsoBoard(this, 'B');
    drawIsoBoard(this, 'A');
    this.enemyLabel = crispText(this, 20, 56, BATTLE_ENEMY_LABEL, { fontFamily: 'Courier', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.enemyText }).setOrigin(
      0,
      0.5,
    );
    this.playerLabel = crispText(this, BASE_WIDTH - 20, 322, BATTLE_PLAYER_LABEL, {
      fontFamily: 'Courier',
      fontSize: `${MIN_FONT_PX}px`,
      color: PALETTE.playerText,
    }).setOrigin(1, 0.5);

    const log = this.flow.resolve(); // same cached log the Reveal scene resolved (AD-13)
    const roster = (log.events[0] as BattleStarted).units;
    // Both crowned leaders (story 4.5 device follow-up): the ♛ rides each leader
    // ON the battle board through the fight — the read the mid-battle tactic
    // switch (4.10/4.11) will build on ("go for the leader or not"). Ids follow
    // the engine's `${side}:${index}` convention from the committed setup.
    const committed = this.flow.getState().committedSetup;
    const leaderIds = new Set<UnitId>(committed ? [`A:${committed.leaders.A}`, `B:${committed.leaders.B}`] : []);
    for (const unit of roster) this.buildUnit(unit, leaderIds.has(unit.id));

    this.buildControlBar();
    this.beats = buildBeatSchedule(log.events, BATTLE_BEAT_MS);

    // The epic-1 press-and-hold fast-forward (and its global pointer
    // listeners) is GONE — FR23's tappable speed buttons replaced it (story
    // 2.3, per EXPERIENCE.md). With no global pointerdown handler, stray taps
    // can no longer touch the beat timer at all (2.2 review class of bug).
    this.step(0);
  }

  /**
   * Switches playback speed (FR23): updates the selected-state visuals,
   * PERSISTS the preference via the AD-8 gateway, and CONTINUES a pending
   * non-silent beat from its elapsed progress at the new rate (the 1.9
   * latency lesson, minus the restart bug: rescheduling a fresh FULL wait
   * let alternating 1×↔2× taps stall the beat forever — review). Same-speed
   * taps no-op.
   */
  private setSpeed(id: BattleSpeedId) {
    const next = battleSpeed(id);
    if (next.factor === this.speedFactor) return;
    // Capture how far through the current beat we are BEFORE switching rates.
    const progress = this.pendingTimer && !this.currentSilent ? this.pendingTimer.getProgress() : 1;
    this.speedFactor = next.factor;
    this.storage.saveSettings({ battleSpeed: next.id });
    for (const [speedId, button] of this.speedUi) {
      const selected = speedId === next.id;
      button
        .setFillStyle(selected ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
        .setStrokeStyle(2, selected ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    }
    if (this.pendingTimer && !this.currentSilent) {
      this.pendingTimer.remove();
      const remaining = Math.max(1, Math.round((1 - progress) * beatDurationMs(BATTLE_BEAT_MS, this.speedFactor)));
      this.pendingTimer = this.time.delayedCall(remaining, () => this.step(this.currentIndex + 1));
    }
  }

  /** Skip-to-result (FR23, AD-2): the same log resolves instantly — Result reads the identical cached BattleLog; nothing is recomputed. */
  private skipToResult() {
    if (this.transitioning) return; // review: double-tap fired two scene.starts
    this.transitioning = true;
    this.pendingTimer?.remove();
    this.scene.start('Result', { flow: this.flow });
  }

  /** Builds one unit standing on its iso tile: sprite + class code + element dot + HP bar (+ ♛ crown if it's a leader), all in one container. */
  private buildUnit(unit: UnitSnapshot, isLeader: boolean) {
    const { x, y } = unitTileCenter(unit.side, unit.placement);

    // Chrome hugs the sprite tightly — units on the same lane diagonal sit a
    // half-tile (28px) apart vertically, so every extra pixel of stack height
    // is overlap; depth sorting keeps the front unit's chrome readable.
    const sprite = addUnitSprite(this, 0, -14, unit.class, 32);
    const code = crispText(this, 0, 4, CLASS_ABBREVIATIONS[unit.class], unitCodeStyle(unit.side)).setOrigin(0.5);
    const badge = addElementBadge(this, 16, -28, unit.element);
    const barBack = this.add.rectangle(-BAR_W / 2, 14, BAR_W, BAR_H, 0xffffff, 0.1).setOrigin(0, 0.5);
    const fillColor = unit.side === 'A' ? PALETTE.hpBarPlayer : PALETTE.hpBarEnemy;
    const hpFill = this.add.rectangle(-BAR_W / 2, 14, BAR_W, BAR_H, fillColor).setOrigin(0, 0.5);

    const children: GameObjects.GameObject[] = [sprite, code, badge, barBack, hpFill];
    // The ♛ crown sits top-LEFT (opposite the element badge on the right), in
    // gold (PALETTE.title = {colors.gold}) — it dies WITH the unit's container,
    // so a leader's fall clears its crown automatically. Story 4.5 board follow-up.
    if (isLeader) {
      children.push(crispText(this, -16, -28, LEADER_CROWN_GLYPH, { fontFamily: 'Arial', fontSize: '14px', color: PALETTE.title }).setOrigin(0.5));
    }
    const container = this.add.container(x, y, children);
    container.setDepth(y); // iso depth: lower on screen renders in front

    this.views.set(unit.id, {
      container,
      sprite,
      hpFill,
      barWidth: BAR_W,
      maxHp: unit.maxHp,
      side: unit.side,
      cls: unit.class,
      statuses: new Map(),
      x,
      y,
      dead: false,
    });
  }

  /** Renders beat `i` once, records whether it was visible, then waits out the beat. */
  private step(i: number) {
    this.currentIndex = i;
    if (i >= this.beats.length) {
      this.scene.start('Result', { flow: this.flow });
      return;
    }
    const beat = this.beats[i];
    this.currentSilent = beat ? !this.render(beat.event) : false;
    this.scheduleNext();
  }

  /** Waits out the current beat (a minimal delay for a silent one) at the selected speed, then advances. */
  private scheduleNext() {
    const dur = this.currentSilent ? 50 : beatDurationMs(BATTLE_BEAT_MS, this.speedFactor);
    this.pendingTimer = this.time.delayedCall(dur, () => this.step(this.currentIndex + 1));
  }

  /**
   * Applies one event to the board; returns whether it visibly changed
   * anything — a silent beat (the roster's already-drawn `BattleStarted`, or a
   * dead unit's skipped turn) doesn't hold the full beat duration.
   * Renders from log data only — never re-derives (AD-2). The narration
   * ledger advances for EVERY event so the Log panel history stays complete.
   */
  private render(event: BattleEvent): boolean {
    const narrated = narrateEvent(this.narration, event);
    this.narration = narrated.state;
    // The Log panel honors the same seam rule as the HUD label (1.10):
    // "Engagement N ended" only marks a REAL seam — the final/only engagement
    // flows straight into the verdict, so Standard mode never narrates it
    // either (review: the two surfaces contradicted one product rule).
    const dropSeamLine = event.type === 'EngagementEnded' && this.beats[this.currentIndex + 1]?.event.type === 'BattleEnded';
    if (!dropSeamLine && narrated.lines.length > 0) this.appendLog(narrated.lines);

    // A pending ActionMisfired links to whatever event comes next — the
    // engine guarantees the marker is immediately followed by its redirected
    // effect (types.ts), so narrate them as one connected moment (1.9).
    const linkedToMisfire = this.pendingMisfirePair;
    this.pendingMisfirePair = false;

    switch (event.type) {
      case 'BattleStarted':
        return false; // roster already drawn in create()
      case 'PassStarted':
        // FR39a: the HUD says "Turn" — the engine event stays PassStarted.
        this.passLabel.setText(battleTurnLabel(event.pass));
        return true;
      case 'UnitAttacked': {
        // from→to travel first (melee step / projectile trace); the IMPACT
        // effects below land when the travel does — immediately for a step
        // (the attacker itself is the motion), after the crossing time for a
        // projectile (review decision 2026-07-20: cause THEN effect — the
        // number must not pop before the arrow lands).
        const travelMs = this.traceMove(event);
        const color = this.actorColor(event.source);
        const guardian = event.redirectedFrom;
        this.afterTravel(travelMs, () => {
          for (const t of event.targets) {
            this.setHp(t.unit, t.hpAfter);
            if (t.outcome === 'dodged') {
              // A dodge is a whiff (story 4.6): no damage number, no hurt-flash,
              // HP unchanged — a clear "DODGE" caption over a dash so the miss
              // reads unambiguously even at full battle speed. NOT emphatic (review):
              // a whiff should read as understated — the caption + muted color +
              // dash already distinguish it from a hit without the crit's punch.
              this.popup(t.unit, this.linked(linkedToMisfire, '—'), PALETTE.mutedText, false, 'DODGE');
              continue;
            }
            if (guardian !== undefined) {
              // Story 4.7 (FR33): a Guard shield reduced this LANDED hit. The
              // shield ring pulses on the GUARDIAN — the unit whose charge was
              // spent (review decision 2026-07-20, per AC2 + the types.ts
              // contract; supersedes 4.7's target-side ring) — while the
              // reduced/0 number + GUARDED caption stay on the struck target
              // (it isn't a whiff). NOT emphatic — a held guard is a calm,
              // sturdy beat, not a punch like a crit.
              this.guardFlash(guardian);
              // A Full Guard negates to 0 — show a plain "0", never "-0" (review).
              const blockedText = t.damage === 0 ? '0' : `-${t.damage}`;
              this.popup(t.unit, this.linked(linkedToMisfire, blockedText), GUARD_MARKER_COLOR, false, GUARD_BLOCKED_CAPTION);
              continue;
            }
            this.hurtFlash(t.unit);
            const crit = t.outcome === 'crit';
            // A crit gets a small "CRITICAL" caption stacked over the boosted number.
            this.popup(t.unit, this.linked(linkedToMisfire, `-${t.damage}`), color, crit, crit ? 'CRITICAL' : undefined);
          }
        });
        return true;
      }
      case 'UnitHealed': {
        const travelMs = this.traceMove(event); // healer → ally across the gap
        this.afterTravel(travelMs, () => {
          this.setHp(event.target, event.hpAfter);
          this.healGlow(event.target); // the arrival glow — now genuinely on arrival
          this.popup(event.target, this.linked(linkedToMisfire, `+${event.amount}`), this.actorColor(event.source));
        });
        return true;
      }
      case 'StatusApplied': {
        const travelMs = this.traceMove(event); // caster → target across the gap
        this.afterTravel(travelMs, () => {
          this.applyStatusIcon(event.target, event.spell);
          this.popup(event.target, this.linked(linkedToMisfire, event.spell), STATUS_COLORS[event.spell]);
        });
        return true;
      }
      case 'ActionMisfired':
        this.pendingMisfirePair = true;
        this.confusionWiggle(event.unit);
        this.popup(event.unit, 'confused!', STATUS_COLORS.confusion);
        return true;
      case 'ActionFizzled':
        this.popup(event.unit, this.linked(linkedToMisfire, 'fizzle'), PALETTE.mutedText);
        return true;
      case 'ActionSkipped':
        if (event.reason === 'dead') return false;
        // Player-facing words, not raw enum values (matching the narration ledger).
        this.popup(event.unit, event.reason === 'asleep' ? 'Zzz…' : 'waits', event.reason === 'asleep' ? STATUS_COLORS.sleep : PALETTE.mutedText);
        return true;
      case 'PoisonTicked':
        this.setHp(event.unit, event.hpAfter);
        this.popup(event.unit, `-${event.damage}`, POISON_TEXT);
        return true;
      case 'UnitDied':
        this.kill(event.unit);
        return true;
      case 'GuardRaised':
        // FR33 (story 4.7): the persistent shield marker (status-icon infra) —
        // NOT a floating popup, since Guard is an ongoing stance, not a beat.
        this.applyGuardMarker(event.unit);
        return true;
      case 'GuardEnded':
        // Fires on consume (a landed hit spent the charge) AND on unconsumed
        // natural-end expiry (engine resolve.ts) — either way the marker clears.
        this.removeGuardMarker(event.unit);
        return true;
      case 'StatusCleared':
        // Story 4.2: log-driven icon removal (dossier §5) — the engine
        // narrates every clear; the scene applies exactly what it hears.
        this.removeStatusIcon(event.unit, event.spell);
        return true;
      case 'LeaderFell':
        // FR35 (story 4.5): a FULL-BEAT banner (not the per-unit floating popup)
        // plus a PERSISTENT penalty tint on the fallen side's HUD label for the
        // rest of the match — the sober-package onset made visible (dossier §6).
        this.leaderFellBanner();
        (event.side === 'A' ? this.playerLabel : this.enemyLabel).setColor(PALETTE.penaltyTint);
        return true;
      case 'EngagementEnded':
        // Defensive resync to the authoritative per-unit HP snapshot, plus a
        // visible boundary marker — wipeout battles play several engagements
        // back to back and the seam must read on screen. The marker only
        // labels a real seam (another engagement follows): the final/only
        // engagement flows straight into the verdict, so Standard mode never
        // shows it (1.10 review patch). Icon clears are LOG-DRIVEN now: the
        // engine narrates each one as StatusCleared (story 4.2 — the
        // sanctioned AD-2 exception from 2.2 is dead).
        for (const [id, hp] of Object.entries(event.hp)) this.setHp(id as UnitId, hp);
        if (this.beats[this.currentIndex + 1]?.event.type !== 'BattleEnded') {
          this.passLabel.setText(engagementEndedLabel(event.engagement));
        }
        return true;
      case 'BattleEnded':
        this.passLabel.setText(event.winner === 'draw' ? 'Draw' : `${event.winner === 'A' ? 'You' : 'Enemy'} won`);
        return true;
    }
  }

  /** Prefixes a popup's text to visually link it back to the ActionMisfired marker one beat earlier. */
  private linked(isLinked: boolean, text: string): string {
    return isLinked ? `↳ ${text}` : text;
  }

  /** Combat numbers are colored by the ACTING side (DESIGN: "blue when you deal/heal, red for the enemy") — a shell-side roster lookup (AD-11). */
  private actorColor(source: UnitId): string {
    return this.views.get(source)?.side === 'A' ? PALETTE.playerText : PALETTE.enemyText;
  }

  /** Sets a unit's HP bar width from the authoritative post-event HP. */
  private setHp(id: UnitId, hp: number) {
    const v = this.views.get(id);
    if (!v) return;
    const ratio = v.maxHp > 0 ? Math.max(0, Math.min(1, hp / v.maxHp)) : 0;
    v.hpFill.width = v.barWidth * ratio;
  }

  /**
   * Kills any in-flight tween on the sprite and restores its rest pose
   * (position 0/−14 in the container, full alpha, no rotation). Motion tweens
   * can outlive a beat (the hurt flash is 360ms, a melee step's round trip up
   * to 480ms vs the 300ms 2× beat); a second tween on the same property
   * captured mid-dip values as its yoyo base and left sprites stuck
   * translucent or off their tile (review, epic 2 — the guard this keeps).
   */
  private resetSprite(v: UnitView) {
    this.tweens.killTweensOf(v.sprite);
    v.sprite.setPosition(0, -14).setAlpha(1).setAngle(0);
  }

  /**
   * The from→to reading of one beat (story 4.10, FR39d — finishes story 4.7's
   * move flavor). Every travel is derived PURELY from the payload via the tested
   * `eventTrace` seam (AD-2 applies inside the shell too — the scene computes no
   * origin, and an origin-less event gets no fabricated travel). Branches on the
   * move `kind`, NEVER the attacker's class (per-row moves make class inference
   * wrong): melee-style moves (slash/bash/staff) STEP into the clash gap toward
   * the target and back; arrow/blast/heal/spell send a projectile that crosses
   * the diagonal to the target (a blast additionally washes every struck tile in
   * the row on arrival). Returns the travel time in ms — the caller holds the
   * beat's impact effects (`afterTravel`) until the projectile lands; 0 means
   * the impact reads immediately (a step, or no travel). All procedural — zero art.
   */
  private traceMove(event: BattleEvent): number {
    const trace = eventTrace(event);
    if (!trace) return 0; // origin-less (poison, deaths, guard markers, …) — honest on-unit rendering, no travel (AC2)
    const attacker = this.views.get(trace.fromId);
    if (!attacker || attacker.dead) return 0;
    const targets = trace.toIds.map((id) => this.views.get(id)).filter((v): v is UnitView => v !== undefined);

    if (TRACE_TRAVEL[trace.kind] === 'step') {
      this.meleeStep(attacker, targets[0]);
      return 0; // the attacker IS the motion — impact reads at the strike, no arrival delay
    }

    // A projectile aims at the first target that isn't the actor itself — a
    // self-heal / misfired self-blast has no gap to cross, so no sliver is
    // fabricated for it (review: a zero-length trace hovered on the unit).
    const to = targets.find((t) => t !== attacker);
    // Colors: ATTACK slivers follow the actor-color combat-number rule (arrow
    // keeps its 4.7 gold); heal/spell traces stay off the side hues — the one
    // rule lives at the constants (config/constants.ts, review).
    const actorFill = attacker.side === 'A' ? PALETTE.playerLine : PALETTE.enemyLine;
    let color: number;
    switch (trace.kind) {
      case 'arrow':
        color = ISO_TILES.frontStroke;
        break;
      case 'blast':
        color = actorFill;
        break;
      case 'heal':
        color = HEAL_TRACE_COLOR;
        break;
      case 'spell':
        color = statusTraceColor(trace.spell);
        break;
      case 'slash':
      case 'bash':
      case 'staff':
        return 0; // unreachable — TRACE_TRAVEL routed these to meleeStep above; listed so this switch stays EXHAUSTIVE (a new TraceKind is a compile error, not a silent default)
    }
    // One sliver across the gap toward the row (open Q1/Q2 default: a single
    // actor→row trace, not one per struck unit); the per-tile blast wash
    // blooms ON ARRIVAL (review decision 2026-07-20 — previously it fired at
    // launch while the docs claimed arrival).
    const washRow = () => {
      if (trace.kind === 'blast') for (const struck of targets) this.blastWash(struck, actorFill);
    };
    if (!to) {
      // No cross-gap target (self-target, or every target view gone): no
      // travel, effects land immediately. An ATTACK with a vanished target
      // keeps the old aggression nudge; a heal/spell just stays still —
      // stepping a healer at the enemy board would fabricate an attack read (review).
      if (trace.kind === 'arrow' || trace.kind === 'blast') this.meleeStep(attacker);
      washRow();
      return 0;
    }
    this.traceProjectile(attacker, to, color, washRow);
    return this.reduceMotion ? TRACE_MS_REDUCED : TRACE_MS;
  }

  /**
   * Runs a beat's impact effects when its travel lands: immediately for a 0ms
   * travel (a melee step, an on-unit beat), else after the projectile's
   * crossing time (review decision 2026-07-20: cause THEN effect). The
   * scene-scoped clock drops the pending call on scene shutdown, so a Skip
   * mid-flight leaks nothing.
   */
  private afterTravel(ms: number, effects: () => void) {
    if (ms <= 0) {
      effects();
      return;
    }
    this.time.delayedCall(ms, effects);
  }

  /**
   * A melee attacker steps IN toward its target and back (story 4.10 — replaces
   * the old in-place nudge). The step is a fraction of the true attacker→target
   * gap, so a 1.5× monster sprite (story 4.9) still lands planted, not floaty;
   * with no target view (dead/unknown) it nudges a fixed distance toward the
   * enemy board along the clash diagonal. Damped under reduced motion (UX-DR6).
   */
  private meleeStep(attacker: UnitView, target?: UnitView) {
    this.resetSprite(attacker); // start from a clean rest pose (0,−14); yoyo returns here
    let toX: number;
    let toY: number;
    if (target && target !== attacker) {
      const dx = target.x - attacker.x; // sprite local rest x is 0
      const dy = target.y - attacker.y; // sprite local rest y is −14
      const dist = Math.hypot(dx, dy) || 1;
      const frac = this.reduceMotion ? MELEE_STEP_FRACTION_REDUCED : MELEE_STEP_FRACTION;
      // Capped: a ranged-targeted staff bonk / misfire can span most of the
      // board — a fraction of THAT is a dash, not a step (review; see MELEE_STEP_MAX_PX).
      const travel = Math.min(dist * frac, MELEE_STEP_MAX_PX);
      toX = (dx / dist) * travel;
      toY = -14 + (dy / dist) * travel;
    } else {
      const dir = attacker.side === 'A' ? -1 : 1; // A's foe is upper-left, B's is lower-right
      const step = (this.reduceMotion ? 6 : MELEE_STEP_FALLBACK_PX) / Math.SQRT2;
      toX = dir * step;
      toY = -14 + dir * step;
    }
    this.tweens.add({
      targets: attacker.sprite,
      x: toX,
      y: toY,
      // Scales with the FR23 speed toggle (unlike the old fixed-140ms nudge):
      // a slow, weighty step at 1×, a snappy one at 2× — the round trip always
      // fits inside the beat, so the sprite is back at rest before the next event.
      duration: Math.round(MELEE_STEP_MS / Math.max(1, this.speedFactor)),
      yoyo: true,
      repeat: UNIT_TWEENS.attack.repeat,
    });
  }

  /**
   * The ONE origin→target trace (story 4.10, AC1): a small mark crosses the
   * clash gap from `from` to `to`, then destroys itself — shared by
   * arrow/blast/heal/spell so the from→to reading can't drift between kinds
   * (this generalizes story 4.7's arrow sliver). `onArrive` fires when the
   * mark lands (the blast wash's cue). Reduced motion damps the crossing
   * DURATION, never the beat (UX-DR6).
   */
  private traceProjectile(from: UnitView, to: UnitView, color: number, onArrive?: () => void) {
    const mark = this.add
      .rectangle(from.x, from.y - 12, 10, 2, color)
      .setDepth(900)
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    this.tweens.add({
      targets: mark,
      x: to.x,
      y: to.y - 12,
      duration: this.reduceMotion ? TRACE_MS_REDUCED : TRACE_MS,
      onComplete: () => {
        mark.destroy();
        onArrive?.();
      },
    });
  }

  /** A translucent actor-colored wash over one struck tile — the blast's row bloom (AC1: "washes the struck row"). */
  private blastWash(struck: UnitView, color: number) {
    const wash = this.add.circle(struck.x, struck.y - 8, 30, color, 0.35).setDepth(890);
    this.tweens.add({ targets: wash, alpha: 0, scale: this.reduceMotion ? 1 : 1.5, duration: 300, onComplete: () => wash.destroy() });
  }

  /** The struck unit's flinch — UNIT_TWEENS.hurt (alpha flash), from a clean rest pose. */
  private hurtFlash(id: UnitId) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    this.resetSprite(v);
    this.tweens.add({
      targets: v.sprite,
      alpha: UNIT_TWEENS.hurt.props.alpha,
      duration: UNIT_TWEENS.hurt.duration,
      yoyo: true,
      repeat: UNIT_TWEENS.hurt.repeat,
    });
  }

  /** A soft glow pulse on a healed unit. */
  private healGlow(id: UnitId) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    const glow = this.add.circle(v.x, v.y - 12, 22, 0xffffff, 0.28).setDepth(880);
    this.tweens.add({ targets: glow, alpha: 0, scale: this.reduceMotion ? 1 : 1.4, duration: 320, onComplete: () => glow.destroy() });
  }

  /** A confused unit wobbles as its action misfires. */
  private confusionWiggle(id: UnitId) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    this.resetSprite(v);
    this.tweens.add({ targets: v.sprite, angle: this.reduceMotion ? 4 : 12, duration: 90, yoyo: true, repeat: 1 });
  }

  /** Adds the persistent status icon (AC6) — one glyph per spell, row above the sprite; same spell never stacks (engine no-stack rule). */
  private applyStatusIcon(id: UnitId, spell: SpellKind) {
    const v = this.views.get(id);
    if (!v || v.dead || v.statuses.has(spell)) return;
    const icon = crispText(this, 0, -34, STATUS_GLYPHS[spell], {
      fontFamily: 'Arial Black',
      fontSize: `${MIN_FONT_PX}px`,
      color: STATUS_COLORS[spell],
    }).setOrigin(0.5);
    v.container.add(icon);
    v.statuses.set(spell, icon);
    this.layoutStatusIcons(v);
  }

  /** Lays icons out left→right by insertion order — slots COLLAPSE when a status clears (review: `statuses.size` as a slot index let post-clear additions overdraw the persisting poison glyph). */
  private layoutStatusIcons(v: UnitView) {
    let slot = 0;
    for (const icon of v.statuses.values()) icon.setX(-20 + slot++ * 14);
  }

  /** Removes one status icon, driven by the engine's StatusCleared event (story 4.2 — AD-2, no shell-side lifecycle rule). */
  private removeStatusIcon(id: UnitId, spell: SpellKind) {
    const v = this.views.get(id);
    if (!v) return;
    const icon = v.statuses.get(spell);
    if (!icon) return;
    icon.destroy();
    v.statuses.delete(spell);
    this.layoutStatusIcons(v);
  }

  /**
   * The Guard stance marker (`{components.guard-marker}` 🛡, story 4.7,
   * FR33) — same status-icon treatment as `applyStatusIcon`, but a dedicated
   * field (not the `statuses` map): Guard isn't a Witch `SpellKind`. Driven
   * entirely by `GuardRaised`/`GuardEnded` — no shell-side lifecycle rule.
   * Re-raising while already live (a 2-action Guard row's 2nd action, engine
   * resolve.ts) just leaves the marker in place — idempotent.
   */
  private applyGuardMarker(id: UnitId) {
    const v = this.views.get(id);
    if (!v || v.dead || v.guardMarker) return;
    const icon = crispText(this, 0, -34, GUARD_MARKER_GLYPH, {
      fontFamily: 'Arial Black',
      fontSize: `${MIN_FONT_PX}px`,
      color: GUARD_MARKER_COLOR,
    }).setOrigin(0.5);
    v.container.add(icon);
    v.guardMarker = icon;
    this.layoutStatusIcons(v); // shares the same left-of-sprite row as spell icons
  }

  /** Removes the Guard marker — fires on consume (a landed hit spent the charge) AND on unconsumed natural-end expiry (engine resolve.ts). */
  private removeGuardMarker(id: UnitId) {
    const v = this.views.get(id);
    if (!v || !v.guardMarker) return;
    v.guardMarker.destroy();
    v.guardMarker = undefined;
    this.layoutStatusIcons(v);
  }

  /**
   * The "guard held" beat (story 4.7, FR33): a shield-colored ring pulse over
   * the shielded target — distinct from `hurtFlash` (a block isn't a flinch)
   * and from a dodge's plain whiff (a reduced/zero number still lands). ≥300ms,
   * damped under reduced motion (UX-DR6).
   */
  private guardFlash(id: UnitId) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    const ring = this.add
      .circle(v.x, v.y - 8, 20, 0x000000, 0)
      .setStrokeStyle(3, ISO_TILES.frontStroke)
      .setDepth(950);
    this.tweens.add({
      targets: ring,
      scale: this.reduceMotion ? 1.1 : 1.6,
      alpha: { from: 1, to: 0 },
      duration: 320,
      onComplete: () => ring.destroy(),
    });
  }

  /** The death beat: fade + topple (UNIT_TWEENS.death) from a clean rest pose, then the corpse LEAVES the lane — container destroyed, tile vacated. */
  private kill(id: UnitId) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    v.dead = true;
    this.resetSprite(v); // a mid-flight hurt yoyo otherwise flashes the dying sprite back to opaque (review)
    this.tweens.add({
      targets: v.sprite,
      alpha: UNIT_TWEENS.death.props.alpha,
      angle: UNIT_TWEENS.death.props.angle,
      duration: UNIT_TWEENS.death.duration,
      onComplete: () => {
        v.container.destroy(); // takes bar, code, badge, and icons with it
        this.views.delete(id);
      },
    });
  }

  /**
   * A floating combat number/word over a unit — ≥14px mono bold, rising and
   * fading within the beat (damped under reduced motion). An optional `caption`
   * (story 4.6) renders a small uppercase word STACKED on top of the number —
   * "CRITICAL" / "DODGE" — so a fast beat reads unambiguously at full speed.
   */
  private popup(id: UnitId, text: string, color: string, emphatic = false, caption?: string) {
    const v = this.views.get(id);
    if (!v) return;
    const mainSize = emphatic ? CRIT_FONT_PX : 14;
    // Crit numbers read BIGGER (story 4.6) — still the side-colored, bold,
    // tabular combat-number token (DESIGN), never gold (UX-DR2 reserves it);
    // the emphasis is size + a punch + the caption, not a new color. ≥14px.
    const label = crispText(this, v.x, v.y - 34, text, {
      fontFamily: 'Courier',
      fontSize: `${mainSize}px`,
      fontStyle: '800', // the DESIGN combat-number weight token (bold = 700 fell one notch short — review)
      color,
    })
      .setOrigin(0.5)
      .setDepth(1000);
    // The caption sits just above the number, small but readable (above the
    // MIN_FONT_PX floor), same color — a per-beat "what just happened" tag.
    // Only built when actually needed — this runs on every plain hit too, the
    // most frequent event in a battle, so an unconditional construct+destroy
    // would be wasted canvas-backed text-object churn (review).
    const parts: GameObjects.Text[] = [label];
    if (caption !== undefined) {
      const caph = crispText(this, v.x, v.y - 34 - mainSize * 0.72, caption, {
        fontFamily: 'Courier',
        fontSize: `${CAPTION_FONT_PX}px`,
        fontStyle: '800',
        color,
      })
        .setOrigin(0.5)
        .setDepth(1000);
      parts.push(caph);
    }
    // A crit gets a quick scale "punch" on top of the float (damped under
    // reduced motion, which preserves the beat — UX-DR6).
    if (emphatic && !this.reduceMotion) {
      for (const p of parts) p.setScale(1.4);
      this.tweens.add({ targets: parts, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }
    this.tweens.add({
      targets: parts,
      y: `-=${this.reduceMotion ? 8 : FLOAT_PX}`,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        for (const p of parts) p.destroy();
      },
    });
  }

  /**
   * The FR35 full-beat leader-fall banner (story 4.5, EXPERIENCE.md): a
   * screen-width gold-framed strip across the board reading "The leader has
   * fallen!" — a whole-beat moment, distinct from the per-unit floating popups.
   * It rises and fades within the beat (damped under reduced motion), riding the
   * same schedule as every other beat (it holds the full beat duration because
   * `render` returned true for the event).
   */
  private leaderFellBanner() {
    // Destroy any still-fading previous banner (review fix): otherwise a rare
    // mutual-leader-death battle stacks two banners at the same screen position.
    if (this.activeLeaderBanner) {
      this.tweens.killTweensOf(this.activeLeaderBanner);
      this.activeLeaderBanner.forEach((o) => o.destroy());
      this.activeLeaderBanner = undefined;
    }
    const cy = BASE_HEIGHT / 2 - 20;
    const strip = this.add
      .rectangle(BASE_WIDTH / 2, cy, BASE_WIDTH, 40, PALETTE.backgroundFill, 0.82)
      .setStrokeStyle(2, ISO_TILES.frontStroke)
      .setDepth(1600);
    const text = crispText(this, BASE_WIDTH / 2, cy, BATTLE_LEADER_FELL_BANNER, {
      fontFamily: 'Arial Black',
      fontSize: '20px',
      color: PALETTE.title,
    })
      .setOrigin(0.5)
      .setDepth(1601);
    this.activeLeaderBanner = [strip, text];
    const drift = this.reduceMotion ? 0 : 10;
    this.tweens.add({
      targets: [strip, text],
      y: `-=${drift}`,
      alpha: 0,
      delay: 500,
      duration: 500,
      onComplete: () => {
        [strip, text].forEach((o) => o.destroy());
        if (this.activeLeaderBanner?.[0] === strip) this.activeLeaderBanner = undefined;
      },
    });
  }

  // ---- Control bar (FR23, story 2.3) + Log panel: controls playback only, never rules. ----

  /**
   * The pinned bottom bar: speed toggles (persisted), Skip, and the Log panel
   * toggle — ≥44px targets. Slot positions are DERIVED from the speed count
   * (review: hand-aligned indices meant a third BATTLE_SPEEDS entry would
   * draw over the Skip button). Labels keep one live color — selection is
   * signalled by the enabled fill+stroke, not by graying the alternative
   * (review: the disabled token read as "1× is unavailable").
   */
  private buildControlBar() {
    const barY = BASE_HEIGHT - 40;
    const gap = 8;
    let cursor = 12;
    const nextSlot = (width: number) => {
      const center = cursor + width / 2;
      cursor += width + gap;
      return { width, center };
    };

    // Speed toggles (selected state reflects the LOADED preference).
    for (const speed of BATTLE_SPEEDS) {
      const slot = nextSlot(72);
      const selected = speed.factor === this.speedFactor;
      const button = this.add
        .rectangle(slot.center, barY, slot.width, 44, selected ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
        .setStrokeStyle(2, selected ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke)
        .setInteractive({ useHandCursor: true });
      crispText(this, slot.center, barY, speed.label, { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.buttonText }).setOrigin(0.5);
      button.on('pointerup', () => this.setSpeed(speed.id));
      this.speedUi.set(speed.id, button);
    }

    // Skip: momentary action, never persisted.
    const skipSlot = nextSlot(84);
    const skip = this.add
      .rectangle(skipSlot.center, barY, skipSlot.width, 44, PALETTE.buttonFill)
      .setStrokeStyle(2, PALETTE.buttonStroke)
      .setInteractive({ useHandCursor: true });
    crispText(this, skipSlot.center, barY, BATTLE_SKIP_LABEL, { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.buttonText }).setOrigin(0.5);
    skip.on('pointerup', () => this.skipToResult());

    const logSlot = nextSlot(84);
    this.buildLogPanel(logSlot.center, logSlot.width, barY);
  }

  private buildLogPanel(buttonX: number, buttonWidth: number, barY: number) {
    const button = this.add
      .rectangle(buttonX, barY, buttonWidth, 44, PALETTE.buttonFill)
      .setStrokeStyle(2, PALETTE.buttonStroke)
      .setInteractive({ useHandCursor: true });
    const buttonLabel = crispText(this, button.x, button.y, BATTLE_LOG_LABEL, { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.buttonText }).setOrigin(
      0.5,
    );

    const panelTop = 336;
    const panelHeight = 236;
    const bg = this.add
      .rectangle(BASE_WIDTH / 2, panelTop + panelHeight / 2, BASE_WIDTH - 16, panelHeight, PALETTE.cardFill, 0.92)
      .setStrokeStyle(1, PALETTE.cardStroke);
    this.logText = crispText(this, 16, panelTop + 8, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.bodyText,
      lineSpacing: 4,
      wordWrap: { width: BASE_WIDTH - 48 },
    }).setOrigin(0, 0);
    this.logPanel = this.add.container(0, 0, [bg, this.logText]).setDepth(1500).setVisible(false);

    // Toggling only shows/hides the panel — playback is never paused (AC7).
    button.on('pointerup', () => {
      this.logOpen = !this.logOpen;
      if (this.logOpen) this.logText.setText(this.logLines.join('\n')); // catch up on lines accumulated while closed
      this.logPanel.setVisible(this.logOpen);
      button.setStrokeStyle(2, this.logOpen ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
      buttonLabel.setText(this.logOpen ? '× Log' : BATTLE_LOG_LABEL);
    });
  }

  /** Appends narration lines, keeping the newest LOG_PANEL_LINES visible (a scrolling window). */
  private appendLog(lines: string[]) {
    this.logLines.push(...lines);
    if (this.logLines.length > LOG_PANEL_LINES) this.logLines = this.logLines.slice(-LOG_PANEL_LINES);
    if (this.logOpen) this.logText.setText(this.logLines.join('\n'));
  }
}
