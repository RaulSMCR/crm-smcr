// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@saludmentalcostarica.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "Admin123456!";
  const name = process.env.ADMIN_NAME || "Admin SMCR";

  // Importante: si luego haces phone NOT NULL, esto evita que falle el seed
  const phone = process.env.ADMIN_PHONE || "00000000";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "ADMIN",
      passwordHash,
      phone,
      emailVerified: true,
      isActive: true,
    },
    create: {
      name,
      email,
      passwordHash,
      phone,
      role: "ADMIN",
      emailVerified: true,
      isActive: true,
      acquisitionChannel: "Seed",
      campaignName: "Admin Seed",
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  console.log("✅ Admin listo:", admin);
  console.log("🔐 Credenciales:");
  console.log("   Email:", email);
  console.log("   Password:", password);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
