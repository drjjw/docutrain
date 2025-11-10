import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { debugLog } from './utils/debug';
import { getAPIUrl } from './utils/apiUrl';

// Pre-fetch debug override setting from server
if (typeof window !== 'undefined') {
  fetch(`${getAPIUrl()}/api/debug-config`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) {
        // Store in a way the debug utility can access synchronously
        (window as any).__ALLOW_DEBUG_OVERRIDE__ = data.allowDebugOverride !== false;
      }
    })
    .catch(() => {
      // Default to allowing override if check fails (backward compatible)
      (window as any).__ALLOW_DEBUG_OVERRIDE__ = true;
    });
}

// Detect if running from source (Vite dev server) or built version
function detectRunningMode() {
  // Check if Vite HMR is available (dev server indicator)
  let isViteDev = false;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta is available in Vite
    if (import.meta.hot !== undefined) {
      isViteDev = true;
    }
  } catch (e) {
    // import.meta not available or not in dev mode
  }
  
  // Also check by port
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  if (!isViteDev && (port === '5173' || port === '5174' || port === '5176')) {
    isViteDev = true;
  }
  
  // Check for built bundle indicators (hashed filenames in script tags)
  // Wait for DOM to be ready
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const hasHashedBundles = scripts.some(s => {
    const src = s.getAttribute('src') || s.src || '';
    // Built bundles have pattern like: assets/main-{hash}.js or /app/assets/main-{hash}.js
    return /\/?app\/assets\/.*-[a-f0-9]{8,}\.(js|css)$/i.test(src) ||
           /assets\/.*-[a-f0-9]{8,}\.(js|css)$/i.test(src);
  });
  
  // Also check if we can see the bundle name in the console (from error messages)
  // If we're seeing main-BnoqN-F0.js, that's a built bundle
  const isBuiltByBundleName = /main-[a-f0-9]{8,}\.js/i.test(window.location.href) || 
                               document.querySelector('script[src*="main-"]') !== null;
  
  let mode: string;
  let source: string;
  
  if (isViteDev) {
    mode = 'SOURCE (Vite Dev Server)';
    source = `http://localhost:${port}/app (hot reload enabled)`;
  } else if (hasHashedBundles || isBuiltByBundleName || port === '3458') {
    mode = 'BUILT (dist/app/)';
    source = `http://localhost:${port}/app (served by Express, no hot reload)`;
  } else {
    mode = 'UNKNOWN';
    source = window.location.href;
  }
  
  debugLog('\n' + '='.repeat(60));
  debugLog(`⚛️  REACT DASHBOARD - Running Mode: ${mode}`);
  debugLog(`🔗 Source: ${source}`);
  debugLog(`🌐 Port: ${port}`);
  debugLog(`📦 Vite HMR: ${isViteDev ? '✅ Available' : '❌ Not available'}`);
  debugLog(`🏗️  Built bundles: ${hasHashedBundles || isBuiltByBundleName ? '✅ Detected' : '❌ Not detected'}`);
  debugLog(`📄 Scripts found: ${scripts.length}`);
  if (scripts.length > 0 && scripts[0]) {
    debugLog(`   Example: ${scripts[0].src || scripts[0].getAttribute('src')}`);
  }
  debugLog('='.repeat(60) + '\n');
}

// Log running mode - ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectRunningMode);
} else {
  // DOM already ready, but wait a tick to ensure all scripts are loaded
  setTimeout(detectRunningMode, 0);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

