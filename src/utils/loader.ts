/**
 * Dynamically injects the Geoportail v4 assets and resolves when
 * the global `lux` namespace is available.
 *
 * This mirrors what the official `https://apiv4.geoportail.lu/apiv4loader.js`
 * does, except that the official loader relies on `document.write` and can
 * therefore only be used from a synchronous `<script>` tag in the page head.
 */

const LUX_BASE_URL = 'https://apiv4.geoportail.lu/';
const LUX_PROTOCOL = 'https';
const LUX_I18N_URL = 'https://apiv4.geoportail.lu/static-ngeo/build/fr.json';
const LUX_STYLESHEET_URL = 'https://apiv4.geoportail.lu/static-ngeo/build/apiv4.css';
const LUX_OL_URL = 'https://apiv4.geoportail.lu/static-ngeo/build/ol.js';
const LUX_PROJ4_URL = 'https://apiv4.geoportail.lu/static-ngeo/build/proj4.js';
const LUX_AUTOCOMPLETE_URL =
  'https://apiv4.geoportail.lu/static-ngeo/build/auto-complete.min.js';
const LUX_API_URL = 'https://apiv4.geoportail.lu/static-ngeo/build/apiv4.js';

const LUX_STYLESHEET_ID = 'geoportail-apiv4-css';
const LUX_OL_SCRIPT_ID = 'geoportail-apiv4-ol';
const LUX_PROJ4_SCRIPT_ID = 'geoportail-apiv4-proj4';
const LUX_AUTOCOMPLETE_SCRIPT_ID = 'geoportail-apiv4-autocomplete';
const LUX_API_SCRIPT_ID = 'geoportail-apiv4-script';

/** LUREF (EPSG:2169) definition, as registered by the official v4 loader. */
const LUREF_PROJECTION_CODE = 'EPSG:2169';
const LUREF_PROJ4_DEF =
  '+proj=tmerc +lat_0=49.83333333333334 +lon_0=6.166666666666667 +k=1 ' +
  '+x_0=80000 +y_0=100000 +ellps=intl ' +
  '+towgs84=-189.681,18.3463,-42.7695,-0.33746,-3.09264,2.53861,0.4598 ' +
  '+units=m +no_defs';

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
  await loadScriptOnce(LUX_OL_SCRIPT_ID, LUX_OL_URL);
  await loadScriptOnce(LUX_PROJ4_SCRIPT_ID, LUX_PROJ4_URL);
  registerLurefProjection();
  await loadScriptOnce(LUX_AUTOCOMPLETE_SCRIPT_ID, LUX_AUTOCOMPLETE_URL);
  await loadScriptOnce(LUX_API_SCRIPT_ID, LUX_API_URL);
  await waitForLux();
  configureLux(window.lux!);
}

/**
 * The v4 bundle expects `ol` and `proj4` as globals and does not register
 * LUREF itself — the official loader does it between loading proj4 and the
 * API bundle, so we do the same. Without it the map cannot handle the
 * EPSG:2169 positions the API works with.
 */
function registerLurefProjection(): void {
  const proj4 = window.proj4;
  const ol = window.ol;

  if (!proj4 || !ol?.proj?.proj4?.register) return;

  if (!proj4.defs(LUREF_PROJECTION_CODE)) {
    proj4.defs(LUREF_PROJECTION_CODE, LUREF_PROJ4_DEF);
  }

  ol.proj.proj4.register(proj4);
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
