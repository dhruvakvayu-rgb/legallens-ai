import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Header } from './Header';
import { ComplexitySlider } from './ComplexitySlider';
import { useDocument } from '../lib/documentStore';
import { getTier } from '../lib/complexityContent';
import type { ParsedClause } from '../lib/documentAnalyzer';
import { X, FileSearch } from 'lucide-react';
import { motion } from 'motion/react';

const TOPIC_LABELS: Record<string, string> = {
  termination: 'Termination',
  nonCompete: 'Non-Compete',
  confidentiality: 'Confidentiality',
  payment: 'Compensation',
  renewal: 'Renewal',
  penalty: 'Penalties',
  governing: 'Governing Law',
  other: 'General',
};

function clauseExplanation(clause: ParsedClause, tier: ReturnType<typeof getTier>): string {
  const topic = clause.topic;
  const text = clause.text.toLowerCase();

  const explanations: Record<string, Record<typeof tier, string>> = {
    termination: {
      eli5: "This part says either person can say 'we're done' at any time. Like ending a playdate — no reason needed!",
      simple: "This clause allows either party to end the agreement at any time, without needing to give a reason.",
      balanced: "This is a termination clause. It defines when and how the agreement can be ended. Check whether a notice period or severance is included.",
      detailed: "This termination provision governs the conditions under which the agreement may be dissolved. The absence of a notice period or severance obligation creates financial risk for the non-terminating party.",
      expert: "This clause establishes termination rights under the agreement. Evaluate whether it creates at-will status, whether implied covenant protections apply in the governing jurisdiction, and whether severance or WARN Act obligations are triggered.",
    },
    nonCompete: {
      eli5: "This says you can't go work for a company that does the same thing. Like being on one team and not being allowed to join another!",
      simple: "This non-compete clause stops you from working for competitors. It limits your job options while this agreement is active.",
      balanced: "This non-compete provision restricts competitive employment. The scope — what counts as 'competitive' and for how long — should be clearly defined.",
      detailed: "This restrictive covenant prohibits competitive employment. Courts apply a reasonableness standard evaluating geographic scope, duration, and legitimate business interest. Vague scope definitions create enforceability risk.",
      expert: "This non-compete covenant's enforceability is jurisdiction-dependent. It is void ab initio in California (Bus. & Prof. Code §16600) and subject to reasonableness scrutiny elsewhere. Assess geographic scope, temporal duration, and consideration adequacy.",
    },
    confidentiality: {
      eli5: "This means you have to keep secrets. Even after you're done with this agreement, you can't tell anyone what you learned!",
      simple: "You must keep all company information private. This obligation may last even after the agreement ends.",
      balanced: "This confidentiality clause requires you to protect proprietary information. If it says 'in perpetuity' or 'indefinitely,' there's no expiration — which is worth negotiating.",
      detailed: "This confidentiality obligation mandates non-disclosure of proprietary information. A perpetual duration without defined scope may be challenged as overbroad. Consider requesting a time-limited clause with clear scope definitions.",
      expert: "This confidentiality covenant should be assessed against DTSA (18 U.S.C. §1836) definitions. Perpetual obligations without scope limitations risk unconscionability challenges. Whistleblower protection statutes may limit enforceability in certain disclosure contexts.",
    },
    payment: {
      eli5: "This part talks about money — how much you get paid and when. Make sure it's clear!",
      simple: "This section covers compensation. Make sure the payment amount, schedule, and method are clearly stated.",
      balanced: "This compensation clause defines payment terms. Vague language like 'at company discretion' should be replaced with specific amounts and schedules.",
      detailed: "The compensation provision should specify payment schedule, method, and contingencies. Discretionary pay terms may be challenged as illusory consideration, affecting contract enforceability.",
      expert: "Evaluate whether the compensation structure satisfies the definiteness requirement for contract formation. Discretionary pay provisions may render consideration illusory. Ensure all contingencies, bonus triggers, and payment schedules are contractually specified.",
    },
    renewal: {
      eli5: "This says the agreement might keep going automatically. Set a reminder so you don't miss the deadline!",
      simple: "This renewal clause may automatically extend the agreement. Check the deadline for opting out.",
      balanced: "This renewal provision may auto-renew the agreement unless you take action. Note the notice deadline required to prevent automatic renewal.",
      detailed: "The automatic renewal clause creates ongoing obligations unless timely notice of non-renewal is provided. Ensure the notice deadline and opt-out procedure are clearly understood.",
      expert: "The auto-renewal provision creates evergreen obligations subject to timely notice of termination. Assess whether the notice period is commercially reasonable and whether the renewal terms are materially different from the original.",
    },
    penalty: {
      eli5: "This says you might have to pay money if you break the rules. Be careful!",
      simple: "This penalty clause means you could owe money if you violate the agreement. Understand what triggers it.",
      balanced: "This penalty or liquidated damages clause specifies financial consequences for breach. Ensure the amounts are reasonable and proportionate to actual damages.",
      detailed: "The liquidated damages provision should be assessed for reasonableness — courts may void penalty clauses that function as punitive rather than compensatory measures.",
      expert: "Evaluate the liquidated damages clause under the applicable reasonableness standard. Provisions that are disproportionate to anticipated harm may be deemed unenforceable as penalty clauses under common law.",
    },
    governing: {
      eli5: "This says which place's rules apply to this paper. It matters if there's ever a problem!",
      simple: "This clause specifies which state's laws govern the agreement and where disputes must be resolved.",
      balanced: "The governing law clause determines which jurisdiction's laws apply. This affects enforceability of other clauses like non-competes.",
      detailed: "The governing law and venue provisions determine the legal framework for interpretation and dispute resolution. This is particularly significant for non-compete enforceability, which varies substantially by jurisdiction.",
      expert: "The choice-of-law provision determines the applicable legal framework. Assess whether the chosen jurisdiction's law is favorable to your position, particularly regarding non-compete enforceability, implied covenant protections, and trade secret definitions.",
    },
    other: {
      eli5: "This is another part of the agreement. Ask about it if you're not sure what it means!",
      simple: "This section contains additional terms. Review it carefully to understand your rights and obligations.",
      balanced: "This provision contains terms that may affect your rights under the agreement. Review it in context with the other clauses.",
      detailed: "This provision should be reviewed in conjunction with the other clauses to assess its overall impact on your rights and obligations under the agreement.",
      expert: "This provision warrants review in the context of the entire instrument to assess its interaction with other clauses and its impact on the overall risk profile of the agreement.",
    },
  };

  return explanations[topic]?.[tier] ?? explanations.other[tier];
}

