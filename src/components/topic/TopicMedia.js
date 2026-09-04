"use client";

import { trackEvent } from "@/lib/analytics";

export default function TopicMedia({ kind, url, topicSlug }) {
  if (!url) return null;

  const params = {
    topic_slug: topicSlug,
    content_type: kind,
    source_page: typeof window === "undefined" ? undefined : window.location.pathname,
  };
  const onPlay = () => trackEvent(kind === "video" ? "play_topic_video" : "play_topic_audio", params);

  if (kind === "video") {
    return (
      <video controls preload="metadata" className="mt-4 w-full rounded-2xl bg-slate-950" onPlay={onPlay}>
        <source src={url} />
        Tu navegador no puede reproducir este video.
      </video>
    );
  }

  return (
    <audio controls preload="metadata" className="mt-4 w-full" onPlay={onPlay}>
      <source src={url} />
      Tu navegador no puede reproducir este audio.
    </audio>
  );
}
