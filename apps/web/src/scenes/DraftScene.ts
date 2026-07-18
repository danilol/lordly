import { GameObjects, Scene } from 'phaser';
import { ALL_CLASSES, BALANCE, slotTotal } from '@lordly/engine';
import type { Role, UnitClass } from '@lordly/engine';
import {
  BASE_WIDTH,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
  CLASS_DISPLAY_NAME,
  DRAFT_CONTINUE_LABEL,
  draftHint,
  DRAFT_RULES_LABEL,
  DRAFT_TITLE,
  HOME_BACK_LABEL,
  MIN_FONT_PX,
  PALETTE,
} from '../config/constants';
import { canAddUnit, canContinue, classRulesCard } from '../flow/draftModel';
import type { MatchFlow } from '../flow/MatchFlow';
import { applyHiDpiCamera, addBackAffordance, addElementBadge, addUnitSprite, crispText } from '../config/ui';
import { attachPerfSampler } from '../config/perf';

/** Icon-grid layout (story 4.3 redesign): a compact tile per class — all classes on one screen, no scroll. */
const GRID = { cols: 4, tileW: 80, tileH: 62, gapX: 8, gapY: 6, startX: 8, startY: 88 };
/** The class-detail panel (below the grid) that fills in on selection. */
const DETAIL = { x: 8, y: 300, w: BASE_WIDTH - 16, h: 116 };

/**
 * Matchups are shown by DAMAGE TYPE, not by listing classes (Danilo's call —
 * "weak to magic/physical/projectiles" reads cleaner and stays short as the
 * roster grows). Each attacking role maps to the type it deals; Support/Control
 * never attack in a relation, so they carry no type. Derived, not hardcoded per
 * class: a class is weak to the types of the roles that beat it, strong vs the
 * types of the roles it beats.
 */
const ROLE_DAMAGE_TYPE: Partial<Record<Role, string>> = {
  vanguard: 'physical',
  skirmisher: 'physical',
  sniper: 'projectiles',
  artillery: 'magic',
};

/**
 * Draft scene (FR1/FR2/FR3). Story 4.3 redesign (Danilo's mock): the roster is
 * a compact ICON GRID — one small tile (sprite + name) per class, every class
 * visible at once, no scroll. Tapping a tile SELECTS it and fills a detail
 * panel below (role, behavior, matchups, action counts); an explicit **Add to
 * army** button drafts the selected class. The army tray + Continue sit below.
 * A thin renderer over `MatchFlow` + the pure `draftModel` — no match truth
 * (AD-5/AD-13); the dynamic parts re-render from `flow.getState()`.
 */
export class DraftScene extends Scene {
  private flow!: MatchFlow;
  /** The currently highlighted class in the grid — its detail shows in the panel. Reset every create() (singleton scenes). */
  private selected: UnitClass = ALL_CLASSES[0];
  /** Static grid tiles' geometry, for drawing the selection highlight. */
  private tiles: { cls: UnitClass; x: number; y: number }[] = [];
  /** Selection-dependent objects (highlight + detail panel + army tray + Continue), rebuilt on each redraw. */
  private dynamic: GameObjects.GameObject[] = [];

  constructor() {
    super('Draft');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    // Story 3.4 (NFR1): no-op unless `?perf=1`.
    attachPerfSampler(this);
    this.selected = ALL_CLASSES[0]; // reset: Phaser scenes are singletons
    this.dynamic = [];
    this.tiles = [];

    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);
    addBackAffordance(this, HOME_BACK_LABEL, () => this.scene.start('Home'));

