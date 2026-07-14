import { GameObjects, Scene, Time } from 'phaser';
import type { BattleEvent, BattleStarted, Side, SpellKind, UnitClass, UnitId, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BATTLE_BEAT_MS,
  BATTLE_ENEMY_LABEL,
  BATTLE_FRONT_ENEMY_LABEL,
  BATTLE_FRONT_PLAYER_LABEL,
  BATTLE_LOG_LABEL,
  BATTLE_PLAYER_LABEL,
  BATTLE_SKIP_LABEL,
  BATTLE_SPEEDS,
  battleSpeed,
  engagementEndedLabel,
  PALETTE,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
  POISON_TEXT,
  STATUS_COLORS,
  STATUS_GLYPHS,
  ISO_TILES,
} from '../config/constants';
import type { BattleSpeedId } from '../config/constants';
import { addElementBadge, addHomeBack, addUnitSprite, crispText, prefersReducedMotion } from '../config/ui';
import { drawIsoBoard } from '../config/board';
import { beatDurationMs, buildBeatSchedule, unitTileCenter } from '../flow/battleView';
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
  x: number;
  y: number;
  dead: boolean;
}

const BAR_W = 36;
const BAR_H = 8;
/** How far a melee lunge travels toward the target (px; damped under reduced motion). */
const LUNGE_PX = 12;
/** How far a combat number floats up (px; damped under reduced motion). */
const FLOAT_PX = 22;
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
    this.narration = createNarrationState();
    this.logLines = [];
    this.logOpen = false;
    this.reduceMotion = prefersReducedMotion();
    this.speedFactor = battleSpeed(this.storage.loadSettings().battleSpeed).factor;

    this.cameras.main.setBackgroundColor(PALETTE.background);

    // Slim top HUD: ‹ Home left, live pass/engagement label right (no big title — the boards are the show).
    addHomeBack(this);
    this.passLabel = crispText(this, BASE_WIDTH - 12, 22, '', { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.bodyText }).setOrigin(1, 0.5);

    // The stage: two iso boards (ADR-0001) + positional side anchors (non-color accessibility cue:
    // enemy always upper-left, you always lower-right) + FRONT indicators.
    drawIsoBoard(this, 'B');
    drawIsoBoard(this, 'A');
    crispText(this, 20, 56, BATTLE_ENEMY_LABEL, { fontFamily: 'Courier', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.enemyText }).setOrigin(0, 0.5);
    crispText(this, BASE_WIDTH - 20, 322, BATTLE_PLAYER_LABEL, { fontFamily: 'Courier', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.playerText }).setOrigin(
      1,
      0.5,
    );
    // FRONT arrows hug each board's clashing edge (enemy SE edge, player NW edge), inside the gap.
    crispText(this, 206, 146, BATTLE_FRONT_ENEMY_LABEL, { fontFamily: 'Courier', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.enemyText }).setOrigin(0, 0.5);
    crispText(this, 156, 212, BATTLE_FRONT_PLAYER_LABEL, { fontFamily: 'Courier', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.playerText }).setOrigin(1, 0.5);

    const log = this.flow.resolve(); // same cached log the Reveal scene resolved (AD-13)
    const roster = (log.events[0] as BattleStarted).units;
    for (const unit of roster) this.buildUnit(unit);

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

  /** Builds one unit standing on its iso tile: sprite + class code + element dot + HP bar, all in one container. */
  private buildUnit(unit: UnitSnapshot) {
    const { x, y } = unitTileCenter(unit.side, unit.placement);
    const nameColor = unit.side === 'A' ? PALETTE.playerText : PALETTE.enemyText;

    // Chrome hugs the sprite tightly — units on the same lane diagonal sit a
    // half-tile (28px) apart vertically, so every extra pixel of stack height
    // is overlap; depth sorting keeps the front unit's chrome readable.
    const sprite = addUnitSprite(this, 0, -14, unit.class, 32);
    const code = crispText(this, 0, 4, CLASS_ABBREVIATIONS[unit.class], {
      fontFamily: 'Arial Black',
      fontSize: `${CARD_CLASS_FONT_PX}px`,
      color: nameColor,
    }).setOrigin(0.5);
    const badge = addElementBadge(this, 16, -28, unit.element);
    const barBack = this.add.rectangle(-BAR_W / 2, 14, BAR_W, BAR_H, 0xffffff, 0.1).setOrigin(0, 0.5);
    const fillColor = unit.side === 'A' ? PALETTE.hpBarPlayer : PALETTE.hpBarEnemy;
    const hpFill = this.add.rectangle(-BAR_W / 2, 14, BAR_W, BAR_H, fillColor).setOrigin(0, 0.5);

    const container = this.add.container(x, y, [sprite, code, badge, barBack, hpFill]);
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
        this.passLabel.setText(`Pass ${event.pass}`);
        return true;
      case 'UnitAttacked': {
        this.attackFlavor(
          event.source,
          event.targets.map((t) => t.unit),
        );
        const color = this.actorColor(event.source);
        for (const t of event.targets) {
          this.setHp(t.unit, t.hpAfter);
          this.hurtFlash(t.unit);
          this.popup(t.unit, this.linked(linkedToMisfire, `-${t.damage}`), color);
        }
        return true;
      }
      case 'UnitHealed':
        this.setHp(event.target, event.hpAfter);
        this.healGlow(event.target);
        this.popup(event.target, this.linked(linkedToMisfire, `+${event.amount}`), this.actorColor(event.source));
        return true;
      case 'StatusApplied':
        this.applyStatusIcon(event.target, event.spell);
        this.popup(event.target, this.linked(linkedToMisfire, event.spell), STATUS_COLORS[event.spell]);
        return true;
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
      case 'EngagementEnded':
        // Defensive resync to the authoritative per-unit HP snapshot, plus a
        // visible boundary marker — wipeout battles play several engagements
        // back to back and the seam must read on screen. The marker only
        // labels a real seam (another engagement follows): the final/only
        // engagement flows straight into the verdict, so Standard mode never
        // shows it (1.10 review patch). Between-engagement icon clear mirrors
        // the engine rule: everything but poison (resolve.ts:77-79).
        for (const [id, hp] of Object.entries(event.hp)) this.setHp(id as UnitId, hp);
        this.clearStatusIconsExceptPoison();
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
   * Kills any in-flight recipe tween on the sprite and restores its rest pose
   * (position 0/−14 in the container, full alpha, no rotation). Under
   * fast-forward, recipe tweens (hurt 360ms, lunge 280ms) outlive the 150ms
   * beat; a second tween on the same property captured mid-dip values as its
   * yoyo base and left sprites stuck translucent or off their tile (review).
   */
  private resetSprite(v: UnitView) {
    this.tweens.killTweensOf(v.sprite);
    v.sprite.setPosition(0, -14).setAlpha(1).setAngle(0);
  }

  /**
   * The class-flavored attack beat (AD-11 shell-side flavor lookup — damage
   * itself comes only from the payload): melee steps into the clash gap and
   * strikes; the archer's arrow crosses the diagonal; the mage's blast washes
   * EVERY struck tile in the row. All procedural — zero art.
   */
  private attackFlavor(source: UnitId, targetIds: UnitId[]) {
    const attacker = this.views.get(source);
    if (!attacker || attacker.dead) return;
    const target = targetIds[0] !== undefined ? this.views.get(targetIds[0]) : undefined;
    const kind: 'arrow' | 'blast' | 'melee' = attacker.cls === 'archer' ? 'arrow' : attacker.cls === 'mage' ? 'blast' : 'melee';
    // Effects are side-colored by the ACTOR (same rule as the combat numbers).
    const actorFill = attacker.side === 'A' ? PALETTE.playerLine : PALETTE.enemyLine;

    if (kind === 'melee' || !target) {
      // Lunge toward the target (or straight at the enemy board when unknown), then back — UNIT_TWEENS.attack pacing.
      this.resetSprite(attacker);
      const dx = target ? target.x - attacker.x : attacker.side === 'A' ? -1 : 1;
      const dy = target ? target.y - attacker.y : attacker.side === 'A' ? -1 : 1;
      const len = Math.hypot(dx, dy) || 1;
      const mag = this.reduceMotion ? 4 : LUNGE_PX;
      this.tweens.add({
        targets: attacker.sprite,
        x: attacker.sprite.x + (dx / len) * mag,
        y: attacker.sprite.y + (dy / len) * mag,
        duration: UNIT_TWEENS.attack.duration,
        yoyo: true,
        repeat: UNIT_TWEENS.attack.repeat,
      });
      return;
    }

    if (kind === 'arrow') {
      // A gold sliver flies attacker → target across the clash gap.
      const arrow = this.add
        .rectangle(attacker.x, attacker.y - 12, 10, 2, ISO_TILES.frontStroke)
        .setDepth(900)
        .setRotation(Math.atan2(target.y - attacker.y, target.x - attacker.x));
      this.tweens.add({
        targets: arrow,
        x: target.x,
        y: target.y - 12,
        duration: this.reduceMotion ? 80 : 180,
        onComplete: () => arrow.destroy(),
      });
      return;
    }

    // Blast: a translucent actor-colored wash over EVERY struck tile (AC3: "washes the struck row").
    for (const id of targetIds) {
      const struck = this.views.get(id);
      if (!struck) continue;
      const wash = this.add.circle(struck.x, struck.y - 8, 30, actorFill, 0.35).setDepth(890);
      this.tweens.add({ targets: wash, alpha: 0, scale: this.reduceMotion ? 1 : 1.5, duration: 300, onComplete: () => wash.destroy() });
    }
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

  /** The between-engagement status clear, mirroring the engine rule exactly: everything but poison (resolve.ts:77-79). */
  private clearStatusIconsExceptPoison() {
    for (const v of this.views.values()) {
      for (const [spell, icon] of v.statuses) {
        if (spell === 'poison') continue;
        icon.destroy();
        v.statuses.delete(spell);
      }
      this.layoutStatusIcons(v);
    }
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

  /** A floating combat number/word over a unit — ≥14px mono bold, rising and fading within the beat (damped under reduced motion). */
  private popup(id: UnitId, text: string, color: string) {
    const v = this.views.get(id);
    if (!v) return;
    const label = crispText(this, v.x, v.y - 34, text, {
      fontFamily: 'Courier',
      fontSize: '14px',
      fontStyle: '800', // the DESIGN combat-number weight token (bold = 700 fell one notch short — review)
      color,
    })
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({
      targets: label,
      y: label.y - (this.reduceMotion ? 8 : FLOAT_PX),
      alpha: 0,
      duration: 500,
      onComplete: () => label.destroy(),
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
