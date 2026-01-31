// prisma.config.js
const { defineConfig } = require('@prisma/config');
const path = require('path');
require('dotenv').config(); // Carga las variables de entorno

module.exports = defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      // directUrl: process.env.DIRECT_URL, // Descomentar si es necesario
    },
  },
  
  // Tu schema vive en ./prisma/schema.prisma
  schema: path.join('prisma', 'schema.prisma'),

  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'node prisma/seed.js',
  },
});