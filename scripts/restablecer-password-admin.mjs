// scripts/restablecer-password-admin.mjs
//
// Restablece la contraseña de una cuenta ADMIN cuando se perdió el acceso.
//
// La contraseña se pasa por variable de entorno, NUNCA por argumento: un
// argumento queda escrito en el historial de la terminal y ahí se queda.
//
// Uso (PowerShell):
//   $env:NUEVA_PASSWORD = "..."
//   node -r dotenv/config scripts/restablecer-password-admin.mjs contacto@saludmentalcostarica.com
//   Remove-Item Env:\NUEVA_PASSWORD
//
// Al terminar sube `sessionVersion`, así que cualquier sesión abierta con la
// contraseña vieja queda invalidada.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Las mismas reglas que exige el registro (auth-actions.js), para no dejar en la
// base una contraseña que después el formulario de cambio rechazaría.
function problemasDeLaPassword(password) {
  const problemas = [];
  if (password.length < 8) problemas.push("Debe incluir al menos 8 caracteres.");
  if (!/\d/.test(password)) problemas.push("Debe incluir al menos un número.");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) problemas.push("Debe incluir al menos un símbolo.");
  return problemas;
}

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.NUEVA_PASSWORD || "";

  if (!email) {
    throw new Error("Falta el correo. Uso: node scripts/restablecer-password-admin.mjs correo@ejemplo.com");
  }
  if (!password) {
    throw new Error(
      'Falta NUEVA_PASSWORD. Definila en la terminal primero: $env:NUEVA_PASSWORD = "..."',
    );
  }

  const problemas = problemasDeLaPassword(password);
  if (problemas.length) {
    throw new Error(`La contraseña no cumple las reglas del sitio:\n  - ${problemas.join("\n  - ")}`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, isActive: true, sessionVersion: true },
  });

  if (!user) throw new Error(`No existe ninguna cuenta con el correo ${email}.`);
  if (user.role !== "ADMIN") {
    throw new Error(
      `La cuenta ${email} tiene rol ${user.role}, no ADMIN. Este script solo restablece administradores.`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      emailVerified: true,
      isActive: true,
      // Un reset pendiente por correo deja de valer: la contraseña ya cambió.
      resetTokenHash: null,
      resetTokenExp: null,
      // Cierra las sesiones emitidas antes de este cambio.
      sessionVersion: { increment: 1 },
    },
  });

  // Los intentos fallidos acumulados bloquearían el primer login correcto
  // (5 fallos / 15 min por IP+correo). Se limpian los de esta cuenta.
  const { count } = await prisma.rateLimitEntry.deleteMany({
    where: { key: { contains: `:${email}` } },
  });

  console.log(`Contraseña restablecida para ${user.email} (${user.name}).`);
  console.log(`Sesiones anteriores invalidadas (sessionVersion ${user.sessionVersion} → ${user.sessionVersion + 1}).`);
  console.log(`Intentos de rate limit borrados: ${count}.`);
  console.log("Ya podés entrar en /ingresar. Acordate de limpiar NUEVA_PASSWORD de la terminal.");
}

main()
  .catch((e) => {
    console.error("\nError:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
