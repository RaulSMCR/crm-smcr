// scripts/smoke-reminder-push.mjs
//
// Dispara manualmente el job de recordatorios (/api/reminders/send) con una
// firma QStash VÁLIDA forjada localmente, para probar el canal push sin esperar
// al schedule real. Reproduce lo que hace QStash: un JWT HS256 firmado con
// QSTASH_CURRENT_SIGNING_KEY, con `iss: "Upstash"` y el claim `body` = SHA-256
// del cuerpo en base64url. (verifySignatureAppRouter NO valida el `sub`/URL.)
//
// Requisitos:
//   - QSTASH_CURRENT_SIGNING_KEY en el entorno (.env / .env.local). Para una
//     prueba puramente local sin Upstash real, poné cualquier valor en
//     QSTASH_CURRENT_SIGNING_KEY y QSTASH_NEXT_SIGNING_KEY (deben existir o el
//     route no carga) y el script firmará con la CURRENT.
//   - El server corriendo (pnpm build && pnpm start, o pnpm dev).
//   - Para ver el push de verdad: VAPID_* seteadas, `prisma migrate deploy`
//     aplicada, y una PushSubscription real del paciente de la cita.
//
// Uso:
//   node scripts/smoke-reminder-push.mjs <appointmentId> [24h|1h]
//   SMOKE_URL=https://tu-dominio/api/reminders/send node scripts/smoke-reminder-push.mjs <appointmentId> 1h
//
// Interpretación del resultado:
//   - HTTP 200                      -> firma aceptada + job corrió (email + push disparados)
//   - HTTP 500 / "Appointment not found" -> firma aceptada; falló por DB/cita (esperable sin datos)
//   - HTTP 403 "invalid signature"  -> la firma NO fue aceptada (revisar signing key)

import { config } from "dotenv";
import crypto from "node:crypto";
import { SignJWT } from "jose";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.SMOKE_URL || "http://localhost:3000/api/reminders/send";
const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;

const appointmentId = process.argv[2] || process.env.SMOKE_APPOINTMENT_ID;
const type = process.argv[3] || "24h";

if (!signingKey) {
  console.error("✗ Falta QSTASH_CURRENT_SIGNING_KEY en el entorno.");
  process.exit(1);
}
if (!appointmentId) {
  console.error("Uso: node scripts/smoke-reminder-push.mjs <appointmentId> [24h|1h]");
  process.exit(1);
}
if (!["24h", "1h"].includes(type)) {
  console.error(`✗ type inválido: "${type}" (usá 24h o 1h)`);
  process.exit(1);
}

const body = JSON.stringify({ appointmentId, type });

// Mismo hash que verifica el Receiver: SHA-256(body) en base64url.
const bodyHash = crypto.createHash("sha256").update(body).digest("base64url");

const signature = await new SignJWT({ body: bodyHash })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("Upstash")
  .setSubject(url)
  .setIssuedAt()
  .setNotBefore("0s")
  .setExpirationTime("5m")
  .setJti(crypto.randomUUID())
  .sign(new TextEncoder().encode(signingKey));

console.log(`→ POST ${url}  body=${body}`);

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "upstash-signature": signature },
  body,
});

const text = await res.text();
console.log(`← HTTP ${res.status}  ${text}`);

if (res.status === 403) {
  console.error("✗ Firma rechazada. Verificá que QSTASH_CURRENT_SIGNING_KEY coincida con la del server.");
  process.exit(1);
}
console.log("✓ Firma aceptada (el job corrió). Si hay VAPID + suscripción + cita válida, el push se envió.");
