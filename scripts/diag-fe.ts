// scripts/diag-fe.ts
// Diagnóstico de SOLO LECTURA de la facturación electrónica (Hacienda CR).
//
// Uso:
//   npx tsx scripts/diag-fe.ts --env=.env.diag [--invoice=<Invoice.id>]
//   node scripts/diag-fe.ts --env=.env.diag        (Node 24 corre .ts nativo)
//
// Qué NO hace, por diseño y sin excepción: no emite, no reenvía, no reintenta y
// no hace POST a /recepcion. La única petición POST de todo el archivo es la del
// token al IDP, porque el IDP no tiene otro verbo. Lo demás son GET y SELECT.
//
// Qué NO imprime: ningún valor de variable de entorno, ni el PIN, ni el token,
// ni fragmentos, ni longitudes, ni «empieza con». Solo nombres y veredictos, la
// misma regla que ya sigue /api/admin/fe-config. Un nombre arregla un
// despliegue; un valor filtra una credencial de Hacienda. Las dos excepciones
// son datos públicos del certificado (sujeto, cédula, vencimiento), que son
// justamente lo que hay que cotejar, y nunca salen de la llave privada.
//
// La lista de variables está duplicada de src/lib/fe/config.js a propósito: ese
// módulo importa con el alias `@/`, que solo resuelve dentro de Next, y este
// script tiene que correr con tsx sobre un .env descargado. Si config.js cambia
// su lista, hay que cambiarla acá: lo marca el comentario de cada bloque.

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

// ─── Presentación ────────────────────────────────────────────────────────────

const OK = "✅";
const BAD = "❌";
const WARN = "⚠️";
const INFO = "ℹ️";

function capa(titulo: string) {
  console.log(`\n${"─".repeat(72)}\n${titulo}\n${"─".repeat(72)}`);
}

function linea(estado: string, texto: string) {
  console.log(`  ${estado} ${texto}`);
}

/**
 * Vuelca TODOS los encabezados de una respuesta de Hacienda salvo los de
 * autenticación.
 *
 * Existe porque el 400 de la consulta de estado llega con cuerpo vacío: si el
 * backend explica algo, lo explica en un encabezado. `x-error-cause` es el que
 * usa el API Gateway de Hacienda para eso, así que se destaca aparte en vez de
 * quedar perdido en la lista.
 *
 * Los de autenticación se excluyen porque pueden llevar material reutilizable
 * (un challenge, una cookie de sesión, un token de borde).
 */
const ENCABEZADOS_OMITIDOS = new Set([
  "authorization", "www-authenticate", "proxy-authenticate", "set-cookie", "cookie",
  "x-amz-security-token",
]);

