import { GameObjects, Scene } from 'phaser';
import { ALL_CLASSES, BALANCE } from '@lordly/engine';
import type { UnitClass } from '@lordly/engine';
import {
  BASE_WIDTH,
  DRAFT_CONTINUE_LABEL,
  DRAFT_HINT,
  DRAFT_RULES_LABEL,
  DRAFT_TITLE,
  PALETTE,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
} from '../config/constants';
import { canAddUnit, canContinue, classRulesCard } from '../flow/draftModel';
import type { MatchFlow } from '../flow/MatchFlow';
import { addElementBadge, addHomeBack, addUnitSprite, crispText } from '../config/ui';
import { attachPerfSampler } from '../config/perf';

/**
 * Draft scene (FR1/FR2/FR3): six class cards to tap, the growing army with
 * each unit's rolled element, and a Continue control gated at 3. A thin
 * renderer over `MatchFlow` + the pure `draftModel` — it owns no match truth
 * (AD-5/AD-13) and re-renders its dynamic parts from `flow.getState()` after
 * every add/remove.
 */
export class DraftScene extends Scene {
  private flow!: MatchFlow;
  /** Dynamic objects (army tray + continue button) destroyed and rebuilt on each redraw. */
  private dynamic: GameObjects.GameObject[] = [];

  constructor() {
    super('Draft');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    // Story 3.4 (NFR1): no-op unless `?perf=1` — per-frame fps sampling.
    attachPerfSampler(this);

    this.cameras.main.setBackgroundColor(PALETTE.background);
    addHomeBack(this);

    // Rules spur (story 2.4, FR27): top-right mirror of the Home affordance.
    // Help returns HERE with the same flow, so a mid-draft army survives the
    // round-trip (create() re-renders from flow state — the 1.8 pattern).
    const rules = crispText(this, BASE_WIDTH - 44, 22, DRAFT_RULES_LABEL, { fontFamily: 'Arial', fontSize: '13px', color: PALETTE.mutedText }).setOrigin(0.5);
    this.add
      .rectangle(rules.x, rules.y, 72, 36, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Help', { from: 'Draft', flow: this.flow }));

    crispText(this, BASE_WIDTH / 2, 26, DRAFT_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, 50, DRAFT_HINT, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);

    this.buildClassCards();
    this.redraw();
  }

  /** The six always-present, tappable class cards (static — the army/continue parts are dynamic). */
  private buildClassCards() {
    const cardW = 168;
    const cardH = 74;
    const gap = 8;
    const left = 8;
    const top = 74;
    ALL_CLASSES.forEach((cls, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = left + col * (cardW + gap);
      const y = top + row * (cardH + gap);
      this.buildCard(cls, x, y, cardW, cardH);
    });
  }

  private buildCard(cls: UnitClass, x: number, y: number, w: number, h: number) {
    const card = classRulesCard(cls);
    const bg = this.add.rectangle(x, y, w, h, PALETTE.cardFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.cardStroke).setInteractive({ useHandCursor: true });

    // Real class sprite (story 2.1, FR2/FR31), top-right of the card — the
    // picker shows the neutral archetype; element rolls on add (FR3).
    addUnitSprite(this, x + w - 24, y + 24, cls, 32);

    const rps = card.beats ? `beats ${card.beats}` : card.beatenBy ? `weak vs ${card.beatenBy}` : 'neutral';
    const a = card.actions;
    crispText(this, x + 8, y + 6, card.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '13px', color: PALETTE.title });
    crispText(this, x + 8, y + 24, card.role, { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.bodyText });
    crispText(this, x + 8, y + 38, card.behavior, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.mutedText, wordWrap: { width: w - 16 } });
    crispText(this, x + 8, y + h - 14, `${rps}  ·  act ${a.front}/${a.mid}/${a.back}`, {
      fontFamily: 'Arial',
      fontSize: `${MIN_FONT_PX}px`,
      color: PALETTE.mutedText,
    });

    bg.on('pointerup', () => {
      if (canAddUnit(this.flow.getState().playerArmy)) {
        this.flow.draftUnit(cls);
        this.redraw();
      }
    });
  }

  /** Rebuilds the army tray + continue button from current state. */
  private redraw() {
    for (const obj of this.dynamic) obj.destroy();
    this.dynamic = [];

    const army = this.flow.getState().playerArmy;
    const trayY = 360;
    this.dynamic.push(
      crispText(this, BASE_WIDTH / 2, trayY - 22, `Your army  (${army.length}/${BALANCE.armySize})`, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: PALETTE.bodyText,
      }).setOrigin(0.5),
    );

    const slotW = 96;
    const gap = 12;
    const totalW = BALANCE.armySize * slotW + (BALANCE.armySize - 1) * gap;
    const startX = (BASE_WIDTH - totalW) / 2;
    for (let i = 0; i < BALANCE.armySize; i++) {
      const x = startX + i * (slotW + gap);
      const unit = army[i];
      // Drafted units are YOURS: the unit-card reads side-blue (border + wash),
      // never a gold frame and never element-colored (story 2.1, DESIGN.md).
      const slot = unit
        ? this.add.rectangle(x, trayY, slotW, 60, PALETTE.playerLine, 0.15).setOrigin(0, 0).setStrokeStyle(2, PALETTE.playerLine)
        : this.add.rectangle(x, trayY, slotW, 60, PALETTE.gridCellFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gridCellStroke);
      this.dynamic.push(slot);
      if (unit) {
        const sprite = addUnitSprite(this, x + 22, trayY + 26, unit.class, 32);
        const badge = addElementBadge(this, x + slotW - 14, trayY + 12, unit.element);
        const name = crispText(this, x + 42, trayY + 8, CLASS_ABBREVIATIONS[unit.class], {
          fontFamily: 'Arial Black',
          fontSize: `${CARD_CLASS_FONT_PX}px`,
          color: PALETTE.playerText,
        });
        const el = crispText(this, x + 42, trayY + 26, unit.element, { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.bodyText });
        const hint = crispText(this, x + 8, trayY + 46, 'tap to remove', { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.mutedText });
        slot.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.flow.removeUnit(i);
          this.redraw();
        });
        this.dynamic.push(sprite, badge, name, el, hint);
      } else {
        this.dynamic.push(
          crispText(this, x + slotW / 2, trayY + 30, 'empty', { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.mutedText }).setOrigin(0.5),
        );
      }
    }

    const ready = canContinue(army);
    const btnY = 470;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, 200, 52, ready ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, ready ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    const label = crispText(this, BASE_WIDTH / 2, btnY, DRAFT_CONTINUE_LABEL, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: ready ? PALETTE.buttonText : PALETTE.buttonTextDisabled,
    }).setOrigin(0.5);
    this.dynamic.push(btn, label);
    if (ready) {
      btn.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Placement', { flow: this.flow }));
    }
  }
}
