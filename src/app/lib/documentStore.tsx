import { createContext, useContext, useState, type ReactNode } from 'react';
import { analyzeDocument, type DocumentAnalysis } from './documentAnalyzer';

interface DocumentStore {
  rawText: string;
  fileName: string;
  analysis: DocumentAnalysis | null;
  setDocument: (text: string, fileName?: string) => void;
  clearDocument: () => void;
}

const DocumentContext = createContext<DocumentStore | null>(null);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);

  const setDocument = (text: string, name = 'Uploaded Document') => {
    setRawText(text);
    setFileName(name);
    setAnalysis(analyzeDocument(text));
  };

  const clearDocument = () => {
    setRawText('');
    setFileName('');
    setAnalysis(null);
  };

  return (
    <DocumentContext.Provider value={{ rawText, fileName, analysis, setDocument, clearDocument }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocument must be used inside DocumentProvider');
  return ctx;
}