function volcarEncabezados(res: Response, etiqueta = "") {
  const causa = res.headers.get("x-error-cause");
  linea(
    causa ? BAD : INFO,
    `X-Error-Cause${etiqueta ? ` (${etiqueta})` : ""}: ${causa !== null ? `«${causa}»` : "(el encabezado no viene en la respuesta)"}`,
  );
  const todos = [...res.headers.entries()]
    .filter(([k]) => !ENCABEZADOS_OMITIDOS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  console.log(`     Encabezados de la respuesta (${todos.length}, sin los de autenticación):`);
  if (!todos.length) console.log("       (ninguno)");
  for (const [k, v] of todos) console.log(`       ${k}: ${v}`);
}

/**
 * Datos públicos de un certificado X.509, con huella para poder compararlo con
 * otro sin volcar el certificado entero.
 */
function describirCertificado(forge: any, cert: any) {
  const dn = (atributos: any[]) =>
    atributos.map(({ shortName, name, value }: any) => `${shortName || name}=${value}`).join(", ");
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const attr = (atributos: any[], nombre: string) =>
    atributos.find((a: any) => a.shortName === nombre || a.name === nombre || a.type === nombre)?.value || "";
  return {
    sujeto: dn(cert.subject.attributes),
    emisor: dn(cert.issuer.attributes),
    // forge entrega el serial en hexadecimal; Hacienda lo declara en decimal
    // dentro del bloque XAdES, así que se muestran los dos.
    serialHex: String(cert.serialNumber).replace(/^0+/, ""),
    serialDec: BigInt(`0x${cert.serialNumber}`).toString(10),
    desde: cert.validity.notBefore as Date,
    hasta: cert.validity.notAfter as Date,
    identificacion: String(attr(cert.subject.attributes, "serialNumber") || attr(cert.subject.attributes, "2.5.4.5")),
    huella: createHash("sha256").update(Buffer.from(der, "binary")).digest("hex"),
  };
}

/**
 * Pruebas o producción, según la CA que firmó el certificado.
 *
 * El titular es el mismo en los dos casos, así que el sujeto no distingue nada.
 * Lo que cambia es la jerarquía: las CA de la cadena de pruebas del MICITT
 * llevan PRUEBAS/TEST/STAGING en el nombre. Es una heurística sobre el nombre
 * del emisor, no una validación de cadena, y se reporta como tal.
 */
function clasificarCA(emisor: string) {
  // SANDBOX es el término que usa la jerarquía de pruebas del Ministerio de
  // Hacienda: «CA PERSONA JURIDICA - SANDBOX», emitida por «MINISTERIO DE
  // HACIENDA - SANDBOX». La de producción es la misma cadena sin el sufijo, así
  // que la diferencia entre un certificado de prueba y uno fiscal real son esas
  // siete letras y nada más.
  if (/SANDBOX|PRUEBA|TEST|STAGING|STAG\b|DEMO/i.test(emisor)) return "pruebas";
  if (/MINISTERIO DE HACIENDA|SINPE|MICITT/i.test(emisor)) return "producción";
  return null;
}

function imprimirCertificado(titulo: string, info: ReturnType<typeof describirCertificado>) {
  const dias = Math.floor((info.hasta.getTime() - Date.now()) / 86_400_000);
  console.log(`\n  ${titulo}`);
  linea(INFO, `Sujeto: ${info.sujeto}`);
  linea(INFO, `Emisor (CA): ${info.emisor}`);
  linea(INFO, `Número de serie: ${info.serialHex} (hex) · ${info.serialDec} (decimal)`);
  linea(
    INFO,
    `Vigencia: ${info.desde.toISOString().slice(0, 19)}Z → ${info.hasta.toISOString().slice(0, 19)}Z` +
      ` (${dias >= 0 ? `faltan ${dias} días` : `vencido hace ${Math.abs(dias)} días`})`,
  );
  const ca = clasificarCA(info.emisor);
  linea(
    ca === "pruebas" ? WARN : ca ? OK : INFO,
    `Cadena: ${ca ? `parece de ${ca}` : "no clasificable por el nombre de la CA"} (heurística sobre el nombre del emisor, no validación de cadena).`,
  );
  linea(INFO, `Huella SHA-256 del certificado: ${info.huella}`);
  return dias;
}

// ─── Argumentos y carga del entorno ──────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (nombre: string) =>
  args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=") || "";

const envFile = arg("env");
// Por defecto, la factura 0189 del diagnóstico en curso.
const invoiceId = arg("invoice") || "cmu7ooory0004y546luwtripo";

/**
 * Carga un archivo .env sin tocar las variables que ya trae el proceso.
 *
 * Se usa `dotenv`, que ya es dependencia del proyecto, en vez de un parser
 * propio: las credenciales de Hacienda vienen con base64 y comillas, y un
 * parser casero que corte mal un valor haría fallar el diagnóstico culpando a
 * Hacienda.
 */
async function cargarEnv(ruta: string) {
  if (!ruta) {
    linea(INFO, "Sin --env: se diagnostica el entorno del proceso actual.");
    return;
  }
  if (!existsSync(ruta)) {
    linea(BAD, `No existe el archivo de entorno indicado en --env (${ruta}).`);
    process.exit(1);
  }
  const { default: dotenv } = await import("dotenv");
  const { error } = dotenv.config({ path: ruta, override: true, quiet: true });
  if (error) {
    linea(BAD, "El archivo de entorno no se pudo leer.");
    process.exit(1);
  }
  linea(OK, `Entorno cargado desde ${ruta} (los valores no se imprimen).`);
}

const val = (nombre: string) => String(process.env[nombre] || "").trim();
const hay = (nombre: string) => Boolean(val(nombre));

// ─── (a) Variables ───────────────────────────────────────────────────────────

// Espejo de camposEmisorRequeridos() en src/lib/fe/config.js.
const EMISOR_REQUERIDAS = [
  "FE_EMISOR_NOMBRE", "FE_EMISOR_TIPO_ID", "FE_EMISOR_IDENTIFICACION", "FE_EMISOR_CORREO",
  "FE_EMISOR_TEL_CODIGO", "FE_EMISOR_TEL_NUMERO", "FE_EMISOR_PROVINCIA", "FE_EMISOR_CANTON",
  "FE_EMISOR_DISTRITO", "FE_EMISOR_OTRAS_SENAS", "FE_EMISOR_ACTIVIDAD", "FE_EMISOR_SUCURSAL",
  "FE_EMISOR_TERMINAL", "FE_AMBIENTE",
];

// Espejo de camposApiRequeridos() en src/lib/fe/config.js.
const API_REQUERIDAS = [
  "FE_TOKEN_URL", "FE_API_URL", "FE_CLIENT_ID", "FE_USERNAME", "FE_PASSWORD",
  "FE_P12_BASE64", "FE_P12_PIN",
];

// Opcionales con valor por defecto en el código. Que falten no traba nada.
const OPCIONALES: Array<[string, string]> = [
  ["FE_EMISOR_BARRIO", "se omite el barrio en la ubicación del emisor"],
  ["FE_PROVEEDOR_SISTEMAS", "hereda FE_EMISOR_IDENTIFICACION (config.js:156)"],
  ["FE_POLICY_URL", "usa la URL de la resolución DGT-R-48-2016 (signer.js:16)"],
  ["FE_POLICY_HASH", "usa el digest fijado del comprobante de referencia (signer.js:23)"],
  ["FISCAL_AMBIENTE_MIXTO", "no se permite mezclar ambiente de cobro y fiscal"],
];

// No son de Hacienda, pero sin ellas el comprobante se acepta y el paciente no
// lo recibe: la tarea de correo falla y la cola queda esperando.
const ENTREGA = ["RESEND_API_KEY", "EMAIL_FROM", "ADMIN_ALERT_EMAIL", "CRON_SECRET"];

const SOLO_DIGITOS = /^\d+$/;
const AMBIENTE_VALIDO = /^(01|02)$/;
const ACTIVIDAD_VALIDA = /^\d{4,6}(\.\d)?$/;

function diagnosticarVariables() {
  capa("(a) VARIABLES DE ENTORNO — presencia y formato");

  const faltanEmisor = EMISOR_REQUERIDAS.filter((n) => !hay(n));
  const faltanApi = API_REQUERIDAS.filter((n) => !hay(n));

  linea(
    faltanEmisor.length ? BAD : OK,
    `Emisor: ${EMISOR_REQUERIDAS.length - faltanEmisor.length}/${EMISOR_REQUERIDAS.length} presentes` +
      (faltanEmisor.length ? ` — faltan: ${faltanEmisor.join(", ")}` : ""),
  );
  linea(
    faltanApi.length ? BAD : OK,
    `API/credenciales: ${API_REQUERIDAS.length - faltanApi.length}/${API_REQUERIDAS.length} presentes` +
      (faltanApi.length ? ` — faltan: ${faltanApi.join(", ")}` : ""),
  );

  // Una regla no se evalúa si su variable falta: ya está reportada como ausente.
  const reglas: Array<[string, RegExp, string]> = [
    ["FE_EMISOR_IDENTIFICACION", SOLO_DIGITOS, "solo dígitos, sin guiones"],
    ["FE_AMBIENTE", AMBIENTE_VALIDO, "01 (producción) o 02 (pruebas)"],
    ["FE_EMISOR_ACTIVIDAD", ACTIVIDAD_VALIDA, "NNNN.N (ej. 8690.9) o 5 a 6 dígitos"],
  ];
  if (hay("FE_PROVEEDOR_SISTEMAS")) reglas.push(["FE_PROVEEDOR_SISTEMAS", SOLO_DIGITOS, "solo dígitos"]);

  const malFormato = reglas.filter(([n, re]) => hay(n) && !re.test(val(n)));
  if (malFormato.length) {
    for (const [n, , regla] of malFormato) linea(BAD, `${n} no cumple el formato exigido (${regla}).`);
  } else {
    linea(OK, "Formato correcto en las variables con regla.");
  }

  for (const [nombre, consecuencia] of OPCIONALES) {
    linea(hay(nombre) ? OK : INFO, `${nombre} ${hay(nombre) ? "definida" : `ausente → ${consecuencia}`}`);
  }

  // La copia de cada factura emitida va a ADMIN_ALERT_EMAIL (submit.js:186).
  // Que esté definida no basta: si apunta a otra dirección, los comprobantes se
  // revisan en una bandeja que nadie mira. Se compara sin imprimir el valor.
  const COPIA_ESPERADA = "contacto@saludmentalcostarica.com";
  if (hay("ADMIN_ALERT_EMAIL")) {
    const coincide = val("ADMIN_ALERT_EMAIL").toLowerCase().includes(COPIA_ESPERADA);
    linea(
      coincide ? OK : WARN,
      `ADMIN_ALERT_EMAIL ${coincide ? `apunta a ${COPIA_ESPERADA}` : `está definida con OTRA dirección (se esperaba ${COPIA_ESPERADA})`}`,
    );
  } else {
    linea(WARN, `ADMIN_ALERT_EMAIL ausente: la copia de las facturas cae en EMAIL_FROM, no en ${COPIA_ESPERADA}.`);
  }

  const faltanEntrega = ENTREGA.filter((n) => !hay(n));
  linea(
    faltanEntrega.length ? WARN : OK,
    faltanEntrega.length
      ? `Entrega y worker: faltan ${faltanEntrega.join(", ")} (no bloquean la emisión; sí la entrega al paciente y la cola).`
      : "Entrega y worker completos.",
  );

  linea(hay("DATABASE_URL") ? OK : BAD, `DATABASE_URL ${hay("DATABASE_URL") ? "presente" : "ausente — las capas (e) y (f) no podrán correr"}`);

  // Qué hace el código si falta algo. Esto es lo que explica un PENDING mudo.
  console.log("\n  Comportamiento del código ante una falta:");
  if (!val("FE_API_URL")) {
    linea(
      BAD,
      "FE_API_URL ausente → submit.js:374 NO llama a Hacienda. En producción deja feStatus=PENDING " +
        "con feErrorMessage explícito y reviewRequired; fuera de producción SIMULA una aceptación " +
        "(feStatus=ACCEPTED, 'SIMULADO — sin validez tributaria').",
    );
  } else {
    linea(OK, "FE_API_URL presente → se intenta el envío real (no se simula).");
  }
  linea(
    WARN,
    "Cualquier otra falta (emisor, credenciales, certificado, ambiente) la detecta assertFeConfig() " +
      "y lanza. submit.js:413 reduce ese error a FE_ERROR_NO_CLASIFICADO porque el texto puede " +
      "arrastrar datos del comprobante, y devuelve PENDING con reviewRequired=false. " +
      "Resultado: la factura queda PENDING sin decir qué variable fue, el job reintenta 12 veces y " +
      "recién entonces pasa a REVIEW con lastErrorCode=FE_AWAITING_CONFIRMATION.",
  );

  return { faltanEmisor, faltanApi, malFormato: malFormato.map(([n]) => n) };
}

// ─── (b) Ambiente ────────────────────────────────────────────────────────────

function diagnosticarAmbiente() {
  capa("(b) AMBIENTE — staging vs. producción");

  const feAmbiente = val("FE_AMBIENTE");
  const ambienteFe = feAmbiente === "01" ? "produccion" : feAmbiente === "02" ? "pruebas" : null;
  const onvo = val("ONVO_SECRET_KEY");
  const ambienteOnvo = onvo.startsWith("onvo_live_") ? "produccion" : onvo.startsWith("onvo_test_") ? "pruebas" : null;
  const mixto = val("FISCAL_AMBIENTE_MIXTO") === "1";

  linea(INFO, "La variable que define el ambiente fiscal es FE_AMBIENTE: '01' producción, '02' pruebas.");
  linea(INFO, "La de cobros no existe: el ambiente de ONVO se deduce del prefijo de ONVO_SECRET_KEY (misma URL en ambos).");
  linea(ambienteFe ? OK : BAD, `FE_AMBIENTE → ${ambienteFe || "indefinido"}`);
  linea(ambienteOnvo ? OK : WARN, `ONVO_SECRET_KEY → ${ambienteOnvo || "indeterminado"}`);
  linea(INFO, `NODE_ENV=${process.env.NODE_ENV || "(sin definir)"} · VERCEL_ENV=${process.env.VERCEL_ENV || "(sin definir)"}`);

  if (ambienteOnvo === "produccion" && !ambienteFe) {
    linea(BAD, "ONVO cobra en producción y FE_AMBIENTE no está definida: assertAmbientesCoherentes() aborta la emisión.");
  } else if (ambienteFe && ambienteOnvo && ambienteFe !== ambienteOnvo && !mixto) {
    linea(BAD, `Incoherencia: cobros en ${ambienteOnvo} y facturación en ${ambienteFe}. La emisión se aborta hasta alinearlos o declarar FISCAL_AMBIENTE_MIXTO=1.`);
  } else if (ambienteFe === "produccion" && process.env.NODE_ENV !== "production") {
    linea(BAD, "FE_AMBIENTE=01 exige NODE_ENV=production; fuera de producción assertFeConfig() aborta.");
  } else if (mixto) {
    linea(WARN, "FISCAL_AMBIENTE_MIXTO=1 activa: cobros y facturación pueden estar en ambientes distintos. Quitarla al terminar el corte.");
  } else {
    linea(OK, "Ambientes coherentes.");
  }

  console.log("\n  Por qué Invoice.feAmbiente puede quedar null:");
  linea(
    INFO,
    "feAmbiente se sella UNA sola vez, en el mismo updateMany que estampa la identidad fiscal " +
      "(document.js:persistFeDocument), y ese updateMany exige feClave/feNumber/feXml en null. " +
      "Si la factura ya tenía clave y XML cuando se agregó la columna (migración " +
      "20261001120000_invoice_fe_ambiente, aditiva y sin relleno), ningún reintento posterior puede " +
      "escribirla: client.js:33 reutiliza el documento guardado y persistFeDocument se vuelve un no-op. " +
      "No hay ninguna otra ruta que haga backfill. feAmbiente=null significa «no se observó», no «pruebas».",
  );
  linea(
    INFO,
    "El otro camino que lo deja null es FE_AMBIENTE vacía al momento de persistir: persistFeDocument " +
      "solo escribe el campo si recibe un ambiente truthy.",
  );

  return { ambienteFe, ambienteOnvo };
}

// ─── (c) Certificado .p12 ────────────────────────────────────────────────────

async function diagnosticarLlave() {
  capa("(c) LLAVE — certificado .p12");

  if (!hay("FE_P12_BASE64") || !hay("FE_P12_PIN")) {
    linea(BAD, "Faltan FE_P12_BASE64 y/o FE_P12_PIN: no se puede decodificar el certificado.");
    return null;
  }

  let forge: any;
  try {
    const mod: any = await import("node-forge");
    forge = mod.default || mod;
  } catch {
    linea(BAD, "node-forge no se pudo cargar (¿falta pnpm install?).");
    return null;
  }

  let cert: any;
  try {
    const der = forge.util.decode64(val("FE_P12_BASE64"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, val("FE_P12_PIN"));
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    if (!certBags.length || !keyBags.length) {
      linea(BAD, "El .p12 se abrió pero no trae certificado y llave privada (el firmado fallaría).");
      return null;
    }
    cert = certBags[0].cert;
    linea(OK, "El .p12 se decodifica con el PIN y contiene certificado + llave privada.");
  } catch {
    // Sin el mensaje de forge: puede incluir material de la llave.
    linea(BAD, "No se pudo abrir el .p12. Causas típicas: PIN incorrecto, base64 truncado o archivo distinto al emitido.");
    return null;
  }

  // La cédula del titular viaja en el serialNumber del sujeto (CPJ-3-101-… para
  // una S.A., CPF-… para una persona física).
  const info = describirCertificado(forge, cert);
  const cedulaCert = info.identificacion.replace(/\D/g, "");
  const dias = imprimirCertificado("Certificado del .p12 configurado:", info);
  if (dias < 0) linea(BAD, "Certificado VENCIDO: Hacienda rechaza toda firma.");
  else if (dias < 30) linea(WARN, `Vence en ${dias} días.`);
  else linea(OK, "Vigente.");

  const cedulaEmisor = val("FE_EMISOR_IDENTIFICACION");
  if (!cedulaEmisor) {
    linea(BAD, "FE_EMISOR_IDENTIFICACION ausente: no hay con qué comparar la cédula del certificado.");
  } else if (!cedulaCert) {
    linea(WARN, "El certificado no declara identificación en el sujeto: comparación no concluyente.");
  } else if (cedulaCert === cedulaEmisor.replace(/\D/g, "")) {
    linea(OK, "La cédula del certificado coincide con la del emisor configurado.");
  } else {
    linea(
      BAD,
      `La cédula del certificado (${cedulaCert}) NO coincide con FE_EMISOR_IDENTIFICACION. ` +
        "Hacienda rechaza un comprobante firmado por quien no es el emisor declarado.",
    );
  }

  return { cedulaCert, vencido: dias < 0, forge, info };
}

// ─── (d) Token OAuth ─────────────────────────────────────────────────────────

/**
 * Pide un token al IDP con las URLs y el client_id que ya están en el código.
 * Mismo cuerpo que src/lib/fe/auth.js: grant_type=password. Es la única petición
 * POST del script y no toca /recepcion.
 */
async function diagnosticarToken() {
  capa("(d) TOKEN — IDP de Hacienda");

  const faltan = ["FE_TOKEN_URL", "FE_CLIENT_ID", "FE_USERNAME", "FE_PASSWORD"].filter((n) => !hay(n));
  if (faltan.length) {
    linea(BAD, `Faltan ${faltan.join(", ")}: getFeToken() lanzaría antes de la petición.`);
    return null;
  }

  // El host sí se imprime: es una URL pública de Hacienda, no un secreto, y es
  // lo único que distingue el IDP de pruebas del de producción.
  try {
    linea(INFO, `IDP: ${new URL(val("FE_TOKEN_URL")).host} (host de FE_TOKEN_URL, tal como está en el entorno)`);
  } catch {
    linea(BAD, "FE_TOKEN_URL no es una URL válida.");
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: val("FE_CLIENT_ID"),
    username: val("FE_USERNAME"),
    password: val("FE_PASSWORD"),
  });

  try {
    const res = await fetch(val("FE_TOKEN_URL"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    volcarEncabezados(res, "token");
    if (!res.ok) {
      linea(BAD, `El IDP respondió HTTP ${res.status}. getFeToken() lanzaría FE_AUTH_UNAVAILABLE.`);
      if (res.status === 401) linea(INFO, "401 = FE_USERNAME/FE_PASSWORD o FE_CLIENT_ID no corresponden a este IDP.");
      if (res.status === 400) linea(INFO, "400 = el IDP rechazó la forma de la petición; típicamente client_id inválido para este ambiente.");
      return null;
    }
    const data: any = await res.json().catch(() => ({}));
    if (!data.access_token) {
      linea(BAD, `HTTP ${res.status} pero la respuesta no trae access_token.`);
      return null;
    }
    linea(OK, `Token obtenido (HTTP ${res.status}). No se imprime.`);
    return String(data.access_token);
  } catch {
    linea(BAD, "La petición al IDP no completó (timeout o red). No se publica el detalle.");
    return null;
  }
}

// ─── (e) y (f) Estado en Hacienda y firma del XML guardado ───────────────────

async function diagnosticarFactura(token: string | null, llave: any) {
  capa("(e) y (f) FACTURA — estado en Hacienda y firma del XML guardado");

  if (!hay("DATABASE_URL")) {
    linea(BAD, "Sin DATABASE_URL no se puede leer la factura.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, status: true, createdAt: true,
        feNumber: true, feClave: true, feStatus: true, feAmbiente: true,
        feErrorMessage: true, feXml: true, feRespuestaXml: true,
      },
    });

    if (!invoice) {
      linea(BAD, `No existe Invoice con id ${invoiceId} en esta base.`);
      return;
    }

    linea(INFO, `Factura ${invoice.invoiceNumber} · status=${invoice.status} · creada ${invoice.createdAt.toISOString().slice(0, 10)}`);
    linea(INFO, `feStatus=${invoice.feStatus} · feAmbiente=${invoice.feAmbiente ?? "null"} · feNumber=${invoice.feNumber ?? "null"}`);
    linea(invoice.feClave ? OK : BAD, `feClave ${invoice.feClave ? `presente (${invoice.feClave})` : "ausente"}`);
    linea(
      invoice.feRespuestaXml ? OK : WARN,
      `feRespuestaXml ${invoice.feRespuestaXml ? "presente" : "ausente — Hacienda nunca devolvió un veredicto"}`,
    );
    // feErrorMessage lo escribe nuestro propio código y está diseñado para no
    // llevar datos del comprobante (submit.js:418); es la pista que el
    // lastErrorCode del job esconde.
    linea(INFO, `feErrorMessage: ${invoice.feErrorMessage || "(vacío)"}`);

    // (f) Firma
    const xml = invoice.feXml || "";
    if (!xml) {
      linea(BAD, "(f) No hay feXml guardado.");
    } else {
      const firmado = /<ds:Signature[\s>]/.test(xml);
      linea(firmado ? OK : BAD, `(f) El feXml ${firmado ? "SÍ" : "NO"} contiene un nodo ds:Signature.`);
      if (firmado) {
        const piezas = [
          ["ds:SignatureValue", /<ds:SignatureValue[\s>]/],
          ["ds:X509Certificate", /<ds:X509Certificate[\s>]/],
          ["xades:SignaturePolicyIdentifier", /<xades:SignaturePolicyIdentifier[\s>]/],
          ["xades:SigningCertificate", /<xades:SigningCertificate[\s>]/],
          ["ds:X509SerialNumber", /<ds:X509SerialNumber[\s>]/],
        ] as Array<[string, RegExp]>;
        const faltan = piezas.filter(([, re]) => !re.test(xml)).map(([n]) => n);
        linea(
          faltan.length ? BAD : OK,
          faltan.length
            ? `Firma incompleta: faltan ${faltan.join(", ")} (Hacienda la rechaza).`
            : "La firma trae SignatureValue, certificado, política EPES e IssuerSerial.",
        );
      }
      // Huella del XML para poder cotejar entre corridas sin publicar el contenido.
      linea(INFO, `Huella SHA-256 del feXml: ${createHash("sha256").update(xml, "utf8").digest("hex").slice(0, 16)}…`);
      compararCertificadoFirmante(xml, llave);
    }

    // Jobs de la cola para esta factura.
    const jobs = await prisma.deliveryJob.findMany({
      where: { invoiceId: invoice.id },
      select: { kind: true, status: true, attempts: true, lastErrorCode: true, nextAttemptAt: true, firstSendAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const j of jobs) {
      linea(
        j.status === "SUCCEEDED" ? OK : j.status === "REVIEW" ? BAD : WARN,
        `Job ${j.kind}: ${j.status} · intentos=${j.attempts} · lastErrorCode=${j.lastErrorCode ?? "null"} · firstSendAt=${j.firstSendAt ? "sí" : "no"}`,
      );
    }

    // (e) Consulta de estado en Hacienda. GET, nunca POST.
    if (!invoice.feClave) {
      linea(BAD, "(e) Sin feClave no hay nada que consultar.");
      return;
    }
    if (!token) {
      linea(BAD, "(e) Sin token no se puede consultar el estado. La capa (d) explica por qué.");
      return;
    }
    if (!hay("FE_API_URL")) {
      linea(BAD, "(e) Falta FE_API_URL: no hay endpoint de recepción al que consultar.");
      return;
    }

    // La clave de la 0189 y una que Hacienda no puede tener: el contraste es lo
    // único que distingue «no la tengo» de «tu petición está mal». Se arma a
    // partir de la real cambiándole el consecutivo y el código de seguridad, así
    // que es estructuralmente válida y del mismo emisor.
    const inexistente = invoice.feClave.slice(0, 21) + "00100001010000009999" + "1" + "99999999";
    await consultarEstado(token, invoice.feClave, "clave real de la 0189");
    await consultarEstado(token, inexistente, "clave inexistente (contraste)");
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Quién firmó realmente el XML guardado, y si es el mismo certificado que hoy
 * tiene configurado el despliegue.
 *
 * Importa porque son dos cosas distintas: el .p12 que está en el entorno ahora
 * y el que firmó el comprobante en su momento. Si no coinciden, el XML quedó
 * firmado por una identidad que ya no es la del sistema, y reenviarlo tal cual
 * manda a Hacienda una firma que no corresponde a la configuración vigente.
 */
function compararCertificadoFirmante(xml: string, llave: any) {
  const b64 = /<ds:X509Certificate>([\s\S]*?)<\/ds:X509Certificate>/.exec(xml)?.[1];
  if (!b64) {
    linea(BAD, "(f) El feXml no trae ds:X509Certificate: no se puede saber quién lo firmó.");
    return;
  }
  if (!llave?.forge) {
    linea(WARN, "(f) Hay certificado en el XML pero el .p12 no se pudo abrir: no hay con qué comparar.");
    return;
  }
  const forge = llave.forge;
  let info: ReturnType<typeof describirCertificado>;
  try {
    const der = forge.util.decode64(b64.replace(/\s+/g, ""));
    const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
    info = describirCertificado(forge, cert);
  } catch {
    linea(BAD, "(f) El ds:X509Certificate del feXml no se pudo decodificar.");
    return;
  }

  imprimirCertificado("Certificado que firmó el feXml de la 0189:", info);

  const serialXades = /<ds:X509SerialNumber>([\s\S]*?)<\/ds:X509SerialNumber>/.exec(xml)?.[1]?.trim();
  if (serialXades) {
    linea(
      serialXades === info.serialDec ? OK : BAD,
      `IssuerSerial declarado en el bloque XAdES: ${serialXades} ` +
        `(${serialXades === info.serialDec ? "coincide" : "NO coincide"} con el serial del certificado incrustado).`,
    );
  }

  if (info.huella === llave.info.huella) {
    linea(OK, "(f) Es EL MISMO certificado que el .p12 configurado (huellas SHA-256 idénticas).");
  } else {
    linea(BAD, "(f) NO es el mismo certificado que el .p12 configurado: las huellas SHA-256 difieren.");
    linea(
      INFO,
      `Serial del .p12: ${llave.info.serialDec} · serial del que firmó: ${info.serialDec}. ` +
        "Comparar también los emisores de arriba.",
    );
  }
}

/**
 * GET de la consulta de estado, con el cuerpo y TODOS los encabezados a la
 * vista. Mismas cabeceras de petición que fetchWithToken() en client.js, para
 * que lo que se observe acá sea lo que ve el código en producción.
 */
async function consultarEstado(token: string, clave: string, etiqueta: string) {
  const url = `${val("FE_API_URL").replace(/\/+$/, "")}/recepcion/${clave}`;
  console.log(`\n  ── Consulta: ${etiqueta}`);
  linea(INFO, `GET ${new URL(url).host}${new URL(url).pathname.replace(clave, "<clave>")} · clave ${clave}`);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const cuerpo = await res.text();
    linea(res.ok ? OK : BAD, `HTTP ${res.status} ${res.statusText}`);
    volcarEncabezados(res, etiqueta);
    // El cuerpo de la consulta describe nuestro propio comprobante; si trae el
    // XML de respuesta en base64 no se vuelca, pero el texto de un error sí,
    // porque es justamente lo que hay que leer.
    if (!cuerpo) {
      linea(WARN, "Cuerpo: VACÍO (cero bytes). No hay ningún texto que explique el resultado.");
    } else if (/respuesta-?xml/i.test(cuerpo)) {
      linea(INFO, `Cuerpo: ${cuerpo.length} bytes de JSON con respuesta-xml (no se vuelca su contenido).`);
    } else {
      linea(INFO, `Cuerpo (${cuerpo.length} bytes): ${cuerpo.slice(0, 500).replace(/\s+/g, " ")}`);
    }
    if (res.status === 404) linea(BAD, "404: Hacienda NO tiene esta clave; el código lo trata como «aún no llegó».");
    if (res.status === 400) linea(BAD, "400: el código lo convierte en FE_STATUS_UNAVAILABLE y aborta ANTES del POST.");
    if (res.status === 401) linea(BAD, "401: el token no sirve para este endpoint (¿IDP y API de ambientes distintos?).");
    return res.status;
  } catch {
    linea(BAD, "La consulta no completó (timeout o red).");
    return null;
  }
}

// ─── (g) Base de datos ───────────────────────────────────────────────────────

/**
 * A qué proyecto de Supabase apuntan las cadenas de conexión.
 *
 * Solo el ref del host y el modo (pooler o directa). Nunca el usuario ni la
 * contraseña: la cadena completa es una credencial.
 */
function diagnosticarBaseDeDatos() {
  capa("(g) BASE DE DATOS — a qué proyecto apunta");
  for (const nombre of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!hay(nombre)) {
      linea(INFO, `${nombre} ausente.`);
      continue;
    }
    try {
      const { hostname, port, username } = new URL(val(nombre));
      // Dos formas de nombrar el mismo proyecto: `db.<ref>.supabase.co` en la
      // conexión directa, y `postgres.<ref>` como usuario cuando se va por el
      // pooler regional, cuyo host no identifica el proyecto. Se extrae solo el
      // ref —que es el identificador del proyecto, no una credencial— y nunca la
      // contraseña.
      const ref =
        /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(hostname)?.[1] ||
        /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(username))?.[1] ||
        null;
      linea(
        ref ? INFO : WARN,
        `${nombre} → host ${hostname}:${port || "(por defecto)"} · ref del proyecto: ${ref || "no identificable"}`,
      );
    } catch {
      linea(BAD, `${nombre} no es una URL válida.`);
    }
  }
  linea(INFO, "Comparar el ref con el del proyecto de producción para saber si son la misma base.");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nDIAGNÓSTICO DE FACTURACIÓN ELECTRÓNICA — SOLO LECTURA");
  console.log("Sin emisión, sin reenvío, sin POST a /recepcion.");
  capa("ENTORNO");
  await cargarEnv(envFile);

  diagnosticarVariables();
  diagnosticarAmbiente();
  const llave = await diagnosticarLlave();
  const token = await diagnosticarToken();
  await diagnosticarFactura(token, llave);
  diagnosticarBaseDeDatos();

  capa("FIN");
  console.log("  Ningún valor de variable, PIN ni token fue impreso.\n");
}

main().catch(() => {
  // Ni el mensaje ni la traza: este script maneja configuración fiscal.
  console.error(`\n${BAD} El diagnóstico se interrumpió por un error no previsto.`);
  process.exit(1);
});
