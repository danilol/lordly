import { GameObjects, Scene } from 'phaser';
import { ALL_TACTICS } from '@lordly/engine';
import type { Placement, Side, Unit } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  ENEMY_ARMY_LABEL,
  HUD_LABEL_DEPTH,
  PALETTE,
  REVEAL_FIGHT_LABEL,
  REVEAL_HINT,
  REVEAL_HUD_BAND_H,
  ISO_BOARD_REVEAL,
  REVEAL_TITLE,
  REVEAL_SPRITE_OFFSET_Y,
  REVEAL_SPRITE_SIZE,
  TACTIC_DISPLAY_NAME,
  LEADER_CROWN_GLYPH,
  unitCodeStyle,
} from '../config/constants';
import {
  addBattleTerrain,
  addButton,
  addElementBadge,
  addFramedPanel,
  addHomeBack,
  addHudScrim,
  addUnitSprite,
  applyHiDpiCamera,
  crispText,
} from '../config/ui';
import { drawIsoBoard } from '../config/board';
import { DEFAULT_ORIENTATION, revealNameOffsetY, tacticPickerLayout, unitTileCenter } from '../flow/battleView';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Reveal scene (FR6, AD-11): both committed boards shown FACE TO FACE — the
 * FR5/FR24 fence lifts here, so the AI's side B renders for the first time.
 * Positions come from the pure lane-mirror transform (`battleView`): enemy on
 * top facing down, player on the bottom. A thin renderer — it reads both
 * boards straight off `committedSetup` (story 5.8: it never resolves a battle;
 * AD-13 keeps `resolveBattle` to one call per live match, on the Fight! tap)
 * and evaluates no rule.
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
    // Story 5.3: the same terrain the coming battle is fought on — Reveal and
    // Battle read the same seed, so the face-off and the clash share a place.
    addBattleTerrain(this, this.flow.getState().seed);
    addHudScrim(this, REVEAL_HUD_BAND_H); // title/hint/enemy label over the art
    addHomeBack(this);

    // Singleton reset FIRST (scenes-are-singletons) — before the uncommitted
    // early-return below, so no picker state ever leaks across plays regardless
    // of which branch create() takes (review 2026-07-20).
    this.pickerOpen = false;
    this.tacticEls = [];

    crispText(this, BASE_WIDTH / 2, 26, REVEAL_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);

    // Defensive guard (not reachable via today's FSM — PlacementScene always
    // commits before starting this scene — but cheap insurance against a future
    // navigation change). Story 5.8: the reason changed with the roster source.
    // It is no longer "resolve() throws if reached uncommitted" — nothing here
    // resolves now — it is that an uncommitted match has no `committedSetup` to
    // draw, and a silently empty board is worse than saying so.
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
    // DEPTH (5.3 review, 2026-08-01): units are depth-sorted by screen y, so an
    // enemy back-row sprite sits at depth ~90-108 — above this label's default
    // 0. A LOOMED monster there reaches y≈66.5 and painted straight over the
    // header; the live AI pool's `breath-battery` puts an Emberdrake at
    // back/left, so it was reachable in normal play. HUD chrome outranks the
    // board: depth above any tile-y a sprite can carry.
    crispText(this, BASE_WIDTH / 2, 70, ENEMY_ARMY_LABEL, { fontFamily: 'Arial Black', fontSize: '12px', color: PALETTE.enemyText })
      .setOrigin(0.5)
      .setDepth(HUD_LABEL_DEPTH);

    // The shared iso boards (story 2.2, ADR-0001) — the same component the
    // Battle scene stages, so Reveal → Battle reads as one continuous place.
    // Story 5.3 device pass: Reveal keeps its own COMPACT frame — Battle's
    // enlarged boards would run straight into the tactics block below.
    drawIsoBoard(this, 'B', DEFAULT_ORIENTATION, ISO_BOARD_REVEAL);
    drawIsoBoard(this, 'A', DEFAULT_ORIENTATION, ISO_BOARD_REVEAL);

    // Story 5.8 (AC1): Reveal does NOT resolve the battle. AD-13's rule is that
    // MatchFlow is the sole caller of `resolveBattle` and a battle is resolved
    // exactly once per live match — its "Prevents" line literally names "double
    // resolution". Reveal used to run a full resolve purely to read the
    // tactic-INDEPENDENT roster off `BattleStarted`, and a tactic pick below
    // then dropped that log (story 4.13), so Fight! paid for a second full
    // resolve while the first was discarded unused.
    //
    // A board is static per-unit facts, which AD-2 routes through MatchSetup:
    // "the renderer may read the setup, never re-derive a rule". `armies` +
    // `placements` + `leaders` is everything `drawUnit` reads — no snapshot is
    // built, so no engine logic is duplicated here (notably NOT hp/maxHp, which
    // this board never draws). Fight! now performs the single resolve.
    // The roster↔setup index correspondence this relies on is pinned in
    // apps/web/test/reveal-roster.test.ts.
    const setup = this.flow.getState().committedSetup;
    if (!setup) return; // unreachable past the phase guard above; narrows the optional for the walk below
    for (const side of ['A', 'B'] as const) {
      setup.armies[side].forEach((unit, i) => this.drawUnit(side, unit, setup.placements[side][i]!, i === setup.leaders[side]));
    }

    // FR6 disclosure (story 4.4/4.5): both army tactics revealed — the FR5 fence
    // lifts here, so the enemy's tactic (side B) shows for the first time. Story
    // 4.13: the player's OWN tactic is now CHOSEN here (the picker moved from
    // Placement to Reveal) — a conscious FR5/FR24 relaxation (you pick after the
    // enemy is revealed; recorded in EXPERIENCE.md). The static header sits once;
    // the picker + enemy line are (re)built by renderTactics on every toggle/pick.
    crispText(this, BASE_WIDTH / 2, 342, 'ARMY TACTICS', { fontFamily: 'Arial Black', fontSize: '12px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.renderTactics();

    const btnY = BASE_HEIGHT - 44;
    addButton(this, BASE_WIDTH / 2, btnY, {
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      label: REVEAL_FIGHT_LABEL,
      fontSize: 20,
      style: 'primary',
      onTap: () => this.scene.start('Battle', { flow: this.flow }),
    });
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
   * GEOMETRY COUPLING (the "army-row coupling sites" class) — story 5.8 turned
   * this warning into a TEST. The geometry now comes from the pure
   * `tacticPickerLayout(ALL_TACTICS.length)`, and battle-view.test.ts pins the
   * FR30 44px floor for the bar and every cell, the grid order, and the clamp
   * against the Fight button's top (y568 — the old comment's "≈ y552" was a
   * guess). The 2×2 grid holds FOUR tactics with slack; a FIFTH needs a third
   * row and would overrun Fight, so the test fails on a grown `ALL_TACTICS` and
   * forces a deliberate re-lay (scroll, three columns, or a shorter bar) instead
   * of a device session discovering the overlap.
   */
  private renderTactics() {
    for (const el of this.tacticEls) el.destroy();
    this.tacticEls = [];
    const setup = this.flow.getState().committedSetup;
    if (!setup) return;

    // Geometry from the pure layout (story 5.8) — FR30 44px targets, the option
    // grid, and the clamp against the Fight button all live in `battleView` so
    // they are provable without a Phaser scene.
    const L = tacticPickerLayout(ALL_TACTICS.length);
    const bar = this.add.rectangle(L.bar.x, L.bar.y, L.bar.w, L.bar.h, PALETTE.buttonFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.buttonStroke);
    const barLabel = crispText(this, BASE_WIDTH / 2, L.bar.y + L.bar.h / 2, `You — ${TACTIC_DISPLAY_NAME[setup.tactics.A]}  ${this.pickerOpen ? '▲' : '▼'}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: PALETTE.playerText,
    }).setOrigin(0.5);
    // Down→up on the SAME object (story 5.8, carrying 5.7's HIGH): a bare
    // `pointerup` fires even when the press began somewhere else — the bug
    // `addButton` was hardened against (config/ui.ts). Reachable here because
    // `addHomeBack` installs a scene-wide pointerdown and a down can lose its
    // up across a scene boundary. A tap is a down→up pair, nothing less.
    let barPressed = false;
    bar
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        barPressed = true;
      })
      .on('pointerout', () => {
        barPressed = false;
      })
      .on('pointerup', () => {
        if (!barPressed) return;
        barPressed = false;
        this.pickerOpen = !this.pickerOpen;
        // ONE TICK deferred (review 2026-08-01): renderTactics destroys every
        // element in `tacticEls` — including this very bar, mid-dispatch. The
        // Draft tab strip fixed the identical hazard the same way (5.5 review);
        // the scene-scoped clock drops the call on shutdown, so nothing leaks.
        this.time.delayedCall(0, () => this.renderTactics());
      });
    this.tacticEls.push(bar, barLabel);

    // The enemy line is FIXED just under the bar — it never moves when the
    // dropdown opens (the two tactics stay paired for the FR6 read).
    const enemyLabel = crispText(this, BASE_WIDTH / 2, L.enemyCenterY, `Enemy — ${TACTIC_DISPLAY_NAME[setup.tactics.B]}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: PALETTE.enemyText,
    }).setOrigin(0.5);
    this.tacticEls.push(enemyLabel);

    if (this.pickerOpen) {
      // Options drop into the empty band BELOW both fixed lines (not between
      // them), at high depth so they sit above anything underneath.
      //
      // Chrome treatment (story 5.2 review, Danilo's call — option b): the OPEN
      // menu is ONE gold-framed surface (`addFramedPanel`) with flat rows
      // inside, rather than ornate mini-buttons. A menu row is not a button (the
      // HistoryScene not-replayable marker sets the precedent for deliberately
      // non-button chrome).
      //
      // Story 5.8 (AC3): the rows meet FR30's 44px floor at last — as a 2×2
      // GRID, because four 44px rows stacked need 188px and the band above
      // Fight gives ~150. The open panel is wider than the bar so the longest
      // tactic name keeps its margin at 12px. Geometry + the clamp are pinned
      // in battle-view.test.ts.
      this.tacticEls.push(addFramedPanel(this, L.panel.x, L.panel.y, L.panel.w, L.panel.h, { origin: [0, 0] }).setDepth(99));
      ALL_TACTICS.forEach((t, i) => {
        const isSel = t === setup.tactics.A;
        const cell = L.cells[i]!;
        // Selected = the gold plate; unselected cells show the panel's own body
        // (no per-cell stroke — a dark-gold border on a bright-gold fill was the
        // gold-on-gold trap flagged in review).
        const row = this.add
          .rectangle(cell.x, cell.y, cell.w, cell.h, isSel ? PALETTE.buttonFillEnabled : PALETTE.cardFill, isSel ? 1 : 0.001)
          .setOrigin(0, 0)
          .setDepth(100);
        const label = crispText(this, cell.x + cell.w / 2, cell.y + cell.h / 2, TACTIC_DISPLAY_NAME[t], {
          fontFamily: 'Arial',
          fontSize: '12px',
          // Ink on the gold selected row (story 5.2 — bone-on-gold is the contrast trap).
          color: isSel ? PALETTE.buttonTextOnGold : PALETTE.bodyText,
        })
          .setOrigin(0.5)
          .setDepth(101);
        // Same down→up pair as the bar (story 5.8) — and it matters more here:
        // a stray release must never silently change the tactic the battle
        // resolves with.
        let rowPressed = false;
        row
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            rowPressed = true;
          })
          .on('pointerout', () => {
            rowPressed = false;
          })
          .on('pointerup', () => {
            if (!rowPressed) return;
            rowPressed = false;
            this.flow.setTactic(t); // AD-13; post-commit this invalidates the cached log so Fight! re-resolves (story 4.13)
            this.pickerOpen = false;
            // One tick, same reason as the bar: this row is in `tacticEls`.
            this.time.delayedCall(0, () => this.renderTactics());
          });
        this.tacticEls.push(row, label);
      });
    }
  }

  /**
   * Draws one unit standing on its iso tile (story 2.2): the billboard sprite,
   * the soldier's NAME, and the shared element dot — matching the Battle
   * scene's unit treatment, so Reveal → Battle is the same stage. Side identity
   * lives in the tile color + text color + board position (the non-color
   * anchor); the 2.1 card wash is retired here.
   *
   * Story 4.2 (FR37): Reveal is a NAME surface. Story 5.8 (AC2) retired the
   * 3-letter class CODE from both boards — the PO's call after story 4.0 made
   * the sprites crisp enough to identify a class ("we can identify the class by
   * the sprite. So we can remove them", 2026-07-17), superseding the spine's
   * "the board keeps codes". The name stays, and keeps the code's FR39f stroke
   * treatment (`unitCodeStyle`) so it still survives the tile fill — it is now
   * that token's ONE consumer.
   *
   * Story 5.8: takes the setup's OWN data rather than a resolved
   * `UnitSnapshot` — the caller walks `armies`/`placements`/`leaders`, so this
   * scene no longer needs a battle to be resolved before it can draw a board
   * (AC1/AD-13). `isLeader` arrives decided: the crown is an army-INDEX match
   * (`i === leaders[side]`), never a reconstructed `side:index` string.
   */
  private drawUnit(side: Side, unit: Unit, placement: Placement, isLeader: boolean) {
    const { x, y } = unitTileCenter(side, placement, DEFAULT_ORIENTATION, ISO_BOARD_REVEAL);
    addUnitSprite(this, x, y + REVEAL_SPRITE_OFFSET_Y, unit.class, REVEAL_SPRITE_SIZE).setDepth(y); // grew with the 5.3 tiles (56→70)
    // FR6 leader disclosure (story 4.5): the ♛ crown sits ON the leader's sprite
    // (a board marker, "the read is the payoff" — not a separate text line like
    // the tactic labels). Gold (PALETTE.title = {colors.gold}), never a side color.
    if (isLeader) {
      crispText(this, x, y - 30, LEADER_CROWN_GLYPH, { fontFamily: 'Arial', fontSize: '16px', color: PALETTE.title })
        .setOrigin(0.5)
        .setDepth(y + 1);
    }
    if (unit.name) {
      // The name rises into the slot the retired code held — but only as far as
      // the sprite allows: a LOOMED monster reaches lower than a small, so the
      // offset is derived per class (`revealNameOffsetY`, pinned for both spans).
      crispText(this, x, y + revealNameOffsetY(unit.class), unit.name, { ...unitCodeStyle(side), fontFamily: 'Arial', fontSize: '10px' })
        .setOrigin(0.5)
        .setDepth(y);
    }
    addElementBadge(this, x + 16, y - 26, unit.element).setDepth(y);
  }
}
