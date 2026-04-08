import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { ThemeProvider } from './app/components/ThemeProvider.tsx';
import { DocumentProvider } from './app/lib/documentStore.tsx';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <DocumentProvider>
      <App />
    </DocumentProvider>
  </ThemeProvider>
);
