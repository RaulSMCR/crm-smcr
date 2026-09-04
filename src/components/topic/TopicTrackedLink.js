"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export default function TopicTrackedLink({ href, children, eventName, eventParams = {}, className, ...props }) {
  function handleClick() {
    if (eventName) trackEvent(eventName, eventParams);
  }

  return <Link href={href} onClick={handleClick} className={className} {...props}>{children}</Link>;
}
