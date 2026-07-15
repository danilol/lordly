import { GameObjects, Scene } from 'phaser';
import type { Unit } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
  HISTORY_EMPTY_LABEL,
  HISTORY_NOT_REPLAYABLE_LABEL,
  HISTORY_REPLAY_LABEL,
  HISTORY_TITLE,
  HOME_BACK_LABEL,
  PALETTE,
} from '../config/constants';
import { addBackAffordance, addElementBadge, addUnitSprite, crispText, enableDragScroll } from '../config/ui';
import { formatHistoryRow } from '../flow/historyModel';
import { MatchFlow } from '../flow/MatchFlow';
import { createStorage } from '../flow/storage';
import type { HistoryEntry } from '../flow/storage';

/** Content viewport: below the back affordance, same frame as Help/Credits. */
const VIEW_TOP = 44;
const MARGIN = 16;
/**
 * Compact unit-card metrics (DESIGN `{components.unit-card}`): side-colored
 * border + wash, 32px sprite, 3-letter code, element dot. Story 3.2 shrank
 * the cards (46→42, gap 3→2, vs 20→12) to free a ≥44px Replay slot on the
 * right: yours end 148, vs ..160, enemy end 290, Replay 296..344, 16 margin.
 */
const CARD_W = 42;
const CARD_H = 56;
const CARD_GAP = 2;
const VS_ADVANCE = 12;
const REPLAY_W = 48;
const REPLAY_X = BASE_WIDTH - MARGIN - REPLAY_W;

/**
 * History scene (story 3.1, FR28, AD-5): the last `HISTORY_LIMIT` matches,
 * newest first — date, verdict, and both compositions as compact side-colored
 * unit cards (blue = you, red = enemy; you are ALWAYS side A — AD-11).
 * Entered from Home with no MatchFlow in flight, so it reads history through
 * its own gateway instance (the BattleScene precedent; writes stay MatchFlow's
 * alone — AD-13). Scrolls via the shared drag helper with the opaque header
 * strip + depth-11 affordance (the Help/Credits pattern — a Phaser 4
 * GeometryMask silently fails to clip, so no masks). Rows leave the right
 * edge free for story 3.2's Replay affordance.
 */
export class HistoryScene extends Scene {
  private readonly storage = createStorage();

  constructor() {
    super('History');
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);

    const entries = this.storage.loadHistory();

    const content = this.add.container(0, VIEW_TOP);
    let y = 8;
    const title = crispText(this, BASE_WIDTH / 2, y, HISTORY_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5, 0);
    content.add(title);
    y += title.height + 14;

    // Hoisted so the row Replay handlers (built BEFORE enableDragScroll can
    // run — it needs the final content height) can close over it; pointerup
    // fires long after create() finishes, when the real guard is assigned.
    let wasDrag: () => boolean = () => false;

