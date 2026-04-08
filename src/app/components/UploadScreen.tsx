import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Header } from './Header';
import { LogoIcon } from './Logo';
import { useDocument } from '../lib/documentStore';
import { processDocument, type ProcessingProgress } from '../lib/documentProcessor';
import {
  Upload,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ScanLine,
  FileType2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: ProcessingProgress }) {
  const stageColors: Record<string, string> = {
    reading: 'from-blue-500 to-blue-600',
    'extracting-text': 'from-blue-500 to-purple-500',
    'detecting-type': 'from-purple-500 to-purple-600',
    'ocr-init': 'from-purple-500 to-pink-500',
    'ocr-page': 'from-pink-500 to-purple-600',
    cleaning: 'from-purple-500 to-blue-500',
    done: 'from-green-500 to-emerald-500',
    error: 'from-red-500 to-red-600',
  };

  const gradient = stageColors[progress.stage] ?? 'from-blue-500 to-purple-600';

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{progress.message}</span>
        <span className="text-muted-foreground tabular-nums">{progress.percent}%</span>
      </div>
      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress.percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── Method badge ─────────────────────────────────────────────────────────────

function MethodBadge({ method, lowConfidence }: { method: string; lowConfidence: boolean }) {
  const configs = {
    text: { icon: FileType2, label: 'Text PDF', color: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' },
    ocr: { icon: ScanLine, label: 'Scanned PDF — OCR used', color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800' },
    mixed: { icon: ScanLine, label: 'Mixed PDF — OCR used on some pages', color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
    plaintext: { icon: FileText, label: 'Plain text', color: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' },
  };

  const cfg = configs[method as keyof typeof configs] ?? configs.plaintext;
  const Icon = cfg.icon;

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </div>
      {lowConfidence && (
        <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Some parts of the document may not be accurately interpreted due to low OCR confidence.
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UploadScreen() {
  const navigate = useNavigate();
  const { setDocument } = useDocument();
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [lastMethod, setLastMethod] = useState<{ method: string; lowConfidence: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = progress !== null && progress.stage !== 'done' && progress.stage !== 'error';

  const handleProgress = (p: ProcessingProgress) => setProgress(p);

  const processFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError('File exceeds 20MB limit.');
      return;
    }

    setError('');
    setLastMethod(null);
    setProgress({ stage: 'reading', percent: 2, message: 'Loading file…' });

    try {
      const result = await processDocument(file, handleProgress);

      if (!result.text.trim() || result.text.trim().length < 30) {
        setProgress({ stage: 'error', percent: 0, message: 'Could not extract text.', error: 'Unable to read document clearly. Please upload a clearer file or paste the text directly.' });
        setError('Unable to read document clearly. Please upload a clearer file or paste the text directly.');
        return;
      }

      setLastMethod({ method: result.method, lowConfidence: result.lowConfidence });
      setDocument(result.text, file.name);

      // Brief pause so user sees 100% before navigating
      setTimeout(() => navigate('/analysis'), 600);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to process document.';
      setProgress({ stage: 'error', percent: 0, message: msg });
      setError(msg);
    }
  };

  const handleAnalyze = () => {
    const text = pastedText.trim();
    if (!text) {
      setError('Please paste your document text or upload a file first.');
      return;
    }
    if (text.length < 30) {
      setError('Document is too short to analyze. Please provide more content.');
      return;
    }
    setError('');
    setDocument(text, 'Pasted Document');
    navigate('/analysis');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-white dark:from-[#0B0F1A] dark:via-[#0f1628] dark:to-[#0B0F1A] transition-colors duration-300">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <LogoIcon size={72} />
          </motion.div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Legal Analysis
          </div>
          <h2 className="text-5xl font-bold text-foreground mb-4">
            Make Informed Legal Decisions
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload any legal document — text PDF, scanned PDF, or plain text — and get instant AI analysis
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          {/* Drop zone */}
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
              isProcessing
                ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10 cursor-default'
                : dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-copy'
                : 'border-border bg-white dark:bg-card hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer'
            }`}
            onDragEnter={() => !isProcessing && setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (!isProcessing) {
                const file = e.dataTransfer.files[0];
                if (file) processFile(file);
              }
            }}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.doc,.docx,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
                // Reset so same file can be re-selected
                e.target.value = '';
              }}
            />

            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Animated scanner icon */}
                  <div className="relative w-16 h-16 mx-auto">
                    <ScanLine className="w-16 h-16 text-blue-500" />
                    <motion.div
                      className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                  <ProgressBar progress={progress!} />
                </motion.div>
              ) : progress?.stage === 'done' ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3"
                >
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                  <p className="text-foreground font-semibold">Document processed successfully</p>
                  {lastMethod && (
                    <div className="flex justify-center">
                      <MethodBadge {...lastMethod} />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Upload className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Drop your legal document here
                  </h3>
                  <p className="text-muted-foreground mb-6">or click to browse files</p>
                  <span className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-shadow inline-block">
                    Select File
                  </span>
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileType2 className="w-3.5 h-3.5" /> Text PDF
                    </span>
                    <span className="flex items-center gap-1">
                      <ScanLine className="w-3.5 h-3.5" /> Scanned PDF (OCR)
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> TXT / DOC
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Max 20MB</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gradient-to-br from-blue-50 via-purple-50 to-white dark:from-[#0B0F1A] dark:via-[#0f1628] dark:to-[#0B0F1A] text-muted-foreground">
                or paste text directly
              </span>
            </div>
          </div>

          {/* Paste area */}
          <div className="bg-white dark:bg-card rounded-2xl border border-border p-6 transition-colors duration-300">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-1">Paste Legal Text</h4>
                <p className="text-sm text-muted-foreground">
                  Copy and paste any legal document or contract text
                </p>
              </div>
              {pastedText.trim().length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {pastedText.trim().split(/\s+/).length} words
                </span>
              )}
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => { setPastedText(e.target.value); setError(''); }}
              placeholder="Paste your legal document text here…"
              className="w-full h-48 px-4 py-3 border border-border rounded-lg resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors duration-200 font-mono text-sm"
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleAnalyze}
            disabled={!pastedText.trim() || isProcessing}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:shadow-blue-500/25 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Analyze Pasted Text
          </button>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            { icon: FileType2, title: 'Text PDFs', desc: 'Instant extraction from selectable-text PDFs' },
            { icon: ScanLine, title: 'Scanned PDFs', desc: 'Browser-native OCR — no server needed' },
            { icon: Sparkles, title: 'Adaptive Analysis', desc: 'Document-specific insights at any complexity level' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="text-center p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 rounded-xl mx-auto mb-3 flex items-center justify-center">
                <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">{title}</h4>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
