// scripts/fe-preparar-llave.mjs
//
// Convierte el .p12 de la firma digital a base64 para FE_P12_BASE64, pero
// primero comprueba que sea la llave correcta.
//
// Por qué no alcanza con convertirlo: el 2026-10-19 se emitió la factura 0203
// con un certificado que estaba REVOCADO. Hacienda la rechazó —«El certificado
// empleado se encuentra revocado»— y el consecutivo quedó quemado. El archivo
// se veía perfectamente válido: abría con su PIN, tenía la cédula correcta y
// estaba dentro de su período de vigencia. Convertir a ciegas vuelve a costar
// un número cada vez que uno se equivoca de archivo.
//
// Uso:
//   node scripts/fe-preparar-llave.mjs <ruta-al-.p12> [salida]
//
// El PIN se pide por teclado y no se muestra: así no queda en el historial de
// la terminal, que es lo que pasaría al pasarlo como argumento o como variable
// escrita a mano.
//
// La salida por defecto es `.env.fe-p12.local`, que cae dentro de `.env*` del
// .gitignore. El base64 NO se imprime en pantalla: es material de la llave
// privada y no debe quedar en el scrollback.
//
// No contacta a Hacienda, no firma y no emite nada.

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const RUTA = process.argv[2];
const SALIDA = process.argv[3] || ".env.fe-p12.local";

// El certificado que Hacienda rechazó por estar revocado. Si el archivo nuevo
// resulta ser este mismo, el script se niega: es el error que ya costó el 0203.
const SERIE_REVOCADA = "1789785134637";

const OK = "✅";
const BAD = "❌";
const WARN = "⚠️";
const INFO = "ℹ️";
const linea = (estado, texto) => console.log(`  ${estado} ${texto}`);

if (!RUTA) {
  console.error("\nUso: node scripts/fe-preparar-llave.mjs <ruta-al-.p12> [salida]\n");
  process.exit(1);
}

