# T03 — Banner de consentimiento y tracking condicionado (LEG-01)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Tailwind CSS, Prisma + PostgreSQL. Sitio de salud mental: los datos de navegación de pacientes son sensibles (Ley 8968 de Costa Rica). Roles: USER (paciente), PROFESSIONAL, ADMIN.

## Reglas duras
1. NO contrates ni integres ningún CMP comercial ni servicio nuevo. Solución 100% propia (componente React + cookie).
2. Alcance quirúrgico: `src/app/layout.js`, un componente nuevo, y `src/lib/analytics.js` / `src/lib/meta-pixel.js` si hace falta condicionar helpers.
3. Textos en español de Costa Rica, con tildes. Tono cálido y claro.
4. Al terminar: `npm run lint` y `npm run build` sin errores. Entrega lista de archivos + cómo probar en devtools.

## Problema
En `src/app/layout.js` se inyectan Google Analytics 4 y Meta Pixel para TODO visitante en producción, sin consentimiento previo y también dentro de los paneles autenticados (`/panel/*`). En un sitio de salud mental esto expone datos sensibles a terceros sin base legal.

## Pasos

1. Lee `src/app/layout.js`, `src/lib/analytics.js`, `src/lib/meta-pixel.js` y la página `src/app/cookies/` para conocer el texto legal existente.
2. Crea `src/components/ConsentBanner.js` (client component):
   - Banner fijo inferior, discreto, accesible (focus visible, cierre con teclado): texto breve tipo «Usamos cookies para entender cómo se usa el sitio y mejorar tu experiencia. Podés aceptarlas o rechazarlas.» con enlace a `/cookies`, botones **Aceptar** y **Rechazar** con el mismo peso visual.
   - Guarda la decisión en una cookie `consent` (`granted` | `denied`, 12 meses) y en `localStorage`.
   - Si ya hay decisión, no se muestra.
3. Implementa **Google Consent Mode v2** en el layout: antes de cualquier script, un inline script define `gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })`. Al aceptar, el banner ejecuta `gtag('consent', 'update', {...granted})` y dispara la carga.
4. Carga condicionada:
   - GA4: el script de gtag solo se inyecta si `consent === granted` (o tras aceptar, sin recargar la página).
   - Meta Pixel: solo con consentimiento **y** NUNCA en rutas `/panel/*`, `/agendar/*`, `/ingresar`, `/registro/*`, `/recuperar`, `/verificar-email` (usa `usePathname` en un client component wrapper). En esas rutas el pixel no se carga aunque haya consentimiento.
5. `trackEvent()` en `src/lib/analytics.js` ya hace no-op si `gtag` no existe — verifica que siga siendo cierto sin consentimiento.
6. Añade en el banner un tercer enlace pequeño «Solo lo necesario» equivalente a Rechazar si simplifica; no uses dark patterns (nada de "Aceptar" gigante y "Rechazar" escondido).

## Qué NO hacer
- No agregues Google Tag Manager ni SDKs nuevos.
- No modifiques el contenido legal de `/cookies` ni `/privacidad` (revisión del abogado pendiente); si detectás inconsistencias, repórtalas en tu resumen final.
- No bloquees el renderizado del sitio por el banner.

## Criterios de aceptación
- [ ] En una sesión nueva (incógnito), la pestaña Network NO muestra peticiones a `googletagmanager.com` ni `connect.facebook.net` antes de aceptar.
- [ ] Tras Aceptar, GA carga sin recargar la página; tras Rechazar, nunca carga y el banner no reaparece.
- [ ] Con consentimiento aceptado, en `/panel/paciente` NO hay ninguna petición a `facebook`.
- [ ] El banner es usable con teclado y legible en móvil.
