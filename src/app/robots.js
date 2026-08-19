import { SITE_URL, siteUrl } from '@/lib/site-url';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Ningún crawler de IA está bloqueado, y es deliberado: GPTBot, ClaudeBot,
      // PerplexityBot y Google-Extended tienen acceso completo. Que estos
      // modelos puedan leer y citar el trabajo publicado es la premisa de toda
      // la estrategia, no un efecto tolerado.
      //
      // Lo que se bloquea es lo que no tiene por qué rastrearse: el área
      // privada, los formularios sin contenido detrás, y los flujos de sesión
      // que llegan por enlace con token.
      //
      // `/agendar/` entra acá aunque esas páginas declaren canónico propio: son
      // una segunda versión del perfil profesional, con URL de cuid opaco, y
      // compiten con `/profesionales/{slug}` por la misma consulta.
      //
      // `/registro*` NO se bloquea acá, y no es un olvido: esas rutas están
      // hoy indexadas (las publicaba el sitemap). Bloquearlas por robots.txt
      // impediría que Google leyera el `noindex` que ahora declaran, y se
      // quedarían indexadas para siempre como «bloqueada por robots.txt». El
      // orden correcto es dejar que las rastree, que vea el noindex y las
      // saque; recién entonces tendría sentido bloquearlas.
      disallow: [
        '/api/',
        '/panel/',
        '/mi/',
        '/blog/preview/',
        '/agendar/',
        '/ingresar',
        '/recuperar',
        '/cambiar-password',
        '/verificar-email',
      ],
    },
    sitemap: siteUrl('sitemap.xml'),
    host: SITE_URL,
  };
}
