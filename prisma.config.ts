// prisma.config.ts
import path from 'node:path';
import 'dotenv/config'; // <- IMPORTANTE: con prisma.config.* las .env NO se cargan solas
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Tu schema vive en ./prisma/schema.prisma
  schema: path.join('prisma', 'schema.prisma'),

  // Opcional pero útil: ruta de migraciones y comando de seed integrado
  migrations: {
    path: path.join('prisma', 'migrations'),
    // Prisma ejecutará este comando cuando hagas `npx prisma db seed`
    // (dejamos tu seed en JS tal como lo tenés)
    seed: 'node prisma/seed.js',
  },

  // Si más adelante dividís el schema en múltiples archivos, podés
  // cambiar "schema" por la carpeta que los contenga:
  // schema: path.join('prisma', 'schema'),
});
