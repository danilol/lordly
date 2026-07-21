import { GameObjects, Scene } from 'phaser';
import { ALL_TACTICS } from '@lordly/engine';
import type { BattleStarted, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  ENEMY_ARMY_LABEL,
  PALETTE,
  REVEAL_FIGHT_LABEL,
  REVEAL_HINT,
  REVEAL_TITLE,
  CLASS_ABBREVIATIONS,
  TACTIC_DISPLAY_NAME,
  LEADER_CROWN_GLYPH,
  unitCodeStyle,
} from '../config/constants';
import type { MatchSetup } from '@lordly/engine';
import { addElementBadge, addHomeBack, addUnitSprite, applyHiDpiCamera, crispText } from '../config/ui';
import { drawIsoBoard } from '../config/board';
import { unitTileCenter } from '../flow/battleView';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Reveal scene (FR6, AD-11): both committed boards shown FACE TO FACE — the
 * FR5/FR24 fence lifts here, so the AI's side B renders for the first time.
 * Positions come from the pure lane-mirror transform (`battleView`): enemy on
 * top facing down, player on the bottom. A thin renderer — it reads the
 * initial roster off the (once-)resolved `BattleLog` and evaluates no rule.
 */
export class RevealScene extends Scene {
  private flow!: MatchFlow;
  /** Whether the "You — <tactic>" dropdown is expanded (story 4.13). Reset every create() (singleton scenes). */
  private pickerOpen = false;
  /** The tactic block's live objects (bar + options + enemy line) — cleared and rebuilt on every toggle/pick. */
  private tacticEls: GameObjects.GameObject[] = [];

  constructor() {
    super('Reveal');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);
    addHomeBack(this);

    // Singleton reset FIRST (scenes-are-singletons) — before the uncommitted
    // early-return below, so no picker state ever leaks across plays regardless
    // of which branch create() takes (review 2026-07-20).
    this.pickerOpen = false;
    this.tacticEls = [];

    crispText(this, BASE_WIDTH / 2, 26, REVEAL_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);

