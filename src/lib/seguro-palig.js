// src/lib/seguro-palig.js
//
// Marcar desde el lado del equipo que un paciente se atiende con seguro PALIG.
//
// Hasta ahora solo el paciente podía declarar su seguro, desde su perfil, y el
// piloto PALIG lo exige para mostrarlo. Los pacientes con seguro que venían de
// antes no lo iban a hacer solos y quedaban fuera del piloto. Lo marca Raúl —al
// crear el acuerdo de atención o desde Admin → Seguros— con los mismos campos
// que usa el perfil, así el paciente lo ve tal cual en su cuenta.
//
// No manda el aviso al administrador que manda el perfil: acá quien marca es el
// propio administrador.

import { esPalig } from "@/lib/palig-policy";

export const NOMBRE_SEGURO_PALIG = "PALIG";

async function pacienteActivo(db, patientId) {
  const user = await db.user.findUnique({
    where: { id: String(patientId || "") },
    select: { id: true, role: true, isActive: true, insuranceName: true },
  });
  return user && user.role === "USER" && user.isActive ? user : null;
}

/**
 * Deja al paciente como asegurado con PALIG. Si ya tenía escrito un nombre que
 * se reconoce como PALIG («Pan American Life», por ejemplo) se respeta.
 */
export async function marcarSeguroPalig(db, patientId) {
  const user = await pacienteActivo(db, patientId);
  if (!user) return { ok: false, message: "Paciente no disponible." };
  await db.user.update({
    where: { id: user.id },
    data: {
      hasInsurance: true,
      useInsuranceForPayment: true,
      insuranceName: esPalig(user.insuranceName) ? user.insuranceName : NOMBRE_SEGURO_PALIG,
    },
  });
  return { ok: true };
}

/**
 * Deshace la marca. Los documentos ya cargados (formularios, plantilla) no se
 * borran: si fue un error y se vuelve a marcar, siguen ahí.
 */
export async function quitarSeguro(db, patientId) {
  const user = await pacienteActivo(db, patientId);
  if (!user) return { ok: false, message: "Paciente no disponible." };
  await db.user.update({
    where: { id: user.id },
    data: { hasInsurance: false, useInsuranceForPayment: false, insuranceName: null },
  });
  return { ok: true };
}
