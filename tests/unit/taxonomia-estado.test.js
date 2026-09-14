// tests/unit/taxonomia-estado.test.js
//
// Lo que se prueba acá no es cosmético: es la diferencia entre «3 art.» —lo que
// decía la pantalla— y «esa página está vacía» o «esa página da error», que es
// lo que en realidad pasaba. El conteo crudo de la tabla de unión no coincide
// con lo que se ve en el sitio, y quien administra no tiene cómo saberlo.
import { describe, it, expect } from "vitest";
import {
  TONO,
  avisoDeOrden,
  avisoDeRenombrado,
  estadoDeDisciplina,
  estadoDeEntrega,
  estadoDeFase,
  estadoDeSerie,
  estadoDeTema,
} from "../../src/lib/taxonomia-estado.js";

const publicada = { status: "PUBLISHED", seriesApproved: true };
const borrador = { status: "DRAFT", seriesApproved: true };
const sinAprobar = { status: "PUBLISHED", seriesApproved: false };

describe("estado de una serie", () => {
  it("cuenta como visible solo lo publicado y aprobado", () => {
    const estado = estadoDeSerie({ isActive: true, entregas: [publicada, publicada, borrador, sinAprobar] });
    expect(estado.tono).toBe(TONO.VISIBLE);
    expect(estado.visibles).toBe(2);
    expect(estado.pendientes).toBe(2);
    expect(estado.etiqueta).toBe("2 entregas");
  });

  it("una serie con artículos sin publicar no es una serie visible", () => {
    // Éste era el caso que la pantalla contaba como «3 art.».
    const estado = estadoDeSerie({ isActive: true, entregas: [borrador, borrador, borrador] });
    expect(estado.tono).toBe(TONO.PENDIENTE);
    expect(estado.visibles).toBe(0);
    expect(estado.explicacion).toContain("ninguno está publicado");
  });

  it("una serie recién creada dice dónde se le asignan los artículos", () => {
    const estado = estadoDeSerie({ isActive: true, entregas: [] });
    expect(estado.tono).toBe(TONO.PENDIENTE);
    expect(estado.explicacion).toContain("desde cada artículo");
  });

  it("oculta significa que su página no abre, no que esté vacía", () => {
    const estado = estadoDeSerie({ isActive: false, entregas: [publicada] });
    expect(estado.tono).toBe(TONO.OCULTO);
    expect(estado.explicacion).toContain("Su página no abre");
    // El dato sigue estando: ocultar una serie no despublica sus artículos.
    expect(estado.visibles).toBe(1);
  });

  it("avisa de lo que queda afuera cuando hay mezcla", () => {
    expect(estadoDeSerie({ isActive: true, entregas: [publicada, borrador] }).explicacion).toContain("1 artículo sin publicar");
  });

  it("concuerda el singular", () => {
    expect(estadoDeSerie({ isActive: true, entregas: [publicada] }).etiqueta).toBe("1 entrega");
  });
});

describe("estado de un tema", () => {
  it("un tema sin artículos visibles es una URL rota, y lo dice", () => {
    // `/blog/tema/[slug]` hace notFound() cuando queda vacío; la serie no.
    const estado = estadoDeTema({ isActive: true, visibles: 0, total: 0 });
    expect(estado.tono).toBe(TONO.PENDIENTE);
    expect(estado.explicacion).toContain("da error");
  });

  it("distingue la etiqueta sugerida de la aprobada", () => {
    const estado = estadoDeTema({ isActive: true, visibles: 0, total: 3 });
    expect(estado.explicacion).toContain("sin aprobar o sin publicar");
    expect(estado.pendientes).toBe(3);
  });

  it("cuenta solo lo aprobado y publicado cuando se ve", () => {
    const estado = estadoDeTema({ isActive: true, visibles: 2, total: 5 });
    expect(estado.tono).toBe(TONO.VISIBLE);
    expect(estado.etiqueta).toBe("2 artículos");
    expect(estado.explicacion).toContain("3 etiquetas sugeridas sin aprobar");
  });
});

