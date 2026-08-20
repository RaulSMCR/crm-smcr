import { PrismaClient } from '@prisma/client';

/**
 * `connection_limit=1` en `DATABASE_URL` es correcto para producción: cada
 * función serverless vive poco, atiende una petición y no debería acaparar
 * conexiones del pooler.
 *
 * **El build no es serverless.** Desde que las rutas de artículo, perfil y
 * servicio se prerenderizan (S14), `next build` levanta hasta quince workers que
 * renderizan páginas en paralelo, y cada worker resuelve varias consultas a la
 * vez. Con una sola conexión, la segunda consulta simultánea espera diez
 * segundos y revienta con P2024 — el build falla sin que haya nada malo en la
 * base.
 *
 * Así que durante el build, y solo durante el build, se sube el límite. No se
 * toca la variable de entorno: se reescribe la URL en memoria, para que
 * producción siga con el valor que le corresponde sin depender de que alguien
 * recuerde configurarlo distinto.
 */
function urlParaEsteContexto() {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.NEXT_PHASE !== 'phase-production-build') return url;

  try {
    const u = new URL(url);
    u.searchParams.set('connection_limit', '10');
    // El pooler necesita margen para no cortar la consulta antes de que el
    // worker consiga su turno.
    u.searchParams.set('pool_timeout', '30');
    return u.toString();
  } catch {
    // Si la URL no parsea, no es tarea de este archivo diagnosticarlo: se
    // devuelve tal cual y que falle donde corresponde, con su propio mensaje.
    return url;
  }
}

const prismaClientSingleton = () => {
  const url = urlParaEsteContexto();
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
};

const globalForPrisma = global;

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
