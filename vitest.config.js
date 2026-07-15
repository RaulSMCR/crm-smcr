// vitest.config.js
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/lib/invoice-math.js",
        "src/lib/financial-schemas.js",
        "src/lib/booking-conflicts.js",
        "src/lib/fe/config.js",
        "src/lib/fe/xml.js",
        "src/lib/onvo/match-payment.js",
        "src/lib/appointment-recurrence.js",
        "src/lib/timezone.js",
        "src/lib/appointment-slots.js",
      ],
    },
  },
});
