import { GameObjects, Scene } from 'phaser';
import rulesRaw from '../../../../docs/rules.md?raw';
import { BACK_LABEL, BASE_HEIGHT, BASE_WIDTH, MIN_FONT_PX, PALETTE } from '../config/constants';
import { addBackAffordance, crispText, enableDragScroll } from '../config/ui';
import { parseRulesDoc } from '../flow/rulesDoc';
import type { RulesLine } from '../flow/rulesDoc';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Where Help was opened from — dismissal returns THERE (FR27; EXPERIENCE.md
 * "dismissible by touch back to its origin"). The union TIES flow to the
 * Draft origin (review: independently-optional fields let a flow-less Draft
 * return crash DraftScene).
 */
export type HelpEntry = { from?: 'Home' } | { from: 'Draft'; flow: MatchFlow };

/** Content viewport: below the back affordance, full width otherwise. */
const VIEW_TOP = 44;
const MARGIN = 20;

/**
 * Help / Rules scene (story 2.4, FR27/NFR3, AD-5): renders the player rules
 * FROM `docs/rules.md` — the standalone artifact is the single source; this
 * scene is a thin mapper of parsed line specs to crispText objects. Content
 * scrolls by touch-drag or wheel (shared `enableDragScroll`); an opaque
 * header strip keeps scrolled content under the back affordance (a Phaser 4
 * GeometryMask silently failed to clip — quirk sibling of polygon-triangles).
 * Reachable from Home and Draft; dismissing returns to the origin with the
 * MatchFlow passed back, so a mid-draft army survives the round-trip
 * (singleton rule: origin/flow set in init()).
 */
export class HelpScene extends Scene {
  private entry: HelpEntry = {};

  constructor() {
    super('Help');
  }

  init(data: HelpEntry) {
    this.entry = data;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);

    const content = this.add.container(0, VIEW_TOP);
    const contentHeight = this.renderLines(content, parseRulesDoc(rulesRaw));
    const wasDrag = enableDragScroll(this, content, VIEW_TOP, contentHeight, BASE_HEIGHT - 16);

    this.add.rectangle(BASE_WIDTH / 2, VIEW_TOP / 2, BASE_WIDTH, VIEW_TOP, PALETTE.backgroundFill).setDepth(10);
    addBackAffordance(
      this,
      BACK_LABEL,
      () => {
        if (wasDrag()) return; // a scroll releasing over the affordance is not a tap (review)
        if (this.entry.from === 'Draft') this.scene.start('Draft', { flow: this.entry.flow });
        else this.scene.start('Home');
      },
      11,
    );
  }

  /** Renders every line spec into the content container; returns the total content height. */
  private renderLines(content: GameObjects.Container, lines: RulesLine[]): number {
    let y = 8;
    const width = BASE_WIDTH - MARGIN * 2;
    const add = (text: string, style: Parameters<typeof crispText>[4], indent = 0, gap = 6) => {
      const obj = crispText(this, MARGIN + indent, y, text, { ...style, wordWrap: { width: width - indent } }).setOrigin(0, 0);
      content.add(obj);
      y += obj.height + gap;
      return obj;
    };

    for (const line of lines) {
      switch (line.kind) {
        case 'heading':
          add(line.text ?? '', { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }, 0, 10);
          break;
        case 'subheading':
          y += 6;
          add(line.text ?? '', { fontFamily: 'Arial Black', fontSize: '17px', color: PALETTE.title }, 0, 8);
          break;
        case 'subsubheading':
          y += 2;
          add(line.text ?? '', { fontFamily: 'Arial Black', fontSize: '14px', color: PALETTE.bodyText }, 0, 6);
          break;
        case 'body':
          add(line.text ?? '', { fontFamily: 'Arial', fontSize: '15px', color: PALETTE.bodyText, lineSpacing: 4 });
          break;
        case 'bullet':
          // 15px like body — the bullets ARE the rules (review: 14px undercut the AC3 body target).
          add(`•  ${line.text ?? ''}`, { fontFamily: 'Arial', fontSize: '15px', color: PALETTE.bodyText, lineSpacing: 4 }, 8);
          break;
        case 'tableHeader':
          break; // structure, not content — the stacked row blocks carry their own labels
        case 'tableRow':
          this.renderTableRow(line.cells ?? [], add);
          break;
        case 'spacer':
          y += 8;
          break;
      }
    }
    return y;
  }

  /**
   * A class-table data row, stacked: five columns cannot fit a 360px viewport
   * at a readable size (the story sanctions the key-value fallback), so each
   * row renders as a compact block — name+role, numbers, behavior.
   */
  private renderTableRow(cells: string[], add: (text: string, style: Parameters<typeof crispText>[4], indent?: number, gap?: number) => GameObjects.Text) {
    const [name, role, hp, actions, behavior] = cells;
    add(`${name ?? ''} — ${role ?? ''}`, { fontFamily: 'Arial Black', fontSize: '14px', color: PALETTE.playerText }, 0, 2);
    add(`HP ${hp ?? ''}   ·   Actions ${actions ?? ''}`, { fontFamily: 'Courier', fontSize: '12px', color: PALETTE.bodyText }, 8, 2);
    add(behavior ?? '', { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX + 2}px`, color: PALETTE.mutedText, lineSpacing: 3 }, 8, 10);
  }
}
