# T08 — Constraint de exclusión contra dobles reservas (UX-03)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL (Supabase). Citas en el modelo `Appointment` (`date` y `endDate` son `Timestamptz`, `professionalId`, `status`). Reservas desde `src/actions/booking-actions.js` (flujo público) y `src/actions/patient-booking-actions.js` (panel del paciente), ambos con soporte de citas recurrentes.

## Reglas duras
1. La migración con SQL crudo se crea con `npx prisma migrate dev --create-only --name appointment_no_overlap` y se edita el `.sql` generado a mano. Nada de `db push`.
2. No cambies la UX de selección de horarios; solo la integridad y el manejo del error.
3. Mensajes en español de Costa Rica, con tildes.
4. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
El chequeo de conflictos (`findRecurringConflict`) corre ANTES de la transacción que crea las citas: dos solicitudes simultáneas del mismo horario pasan ambas el chequeo y crean citas superpuestas (TOCTOU). No hay constraint en la base.

## Pasos

1. Lee completos ambos archivos de booking y el modelo `Appointment` en `prisma/schema.prisma`.
2. Migración SQL (en el archivo generado con `--create-only`):
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;

   ALTER TABLE "Appointment"
   ADD CONSTRAINT appointment_no_overlap
   EXCLUDE USING gist (
     "professionalId" WITH =,
     tstzrange("date", "endDate") WITH &&
   )
   WHERE (status IN ('PENDING', 'CONFIRMED'));
   ```
   Verifica los nombres reales de tabla/columnas/enum que Prisma generó (revisa migraciones previas en `prisma/migrations/`); ajusta mayúsculas/comillas según corresponda.
3. Antes de aplicar, comprueba solapamientos existentes con una consulta y, si los hay, repórtalos en el resumen (la migración fallaría; en ese caso entrega la consulta de diagnóstico y detente).
4. En ambos flujos de creación y reagendamiento: captura la violación del constraint (Prisma la reporta como error con código `P2010`/mensaje `23P01` según la vía) y devuélvela como error de negocio amable: «Ese horario acaba de ser reservado por otra persona. Elegí otro espacio, por favor.» El chequeo previo existente se mantiene (da mejores mensajes); el constraint es la red final.
5. Dentro del `$transaction` que crea series recurrentes, el fallo de UNA ocurrencia debe abortar TODA la serie (comportamiento actual de transacción — verifica que sea así).
6. Test de integración en `tests/integration/booking-overlap.test.js` si el entorno de test tiene BD; si no, test unitario del mapeo del error a mensaje amable, y deja documentado cómo probar el constraint manualmente con dos `INSERT` en SQL.

## Qué NO hacer
- No apliques el constraint a citas `CANCELLED_*`, `COMPLETED` ni `NO_SHOW` (deben poder coexistir con nuevas reservas).
- No refactorices `findRecurringConflict` (duplicación conocida, tarea futura).
- No cambies zonas horarias ni el formato de fechas.

## Criterios de aceptación
- [ ] Dos inserciones solapadas para el mismo profesional (status activo): la segunda falla a nivel de BD.
- [ ] El usuario ve el mensaje amable, no un error 500.
- [ ] Cancelar una cita libera el horario (una nueva reserva en ese rango funciona).
- [ ] Citas de profesionales distintos en el mismo horario siguen permitidas.
