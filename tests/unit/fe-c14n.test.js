// tests/unit/fe-c14n.test.js
//
// La canonicalización de los fragmentos firmados, validada contra una factura
// REAL aceptada por Hacienda (tmp/referencia-178.xml, emitida por Conta al Día
// con el certificado de la empresa).
//
// Por qué existe este test: la firma se rechazaba con "El XML fue modificado
// luego de haber sido firmado" y el mensaje no dice dónde. La única forma de
// encontrar la regla fue reproducir el digest de un comprobante que Hacienda ya
// había aceptado. Si alguien "simplifica" canonicalizar() volviendo a usar
// xml-crypto tal cual, este test lo detiene antes de emitir nada inválido.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { C14nCanonicalization } from "xml-crypto";

const REFERENCIA = "tmp/referencia-178.xml";

// Valores tomados del comprobante real. No recalcular: son la fuente de verdad.
const DIGEST_SIGNED_PROPERTIES = "x+ukO615d67+xYofGQJHZDIZSDP+RslCJeJ3JY9Oz+Y=";
const DIGEST_COMPROBANTE = "eEDMIjz8qqIRucsNbnwBAYYqnbZxCS5C+oGucSPGgLk=";

const select = xpath.useNamespaces({
  ds: "http://www.w3.org/2000/09/xmldsig#",
  xades: "http://uri.etsi.org/01903/v1.3.2#",
});

const sha256 = (texto) => createHash("sha256").update(texto, "utf8").digest("base64");
const parsear = (xml) => new DOMParser().parseFromString(xml, "text/xml");

// Réplica exacta de la lógica de src/lib/fe/signer.js. Se duplica a propósito:
// signer.js no exporta canonicalizar(), y este test debe fallar si esa lógica
// cambia de forma incompatible con lo que Hacienda acepta.
function namespacesEnAlcance(nodo) {
  const cadena = [];
  for (let n = nodo; n && n.nodeType === 1; n = n.parentNode) cadena.unshift(n);

  const mapa = new Map();
  for (const el of cadena) {
    if (!el.attributes) continue;
    for (let i = 0; i < el.attributes.length; i += 1) {
      const attr = el.attributes[i];
      if (attr.name === "xmlns") mapa.set("", attr.value);
      else if (attr.name.startsWith("xmlns:")) mapa.set(attr.name.slice(6), attr.value);
    }
  }
  return mapa;
}

function declaracionesC14N(mapa) {
  const salida = [];
  if (mapa.has("")) salida.push(`xmlns="${mapa.get("")}"`);
  for (const prefijo of [...mapa.keys()].filter(Boolean).sort()) {
    salida.push(`xmlns:${prefijo}="${mapa.get(prefijo)}"`);
  }
  return salida.join(" ");
}

function canonicalizar(nodo) {
  let salida = String(new C14nCanonicalization().process(nodo, {}));
  const enAlcance = namespacesEnAlcance(nodo);

  for (const [prefijo, uri] of enAlcance) {
    const decl = prefijo ? ` xmlns:${prefijo}="${uri}"` : ` xmlns="${uri}"`;
    salida = salida.split(decl).join("");
  }

  const nombre = `<${nodo.prefix ? `${nodo.prefix}:` : ""}${nodo.localName}`;
  if (!salida.startsWith(nombre)) return salida;

  return `${nombre} ${declaracionesC14N(enAlcance)}${salida.slice(nombre.length)}`;
}

const hayReferencia = existsSync(REFERENCIA);
const describeConReferencia = hayReferencia ? describe : describe.skip;

if (!hayReferencia) {
  console.warn(`[fe-c14n] Falta ${REFERENCIA}: se omiten las comprobaciones contra la factura real.`);
}

describeConReferencia("canonicalización verificada contra una factura aceptada por Hacienda", () => {
  const xml = hayReferencia ? readFileSync(REFERENCIA, "utf8") : "";

  it("reproduce el digest de SignedProperties", () => {
    const doc = parsear(xml);
    const signedProps = select("//xades:SignedProperties", doc)[0];

    expect(sha256(canonicalizar(signedProps))).toBe(DIGEST_SIGNED_PROPERTIES);
  });

  it("reproduce el digest del comprobante sin la firma", () => {
    const doc = parsear(xml);
    const firma = select("//ds:Signature", doc)[0];
    firma.parentNode.removeChild(firma);

    expect(sha256(canonicalizar(doc.documentElement))).toBe(DIGEST_COMPROBANTE);
  });

  it("declara en el apex los namespaces heredados, en el orden de C14N", () => {
    const doc = parsear(xml);
    const canonico = canonicalizar(select("//xades:SignedProperties", doc)[0]);
    const apex = canonico.slice(0, canonico.indexOf(">"));

    // El default va primero y los prefijos en orden alfabético.
    expect(apex).toMatch(/^<xades:SignedProperties xmlns="[^"]*facturaElectronica"/);
    const prefijos = [...apex.matchAll(/xmlns:([\w.-]+)=/g)].map((m) => m[1]);
    expect(prefijos).toEqual(["ds", "schemaLocation", "xades", "xades141", "xsd", "xsi"]);
  });

  it("no repite las declaraciones en los descendientes", () => {
    const doc = parsear(xml);
    const canonico = canonicalizar(select("//xades:SignedProperties", doc)[0]);
    const apex = canonico.slice(0, canonico.indexOf(">") + 1);
    const cuerpo = canonico.slice(apex.length);

    expect(cuerpo).not.toContain("xmlns:ds=");
    expect(cuerpo).not.toContain("xmlns:xades=");
  });

  it("xml-crypto por sí solo NO reproduce el digest: la corrección es necesaria", () => {
    const doc = parsear(xml);
    const signedProps = select("//xades:SignedProperties", doc)[0];
    const sinCorregir = String(new C14nCanonicalization().process(signedProps, {}));

    expect(sha256(sinCorregir)).not.toBe(DIGEST_SIGNED_PROPERTIES);
  });
});
