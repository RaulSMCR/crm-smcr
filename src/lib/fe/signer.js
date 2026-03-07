// src/lib/fe/signer.js
// Firma digital XAdES-BES envelopada para la Factura Electrónica de Hacienda CR.
// Implementación con node-forge (RSA-SHA256).

import { createHash } from "crypto";

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

/** Formatea Date como YYYY-MM-DDTHH:mm:ss-06:00 */
function crDateTime(date) {
  const d   = date instanceof Date ? date : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-06:00`
  );
}

// ─── Firma principal ──────────────────────────────────────────────────────────

/**
 * Firma el XML con XAdES-BES envelopada.
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
  const certDigest = sha256b64(Buffer.from(certDer, "binary"));

  // 4. Hora de firma (Costa Rica)
  const signingTime = crDateTime();

  // ── Elementos XAdES ──────────────────────────────────────────────────────

  // 5. KeyInfo (sin namespaces redundantes)
  const keyInfoXml =
    `<ds:KeyInfo Id="KeyInfo">` +
      `<ds:X509Data>` +
        `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
      `</ds:X509Data>` +
    `</ds:KeyInfo>`;

  // 6. SignedProperties
  const signedPropsXml =
    `<xades:SignedProperties Id="SignedProperties">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        `<xades:SigningCertificateV2>` +
          `<xades:Cert>` +
            `<xades:CertDigest>` +
              `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
              `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
            `</xades:CertDigest>` +
          `</xades:Cert>` +
        `</xades:SigningCertificateV2>` +
      `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`;

  // 7. Calcular digests
  const docDigest         = sha256b64(xmlString);
  const keyInfoDigest     = sha256b64(keyInfoXml);
  const signedPropsDigest = sha256b64(signedPropsXml);

  // 8. SignedInfo (canónico — se firma RSA-SHA256)
  const signedInfoXml =
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
      `<ds:Reference Id="RefKeyInfo" URI="#KeyInfo">` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${keyInfoDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference Id="RefProps" ` +
        `Type="http://uri.etsi.org/01903#SignedProperties" URI="#SignedProperties">` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`;

  // 9. Firmar SignedInfo con RSA-SHA256
  const md = forge.md.sha256.create();
  md.update(signedInfoXml, "utf8");
  const signatureBytes = privateKey.sign(md);
  const signatureValue = forge.util.encode64(signatureBytes);

  // 10. Ensamblar bloque Signature completo
  const signatureBlock =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ` +
               `xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="Signature">` +
      signedInfoXml +
      `<ds:SignatureValue Id="SigValue">${signatureValue}</ds:SignatureValue>` +
      keyInfoXml +
      `<ds:Object>` +
        `<xades:QualifyingProperties Target="#Signature">` +
          signedPropsXml +
        `</xades:QualifyingProperties>` +
      `</ds:Object>` +
    `</ds:Signature>`;

  // 11. Insertar antes del tag de cierre raíz
  const lastClose = xmlString.lastIndexOf("</");
  if (lastClose === -1) {
    throw new Error("[FE Signer] XML inválido: no se encontró tag de cierre raíz");
  }
  const signed = xmlString.slice(0, lastClose) + signatureBlock + xmlString.slice(lastClose);
  return signed;
}
