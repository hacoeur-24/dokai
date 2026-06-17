import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { DokaiProvider } from './state.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ToastProvider } from './components/Toast.js';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <DokaiProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DokaiProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
