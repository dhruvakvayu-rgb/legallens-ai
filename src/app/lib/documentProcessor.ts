/**
 * Document Processing Pipeline
 *
 * Handles all document types entirely in the browser:
 *
 *  .txt / .doc / .docx  → FileReader (plain text)
 *  PDF (text-based)     → PDF.js text extraction
 *  PDF (image/scanned)  → PDF.js renders pages → Tesseract.js OCR
 *
 * Steps:
 *  1. Detect file type
 *  2. For PDFs: attempt text extraction; if yield < MIN_CHARS_PER_PAGE treat as scanned
 *  3. For scanned pages: render to canvas → OCR with Tesseract
 *  4. Clean and return extracted text + metadata
 */

export type ProcessingStage =
  | 'reading'
  | 'extracting-text'
  | 'detecting-type'
  | 'ocr-init'
  | 'ocr-page'
  | 'cleaning'
  | 'done'
  | 'error';

export interface ProcessingProgress {
  stage: ProcessingStage;
  /** 0–100 */
  percent: number;
  message: string;
  /** Set when stage === 'error' */
  error?: string;
}

export interface ProcessingResult {
  text: string;
  /** true if OCR was used for at least one page */
  usedOCR: boolean;
  /** true if OCR confidence was low on any page */
  lowConfidence: boolean;
  pageCount: number;
  method: 'text' | 'ocr' | 'mixed' | 'plaintext';
}

type ProgressCallback = (p: ProcessingProgress) => void;

// Minimum average characters per page to consider a PDF text-based
const MIN_CHARS_PER_PAGE = 80;
// Max pages to OCR (performance guard for hackathon use)
const MAX_OCR_PAGES = 15;
// OCR confidence threshold below which we flag low confidence
const LOW_CONFIDENCE_THRESHOLD = 60;

// ─── PDF.js loader ────────────────────────────────────────────────────────────

async function loadPdfJs() {
  // Dynamic import keeps pdfjs out of the main bundle until needed
  const pdfjsLib = await import('pdfjs-dist');

  // Point the worker at the pre-built worker file served by Vite
  // Using ?url suffix so Vite resolves it as a static asset URL
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // Inline worker fallback — avoids needing a separate worker file
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;
  }

  return pdfjsLib;
}

// ─── Text cleaning ────────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    // Normalise line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove null bytes and other control chars (except newlines/tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse 3+ consecutive blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove lines that are just noise (single chars, page numbers)
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      // Keep empty lines (paragraph breaks)
      if (t.length === 0) return true;
      // Drop lines that are just a number (page numbers)
      if (/^\d{1,3}$/.test(t)) return false;
      // Drop very short lines that are likely OCR noise
      if (t.length < 2) return false;
      return true;
    })
    .join('\n')
    // Merge hyphenated line breaks (common in PDFs)
    .replace(/-\n([a-z])/g, '$1')
    // Collapse excessive spaces
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ─── Plain text / DOCX fallback ───────────────────────────────────────────────

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(
  arrayBuffer: ArrayBuffer,
  onProgress: ProgressCallback,
): Promise<{ pages: string[]; pageCount: number }> {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    onProgress({
      stage: 'extracting-text',
      percent: Math.round((i / pageCount) * 40), // 0–40%
      message: `Extracting text from page ${i} of ${pageCount}…`,
    });

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return { pages, pageCount };
}

// ─── PDF page → canvas → OCR ──────────────────────────────────────────────────

