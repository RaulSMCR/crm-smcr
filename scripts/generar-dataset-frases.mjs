// scripts/generar-dataset-frases.mjs
//
// Convierte la base de conocimiento de frases (CSV + los 13 .md mensuales) en
// el dataset compacto que consume el CRM.
//
// Por qué un dataset generado y no la base de datos: el corpus es material
// editorial cerrado de 5.840 asignaciones que cambia una vez al año. Versionarlo
// lo hace revisable en PR, testeable y gratis de leer. Lo único que cambia a
// diario —la elección del admin y la verificación de fuentes— sí vive en base de
// datos.
//
// La normalización lo encoge unas doce veces: 1,42 MB de CSV plano contra
// ~200 KB de JSON con las frases desduplicadas y referenciadas por índice.
//
// Uso:
//   node scripts/generar-dataset-frases.mjs ["ruta/a/base de conocmiento/frases"]
//
// Salida (determinista, para que el diff sea legible):
//   src/data/frases/corpus.json
//   src/data/frases/dias.json

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ORIGEN_POR_DEFECTO =
  "C:/Users/usuario/OneDrive/Escritorio/crm-smcr/base de conocmiento/frases";

const origen = process.argv[2] || ORIGEN_POR_DEFECTO;
const destino = resolve(process.cwd(), "src/data/frases");

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];
// Los .md usan "septiembre"; el resto del CRM usa "setiembre".
const ALIAS_MES = { septiembre: "setiembre" };

// ─── Parser CSV (RFC4180 mínimo: comillas, comas y saltos dentro de campo) ───

