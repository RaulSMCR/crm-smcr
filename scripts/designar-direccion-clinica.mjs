// scripts/designar-direccion-clinica.mjs
//
// Designa a una persona como dirección clínica: quien visa las altas y las bajas
// de los casos y, por lo tanto, la única —además del profesional tratante— que
// puede leer una nota de cierre.
//
// Exige el número de colegiado porque el acceso al expediente no se sostiene en
// el puesto que se ocupa en la plataforma sino en la habilitación profesional.
// El Código de Ética y Deontológico del CPPCR solo admite compartir con
// autorización expresa de la persona usuaria (art. 33), y esa autorización —la
// que da el acuerdo al registrarse— se otorga a una dirección clínica
// profesional, no a "el administrador del sistema".
//
// Uso:
//   node scripts/designar-direccion-clinica.mjs correo@ejemplo.com 1234 CPPCR
//   node scripts/designar-direccion-clinica.mjs correo@ejemplo.com --revocar

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [email, segundo, colegio = "CPPCR"] = process.argv.slice(2);

if (!email) {
  console.error("Falta el correo. Uso: node scripts/designar-direccion-clinica.mjs <correo> <colegiado> [colegio]");
  process.exit(1);
}

const revocar = segundo === "--revocar";

if (!revocar && !segundo) {
  console.error("Falta el número de colegiado. Sin colegiatura no hay acceso clínico.");
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { email: email.trim().toLowerCase() },
  select: { id: true, name: true, email: true, clinicalDirectorSince: true },
});

if (!user) {
  console.error(`No existe una cuenta con el correo ${email}.`);
  process.exit(1);
}

if (revocar) {
  await prisma.user.update({
    where: { id: user.id },
    data: { clinicalDirectorSince: null, colegiadoNumero: null, colegiadoColegio: null },
  });
  console.log(`Listo: ${user.name} ya no ejerce la dirección clínica.`);
} else {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Se conserva la fecha original si ya lo era: es un dato del expediente,
      // no un contador que se reinicia cada vez que se corre el script.
      clinicalDirectorSince: user.clinicalDirectorSince || new Date(),
      colegiadoNumero: String(segundo).trim(),
      colegiadoColegio: String(colegio).trim(),
    },
  });
  console.log(
    `Listo: ${user.name} (${user.email}) ejerce la dirección clínica, colegiado ${segundo} del ${colegio}.`
  );
}

await prisma.$disconnect();
