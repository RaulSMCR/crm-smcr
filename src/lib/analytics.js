import { getConsent } from '@/lib/consent';

const GOOGLE_ADS_APPOINTMENT_CONVERSION_SEND_TO = 'AW-18327930588/mQ5SCMOkwtEcENyNuKNE';

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

export function trackAppointmentBookingConversion() {
  trackEvent('conversion', {
    send_to: GOOGLE_ADS_APPOINTMENT_CONVERSION_SEND_TO,
  });
}