async function ocrPdfPages(
  arrayBuffer: ArrayBuffer,
  scannedPageIndices: number[],
  totalPages: number,
  onProgress: ProgressCallback,
): Promise<{ texts: Map<number, string>; lowConfidence: boolean }> {
  const pdfjsLib = await loadPdfJs();
  const { createWorker } = await import('tesseract.js');

  onProgress({ stage: 'ocr-init', percent: 42, message: 'Initialising OCR engine…' });

  const worker = await createWorker('eng', 1, {
    // Suppress tesseract.js console noise
    logger: () => {},
  });

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const texts = new Map<number, string>();
  let lowConfidence = false;

  const pagesToOCR = scannedPageIndices.slice(0, MAX_OCR_PAGES);

  for (let idx = 0; idx < pagesToOCR.length; idx++) {
    const pageNum = pagesToOCR[idx] + 1; // pdfjs is 1-indexed
    const progressPercent = 45 + Math.round((idx / pagesToOCR.length) * 45); // 45–90%

    onProgress({
      stage: 'ocr-page',
      percent: progressPercent,
      message: `Running OCR on page ${pageNum} of ${totalPages}…`,
    });

    // Render page to canvas
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR accuracy

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // OCR the canvas
    const { data } = await worker.recognize(canvas);

    if (data.confidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidence = true;
    }

    texts.set(pagesToOCR[idx], data.text);
  }

  await worker.terminate();
  return { texts, lowConfidence };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function processDocument(
  file: File,
  onProgress: ProgressCallback,
): Promise<ProcessingResult> {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  // ── Non-PDF: read as plain text ──
  if (!isPDF) {
    onProgress({ stage: 'reading', percent: 10, message: 'Reading document…' });
    const raw = await readAsText(file);
    onProgress({ stage: 'cleaning', percent: 90, message: 'Cleaning text…' });
    const text = cleanText(raw);
    onProgress({ stage: 'done', percent: 100, message: 'Done.' });
    return { text, usedOCR: false, lowConfidence: false, pageCount: 1, method: 'plaintext' };
  }

  // ── PDF: load as ArrayBuffer ──
  onProgress({ stage: 'reading', percent: 5, message: 'Loading PDF…' });

  const arrayBuffer = await file.arrayBuffer();

  // Step 1: Extract text from all pages
  onProgress({ stage: 'extracting-text', percent: 10, message: 'Extracting text from PDF…' });
  const { pages, pageCount } = await extractPdfText(arrayBuffer, onProgress);

  // Step 2: Detect which pages are image-based (too little text)
  onProgress({ stage: 'detecting-type', percent: 41, message: 'Detecting document type…' });

  const scannedPageIndices: number[] = [];
  const textPageIndices: number[] = [];

  pages.forEach((text, idx) => {
    const charCount = text.replace(/\s/g, '').length;
    if (charCount < MIN_CHARS_PER_PAGE) {
      scannedPageIndices.push(idx);
    } else {
      textPageIndices.push(idx);
    }
  });

  const isFullyScanned = scannedPageIndices.length === pageCount;
  const isMixed = scannedPageIndices.length > 0 && textPageIndices.length > 0;
  const isTextBased = scannedPageIndices.length === 0;

  // Step 3: OCR scanned pages if needed
  let ocrTexts = new Map<number, string>();
  let lowConfidence = false;
  let usedOCR = false;

  if (!isTextBased) {
    usedOCR = true;
    const result = await ocrPdfPages(arrayBuffer, scannedPageIndices, pageCount, onProgress);
    ocrTexts = result.texts;
    lowConfidence = result.lowConfidence;
  }

  // Step 4: Merge text and OCR results in page order
  onProgress({ stage: 'cleaning', percent: 92, message: 'Cleaning and assembling text…' });

  const finalPages = pages.map((pageText, idx) => {
    if (ocrTexts.has(idx)) return ocrTexts.get(idx)!;
    return pageText;
  });

  const rawCombined = finalPages.join('\n\n');
  const text = cleanText(rawCombined);

  onProgress({ stage: 'done', percent: 100, message: 'Processing complete.' });

  const method: ProcessingResult['method'] = isFullyScanned
    ? 'ocr'
    : isMixed
    ? 'mixed'
    : 'text';

  return { text, usedOCR, lowConfidence, pageCount, method };
}
