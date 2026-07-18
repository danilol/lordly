import { GameObjects, Input, Scene } from 'phaser';
import { ALL_COLS, ALL_ROWS, ALL_TACTICS, BALANCE } from '@lordly/engine';
import type { Placement, Tactic } from '@lordly/engine';
import {
  BASE_WIDTH,
  ENEMY_ARMY_LABEL,
  PALETTE,
  placementSubmitHint,
  PLACEMENT_SUBMIT_LABEL,
  PLACEMENT_TITLE,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
  TACTIC_DISPLAY_NAME,
} from '../config/constants';
import { applyHiDpiCamera, addElementBadge, addHomeBack, addUnitSprite, crispText } from '../config/ui';
import { attachPerfSampler } from '../config/perf';
import { placedCount } from '../flow/placement';
import type { MatchFlow } from '../flow/MatchFlow';

const CELL = 84;
const GAP = 6;
const GRID_TOP = 150;
const TRAY_Y = 486;
/** Two taps on the same unit within this window = a double-tap (auto-place shortcut). */
const DOUBLE_TAP_MS = 300;
/**
 * Shared drag-vs-tap boundary (review fix): Phaser's `dragDistanceThreshold`
 * and the tap classifier below must agree, or a pointer move in the gap
 * between two different cutoffs starts no drag AND is rejected as a tap —
 * the gesture silently does nothing.
 */
const TAP_DISTANCE_PX = 10;

/**
 * Placement scene (FR4/FR30): the player's own 3×3 grid (owner-local — AD-11:
 * rows front/mid/back top→bottom, cols left/center/right) plus a tray of
 * unplaced units, with touch drag-and-drop. The pure `placement` model is the
 * source of truth (via `MatchFlow`); sprite positions are just its projection,
 * re-derived after every drop. Submit is gated on ALL units placed (AC4), and
 * commits the match through `MatchFlow` (the sole AI caller — AD-13).
 */
export class PlacementScene extends Scene {
  private flow!: MatchFlow;
  private gridLeft = 0;
  /** Unit containers + submit button — rebuilt each redraw; grid backdrop and drop zones are built once. */
  private dynamic: GameObjects.GameObject[] = [];
  /** Double-tap-to-place tracking (a second tap on the same unit auto-places it). Reset every create() (singleton scenes). */
  private lastTapIndex = -1;
  private lastTapAt = 0;
  /** Whether the tactic dropdown is expanded. Reset every create() (singleton scenes). */
  private pickerOpen = false;

  constructor() {
    super('Placement');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    // Story 3.4 (NFR1): no-op unless `?perf=1` — per-frame fps sampling.
    attachPerfSampler(this);

    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);
    addHomeBack(this);
    this.gridLeft = (BASE_WIDTH - (3 * CELL + 2 * GAP)) / 2;

    crispText(this, BASE_WIDTH / 2, 28, PLACEMENT_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, 54, 'Drag a unit onto the grid, or double-tap it to place it. Front row faces the enemy (top).', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);

    // FR6 groundwork + first-time legibility: mark the enemy-facing side (top
    // of the grid) so a new player knows where the opponent will appear.
    const gridWidth = 3 * CELL + 2 * GAP;
    crispText(this, BASE_WIDTH / 2, 116, ENEMY_ARMY_LABEL, { fontFamily: 'Arial', fontSize: '8px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.add.rectangle(BASE_WIDTH / 2, GRID_TOP - 8, gridWidth, 3, PALETTE.enemyLine).setOrigin(0.5);

    this.lastTapIndex = -1; // reset double-tap state (singleton scenes carry stale fields otherwise)
    this.lastTapAt = 0;
    this.pickerOpen = false;
    // A draggable object starts a drag on the SLIGHTEST move by default (threshold
    // 0), which swallowed the tap events double-tap-to-place needs. Require
    // TAP_DISTANCE_PX of movement before a drag begins, so a still tap stays a
    // clean pointerup. Must match the tap classifier below exactly (review fix).
    this.input.dragDistanceThreshold = TAP_DISTANCE_PX;
    this.buildGrid();
    this.wireDragAndDrop();
    this.redraw();
  }

  /**
   * The first empty grid cell in reading order — front row left→right, then
   * mid, then back (Danilo: "top row first, first available slot"). Returns
   * `null` when the board is full. Drives double-tap auto-placement.
   */
  private firstFreeCell(): Placement | null {
    const taken = new Set(
      this.flow
        .getState()
        .playerPlacements.filter((p): p is Placement => p !== null)
        .map((p) => `${p.row}/${p.col}`),
    );
    for (const row of ALL_ROWS) {
      for (const col of ALL_COLS) {
        if (!taken.has(`${row}/${col}`)) return { row, col };
      }
    }
    return null;
  }

  /** The static 3×3 grid: a labeled backdrop cell + a drop zone per square (built once). */
  private buildGrid() {
    ALL_ROWS.forEach((row) => {
      ALL_COLS.forEach((col) => {
        const { x, y } = this.cellCenter({ row, col });
        this.add.rectangle(x, y, CELL, CELL, PALETTE.gridCellFill).setStrokeStyle(1, PALETTE.gridCellStroke);
        crispText(this, x, y + CELL / 2 - 9, `${row}/${col}`, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.mutedText }).setOrigin(0.5);
        const zone = this.add.zone(x, y, CELL, CELL).setRectangleDropZone(CELL, CELL);
        zone.setData('cell', { row, col } satisfies Placement);
      });
    });
  }

