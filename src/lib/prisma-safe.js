export function isPrismaConnectionError(error) {
  if (!error) return false;

  const name = typeof error?.name === "string" ? error.name : "";
  const message = typeof error?.message === "string" ? error.message : "";

  return (
    name === "PrismaClientInitializationError" ||
    message.includes("Can't reach database server") ||
    message.includes("Error querying the database")
  );
}

/**
 * ¿Estamos dentro del `next build`, generando HTML estático?
 *
 * La distinción importa porque degradar con elegancia significa cosas opuestas
 * según cuándo pase:
 *
 * - **En una petición real**, si la base no responde, mostrar «temporalmente no
 *   disponible» es lo correcto: el visitante ve algo, y el próximo intento
 *   probablemente funcione.
 *
 * - **Durante el build**, ese mismo aviso se hornea en el HTML estático y se
 *   sirve con HTTP 200 a todo el mundo —Google incluido— hasta que expire la
 *   revalidación. Un aviso de error servido como 200 es un soft-404: le enseña
 *   al buscador que la página del catálogo de servicios dice que no hay
 *   servicios.
 *
 * La política del proyecto para el build ya quedó fijada en el sitemap (H-07):
 * si no hay base, el build falla y se ve. Esto la extiende a las rutas que se
 * prerenderizan.
 */
export function enPrerender() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Relanza el error si estamos en build. Se llama desde el `catch` de una ruta
 * que degrada, justo antes de decidir mostrar el estado degradado.
 */
export function fallarSiEsBuild(error, ruta) {
  if (!enPrerender()) return;
  // Solo una falla de conexión real corta el build. Un timeout de aplicación no
  // cuenta: durante el build, quince workers consultan la misma base a la vez y
  // un límite pensado para proteger la latencia de una petición se dispara sin
  // que la base tenga nada malo.
  if (!isPrismaConnectionError(error)) return;
  console.error(`[build] ${ruta} no se pudo prerenderizar sin base de datos.`);
  throw error;
}
