// src/lib/fe/signer.js
// Firma digital XAdES-EPES envelopada para la Factura Electrónica de Hacienda CR.
// Implementación con node-forge (RSA-SHA256).
//
// EPES y no BES: Hacienda exige que la firma declare la política de firma. Sin
// el bloque SignaturePolicyIdentifier el comprobante se rechaza con
// "La firma del documento no tiene el Policy Id".

import { createHash } from "crypto";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { C14nCanonicalization } from "xml-crypto";

// Política de firma de la resolución DGT-R-48-2016 para la versión 4.3.
const POLICY_URL =
  process.env.FE_POLICY_URL ||
  "https://tribunet.hacienda.go.cr/docs/esquemas/2016/v4.1/Resolucion_Comprobantes_Electronicos_DGT-R-48-2016.pdf";

// Digest SHA-256 de esa politica. Tomado del comprobante real aceptado por
// Hacienda (tmp/referencia-178.xml); Hacienda sirve el PDF detras de un 403 para
// clientes automatizados, asi que no se puede recalcular localmente. Si publican
// una politica nueva, se corrige con FE_POLICY_HASH sin tocar codigo.
const POLICY_HASH = process.env.FE_POLICY_HASH || "nVCrSwvK8dNnGHwfLYAzNAQMe5FCQjMl2Pf+Nfu5IBw=";