function parseCSV(str) {
  const filas = [];
  let campo = "";
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < str.length; i += 1) {
    const c = str[i];
    if (enComillas) {
      if (c === '"') {
        if (str[i + 1] === '"') { campo += '"'; i += 1; }
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

function leerUtf8(ruta) {
  return readFileSync(ruta).toString("utf8").replace(/^\uFEFF/, "");
}

// ─── Metadatos por día desde los .md mensuales ───────────────────────────────
// El CSV trae calor, evento y ventana sensible, pero no el "vector de lectura"
// ni los "temas dominantes" del día, que son la lectura clínica de la fecha y
// lo más útil para el admin que revisa. Eso solo está en los .md.

function metadatosDesdeMd(dir) {
  const porFecha = new Map();
  const archivos = readdirSync(dir)
    .filter((n) => /^\d{2}_\d{4}-\d{2}_.+\.md$/.test(n))
    .sort();

  for (const archivo of archivos) {
    const texto = leerUtf8(join(dir, archivo));
    const bloques = texto.split(/^### /m).slice(1);

    for (const bloque of bloques) {
      const encabezado = bloque.split("\n")[0];
      // Sin anclar al día de la semana: "Sábado" y "Miércoles" llevan tilde y
      // \w no la reconoce, lo que dejaba esos días sin metadatos en silencio.
      const m = encabezado.match(/(\d{1,2}) de ([A-Za-zÁÉÍÓÚáéíóúÑñ]+) de (\d{4})/);
      if (!m) continue;
      const [, dia, mesTexto, anio] = m;
      const nombreMes = ALIAS_MES[mesTexto.toLowerCase()] || mesTexto.toLowerCase();
      const mes = MESES.indexOf(nombreMes) + 1;
      if (mes === 0) throw new Error(`Mes no reconocido: ${mesTexto} en ${archivo}`);
      const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      const dominantes = bloque.match(/\*\*Temas dominantes:\*\*\s*(.+)/);
      const vector = bloque.match(/\*\*Vector de lectura:\*\*\s*(.+)/);

      porFecha.set(fecha, {
        temasDominantes: dominantes
          ? dominantes[1].trim().split("·").map((t) => t.trim()).filter(Boolean)
          : [],
        vector: vector ? vector[1].trim() : null,
      });
    }
  }
  return porFecha;
}

// ─── Construcción del dataset ────────────────────────────────────────────────

function generar() {
  const csv = parseCSV(leerUtf8(join(origen, "calendario_frases.csv")));
  const cabecera = csv[0];
  const filas = csv.slice(1).filter((f) => f.length === cabecera.length);
  const idx = Object.fromEntries(cabecera.map((c, i) => [c, i]));
  const col = (f, n) => f[idx[n]];

  const metadatos = metadatosDesdeMd(origen);

  // Fuentes (pares autor–obra) y frases únicas, con índice estable por orden
  // alfabético para que regenerar no reordene el JSON.
  const clavesFuente = [...new Set(filas.map((f) => `${col(f, "autor")}\u0000${col(f, "fuente")}`))].sort();
  const indiceFuente = new Map(clavesFuente.map((k, i) => [k, i]));
  const fuentes = clavesFuente.map((k) => {
    const [autor, obra] = k.split("\u0000");
    return { a: autor, o: obra };
  });

  const clavesFrase = [...new Set(filas.map((f) => col(f, "frase")))].sort();
  const indiceFrase = new Map(clavesFrase.map((k, i) => [k, i]));
  const frases = clavesFrase.map((texto) => {
    const fila = filas.find((f) => col(f, "frase") === texto);
    return {
      t: texto,
      f: indiceFuente.get(`${col(fila, "autor")}\u0000${col(fila, "fuente")}`),
      c: col(fila, "categoria_tonal"),
      m: (col(fila, "temas") || "").split(";").filter(Boolean),
    };
  });

  // Días
  const porFecha = new Map();
  for (const fila of filas) {
    const fecha = col(fila, "fecha");
    if (!porFecha.has(fecha)) {
      const meta = metadatos.get(fecha) || { temasDominantes: [], vector: null };
      porFecha.set(fecha, {
        d: fecha,
        s: col(fila, "dia_semana"),
        e: col(fila, "evento") || null,
        k: Number(col(fila, "calor")),
        v: col(fila, "ventana_sensible") === "sí",
        td: meta.temasDominantes,
        vl: meta.vector,
        a: {},
      });
    }
    const dia = porFecha.get(fecha);
    const aud = col(fila, "audiencia_id");
    if (!dia.a[aud]) dia.a[aud] = [null, null];
    const slot = Number(col(fila, "slot")) - 1;
    dia.a[aud][slot] = indiceFrase.get(col(fila, "frase"));
  }

  const dias = [...porFecha.values()].sort((x, y) => (x.d < y.d ? -1 : 1));

  // Verificaciones antes de escribir: si el corpus llega roto, mejor fallar aquí
  // que servir un día sin frases en el panel.
  const problemas = [];
  for (const dia of dias) {
    const audiencias = Object.keys(dia.a);
    if (audiencias.length !== 8) problemas.push(`${dia.d}: ${audiencias.length} audiencias`);
    for (const [aud, slots] of Object.entries(dia.a)) {
      if (slots.some((s) => s === null || s === undefined)) {
        problemas.push(`${dia.d}/${aud}: falta un slot`);
      }
    }
  }
  if (dias.length !== 365) problemas.push(`días: ${dias.length}, se esperaban 365`);

  // Todo día debe traer sus temas dominantes desde el .md. Si el parseo de los
  // encabezados se rompe, esto lo delata en vez de dejar días mudos.
  const sinTemas = dias.filter((d) => !d.td.length);
  if (sinTemas.length) {
    problemas.push(`${sinTemas.length} días sin temas dominantes (${sinTemas.slice(0, 3).map((d) => d.d).join(", ")}…)`);
  }
  if (problemas.length) {
    console.error("El corpus no pasó la verificación:");
    for (const p of problemas.slice(0, 20)) console.error("  -", p);
    process.exit(1);
  }

  // ─── Avisos de repetición ──────────────────────────────────────────────────
  //
  // El CRM prohíbe repetir: una frase elegida no se vuelve a ofrecer nunca. Eso
  // convierte al corpus en un stock que se consume, no en un calendario. Estas
  // cuentas no invalidan el material —el panel reemplaza al vuelo lo quemado—,
  // pero dicen de entrada cuánto rinde y dónde aprieta, que es lo que hay que
  // saber ANTES de producir el ciclo siguiente.
  const AUDIENCIAS_POR_DIA = 8;
  const VENTANA_CERCANA = 10;

  const necesarias = dias.length * AUDIENCIAS_POR_DIA;
  const cobertura = (frases.length / necesarias) * 100;

  // Cada frase, en qué posiciones del año la coloca el corpus.
  const posiciones = new Map();
  dias.forEach((dia, i) => {
    for (const slots of Object.values(dia.a)) {
      for (const indice of slots) {
        if (!posiciones.has(indice)) posiciones.set(indice, []);
        posiciones.get(indice).push(i);
      }
    }
  });

  let reusos = 0;
  let reusosCercanos = 0;
  for (const ds of posiciones.values()) {
    for (let k = 1; k < ds.length; k += 1) {
      reusos += 1;
      if (ds[k] - ds[k - 1] <= VENTANA_CERCANA) reusosCercanos += 1;
    }
  }

  const usosPorAutor = new Map();
  for (const dia of dias) {
    for (const slots of Object.values(dia.a)) {
      for (const indice of slots) {
        const autor = fuentes[frases[indice].f].a;
        usosPorAutor.set(autor, (usosPorAutor.get(autor) || 0) + 1);
      }
    }
  }
  // La concentración se mide sobre las asignaciones del corpus (16 por día), no
  // sobre las publicaciones del año (8): son cosas distintas y confundirlas
  // duplica la cifra.
  const asignaciones = [...usosPorAutor.values()].reduce((n, v) => n + v, 0);
  const topAutores = [...usosPorAutor.entries()].sort((a, b) => b[1] - a[1]);
  const conc10 = (topAutores.slice(0, 10).reduce((n, [, v]) => n + v, 0) / asignaciones) * 100;

  console.log("");
  console.log("─── repetición ───────────────────────────────────────────────");
  console.log(
    `stock        ${frases.length} frases distintas para ${necesarias} publicaciones del año ` +
      `(${cobertura.toFixed(0)} % de cobertura)`,
  );
  console.log(
    `alcance      con la prohibición de repetir, rinde ${Math.floor(frases.length / AUDIENCIAS_POR_DIA)} días ` +
      `a ${AUDIENCIAS_POR_DIA} audiencias diarias`,
  );
  console.log(
    `reusos       ${reusos} reapariciones en el calendario · ${reusosCercanos} a ${VENTANA_CERCANA} días o menos`,
  );
  console.log(
    `autores      ${usosPorAutor.size} · los 10 primeros cubren ${conc10.toFixed(0)} % de las ${asignaciones} asignaciones`,
  );

  if (frases.length < necesarias) {
    console.log("");
    console.log(
      `AVISO: faltan ${necesarias - frases.length} frases para cubrir el año sin repetir ninguna. ` +
        `El panel va a reemplazar las quemadas mientras haya stock, y se queda mudo cuando se agote.`,
    );
  }
  if (reusosCercanos > 0) {
    console.log(
      `AVISO: ${reusosCercanos} reapariciones caen a ${VENTANA_CERCANA} días o menos. ` +
        `No se publican dos veces —la prohibición lo impide—, pero cada una obliga a un reemplazo ` +
        `y aleja la propuesta del criterio editorial del corpus.`,
    );
  }
  console.log("");

  const corpus = {
    version: `${dias[0].d}_${dias.at(-1).d}`,
    generado: new Date().toISOString().slice(0, 10),
    fuentes,
    frases,
  };

  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, "corpus.json"), `${JSON.stringify(corpus)}\n`, "utf8");
  writeFileSync(
    join(destino, "dias.json"),
    `${JSON.stringify({ version: corpus.version, dias })}\n`,
    "utf8",
  );

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`corpus.json  ${frases.length} frases · ${fuentes.length} fuentes · ${kb(JSON.stringify(corpus).length)}`);
  console.log(`dias.json    ${dias.length} días · ${dias.length * 16} asignaciones · ${kb(JSON.stringify({ dias }).length)}`);
  console.log(`ventana      ${dias[0].d} → ${dias.at(-1).d}`);
  console.log(`sensibles    ${dias.filter((d) => d.v).length} días · calor ≥9: ${dias.filter((d) => d.k >= 9).length}`);
  console.log(`con vector   ${dias.filter((d) => d.vl).length} días`);
}

generar();