  private wireDragAndDrop() {
    // A real drag starting means this pointer gesture is NOT a tap — clear the
    // double-tap tracking so a stale pre-drag tap can never combine with a
    // post-drag tap into an unintended double-tap (review fix).
    this.input.on('dragstart', () => {
      this.lastTapIndex = -1;
      this.lastTapAt = 0;
    });
    this.input.on('drag', (_pointer: Input.Pointer, obj: GameObjects.Container, dragX: number, dragY: number) => {
      obj.x = dragX;
      obj.y = dragY;
    });
    this.input.on('drop', (_pointer: Input.Pointer, obj: GameObjects.Container, zone: GameObjects.Zone) => {
      const unitIndex = obj.getData('unitIndex') as number;
      const cell = zone.getData('cell') as Placement;
      this.flow.placeUnit(unitIndex, cell); // pure model swaps/moves; never illegal
      this.redraw();
    });
    // No valid drop target → the unit snaps back to its model position (AC3: no drop is ever lost).
    this.input.on('dragend', (_pointer: Input.Pointer, _obj: GameObjects.Container, dropped: boolean) => {
      if (!dropped) this.redraw();
    });
  }

  /** Owner-local cell → screen center. */
  private cellCenter(cell: Placement): { x: number; y: number } {
    const r = ALL_ROWS.indexOf(cell.row);
    const c = ALL_COLS.indexOf(cell.col);
    return { x: this.gridLeft + c * (CELL + GAP) + CELL / 2, y: GRID_TOP + r * (CELL + GAP) + CELL / 2 };
  }

  /**
   * Tray slot center for unit `index` (its home when unplaced — predictable
   * return spot). Budget-derived (story 4.2 — the hardcoded 3 died with the
   * era): five 64px slots + 8px gaps = 352px inside the 360 base.
   */
  private trayCenter(index: number): { x: number; y: number } {
    const slotW = 64;
    const gap = 8;
    const startX = (BASE_WIDTH - (BALANCE.slotBudget * slotW + (BALANCE.slotBudget - 1) * gap)) / 2;
    return { x: startX + index * (slotW + gap) + slotW / 2, y: TRAY_Y };
  }

  /** Rebuilds unit containers (at their model positions) and the submit button. */
  private redraw() {
    for (const obj of this.dynamic) obj.destroy();
    this.dynamic = [];

    const state = this.flow.getState();
    state.playerArmy.forEach((unit, i) => {
      const cell = state.playerPlacements[i] ?? null;
      const { x, y } = cell ? this.cellCenter(cell) : this.trayCenter(i);
      // Unit-card (story 2.1, DESIGN.md): YOUR units read side-blue — border +
      // ~15% wash — with the real class sprite; element stays the shared dot.
      // Compact 64px card (story 4.2: five slots on a 360 base): sprite over
      // code over the soldier NAME (FR37/dossier §7 — name under the code).
      // The card stays a Container so the drag contract (setSize hit area,
      // unitIndex data, setDraggable) is untouched by the layout change.
      const body = this.add.rectangle(0, 0, 64, 64, PALETTE.playerLine, 0.15).setStrokeStyle(2, PALETTE.playerLine);
      const sprite = addUnitSprite(this, 0, -12, unit.class, 28);
      const code = crispText(this, 0, 10, CLASS_ABBREVIATIONS[unit.class], {
        fontFamily: 'Arial Black',
        fontSize: `${CARD_CLASS_FONT_PX}px`,
        color: PALETTE.playerText,
      }).setOrigin(0.5);
      const soldierName = crispText(this, 0, 24, unit.name, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.bodyText }).setOrigin(0.5);
      const badge = addElementBadge(this, 24, -24, unit.element);
      const c = this.add.container(x, y, [body, sprite, code, soldierName, badge]);
      c.setSize(64, 64); // sets the centered rectangular hit area for input
      c.setData('unitIndex', i);
      c.setInteractive({ useHandCursor: true });
      this.input.setDraggable(c);
      // Double-tap toggles a unit: an UNPLACED one drops into the first free
      // cell (top row first); a PLACED one goes back to the tray (Danilo). A
      // drag also ends in pointerup, so ignore taps that moved the pointer —
      // only a still tap counts. Must match TAP_DISTANCE_PX (the drag-start
      // threshold) exactly — a gap between the two silently eats the gesture.
      c.on('pointerup', (pointer: Input.Pointer) => {
        if (pointer.getDistance() > TAP_DISTANCE_PX) return; // it was a drag, not a tap
        const now = this.time.now;
        const doubleTap = this.lastTapIndex === i && now - this.lastTapAt < DOUBLE_TAP_MS;
        this.lastTapAt = now;
        this.lastTapIndex = doubleTap ? -1 : i; // consume on double so a triple tap isn't two actions
        if (!doubleTap) return;
        if (this.flow.getState().playerPlacements[i] !== null) {
          this.flow.unplaceUnit(i); // placed → back to the tray
          this.redraw();
        } else {
          const cell = this.firstFreeCell();
          if (cell) {
            this.flow.placeUnit(i, cell); // in tray → first free cell
            this.redraw();
          }
        }
      });
      this.dynamic.push(c);
    });

