"use client";

import { trackHubClick } from "@/components/hub/HubTracker";

export default function HubTrackedAnchor({ eventName, destination, onClick, ...props }) {
  function handleClick(event) {
    trackHubClick(eventName, destination || props.href);
    onClick?.(event);
  }

  return <a {...props} onClick={handleClick} />;
}
