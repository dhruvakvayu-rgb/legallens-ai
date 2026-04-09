import type { Tier } from './complexityContent';
import {
  findMatchingPatterns,
  detectMissingProtections,
  type MatchedPattern,
} from './legalKnowledgeBase';

// ─── Exported Types ───────────────────────────────────────────────────────────

export type Severity = 'high' | 'medium' | 'low';
export type Recommendation = 'safe' | 'review' | 'danger';

export type ClauseTopic =
  | 'termination'
  | 'nonCompete'
  | 'confidentiality'
  | 'payment'
  | 'renewal'
  | 'penalty'
  | 'governing'
  | 'other';
  

export interface ParsedRisk {
  title: string;
  severity: Severity;
  clause: string;
  desc: string;
  /** KB pattern ID if this risk was matched from the knowledge base */
  kbPatternId?: string;
  /** Similarity score from KB match (0–1) */
  kbSimilarity?: number;
  /** What standard protection is missing */
  missingProtection?: string;
}

export interface ParsedClause {
  id: number;
  sectionTitle: string;
  text: string;
  risk: 'high' | 'medium' | 'low' | 'none';
  topic: ClauseTopic;
}

export interface ImportantClause {
  label: string;
  value: string;
}

export type GuidanceType = 'safety' | 'warning' | 'suggestion' | 'redflag';
export type GuidancePriority = 'high' | 'medium' | 'low';

export interface GuidanceItem {
  type: GuidanceType;
  priority: GuidancePriority;
  text: string;
}

export interface DocumentAnalysis {
  title: string;
  documentType: string;
  parties: string[];
  riskScore: number;
  recommendation: Recommendation;
  recommendationReason: string;
  summaries: Record<Tier, string>;
  risks: ParsedRisk[];
  obligations: Record<Tier, string[]>;
  importantClauses: ImportantClause[];
  suggestions: string[];
  parsedClauses: ParsedClause[];
  chatContext: string;
  /** Guidance & Safety Recommendations */
  guidance: GuidanceItem[];
  /** Top KB pattern matches for this document */
  kbMatches: MatchedPattern[];
  /** Standard protections absent from this document */
  missingProtections: string[];
  /** Financial & transaction risk analysis */
  financialRisk: FinancialRisk;
}

// ─── Financial Risk Types ─────────────────────────────────────────────────────

export type FinancialRiskLevel = 'low' | 'medium' | 'high';

export interface FinancialRisk {
  /** 0–30 points added to the base clause risk score */
  score: number;
  clarityLevel: FinancialRiskLevel;
  paymentMethodRisk: FinancialRiskLevel;
  timelineRisk: FinancialRiskLevel;
  extractedAmounts: string[];
  extractedDates: string[];
  paymentMethods: string[];
  installments: string[];
  observations: string[];
  scoreBreakdown: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Return up to `maxLen` chars of a string, trimmed, with ellipsis if cut. */
function excerpt(text: string, maxLen = 200): string {
  const t = text.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen).trimEnd() + '…';
}

/** Find the first sentence/clause in `text` that contains any of `keywords`. */
function findClause(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  // Try sentence-level match first
  const sentences = text.split(/(?<=[.;])\s+/);
  for (const s of sentences) {
    const sl = s.toLowerCase();
    if (keywords.some((k) => sl.includes(k))) return excerpt(s.trim());
  }
  // Fallback: find the paragraph containing the keyword
  const paras = text.split(/\n{1,}/);
  for (const p of paras) {
    const pl = p.toLowerCase();
    if (keywords.some((k) => pl.includes(k))) return excerpt(p.trim());
  }
  return '';
}

// ─── 1. Title Extraction ─────────────────────────────────────────────────────