    crispText(this, BASE_WIDTH / 2, 26, DRAFT_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, 50, draftHint(BALANCE.slotBudget), {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);

    // Rules spur (story 2.4, FR27): top-right. Help returns HERE with the same flow (the 1.8 pattern).
    const rules = crispText(this, BASE_WIDTH - 44, 22, DRAFT_RULES_LABEL, { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.add
      .rectangle(rules.x, rules.y, 72, 36, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Help', { from: 'Draft', flow: this.flow }));

    crispText(this, BASE_WIDTH / 2, 72, 'CHOOSE A CLASS', { fontFamily: 'Arial Black', fontSize: '13px', color: PALETTE.mutedText }).setOrigin(0.5);

    this.buildGrid();
    this.redraw();
  }

  /** The static class icon-grid: a tile per class, tapping SELECTS (does not draft). */
  private buildGrid() {
    ALL_CLASSES.forEach((cls, i) => {
      const x = GRID.startX + (i % GRID.cols) * (GRID.tileW + GRID.gapX);
      const y = GRID.startY + Math.floor(i / GRID.cols) * (GRID.tileH + GRID.gapY);
      this.tiles.push({ cls, x, y });
      this.add.rectangle(x, y, GRID.tileW, GRID.tileH, PALETTE.cardFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.cardStroke);
      addUnitSprite(this, x + GRID.tileW / 2, y + 22, cls, 28);
      crispText(this, x + GRID.tileW / 2, y + GRID.tileH - 12, CLASS_DISPLAY_NAME[cls].toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: '9px',
        color: PALETTE.bodyText,
      }).setOrigin(0.5);
      this.add
        .rectangle(x, y, GRID.tileW, GRID.tileH, 0, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.selected = cls;
          this.redraw();
        });
    });
  }

  /** A small colored matchup pill; returns its right edge x so the next pill can follow. */
  private chip(x: number, y: number, label: string, fill: number, color: string): number {
    const text = crispText(this, x + 6, y, label, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color }).setOrigin(0, 0.5);
    const w = text.width + 12;
    const box = this.add.rectangle(x, y, w, 16, fill, 0.85).setOrigin(0, 0.5);
    box.setDepth(text.depth - 1); // pill behind its label
    this.dynamic.push(box, text);
    return x + w + 6;
  }

  /** Rebuilds the selection highlight, the detail panel, the army tray, and Continue. */
  private redraw() {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];

    // 1. Selection highlight over the chosen tile.
    const tile = this.tiles.find((t) => t.cls === this.selected);
    if (tile) {
      this.dynamic.push(
        this.add.rectangle(tile.x, tile.y, GRID.tileW, GRID.tileH, PALETTE.playerLine, 0.12).setOrigin(0, 0).setStrokeStyle(2, PALETTE.playerLine),
      );
    }