/** Pide el PIN sin eco en pantalla. */
function preguntarOculto(pregunta) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("Hace falta una terminal interactiva para escribir el PIN."));
      return;
    }
    stdout.write(pregunta);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let valor = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(valor);
      } else if (ch === "\u0003") {
        stdin.setRawMode(false);
        stdin.removeListener("data", onData);
        stdout.write("\n");
        reject(new Error("Cancelado."));
      } else if (ch === "\u007f" || ch === "\b") {
        valor = valor.slice(0, -1);
      } else {
        valor += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const dn = (atributos) =>
  atributos.map(({ shortName, name, value }) => `${shortName || name}=${value}`).join(", ");

async function main() {
  console.log(`\nPREPARAR LA LLAVE PARA FE_P12_BASE64 — ${basename(RUTA)}\n`);

  let bytes;
  try {
    bytes = readFileSync(RUTA);
  } catch {
    linea(BAD, `No se pudo leer el archivo: ${RUTA}`);
    process.exit(1);
  }
  linea(INFO, `Archivo leído: ${bytes.length} bytes.`);

  const pin = await preguntarOculto("  PIN del certificado (no se muestra): ");
  if (!pin) {
    linea(BAD, "Sin PIN no se puede comprobar nada. No se escribió ninguna salida.");
    process.exit(1);
  }

  const mod = await import("node-forge");
  const forge = mod.default || mod;

  const base64 = bytes.toString("base64");
  let cert;
  try {
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(base64)), false, pin);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    if (!certBags.length || !keyBags.length) {
      linea(BAD, "El archivo abre pero no trae certificado y llave privada juntos. No sirve para firmar.");
      process.exit(1);
    }
    cert = certBags[0].cert;
    linea(OK, "Abre con el PIN y contiene certificado + llave privada.");
  } catch {
    // Sin el mensaje de forge: puede incluir material de la llave.
    linea(BAD, "No abre. Causas típicas: PIN incorrecto, archivo incompleto, o no es un .p12/.pfx.");
    process.exit(1);
  }

  const serieHex = String(cert.serialNumber).replace(/^0+/, "");
  const serieDec = BigInt(`0x${cert.serialNumber}`).toString(10);
  const emisor = dn(cert.issuer.attributes);
  const identificacion = String(
    cert.subject.attributes.find((a) => a.shortName === "serialNumber" || a.type === "2.5.4.5")?.value || "",
  );

  console.log("");
  linea(INFO, `Sujeto: ${dn(cert.subject.attributes)}`);
  linea(INFO, `Emisor (CA): ${emisor}`);
  linea(INFO, `Serie: ${serieHex} (hex) · ${serieDec} (decimal)`);

  const hasta = cert.validity.notAfter;
  const dias = Math.floor((hasta.getTime() - Date.now()) / 86_400_000);
  linea(
    dias < 0 ? BAD : dias < 30 ? WARN : OK,
    `Vigencia: ${cert.validity.notBefore.toISOString().slice(0, 10)} → ${hasta.toISOString().slice(0, 10)}` +
      ` (${dias >= 0 ? `faltan ${dias} días` : `VENCIDO hace ${Math.abs(dias)} días`})`,
  );

  // La diferencia entre la cadena de pruebas y la real son siete letras en el
  // nombre de la CA: «CA PERSONA JURIDICA» contra «CA PERSONA JURIDICA - SANDBOX».
  const esSandbox = /SANDBOX|PRUEBA|TEST|STAGING|DEMO/i.test(emisor);
  linea(
    esSandbox ? WARN : OK,
    esSandbox
      ? "Es un certificado de SANDBOX: solo sirve con FE_AMBIENTE=02. En producción Hacienda lo rechaza."
      : "Es un certificado de la cadena de producción (FE_AMBIENTE=01).",
  );

  const cedulaEsperada = String(process.env.FE_EMISOR_IDENTIFICACION || "").replace(/\D/g, "");
  if (cedulaEsperada) {
    const coincide = identificacion.replace(/\D/g, "") === cedulaEsperada;
    linea(coincide ? OK : BAD, `Identificación ${identificacion}: ${coincide ? "coincide" : "NO coincide"} con FE_EMISOR_IDENTIFICACION.`);
    if (!coincide) {
      linea(BAD, "Hacienda rechaza un comprobante firmado por quien no es el emisor declarado. No se escribió la salida.");
      process.exit(1);
    }
  } else {
    linea(INFO, `Identificación en el certificado: ${identificacion} (sin FE_EMISOR_IDENTIFICACION cargada, no se comparó).`);
  }

  let salir = false;
  if (serieDec === SERIE_REVOCADA) {
    linea(BAD, "Es EL MISMO certificado que Hacienda ya rechazó por estar revocado (el de la 0203).");
    linea(BAD, "Subirlo volvería a quemar un consecutivo. Conseguí el archivo nuevo de tu firma digital.");
    salir = true;
  } else {
    linea(OK, `No es el certificado revocado (ese era la serie ${SERIE_REVOCADA}).`);
  }

  if (dias < 0) {
    linea(BAD, "Está vencido: no se escribió la salida.");
    salir = true;
  }
  if (salir) process.exit(1);

  // Lo que este script NO puede saber.
  console.log("");
  linea(
    WARN,
    "Esto NO comprueba la revocación: un certificado revocado abre igual, está en vigencia " +
      "y trae la cédula correcta. Lo único que descarta es que sea el que ya falló. La prueba " +
      "definitiva es el primer envío real.",
  );

  writeFileSync(SALIDA, `FE_P12_BASE64=${base64}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("");
  linea(OK, `Base64 escrito en ${SALIDA} (${base64.length} caracteres). No se imprime: es material de la llave.`);
  console.log(`
  Siguientes pasos:
    1. Subí el valor a Vercel, en Production, como FE_P12_BASE64 (y FE_P12_PIN si cambió).
       Para copiarlo al portapapeles sin abrirlo:
         Get-Content ${SALIDA} | %{ $_ -replace '^FE_P12_BASE64=','' } | Set-Clipboard
    2. Volvé a desplegar: las variables se leen al arrancar la función.
    3. Borrá el archivo: Remove-Item ${SALIDA}
    4. Emití con el 0204 y mirá el resultado. Si vuelve a decir «revocado», el
       problema está en la firma digital, no en el CRM.
`);
}

main().catch((error) => {
  console.error(`\n${BAD} ${String(error?.message || "Error no previsto").slice(0, 200)}`);
  process.exit(1);
});
