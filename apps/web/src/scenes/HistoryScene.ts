import { GameObjects, Scene } from 'phaser';
import type { Tactic, Unit } from '@lordly/engine';
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
  LEADER_CROWN_GLYPH,
  PALETTE,
  TACTIC_DISPLAY_NAME,
} from '../config/constants';
import { applyHiDpiCamera, addBackAffordance, addElementBadge, addUnitSprite, crispText, enableDragScroll } from '../config/ui';
import { formatHistoryRow } from '../flow/historyModel';
import { MatchFlow } from '../flow/MatchFlow';
import { createStorage } from '../flow/storage';
import type { HistoryEntry } from '../flow/storage';

/** Content viewport: below the back affordance, same frame as Help/Credits. */
const VIEW_TOP = 44;
const MARGIN = 16;
/**
 * Two-line row metrics (DESIGN `{components.unit-card}`, story 4.2 senior-review
 * layout fix). The squad era fields up to five units, and the story-3.2
 * single side-by-side card line (your comp + vs + enemy comp) would run to
 * ~468px off the 360 base. So each comp gets its OWN full-width, self-centring
 * line — the ResultScene per-side pattern — and the Replay control lifts into
 * the header BAND beside the date, where no comp/Replay overlap is possible.
 * History cards are display-only (never tapped), so 64px matches the
 * draft/placement/result card language with no tap-target concern; only the
 * Replay control keeps the ≥44px floor (UX-DR4). A comp line centres its own
 * cards, so pre-era 3-unit rows sit centred (5×64+4×8=352 ≤ 360 at the cap).
 */