    // Tray labels for empty slots (so the tray reads as "drag from here").
    state.playerArmy.forEach((_unit, i) => {
      if (state.playerPlacements[i] === null) return;
      // unit is on the grid → its tray slot is empty; mark it faintly.
      const { x, y } = this.trayCenter(i);
      this.dynamic.push(this.add.rectangle(x, y, 64, 64, PALETTE.gridCellFill).setStrokeStyle(1, PALETTE.gridCellStroke).setDepth(-1));
    });

    this.buildTacticPicker(state.playerTactic);

    const placed = placedCount(state.playerPlacements);
    const ready = placed === state.playerArmy.length && state.playerArmy.length > 0;
    const btnY = 596;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, 200, 50, ready ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, ready ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    const label = crispText(this, BASE_WIDTH / 2, btnY, ready ? PLACEMENT_SUBMIT_LABEL : placementSubmitHint(state.playerArmy.length), {
      fontFamily: 'Arial',
      fontSize: ready ? '18px' : '13px',
      color: ready ? PALETTE.buttonText : PALETTE.buttonTextDisabled,
    }).setOrigin(0.5);
    this.dynamic.push(btn, label);
    if (ready) {
      btn.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.flow.commit(); // assembles + AI commit + validate (AD-13); throws only on an assembly bug
        this.scene.start('Reveal', { flow: this.flow });
      });
    }
  }

  /**
   * The FR34 army-tactic picker (story 4.4): a COMPACT dropdown (Danilo's
   * request — the button row took too much space). Collapsed, it is a single
   * slim bar showing the current tactic; tapping expands a small option list
   * that overlays the tray (transient, high depth). Defaults to Autonomous.
   * `Attack Leader` is DISABLED (muted, no handler) until story 4.5 ships leader
   * designation (D-3b). Hidden from the enemy until reveal (FR5). Player-only
   * write path is `flow.setTactic` (AD-13).
   *
   * RECORDED DEVIATION (review, 2026-07-19): the bar and every option row are
   * 24px tall — under UX-DR4's 44px tap-target floor. This is deliberate:
   * Danilo asked twice to shrink the picker, then confirmed the final size on
   * his own device ("it works great now"). Do NOT resize this back to 44px to
   * "fix" the spec gap — that would reverse a tested product decision.
   */
  private buildTacticPicker(selected: Tactic) {
    // Centered in the clear band between the board (ends ~y372) and the tray
    // (starts y454), so it sits in a proper place — not floating, not over the
    // board. The option list drops DOWN over the tray when open (transient).
    const bw = 200;
    const bh = 24;
    const bx = (BASE_WIDTH - bw) / 2;
    const by = 416;
    const bar = this.add.rectangle(bx, by, bw, bh, PALETTE.buttonFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.buttonStroke);
    this.dynamic.push(
      bar,
      crispText(this, BASE_WIDTH / 2, by + bh / 2, `Tactic: ${TACTIC_DISPLAY_NAME[selected]}  ${this.pickerOpen ? '▲' : '▼'}`, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: PALETTE.bodyText,
      }).setOrigin(0.5),
    );
    bar.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.pickerOpen = !this.pickerOpen;
      this.redraw();
    });
    if (!this.pickerOpen) return;
    // Expanded option list — drops down over the tray (high depth), closes on pick.
    ALL_TACTICS.forEach((t, i) => {
      const disabled = t === 'leader'; // 4.4→4.5 window (D-3b)
      const isSel = t === selected;
      const oy = by + bh + i * bh;
      const row = this.add
        .rectangle(bx, oy, bw, bh, isSel ? PALETTE.buttonFillEnabled : PALETTE.cardFill)
        .setOrigin(0, 0)
        .setStrokeStyle(1, PALETTE.buttonStroke)
        .setDepth(100);
      const color = disabled ? PALETTE.buttonTextDisabled : isSel ? PALETTE.buttonText : PALETTE.bodyText;
      const label = crispText(this, BASE_WIDTH / 2, oy + bh / 2, TACTIC_DISPLAY_NAME[t], { fontFamily: 'Arial', fontSize: '11px', color })
        .setOrigin(0.5)
        .setDepth(101);
      this.dynamic.push(row, label);
      if (!disabled) {
        row.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.flow.setTactic(t); // AD-13: the scene never mutates state directly
          this.pickerOpen = false;
          this.redraw();
        });
      }
    });
  }
}
