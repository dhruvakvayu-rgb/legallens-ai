/**
 * Legal Knowledge Base
 *
 * 30 curated legal risk patterns drawn from common contract law principles.
 * Each pattern includes:
 *  - canonical clause text (the "ideal" or "risky" form)
 *  - risk level, category, and what protection is missing
 *  - term vector (pre-computed for similarity matching)
 */

export type KBCategory =
  | 'termination'
  | 'nonCompete'
  | 'confidentiality'
  | 'payment'
  | 'liability'
  | 'ip'
  | 'dispute'
  | 'renewal'
  | 'indemnity'
  | 'compliance';

export type KBSeverity = 'high' | 'medium' | 'low';

export interface LegalPattern {
  id: string;
  category: KBCategory;
  severity: KBSeverity;
  /** Short name shown in UI */
  name: string;
  /** Canonical risky clause text used for similarity matching */
  clauseText: string;
  /** What this pattern signals */
  signal: string;
  /** What protection is absent */
  missingProtection: string;
  /** Recommendation when matched */
  recommendation: string;
  /** Pre-computed term vector (populated at module load) */
  termVector: Map<string, number>;
}

// ─── Raw pattern definitions ──────────────────────────────────────────────────

const RAW_PATTERNS: Omit<LegalPattern, 'termVector'>[] = [
  // ── Termination ──────────────────────────────────────────────────────────
  {
    id: 'T01',
    category: 'termination',
    severity: 'high',
    name: 'At-Will Termination Without Severance',
    clauseText: 'either party may terminate this agreement at any time without cause without notice without severance',
    signal: 'Unilateral termination right with no financial protection for the terminated party.',
    missingProtection: 'Severance pay, notice period, or cause requirement.',
    recommendation: 'Negotiate a minimum notice period (30–90 days) and severance equal to at least 1–3 months of compensation.',
  },
  {
    id: 'T02',
    category: 'termination',
    severity: 'high',
    name: 'Immediate Termination for Convenience',
    clauseText: 'company may terminate employment immediately for convenience without prior notice or compensation',
    signal: 'Employer can dismiss without any warning or payment.',
    missingProtection: 'Notice period and termination compensation.',
    recommendation: 'Request a minimum 30-day written notice requirement and severance provision.',
  },
  {
    id: 'T03',
    category: 'termination',
    severity: 'medium',
    name: 'Termination for Cause — Vague Definition',
    clauseText: 'employer may terminate for cause including but not limited to misconduct poor performance or any reason deemed appropriate',
    signal: 'Cause definition is overly broad, giving employer unchecked termination power.',
    missingProtection: 'Objective, enumerated definition of "cause".',
    recommendation: 'Request a specific, exhaustive list of termination-for-cause events with a cure period.',
  },
  {
    id: 'T04',
    category: 'termination',
    severity: 'medium',
    name: 'No Reinstatement or Appeal Right',
    clauseText: 'termination decision is final and binding employee has no right to appeal or reinstatement',
    signal: 'Employee has no recourse against wrongful termination.',
    missingProtection: 'Grievance procedure or appeal mechanism.',
    recommendation: 'Negotiate an internal dispute resolution or appeal process before termination becomes final.',
  },

  // ── Non-Compete ───────────────────────────────────────────────────────────
  {
    id: 'NC01',
    category: 'nonCompete',
    severity: 'high',
    name: 'Broad Post-Employment Non-Compete',
    clauseText: 'employee shall not engage in any competing business for a period of years after termination in any geographic area',
    signal: 'Post-employment restriction on livelihood with no geographic or temporal limits.',
    missingProtection: 'Reasonable geographic scope, defined duration, and industry specificity.',
    recommendation: 'Limit to 6–12 months, specific geography, and directly competing roles only.',
  },
  {
    id: 'NC02',
    category: 'nonCompete',
    severity: 'medium',
    name: 'Non-Solicitation of Clients',
    clauseText: 'employee shall not solicit or contact any client customer or prospect of the company after termination',
    signal: 'Restricts ability to work with former clients even if they initiate contact.',
    missingProtection: 'Carve-out for clients who independently approach the employee.',
    recommendation: 'Negotiate a carve-out for clients who proactively contact you after departure.',
  },
  {
    id: 'NC03',
    category: 'nonCompete',
    severity: 'medium',
    name: 'Non-Solicitation of Employees',
    clauseText: 'employee shall not recruit hire or solicit any employee of the company for a period after termination',
    signal: 'Limits ability to build a team after leaving.',
    missingProtection: 'Time limit and scope restriction.',
    recommendation: 'Limit to 12 months and exclude employees who were not directly managed.',
  },

  // ── Confidentiality ───────────────────────────────────────────────────────
  {
    id: 'C01',
    category: 'confidentiality',
    severity: 'high',
    name: 'Perpetual Confidentiality Obligation',
    clauseText: 'confidentiality obligations shall survive termination and continue in perpetuity without limitation',
    signal: 'No expiry on confidentiality — binds you indefinitely.',
    missingProtection: 'Time-limited confidentiality obligation.',
    recommendation: 'Negotiate a 2–5 year post-termination confidentiality period with carve-outs for public domain information.',
  },
  {
    id: 'C02',
    category: 'confidentiality',
    severity: 'high',
    name: 'Overly Broad Confidential Information Definition',
    clauseText: 'confidential information means all information disclosed by company whether oral written or electronic regardless of whether marked confidential',
    signal: 'Everything is confidential — no carve-out for public or independently developed information.',
    missingProtection: 'Standard exclusions for public domain, independently developed, or legally required disclosures.',
    recommendation: 'Add standard exclusions: publicly available information, independently developed knowledge, and legally compelled disclosures.',
  },
  {
    id: 'C03',
    category: 'confidentiality',
    severity: 'medium',
    name: 'No Whistleblower Carve-Out',
    clauseText: 'employee shall not disclose any confidential information to any third party including government agencies',
    signal: 'Confidentiality clause may prohibit legally protected whistleblower disclosures.',
    missingProtection: 'Statutory whistleblower protection carve-out.',
    recommendation: 'Ensure the confidentiality clause explicitly permits disclosures required by law or to regulatory authorities.',
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  {
    id: 'P01',
    category: 'payment',
    severity: 'high',
    name: 'Discretionary Bonus — No Guaranteed Entitlement',
    clauseText: 'any bonus or incentive compensation shall be at the sole discretion of the company and shall not constitute a guaranteed entitlement',
    signal: 'Bonuses can be withheld entirely at employer discretion.',
    missingProtection: 'Objective bonus criteria and minimum guaranteed amounts.',
    recommendation: 'Negotiate objective performance metrics, minimum bonus thresholds, and pro-rata payment on termination.',
  },
  {
    id: 'P02',
    category: 'payment',
    severity: 'high',
    name: 'Unilateral Salary Modification',
    clauseText: 'company reserves the right to modify salary compensation or benefits at any time with or without notice',
    signal: 'Employer can reduce pay unilaterally.',
    missingProtection: 'Minimum notice period for compensation changes and employee consent requirement.',
    recommendation: 'Require 30-day written notice for any compensation reduction and employee consent for material changes.',
  },
  {
    id: 'P03',
    category: 'payment',
    severity: 'medium',
    name: 'Vague Payment Schedule',
    clauseText: 'payment shall be made in accordance with company standard payroll practices as determined from time to time',
    signal: 'No fixed payment date or schedule.',
    missingProtection: 'Defined payment frequency and method.',
    recommendation: 'Specify exact payment dates (e.g., bi-weekly on the 1st and 15th) and payment method.',
  },
  {
    id: 'P04',
    category: 'payment',
    severity: 'medium',
    name: 'Expense Reimbursement at Discretion',
    clauseText: 'company may reimburse reasonable business expenses at its discretion subject to prior written approval',
    signal: 'No guaranteed reimbursement for legitimate business expenses.',
    missingProtection: 'Clear reimbursement policy with defined categories and timelines.',
    recommendation: 'Define reimbursable expense categories, approval thresholds, and reimbursement timelines.',
  },

  // ── Liability ─────────────────────────────────────────────────────────────
  {
    id: 'L01',
    category: 'liability',
    severity: 'high',
    name: 'Unlimited Indemnification Obligation',
    clauseText: 'employee shall indemnify defend and hold harmless company from any and all claims losses damages costs and expenses',
    signal: 'Unlimited personal liability for company losses.',
    missingProtection: 'Cap on indemnification liability and carve-out for company negligence.',
    recommendation: 'Cap indemnification at the value of compensation received and exclude company gross negligence or willful misconduct.',
  },
  {
    id: 'L02',
    category: 'liability',
    severity: 'high',
    name: 'Consequential Damages Waiver — One-Sided',
    clauseText: 'in no event shall employee be entitled to recover consequential indirect special or punitive damages',
    signal: 'Employee cannot recover full damages for breach, but company faces no equivalent restriction.',
    missingProtection: 'Mutual consequential damages limitation.',
    recommendation: 'Ensure any damages limitation is mutual and applies equally to both parties.',
  },
  {
    id: 'L03',
    category: 'liability',
    severity: 'medium',
    name: 'Liability Cap Below Actual Damages',
    clauseText: 'total liability of either party shall not exceed the total fees paid in the preceding three months',
    signal: 'Liability cap may be insufficient to cover actual losses.',
    missingProtection: 'Adequate liability cap relative to contract value.',
    recommendation: 'Negotiate a liability cap of at least 12 months of contract value or actual damages for material breaches.',
  },

  // ── IP ────────────────────────────────────────────────────────────────────
  {
    id: 'IP01',
    category: 'ip',
    severity: 'high',
    name: 'Broad IP Assignment — Includes Pre-Existing Work',
    clauseText: 'employee assigns to company all intellectual property inventions discoveries and works created during employment including prior inventions',
    signal: 'Assignment may capture pre-existing IP and personal projects.',
    missingProtection: 'Carve-out for pre-existing IP and work created outside employment scope.',
    recommendation: 'Attach a schedule of pre-existing IP and add a carve-out for work created on personal time without company resources.',
  },
  {
    id: 'IP02',
    category: 'ip',
    severity: 'high',
    name: 'Work-for-Hire — All Output Owned by Company',
    clauseText: 'all work product created by employee shall be considered work made for hire and shall be the exclusive property of company',
    signal: 'All creative output, including personal projects, may belong to the company.',
    missingProtection: 'Scope limitation to work created within employment duties.',
    recommendation: 'Limit work-for-hire to work created during working hours using company resources in furtherance of company business.',
  },
  {
    id: 'IP03',
    category: 'ip',
    severity: 'medium',
    name: 'Moral Rights Waiver',
    clauseText: 'employee waives all moral rights in any work product to the fullest extent permitted by law',
    signal: 'Waiver of attribution and integrity rights in creative work.',
    missingProtection: 'Retention of moral rights or limited waiver.',
    recommendation: 'Limit moral rights waiver to commercial use within the scope of the agreement.',
  },

  // ── Dispute Resolution ────────────────────────────────────────────────────
  {
    id: 'D01',
    category: 'dispute',
    severity: 'high',
    name: 'Mandatory Arbitration — Class Action Waiver',
    clauseText: 'all disputes shall be resolved by binding arbitration employee waives right to jury trial and class action',
    signal: 'Eliminates right to court proceedings and collective action.',
    missingProtection: 'Right to court proceedings for certain claims.',
    recommendation: 'Carve out statutory employment claims, injunctive relief, and small claims from mandatory arbitration.',
  },
  {
    id: 'D02',
    category: 'dispute',
    severity: 'medium',
    name: 'Unfavorable Governing Law',
    clauseText: 'this agreement shall be governed by the laws of the state of delaware regardless of conflict of law principles',
    signal: 'Governing law may be unfavorable or inconvenient for the employee.',
    missingProtection: 'Choice of law in employee\'s home jurisdiction.',
    recommendation: 'Negotiate governing law in your state of residence or employment.',
  },
  {
    id: 'D03',
    category: 'dispute',
    severity: 'medium',
    name: 'Fee-Shifting Clause',
    clauseText: 'the prevailing party shall be entitled to recover attorneys fees and costs from the non-prevailing party',
    signal: 'Losing a dispute could result in paying the other party\'s legal fees.',
    missingProtection: 'Mutual fee-shifting or cap on recoverable fees.',
    recommendation: 'Ensure fee-shifting is mutual and capped at a reasonable amount.',
  },

  // ── Renewal ───────────────────────────────────────────────────────────────
  {
    id: 'R01',
    category: 'renewal',
    severity: 'medium',
    name: 'Automatic Renewal Without Adequate Notice',
    clauseText: 'this agreement shall automatically renew for successive one year terms unless terminated by written notice at least 90 days prior to renewal',
    signal: 'Short opt-out window may cause unintended renewal.',
    missingProtection: 'Adequate advance notice of renewal and opt-out reminder.',
    recommendation: 'Calendar the opt-out deadline and negotiate a shorter notice period (30 days) for non-renewal.',
  },
  {
    id: 'R02',
    category: 'renewal',
    severity: 'low',
    name: 'Price Escalation on Renewal',
    clauseText: 'upon renewal fees shall increase by a percentage equal to the consumer price index or 5 percent whichever is greater',
    signal: 'Automatic price increases on renewal without renegotiation.',
    missingProtection: 'Cap on renewal price increases.',
    recommendation: 'Negotiate a cap on annual price increases (e.g., CPI or 3%, whichever is lower).',
  },

  // ── Indemnity ─────────────────────────────────────────────────────────────
  {
    id: 'IN01',
    category: 'indemnity',
    severity: 'high',
    name: 'One-Sided Indemnification',
    clauseText: 'employee shall indemnify company against all third party claims arising from employee actions but company shall have no indemnification obligation',
    signal: 'Employee bears all indemnification risk; company has none.',
    missingProtection: 'Mutual indemnification obligations.',
    recommendation: 'Negotiate mutual indemnification so the company also indemnifies you for claims arising from its actions.',
  },
  {
    id: 'IN02',
    category: 'indemnity',
    severity: 'medium',
    name: 'Broad Indemnification Scope',
    clauseText: 'indemnification obligations shall include all claims whether direct indirect foreseeable or unforeseeable',
    signal: 'Indemnification extends to unforeseeable and indirect claims.',
    missingProtection: 'Limitation to direct, foreseeable claims.',
    recommendation: 'Limit indemnification to direct, foreseeable claims arising from your specific actions or omissions.',
  },

  // ── Compliance ────────────────────────────────────────────────────────────
  {
    id: 'CO01',
    category: 'compliance',
    severity: 'high',
    name: 'Unilateral Policy Changes Binding on Employee',
    clauseText: 'company may amend its policies procedures and employee handbook at any time and such amendments shall be binding on employee',
    signal: 'Company can change the rules unilaterally and bind you to new terms.',
    missingProtection: 'Notice requirement and employee consent for material policy changes.',
    recommendation: 'Require 30-day written notice for material policy changes and your right to terminate if changes are unacceptable.',
  },
  {
    id: 'CO02',
    category: 'compliance',
    severity: 'medium',
    name: 'Monitoring and Surveillance Clause',
    clauseText: 'company reserves the right to monitor all communications devices and activities conducted on company systems or premises',
    signal: 'Broad surveillance rights with no privacy protections.',
    missingProtection: 'Limitation on monitoring scope and employee privacy rights.',
    recommendation: 'Ensure monitoring is limited to company systems during work hours and complies with applicable privacy laws.',
  },
  {
    id: 'CO03',
    category: 'compliance',
    severity: 'medium',
    name: 'Entire Agreement Clause Excluding Prior Representations',
    clauseText: 'this agreement constitutes the entire agreement and supersedes all prior representations warranties and understandings',
    signal: 'Verbal promises or prior representations made during negotiation are unenforceable.',
    missingProtection: 'Incorporation of key pre-contractual representations.',
    recommendation: 'Ensure all material representations made during negotiation are incorporated into the written agreement.',
  },
  {
    id: 'CO04',
    category: 'compliance',
    severity: 'low',
    name: 'Unilateral Amendment Right',
    clauseText: 'company may amend this agreement at any time upon written notice to employee',
    signal: 'Company can change contract terms without employee consent.',
    missingProtection: 'Mutual consent requirement for amendments.',
    recommendation: 'Require mutual written consent for any amendments to the agreement.',
  },
];

// ─── Term vector computation ──────────────────────────────────────────────────

/** Tokenize text into lowercase words, removing stop words */
function tokenize(text: string): string[] {
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'not', 'no', 'nor', 'so',
    'yet', 'both', 'either', 'neither', 'each', 'any', 'all', 'this', 'that',
    'these', 'those', 'it', 'its', 'as', 'if', 'than', 'then', 'when',
    'where', 'which', 'who', 'whom', 'what', 'how', 'such', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
    'over', 'under', 'again', 'further', 'once', 'here', 'there',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Build a TF (term frequency) vector from text */
export function buildTermVector(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  const total = tokens.length || 1;
  const normalized = new Map<string, number>();
  for (const [term, count] of freq) {
    normalized.set(term, count / total);
  }
  return normalized;
}

/** Cosine similarity between two term vectors */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, weightA] of a) {
    const weightB = b.get(term) ?? 0;
    dot += weightA * weightB;
    magA += weightA * weightA;
  }
  for (const [, weightB] of b) {
    magB += weightB * weightB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Build the knowledge base (pre-compute vectors at module load) ─────────────

export const LEGAL_PATTERNS: LegalPattern[] = RAW_PATTERNS.map((p) => ({
  ...p,
  termVector: buildTermVector(p.clauseText),
}));

/** Cache: document text hash → matched patterns */
const matchCache = new Map<string, MatchedPattern[]>();

export interface MatchedPattern {
  pattern: LegalPattern;
  similarity: number;
  /** Verbatim excerpt from the document that triggered this match */
  matchedExcerpt: string;
}

/**
 * Find the top-N most similar legal risk patterns for a given document text.
 * Results are cached by a simple hash of the input text.
 */
export function findMatchingPatterns(
  documentText: string,
  topN = 8,
  minSimilarity = 0.08,
): MatchedPattern[] {
  // Simple cache key: length + first 100 chars
  const cacheKey = `${documentText.length}:${documentText.slice(0, 100)}`;
  if (matchCache.has(cacheKey)) return matchCache.get(cacheKey)!;

  const docVector = buildTermVector(documentText);

  // Score each pattern
  const scored = LEGAL_PATTERNS.map((pattern) => {
    const similarity = cosineSimilarity(docVector, pattern.termVector);
    // Find the best matching excerpt from the document
    const matchedExcerpt = findBestExcerpt(documentText, pattern);
    return { pattern, similarity, matchedExcerpt };
  });

  // Sort by similarity descending, filter by threshold
  const results = scored
    .filter((r) => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);

  matchCache.set(cacheKey, results);
  return results;
}

/** Find the sentence in the document most relevant to a pattern */
function findBestExcerpt(text: string, pattern: LegalPattern): string {
  const sentences = text.split(/(?<=[.;])\s+/);
  const patternVector = pattern.termVector;
  let bestScore = 0;
  let bestSentence = '';

  for (const sentence of sentences) {
    if (sentence.trim().length < 20) continue;
    const sentVector = buildTermVector(sentence);
    const score = cosineSimilarity(sentVector, patternVector);
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence.trim();
    }
  }

  return bestSentence.length > 200
    ? bestSentence.slice(0, 200).trimEnd() + '…'
    : bestSentence;
}

/** Get patterns by category */
export function getPatternsByCategory(category: KBCategory): LegalPattern[] {
  return LEGAL_PATTERNS.filter((p) => p.category === category);
}

/** Check if a document is missing a standard protection clause */
export function detectMissingProtections(documentText: string): string[] {
  const lower = documentText.toLowerCase();
  const missing: string[] = [];

  if (!/severance|separation pay/.test(lower)) {
    missing.push('No severance clause — standard employment agreements typically include severance provisions.');
  }
  if (!/dispute resolution|arbitration|mediation/.test(lower)) {
    missing.push('No dispute resolution clause — agreements typically specify how disputes will be resolved.');
  }
  if (!/governing law|applicable law/.test(lower)) {
    missing.push('No governing law clause — the applicable legal jurisdiction is not specified.');
  }
  if (!/force majeure|act of god|unforeseen circumstances/.test(lower)) {
    missing.push('No force majeure clause — the agreement does not address unforeseeable events.');
  }
  if (!/entire agreement|integration clause/.test(lower)) {
    missing.push('No entire agreement clause — prior representations may not be captured.');
  }
  if (!/amendment|modification/.test(lower)) {
    missing.push('No amendment clause — the process for modifying the agreement is not defined.');
  }

  return missing;
}
