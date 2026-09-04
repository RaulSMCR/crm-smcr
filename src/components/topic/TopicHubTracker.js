"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { captureTopicAttribution } from "@/lib/topic-attribution-client";

export default function TopicHubTracker({ topicSlug }) {
  useEffect(() => {
    if (!topicSlug) return;
    captureTopicAttribution(topicSlug);
    trackEvent("view_topic_hub", {
      topic_slug: topicSlug,
      content_type: "topic_hub",
      source_page: window.location.pathname,
    });
  }, [topicSlug]);

  return null;
}
