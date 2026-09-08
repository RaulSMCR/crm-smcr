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
  return {
    email: (process.env[`${prefix}_EMAIL`] || defaults.email).toLowerCase().trim(),
    password: process.env[`${prefix}_PASSWORD`],
    name: process.env[`${prefix}_NAME`] || defaults.name,
    phone: process.env[`${prefix}_PHONE`] || defaults.phone,
  };
}

/**
 * El seed se corre para otras cosas —tablas nuevas, catálogos, hubs— y el admin
 * ya existe casi siempre. Cuando existe, su contraseña NO se toca: el 2026-09-04
 * un `db:seed` para crear los Topic hubs rehasheó la contraseña del admin con el
 * `ADMIN_PASSWORD` que había en esa terminal y dejó a la única cuenta ADMIN
 * fuera del sitio. Rotar la contraseña tiene que ser una decisión explícita, no
 * el efecto secundario de sembrar tres temas.
 *
 * Para rotarla a propósito: `ADMIN_PASSWORD_ROTATE=1` junto con `ADMIN_PASSWORD`.
 * Para restablecerla habiendo perdido el acceso:
 * `scripts/restablecer-password-admin.mjs`.
 */
async function upsertAdmin(prefix, defaults) {
  const config = resolveAdminConfig(prefix, defaults);
  const datosBase = {
    name: config.name,
    role: "ADMIN",
    phone: config.phone,
    emailVerified: true,
    isActive: true,
  };

  const existente = await prisma.user.findUnique({
    where: { email: config.email },
    select: { id: true },
  });

  const rotar = process.env[`${prefix}_PASSWORD_ROTATE`] === "1";

  if (existente && !rotar) {
    const admin = await prisma.user.update({
      where: { id: existente.id },
      data: datosBase,
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return { admin, config, passwordTocada: false };
  }

  if (!config.password) {
    const motivo = rotar
      ? `${prefix}_PASSWORD_ROTATE=1 exige ${prefix}_PASSWORD`
      : `Falta ${prefix}_PASSWORD`;
    throw new Error(`${motivo}. El seed no inventa contraseñas: pasala por variable de entorno.`);
  }

  const passwordHash = await bcrypt.hash(config.password, 12);

  const admin = await prisma.user.upsert({
    where: { email: config.email },
    update: { ...datosBase, passwordHash },
    create: {
      ...datosBase,
      email: config.email,
      passwordHash,
      acquisitionChannel: "Seed",
      campaignName: `${prefix} Seed`,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  return { admin, config, passwordTocada: true };
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

async function seedTopicHubs() {
  const hubs = [
    { name: "Ansiedad", slug: "ansiedad" },
    { name: "Estrés laboral", slug: "estres-laboral" },
    { name: "Ejercicio y salud mental", slug: "ejercicio-salud-mental" },
  ];

  for (const hub of hubs) {
    await prisma.topic.upsert({
      where: { slug: hub.slug },
      update: {},
      create: { ...hub, status: "DRAFT", isActive: true },
    });
  }

  console.log("Topics del MVP listos como borradores estructurales.");
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
  await seedTopicHubs();

  // No se imprime la contraseña: quien corre el seed ya la conoce, la puso él, y
  // dejarla en el log de un despliegue es regalarla. Sí se dice si se tocó, que
  // es justo lo que antes pasaba en silencio.
  const estado = (r) => (r.passwordTocada ? "contraseña escrita" : "contraseña intacta");
  console.log(`Admin listo: ${primary.config.email} (${estado(primary)}).`);
  if (secondary) console.log(`Admin 2 listo: ${secondary.config.email} (${estado(secondary)}).`);
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
