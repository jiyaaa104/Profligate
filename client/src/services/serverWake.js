/**
 * Handles the API "waking up". Render's free tier sleeps after ~15 minutes
 * idle, and the first request afterwards can take up to a minute. While that
 * happens the app shows a "starting up" banner instead of a confusing error.
 */

const HEALTH_URL = `${import.meta.env.VITE_API_URL || "/api/v1"}/healthcheck`;

const WAKE_TIMEOUT_MS = 90_000; // give up after this long
const SHOW_BANNER_AFTER_MS = 2_500; // a normal response is much faster
const PING_TIMEOUT_MS = 20_000;
const PING_INTERVAL_MS = 3_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Tiny store for the "starting up" banner ─────────────────────────
let isWaking = false;
const listeners = new Set();

const setWaking = (value) => {
  if (isWaking === value) return;
  isWaking = value;
  listeners.forEach((listener) => listener());
};

export const subscribeToServerWake = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getServerWaking = () => isWaking;

// ── Wake detection ──────────────────────────────────────────────────
const pingOnce = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(HEALTH_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

let wakePromise = null;

/**
 * Resolves true once the API answers its health check, or false if it
 * doesn't within 90 seconds. Concurrent callers share one wait.
 */
export const waitForServer = () => {
  if (!wakePromise) {
    wakePromise = (async () => {
      const bannerTimer = setTimeout(
        () => setWaking(true),
        SHOW_BANNER_AFTER_MS,
      );
      const deadline = Date.now() + WAKE_TIMEOUT_MS;
      try {
        while (Date.now() < deadline) {
          if (await pingOnce()) return true;
          await sleep(PING_INTERVAL_MS);
        }
        return false;
      } finally {
        clearTimeout(bannerTimer);
        setWaking(false);
        wakePromise = null;
      }
    })();
  }
  return wakePromise;
};

/**
 * True when a request failed because the API couldn't be reached (asleep or
 * starting), rather than because the API answered with an error.
 */
export const isServerUnreachable = (error) => {
  if (error?.code === "ERR_CANCELED") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  if (!error?.response) return true; // network error, no answer at all
  return [502, 503, 504].includes(error.response.status);
};
