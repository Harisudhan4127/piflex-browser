import React from 'react';
import ReactDOM from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { App } from '@/App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={400}>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
