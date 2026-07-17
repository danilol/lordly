import { GameObjects, Input, Scene } from 'phaser';
import { ALL_COLS, ALL_ROWS } from '@lordly/engine';
import type { Placement } from '@lordly/engine';
import {
  BASE_WIDTH,
  ENEMY_ARMY_LABEL,
  PALETTE,
  PLACEMENT_SUBMIT_HINT,
  PLACEMENT_SUBMIT_LABEL,
  PLACEMENT_TITLE,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
} from '../config/constants';
import { applyHiDpiCamera, addElementBadge, addHomeBack, addUnitSprite, crispText } from '../config/ui';
import { attachPerfSampler } from '../config/perf';
import { placedCount } from '../flow/placement';
import type { MatchFlow } from '../flow/MatchFlow';

const CELL = 84;
const GAP = 6;
const GRID_TOP = 150;
const TRAY_Y = 486;

/**
 * Placement scene (FR4/FR30): the player's own 3×3 grid (owner-local — AD-11:
 * rows front/mid/back top→bottom, cols left/center/right) plus a tray of
 * unplaced units, with touch drag-and-drop. The pure `placement` model is the
 * source of truth (via `MatchFlow`); sprite positions are just its projection,
 * re-derived after every drop. Submit is gated on all 3 placed (AC4), and
 * commits the match through `MatchFlow` (the sole AI caller — AD-13).
 */
export class PlacementScene extends Scene {
  private flow!: MatchFlow;
  private gridLeft = 0;
  /** Unit containers + submit button — rebuilt each redraw; grid backdrop and drop zones are built once. */
  private dynamic: GameObjects.GameObject[] = [];

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
    crispText(this, BASE_WIDTH / 2, 54, 'Drag your units onto the grid. Front row faces the enemy (top).', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);

    // FR6 groundwork + first-time legibility: mark the enemy-facing side (top
    // of the grid) so a new player knows where the opponent will appear.
    const gridWidth = 3 * CELL + 2 * GAP;
    crispText(this, BASE_WIDTH / 2, 114, ENEMY_ARMY_LABEL, { fontFamily: 'Arial Black', fontSize: '13px', color: PALETTE.enemyText }).setOrigin(0.5);
    this.add.rectangle(BASE_WIDTH / 2, GRID_TOP - 8, gridWidth, 3, PALETTE.enemyLine).setOrigin(0.5);

    this.buildGrid();
    this.wireDragAndDrop();
    this.redraw();
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

  /** Tray slot center for unit `index` (its home when unplaced — predictable return spot). */
  private trayCenter(index: number): { x: number; y: number } {
    const slotW = 96;
    const gap = 12;
    const startX = (BASE_WIDTH - (3 * slotW + 2 * gap)) / 2;
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
      // The card stays a Container so the drag contract (setSize hit area,
      // unitIndex data, setDraggable) is untouched by the sprite swap.
      const body = this.add.rectangle(0, 0, 72, 60, PALETTE.playerLine, 0.15).setStrokeStyle(2, PALETTE.playerLine);
      const sprite = addUnitSprite(this, -17, 2, unit.class, 32);
      const name = crispText(this, 14, -12, CLASS_ABBREVIATIONS[unit.class], {
        fontFamily: 'Arial Black',
        fontSize: `${CARD_CLASS_FONT_PX}px`,
        color: PALETTE.playerText,
      }).setOrigin(0.5);
      const el = crispText(this, 14, 6, unit.element, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.bodyText }).setOrigin(0.5);
      const badge = addElementBadge(this, 26, -20, unit.element);
      const c = this.add.container(x, y, [body, sprite, name, el, badge]);
      c.setSize(72, 60); // sets the centered rectangular hit area for input
      c.setData('unitIndex', i);
      c.setInteractive({ useHandCursor: true });
      this.input.setDraggable(c);
      this.dynamic.push(c);
    });

    // Tray labels for empty slots (so the tray reads as "drag from here").
    state.playerArmy.forEach((_unit, i) => {
      if (state.playerPlacements[i] === null) return;
      // unit is on the grid → its tray slot is empty; mark it faintly.
      const { x, y } = this.trayCenter(i);
      this.dynamic.push(this.add.rectangle(x, y, 96, 60, PALETTE.gridCellFill).setStrokeStyle(1, PALETTE.gridCellStroke).setDepth(-1));
    });

    const placed = placedCount(state.playerPlacements);
    const ready = placed === state.playerArmy.length && state.playerArmy.length > 0;
    const btnY = 596;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, 200, 50, ready ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, ready ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    const label = crispText(this, BASE_WIDTH / 2, btnY, ready ? PLACEMENT_SUBMIT_LABEL : PLACEMENT_SUBMIT_HINT, {
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
}