// node-forge usa CommonJS; lo importamos con dynamic import para compatibilidad ESM
let _forge = null;
async function getForge() {
  if (!_forge) {
    const mod = await import("node-forge");
    _forge = mod.default || mod;
  }
  return _forge;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256b64(data) {
  return createHash("sha256")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
    .digest("base64");
}

const SELECT = xpath.useNamespaces({
  ds: "http://www.w3.org/2000/09/xmldsig#",
  xades: "http://uri.etsi.org/01903/v1.3.2#",
});

/**
 * Namespaces en alcance para un nodo: se recorre desde la raiz hacia el nodo para
 * que una declaracion mas cercana pise a la heredada.
 */
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

/** Declaraciones en el orden que exige C14N: el default primero, luego prefijos alfabeticos. */
function declaracionesC14N(mapa) {
  const salida = [];
  if (mapa.has("")) salida.push(`xmlns="${mapa.get("")}"`);
  for (const prefijo of [...mapa.keys()].filter(Boolean).sort()) {
    salida.push(`xmlns:${prefijo}="${mapa.get(prefijo)}"`);
  }
  return salida.join(" ");
}

/**
 * Canonicaliza un fragmento con C14N inclusiva, corrigiendo a xml-crypto.
 *
 * Su implementacion se aparta del spec en dos puntos que rompen la firma:
 *   1. no vuelca en el apex los namespaces heredados de los ancestros, y
 *   2. redeclara el prefijo en cada descendiente que lo usa.
 *
 * Ambas cosas se verificaron contra una factura real aceptada por Hacienda
 * (tmp/referencia-178.xml): con esta correccion el digest reproduce exactamente
 * el que trae ese comprobante, y sin ella no coincide. Ver tests/unit/fe-c14n.test.js.
 */
function canonicalizar(nodo) {
  let salida = String(new C14nCanonicalization().process(nodo, {}));
  const enAlcance = namespacesEnAlcance(nodo);

  // Fuera las declaraciones que xml-crypto sembro en los descendientes. Solo se
  // quitan las identicas a una en alcance: si un hijo reasigna el prefijo a otra
  // URI, esa declaracion es significativa y debe quedarse.
  for (const [prefijo, uri] of enAlcance) {
    const decl = prefijo ? ` xmlns:${prefijo}="${uri}"` : ` xmlns="${uri}"`;
    salida = salida.split(decl).join("");
  }

  const nombre = `<${nodo.prefix ? `${nodo.prefix}:` : ""}${nodo.localName}`;
  if (!salida.startsWith(nombre)) return salida;

  return `${nombre} ${declaracionesC14N(enAlcance)}${salida.slice(nombre.length)}`;
}

function digestDeNodo(nodo) {
  return sha256b64(canonicalizar(nodo));
}

function parsear(xml) {
  return new DOMParser().parseFromString(xml, "text/xml");
}

/**
 * Formatea una fecha en la hora de Costa Rica con offset -06:00.
 *
 * NO se puede usar la hora local del servidor: en Vercel corre en UTC y en una
 * maquina de desarrollo puede estar en cualquier zona. Tomar los componentes
 * locales y pegarles "-06:00" produce un timestamp corrido tantas horas como
 * diferencia haya, y Hacienda lo rechaza con el error -53 ("La hora indicada en
 * la emision del archivo XML no coincide con la hora oficial").
 *
 * Costa Rica no aplica horario de verano, asi que el offset es siempre -06:00.
 */
function crDateTime(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const parte = (tipo) => partes.find((p) => p.type === tipo).value;

  return `${parte("year")}-${parte("month")}-${parte("day")}` +
    `T${parte("hour")}:${parte("minute")}:${parte("second")}-06:00`;
}

// ─── Firma principal ──────────────────────────────────────────────────────────

/**
 * Firma el XML con XAdES-EPES envelopada.
 * Inserta el bloque <ds:Signature> antes del elemento raíz de cierre.
 *
 * @param {string} xmlString  - XML sin firmar (headless, sin declaración XML)
 * @param {string} p12Base64  - .p12 en base64
 * @param {string} pin        - PIN del .p12
 * @returns {Promise<string>} - XML firmado
 */
export async function signXml(xmlString, p12Base64, pin) {
  const forge = await getForge();

  // 1. Cargar P12
  const p12Der  = forge.util.decode64(p12Base64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pin);

  // 2. Extraer certificado y llave privada
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

  const certBagArr = certBags[forge.pki.oids.certBag] || [];
  const keyBagArr  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];

  if (!certBagArr.length || !keyBagArr.length) {
    throw new Error("[FE Signer] No se encontró certificado o llave en el .p12");
  }

  const cert       = certBagArr[0].cert;
  const privateKey = keyBagArr[0].key;

  // 3. Certificado en DER → base64
  const certDer    = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);
  // XAdES v1 pide el digest del certificado en SHA-1, no SHA-256.
  const certDigest = createHash("sha1").update(Buffer.from(certDer, "binary")).digest("base64");

  // IssuerSerial es OBLIGATORIO dentro de xades:Cert cuando se usa
  // SigningCertificate (v1); en SigningCertificateV2 era opcional. Sin el, el
  // bloque XAdES es invalido y Hacienda ni siquiera llega a leer la politica:
  // responde "La firma del documento no tiene el Policy Id", que despista.
  //
  // El nombre del emisor va en orden inverso al DER y separado por coma+espacio,
  // y el serial en decimal (forge lo entrega en hexadecimal).
  const issuerName = cert.issuer.attributes
    .map(({ shortName, name, value }) => `${shortName || name}=${value}`)
    .reverse()
    .join(", ");
  const issuerSerial = BigInt(`0x${cert.serialNumber}`).toString(10);

  // 4. Hora de firma (Costa Rica)
  const signingTime = crDateTime();

  // ── Elementos XAdES ──────────────────────────────────────────────────────
  //
  // Los fragmentos se escriben SIN declaraciones de namespace: las heredan de
  // ds:Signature y la canonicalización se encarga de volcarlas donde corresponde.
  // Los digests NO se calculan sobre estos strings, sino sobre el resultado de
  // canonicalizar los nodos ya insertados en el documento (ver más abajo).

  // 5. KeyInfo
  const keyInfoXml =
    `<ds:KeyInfo Id="KeyInfo">` +
      `<ds:X509Data>` +
        `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
      `</ds:X509Data>` +
    `</ds:KeyInfo>`;

  // 6. SignedProperties
  // El orden de los hijos lo fija el esquema XAdES: SigningTime,
  // SigningCertificate y recién después SignaturePolicyIdentifier.
  const signedPropsXml =
    `<xades:SignedProperties Id="SignedProperties">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        `<xades:SigningCertificate>` +
          `<xades:Cert>` +
            `<xades:CertDigest>` +
              `<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
              `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
            `</xades:CertDigest>` +
            `<xades:IssuerSerial>` +
              `<ds:X509IssuerName>${issuerName}</ds:X509IssuerName>` +
              `<ds:X509SerialNumber>${issuerSerial}</ds:X509SerialNumber>` +
            `</xades:IssuerSerial>` +
          `</xades:Cert>` +
        `</xades:SigningCertificate>` +
        `<xades:SignaturePolicyIdentifier>` +
          `<xades:SignaturePolicyId>` +
            `<xades:SigPolicyId>` +
              `<xades:Identifier>${POLICY_URL}</xades:Identifier>` +
            `</xades:SigPolicyId>` +
            `<xades:SigPolicyHash>` +
              `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
              `<ds:DigestValue>${POLICY_HASH}</ds:DigestValue>` +
            `</xades:SigPolicyHash>` +
          `</xades:SignaturePolicyId>` +
        `</xades:SignaturePolicyIdentifier>` +
      `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`;

  // 7. Digest del comprobante.
  // La referencia URI="" con transformada enveloped se resuelve como "el
  // documento entero sin la firma", que es exactamente el XML original.
  const docDigest = digestDeNodo(parsear(xmlString).documentElement);

  // 8. Primera pasada: se arma la firma con digests provisorios solo para poder
  // insertar KeyInfo y SignedProperties en el árbol y canonicalizarlos EN SU
  // LUGAR, con los namespaces que realmente heredan.
  const armarFirma = (spDigest, sigValue) => {
    const signedInfo =
      `<ds:SignedInfo>` +
        `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
        `<ds:Reference Id="Ref0" URI="">` +
          `<ds:Transforms>` +
            `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
          `</ds:Transforms>` +
          `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
          `<ds:DigestValue>${docDigest}</ds:DigestValue>` +
        `</ds:Reference>` +
        `<ds:Reference Id="RefProps" ` +
          `Type="http://uri.etsi.org/01903#SignedProperties" URI="#SignedProperties">` +
          `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
          `<ds:DigestValue>${spDigest}</ds:DigestValue>` +
        `</ds:Reference>` +
      `</ds:SignedInfo>`;

    const bloque =
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ` +
                 `xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="Signature">` +
        signedInfo +
        `<ds:SignatureValue Id="SigValue">${sigValue}</ds:SignatureValue>` +
        keyInfoXml +
        `<ds:Object>` +
          `<xades:QualifyingProperties Target="#Signature">` +
            signedPropsXml +
          `</xades:QualifyingProperties>` +
        `</ds:Object>` +
      `</ds:Signature>`;

    const cierre = xmlString.lastIndexOf("</");
    if (cierre === -1) throw new Error("[FE Signer] XML inválido: no se encontró tag de cierre raíz");
    return xmlString.slice(0, cierre) + bloque + xmlString.slice(cierre);
  };

  const provisorio = parsear(armarFirma("", ""));
  const signedPropsDigest = digestDeNodo(SELECT("//xades:SignedProperties", provisorio)[0]);

  // 9. Segunda pasada: con los digests definitivos, se canonicaliza el SignedInfo
  // ya ubicado en el árbol y ESO es lo que se firma con RSA-SHA256.
  const conDigests = parsear(armarFirma(signedPropsDigest, ""));
  const signedInfoCanonico = canonicalizar(SELECT("//ds:SignedInfo", conDigests)[0]);

  const md = forge.md.sha256.create();
  md.update(signedInfoCanonico, "utf8");
  const signatureValue = forge.util.encode64(privateKey.sign(md));

  return armarFirma(signedPropsDigest, signatureValue);
}
