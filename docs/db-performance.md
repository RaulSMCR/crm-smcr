# Rendimiento de la base de datos (Prisma + Supabase)

## Síntoma

Cada carga de ruta protegida (`/mi/*`, `/panel/*`) y cada llamada a `/api/auth/me`
tardaba ~1.5 s (hasta 3 s en frío). Se sentía en el header ("Ingresar" tardaba en
resolverse), en el login y en todo el panel.

## Diagnóstico (medido, no supuesto)

`getSession()` ([src/lib/auth.js](../src/lib/auth.js)) hace **un query a la DB por
request** para revalidar `sessionVersion`/`isActive`. Ese query — un `findUnique`
por PK, que debería ser ~1 round-trip — tardaba ~1.1 s incluso tibio.

Benchmark de query cruda de Prisma (sin Next/HTTP) contra la misma DB, comparando
los dos poolers de Supabase:

| | `SELECT 1` (tibia) | `findUnique` PK |
|---|---|---|
| **Pooler de transacción** — `:6543`, `pgbouncer=true` (`DATABASE_URL`) | **~1116 ms** | ~1118 ms |
| **Pooler de sesión** — `:5432` (`DIRECT_URL`) | **~218 ms** | ~218 ms |

`1116 / 218 ≈ 5.1`: el **pooler de transacción hace ~5 round-trips por query**
(por cómo Prisma maneja prepared statements sobre pgBouncer), el de sesión hace 1.
El costo real = `round-trips × latencia de red`. La DB está en **AWS us-west-2
(Oregon)** (`aws-0-us-west-2.pooler.supabase.com`); Vercel por defecto corre en
`iad1` (Washington DC) → **cross-region**, y en dev desde Costa Rica la latencia es
aún mayor. Ese multiplicador de round-trips es lo que amplifica la distancia.

## Fix aplicado — co-locar Vercel con la DB (bajo riesgo, alto impacto)

[vercel.json](../vercel.json) fija las funciones a **`pdx1`** (Portland = AWS
us-west-2), **la misma región AWS que la DB**:

```json
{ "regions": ["pdx1"], "crons": [ ... ] }
```

Con las funciones y la DB en la misma región AWS, cada round-trip pasa de ~60-80 ms
(cross-region) a ~1-5 ms (intra-región). El pooler de transacción sigue haciendo 5
round-trips, pero `5 × ~3 ms ≈ 15 ms` en vez de `5 × ~70 ms ≈ 350 ms`. **Se
mantiene el pooler de transacción** (seguro para serverless), solo se lo acerca.

> Requiere un deploy a producción para confirmar los números absolutos; la evidencia
> del multiplicador de round-trips (medida arriba) es la base del cambio.

## Ya hecho en código

El header dejó de depender de este query: usa `getSessionLite()` (verifica el JWT
**sin tocar la DB**) vía [`/api/auth/session`](../src/app/api/auth/session/route.js).
Era el llamador más frecuente de `getSession()`; ver [PublicHeader](../src/components/PublicHeader.js).

## Opcional — acelerar el DEV local

En dev (un solo desarrollador, sin concurrencia) se puede apuntar `DATABASE_URL` al
**pooler de sesión** (el mismo valor que `DIRECT_URL`, puerto 5432) para el 5× por
query. **No hacerlo en producción serverless sin cuidado**: el modo sesión asigna
una conexión dedicada por cliente y bajo concurrencia puede agotar el límite de
conexiones del pooler (reproducido en pruebas). Para prod, la co-locación de arriba
es el camino seguro.

## Pendiente de considerar (no aplicado)

- **Revocación con TTL corto**: `getSession()` consulta la DB en cada request para
  que la revocación de sesión sea inmediata. Un cache en memoria de pocos segundos
  reduciría los queries drásticamente, a cambio de que una sesión revocada siga
  válida unos segundos. Es una decisión de seguridad del equipo; no se tocó.
- **Índices**: el cuello de botella medido es de red/round-trips, no de plan de
  query (es un lookup por PK). No hay índice que agregar acá.
