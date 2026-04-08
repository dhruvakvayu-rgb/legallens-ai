import { useNavigate, Link } from 'react-router';
import { useState } from 'react';
import { Header } from './Header';
import { ComplexitySlider } from './ComplexitySlider';
import { useDocument } from '../lib/documentStore';
import { getTier } from '../lib/complexityContent';
import type { GuidanceItem } from '../lib/documentAnalyzer';
import { generatePDFReport } from '../lib/pdfReport';
import {
  CheckCircle2, AlertTriangle, XCircle, Shield, FileText,
  Lightbulb, MessageSquare, ChevronRight, AlertCircle, FileSearch,
  Download,
} from 'lucide-react';
import { motion } from 'motion/react';

// ─── Guidance card helpers ────────────────────────────────────────────────────

const GUIDANCE_CONFIG: Record<GuidanceItem['type'], {
  icon: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  badge: string;
}> = {
  redflag:    { icon: '🚨', label: 'Red Flag',   bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-200 dark:border-red-800',     text: 'text-red-800 dark:text-red-300',     badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400' },
  warning:    { icon: '⚠️', label: 'Warning',    bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400' },
  safety:     { icon: '🛡️', label: 'Safety Tip', bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-800 dark:text-blue-300',   badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400' },
  suggestion: { icon: '💡', label: 'Suggestion', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400' },
};

const PRIORITY_BADGE: Record<GuidanceItem['priority'], string> = {
  high:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  low:    'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
};

export function AnalysisScreen() {
  const navigate = useNavigate();
  const { analysis, rawText } = useDocument();
  const [complexityLevel, setComplexityLevel] = useState(5);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!analysis) return;
    setIsDownloading(true);
    try {
      generatePDFReport(analysis, getTier(complexityLevel));
    } finally {
      setIsDownloading(false);
    }
  };

  if (!analysis || !rawText) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-32 text-center">
          <FileSearch className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-3">No document loaded</h2>
          <p className="text-muted-foreground mb-8">Upload or paste a legal document first to see the analysis.</p>
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
  const { riskScore, recommendation, recommendationReason, summaries, risks, obligations, importantClauses, suggestions, title, documentType } = analysis;

  const recConfig = {
    safe: {
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-700',
      label: 'Safe to Sign',
    },
    review: {
      icon: AlertTriangle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-700',
      label: 'Review Carefully',
    },
    danger: {
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-700',
      label: 'Not Recommended',
    },
  }[recommendation];

  const Icon = recConfig.icon;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-1">{title}</h2>
            <p className="text-muted-foreground">{documentType}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={`lg:col-span-2 rounded-2xl border-2 ${recConfig.borderColor} ${recConfig.bgColor} p-6 transition-colors duration-300`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 ${recConfig.bgColor} rounded-xl`}>
                  <Icon className={`w-8 h-8 ${recConfig.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-1">{recConfig.label}</h3>
                  <p className="text-muted-foreground mb-4">{recommendationReason}</p>
                  <button
                    onClick={() => navigate('/chat')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ask AI Assistant
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-foreground">Risk Score</h3>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${riskScore}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className={`h-full rounded-full ${riskScore >= 70 ? 'bg-red-500' : riskScore >= 35 ? 'bg-yellow-500' : 'bg-green-500'}`}
                />
              </div>
              <p className="text-3xl font-bold text-foreground mt-3">{riskScore}%</p>
              <p className="text-sm text-muted-foreground">Potential Concerns</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 mb-8 transition-colors duration-300"
          >
            <ComplexitySlider value={complexityLevel} onChange={setComplexityLevel} />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-card rounded-2xl border border-border p-6 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xl font-bold text-foreground">Summary</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">{summaries[tier]}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-card rounded-2xl border border-border p-6 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                <h3 className="text-xl font-bold text-foreground">Key Risks</h3>
              </div>
              <div className="space-y-3">
                {risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{risk.title}</h4>
                      <p className="text-sm text-muted-foreground">{risk.desc}</p>
                      {risk.clause && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic truncate">
                          "{risk.clause.slice(0, 80)}{risk.clause.length > 80 ? '…' : ''}"
                        </p>
                      )}
                      {risk.kbPatternId && (
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                          KB Pattern {risk.kbPatternId} · {Math.round((risk.kbSimilarity ?? 0) * 100)}% match
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-card rounded-2xl border border-border p-6 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                <h3 className="text-xl font-bold text-foreground">Your Obligations</h3>
              </div>
              <ul className="space-y-2">
                {obligations[tier].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="bg-card rounded-2xl border border-border p-6 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xl font-bold text-foreground">Important Clauses</h3>
              </div>
              <div className="space-y-3">
                {importantClauses.map((clause, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{clause.label}</span>
                    <span className={`text-sm ${clause.value === 'Not specified in document' ? 'text-muted-foreground/60 italic' : 'text-foreground'}`}>
                      {clause.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-card rounded-2xl border border-border p-6 lg:col-span-2 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <h3 className="text-xl font-bold text-foreground">Actionable Suggestions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">{s}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/chat"
                className="block w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium text-center hover:shadow-lg hover:shadow-blue-500/25 transition-shadow"
              >
                Discuss with AI Assistant
              </Link>
            </motion.div>
          </div>

          {/* Guidance & Safety Recommendations */}
          {analysis.guidance.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.72 }}
              className="mt-6 bg-card rounded-2xl border border-border p-6 transition-colors duration-300 dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]"
            >
              <div className="flex items-center gap-3 mb-5">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-xl font-bold text-foreground">Guidance & Safety Recommendations</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Based on the specific findings in this document</p>
                </div>
              </div>

              <div className="space-y-3">
                {analysis.guidance.map((item, i) => {
                  const cfg = GUIDANCE_CONFIG[item.type];
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}
                    >
                      <span className="text-lg flex-shrink-0 mt-0.5" role="img" aria-label={cfg.label}>
                        {cfg.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[item.priority]}`}>
                            {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} Priority
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${cfg.text}`}>{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Missing Protections — from KB */}
          {analysis.missingProtections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="mt-6 bg-card rounded-2xl border border-amber-200 dark:border-amber-800 p-6 transition-colors duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xl font-bold text-foreground">Missing Standard Protections</h3>
              </div>
              <div className="space-y-2">
                {analysis.missingProtections.map((mp, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                    <span>{mp}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-6 space-y-3"
          >
            {/* Download PDF — full-width prominent button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-base hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              {isDownloading ? 'Generating PDF…' : 'Download Report as PDF'}
            </button>

            {/* Secondary actions */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-3.5 bg-card border-2 border-border rounded-xl font-semibold hover:bg-accent transition-colors text-foreground text-sm"
              >
                Upload New Document
              </button>
              <button
                onClick={() => navigate('/document')}
                className="flex-1 py-3.5 bg-card border-2 border-border rounded-xl font-semibold hover:bg-accent transition-colors text-foreground text-sm"
              >
                View Full Document
              </button>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
