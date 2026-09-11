"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

function utmParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].flatMap((key) => {
    const value = params.get(key);
    return value ? [[key, value]] : [];
  }));
}

export function trackHubClick(eventName, destination) {
  trackEvent(eventName, {
    source_page: window.location.pathname,
    destination,
    ...utmParams(),
  });
}

export default function HubTracker() {
  useEffect(() => {
    trackEvent("view_hub_raul_olmedo", {
      source_page: window.location.pathname,
      ...utmParams(),
    });
  }, []);

  return null;
}
