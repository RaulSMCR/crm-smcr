/**
 * Sends a custom event to Google Analytics 4.
 * No-ops in environments where gtag is not loaded (dev, SSR).
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}
