-- Registro a mano de la migración 20260913120000_hub_modulo_destacado.
--
-- Va aparte del DDL a propósito: el DDL vive una sola vez, en
-- prisma/migrations/20260913120000_hub_modulo_destacado/migration.sql, porque el
-- checksum de abajo es el sha256 de ESE archivo. Copiar el ALTER TABLE acá
-- también sería tener dos fuentes que pueden separarse, y la que se separe deja
-- el checksum mintiendo.
--
-- Se corre DESPUÉS de aplicar el DDL. Este proyecto no usa `migrate dev` ni
-- `migrate deploy` —ver el incidente del 2026-08-19—, así que la fila de
-- `_prisma_migrations` se escribe acá.
--
--   npx prisma db execute --file prisma/migrations/20260913120000_hub_modulo_destacado/migration.sql --schema ./prisma/schema.prisma
--   npx prisma db execute --file prisma/fixes/registrar-hub-modulo-destacado.sql --schema ./prisma/schema.prisma
--
-- Idempotente: la guarda es el NOT EXISTS y no un ON CONFLICT, porque
-- `_prisma_migrations` no tiene índice único sobre `migration_name`.

INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
SELECT gen_random_uuid()::text,
       'cd5a834e0f9dbe4abdc6b67349a77de92175212e299500c4e953bb113021c6f3',
       now(),
       '20260913120000_hub_modulo_destacado',
       now(),
       1
 WHERE NOT EXISTS (
   SELECT 1 FROM _prisma_migrations WHERE migration_name = '20260913120000_hub_modulo_destacado'
 );
