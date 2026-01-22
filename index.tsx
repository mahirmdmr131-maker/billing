
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Entry point for A M Food Processing Manager.
 * Loads the modular App component which handles routing and state.
 */
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
