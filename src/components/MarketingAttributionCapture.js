"use client";

import { useEffect } from "react";
import { captureMarketingAttribution } from "@/lib/marketing-attribution-client";
import { captureAdIdentifiers } from "@/lib/analytics/client-identifiers";

export default function MarketingAttributionCapture() {
  useEffect(() => {
    captureMarketingAttribution();
    captureAdIdentifiers();
  }, []);

  return null;
}
