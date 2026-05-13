/**
 * Dynamically injects the Geoportail v3 assets and resolves when
 * the global `lux` namespace is available.
 */

const LUX_BASE_URL = 'https://apiv3.geoportail.lu/';
const LUX_PROTOCOL = 'https';
const LUX_I18N_URL = 'https://apiv3.geoportail.lu/static-ngeo/build/fr.json';
const LUX_STYLESHEET_URL = 'https://apiv3.geoportail.lu/static-ngeo/build/apiv3.css';
const LUX_VENDOR_URL = 'https://apiv3.geoportail.lu/static-ngeo/build/vendor.js';
const LUX_API_URL = 'https://apiv3.geoportail.lu/static-ngeo/build/apiv3.js';

const LUX_STYLESHEET_ID = 'geoportail-apiv3-css';
const LUX_VENDOR_SCRIPT_ID = 'geoportail-apiv3-vendor';
const LUX_API_SCRIPT_ID = 'geoportail-apiv3-script';

const ELEMENT_STATUS_ATTRIBUTE = 'data-geoportail-status';

let loadPromise: Promise<void> | null = null;

/**
 * Loads the Geoportail API assets exactly once.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export function loadLuxApi(): Promise<void> {
  if (loadPromise) return loadPromise;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('loadLuxApi must be called in a browser environment'));
  }

  loadPromise = loadLuxApiInternal().catch((error: unknown) => {
    loadPromise = null;
    throw error instanceof Error ? error : new Error(String(error));
  });

  return loadPromise;
}

/**
 * The lux API may initialise asynchronously after the scripts load.
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

async function loadLuxApiInternal(): Promise<void> {
  if (window.lux) {
    configureLux(window.lux);
    return;
  }

  await loadStylesheetOnce(LUX_STYLESHEET_ID, LUX_STYLESHEET_URL);
  await loadScriptOnce(LUX_VENDOR_SCRIPT_ID, LUX_VENDOR_URL);
  await loadScriptOnce(LUX_API_SCRIPT_ID, LUX_API_URL);
  await waitForLux();
  configureLux(window.lux!);
}

function waitForLux(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    pollForLux(resolve, reject);
  });
}

function configureLux(lux: NonNullable<Window['lux']>): void {
  lux.setBaseUrl(LUX_BASE_URL, LUX_PROTOCOL);
  lux.setI18nUrl(LUX_I18N_URL);
}

function loadScriptOnce(id: string, src: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    return waitForElementLoad(existing, src, 'script');
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    script.setAttribute(ELEMENT_STATUS_ATTRIBUTE, 'loading');

    const cleanup = attachLoadHandlers(
      script,
      () => resolve(),
      () => reject(new Error(`Failed to load Geoportail script from ${src}`)),
      'script'
    );

    document.head.appendChild(script);
    void cleanup;
  });
}

function loadStylesheetOnce(id: string, href: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing) {
    return waitForElementLoad(existing, href, 'stylesheet');
  }

  return new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(ELEMENT_STATUS_ATTRIBUTE, 'loading');

    const cleanup = attachLoadHandlers(
      link,
      () => resolve(),
      () => reject(new Error(`Failed to load Geoportail stylesheet from ${href}`)),
      'stylesheet'
    );

    document.head.appendChild(link);
    void cleanup;
  });
}

function waitForElementLoad(
  element: HTMLScriptElement | HTMLLinkElement,
  resourceUrl: string,
  kind: 'script' | 'stylesheet'
): Promise<void> {
  const status = element.getAttribute(ELEMENT_STATUS_ATTRIBUTE);

  if (status === 'loaded') {
    return Promise.resolve();
  }

  if (status === 'error') {
    element.remove();
    return Promise.reject(new Error(`Failed to load Geoportail ${kind} from ${resourceUrl}`));
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = attachLoadHandlers(
      element,
      () => resolve(),
      () => reject(new Error(`Failed to load Geoportail ${kind} from ${resourceUrl}`)),
      kind
    );

    void cleanup;
  });
}

function attachLoadHandlers(
  element: HTMLScriptElement | HTMLLinkElement,
  onLoad: () => void,
  onError: () => void,
  kind: 'script' | 'stylesheet'
): () => void {
  const handleLoad = () => {
    element.setAttribute(ELEMENT_STATUS_ATTRIBUTE, 'loaded');
    cleanup();
    onLoad();
  };

  const handleError = () => {
    element.setAttribute(ELEMENT_STATUS_ATTRIBUTE, 'error');
    cleanup();
    element.remove();
    onError();
  };

  const cleanup = () => {
    element.removeEventListener('load', handleLoad);
    element.removeEventListener('error', handleError);
  };

  element.addEventListener('load', handleLoad, { once: true });
  element.addEventListener('error', handleError, { once: true });

  if (kind === 'stylesheet') {
    const link = element as HTMLLinkElement;
    if (link.sheet) {
      handleLoad();
    }
  } else {
    const script = element as HTMLScriptElement;
    if (script.dataset.geoportailStatus === 'loaded') {
      handleLoad();
    }
  }

  return cleanup;
}
