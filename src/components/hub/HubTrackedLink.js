"use client";

import Link from "next/link";
import { trackHubClick } from "@/components/hub/HubTracker";

export default function HubTrackedLink({ eventName, destination, onClick, ...props }) {
  function handleClick(event) {
    trackHubClick(eventName, destination || props.href);
    onClick?.(event);
  }

  return <Link {...props} onClick={handleClick} />;
}