const CARD_W = 64;
const CARD_H = 56;
const CARD_GAP = 8;
const HEADER_H = 44; // header band — holds the ≥44px Replay tap target above the comp lines
const REPLAY_W = 48;
const REPLAY_H = 44;
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
  /** Re-entry latch for Replay taps — reset every create() (Phaser scenes are singletons; a stale true would dead-lock the buttons). */
  private transitioning = false;

  constructor() {
    super('History');
  }

  create() {
    this.transitioning = false;
    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);

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

  /** One match row: header band (verdict + mode + date + Replay) then the two stacked composition lines. Returns the next free y. */
  private renderRow(content: GameObjects.Container, y: number, entry: HistoryEntry, wasDrag: () => boolean): number {
    const row = formatHistoryRow(entry);
    const headerTop = y;
    const headerCenter = y + HEADER_H / 2;
    const verdictColor = row.outcome === 'draw' ? PALETTE.drawText : row.outcome === 'loss' ? PALETTE.loseText : PALETTE.winText;
    // Header band: verdict + mode (PO amendment 2026-07-15) anchored LEFT, date
    // anchored RIGHT just left of the Replay control — all vertically centred.
    // Date is right-aligned (not left, after mode) so a long/non-ISO fallback
    // dateLabel grows leftward, away from the Replay control, never into it.
    const verdict = crispText(this, MARGIN, headerCenter, row.verdictLabel, { fontFamily: 'Arial Black', fontSize: '15px', color: verdictColor }).setOrigin(
      0,
      0.5,
    );
    const mode = crispText(this, MARGIN + verdict.width + 8, headerCenter, `· ${row.modeLabel}`, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
    }).setOrigin(0, 0.5);
    const date = crispText(this, REPLAY_X - 10, headerCenter, row.dateLabel, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
    }).setOrigin(1, 0.5);
    content.add(verdict);
    content.add(mode);
    content.add(date);

    if (row.replayable) {
      this.renderReplayButton(content, headerTop, entry, wasDrag);
    } else {
      this.renderNotReplayable(content, headerTop);
    }

    // Two stacked comp lines — each centres its own cards. Side colour is the
    // identity anchor (AD-11: blue = you/side A, red = enemy), so no text label.
    // Story 4.5 (FR28, UX-DR10): each line gains a compact tactic label above it
    // and a ♛ crown badge on the leader's card. Pre-era entries (stored before
    // story 4.2 added tactics/leaders) simply omit both — optional-chained.
    let cy = headerTop + HEADER_H + 4;
    cy = this.renderCompLine(content, cy, row.yourComp, PALETTE.playerLine, entry.setup.tactics?.A, entry.setup.leaders?.A);
    cy = this.renderCompLine(content, cy, row.enemyComp, PALETTE.enemyLine, entry.setup.tactics?.B, entry.setup.leaders?.B);

    const rule = this.add.rectangle(BASE_WIDTH / 2, cy + 6, BASE_WIDTH - MARGIN * 2, 1, PALETTE.cardStroke).setOrigin(0.5, 0);
    content.add(rule);
    return cy + 8;
  }

  /**
   * One composition as a centred, full-width line of unit cards, with an
   * optional compact tactic label above it (story 4.5) and a ♛ badge on the
   * leader's card. The label is a STACKED line (extra height), never a widened
   * row — the 4.2 army-row-coupling 360px-overflow lesson. Returns the next free y.
   */
  private renderCompLine(content: GameObjects.Container, y: number, comp: readonly Unit[], sideColor: number, tactic?: Tactic, leaderIndex?: number): number {
    let top = y;
    if (tactic) {
      content.add(
        crispText(this, BASE_WIDTH / 2, top, TACTIC_DISPLAY_NAME[tactic], { fontFamily: 'Arial', fontSize: '10px', color: PALETTE.mutedText }).setOrigin(
          0.5,
          0,
        ),
      );
      top += 13;
    }
    const totalW = comp.length * CARD_W + (comp.length - 1) * CARD_GAP;
    let x = (BASE_WIDTH - totalW) / 2;
    comp.forEach((unit, i) => {
      x = this.renderUnitCard(content, x, top, unit, sideColor, i === leaderIndex);
    });
    return top + CARD_H + 4;
  }

  /**
   * The Replay affordance (story 3.2, FR20/AD-8/AD-13): full card-row height
   * (≥44px target), drag-guarded. The flow validates the setup at the tap —
   * a render-valid but replay-invalid entry (the two-tier validation gap,
   * 3.1 review) demotes this row gracefully instead of crashing the scene.
   */
  private renderReplayButton(content: GameObjects.Container, headerTop: number, entry: HistoryEntry, wasDrag: () => boolean): void {
    const btn = this.add
      .rectangle(REPLAY_X, headerTop, REPLAY_W, REPLAY_H, PALETTE.buttonFillEnabled)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PALETTE.buttonStrokeEnabled)
      .setInteractive({ useHandCursor: true });
    const glyph = crispText(this, REPLAY_X + REPLAY_W / 2, headerTop + REPLAY_H / 2, HISTORY_REPLAY_LABEL, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: PALETTE.buttonText,
    }).setOrigin(0.5);
    btn.on('pointerup', () => {
      if (wasDrag()) return; // a scroll releasing over Replay is not a tap
      if (this.transitioning) return; // re-entry latch: a double-tap must not fire two scene.starts (BattleScene precedent, singleton-scene memory)
      // Validate + hydrate inside the try (the ONLY thing that legitimately
      // throws: a render-valid but replay-invalid entry — the 3.1 two-tier gap);
      // scene.start is OUTSIDE so a transition error can't be mislabeled "not
      // replayable" (review).
      let flow: MatchFlow;
      try {
        flow = new MatchFlow();
        flow.startReplay(entry.setup);
      } catch {
        this.demoteToNonReplayable(content, btn, glyph, headerTop);
        return;
      }
      this.transitioning = true;
      this.scene.start('Battle', { flow }); // straight to Battle — the reveal moment belongs to live play
    });
    content.add(btn);
    content.add(glyph);
  }

  /** In-place demotion of a tapped-but-replay-invalid button: mute the EXISTING objects (no double-draw), then add only the marker. */
  private demoteToNonReplayable(content: GameObjects.Container, btn: GameObjects.Rectangle, glyph: GameObjects.Text, headerTop: number): void {
    btn.disableInteractive();
    btn.setFillStyle(PALETTE.buttonFill).setStrokeStyle(1, PALETTE.buttonStroke);
    glyph.setColor(PALETTE.buttonTextDisabled).setY(headerTop + REPLAY_H / 2 - 6); // lift the glyph to make room for the marker under it
    content.add(this.notReplayableMarker(headerTop));
  }

  /** The EXPERIENCE.md:98 "visibly marked non-replayable" treatment: a compact muted slot in the header band with the caption beneath it. */
  private renderNotReplayable(content: GameObjects.Container, headerTop: number): void {
    const slot = this.add.rectangle(REPLAY_X, headerTop, REPLAY_W, 26, PALETTE.buttonFill).setOrigin(0, 0).setStrokeStyle(1, PALETTE.buttonStroke);
    const glyph = crispText(this, REPLAY_X + REPLAY_W / 2, headerTop + 13, HISTORY_REPLAY_LABEL, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: PALETTE.buttonTextDisabled,
    }).setOrigin(0.5);
    content.add(slot);
    content.add(glyph);
    content.add(this.notReplayableMarker(headerTop));
  }

  /** The muted "not replayable" caption, centred under the Replay slot — one source for both the version gate and the tap-time demotion. */
  private notReplayableMarker(headerTop: number): GameObjects.Text {
    return crispText(this, REPLAY_X + REPLAY_W / 2, headerTop + 30, HISTORY_NOT_REPLAYABLE_LABEL, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: PALETTE.mutedText,
    }).setOrigin(0.5, 0);
  }

  /** One compact unit card (DESIGN unit-card): side-colored border + ~15% wash, sprite, 3-letter code, element dot, and (story 4.5) a ♛ badge if it's the leader. Returns the next x. */
  private renderUnitCard(content: GameObjects.Container, x: number, y: number, unit: Unit, sideColor: number, isLeader = false): number {
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
    // ♛ badge ON the existing card (top-left, opposite the element dot) — never
    // widens the row (the 4.2 overflow lesson). Gold = leader (PALETTE.title).
    if (isLeader) {
      content.add(crispText(this, x + 3, y + 2, LEADER_CROWN_GLYPH, { fontFamily: 'Arial', fontSize: '12px', color: PALETTE.title }).setOrigin(0, 0));
    }
    return x + CARD_W + CARD_GAP;
  }
}
