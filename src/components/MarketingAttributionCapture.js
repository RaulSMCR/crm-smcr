"use client";

import { useEffect } from "react";
import { captureMarketingAttribution } from "@/lib/marketing-attribution-client";

export default function MarketingAttributionCapture() {
  useEffect(() => {
    captureMarketingAttribution();
  }, []);

  return null;
}
