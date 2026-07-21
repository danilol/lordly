import { GameObjects, Input, Scene, Time } from 'phaser';
import { ALL_COLS, ALL_ROWS, BALANCE, legalAnchors } from '@lordly/engine';
import type { Placement, UnitClass } from '@lordly/engine';
import {
  BASE_WIDTH,
  ENEMY_ARMY_LABEL,
  PALETTE,
  placementSubmitHint,
  PLACEMENT_CROWN_HINT,
  PLACEMENT_SUBMIT_LABEL,
  PLACEMENT_TITLE,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
  LEADER_CROWN_GLYPH,
} from '../config/constants';
import { applyHiDpiCamera, addElementBadge, addHomeBack, addUnitSprite, crispText } from '../config/ui';
import { attachPerfSampler } from '../config/perf';
import { bannedCells, placedCount, rowActionCounts, sameCell, toAnchor } from '../flow/placement';
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
  /**
   * Pending single-tap crown-toggle timers, keyed by unit index (review fix,
   * story 4.5): the crown-toggle is DEFERRED past `DOUBLE_TAP_MS` so a genuine
   * double-tap-remove — which arrives here as tap 1 too — never also mutates
   * the crown as an unwanted side effect before tap 2 confirms the removal.
   * Reset every create() (singleton scenes).
   */
  private pendingCrownTimers = new Map<number, Time.TimerEvent>();
  /** Transient rejection/error toast (device-reported: illegal moves and a failed commit used to fail silently to the console). Reset every create() (singleton scenes). */
  private toast?: GameObjects.Text;
  /** FR39c per-row action-count badges — live only while a unit is dragged. Reset every create() (singleton scenes). */
  private rowBadges: GameObjects.Text[] = [];

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
    crispText(
      this,
      BASE_WIDTH / 2,
      54,
      'Drag a unit onto the grid, or double-tap it to place it. Tap a placed unit to crown your leader (♛). Front row faces the enemy (top).',
      {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: PALETTE.mutedText,
        align: 'center',
        wordWrap: { width: BASE_WIDTH - 24 },
      },
    ).setOrigin(0.5);

    // FR6 groundwork + first-time legibility: mark the enemy-facing side (top
    // of the grid) so a new player knows where the opponent will appear.
    const gridWidth = 3 * CELL + 2 * GAP;
    crispText(this, BASE_WIDTH / 2, 116, ENEMY_ARMY_LABEL, { fontFamily: 'Arial', fontSize: '8px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.add.rectangle(BASE_WIDTH / 2, GRID_TOP - 8, gridWidth, 3, PALETTE.enemyLine).setOrigin(0.5);

    this.lastTapIndex = -1; // reset double-tap state (singleton scenes carry stale fields otherwise)
    this.lastTapAt = 0;
    for (const t of this.pendingCrownTimers.values()) t.remove(); // review fix: no stale crown-toggle fires into a fresh match
    this.pendingCrownTimers.clear();
    this.toast = undefined;
    this.rowBadges = []; // the objects died with the previous scene shutdown; the ARRAY must not carry stale refs
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
   * The first LEGAL grid cell for `cls` in reading order — front row
   * left→right, then mid, then back (Danilo: "top row first, first
   * available slot"), via the engine's `legalAnchors` (AD-14, story 4.8 —
   * the SAME predicate `validateMatchSetup` enforces, so this can never
   * suggest a cell the engine would reject, including a cell a monster
   * reserves by its king-move adjacency). Returns `null` when no legal cell
   * remains. Drives double-tap auto-placement.
   */
  private firstFreeCell(cls: UnitClass): Placement | null {
    const state = this.flow.getState();
    const existing = state.playerArmy.reduce<{ class: UnitClass; placement: Placement }[]>((acc, unit, i) => {
      const cell = state.playerPlacements[i];
      if (cell) acc.push({ class: unit.class, placement: toAnchor(unit.class, cell) }); // DISPLAY cell → engine ANCHOR (device-reported)
      return acc;
    }, []);
    return legalAnchors(cls, existing)[0] ?? null;
  }

  /** A transient on-screen message (device-reported: illegal moves and a failed commit used to fail silently to the console, with no player-facing feedback at all). */
  private flashMessage(text: string) {
    this.toast?.destroy();
    const msg = crispText(this, BASE_WIDTH / 2, 132, text, {
      fontFamily: 'Arial',
      fontSize: `${MIN_FONT_PX}px`,
      color: PALETTE.title,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    })
      .setOrigin(0.5)
      .setDepth(200);
    this.toast = msg;
    this.tweens.add({ targets: msg, alpha: 0, delay: 1400, duration: 500, onComplete: () => msg.destroy() });
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
    this.input.on('dragstart', (_pointer: Input.Pointer, obj: GameObjects.Container) => {
      this.lastTapIndex = -1;
      this.lastTapAt = 0;
      // FR39c (story 4.11): while THIS unit is in the air, each grid row shows
      // its action count for that row — positioning is an informed choice.
      // Drag-only trigger (recorded choice): tap means crown, and the
      // double-tap auto-place lands before a read would matter.
      const unitIndex = obj.getData('unitIndex') as number;
      const cls = this.flow.getState().playerArmy[unitIndex]?.class;
      if (cls !== undefined) this.showRowCounts(cls);
    });
    this.input.on('drag', (_pointer: Input.Pointer, obj: GameObjects.Container, dragX: number, dragY: number) => {
      obj.x = dragX;
      obj.y = dragY;
    });
    this.input.on('drop', (_pointer: Input.Pointer, obj: GameObjects.Container, zone: GameObjects.Zone) => {
      // The FR39c row counts leave with the drag — cleared HERE, not only in
      // dragend: `redraw()` below destroys the dragged container, so Phaser
      // never fires dragend for it (device-reported 2026-07-20: the badges
      // lingered after every successful placement).
      this.clearRowCounts();
      const unitIndex = obj.getData('unitIndex') as number;
      const cell = zone.getData('cell') as Placement;
      this.flow.placeUnit(unitIndex, cell); // footprint-legal by construction (AD-14) — an illegal drop is silently rejected, not accepted
      if (!sameCell(this.flow.getState().playerPlacements[unitIndex] ?? null, cell)) {
        this.flashMessage("Can't place there — check monster spacing or its footprint");
      }
      this.redraw();
    });
    // No valid drop target → the unit snaps back to its model position (AC3: no drop is ever lost).
    // The badges clear here too — this is the only end-of-drag signal for a MISSED drop.
    this.input.on('dragend', (_pointer: Input.Pointer, _obj: GameObjects.Container, dropped: boolean) => {
      this.clearRowCounts();
      if (!dropped) this.redraw();
    });
  }

  /** FR39c (story 4.11): a "2×" badge at the left edge of each grid row — the dragged unit's per-row action count (the `rowActionCounts` pure seam). */
  private showRowCounts(cls: UnitClass) {
    this.clearRowCounts();
    const counts = rowActionCounts(cls);
    ALL_ROWS.forEach((row, r) => {
      const y = GRID_TOP + r * (CELL + GAP) + CELL / 2;
      this.rowBadges.push(
        // Muted, informational tone — not gold (UX-DR2 reserves gold for attention); 12px ≥ the MIN_FONT_PX floor.
        crispText(this, this.gridLeft - 8, y, `${counts[row]}×`, {
          fontFamily: 'Arial',
          fontSize: '12px',
          fontStyle: 'bold',
          color: PALETTE.mutedText,
        }).setOrigin(1, 0.5),
      );
    });
  }

  private clearRowCounts() {
    for (const badge of this.rowBadges) badge.destroy();
    this.rowBadges = [];
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
      const children: GameObjects.GameObject[] = [body, sprite, code, soldierName, badge];
      // FR35 crown (story 4.5): the ♛ insignia on the crowned card, top-left in
      // gold (PALETTE.title = DESIGN's {colors.gold} "title accent" — gold marks
      // the leader, never the side, which stays the border/wash blue).
      if (state.playerLeader === i) {
        children.push(crispText(this, -24, -24, LEADER_CROWN_GLYPH, { fontFamily: 'Arial', fontSize: '16px', color: PALETTE.title }).setOrigin(0.5));
      }
      const c = this.add.container(x, y, children);
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
        if (doubleTap) {
          // The confirmed second tap (review fix): cancel tap 1's still-pending
          // crown-toggle so a double-tap-remove never ALSO mutates the crown as
          // an unwanted side effect before this removal fires.
          this.pendingCrownTimers.get(i)?.remove();
          this.pendingCrownTimers.delete(i);
          if (this.flow.getState().playerPlacements[i] !== null) {
            this.flow.unplaceUnit(i); // placed → back to the tray
            this.redraw();
          } else {
            const cell = this.firstFreeCell(unit.class);
            if (cell) {
              this.flow.placeUnit(i, cell); // in tray → first LEGAL cell for this class
              this.redraw();
            } else {
              this.flashMessage('No legal cell left for this unit');
            }
          }
          return;
        }
        // A tray unit can't be crowned (setLeader throws) — stays a true no-op.
        if (this.flow.getState().playerPlacements[i] === null) return;
        // Single tap on a PLACED unit crowns/uncrowns it (story 4.5, FR35) —
        // but DEFERRED past DOUBLE_TAP_MS (review fix): tap 1 of a genuine
        // double-tap-remove lands here too, and must not crown/uncrown the
        // unit before tap 2 arrives to confirm it as a removal instead. Only
        // fires if no matching second tap on this same unit cancels it first.
        // Tap-to-toggle + move-crown behavior lives in flow.setLeader (AD-13).
        this.pendingCrownTimers.get(i)?.remove();
        this.pendingCrownTimers.set(
          i,
          this.time.delayedCall(DOUBLE_TAP_MS, () => {
            this.pendingCrownTimers.delete(i);
            try {
              this.flow.setLeader(i);
            } catch {
              this.flashMessage('A monster cannot be crowned leader');
              return;
            }
            this.redraw();
          }),
        );
      });
      this.dynamic.push(c);
    });

    // (Story 4.8 device revision, 2026-07-20: a monster is now a SINGLE-cell
    // unit — no more "GOL body" second cell to render. It just reserves its 8
    // king-move neighbors, shown as "blocked" cells below.)

    // Every EMPTY cell that's actually illegal — banned by adjacency to a
    // monster, not occupied by one (device-reported: these read as ordinary
    // open cells with no visible reason a drop there fails; e.g. two Golems
    // flanking the center column both ban mid/center AND back/center, and
    // neither showed anything). Distinct RED tint from the blue "body"
    // marker above — this cell isn't part of any one monster's body, it's
    // just too close to reach.
    const classes = state.playerArmy.map((u) => u.class);
    for (const cellKey of bannedCells(state.playerPlacements, classes)) {
      const [row, col] = cellKey.split('/') as [Placement['row'], Placement['col']];
      const { x, y } = this.cellCenter({ row, col });
      this.dynamic.push(
        this.add.rectangle(x, y, CELL, CELL, PALETTE.enemyLine, 0.12).setStrokeStyle(2, PALETTE.enemyLine),
        crispText(this, x, y, 'blocked', { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.enemyText }).setOrigin(0.5),
      );
    }

    // Tray labels for empty slots (so the tray reads as "drag from here").
    state.playerArmy.forEach((_unit, i) => {
      if (state.playerPlacements[i] === null) return;
      // unit is on the grid → its tray slot is empty; mark it faintly.
      const { x, y } = this.trayCenter(i);
      this.dynamic.push(this.add.rectangle(x, y, 64, 64, PALETTE.gridCellFill).setStrokeStyle(1, PALETTE.gridCellStroke).setDepth(-1));
    });

    // Story 4.13: the army-tactic picker moved to the Reveal screen — Placement
    // now owns only the board + the leader crown. The tactic is chosen at the
    // face-off (RevealScene), so nothing tactic-related is drawn here.

    const placed = placedCount(state.playerPlacements);
    // Ready gates on full placement AND a crown (story 4.5, FR35 — exactly one
    // leader is required, same footing as full placement).
    const ready = placed === state.playerArmy.length && state.playerArmy.length > 0 && state.playerLeader !== null;
    const btnY = 596;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, 200, 50, ready ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, ready ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    // When everything is placed the last gate is the crown, so the hint switches
    // from "place all N units" to the crown prompt (story 4.5) instead of
    // misleadingly repeating the placement ask.
    const fullyPlaced = placed === state.playerArmy.length && state.playerArmy.length > 0;
    const hint = fullyPlaced ? PLACEMENT_CROWN_HINT : placementSubmitHint(state.playerArmy.length);
    const label = crispText(this, BASE_WIDTH / 2, btnY, ready ? PLACEMENT_SUBMIT_LABEL : hint, {
      fontFamily: 'Arial',
      fontSize: ready ? '18px' : '13px',
      color: ready ? PALETTE.buttonText : PALETTE.buttonTextDisabled,
    }).setOrigin(0.5);
    this.dynamic.push(btn, label);
    if (ready) {
      btn.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        // Assembles + AI commit + validate (AD-13). Placement's own model
        // already rejects an illegal drop as it happens, so this should
        // never throw in normal play — but device-reported: it used to fail
        // ONLY to the console with no on-screen feedback and a stuck Ready
        // button, so this stays defended regardless (spine errors convention:
        // never a silent failure the player can't see or act on).
        try {
          this.flow.commit();
        } catch (e) {
          this.flashMessage(e instanceof Error ? e.message : 'Could not start the match — check your placement');
          return;
        }
        this.scene.start('Reveal', { flow: this.flow });
      });
    }
  }
}
