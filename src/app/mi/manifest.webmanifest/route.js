// src/app/mi/manifest.webmanifest/route.js
// Manifest de la PWA de pacientes, servido en /mi/manifest.webmanifest.
//
// La convención metadata `manifest.js` de Next solo aplica en la RAÍZ de app/
// (genera /manifest.webmanifest); en un segmento anidado se ignora. Por eso se
// sirve como route handler estático, con el Content-Type correcto.
//
// Enlazado solo desde el layout de /mi (metadata.manifest). El middleware expone
// este path como público (el navegador pide el manifest sin credenciales).
export const dynamic = "force-static";

const manifest = {
  id: "/mi",
  name: "SMCR — Mi espacio",
  short_name: "SMCR",
  description: "Tu espacio de bienestar: agenda, pagos y biblioteca.",
  start_url: "/mi",
  scope: "/mi",
  display: "standalone",
  orientation: "portrait",
  lang: "es-CR",
  dir: "ltr",
  background_color: "#F6EFDF",
  theme_color: "#2B7073",
  // Reutiliza los íconos maskable ya existentes en public/. purpose "any maskable"
  // garantiza la instalabilidad (Chrome exige un ícono usable como "any" ≥192px).
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
