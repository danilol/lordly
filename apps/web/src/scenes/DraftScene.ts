import { GameObjects, Scene } from 'phaser';
import { ALL_CLASSES, BALANCE } from '@lordly/engine';
import type { UnitClass } from '@lordly/engine';
import {
  BASE_WIDTH,
  DRAFT_CONTINUE_LABEL,
  DRAFT_HINT,
  DRAFT_TITLE,
  ELEMENT_COLORS,
  PALETTE,
} from '../config/constants';
import { canAddUnit, canContinue, classRulesCard } from '../flow/draftModel';
import type { MatchFlow } from '../flow/MatchFlow';
import { crispText } from '../config/ui';

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
    this.cameras.main.setBackgroundColor(PALETTE.background);

    crispText(this, BASE_WIDTH / 2, 26, DRAFT_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, 50, DRAFT_HINT, { fontFamily: 'Arial', fontSize: '11px', color: PALETTE.mutedText, align: 'center', wordWrap: { width: BASE_WIDTH - 24 } }).setOrigin(0.5);

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
    const bg = this.add
      .rectangle(x, y, w, h, PALETTE.cardFill)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.cardStroke)
      .setInteractive({ useHandCursor: true });

    // Sprite placeholder (FR2 / story 2.1 replaces with real art): a colored
    // square bearing the class initial, top-right of the card.
    const glyph = 26;
    this.add.rectangle(x + w - glyph - 8, y + 8, glyph, glyph, PALETTE.unitFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.unitStroke);
    crispText(this, x + w - glyph / 2 - 8, y + 8 + glyph / 2, card.name.charAt(0).toUpperCase(), { fontFamily: 'Arial Black', fontSize: '15px', color: PALETTE.title }).setOrigin(0.5);

    const rps = card.beats ? `beats ${card.beats}` : card.beatenBy ? `weak vs ${card.beatenBy}` : 'neutral';
    const a = card.actions;
    crispText(this, x + 8, y + 6, card.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '13px', color: PALETTE.title });
    crispText(this, x + 8, y + 24, card.role, { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.bodyText });
    crispText(this, x + 8, y + 38, card.behavior, { fontFamily: 'Arial', fontSize: '9px', color: PALETTE.mutedText, wordWrap: { width: w - 16 } });
    crispText(this, x + 8, y + h - 14, `${rps}  ·  act ${a.front}/${a.mid}/${a.back}`, { fontFamily: 'Arial', fontSize: '9px', color: PALETTE.mutedText });

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
    this.dynamic.push(crispText(this, BASE_WIDTH / 2, trayY - 22, `Your army  (${army.length}/${BALANCE.armySize})`, { fontFamily: 'Arial', fontSize: '12px', color: PALETTE.bodyText }).setOrigin(0.5));

    const slotW = 96;
    const gap = 12;
    const totalW = BALANCE.armySize * slotW + (BALANCE.armySize - 1) * gap;
    const startX = (BASE_WIDTH - totalW) / 2;
    for (let i = 0; i < BALANCE.armySize; i++) {
      const x = startX + i * (slotW + gap);
      const unit = army[i];
      const slot = this.add.rectangle(x, trayY, slotW, 60, PALETTE.gridCellFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gridCellStroke);
      this.dynamic.push(slot);
      if (unit) {
        const badge = this.add.rectangle(x + slotW - 14, trayY + 14, 16, 16, ELEMENT_COLORS[unit.element]).setOrigin(0.5);
        const name = crispText(this, x + 8, trayY + 10, unit.class, { fontFamily: 'Arial Black', fontSize: '11px', color: PALETTE.title });
        const el = crispText(this, x + 8, trayY + 28, unit.element, { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.bodyText });
        const hint = crispText(this, x + 8, trayY + 42, 'tap to remove', { fontFamily: 'Arial', fontSize: '8px', color: PALETTE.mutedText });
        slot.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.flow.removeUnit(i);
          this.redraw();
        });
        this.dynamic.push(badge, name, el, hint);
      } else {
        this.dynamic.push(crispText(this, x + slotW / 2, trayY + 30, 'empty', { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.mutedText }).setOrigin(0.5));
      }
    }

    const ready = canContinue(army);
    const btnY = 470;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, 200, 52, ready ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
      .setStrokeStyle(2, ready ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke);
    const label = crispText(this, BASE_WIDTH / 2, btnY, DRAFT_CONTINUE_LABEL, { fontFamily: 'Arial', fontSize: '18px', color: ready ? PALETTE.buttonText : PALETTE.buttonTextDisabled }).setOrigin(0.5);
    this.dynamic.push(btn, label);
    if (ready) {
      btn.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Placement', { flow: this.flow }));
    }
  }
}