export function DocumentViewerScreen() {
  const navigate = useNavigate();
  const { analysis, rawText } = useDocument();
  const [complexityLevel, setComplexityLevel] = useState(5);
  const [selectedClause, setSelectedClause] = useState<ParsedClause | null>(null);

  if (!analysis || !rawText) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-32 text-center">
          <FileSearch className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-3">No document loaded</h2>
          <p className="text-muted-foreground mb-8">Upload a document first to view it here.</p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
          >
            Go to Upload
          </button>
        </main>
      </div>
    );
  }

  const tier = getTier(complexityLevel);
  const { parsedClauses, title } = analysis;

  // Highlight risk clauses inside the raw text for display
  const highlightedClauses = parsedClauses.filter((c) => c.risk !== 'none');

  const clauseHighlightClass = (risk: string) =>
    risk === 'high'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:border-red-400'
      : risk === 'medium'
      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 hover:border-yellow-400'
      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';

  // Split raw text into paragraphs for display
  const paragraphs = rawText.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
          <h2 className="text-3xl font-bold text-foreground mb-1">Document Viewer</h2>
          <p className="text-muted-foreground">{title}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 mb-6 transition-colors duration-300"
        >
          <ComplexitySlider value={complexityLevel} onChange={setComplexityLevel} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document text */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2 bg-card rounded-2xl border border-border p-8 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] max-h-[75vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-bold text-foreground mb-6 uppercase tracking-wide">{title}</h3>

            {/* Detected risk clauses — clickable */}
            {highlightedClauses.length > 0 && (
              <div className="mb-6 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Detected Clauses — click to explain
                </p>
                {highlightedClauses.map((clause) => (
                  <button
                    key={clause.id}
                    onClick={() => setSelectedClause(clause)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${clauseHighlightClass(clause.risk)} ${selectedClause?.id === clause.id ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        clause.risk === 'high'
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        {clause.risk === 'high' ? 'High Risk' : 'Medium Risk'}
                      </span>
                      <span className="text-xs text-muted-foreground">{TOPIC_LABELS[clause.topic]}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{clause.text}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Full document text */}
            <div className="border-t border-border pt-6 space-y-4 text-muted-foreground leading-relaxed text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Full Document Text</p>
              {paragraphs.map((para, i) => (
                <p key={i} className="whitespace-pre-wrap">{para.trim()}</p>
              ))}
            </div>
          </motion.div>

          {/* Explanation panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-1"
          >
            {selectedClause ? (
              <div className="bg-card rounded-2xl border border-border p-6 sticky top-24 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.07)]">
                <div className="flex items-start justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedClause.risk === 'high'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                  }`}>
                    {selectedClause.risk === 'high' ? 'High Risk' : 'Medium Risk'}
                  </div>
                  <button onClick={() => setSelectedClause(null)} className="p-1 hover:bg-accent rounded-lg transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-1">{TOPIC_LABELS[selectedClause.topic]}</h3>
                <p className="text-xs text-muted-foreground mb-4">{selectedClause.sectionTitle}</p>

                <div className="p-3 bg-muted rounded-lg mb-4">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "{selectedClause.text.slice(0, 200)}{selectedClause.text.length > 200 ? '…' : ''}"
                  </p>
                </div>

                <h4 className="font-semibold text-foreground mb-2 text-sm">Explanation</h4>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {clauseExplanation(selectedClause, tier)}
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 sticky top-24 transition-colors duration-300">
                <h3 className="font-bold text-foreground mb-2">Clause Explanation</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click any highlighted clause to see an explanation at your selected complexity level.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-200 dark:bg-red-800 border-2 border-red-400 dark:border-red-600 rounded" />
                    <span className="text-xs text-muted-foreground">High Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-200 dark:bg-yellow-800 border-2 border-yellow-400 dark:border-yellow-600 rounded" />
                    <span className="text-xs text-muted-foreground">Medium Risk</span>
                  </div>
                </div>
                {highlightedClauses.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-4 italic">
                    No high-risk clauses were detected in this document.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
