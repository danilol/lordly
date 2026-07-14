import { GameObjects, Scene, Time } from 'phaser';
import type { BattleEvent, BattleStarted, UnitId, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BATTLE_BEAT_MS,
  BATTLE_HINT,
  ELEMENT_COLORS,
  engagementEndedLabel,
  PALETTE,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
} from '../config/constants';
import { addHomeBack, crispText } from '../config/ui';
import { buildBeatSchedule, fastForwardMs, screenCellCenter, toScreenCell } from '../flow/battleView';
import type { Beat } from '../flow/battleView';
import type { MatchFlow } from '../flow/MatchFlow';

/** The mutable render handles for one unit, keyed by `UnitId`. */
interface UnitView {
  container: GameObjects.Container;
  hpFill: GameObjects.Rectangle;
  barLeft: number;
  barWidth: number;
  maxHp: number;
  side: 'A' | 'B';
}

const UNIT_W = 48;
const UNIT_H = 40;
const BAR_W = 44;
const BAR_H = 5;

/**
 * Battle scene (AD-2/AD-13): a PURE PLAYER of the `BattleLog`. It evaluates no
 * combat rule — delete the engine and no game logic remains here. It builds
 * sprites from the `BattleStarted` roster (keyed by `UnitId`), then walks
 * `log.events` in array order, one beat per event on the `battleView` schedule.
 * HP bars follow the authoritative `hpAfter`; popups show `damage`. Press and
 * hold anywhere to fast-forward ×BATTLE_FAST_FORWARD (interim until FR23 / 2.3).
 */
export class BattleScene extends Scene {
  private flow!: MatchFlow;
  private views = new Map<UnitId, UnitView>();
  private beats: Beat[] = [];
  private holding = false;
  private currentIndex = 0;
  /** True when the beat now waiting is one that rendered nothing (see `render`'s return). */
  private currentSilent = false;
  private pendingTimer?: Time.TimerEvent;
  /** True while the NEXT beat is the redirected effect of an `ActionMisfired` one beat back (Task 5 pairing). */
  private pendingMisfirePair = false;
  private passLabel!: GameObjects.Text;

