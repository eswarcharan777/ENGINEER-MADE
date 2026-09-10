import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// The application moved from HashRouter to clean URLs for search indexing.
// Keep previously shared links such as /#/admin working instead of silently
// rendering the public home page.
const legacyHashPath = window.location.hash.startsWith('#/')
  ? window.location.hash.slice(1)
  : '';
if (legacyHashPath) {
  window.history.replaceState(null, '', legacyHashPath);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
}