    // Defensive guard (not reachable via today's FSM — PlacementScene always
    // commits before starting this scene — but cheap insurance against a
    // future navigation change): resolve() throws if reached uncommitted.
    if (this.flow.getState().phase !== 'committed') {
      crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.4, 'No match committed.', { fontFamily: 'Arial', fontSize: '16px', color: PALETTE.bodyText }).setOrigin(
        0.5,
      );
      return;
    }

    crispText(this, BASE_WIDTH / 2, 52, REVEAL_HINT, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);
    // Above the enemy board (tiles start ~y86 in the iso layout — story 2.2).
    crispText(this, BASE_WIDTH / 2, 70, ENEMY_ARMY_LABEL, { fontFamily: 'Arial Black', fontSize: '12px', color: PALETTE.enemyText }).setOrigin(0.5);

    // The shared iso boards (story 2.2, ADR-0001) — the same component the
    // Battle scene stages, so Reveal → Battle reads as one continuous place.
    drawIsoBoard(this, 'B');
    drawIsoBoard(this, 'A');

    // resolve() caches the log (AD-13); the Battle scene replays it. The initial
    // roster is the BattleStarted event, which is tactic-INDEPENDENT — so a
    // tactic pick below (which invalidates the cached log, story 4.13) never
    // changes what we draw here; only the recomputed OUTCOME differs, and Battle
    // re-resolves it. (A pre-existing double-resolve when the tactic changes is
    // logged in deferred-work.md.)
    const roster = (this.flow.resolve().events[0] as BattleStarted).units;
    const committed = this.flow.getState().committedSetup;
    for (const unit of roster) this.drawUnit(unit, committed);

    // FR6 disclosure (story 4.4/4.5): both army tactics revealed — the FR5 fence
    // lifts here, so the enemy's tactic (side B) shows for the first time. Story
    // 4.13: the player's OWN tactic is now CHOSEN here (the picker moved from
    // Placement to Reveal) — a conscious FR5/FR24 relaxation (you pick after the
    // enemy is revealed; recorded in EXPERIENCE.md). The static header sits once;
    // the picker + enemy line are (re)built by renderTactics on every toggle/pick.
    crispText(this, BASE_WIDTH / 2, 342, 'ARMY TACTICS', { fontFamily: 'Arial Black', fontSize: '12px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.renderTactics();

    const btnY = BASE_HEIGHT - 44;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, BUTTON_WIDTH, BUTTON_HEIGHT, PALETTE.buttonFillEnabled)
      .setStrokeStyle(2, PALETTE.buttonStrokeEnabled)
      .setInteractive({ useHandCursor: true });
    crispText(this, btn.x, btn.y, REVEAL_FIGHT_LABEL, { fontFamily: 'Arial', fontSize: '20px', color: PALETTE.buttonText }).setOrigin(0.5);
    btn.on('pointerup', () => this.scene.start('Battle', { flow: this.flow }));
  }

  /**
   * The army-tactics block (story 4.13): a static "ARMY TACTICS" header (drawn
   * in `create`) over a tappable "You — <tactic>" picker and a static
   * "Enemy — <tactic>" line. The picker moved here from Placement — you choose
   * your stance at the face-off. Tapping the bar toggles the four-option
   * dropdown; a pick routes through `flow.setTactic` (AD-13), which — because
   * the match is already committed — folds the new tactic into `committedSetup`
   * and drops the cached log, so `Fight!` recomputes the battle with it. All
   * four tactics are enabled: a crown is always committed by Reveal, so
   * `Attack Leader` never needs the disabled state Placement's picker had.
   * Rebuilt whole on every toggle/pick. The "You" bar and the static "Enemy"
   * line stay FIXED and adjacent (the FR6 "face to face" read the player reacts
   * to), and the four options drop into the empty band BELOW both lines when
   * open — so the enemy stance never jumps away mid-choice (review 2026-07-20).
   *
   * GEOMETRY COUPLING (the "army-row coupling sites" class): the option rows are
   * laid out from `ALL_TACTICS.length` with NO clamp against `BASE_HEIGHT` / the
   * Fight button (top ≈ y552). At the current 4 tactics the last row ends well
   * clear (≈ y502); if `ALL_TACTICS` ever grows past ~6 the list would ride over
   * Fight — re-lay this against the Fight button's Y (or scroll) before adding a
   * 7th tactic. Don't assume this scene is safe just because it isn't in that
   * change's file list.
   */
  private renderTactics() {
    for (const el of this.tacticEls) el.destroy();
    this.tacticEls = [];
    const setup = this.flow.getState().committedSetup;
    if (!setup) return;

    const bw = 210;
    const bh = 24;
    const bx = (BASE_WIDTH - bw) / 2;
    const barY = 356;
    const bar = this.add.rectangle(bx, barY, bw, bh, PALETTE.buttonFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.buttonStroke);
    const barLabel = crispText(this, BASE_WIDTH / 2, barY + bh / 2, `You — ${TACTIC_DISPLAY_NAME[setup.tactics.A]}  ${this.pickerOpen ? '▲' : '▼'}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: PALETTE.playerText,
    }).setOrigin(0.5);
    bar.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.pickerOpen = !this.pickerOpen;
      this.renderTactics();
    });
    this.tacticEls.push(bar, barLabel);

    // The enemy line is FIXED just under the bar — it never moves when the
    // dropdown opens (the two tactics stay paired for the FR6 read).
    const enemyY = barY + bh + 6;
    const enemyLabel = crispText(this, BASE_WIDTH / 2, enemyY + bh / 2, `Enemy — ${TACTIC_DISPLAY_NAME[setup.tactics.B]}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: PALETTE.enemyText,
    }).setOrigin(0.5);
    this.tacticEls.push(enemyLabel);

    if (this.pickerOpen) {
      // Options drop into the empty band BELOW both fixed lines (not between
      // them), at high depth so they sit above anything underneath.
      const optionsTop = enemyY + bh + 8;
      ALL_TACTICS.forEach((t, i) => {
        const isSel = t === setup.tactics.A;
        const oy = optionsTop + i * bh;
        const row = this.add
          .rectangle(bx, oy, bw, bh, isSel ? PALETTE.buttonFillEnabled : PALETTE.cardFill)
          .setOrigin(0, 0)
          .setStrokeStyle(1, PALETTE.buttonStroke)
          .setDepth(100);
        const label = crispText(this, BASE_WIDTH / 2, oy + bh / 2, TACTIC_DISPLAY_NAME[t], {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: isSel ? PALETTE.buttonText : PALETTE.bodyText,
        })
          .setOrigin(0.5)
          .setDepth(101);
        row.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.flow.setTactic(t); // AD-13; post-commit this invalidates the cached log so Fight! re-resolves (story 4.13)
          this.pickerOpen = false;
          this.renderTactics();
        });
        this.tacticEls.push(row, label);
      });
    }
  }

  /**
   * Draws one unit standing on its iso tile (story 2.2): the 32px billboard
   * sprite, side-colored 3-letter class code, and the shared element dot —
   * matching the Battle scene's unit treatment exactly, so Reveal → Battle
   * is the same stage. Side identity lives in the tile color + code color +
   * board position (the non-color anchor); the 2.1 card wash is retired here.
   * Story 4.2 (FR37, dossier §7): Reveal is a NAME surface — the soldier's
   * name sits under the code (the battle board keeps codes only). The name
   * inherits the code's FR39f stroke treatment so it survives the tile fill.
   */
  private drawUnit(unit: UnitSnapshot, setup?: MatchSetup) {
    const { x, y } = unitTileCenter(unit.side, unit.placement);
    addUnitSprite(this, x, y - 12, unit.class, 32).setDepth(y);
    // FR6 leader disclosure (story 4.5): the ♛ crown sits ON the leader's sprite
    // (a board marker, "the read is the payoff" — not a separate text line like
    // the tactic labels). Gold (PALETTE.title = {colors.gold}), never a side color.
    if (setup && unit.id === `${unit.side}:${setup.leaders[unit.side]}`) {
      crispText(this, x, y - 30, LEADER_CROWN_GLYPH, { fontFamily: 'Arial', fontSize: '16px', color: PALETTE.title })
        .setOrigin(0.5)
        .setDepth(y + 1);
    }
    crispText(this, x, y + 8, CLASS_ABBREVIATIONS[unit.class], unitCodeStyle(unit.side))
      .setOrigin(0.5)
      .setDepth(y);
    if (unit.name) {
      crispText(this, x, y + 21, unit.name, { ...unitCodeStyle(unit.side), fontFamily: 'Arial', fontSize: '10px' })
        .setOrigin(0.5)
        .setDepth(y);
    }
    addElementBadge(this, x + 16, y - 26, unit.element).setDepth(y);
  }
}
