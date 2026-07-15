import { getConsent } from '@/lib/consent';

/**
 * Sends a custom event to Google Analytics 4.
 * No-ops in environments where gtag is not loaded (dev, SSR) o sin consentimiento
 * (LEG-01): con Consent Mode el stub `gtag` existe siempre, así que además del
 * guard sobre `gtag` verificamos el consentimiento para no encolar eventos.
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  if (getConsent() !== 'granted') return;
  window.gtag('event', eventName, params);
}