  constructor() {
    super('Battle');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);
    addHomeBack(this);
    crispText(this, BASE_WIDTH / 2, 26, 'Battle', { fontFamily: 'Arial Black', fontSize: '20px', color: PALETTE.title }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT - 20, BATTLE_HINT, { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.passLabel = crispText(this, BASE_WIDTH / 2, 50, '', { fontFamily: 'Arial', fontSize: '11px', color: PALETTE.bodyText }).setOrigin(0.5);

    const log = this.flow.resolve(); // same cached log the Reveal scene resolved (AD-13)
    const roster = (log.events[0] as BattleStarted).units;
    for (const unit of roster) this.buildUnit(unit);

    this.beats = buildBeatSchedule(log.events, BATTLE_BEAT_MS);

    // Press-and-hold anywhere fast-forwards; release returns to normal speed.
    // 'gameout' catches a touch/pointer leaving the canvas without a pointerup
    // firing, so `holding` can never get stuck true.
    this.input.on('pointerdown', () => this.setHolding(true));
    this.input.on('pointerup', () => this.setHolding(false));
    this.input.on('gameout', () => this.setHolding(false));

    this.step(0);
  }

  /**
   * Toggles fast-forward. If a real (non-silent) beat is mid-wait, restarts
   * that wait immediately at the new rate — otherwise engaging/releasing only
   * takes effect from the NEXT beat, up to a full BATTLE_BEAT_MS late.
   */
  private setHolding(next: boolean) {
    if (this.holding === next) return;
    this.holding = next;
    if (this.pendingTimer && !this.currentSilent) {
      this.pendingTimer.remove();
      this.scheduleNext();
    }
  }

  /** Builds one unit's container + HP bar at its mirrored screen cell. */
  private buildUnit(unit: UnitSnapshot) {
    const { x, y } = screenCellCenter(toScreenCell(unit.side, unit.placement));
    // Side A stroke = playerLine (story 2.1 AC7): side identity is blue, no
    // longer borrowed from the enabled-button green. Rendering itself is
    // untouched here — the sprite/animation pass is story 2.2.
    const stroke = unit.side === 'A' ? PALETTE.playerLine : PALETTE.enemyLine;
    const nameColor = unit.side === 'A' ? PALETTE.playerText : PALETTE.enemyText;

    const body = this.add.rectangle(0, 0, UNIT_W, UNIT_H, PALETTE.unitFill).setStrokeStyle(2, stroke);
    const name = crispText(this, 0, -6, CLASS_ABBREVIATIONS[unit.class], {
      fontFamily: 'Arial Black',
      fontSize: `${CARD_CLASS_FONT_PX}px`,
      color: nameColor,
    }).setOrigin(0.5);
    const el = crispText(this, 0, 7, unit.element, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.bodyText }).setOrigin(0.5);
    const badge = this.add.rectangle(UNIT_W / 2 - 7, -UNIT_H / 2 + 6, 8, 8, ELEMENT_COLORS[unit.element]).setOrigin(0.5);
    const container = this.add.container(x, y, [body, name, el, badge]);

    const barLeft = x - BAR_W / 2;
    const barY = y + UNIT_H / 2 + 4;
    this.add.rectangle(barLeft, barY, BAR_W, BAR_H, PALETTE.hpBarBack).setOrigin(0, 0.5);
    const fillColor = unit.side === 'A' ? PALETTE.hpBarPlayer : PALETTE.hpBarEnemy;
    const hpFill = this.add.rectangle(barLeft, barY, BAR_W, BAR_H, fillColor).setOrigin(0, 0.5);

    this.views.set(unit.id, { container, hpFill, barLeft, barWidth: BAR_W, maxHp: unit.maxHp, side: unit.side });
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

  /** Waits out the current beat (a minimal delay for a silent one), then advances. */
  private scheduleNext() {
    const dur = this.currentSilent ? 50 : this.holding ? fastForwardMs(BATTLE_BEAT_MS) : BATTLE_BEAT_MS;
    this.pendingTimer = this.time.delayedCall(dur, () => this.step(this.currentIndex + 1));
  }

  /**
   * Applies one event to the board; returns whether it visibly changed
   * anything — a silent beat (the roster's already-drawn `BattleStarted`, or a
   * dead unit's skipped turn) doesn't hold the full beat duration (`scheduleNext`).
   * Renders from log data only — never re-derives (AD-2).
   */
  private render(event: BattleEvent): boolean {
    // A pending ActionMisfired links to whatever event comes next — the
    // engine guarantees the marker is immediately followed by its redirected
    // effect (types.ts), so narrate them as one connected moment (Task 5).
    const linkedToMisfire = this.pendingMisfirePair;
    this.pendingMisfirePair = false;

    switch (event.type) {
      case 'BattleStarted':
        return false; // roster already drawn in create()
      case 'PassStarted':
        this.passLabel.setText(`Pass ${event.pass}`);
        return true;
      case 'UnitAttacked':
        for (const t of event.targets) {
          this.setHp(t.unit, t.hpAfter);
          this.popup(t.unit, this.linked(linkedToMisfire, `-${t.damage}`), PALETTE.loseText);
        }
        return true;
      case 'UnitHealed':
        this.setHp(event.target, event.hpAfter);
        this.popup(event.target, this.linked(linkedToMisfire, `+${event.amount}`), PALETTE.winText);
        return true;
      case 'StatusApplied':
        this.popup(event.target, this.linked(linkedToMisfire, event.spell), PALETTE.drawText);
        return true;
      case 'ActionMisfired':
        this.pendingMisfirePair = true;
        this.popup(event.unit, 'confused!', PALETTE.enemyText);
        return true;
      case 'ActionFizzled':
        this.popup(event.unit, this.linked(linkedToMisfire, 'fizzle'), PALETTE.mutedText);
        return true;
      case 'ActionSkipped':
        if (event.reason === 'dead') return false;
        this.popup(event.unit, event.reason, PALETTE.mutedText);
        return true;
      case 'PoisonTicked':
        this.setHp(event.unit, event.hpAfter);
        this.popup(event.unit, `-${event.damage}`, PALETTE.enemyText);
        return true;
      case 'UnitDied':
        this.kill(event.unit);
        return true;
      case 'EngagementEnded':
        // Defensive resync to the authoritative per-unit HP snapshot, plus a
        // visible boundary marker — wipeout battles (story 1.10) play several
        // engagements back to back and the seam must read on screen. The marker
        // only labels a real seam (another engagement follows): the final/only
        // engagement flows straight into the verdict, so Standard mode — which
        // has no player-facing engagement concept — never shows it.
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

  /** Sets a unit's HP bar width from the authoritative post-event HP. */
  private setHp(id: UnitId, hp: number) {
    const v = this.views.get(id);
    if (!v) return;
    const ratio = v.maxHp > 0 ? Math.max(0, Math.min(1, hp / v.maxHp)) : 0;
    v.hpFill.width = v.barWidth * ratio;
  }

  /** Fades and removes a dead unit's sprite ("deaths disappear"). */
  private kill(id: UnitId) {
    const v = this.views.get(id);
    if (!v) return;
    this.tweens.add({ targets: v.container, alpha: 0.15, duration: 150 });
    v.hpFill.width = 0;
  }

  /** A short floating text over a unit (damage/heal/status), tweened up and out. */
  private popup(id: UnitId, text: string, color: string) {
    const v = this.views.get(id);
    if (!v) return;
    const label = crispText(this, v.container.x, v.container.y - UNIT_H / 2, text, {
      fontFamily: 'Arial Black',
      fontSize: '12px',
      color,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: label,
      y: label.y - 22,
      alpha: 0,
      duration: 500,
      onComplete: () => label.destroy(),
    });
  }
}
