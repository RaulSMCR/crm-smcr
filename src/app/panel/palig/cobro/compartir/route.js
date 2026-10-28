// src/app/panel/palig/cobro/compartir/route.js
// Destino del «Compartir» de Android. Normalmente lo atiende el service worker
// (public/cobro-sw.js) sin llegar acá. Si todavía no está instalado —la primera
// vez, antes de abrir la app— el archivo no se guarda en el servidor: se vuelve
// a la app avisando que hay que compartirlo de nuevo.
export function POST(request) {
  return Response.redirect(new URL("/panel/palig/cobro?compartido=error", request.url), 303);
}
