import { ALL_CLASSES } from '@lordly/engine';
import type { ArtPackAttribution } from '../assets/attribution';

/**
 * Pure formatter for the Credits scene (story 2.4, AC5/FR31): the attribution
 * manifest is the SINGLE source — a new pack added there appears here with
 * zero scene changes. Read-only text (URLs render as text, no links — the
 * Credits surface honors licenses, it doesn't navigate).
 */
export interface CreditBlock {
  title: string;
  lines: string[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatCredits(packs: readonly ArtPackAttribution[]): CreditBlock[] {
  return packs.map((pack) => {
    const supplies = ALL_CLASSES.filter((cls) => cls in pack.classSources).map(cap);
    return {
      title: pack.pack,
      lines: [
        `by ${pack.author}`,
        `License: ${pack.licenseName} (${pack.license})`,
        `License text: ${pack.licenseUrl}`,
        pack.url,
        ...(supplies.length > 0 ? [`Supplies: ${supplies.join(', ')} sprites`] : []),
      ],
    };
  });
}
