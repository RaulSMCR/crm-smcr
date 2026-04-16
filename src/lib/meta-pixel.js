function fbq(...args) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
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
