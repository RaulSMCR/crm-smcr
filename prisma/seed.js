// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * La contraseña NO tiene valor por defecto, y es a propósito.
 *
 * Antes el seed traía "Admin123456!" escrito en el código. Cualquiera que
 * corriera `npm run db:seed` sin variables de entorno —o con la DATABASE_URL de
 * producción cargada, que es el caso normal en esta máquina— creaba un
 * administrador con esa contraseña, publicada en el repositorio, sobre la base
 * real. Un seed que falla ruidosamente es preferible a uno que deja una puerta
 * abierta en silencio.
 */
function resolveAdminConfig(prefix, defaults) {
  const password = process.env[`${prefix}_PASSWORD`];
  if (!password) {
    throw new Error(
      `Falta ${prefix}_PASSWORD. El seed no inventa contraseñas: pasala por variable de entorno.`,
    );
  }
  return {
    email: (process.env[`${prefix}_EMAIL`] || defaults.email).toLowerCase().trim(),
    password,
    name: process.env[`${prefix}_NAME`] || defaults.name,
    phone: process.env[`${prefix}_PHONE`] || defaults.phone,
  };
}

async function upsertAdmin(prefix, defaults) {
  const config = resolveAdminConfig(prefix, defaults);
  const passwordHash = await bcrypt.hash(config.password, 12);

  const admin = await prisma.user.upsert({
    where: { email: config.email },
    update: {
      name: config.name,
      role: "ADMIN",
      passwordHash,
      phone: config.phone,
      emailVerified: true,
      isActive: true,
    },
    create: {
      name: config.name,
      email: config.email,
      passwordHash,
      phone: config.phone,
      role: "ADMIN",
      emailVerified: true,
      isActive: true,
      acquisitionChannel: "Seed",
      campaignName: `${prefix} Seed`,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return { admin, config };
}

async function seedInvoiceSequences() {
  const year = new Date().getFullYear();
  const sequences = [
    { sequenceType: "CUSTOMER_INVOICE",     prefix: "",          padding: 4 },
    { sequenceType: "SUPPLIER_INVOICE",     prefix: "FACT/",     padding: 4 },
    { sequenceType: "CUSTOMER_CREDIT_NOTE", prefix: "",          padding: 4 },
    { sequenceType: "SUPPLIER_CREDIT_NOTE", prefix: "NC-PROV/",  padding: 4 },
  ];
  for (const s of sequences) {
    await prisma.invoiceSequence.upsert({
      where:  { sequenceType: s.sequenceType },
      update: {},  // no resetear el contador si ya existe
      create: { sequenceType: s.sequenceType, prefix: s.prefix, padding: s.padding, currentNumber: 0, year },
    });
  }
  console.log("InvoiceSequences listas (4 tipos).");
}

async function seedHealthTax() {
  await prisma.tax.upsert({
    where: { id: "iva-4-salud" },
    update: { name: "IVA 4% - Servicios de salud", rate: 4, scope: "BOTH", label: "IVA 4%", isActive: true },
    create: { id: "iva-4-salud", name: "IVA 4% - Servicios de salud", rate: 4, scope: "BOTH", label: "IVA 4%", isActive: true },
  });
  console.log("Tax IVA 4% lista.");
}

async function main() {
  const primary = await upsertAdmin("ADMIN", {
    email: "contacto@saludmentalcostarica.com",
    name: "Salud Mental Costa Rica",
    phone: "71291909",
  });

  // El segundo administrador es opcional: sin `ADMIN2_PASSWORD` no se crea, en
  // vez de fallar. Una cuenta de más con contraseña conocida es peor que una de
  // menos.
  const secondary = process.env.ADMIN2_PASSWORD
    ? await upsertAdmin("ADMIN2", {
        email: "admin2@saludmentalcostarica.com",
        name: "Admin 2 SMCR",
        phone: "71291910",
      })
    : null;

  await seedInvoiceSequences();
  await seedHealthTax();

  // No se imprime la contraseña: quien corre el seed ya la conoce, la puso él, y
  // dejarla en el log de un despliegue es regalarla.
  console.log("Admin listo:", primary.config.email);
  if (secondary) console.log("Admin 2 listo:", secondary.config.email);
  else console.log("Admin 2: omitido (sin ADMIN2_PASSWORD).");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
