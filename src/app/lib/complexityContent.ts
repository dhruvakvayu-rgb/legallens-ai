/**
 * Complexity Content Engine
 *
 * Maps complexity levels 1–10 to named tiers.
 * All document-specific content is generated dynamically by documentAnalyzer.ts.
 *
 * Tier map:
 *  1–2  → ELI5        (child-friendly, analogy-based)
 *  3–4  → Simple      (plain English, no jargon)
 *  5–6  → Balanced    (introduces basic legal terms)
 *  7–8  → Detailed    (legal terminology + reasoning)
 *  9–10 → Expert      (technical legal language, implications, edge cases)
 */

export type Tier = 'eli5' | 'simple' | 'balanced' | 'detailed' | 'expert';

export function getTier(level: number): Tier {
  if (level <= 2) return 'eli5';
  if (level <= 4) return 'simple';
  if (level <= 6) return 'balanced';
  if (level <= 8) return 'detailed';
  return 'expert';
}