    // 2. Detail panel for the selected class. A compact Add button sits in the
    //    top-right; the text column wraps to its LEFT so they never collide.
    const card = classRulesCard(this.selected);
    const a = card.actions;
    const canAdd = canAddUnit(this.flow.getState().playerArmy);
    const addW = 66;
    const addH = 46;
    const addCx = DETAIL.x + DETAIL.w - 8 - addW / 2; // right edge padded 8 from the panel
    const textW = addCx - addW / 2 - (DETAIL.x + 92) - 8; // wrap width that clears the button column
    this.dynamic.push(this.add.rectangle(DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, PALETTE.cardFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.cardStroke));
    this.dynamic.push(addUnitSprite(this, DETAIL.x + 44, DETAIL.y + 52, this.selected, 48));
    const tx = DETAIL.x + 92;
    this.dynamic.push(crispText(this, tx, DETAIL.y + 12, card.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '18px', color: PALETTE.title }));
    this.dynamic.push(
      crispText(this, tx, DETAIL.y + 38, `${card.role}  ·  act ${a.front}/${a.mid}/${a.back}`, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: PALETTE.bodyText,
        wordWrap: { width: textW },
      }),
    );
    this.dynamic.push(
      crispText(this, tx, DETAIL.y + 56, card.behavior, {
        fontFamily: 'Arial',
        fontSize: `${MIN_FONT_PX}px`,
        color: PALETTE.mutedText,
        wordWrap: { width: textW },
      }),
    );
    // Matchup pills by DAMAGE TYPE (green strong / red weak): a class is weak to
    // the types of the roles that beat it, strong vs the types it beats.
    const myRole = BALANCE.classes[this.selected].role;
    const uniq = (xs: string[]) => [...new Set(xs)];
    // Support/Control deal no damage type of their own, so a hunt landing on
    // them (e.g. sniper->support) falls back to the role name itself — a hunt
    // against them must still show as a strength/weakness, not vanish silently.
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const types = (rels: readonly { attacker: Role; defender: Role }[], pick: 'attacker' | 'defender') =>
      uniq(rels.map((r) => ROLE_DAMAGE_TYPE[r[pick]] ?? capitalize(r[pick])));
    const weakTo = types(
      BALANCE.roleRelations.filter((r) => r.defender === myRole),
      'attacker',
    );
    const strongVs = types(
      BALANCE.roleRelations.filter((r) => r.attacker === myRole),
      'defender',
    );
    let cx = tx;
    if (strongVs.length) cx = this.chip(cx, DETAIL.y + 98, `strong vs ${strongVs.join(', ')}`, PALETTE.buttonFillEnabled, PALETTE.title);
    if (weakTo.length) this.chip(cx, DETAIL.y + 98, `weak to ${weakTo.join(', ')}`, PALETTE.enemyLine, PALETTE.title);
    if (!strongVs.length && !weakTo.length) this.chip(cx, DETAIL.y + 98, 'neutral matchups', PALETTE.buttonFill, PALETTE.mutedText);

    // Add-to-army button — compact, top-right, gated on remaining slots.
    const addBtn = this.add
      .rectangle(addCx, DETAIL.y + 8 + addH / 2, addW, addH, canAdd ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, canAdd ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    this.dynamic.push(
      addBtn,
      crispText(this, addBtn.x, addBtn.y, 'Add to\narmy', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: canAdd ? PALETTE.buttonText : PALETTE.buttonTextDisabled,
        align: 'center',
      }).setOrigin(0.5),
    );
    if (canAdd) {
      addBtn.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.flow.draftUnit(this.selected);
        this.redraw();
      });
    }

    // 3. The army tray.
    const army = this.flow.getState().playerArmy;
    this.dynamic.push(
      crispText(this, BASE_WIDTH / 2, 426, `YOUR ARMY  (${slotTotal(army)}/${BALANCE.slotBudget})`, {
        fontFamily: 'Arial Black',
        fontSize: '12px',
        color: PALETTE.mutedText,
      }).setOrigin(0.5),
    );
    const slotW = 60;
    const gap = 8;
    const trayY = 444;
    const startX = (BASE_WIDTH - (BALANCE.slotBudget * slotW + (BALANCE.slotBudget - 1) * gap)) / 2;
    for (let i = 0; i < BALANCE.slotBudget; i++) {
      const x = startX + i * (slotW + gap);
      const unit = army[i];
      const slot = unit
        ? this.add.rectangle(x, trayY, slotW, 52, PALETTE.playerLine, 0.15).setOrigin(0, 0).setStrokeStyle(2, PALETTE.playerLine)
        : this.add.rectangle(x, trayY, slotW, 52, PALETTE.gridCellFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gridCellStroke);
      this.dynamic.push(slot);
      if (unit) {
        this.dynamic.push(addUnitSprite(this, x + slotW / 2, trayY + 20, unit.class, 26));
        this.dynamic.push(addElementBadge(this, x + slotW - 9, trayY + 9, unit.element));
        this.dynamic.push(
          crispText(this, x + slotW / 2, trayY + 42, CLASS_ABBREVIATIONS[unit.class], {
            fontFamily: 'Arial Black',
            fontSize: `${CARD_CLASS_FONT_PX}px`,
            color: PALETTE.playerText,
          }).setOrigin(0.5),
        );
        slot.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.flow.removeUnit(i);
          this.redraw();
        });
      } else {
        this.dynamic.push(crispText(this, x + slotW / 2, trayY + 26, '+', { fontFamily: 'Arial', fontSize: '22px', color: PALETTE.mutedText }).setOrigin(0.5));
      }
    }
    this.dynamic.push(
      crispText(this, BASE_WIDTH / 2, trayY + 62, 'Tap a drafted unit to remove it', {
        fontFamily: 'Arial',
        fontSize: `${MIN_FONT_PX}px`,
        color: PALETTE.mutedText,
      }).setOrigin(0.5),
    );

    // 4. Continue.
    const ready = canContinue(army);
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, 540, 200, 48, ready ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, ready ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    this.dynamic.push(
      btn,
      crispText(this, BASE_WIDTH / 2, 540, DRAFT_CONTINUE_LABEL, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: ready ? PALETTE.buttonText : PALETTE.buttonTextDisabled,
      }).setOrigin(0.5),
    );
    if (ready) btn.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Placement', { flow: this.flow }));
  }
}