    if (entries.length === 0) {
      const empty = crispText(this, BASE_WIDTH / 2, y + 40, HISTORY_EMPTY_LABEL, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: PALETTE.mutedText,
        align: 'center',
        wordWrap: { width: BASE_WIDTH - MARGIN * 4 },
      }).setOrigin(0.5, 0);
      content.add(empty);
      y += 40 + empty.height;
    } else {
      for (const entry of entries) {
        y = this.renderRow(content, entry === entries[0] ? y : y + 12, entry, () => wasDrag());
      }
    }

    wasDrag = enableDragScroll(this, content, VIEW_TOP, y + 16, BASE_HEIGHT - 16);

    // Opaque header strip over scrolled content (GeometryMask quirk workaround),
    // then the drag-guarded back affordance above it — the 2.4 shipped pattern.
    this.add.rectangle(BASE_WIDTH / 2, VIEW_TOP / 2, BASE_WIDTH, VIEW_TOP, PALETTE.backgroundFill).setDepth(10);
    addBackAffordance(
      this,
      HOME_BACK_LABEL,
      () => {
        if (wasDrag()) return; // a scroll releasing over the affordance is not a tap
        this.scene.start('Home');
      },
      11,
    );
  }

  /** One match row: verdict + mode + date header, both compositions, and the Replay slot. Returns the next free y. */
  private renderRow(content: GameObjects.Container, y: number, entry: HistoryEntry, wasDrag: () => boolean): number {
    const row = formatHistoryRow(entry);
    const verdictColor = row.outcome === 'draw' ? PALETTE.drawText : row.outcome === 'loss' ? PALETTE.loseText : PALETTE.winText;
    const verdict = crispText(this, MARGIN, y, row.verdictLabel, { fontFamily: 'Arial Black', fontSize: '15px', color: verdictColor }).setOrigin(0, 0);
    // The battle mode, right after the verdict (PO amendment 2026-07-15).
    const mode = crispText(this, MARGIN + verdict.width + 8, y + 2, `· ${row.modeLabel}`, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
    }).setOrigin(0, 0);
    const date = crispText(this, BASE_WIDTH - MARGIN, y, row.dateLabel, { fontFamily: 'Arial', fontSize: '11px', color: PALETTE.mutedText }).setOrigin(1, 0);
    content.add(verdict);
    content.add(mode);
    content.add(date);
    const headerY = y;
    y += Math.max(verdict.height, date.height) + 6;

    const cardsY = y;
    let x = MARGIN;
    for (const unit of row.yourComp) {
      x = this.renderUnitCard(content, x, cardsY, unit, PALETTE.playerLine);
    }
    const vs = crispText(this, x + VS_ADVANCE / 2, cardsY + CARD_H / 2, 'vs', { fontFamily: 'Arial', fontSize: '11px', color: PALETTE.mutedText }).setOrigin(
      0.5,
    );
    content.add(vs);
    x += VS_ADVANCE;
    for (const unit of row.enemyComp) {
      x = this.renderUnitCard(content, x, cardsY, unit, PALETTE.enemyLine);
    }

    if (row.replayable) {
      this.renderReplayButton(content, cardsY, headerY, entry, wasDrag);
    } else {
      this.renderNotReplayable(content, cardsY, headerY);
    }

    const rule = this.add.rectangle(BASE_WIDTH / 2, cardsY + CARD_H + 10, BASE_WIDTH - MARGIN * 2, 1, PALETTE.cardStroke).setOrigin(0.5, 0);
    content.add(rule);
    return cardsY + CARD_H + 12;
  }

  /**
   * The Replay affordance (story 3.2, FR20/AD-8/AD-13): full card-row height
   * (≥44px target), drag-guarded. The flow validates the setup at the tap —
   * a render-valid but replay-invalid entry (the two-tier validation gap,
   * 3.1 review) demotes this row gracefully instead of crashing the scene.
   */
  private renderReplayButton(content: GameObjects.Container, cardsY: number, headerY: number, entry: HistoryEntry, wasDrag: () => boolean): void {
    const btn = this.add
      .rectangle(REPLAY_X, cardsY, REPLAY_W, CARD_H, PALETTE.buttonFillEnabled)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PALETTE.buttonStrokeEnabled)
      .setInteractive({ useHandCursor: true });
    const glyph = crispText(this, REPLAY_X + REPLAY_W / 2, cardsY + CARD_H / 2, HISTORY_REPLAY_LABEL, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: PALETTE.buttonText,
    }).setOrigin(0.5);
    btn.on('pointerup', () => {
      if (wasDrag()) return; // a scroll releasing over Replay is not a tap
      try {
        const flow = new MatchFlow();
        flow.startReplay(entry.setup);
        this.scene.start('Battle', { flow }); // straight to Battle — the reveal moment belongs to live play
      } catch {
        // Render-valid but replay-invalid (invalid seed/placements passed the
        // render-depth guard): demote, don't crash (3.1 two-tier design).
        btn.disableInteractive();
        btn.setFillStyle(PALETTE.buttonFill).setStrokeStyle(2, PALETTE.buttonStroke);
        glyph.setColor(PALETTE.buttonTextDisabled);
        this.renderNotReplayable(content, cardsY, headerY);
      }
    });
    content.add(btn);
    content.add(glyph);
  }

  /** The EXPERIENCE.md:98 "visibly marked non-replayable" treatment: muted disabled slot + marker under the date. */
  private renderNotReplayable(content: GameObjects.Container, cardsY: number, headerY: number): void {
    const slot = this.add.rectangle(REPLAY_X, cardsY, REPLAY_W, CARD_H, PALETTE.buttonFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.buttonStroke);
    const glyph = crispText(this, REPLAY_X + REPLAY_W / 2, cardsY + CARD_H / 2, HISTORY_REPLAY_LABEL, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: PALETTE.buttonTextDisabled,
    }).setOrigin(0.5);
    const marker = crispText(this, BASE_WIDTH - MARGIN, headerY + 14, HISTORY_NOT_REPLAYABLE_LABEL, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: PALETTE.mutedText,
    }).setOrigin(1, 0);
    content.add(slot);
    content.add(glyph);
    content.add(marker);
  }

  /** One compact unit card (DESIGN unit-card): side-colored border + ~15% wash, sprite, 3-letter code, element dot. Returns the next x. */
  private renderUnitCard(content: GameObjects.Container, x: number, y: number, unit: Unit, sideColor: number): number {
    const card = this.add.rectangle(x, y, CARD_W, CARD_H, sideColor, 0.15).setOrigin(0, 0).setStrokeStyle(2, sideColor);
    const sprite = addUnitSprite(this, x + CARD_W / 2, y + 20, unit.class, 32);
    const code = crispText(this, x + CARD_W / 2, y + CARD_H - 3, CLASS_ABBREVIATIONS[unit.class], {
      fontFamily: 'Arial Black',
      fontSize: `${CARD_CLASS_FONT_PX}px`,
      color: PALETTE.bodyText,
    }).setOrigin(0.5, 1);
    const badge = addElementBadge(this, x + CARD_W - 8, y + 8, unit.element);
    content.add(card);
    content.add(sprite);
    content.add(code);
    content.add(badge);
    return x + CARD_W + CARD_GAP;
  }
}
