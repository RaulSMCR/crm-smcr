// src/app/pro/manifest.webmanifest/route.js
// Manifest de la PWA de profesionales, servido en /pro/manifest.webmanifest.
// Mismo armado que el de pacientes (ver src/app/mi/manifest.webmanifest): la
// convención `manifest.js` de Next solo aplica en la raíz de app/, y el
// middleware lo expone como público porque el navegador lo pide sin cookie.
export const dynamic = "force-static";

const manifest = {
  id: "/pro",
  name: "SMCR — Consultorio",
  short_name: "Consultorio",
  description: "La agenda del profesional: citas del día, cierre de sesiones y cobros.",
  start_url: "/pro",
  scope: "/pro",
  display: "standalone",
  orientation: "portrait",
  lang: "es-CR",
  dir: "ltr",
  background_color: "#F6EFDF",
  theme_color: "#2B7073",
  icons: [
    {
      src: "/web-app-manifest-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/web-app-manifest-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
