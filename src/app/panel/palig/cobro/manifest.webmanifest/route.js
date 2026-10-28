// src/app/panel/palig/cobro/manifest.webmanifest/route.js
// Manifest de la app de cobros PALIG para el celular, servido en
// /panel/palig/cobro/manifest.webmanifest. Mismo patrón que /mi (un manifest
// anidado no lo genera la convención de Next).
//
// `share_target` pone la app en el menú «Compartir» de Android: la captura del
// comprobante llega por POST a /panel/palig/cobro/compartir, donde la recibe el
// service worker (public/cobro-sw.js). Es un manifest aparte, y no el del sitio,
// para que los pacientes que instalan el sitio no vean esta opción.
//
// /panel/palig no está en las rutas protegidas del middleware: el navegador
// pide el manifest sin la cookie de sesión y tiene que poder leerlo.
export const dynamic = "force-static";

const manifest = {
  id: "/panel/palig/cobro",
  name: "SMCR — Cobros PALIG",
  short_name: "Cobros",
  description: "Comprobante SINPE → factura y formulario PALIG.",
  start_url: "/panel/palig/cobro",
  scope: "/panel/palig/cobro",
  display: "standalone",
  orientation: "portrait",
  lang: "es-CR",
  background_color: "#F6EFDF",
  theme_color: "#2B7073",
  icons: [
    { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
  share_target: {
    action: "/panel/palig/cobro/compartir",
    method: "POST",
    enctype: "multipart/form-data",
    params: { files: [{ name: "comprobante", accept: ["image/*", "application/pdf"] }] },
  },
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
