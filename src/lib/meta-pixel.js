import { getConsent } from '@/lib/consent';

function fbq(...args) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  // Sin consentimiento no se envía nada al Pixel (LEG-01).
  if (getConsent() !== 'granted') return;
  window.fbq(...args);
}

export function trackLead() {
  fbq('track', 'Lead');
}

export function trackSchedule() {
  fbq('track', 'Schedule');
}

export function trackContact() {
  fbq('track', 'Contact');
}

export function trackViewContent(contentName, contentCategory) {
  fbq('track', 'ViewContent', { content_name: contentName, content_category: contentCategory });
}