describe("estado de disciplinas y fases", () => {
  it("una disciplina sin uso no aparece en los filtros", () => {
    expect(estadoDeDisciplina({ isActive: true, visibles: 0, total: 0 }).etiqueta).toBe("Sin uso");
  });

  it("la fase dice que no tiene página en el sitio", () => {
    const estado = estadoDeFase({ isActive: true, series: 2 });
    expect(estado.tono).toBe(TONO.NEUTRO);
    expect(estado.etiqueta).toBe("2 series");
    expect(estado.explicacion).toContain("no tienen página en el sitio");
  });
});

describe("estado de una entrega", () => {
  it("separa «sin publicar» de «serie sin aprobar»", () => {
    expect(estadoDeEntrega(borrador).etiqueta).toBe("Sin publicar");
    expect(estadoDeEntrega(sinAprobar).etiqueta).toBe("Serie sin aprobar");
    expect(estadoDeEntrega(publicada).tono).toBe(TONO.VISIBLE);
  });

  it("explica cómo se arregla una serie sin aprobar", () => {
    expect(estadoDeEntrega(sinAprobar).explicacion).toContain("Volvé a guardarlo desde el artículo");
  });
});

describe("aviso de orden", () => {
  const conNumero = (n, extra = {}) => ({ status: "PUBLISHED", seriesApproved: true, seriesOrder: n, ...extra });

  it("no avisa cuando cada entrega tiene su número", () => {
    expect(avisoDeOrden([conNumero(1), conNumero(2), conNumero(3)])).toBeNull();
  });

  it("no avisa con una sola entrega visible", () => {
    expect(avisoDeOrden([conNumero(null), borrador])).toBeNull();
  });

  it("detecta números repetidos, que cambian el orden sin decirlo", () => {
    const aviso = avisoDeOrden([conNumero(1), conNumero(1), conNumero(2)]);
    expect(aviso).toContain("número 1");
    expect(aviso).toContain("fecha de publicación");
  });

  it("detecta entregas sin número", () => {
    expect(avisoDeOrden([conNumero(1), conNumero(null)])).toContain("1 entrega no tiene");
  });

  it("ignora lo que no se ve: un borrador sin número no es un problema", () => {
    expect(avisoDeOrden([conNumero(1), conNumero(2), { ...borrador, seriesOrder: null }])).toBeNull();
  });
});

describe("aviso de renombrado", () => {
  it("no molesta cuando el slug no cambia", () => {
    expect(avisoDeRenombrado("La angustia y sus formas", "la angustia y sus FORMAS", { tienePaginaPublica: true })).toBeNull();
    expect(avisoDeRenombrado("Duelo", "Duelo ", { tienePaginaPublica: true })).toBeNull();
  });

  it("avisa cuando cambia la dirección, y muestra las dos", () => {
    const aviso = avisoDeRenombrado("La angustia y sus formas", "Las formas de la angustia", { tienePaginaPublica: true });
    expect(aviso).toContain("la-angustia-y-sus-formas");
    expect(aviso).toContain("las-formas-de-la-angustia");
    expect(aviso).toContain("no se redirige sola");
  });

  it("es más enfático si la página ya está publicada", () => {
    const publicado = avisoDeRenombrado("Duelo", "El duelo", { tienePaginaPublica: true, esVisible: true });
    expect(publicado).toContain("incluido el del hub");
    const inedito = avisoDeRenombrado("Duelo", "El duelo", { tienePaginaPublica: true, esVisible: false });
    expect(inedito).not.toContain("incluido el del hub");
  });

  it("no avisa para términos sin página propia, como las fases", () => {
    expect(avisoDeRenombrado("Fase uno", "Fase dos", { tienePaginaPublica: false })).toBeNull();
  });

  it("no avisa si el nombre nuevo no deja slug", () => {
    expect(avisoDeRenombrado("Duelo", "¿¿¿", { tienePaginaPublica: true })).toBeNull();
  });
});
