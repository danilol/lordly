/**
 * Markdown-lite parser for the Help scene (story 2.4, AC3): turns
 * `docs/rules.md` into typed line specs the scene maps 1:1 to text objects.
 * Pure and Phaser-free (the 1.8 thin-renderer pattern). It handles exactly
 * the subset rules.md uses — #/##/### headings, paragraphs, `- ` bullets,
 * `|` table rows — and strips inline bold/italic emphasis markers (Phaser
 * text has no rich inline styling; emphasis is a print nicety, not information).
 */

export interface RulesLine {
  kind: 'heading' | 'subheading' | 'subsubheading' | 'body' | 'bullet' | 'tableRow' | 'tableHeader' | 'spacer';
  text?: string;
  cells?: string[];
}

/** A markdown table separator (`| --- | :-- |`) — layout, not content. Exported so tests share ONE definition (review: a re-implemented regex had drifted). */
export function isTableSeparator(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line) && line.includes('-');
}

/** Strips the inline markdown this doc uses: emphasis markers and backticks. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

export function parseRulesDoc(raw: string): RulesLine[] {
  const lines: RulesLine[] = [];
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) {
      if (lines[lines.length - 1]?.kind !== 'spacer' && lines.length > 0) lines.push({ kind: 'spacer' });
      continue;
    }
    if (isTableSeparator(line)) {
      // The row BEFORE a separator is the table header — structure, not a
      // content guess (review: the scene had keyed off the literal 'Class').
      const prev = lines[lines.length - 1];
      if (prev?.kind === 'tableRow') prev.kind = 'tableHeader';
      continue;
    }
    if (line.startsWith('### ')) {
      lines.push({ kind: 'subsubheading', text: plain(line.slice(4)) });
    } else if (line.startsWith('## ')) {
      lines.push({ kind: 'subheading', text: plain(line.slice(3)) });
    } else if (line.startsWith('# ')) {
      lines.push({ kind: 'heading', text: plain(line.slice(2)) });
    } else if (line.startsWith('- ')) {
      lines.push({ kind: 'bullet', text: plain(line.slice(2)) });
    } else if (line.startsWith('|')) {
      // Slice off the OUTER pipe segments only — interior empty cells keep
      // their position (review: filtering empties shifted every later column).
      const cells = line.split('|').slice(1, -1).map(plain);
      lines.push({ kind: 'tableRow', cells });
    } else {
      lines.push({ kind: 'body', text: plain(line) });
    }
  }
  // A trailing spacer renders as dead space at the scroll bottom — drop it.
  if (lines[lines.length - 1]?.kind === 'spacer') lines.pop();
  return lines;
}
