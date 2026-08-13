// tests/setup-env.js
// Carga .env.local SOLO para las pruebas que hablan con servicios reales.
//
// Vitest no lee .env.local por su cuenta, y los módulos de configuración leen
// process.env al importarse, así que hay que poblarlo antes. Se hace condicional
// a propósito: si se cargara siempre, los tests unitarios pasarían a correr con
// credenciales y URLs de verdad, y un mock mal puesto podría emitir algo real.
import { config } from "dotenv";

if (process.env.FE_SANDBOX_E2E === "1" || process.env.ONVO_E2E === "1") {
  config({ path: ".env.local" });
}
