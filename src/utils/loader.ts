/**
 * Dynamically injects the Geoportail v3 API script and resolves when
 * the global `lux` namespace is available.
 */

const LUX_SCRIPT_URL = '//apiv3.geoportail.lu/apiv3loader.js';
const LUX_SCRIPT_ID = 'geoportail-apiv3-loader';

let loadPromise: Promise<void> | null = null;

/**
 * Loads the Geoportail apiv3loader.js script exactly once.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export function loadLuxApi(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Already loaded (e.g. added manually in HTML)
    if (typeof window !== 'undefined' && window.lux) {
      resolve();
      return;
    }

    if (typeof document === 'undefined') {
      reject(new Error('loadLuxApi must run in a browser environment'));
      return;
    }

    // Avoid duplicate script tags
    if (document.getElementById(LUX_SCRIPT_ID)) {
      pollForLux(resolve, reject);
      return;
    }

    const script = document.createElement('script');
    script.id = LUX_SCRIPT_ID;
    script.src = LUX_SCRIPT_URL;
    script.async = true;

    script.onload = () => pollForLux(resolve, reject);
    script.onerror = () => {
      loadPromise = null; // allow retry
      reject(new Error(`Failed to load Geoportail API from ${LUX_SCRIPT_URL}`));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * The lux API may initialise asynchronously after the script loads.
 * Poll until window.lux is defined (max ~5 s).
 */
function pollForLux(resolve: () => void, reject: (err: Error) => void): void {
  const maxAttempts = 100;
  let attempts = 0;

  const check = () => {
    if (window.lux) {
      resolve();
      return;
    }
    if (attempts++ >= maxAttempts) {
      loadPromise = null;
      reject(new Error('Timed out waiting for window.lux to be defined'));
      return;
    }
    setTimeout(check, 50);
  };

  check();
}