function extractTitle(text: string): string {
  const lines = text.split('\n').slice(0, 10);
  const titleKeywords = /agreement|contract|lease|nda|non.disclosure|license|partnership|purchase|loan/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // All-caps line (at least 4 chars, not a number)
    if (/^[A-Z][A-Z\s\-&,.']{3,}$/.test(trimmed)) return trimmed;
    // Contains title keywords
    if (titleKeywords.test(trimmed) && trimmed.length < 120) return trimmed;
  }

  // Fallback: infer from content
  const lower = text.toLowerCase();
  if (lower.includes('employment') || lower.includes('employee')) return 'Employment Agreement';
  if (lower.includes('non-disclosure') || lower.includes('nda')) return 'Non-Disclosure Agreement';
  if (lower.includes('lease') || lower.includes('tenant') || lower.includes('landlord')) return 'Lease Agreement';
  if (lower.includes('service') && lower.includes('provider')) return 'Service Agreement';
  if (lower.includes('license') || lower.includes('licensor')) return 'License Agreement';
  if (lower.includes('partnership')) return 'Partnership Agreement';
  if (lower.includes('purchase') || lower.includes('buyer') || lower.includes('seller')) return 'Purchase Agreement';
  if (lower.includes('loan') || lower.includes('borrower') || lower.includes('lender')) return 'Loan Agreement';
  return 'Legal Agreement';
}

// ─── 2. Document Type Inference ──────────────────────────────────────────────

function inferDocumentType(text: string, title: string): string {
  const combined = (title + ' ' + text).toLowerCase();
  if (/employment|employee|employer|salary|wages|job title/.test(combined)) return 'Employment Agreement';
  if (/non.disclosure|nda|confidential(ity)? agreement/.test(combined)) return 'Non-Disclosure Agreement';
  if (/lease|tenant|landlord|rent|premises/.test(combined)) return 'Lease Agreement';
  if (/service(s)? agreement|service provider|scope of (work|services)/.test(combined)) return 'Service Agreement';
  if (/licen[sc]e|licensor|licensee/.test(combined)) return 'License Agreement';
  if (/partnership|general partner|limited partner/.test(combined)) return 'Partnership Agreement';
  if (/purchase|buyer|seller|sale of/.test(combined)) return 'Purchase Agreement';
  if (/loan|borrower|lender|principal amount|interest rate/.test(combined)) return 'Loan Agreement';
  return 'Legal Agreement';
}

// ─── 3. Party Extraction ─────────────────────────────────────────────────────

function extractParties(text: string): string[] {
  // Pattern: "between [X] and [Y]"
  const betweenMatch = text.match(
    /between\s+([A-Z][A-Za-z\s,.'&]+?)\s+(?:\("[\w\s]+"\)\s*)?and\s+([A-Z][A-Za-z\s,.'&]+?)(?:\s*\(|[,.]|\n)/
  );
  if (betweenMatch) {
    const a = betweenMatch[1].trim().replace(/\s+/g, ' ');
    const b = betweenMatch[2].trim().replace(/\s+/g, ' ');
    if (a.length > 1 && b.length > 1) return [a, b];
  }

  // Pattern: "[X] agrees" or "[X] shall"
  const agreeMatches = [...text.matchAll(/([A-Z][A-Za-z\s,.'&]{2,40}?)\s+(?:agrees|shall)\b/g)];
  const found = agreeMatches
    .map((m) => m[1].trim())
    .filter((p) => p.length > 1 && !/^(the|this|each|either|both|party|parties)$/i.test(p));
  const unique = [...new Set(found)];
  if (unique.length >= 2) return [unique[0], unique[1]];
  if (unique.length === 1) return [unique[0], 'Party B'];

  return ['Party A', 'Party B'];
}

// ─── 4. Section Splitting ────────────────────────────────────────────────────

interface Section {
  title: string;
  text: string;
}

function splitSections(text: string): Section[] {
  // Match numbered headings like "1.", "1.1", "Section 1", "ARTICLE I", or ALL-CAPS lines
  const headingRe = /^(?:(?:section|article|clause)\s+[\dIVXivx]+\.?|[\d]+(?:\.\d+)*\.?\s+[A-Z]|[A-Z][A-Z\s]{4,})/m;
  const lines = text.split('\n');
  const sections: Section[] = [];
  let currentTitle = 'Preamble';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentLines.push(line);
      continue;
    }
    if (headingRe.test(trimmed) && trimmed.length < 120) {
      if (currentLines.join('').trim()) {
        sections.push({ title: currentTitle, text: currentLines.join('\n').trim() });
      }
      currentTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.join('').trim()) {
    sections.push({ title: currentTitle, text: currentLines.join('\n').trim() });
  }
  return sections.length ? sections : [{ title: 'Full Document', text: text.trim() }];
}

// ─── 5. Risk Detection ───────────────────────────────────────────────────────

interface DetectedFlags {
  hasTerminationNoSeverance: boolean;
  hasNonCompete: boolean;
  nonCompeteIsPostEmployment: boolean;
  hasConfidentiality: boolean;
  confidentialityIsPerpetual: boolean;
  hasPenalty: boolean;
  hasIPAssignment: boolean;
  hasLiabilityCap: boolean;
  hasDiscretionaryComp: boolean;
  hasSeverance: boolean;
  hasArbitration: boolean;
  hasAutoRenewal: boolean;
  nonCompeteIsVague: boolean;
}

function detectFlags(text: string): DetectedFlags {
  const lower = text.toLowerCase();
  const hasSeverance = /severance|separation pay|termination pay/.test(lower);
  const hasTermination = /terminat(e|ion|ed)/.test(lower);
  const hasTerminationNoSeverance = hasTermination && !hasSeverance;

  const nonCompeteMatch = /non.compet(e|ition)|compete with|competing business/.test(lower);
  const nonCompeteIsPostEmployment = nonCompeteMatch && /after (termination|employment|leaving|separation)|post.employment/.test(lower);
  const nonCompeteIsVague = nonCompeteMatch && !/\d+\s*(month|year|mile|kilometer|km|radius)/.test(lower);

  const hasConfidentiality = /confidential(ity)?|non.disclosure|proprietary information/.test(lower);
  const confidentialityIsPerpetual = hasConfidentiality && /perpetual|indefinite(ly)?|no expir|forever|without (time )?limit/.test(lower);

  const hasPenalty = /penalt(y|ies)|liquidated damages|damages of|fine of|\$[\d,]+\s*(per|for each)/.test(lower);
  const hasIPAssignment = /intellectual property|ip assignment|assign(s|ed)? all rights|work.for.hire|work made for hire/.test(lower);
  const hasLiabilityCap = /limit(ation)? of liability|liability (shall be |is )?limited|cap on liability|maximum liability/.test(lower);
  const hasDiscretionaryComp = /discretion(ary)?|at (the )?(sole )?discretion|may (elect|choose|decide) to (pay|compensate)/.test(lower);
  const hasArbitration = /arbitrat(ion|e)|dispute resolution/.test(lower);
  const hasAutoRenewal = /auto(matically)?[\s-]renew|renew(s|ed)? automatically|automatic renewal/.test(lower);

  return {
    hasTerminationNoSeverance,
    hasNonCompete: nonCompeteMatch,
    nonCompeteIsPostEmployment,
    hasConfidentiality,
    confidentialityIsPerpetual,
    hasPenalty,
    hasIPAssignment,
    hasLiabilityCap,
    hasDiscretionaryComp,
    hasSeverance,
    hasArbitration,
    hasAutoRenewal,
    nonCompeteIsVague,
  };
}

function buildRisks(text: string, flags: DetectedFlags, kbMatches: MatchedPattern[]): ParsedRisk[] {
  const risks: ParsedRisk[] = [];

  // Helper: find the best KB match for a given category
  const kbMatch = (category: string) =>
    kbMatches.find((m) => m.pattern.category === category);

  if (flags.hasTerminationNoSeverance) {
    const clause = findClause(text, ['terminat']) || 'See termination section.';
    const kb = kbMatch('termination');
    risks.push({
      title: 'Termination Without Severance',
      severity: 'high',
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : 'The agreement allows termination without any severance or compensation obligation, leaving you without financial protection upon dismissal.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Severance pay, notice period, or cause requirement.',
    });
  }

  if (flags.hasNonCompete) {
    const severity: Severity = flags.nonCompeteIsPostEmployment ? 'high' : 'medium';
    const clause = findClause(text, ['non-compet', 'non compet', 'compete']) || 'See non-compete section.';
    const kb = kbMatches.find((m) => m.pattern.category === 'nonCompete');
    risks.push({
      title: flags.nonCompeteIsPostEmployment ? 'Post-Employment Non-Compete Clause' : 'Non-Compete Restriction',
      severity,
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : flags.nonCompeteIsPostEmployment
          ? 'A non-compete clause restricts your ability to work in the same industry after this agreement ends. Scope or duration may be overly broad.'
          : 'A non-compete restriction limits your ability to engage with competing businesses during the term of this agreement.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Reasonable geographic scope, defined duration, and industry specificity.',
    });
  }

  if (flags.hasConfidentiality) {
    const severity: Severity = flags.confidentialityIsPerpetual ? 'high' : 'medium';
    const clause = findClause(text, ['confidential', 'non-disclosure', 'proprietary']) || 'See confidentiality section.';
    const kb = kbMatches.find((m) => m.pattern.category === 'confidentiality');
    risks.push({
      title: flags.confidentialityIsPerpetual ? 'Perpetual Confidentiality Obligation' : 'Confidentiality Obligation',
      severity,
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : flags.confidentialityIsPerpetual
          ? 'Confidentiality obligations have no expiration date, binding you indefinitely even after the agreement ends.'
          : 'You are required to keep certain information confidential for the duration specified in the agreement.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Time-limited confidentiality obligation.',
    });
  }

  if (flags.hasPenalty) {
    const clause = findClause(text, ['penalt', 'liquidated damages', 'damages of', 'fine of']) || 'See penalties section.';
    const kb = kbMatches.find((m) => m.pattern.category === 'liability' || m.pattern.id === 'L01');
    risks.push({
      title: 'Penalty or Liquidated Damages Clause',
      severity: 'high',
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : 'The agreement includes financial penalties or pre-set damages for breach, which could result in significant monetary liability.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Cap on penalty amounts and proportionality requirement.',
    });
  }

  if (flags.hasIPAssignment) {
    const clause = findClause(text, ['intellectual property', 'ip assignment', 'assign', 'work-for-hire', 'work made for hire']) || 'See IP section.';
    const kb = kbMatches.find((m) => m.pattern.category === 'ip');
    risks.push({
      title: 'Intellectual Property Assignment',
      severity: 'high',
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : 'Any work or inventions created under this agreement may be automatically assigned to the other party, including potentially pre-existing work.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Carve-out for pre-existing IP and personal projects.',
    });
  }

  if (flags.hasLiabilityCap) {
    const clause = findClause(text, ['limitation of liability', 'liability shall', 'liability is limited', 'maximum liability']) || 'See liability section.';
    const kb = kbMatches.find((m) => m.pattern.id === 'L02' || m.pattern.id === 'L03');
    risks.push({
      title: 'Liability Cap',
      severity: 'medium',
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : 'The agreement limits the maximum recoverable damages, which may leave you undercompensated in the event of a significant breach.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Adequate liability cap relative to contract value.',
    });
  }

  if (flags.hasDiscretionaryComp) {
    const clause = findClause(text, ['discretion', 'may elect', 'may choose', 'may decide']) || 'See compensation section.';
    const kb = kbMatches.find((m) => m.pattern.id === 'P01' || m.pattern.id === 'P02');
    risks.push({
      title: 'Discretionary Compensation',
      severity: 'medium',
      clause: kb?.matchedExcerpt || clause,
      desc: kb
        ? `${kb.pattern.signal} Similar to pattern: "${kb.pattern.name}". ${kb.pattern.missingProtection}`
        : 'Certain compensation elements (e.g., bonuses) are at the sole discretion of the other party, providing no guaranteed entitlement.',
      kbPatternId: kb?.pattern.id,
      kbSimilarity: kb?.similarity,
      missingProtection: kb?.pattern.missingProtection ?? 'Objective bonus criteria and minimum guaranteed amounts.',
    });
  }

  // Add KB-only risks for high-similarity matches not already covered
  const coveredCategories = new Set(risks.map((r) => r.kbPatternId?.slice(0, 2)));
  for (const match of kbMatches) {
    if (match.similarity < 0.15) continue;
    if (match.pattern.severity === 'low') continue;
    // Skip if already covered by a flag-based risk
    const alreadyCovered = risks.some((r) => r.kbPatternId === match.pattern.id);
    if (alreadyCovered) continue;
    // Only add if not already covered by category
    const catPrefix = match.pattern.id.slice(0, 2);
    if (coveredCategories.has(catPrefix)) continue;

    risks.push({
      title: match.pattern.name,
      severity: match.pattern.severity,
      clause: match.matchedExcerpt || `Pattern matched: ${match.pattern.clauseText.slice(0, 100)}…`,
      desc: `${match.pattern.signal} Similar to known high-risk pattern "${match.pattern.name}" (match confidence: ${Math.round(match.similarity * 100)}%). ${match.pattern.missingProtection}`,
      kbPatternId: match.pattern.id,
      kbSimilarity: match.similarity,
      missingProtection: match.pattern.missingProtection,
    });
    coveredCategories.add(catPrefix);
  }

  return risks;
}

// ─── Document Fact Extractor ──────────────────────────────────────────────────
// Pulls concrete values from the document text so every output section
// references real names, amounts, dates, and locations instead of generics.

interface DocumentFacts {
  /** Monetary amounts found (e.g. "$5,00,000", "₹5 lakh", "$120,000/year") */
  amounts: string[];
  /** Dates found (e.g. "January 1, 2026", "01/01/2026") */
  dates: string[];
  /** Durations found (e.g. "2 years", "90 days", "6 months") */
  durations: string[];
  /** Locations / property names found */
  locations: string[];
  /** Job title / role if present */
  jobTitle: string;
  /** Effective / start date */
  effectiveDate: string;
  /** Termination notice period */
  noticePeriod: string;
  /** Compensation amount */
  compensationAmount: string;
  /** Non-compete duration */
  nonCompeteDuration: string;
  /** Governing jurisdiction */
  jurisdiction: string;
  /** Property description (for real estate docs) */
  propertyDesc: string;
  /** Purpose / scope of work */
  purposeOrScope: string;
}

function extractFacts(text: string): DocumentFacts {
  const NA = 'Not specified in document';

  // ── Monetary amounts ──────────────────────────────────────────────────────
  const amountMatches = [
    ...text.matchAll(/(?:₹|Rs\.?|INR|USD|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:lakh|crore|thousand|million|billion|per\s+(?:year|month|annum|hour)))?/gi),
    ...text.matchAll(/[\d,]+(?:\.\d{1,2})?\s*(?:lakh|crore)\s*(?:rupees?)?/gi),
  ];
  const amounts = [...new Set(amountMatches.map(m => m[0].trim()))].slice(0, 4);

  // ── Dates ─────────────────────────────────────────────────────────────────
  const dateMatches = [
    ...text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi),
    ...text.matchAll(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g),
    ...text.matchAll(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b/gi),
  ];
  const dates = [...new Set(dateMatches.map(m => m[0].trim()))].slice(0, 3);

  // ── Durations ─────────────────────────────────────────────────────────────
  const durationMatches = text.matchAll(/\b(\d+)\s*(calendar\s+)?(days?|weeks?|months?|years?)\b/gi);
  const durations = [...new Set([...durationMatches].map(m => m[0].trim()))].slice(0, 4);

  // ── Locations / property ──────────────────────────────────────────────────
  const locationMatches = [
    ...text.matchAll(/(?:flat|apartment|house|property|premises|plot|site|building|office)\s+(?:no\.?\s*)?[\w\-\/]+(?:\s+in\s+["']?([A-Z][A-Za-z\s]+)["']?)?/gi),
    ...text.matchAll(/(?:located at|situated at|address:?)\s+([^\n,]{5,80})/gi),
    ...text.matchAll(/["']([A-Z][A-Z\s]{3,40})["']/g),  // quoted property names
  ];
  const locations = [...new Set(locationMatches.map(m => (m[1] || m[0]).trim()))].slice(0, 3);

  // ── Job title ─────────────────────────────────────────────────────────────
  let jobTitle = NA;
  const jobMatch = text.match(/(?:position|role|title|designation|hired as|employed as|appointed as)[:\s]+([A-Za-z][A-Za-z\s\-]{2,50}?)(?:[,.\n]|$)/i);
  if (jobMatch) jobTitle = jobMatch[1].trim();

  // ── Effective date ────────────────────────────────────────────────────────
  let effectiveDate = NA;
  const effMatch = text.match(/(?:effective|commencing|entered into|dated?|as of)[:\s]+([A-Za-z0-9\s,\/\-\.]{5,40}?)(?:[,.\n]|$)/i);
  if (effMatch) effectiveDate = effMatch[1].trim();
  else if (dates.length > 0) effectiveDate = dates[0];

  // ── Notice period ─────────────────────────────────────────────────────────
  let noticePeriod = NA;
  const noticeMatch = text.match(/(\d+)\s*(calendar\s+)?(days?|weeks?|months?)\s*(?:written\s+)?(?:prior\s+)?notice/i);
  if (noticeMatch) noticePeriod = noticeMatch[0].trim();

  // ── Compensation ──────────────────────────────────────────────────────────
  let compensationAmount = NA;
  const compMatch = text.match(
    /(?:salary|compensation|base pay|annual pay|wage|remuneration|fee)[^\n.;]{0,30}?(?:of\s+|:\s*|is\s+)?((?:₹|Rs\.?|INR|USD|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:lakh|crore|thousand|million|per\s+(?:year|month|annum|hour))?)?)/i
  );
  if (compMatch) compensationAmount = compMatch[1]?.trim() || compMatch[0].trim();
  else if (amounts.length > 0) compensationAmount = amounts[0];

  // ── Non-compete duration ──────────────────────────────────────────────────
  let nonCompeteDuration = NA;
  const ncDurMatch = text.match(/(?:non.compet|compet)[^\n.]{0,60}?(\d+)\s*(months?|years?)/i);
  if (ncDurMatch) nonCompeteDuration = `${ncDurMatch[1]} ${ncDurMatch[2]}`;

  // ── Jurisdiction ──────────────────────────────────────────────────────────
  let jurisdiction = NA;
  const jurMatch = text.match(/(?:governed by|laws of|jurisdiction of|courts? of)\s+(?:the\s+)?(?:state of\s+)?([A-Z][A-Za-z\s]{2,40}?)(?:[,.\n]|$)/i);
  if (jurMatch) jurisdiction = jurMatch[1].trim();

  // ── Property description ──────────────────────────────────────────────────
  let propertyDesc = NA;
  const propMatch = text.match(/(?:flat|apartment|house|property|premises|plot)\s+(?:no\.?\s*[\w\-\/]+\s*)?(?:in|at|known as|called)\s+["']?([A-Za-z0-9\s\-,\.]{5,80})["']?/i);
  if (propMatch) propertyDesc = propMatch[0].trim().slice(0, 120);

  // ── Purpose / scope ───────────────────────────────────────────────────────
  let purposeOrScope = NA;
  const purposeMatch = text.match(/(?:purpose|scope of work|services to be|work includes?|project)[:\s]+([^\n.]{10,120})/i);
  if (purposeMatch) purposeOrScope = purposeMatch[1].trim();

  return {
    amounts,
    dates,
    durations,
    locations,
    jobTitle,
    effectiveDate,
    noticePeriod,
    compensationAmount,
    nonCompeteDuration,
    jurisdiction,
    propertyDesc,
    purposeOrScope,
  };
}



function buildSummaries(
  docType: string,
  parties: string[],
  flags: DetectedFlags,
  riskScore: number,
  facts: DocumentFacts,
): Record<Tier, string> {
  const [partyA, partyB] = parties;
  const NA = 'Not specified in document';
  const riskLabel = riskScore >= 70 ? 'high-risk' : riskScore >= 35 ? 'moderate-risk' : 'low-risk';

  const factParts: string[] = [];
  if (facts.effectiveDate !== NA) factParts.push(`effective ${facts.effectiveDate}`);
  if (facts.compensationAmount !== NA) factParts.push(`compensation of ${facts.compensationAmount}`);
  if (facts.jobTitle !== NA) factParts.push(`role: ${facts.jobTitle}`);
  if (facts.propertyDesc !== NA) factParts.push(`property: ${facts.propertyDesc}`);
  if (facts.purposeOrScope !== NA) factParts.push(`scope: ${facts.purposeOrScope.slice(0, 80)}`);
  if (facts.jurisdiction !== NA) factParts.push(`governed by ${facts.jurisdiction}`);
  const factSentence = factParts.length ? `Key details: ${factParts.join('; ')}.` : '';

  const topics: string[] = [];
  if (flags.hasTerminationNoSeverance) topics.push('termination without severance');
  if (flags.hasNonCompete) {
    topics.push(facts.nonCompeteDuration !== NA ? `non-compete (${facts.nonCompeteDuration})` : 'non-compete restrictions');
  }
  if (flags.hasConfidentiality) topics.push(flags.confidentialityIsPerpetual ? 'perpetual confidentiality' : 'confidentiality obligations');
  if (flags.hasPenalty) topics.push(facts.amounts.length > 0 ? `financial penalties (${facts.amounts[0]})` : 'financial penalties');
  if (flags.hasIPAssignment) topics.push('IP assignment');
  if (flags.hasLiabilityCap) topics.push('liability limitations');
  if (flags.hasDiscretionaryComp) topics.push('discretionary compensation');
  const topicStr = topics.length ? topics.join(', ') : 'standard contractual terms';
  const noticePart = facts.noticePeriod !== NA ? ` Notice period: ${facts.noticePeriod}.` : '';

  return {
    eli5:
      `This is a ${docType} between ${partyA} and ${partyB}` +
      (facts.effectiveDate !== NA ? `, dated ${facts.effectiveDate}` : '') + `. ` +
      `It covers ${topicStr}. ` +
      (facts.compensationAmount !== NA ? `The amount involved is ${facts.compensationAmount}. ` : '') +
      (riskScore >= 35 ? `Some parts could be tricky — a grown-up should check it carefully before signing.` : `It looks mostly fair and straightforward.`),

    simple:
      `This ${docType} is between ${partyA} and ${partyB}. ` +
      (facts.effectiveDate !== NA ? `Dated ${facts.effectiveDate}. ` : '') +
      `It covers ${topicStr}. ` +
      (facts.compensationAmount !== NA ? `Compensation: ${facts.compensationAmount}.${noticePart} ` : '') +
      `Overall risk: ${riskLabel}. ` +
      (riskScore >= 35 ? `There are clauses worth reviewing before signing.` : `No major red flags detected.`),

    balanced:
      `This ${docType} establishes the rights and obligations of ${partyA} and ${partyB}. ` +
      (factSentence ? factSentence + ' ' : '') +
      `Key provisions: ${topicStr}. ` +
      `Risk profile: ${riskLabel} (score: ${riskScore}/100). ` +
      (flags.hasTerminationNoSeverance ? `Termination provisions lack severance protections.${noticePart} ` : '') +
      (flags.confidentialityIsPerpetual ? `Confidentiality obligations are perpetual with no expiry. ` : '') +
      `Review highlighted clauses before executing.`,

    detailed:
      `This ${docType} between ${partyA} and ${partyB}` +
      (facts.effectiveDate !== NA ? ` (effective ${facts.effectiveDate})` : '') + ` contains provisions governing ${topicStr}. ` +
      (facts.compensationAmount !== NA ? `Compensation is stated as ${facts.compensationAmount}. ` : '') +
      (facts.jobTitle !== NA ? `The role is ${facts.jobTitle}. ` : '') +
      `Risk score: ${riskScore}/100 (${riskLabel}). ` +
      (flags.hasTerminationNoSeverance ? `The termination clause permits dismissal without severance${noticePart ? ` — ${noticePart}` : ''}, creating financial exposure. ` : '') +
      (flags.hasNonCompete && flags.nonCompeteIsPostEmployment ? `A post-employment non-compete${facts.nonCompeteDuration !== NA ? ` of ${facts.nonCompeteDuration}` : ''} may restrict future professional activity. ` : '') +
      (flags.confidentialityIsPerpetual ? `Perpetual confidentiality obligations impose indefinite restrictions. ` : '') +
      (flags.hasPenalty ? `Penalty clauses${facts.amounts.length > 0 ? ` (${facts.amounts[0]})` : ''} introduce significant financial risk. ` : '') +
      `Legal counsel is recommended prior to execution.`,

    expert:
      `This ${docType} (parties: ${partyA}; ${partyB}` +
      (facts.effectiveDate !== NA ? `; effective ${facts.effectiveDate}` : '') + `) presents a ${riskLabel} contractual framework (risk score: ${riskScore}/100). ` +
      (factSentence ? factSentence + ' ' : '') +
      `Material provisions: ${topicStr}. ` +
      (flags.hasTerminationNoSeverance ? `The at-will termination clause lacks severance consideration${noticePart ? ` and specifies ${noticePart}` : ''}, potentially unconscionable in certain jurisdictions. ` : '') +
      (flags.hasNonCompete && flags.nonCompeteIsPostEmployment ? `Post-employment restraint of trade covenants${facts.nonCompeteDuration !== NA ? ` (${facts.nonCompeteDuration})` : ''} require scrutiny for reasonableness under applicable law. ` : '') +
      (flags.confidentialityIsPerpetual ? `Perpetual confidentiality obligations may be unenforceable absent legitimate protectable interests. ` : '') +
      (flags.hasPenalty ? `Liquidated damages provisions${facts.amounts.length > 0 ? ` (${facts.amounts[0]})` : ''} must satisfy the genuine pre-estimate test. ` : '') +
      (facts.jurisdiction !== NA ? `Governed by ${facts.jurisdiction}. ` : '') +
      `Comprehensive legal review and negotiation of flagged provisions is strongly advised.`,
  };
}

// ─── 7. Obligations ──────────────────────────────────────────────────────────

function buildObligations(
  docType: string,
  parties: string[],
  flags: DetectedFlags,
  facts: DocumentFacts,
): Record<Tier, string[]> {
  const [partyA, partyB] = parties;
  const NA = 'Not specified in document';

  const core: string[] = [];
  if (flags.hasConfidentiality) core.push(`Keep certain information secret`);
  if (flags.hasNonCompete) core.push(`Avoid working with competitors`);
  if (flags.hasIPAssignment) core.push(`Hand over any work or inventions created`);
  if (flags.hasPenalty) core.push(`Pay fines if rules are broken`);
  if (!core.length) core.push(`Follow the rules set out in the agreement`);

  const simple: string[] = [];
  if (flags.hasConfidentiality) simple.push(`${partyA} must keep confidential information private`);
  if (flags.hasNonCompete) simple.push(`${partyA} must not work for or start a competing business`);
  if (flags.hasIPAssignment) simple.push(`${partyA} must assign intellectual property to ${partyB}`);
  if (flags.hasPenalty) simple.push(`${partyA} may owe financial penalties for breach`);
  if (flags.hasTerminationNoSeverance) simple.push(`Either party may terminate without severance`);
  if (!simple.length) simple.push(`Both parties must comply with the terms of the ${docType}`);

  const balanced: string[] = [
    ...simple,
    flags.hasLiabilityCap ? `Liability is capped as specified in the agreement` : '',
    flags.hasDiscretionaryComp ? `Certain compensation is subject to ${partyB}'s discretion` : '',
    flags.hasArbitration ? `Disputes must be resolved through arbitration` : '',
  ].filter(Boolean) as string[];

  const detailed: string[] = [
    ...balanced,
    flags.hasConfidentiality ? `${partyA} must maintain confidentiality of all proprietary and trade secret information disclosed by ${partyB}` : '',
    flags.hasNonCompete && flags.nonCompeteIsPostEmployment ? `${partyA} is subject to post-employment non-compete restrictions` : '',
    flags.hasIPAssignment ? `All work product and inventions created by ${partyA} are assigned to ${partyB} upon creation` : '',
    flags.hasPenalty ? `Breach of material terms may trigger liquidated damages or penalty provisions` : '',
  ].filter(Boolean) as string[];

  const expert: string[] = [
    ...detailed,
    flags.hasConfidentiality ? `${partyA} bears a duty of confidentiality with respect to all non-public information, trade secrets, and proprietary data of ${partyB}, subject to applicable statutory exceptions` : '',
    flags.hasNonCompete ? `Restraint of trade covenants bind ${partyA} to the extent enforceable under governing law` : '',
    flags.hasIPAssignment ? `Statutory and common law IP rights vest in ${partyB} pursuant to the assignment and work-for-hire provisions herein` : '',
    flags.hasLiabilityCap ? `Aggregate liability exposure is contractually capped; consequential and indirect damages are excluded to the extent permitted by law` : '',
    flags.hasArbitration ? `All disputes are subject to binding arbitration; rights to jury trial and class action are waived` : '',
  ].filter(Boolean) as string[];

  return {
    eli5: core,
    simple,
    balanced: balanced.length ? balanced : simple,
    detailed: detailed.length ? detailed : balanced,
    expert: expert.length ? expert : detailed,
  };
}

// ─── 8. Important Clauses ────────────────────────────────────────────────────

function extractImportantClauses(text: string): ImportantClause[] {
  const NOT_SPECIFIED = 'Not specified in document';

  // Compensation
  let compensation = NOT_SPECIFIED;
  const compMatch = text.match(
    /(?:salary|compensation|base pay|annual pay|wage)[^\n.;]{0,20}(?:of\s+)?(\$[\d,]+(?:\.\d{2})?(?:\s*(?:per\s+(?:year|annum|month|hour)|annually|monthly))?)/i
  );
  if (compMatch) compensation = compMatch[0].trim().slice(0, 200);

  // Notice Period
  let noticePeriod = NOT_SPECIFIED;
  const noticeMatch = text.match(/(\d+)\s*(calendar\s+)?(days?|weeks?|months?)\s*(?:written\s+)?notice/i);
  if (noticeMatch) noticePeriod = noticeMatch[0].trim();

  // Termination Conditions
  let terminationConditions = NOT_SPECIFIED;
  const termClause = findClause(text, ['terminat']);
  if (termClause) terminationConditions = termClause;

  // Renewal Terms
  let renewalTerms = NOT_SPECIFIED;
  const renewalClause = findClause(text, ['renew', 'renewal', 'extend', 'extension']);
  if (renewalClause) renewalTerms = renewalClause;

  // Penalties / Damages
  let penalties = NOT_SPECIFIED;
  const penaltyClause = findClause(text, ['penalt', 'liquidated damages', 'damages of', 'fine of']);
  if (penaltyClause) penalties = penaltyClause;

  // Governing Law
  let governingLaw = NOT_SPECIFIED;
  const govMatch = text.match(/governed\s+by\s+(?:the\s+laws?\s+of\s+)?([A-Z][A-Za-z\s,]{2,60}?)(?:[.,;]|\n)/);
  if (govMatch) governingLaw = govMatch[0].trim();

  return [
    { label: 'Compensation', value: compensation },
    { label: 'Notice Period', value: noticePeriod },
    { label: 'Termination Conditions', value: terminationConditions },
    { label: 'Renewal Terms', value: renewalTerms },
    { label: 'Penalties / Damages', value: penalties },
    { label: 'Governing Law', value: governingLaw },
  ];
}

// ─── 9. Suggestions ──────────────────────────────────────────────────────────

function buildSuggestions(flags: DetectedFlags, kbMatches: MatchedPattern[], missingProtections: string[]): string[] {
  const suggestions: string[] = [];

  // Flag-based suggestions
  if (flags.hasTerminationNoSeverance && !flags.hasSeverance) {
    suggestions.push('Negotiate a severance clause to ensure financial protection upon termination.');
  }
  if (flags.hasNonCompete && flags.nonCompeteIsVague) {
    suggestions.push('Request that the non-compete clause specify a clear duration, geographic scope, and industry definition.');
  }
  if (flags.confidentialityIsPerpetual) {
    suggestions.push('Seek to limit the confidentiality obligation to a defined term (e.g., 2–5 years) rather than perpetual.');
  }
  if (flags.hasDiscretionaryComp) {
    suggestions.push('Request objective criteria or minimum thresholds for any discretionary compensation elements.');
  }
  if (flags.hasIPAssignment) {
    suggestions.push('Ensure pre-existing intellectual property is explicitly carved out from the IP assignment clause.');
  }
  if (!flags.hasArbitration) {
    suggestions.push('Consider adding a dispute resolution or arbitration clause to avoid costly litigation.');
  }
  if (flags.hasAutoRenewal) {
    suggestions.push('Note the automatic renewal clause and calendar a reminder before the renewal window closes.');
  }
  if (flags.hasPenalty) {
    suggestions.push('Review penalty and liquidated damages amounts to ensure they are proportionate and legally enforceable.');
  }

  // KB-sourced recommendations for high-similarity matches
  const addedRecs = new Set(suggestions);
  for (const match of kbMatches.slice(0, 5)) {
    if (match.similarity >= 0.12 && !addedRecs.has(match.pattern.recommendation)) {
      suggestions.push(match.pattern.recommendation);
      addedRecs.add(match.pattern.recommendation);
    }
  }

  // Missing protection suggestions
  for (const missing of missingProtections.slice(0, 3)) {
    if (!addedRecs.has(missing)) {
      suggestions.push(missing);
      addedRecs.add(missing);
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('No major gaps detected. Have a qualified attorney review the agreement before signing.');
  }

  return suggestions;
}

// ─── Guidance & Safety Recommendations ───────────────────────────────────────

function buildGuidance(
  flags: DetectedFlags,
  risks: ParsedRisk[],
  recommendation: Recommendation,
  parties: string[],
  importantClauses: ImportantClause[],
  missingProtections: string[],
): GuidanceItem[] {
  const items: GuidanceItem[] = [];
  const [partyA] = parties;

  // ── Red flag alerts (always first) ──────────────────────────────────────
  if (recommendation === 'danger') {
    items.push({
      type: 'redflag',
      priority: 'high',
      text: `High overall risk detected. Do NOT sign this document without independent legal review. ${risks.filter(r => r.severity === 'high').map(r => r.title).join(', ')} require immediate attention.`,
    });
  }

  if (flags.hasTerminationNoSeverance) {
    items.push({
      type: 'redflag',
      priority: 'high',
      text: 'Red flag: This document allows termination without severance or notice. You could lose your income immediately with no financial safety net.',
    });
  }

  if (flags.confidentialityIsPerpetual) {
    items.push({
      type: 'redflag',
      priority: 'high',
      text: 'Red flag: The confidentiality obligation has no end date. You will be bound by it indefinitely — even decades after this agreement ends.',
    });
  }

  if (flags.hasIPAssignment) {
    items.push({
      type: 'redflag',
      priority: 'high',
      text: `Red flag: All intellectual property created by ${partyA} is assigned to the other party. This may include work done on personal time or pre-existing projects.`,
    });
  }

  if (flags.hasPenalty) {
    const penaltyClause = importantClauses.find(c => c.label === 'Penalties / Damages');
    const penaltyDetail = penaltyClause && penaltyClause.value !== 'Not specified in document'
      ? ` Detected clause: "${penaltyClause.value.slice(0, 80)}…"`
      : '';
    items.push({
      type: 'redflag',
      priority: 'high',
      text: `Red flag: Financial penalties or liquidated damages are present.${penaltyDetail} Verify the amounts are proportionate before signing.`,
    });
  }

  // ── Preventive actions (safety) ──────────────────────────────────────────
  const compClause = importantClauses.find(c => c.label === 'Compensation');
  if (compClause?.value === 'Not specified in document') {
    items.push({
      type: 'safety',
      priority: 'high',
      text: 'Verify that compensation terms are clearly documented before signing. Vague or missing payment terms create significant financial risk.',
    });
  } else if (flags.hasDiscretionaryComp) {
    items.push({
      type: 'safety',
      priority: 'high',
      text: 'Verify the compensation structure in writing. Discretionary pay clauses give the other party unchecked control over your earnings.',
    });
  }

  const noticeClause = importantClauses.find(c => c.label === 'Notice Period');
  if (noticeClause?.value === 'Not specified in document' && flags.hasTerminationNoSeverance) {
    items.push({
      type: 'safety',
      priority: 'high',
      text: 'No notice period is specified. Ensure a minimum notice period (at least 30 days) is added before signing to protect against sudden termination.',
    });
  }

  const govLaw = importantClauses.find(c => c.label === 'Governing Law');
  if (govLaw?.value === 'Not specified in document') {
    items.push({
      type: 'safety',
      priority: 'medium',
      text: 'No governing law is specified. Confirm which jurisdiction\'s laws apply before signing — this affects enforceability of all clauses.',
    });
  }

  if (flags.hasAutoRenewal) {
    const renewalClause = importantClauses.find(c => c.label === 'Renewal Terms');
    items.push({
      type: 'safety',
      priority: 'medium',
      text: `This agreement auto-renews. ${renewalClause && renewalClause.value !== 'Not specified in document' ? `Renewal terms: "${renewalClause.value.slice(0, 80)}". ` : ''}Set a calendar reminder before the opt-out deadline to avoid unintended renewal.`,
    });
  }

  // ── Negotiation suggestions ───────────────────────────────────────────────
  if (flags.hasTerminationNoSeverance && !flags.hasSeverance) {
    items.push({
      type: 'suggestion',
      priority: 'high',
      text: 'Since no termination clause includes severance, negotiate for at least 1–3 months of compensation upon termination without cause before signing.',
    });
  }

  if (flags.hasNonCompete && flags.nonCompeteIsVague) {
    items.push({
      type: 'suggestion',
      priority: 'high',
      text: `The non-compete clause lacks specific scope. Request that it define: (1) exact duration, (2) geographic area, and (3) which industries or roles are restricted.`,
    });
  } else if (flags.hasNonCompete && flags.nonCompeteIsPostEmployment) {
    items.push({
      type: 'suggestion',
      priority: 'high',
      text: 'The post-employment non-compete may be unenforceable in your jurisdiction. Consult a lawyer and negotiate to limit it to 6–12 months maximum.',
    });
  }

  if (flags.confidentialityIsPerpetual) {
    items.push({
      type: 'suggestion',
      priority: 'high',
      text: 'Negotiate to replace the perpetual confidentiality clause with a time-limited obligation (2–5 years) and add standard carve-outs for publicly available information.',
    });
  }

  if (flags.hasIPAssignment) {
    items.push({
      type: 'suggestion',
      priority: 'high',
      text: 'Before signing, attach a written schedule of all pre-existing IP and personal projects. Request an explicit carve-out for work created outside working hours without company resources.',
    });
  }

  if (flags.hasLiabilityCap) {
    items.push({
      type: 'suggestion',
      priority: 'medium',
      text: 'Review the liability cap amount. If it is less than 12 months of contract value, negotiate a higher cap or carve-out for gross negligence and willful misconduct.',
    });
  }

  if (flags.hasPenalty) {
    items.push({
      type: 'suggestion',
      priority: 'medium',
      text: 'Negotiate penalty and liquidated damages amounts to ensure they reflect actual anticipated losses, not punitive amounts. Courts may void disproportionate penalties.',
    });
  }

  // ── Legal awareness ───────────────────────────────────────────────────────
  if (!flags.hasArbitration) {
    items.push({
      type: 'suggestion',
      priority: 'low',
      text: 'No dispute resolution clause is present. Consider requesting one to avoid costly court proceedings if a disagreement arises.',
    });
  }

  for (const missing of missingProtections.slice(0, 2)) {
    items.push({
      type: 'suggestion',
      priority: 'low',
      text: missing,
    });
  }

  if (recommendation === 'safe' && items.length === 0) {
    items.push({
      type: 'safety',
      priority: 'low',
      text: 'No major risks detected. As a precaution, keep a signed copy of the final agreement and note all key dates (renewal, notice deadlines).',
    });
    items.push({
      type: 'suggestion',
      priority: 'low',
      text: 'Even with a low-risk document, have a qualified attorney review it before signing to confirm all terms are in your best interest.',
    });
  }

  if (recommendation === 'review') {
    items.push({
      type: 'safety',
      priority: 'medium',
      text: 'Before signing, request written clarification on any vague terms. Do not rely on verbal assurances — ensure all agreed changes are reflected in the written document.',
    });
  }

  return items;
}

// ─── Financial & Transaction Risk Analysis ────────────────────────────────────

function analyzeFinancialRisk(text: string): FinancialRisk {
  const lower = text.toLowerCase();

  // ── Extract amounts ───────────────────────────────────────────────────────
  const amountMatches = [
    ...text.matchAll(/(?:₹|Rs\.?\s*|INR\s*|USD\s*|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:lakh|crore|thousand|million|billion))?/gi),
    ...text.matchAll(/[\d,]+(?:\.\d{1,2})?\s*(?:lakh|crore)\s*(?:rupees?|only)?/gi),
    ...text.matchAll(/\b[\d,]+(?:\.\d{2})?\s*(?:dollars?|euros?|pounds?)\b/gi),
  ];
  const extractedAmounts = [...new Set(amountMatches.map(m => m[0].trim().replace(/\s+/g, ' ')))].slice(0, 6);

  // ── Extract dates ─────────────────────────────────────────────────────────
  const dateMatches = [
    ...text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi),
    ...text.matchAll(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g),
    ...text.matchAll(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b/gi),
  ];
  const extractedDates = [...new Set(dateMatches.map(m => m[0].trim()))].slice(0, 6);

  // ── Extract payment methods ───────────────────────────────────────────────
  const methodPatterns: Record<string, RegExp> = {
    'Bank Transfer / NEFT / RTGS': /\b(?:neft|rtgs|imps|bank transfer|wire transfer|electronic transfer|online transfer)\b/i,
    'Cheque / Demand Draft':        /\b(?:cheque|check|demand draft|dd|banker.s draft)\b/i,
    'Cash':                         /\b(?:cash|in cash|cash payment|paid in cash)\b/i,
    'UPI / Digital Payment':        /\b(?:upi|gpay|phonepe|paytm|digital payment|online payment)\b/i,
    'Credit / Debit Card':          /\b(?:credit card|debit card|card payment)\b/i,
  };
  const paymentMethods: string[] = [];
  for (const [method, pattern] of Object.entries(methodPatterns)) {
    if (pattern.test(lower)) paymentMethods.push(method);
  }

  // ── Extract installment details ───────────────────────────────────────────
  const installmentMatches = [
    ...text.matchAll(/(?:installment|instalment|tranche|milestone|payment\s+\d+)[^\n.]{0,120}/gi),
    ...text.matchAll(/(?:first|second|third|final|last)\s+(?:payment|installment|tranche)[^\n.]{0,100}/gi),
    ...text.matchAll(/\d+\s*(?:equal\s+)?(?:monthly|quarterly|annual)\s+(?:installments?|payments?)[^\n.]{0,80}/gi),
  ];
  const installments = [...new Set(installmentMatches.map(m => m[0].trim().slice(0, 120)))].slice(0, 4);

  // ── Financial clarity risk ────────────────────────────────────────────────
  let clarityScore = 0; // 0=low risk, 10=high risk
  const observations: string[] = [];

  if (extractedAmounts.length === 0) {
    clarityScore += 10;
    observations.push('No monetary amounts detected — financial terms are unclear or absent.');
  } else if (extractedAmounts.length === 1) {
    clarityScore += 5;
    observations.push(`Only one amount found (${extractedAmounts[0]}) — payment breakdown may be incomplete.`);
  } else {
    observations.push(`${extractedAmounts.length} amounts identified: ${extractedAmounts.slice(0, 3).join(', ')}${extractedAmounts.length > 3 ? '…' : ''}.`);
  }

  const clarityLevel: FinancialRiskLevel =
    clarityScore >= 10 ? 'high' : clarityScore >= 5 ? 'medium' : 'low';

  // ── Payment method risk ───────────────────────────────────────────────────
  let methodScore = 0;
  const hasCash = paymentMethods.some(m => m.includes('Cash'));
  const hasBank = paymentMethods.some(m => m.includes('Bank') || m.includes('Cheque') || m.includes('UPI'));

  if (paymentMethods.length === 0) {
    methodScore += 8;
    observations.push('No payment method specified — method of transaction is undocumented.');
  } else if (hasCash && hasBank) {
    methodScore += 5;
    observations.push(`Mixed payment methods detected (${paymentMethods.join(', ')}) — cash transactions reduce traceability.`);
  } else if (hasCash && !hasBank) {
    methodScore += 10;
    observations.push(`Cash-only payment detected — cash transactions reduce traceability and increase financial risk.`);
  } else {
    observations.push(`Traceable payment method(s) specified: ${paymentMethods.join(', ')}.`);
  }

  const paymentMethodRisk: FinancialRiskLevel =
    methodScore >= 10 ? 'high' : methodScore >= 5 ? 'medium' : 'low';

  // ── Timeline consistency risk ─────────────────────────────────────────────
  let timelineScore = 0;

  if (extractedDates.length === 0) {
    timelineScore += 10;
    observations.push('No payment dates or timelines detected — schedule is undefined.');
  } else if (extractedDates.length === 1) {
    timelineScore += 5;
    observations.push(`Only one date found (${extractedDates[0]}) — a structured payment timeline is not established.`);
  } else {
    // Check for conflicting/inconsistent dates (simple heuristic: very close dates for large amounts)
    observations.push(`${extractedDates.length} dates identified: ${extractedDates.slice(0, 3).join(', ')}${extractedDates.length > 3 ? '…' : ''}.`);
  }

  if (installments.length > 0) {
    observations.push(`Installment structure detected: ${installments[0].slice(0, 80)}${installments[0].length > 80 ? '…' : ''}`);
    timelineScore = Math.max(0, timelineScore - 3); // installments reduce timeline risk
  }

  const timelineRisk: FinancialRiskLevel =
    timelineScore >= 10 ? 'high' : timelineScore >= 5 ? 'medium' : 'low';

  // ── Composite financial risk score (0–30 added to clause score) ───────────
  const rawFinancialScore = clarityScore + methodScore + timelineScore;
  const score = Math.min(Math.round(rawFinancialScore), 30);

  // ── Score breakdown explanation ───────────────────────────────────────────
  const parts: string[] = [];
  if (clarityLevel !== 'low')   parts.push(`financial clarity: ${clarityLevel}`);
  if (paymentMethodRisk !== 'low') parts.push(`payment method: ${paymentMethodRisk}`);
  if (timelineRisk !== 'low')   parts.push(`timeline: ${timelineRisk}`);
  const scoreBreakdown = parts.length
    ? `Financial risk adds ${score} points (${parts.join(', ')}).`
    : `Financial risk is low — clear amounts, traceable methods, and defined timeline detected.`;

  return {
    score,
    clarityLevel,
    paymentMethodRisk,
    timelineRisk,
    extractedAmounts,
    extractedDates,
    paymentMethods,
    installments,
    observations,
    scoreBreakdown,
  };
}

// ─── 10. Risk Score & Recommendation ─────────────────────────────────────────

function calcRiskScore(risks: ParsedRisk[], financialRisk: FinancialRisk): number {
  const clauseTotal = risks.reduce((sum, r) => {
    if (r.severity === 'high') return sum + 30;
    if (r.severity === 'medium') return sum + 15;
    return sum + 5;
  }, 0);
  return Math.min(clauseTotal + financialRisk.score, 100);
}

function calcRecommendation(
  risks: ParsedRisk[],
  score: number,
  financialRisk: FinancialRisk,
): { recommendation: Recommendation; reason: string } {
  const highCount = risks.filter((r) => r.severity === 'high').length;
  const hasHighFinancial = financialRisk.clarityLevel === 'high'
    || financialRisk.paymentMethodRisk === 'high'
    || financialRisk.timelineRisk === 'high';

  const financialNote = financialRisk.score > 0 ? ` ${financialRisk.scoreBreakdown}` : '';

  if (highCount >= 2 || score >= 70) {
    return {
      recommendation: 'danger',
      reason: `This document contains ${highCount} high-severity risk${highCount !== 1 ? 's' : ''} and a risk score of ${score}/100.${financialNote} Do not sign without legal review.`,
    };
  }
  if (highCount >= 1 || score >= 35 || hasHighFinancial) {
    return {
      recommendation: 'review',
      reason: `This document has a risk score of ${score}/100 with ${highCount} high-severity issue${highCount !== 1 ? 's' : ''}.${financialNote} Review flagged clauses carefully before signing.`,
    };
  }
  return {
    recommendation: 'safe',
    reason: `No high-severity risks detected. Risk score is ${score}/100.${financialNote} Standard review is still recommended.`,
  };
}

// ─── Parsed Clauses ───────────────────────────────────────────────────────────

function topicForSection(title: string, text: string): ClauseTopic {
  const combined = (title + ' ' + text).toLowerCase();
  if (/terminat/.test(combined)) return 'termination';
  if (/non.compet|compet/.test(combined)) return 'nonCompete';
  if (/confidential|non.disclosure|proprietary/.test(combined)) return 'confidentiality';
  if (/payment|compensation|salary|wage|fee/.test(combined)) return 'payment';
  if (/renew|extension/.test(combined)) return 'renewal';
  if (/penalt|liquidated|damages/.test(combined)) return 'penalty';
  if (/governing|jurisdiction|applicable law/.test(combined)) return 'governing';
  return 'other';
}

function riskForSection(title: string, text: string, flags: DetectedFlags): 'high' | 'medium' | 'low' | 'none' {
  const combined = (title + ' ' + text).toLowerCase();
  if (
    (flags.hasTerminationNoSeverance && /terminat/.test(combined)) ||
    (flags.hasPenalty && /penalt|liquidated/.test(combined)) ||
    (flags.confidentialityIsPerpetual && /confidential/.test(combined)) ||
    (flags.hasNonCompete && flags.nonCompeteIsPostEmployment && /compet/.test(combined))
  ) return 'high';

  if (
    (flags.hasNonCompete && /compet/.test(combined)) ||
    (flags.hasConfidentiality && /confidential/.test(combined)) ||
    (flags.hasIPAssignment && /intellectual property|assign/.test(combined)) ||
    (flags.hasLiabilityCap && /liability/.test(combined)) ||
    (flags.hasDiscretionaryComp && /discretion/.test(combined))
  ) return 'medium';

  if (/terminat|renew|payment|compensation/.test(combined)) return 'low';
  return 'none';
}

function buildParsedClauses(sections: Section[], flags: DetectedFlags): ParsedClause[] {
  return sections.map((s, i) => ({
    id: i + 1,
    sectionTitle: s.title,
    text: excerpt(s.text, 500),
    risk: riskForSection(s.title, s.text, flags),
    topic: topicForSection(s.title, s.text),
  }));
}

// ─── 12. Chat Context ─────────────────────────────────────────────────────────

function buildChatContext(
  title: string,
  docType: string,
  parties: string[],
  riskScore: number,
  risks: ParsedRisk[]
): string {
  const keyIssues = risks.map((r) => `${r.title} (${r.severity})`).join('; ') || 'None detected';
  return `Document: "${title}" (${docType}). Parties: ${parties[0]} and ${parties[1]}. Risk score: ${riskScore}%. Key issues: ${keyIssues}.`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function analyzeDocument(text: string): DocumentAnalysis {
  const normalized = normalize(text);

  const title = extractTitle(normalized);
  const documentType = inferDocumentType(normalized, title);
  const parties = extractParties(normalized);
  const sections = splitSections(normalized);
  const flags = detectFlags(normalized);

  // Run KB matching first — results feed into risk building
  const kbMatches = findMatchingPatterns(normalized);
  const missingProtections = detectMissingProtections(normalized);
  const facts = extractFacts(normalized);
  const financialRisk = analyzeFinancialRisk(normalized);

  const risks = buildRisks(normalized, flags, kbMatches);
  const riskScore = calcRiskScore(risks, financialRisk);
  const { recommendation, reason: recommendationReason } = calcRecommendation(risks, riskScore, financialRisk);

  const summaries = buildSummaries(documentType, parties, flags, riskScore, facts);
  const obligations = buildObligations(documentType, parties, flags, facts);
  const importantClauses = extractImportantClauses(normalized);
  const suggestions = buildSuggestions(flags, kbMatches, missingProtections);
  const guidance = buildGuidance(flags, risks, recommendation, parties, importantClauses, missingProtections);
  const parsedClauses = buildParsedClauses(sections, flags);
  const chatContext = buildChatContext(title, documentType, parties, riskScore, risks);

  return {
    title,
    documentType,
    parties,
    riskScore,
    recommendation,
    recommendationReason,
    summaries,
    risks,
    obligations,
    importantClauses,
    suggestions,
    guidance,
    parsedClauses,
    chatContext,
    kbMatches,
    missingProtections,
    financialRisk,
  };
}
