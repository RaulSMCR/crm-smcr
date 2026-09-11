// Preparar ahora; activar solo después de aprobar migración y despliegue.
import { Client } from "@upstash/qstash";

const apply = process.argv.includes("--apply");
const origin = new URL(process.env.APP_URL || "https://saludmentalcostarica.com");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error("APP_URL debe ser una URL HTTPS sin credenciales ni parámetros.");
}
const schedule = {
  scheduleId: "smcr-payment-deliveries",
  destination: `${origin.origin}/api/payments/deliveries/run`,
  method: "POST",
  cron: "*/5 * * * *",
  body: "{}",
  headers: { "content-type": "application/json" },
};
if (!apply) {
  console.log(JSON.stringify({ action: "preview_only", ...schedule }, null, 2));
} else {
  if (!process.env.QSTASH_TOKEN || !process.env.APP_URL) throw new Error("Faltan QSTASH_TOKEN o APP_URL.");
  try {
    await new Client({ token: process.env.QSTASH_TOKEN }).schedules.create(schedule);
    console.log("Programación de entregas activada o actualizada.");
  } catch {
    console.error("No se pudo configurar la programación. Revise la cuenta de QStash.");
    process.exitCode = 1;
  }
}
