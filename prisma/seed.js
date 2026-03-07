// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function resolveAdminConfig(prefix, defaults) {
  return {
    email: (process.env[`${prefix}_EMAIL`] || defaults.email).toLowerCase().trim(),
    password: process.env[`${prefix}_PASSWORD`] || defaults.password,
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

async function main() {
  const primary = await upsertAdmin("ADMIN", {
    email: "admin@saludmentalcostarica.com",
    password: "Admin123456!",
    name: "Admin SMCR",
    phone: "71291909",
  });

  const secondary = await upsertAdmin("ADMIN2", {
    email: "admin2@saludmentalcostarica.com",
    password: "Admin2123456!",
    name: "Admin 2 SMCR",
    phone: "71291910",
  });

  console.log("Admin listo:", primary.admin);
  console.log("Credenciales ADMIN:");
  console.log("  Email:", primary.config.email);
  console.log("  Password:", primary.config.password);

  console.log("Admin2 listo:", secondary.admin);
  console.log("Credenciales ADMIN2:");
  console.log("  Email:", secondary.config.email);
  console.log("  Password:", secondary.config.password);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
