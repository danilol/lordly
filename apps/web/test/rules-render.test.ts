import { describe, expect, it } from 'vitest';
import { isTableSeparator, parseRulesDoc } from '../src/flow/rulesDoc';
import { formatCredits } from '../src/flow/credits';
import { ART_ATTRIBUTIONS } from '../src/assets/attribution';

// The same ?raw import the Help scene uses — typechecking it here also proves the mechanism.
import raw from '../../../docs/rules.md?raw';

describe('parseRulesDoc — markdown-lite → line specs (story 2.4, AC3)', () => {
  it('parses headings at three levels', () => {
    const lines = parseRulesDoc('# Top\n## Mid\n### Small\nbody');
    expect(lines.map((l) => l.kind)).toEqual(['heading', 'subheading', 'subsubheading', 'body']);
    expect(lines[0]?.text).toBe('Top');
  });

  it('parses bullets and table rows, skips separators, and retags the pre-separator row as the header', () => {
    const lines = parseRulesDoc('| A | B |\n| --- | --- |\n| 1 | 2 |\n- first\n- second');
    expect(lines.map((l) => l.kind)).toEqual(['tableHeader', 'tableRow', 'bullet', 'bullet']);
    expect(lines[1]?.cells).toEqual(['1', '2']);
    expect(lines[2]?.text).toBe('first');
  });

  it('preserves interior EMPTY table cells positionally (review: filtering shifted columns)', () => {
    const lines = parseRulesDoc('| a |  | b |');
    expect(lines[0]?.cells).toEqual(['a', '', 'b']);
  });

  it('strips inline markdown emphasis from text lines', () => {
    const lines = parseRulesDoc('**Bold** and *soft* text');
    expect(lines[0]?.text).toBe('Bold and soft text');
  });

  it('keeps blank lines as single spacers and never loses content lines', () => {
    const lines = parseRulesDoc('a\n\n\nb');
    expect(lines.map((l) => l.kind)).toEqual(['body', 'spacer', 'body']);
  });

  it('parses the REAL rules.md without losing any content line', () => {
    const lines = parseRulesDoc(raw);
    const contentLines = raw.split('\n').filter((l) => l.trim().length > 0 && !isTableSeparator(l.trim()));
    expect(lines.filter((l) => l.kind !== 'spacer')).toHaveLength(contentLines.length);
    expect(lines.some((l) => l.kind === 'tableRow' && l.cells?.includes('Knight'))).toBe(true);
    expect(lines[0]).toEqual({ kind: 'heading', text: 'How to Play' });
  });
});

describe('formatCredits — the manifest → credit lines (story 2.4, AC5)', () => {
  it('produces one block per pack, with pack, author, and license present', () => {
    const blocks = formatCredits(ART_ATTRIBUTIONS);
    expect(blocks).toHaveLength(ART_ATTRIBUTIONS.length);
    for (const [i, block] of blocks.entries()) {
      const pack = ART_ATTRIBUTIONS[i];
      expect(block.title).toBe(pack?.pack);
      expect(block.lines.join('\n')).toContain(pack?.author ?? '');
      expect(block.lines.join('\n')).toContain(pack?.licenseName ?? '');
      expect(block.lines.join('\n')).toContain(pack?.license ?? '');
      expect(block.lines.join('\n')).toContain(pack?.url ?? '');
      expect(block.lines.every((l) => l.trim().length > 0)).toBe(true);
    }
  });

  it('lists what each pack supplies (the classes) without hand-written per-pack code', () => {
    const blocks = formatCredits(ART_ATTRIBUTIONS);
    const first = blocks[0];
    expect(first?.lines.join('\n').toLowerCase()).toContain('knight');
  });
});
