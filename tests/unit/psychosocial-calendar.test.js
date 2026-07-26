import { describe, it, expect } from "vitest";
import {
  MARCAS,
  VENTANAS,
  CARGA_BASE_MENSUAL,
  PRECISIONES,
  hoyEnCostaRica,
  sumarDias,
  diferenciaDias,
  diaSemanaDe,
  lunesSiguiente,
  contarDiasSemana,
  estructuraDelMes,
  domingoDePascua,
  resolverMarca,
  marcasEnRango,
  ventanaDeMarca,
  ventanasActivas,
  contextoDelMes,
  proximasMarcas,
  marcasPorRevisar,
  cargaDelMes,
  ventanaDeOportunidad,
  matrizAnual,
  momentoActual,
  tareasDelCalendario,
  temasDelCalendario,
} from "@/lib/psychosocial-calendar";

describe("hoyEnCostaRica", () => {
  it("no adelanta el día cuando el servidor UTC ya cambió de fecha", () => {
    // 00:30 UTC del 11 de octubre es todavía el 10 de octubre en Costa Rica
    // (UTC-6). Es el error que rompería el recordatorio del Día Mundial.
    expect(hoyEnCostaRica(new Date("2026-10-11T00:30:00Z"))).toBe("2026-10-10");
  });

  it("cambia de día a las 06:00 UTC", () => {
    expect(hoyEnCostaRica(new Date("2026-10-10T05:59:00Z"))).toBe("2026-10-09");
    expect(hoyEnCostaRica(new Date("2026-10-10T06:00:00Z"))).toBe("2026-10-10");
  });

  it("devuelve siempre formato YYYY-MM-DD", () => {
    expect(hoyEnCostaRica()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("aritmética de fechas", () => {
  it("suma cruzando fin de mes y fin de año", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("suma cruzando el 29 de febrero de un año bisiesto", () => {
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarDias("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("calcula diferencias con signo", () => {
    expect(diferenciaDias("2026-10-01", "2026-10-10")).toBe(9);
    expect(diferenciaDias("2026-10-10", "2026-10-01")).toBe(-9);
    expect(diferenciaDias("2026-10-10", "2026-10-10")).toBe(0);
  });

  it("reproduce los días de la semana que afirma el documento", () => {
    expect(diaSemanaDe("2026-08-15")).toBe("sábado");
    expect(diaSemanaDe("2026-10-10")).toBe("sábado");
    expect(diaSemanaDe("2026-11-27")).toBe("viernes");
    expect(diaSemanaDe("2027-01-01")).toBe("viernes");
    expect(diaSemanaDe("2027-06-20")).toBe("domingo");
    expect(diaSemanaDe("2027-08-02")).toBe("lunes");
  });
});

describe("estructura calendárica calculada", () => {
  it("confirma que setiembre 2026 tiene cinco martes y cinco miércoles", () => {
    expect(estructuraDelMes(2026, 9).diasConCinco).toEqual(["martes", "miércoles"]);
  });

  it("confirma que enero 2027 tiene cinco fines de semana completos", () => {
    const enero = estructuraDelMes(2027, 1);
    expect(enero.finesDeSemanaCompletos).toBe(true);
    expect(enero.diasConCinco).toEqual(expect.arrayContaining(["viernes", "sábado", "domingo"]));
  });

  it("corrige al documento: julio 2027 tiene cuatro domingos, no cinco", () => {
    const julio = estructuraDelMes(2027, 7);
    expect(julio.diasConCinco).toEqual(["jueves", "viernes", "sábado"]);
    expect(julio.diasConCinco).not.toContain("domingo");
    expect(contarDiasSemana(2027, 7)[0]).toBe(4); // 0 = domingo
    expect(julio.finesDeSemanaCompletos).toBe(false);
  });

  it("cuenta 28, 29, 30 y 31 días correctamente", () => {
    const suma = (anio, mes) => contarDiasSemana(anio, mes).reduce((a, b) => a + b, 0);
    expect(suma(2027, 2)).toBe(28);
    expect(suma(2028, 2)).toBe(29);
    expect(suma(2027, 4)).toBe(30);
    expect(suma(2027, 7)).toBe(31);
  });
});

describe("fechas móviles", () => {
  it("calcula el domingo de Pascua", () => {
    expect(domingoDePascua(2027)).toBe("2027-03-28");
    expect(domingoDePascua(2026)).toBe("2026-04-05");
    expect(domingoDePascua(2028)).toBe("2028-04-16");
  });

  it("resuelve Jueves y Viernes Santos de 2027 al 25 y 26 de marzo", () => {
    const santa = resolverMarca(
      MARCAS.find((m) => m.id === "semana-santa"),
      2027,
    );
    expect(santa.pico).toBe("2027-03-25");
    expect(sumarDias(santa.pico, 1)).toBe("2027-03-26");
    expect(diaSemanaDe(santa.pico)).toBe("jueves");
  });

  it("resuelve Black Friday al cuarto viernes largo de noviembre", () => {
    const bf = MARCAS.find((m) => m.id === "black-friday");
    expect(resolverMarca(bf, 2026).pico).toBe("2026-11-27");
    expect(diaSemanaDe(resolverMarca(bf, 2027).pico)).toBe("viernes");
  });
});

describe("traslado de feriados al lunes", () => {
  const juanSantamaria = () => MARCAS.find((m) => m.id === "juan-santamaria");

  it("corre Juan Santamaría al lunes 12 en 2027, que es cuando cae el asueto", () => {
    const r = resolverMarca(juanSantamaria(), 2027);
    expect(diaSemanaDe("2027-04-11")).toBe("domingo");
    expect(r.inicio).toBe("2027-04-11"); // la fecha conmemorada no se mueve
    expect(r.pico).toBe("2027-04-12"); // el día libre sí
    expect(diaSemanaDe(r.pico)).toBe("lunes");
    expect(r.trasladado).toBe(true);
  });

  it("no mueve nada cuando la fecha ya cae lunes", () => {
    // 11 de abril de 2033 es lunes.
    const r = resolverMarca(juanSantamaria(), 2033);
    expect(diaSemanaDe("2033-04-11")).toBe("lunes");
    expect(r.pico).toBe("2033-04-11");
    expect(r.trasladado).toBe(false);
  });

  it("el traslado siempre aterriza en lunes, sea cual sea el año", () => {
    for (let anio = 2026; anio <= 2040; anio += 1) {
      expect(diaSemanaDe(resolverMarca(juanSantamaria(), anio).pico)).toBe("lunes");
    }
  });

  it("lunesSiguiente es idempotente sobre un lunes", () => {
    expect(lunesSiguiente("2027-04-12")).toBe("2027-04-12");
    expect(lunesSiguiente(lunesSiguiente("2027-04-11"))).toBe("2027-04-12");
  });

  it("no traslada los feriados que la fuente no declara trasladables", () => {
    const nicoya = resolverMarca(MARCAS.find((m) => m.id === "anexion-nicoya"), 2027);
    expect(diaSemanaDe("2027-07-25")).toBe("domingo");
    expect(nicoya.pico).toBe("2027-07-25");
  });
});

describe("marcas incorporadas desde el anexo", () => {
  it("incluye el marchamo, que la matriz original no contemplaba", () => {
    const marchamo = resolverMarca(MARCAS.find((m) => m.id === "marchamo"), 2026);
    expect(marchamo.inicio).toBe("2026-11-01");
    expect(marchamo.fin).toBe("2026-12-31");
    expect(marchamo.ejes.financiero).toBe(4);
  });

  it("incluye las dos fechas del eje masculino", () => {
    const ids = MARCAS.filter((m) => m.prioridad === "ALTA").map((m) => m.id);
    expect(ids).toContain("dia-internacional-hombre");
    expect(ids).toContain("dia-del-padre");
  });

  it("calcula Blue Monday como tercer lunes de enero", () => {
    const bm = MARCAS.find((m) => m.id === "blue-monday");
    expect(resolverMarca(bm, 2027).pico).toBe("2027-01-18");
    expect(diaSemanaDe(resolverMarca(bm, 2027).pico)).toBe("lunes");
    expect(diaSemanaDe(resolverMarca(bm, 2028).pico)).toBe("lunes");
  });

  it("marca Blue Monday con la advertencia de que no es categoría clínica", () => {
    expect(MARCAS.find((m) => m.id === "blue-monday").nota).toMatch(/publicitaria|marketing/i);
  });
});

describe("catálogo de marcas", () => {
  it("no tiene ids repetidos", () => {
    const ids = MARCAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declara ejes válidos y dentro de escala", () => {
    const validos = new Set(["financiero", "academico", "laboral", "familiar", "institucional"]);
    for (const marca of MARCAS) {
      for (const [eje, valor] of Object.entries(marca.ejes || {})) {
        expect(validos.has(eje), `${marca.id} declara el eje ${eje}`).toBe(true);
        expect(valor).toBeGreaterThanOrEqual(0);
        expect(valor).toBeLessThanOrEqual(4);
      }
    }
  });

  it("resuelve toda marca ANUAL o MOVIL a fechas coherentes en cualquier año", () => {
    for (const anio of [2026, 2027, 2030]) {
      for (const marca of MARCAS) {
        if (marca.recurrencia === "ANCLADO") continue;
        const r = resolverMarca(marca, anio);
        expect(r, `${marca.id} no resolvió en ${anio}`).toBeTruthy();
        expect(r.inicio <= r.fin, `${marca.id}: inicio después de fin`).toBe(true);
        expect(r.pico >= r.inicio && r.pico <= r.fin, `${marca.id}: pico fuera del rango`).toBe(true);
      }
    }
  });

  it("no proyecta las marcas ANCLADO a años que no declaran", () => {
    const paa = MARCAS.find((m) => m.id === "pruebas-admision-paa");
    expect(resolverMarca(paa, 2026)).toBeTruthy();
    expect(resolverMarca(paa, 2030)).toBeNull();
  });

  it("el calendario sigue vivo después del 14-ago-2027, fin del ciclo del documento", () => {
    const despues = marcasEnRango("2027-08-15", "2027-12-31");
    expect(despues.length).toBeGreaterThan(5);
    expect(despues.some((m) => m.id === "dia-mundial-salud-mental")).toBe(true);
  });
});

describe("ventanas de lag", () => {
  const dmsm = () => resolverMarca(MARCAS.find((m) => m.id === "dia-mundial-salud-mental"), 2026);

  it("cubre sin huecos de T-28 a T+17", () => {
    const marca = dmsm();
    for (let offset = -28; offset <= 17; offset += 1) {
      const fecha = sumarDias(marca.pico, offset);
      expect(ventanaDeMarca(marca, fecha), `sin ventana en offset ${offset}`).toBeTruthy();
    }
  });

  it("no está activa fuera del rango", () => {
    const marca = dmsm();
    expect(ventanaDeMarca(marca, sumarDias(marca.pico, -29))).toBeNull();
    expect(ventanaDeMarca(marca, sumarDias(marca.pico, 18))).toBeNull();
  });

  it("asigna cada ventana en su borde exacto", () => {
    const marca = dmsm(); // pico 2026-10-10
    expect(ventanaDeMarca(marca, "2026-09-12").id).toBe("PREPARACION"); // T-28
    expect(ventanaDeMarca(marca, "2026-09-25").id).toBe("PREPARACION"); // T-15
    expect(ventanaDeMarca(marca, "2026-09-26").id).toBe("PREVENCION"); // T-14
    expect(ventanaDeMarca(marca, "2026-10-07").id).toBe("PREVENCION"); // T-3
    expect(ventanaDeMarca(marca, "2026-10-08").id).toBe("PICO"); // T-2
    expect(ventanaDeMarca(marca, "2026-10-10").id).toBe("PICO"); // T
    expect(ventanaDeMarca(marca, "2026-10-12").id).toBe("PICO"); // T+2
    expect(ventanaDeMarca(marca, "2026-10-13").id).toBe("INTEGRACION"); // T+3
    expect(ventanaDeMarca(marca, "2026-10-27").id).toBe("INTEGRACION"); // T+17
  });

  it("las ventanas no se solapan entre sí", () => {
    for (let i = 1; i < VENTANAS.length; i += 1) {
      expect(VENTANAS[i].desde).toBe(VENTANAS[i - 1].hasta + 1);
    }
  });

  it("informa cuántos días faltan al pico", () => {
    const marca = dmsm();
    expect(ventanaDeMarca(marca, "2026-09-26").diasAlPico).toBe(14);
    expect(ventanaDeMarca(marca, "2026-10-13").diasAlPico).toBe(-3);
  });

  it("las marcas de precisión MES no disparan cuenta regresiva", () => {
    const paa = resolverMarca(MARCAS.find((m) => m.id === "pruebas-admision-paa"), 2026);
    expect(paa.precision).toBe(PRECISIONES.MES);
    expect(ventanaDeMarca(paa, "2026-10-01")).toBeNull();
    expect(contextoDelMes("2026-10-15").some((m) => m.id === "pruebas-admision-paa")).toBe(true);
  });
});

describe("ventanasActivas", () => {
  it("pone a preparar el Día Mundial de la Salud Mental un mes antes", () => {
    const activas = ventanasActivas("2026-09-14");
    const dmsm = activas.find((a) => a.marca.id === "dia-mundial-salud-mental");
    expect(dmsm.ventana.id).toBe("PREPARACION");
    expect(dmsm.ventana.diasAlPico).toBe(26);
  });

  it("prioriza publicar sobre preparar", () => {
    const activas = ventanasActivas("2026-09-26");
    const orden = activas.map((a) => a.ventana.id);
    const primeraPreparacion = orden.indexOf("PREPARACION");
    const ultimaPrevencion = orden.lastIndexOf("PREVENCION");
    if (primeraPreparacion !== -1 && ultimaPrevencion !== -1) {
      expect(ultimaPrevencion).toBeLessThan(primeraPreparacion);
    }
  });

  it("mantiene viva la contención después del pico", () => {
    const activas = ventanasActivas("2026-09-20"); // 10 días después del 10-set
    const suicidio = activas.find((a) => a.marca.id === "semana-prevencion-suicidio");
    expect(suicidio.ventana.id).toBe("INTEGRACION");
  });

  it("cruza el fin de año sin perder las marcas de enero", () => {
    const activas = ventanasActivas("2026-12-20");
    expect(activas.some((a) => a.marca.id === "ano-nuevo")).toBe(true);
    expect(activas.find((a) => a.marca.id === "ano-nuevo").marca.inicio).toBe("2027-01-01");
  });

  it("el panel casi nunca queda vacío a lo largo del ciclo", () => {
    let fecha = "2026-08-15";
    let vacios = 0;
    while (fecha <= "2027-08-14") {
      if (ventanasActivas(fecha).length === 0) vacios += 1;
      fecha = sumarDias(fecha, 1);
    }
    expect(vacios).toBe(0);
  });
});

describe("proximasMarcas y revisión", () => {
  it("ordena por cercanía y respeta el límite", () => {
    const proximas = proximasMarcas("2026-09-01", 60, 4);
    expect(proximas).toHaveLength(4);
    expect(proximas[0].marca.id).toBe("semana-prevencion-suicidio");
    for (let i = 1; i < proximas.length; i += 1) {
      expect(proximas[i].faltan).toBeGreaterThanOrEqual(proximas[i - 1].faltan);
    }
  });

  it("no incluye marcas ya pasadas", () => {
    for (const p of proximasMarcas("2026-10-11")) {
      expect(p.faltan).toBeGreaterThan(0);
    }
  });

  it("avisa cuando una fecha anclada quedó vencida", () => {
    const pendientes = marcasPorRevisar("2028-01-01");
    expect(pendientes.length).toBeGreaterThan(0);
    expect(pendientes.every((p) => p.vencida)).toBe(true);
    expect(pendientes.some((p) => p.marca.id === "inicio-curso-mep")).toBe(true);
  });

  it("abre la ventana de confirmación antes de que la fecha llegue", () => {
    const pendientes = marcasPorRevisar("2026-12-15");
    expect(pendientes.some((p) => p.marca.id === "inicio-curso-mep" && !p.vencida)).toBe(true);
  });
});

describe("mapa térmico", () => {
  it("tiene los doce meses con los cinco ejes en escala 0-4", () => {
    expect(Object.keys(CARGA_BASE_MENSUAL)).toHaveLength(12);
    for (const mes of Object.values(CARGA_BASE_MENSUAL)) {
      expect(Object.keys(mes)).toHaveLength(5);
      for (const valor of Object.values(mes)) {
        expect(valor).toBeGreaterThanOrEqual(0);
        expect(valor).toBeLessThanOrEqual(4);
      }
    }
  });

  it("sube el eje financiero en meses de cinco fines de semana y lo explica", () => {
    const marzo = cargaDelMes(2027, 3); // sin cinco fines de semana
    expect(marzo.ajustes).toHaveLength(0);
    expect(marzo.ejes.financiero).toBe(CARGA_BASE_MENSUAL[3].financiero);

    const enero = cargaDelMes(2027, 1); // cinco fines de semana completos
    expect(enero.ajustes[0].eje).toBe("financiero");
    expect(enero.ejes.financiero).toBe(4); // acotado en el máximo, no 5
  });

  it("nunca se sale de la escala", () => {
    for (let mes = 1; mes <= 12; mes += 1) {
      for (const anio of [2026, 2027, 2028]) {
        for (const valor of Object.values(cargaDelMes(anio, mes).ejes)) {
          expect(valor).toBeGreaterThanOrEqual(0);
          expect(valor).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("reproduce la conclusión §5.2: noviembre y mayo son las mejores ventanas", () => {
    const columnas = matrizAnual(2026, 8, 13);
    const mejores = [...columnas].sort((a, b) => b.oportunidad - a.oportunidad).slice(0, 3);
    const meses = mejores.map((c) => c.mes);
    expect(meses).toContain(11);
    expect(meses).toContain(5);
  });

  it("penaliza los meses de mucho ruido institucional", () => {
    const octubre = ventanaDeOportunidad(CARGA_BASE_MENSUAL[10]);
    const noviembre = ventanaDeOportunidad(CARGA_BASE_MENSUAL[11]);
    expect(octubre.ruido).toBe(4);
    expect(noviembre.oportunidad).toBeGreaterThan(octubre.oportunidad);
  });

  it("matrizAnual cruza el cambio de año", () => {
    const columnas = matrizAnual(2026, 8, 13);
    expect(columnas).toHaveLength(13);
    expect(columnas[0]).toMatchObject({ anio: 2026, mes: 8 });
    expect(columnas[5]).toMatchObject({ anio: 2027, mes: 1 });
    expect(columnas[12]).toMatchObject({ anio: 2027, mes: 8 });
  });
});

describe("momentoActual", () => {
  it("retrata noviembre como ventana silenciosa con burnout y cierre académico a la vez", () => {
    const m = momentoActual("2026-11-10");
    expect(m.etiquetaMes).toBe("noviembre");
    expect(m.ejesDominantes).toEqual(["academico", "laboral"]);
    expect(m.esVentanaSilenciosa).toBe(true);
    expect(m.ruido).toBe(0);
  });

  it("reporta un solo eje dominante cuando no hay empate", () => {
    expect(momentoActual("2027-07-10").ejesDominantes).toEqual(["familiar"]);
  });

  it("no marca octubre como ventana silenciosa", () => {
    expect(momentoActual("2026-10-05").esVentanaSilenciosa).toBe(false);
  });

  it("explica la estructura del mes con datos calculados", () => {
    const m = momentoActual("2027-01-15");
    expect(m.estructura.finesDeSemanaCompletos).toBe(true);
    expect(m.nota ?? m.estructura.nota).toContain("fines de semana");
  });

  it("funciona sin argumentos, sobre la fecha real", () => {
    const m = momentoActual();
    expect(m.fecha).toBe(hoyEnCostaRica());
    expect(m.ejes).toBeTruthy();
    expect(Array.isArray(m.ventanasActivas)).toBe(true);
  });
});

describe("tareasDelCalendario", () => {
  it("produce tareas con la forma que consume el inventario diario", () => {
    const tareas = tareasDelCalendario(momentoActual("2026-09-20"));
    expect(tareas.length).toBeGreaterThan(0);
    for (const tarea of tareas) {
      expect(tarea.id).toMatch(/^cal:/);
      expect(typeof tarea.label).toBe("string");
      expect(tarea.label.length).toBeGreaterThan(0);
      expect(typeof tarea.detail).toBe("string");
    }
  });

  it("no colisiona con los ids de las tareas fijas del inventario", () => {
    const fijas = ["blog-review-drafts", "finance-check-income", "ads-new-articles", "seo-link-content"];
    const ids = tareasDelCalendario(momentoActual("2026-10-01")).map((t) => t.id);
    for (const fija of fijas) expect(ids).not.toContain(fija);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("redacta cada ventana con su verbo", () => {
    const preparar = tareasDelCalendario(momentoActual("2026-09-14")).find((t) =>
      t.marcaId === "dia-mundial-salud-mental",
    );
    expect(preparar.label).toContain("Preparar");
    expect(preparar.label).toContain("faltan 26 días");

    const seguir = tareasDelCalendario(momentoActual("2026-09-20")).find(
      (t) => t.marcaId === "semana-prevencion-suicidio",
    );
    expect(seguir.label).toContain("Seguimiento");
    expect(seguir.label).toContain("día 10 de 17");
  });

  it("dice «Hoy» el día del pico", () => {
    const hoy = tareasDelCalendario(momentoActual("2026-10-10")).find(
      (t) => t.marcaId === "dia-mundial-salud-mental",
    );
    expect(hoy.label).toBe("Hoy: Día Mundial de la Salud Mental");
  });

  it("respeta el límite y deja pasar las revisiones de fecha", () => {
    const tareas = tareasDelCalendario(momentoActual("2026-12-15"), 3);
    expect(tareas.filter((t) => t.ventana !== "REVISION").length).toBeLessThanOrEqual(3);
    expect(tareas.some((t) => t.ventana === "REVISION")).toBe(true);
  });
});

describe("enganche con la biblioteca", () => {
  it("expone slugs de tema en formato slug", () => {
    const temas = temasDelCalendario();
    expect(temas.length).toBeGreaterThan(5);
    for (const slug of temas) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("las marcas de prioridad alta declaran tema", () => {
    for (const marca of MARCAS.filter((m) => m.prioridad === "ALTA")) {
      expect(marca.temas.length, `${marca.id} sin tema`).toBeGreaterThan(0);
    }
  });
});
