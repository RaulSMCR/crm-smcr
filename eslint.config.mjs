import nextConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  {
    files: [
      "src/app/panel/paciente/**/*.js",
      "src/components/paciente/**/*.js",
      "src/components/appointments/**/*.js",
      "src/components/UserAppointmentsPanel.js",
      "src/components/PaymentReceivedToast.js",
      "src/components/mi/InstallPrompt.js",
    ],
    rules: {
      // Un hook sin importar puede romper el panel solo cuando ya tiene datos.
      "no-undef": "error",
    },
  },
  {
    rules: {
      // Existing client effects use state synchronization intentionally.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
];

export default config;
