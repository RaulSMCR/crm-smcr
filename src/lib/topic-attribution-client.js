"use client";

const STORAGE_KEY = "smcr-topic-attribution";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function read() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return null;
    const capturedAt = Date.parse(value.capturedAt || "");
    if (!Number.isFinite(capturedAt) || Date.now() - capturedAt >= MAX_AGE_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function captureTopicAttribution(topicSlug) {
  if (typeof window === "undefined" || !topicSlug || read()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ topicSlug: String(topicSlug).slice(0, 80), capturedAt: new Date().toISOString() }));
  } catch {
    // Attribution is useful but must never block navigation or booking.
  }
}

export function getTopicAttribution() {
  if (typeof window === "undefined") return "";
  return String(read()?.topicSlug || "").slice(0, 80);
}
