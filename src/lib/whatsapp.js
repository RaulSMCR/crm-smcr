// src/lib/whatsapp.js
//
// Enlaces wa.me con el mensaje ya escrito. No envían nada: abren el WhatsApp de
// quien toca el botón con el chat del paciente listo, y el envío lo hace esa
// persona. Por eso no tienen costo ni requieren la plataforma de Meta.

/**
 * El número tal como lo espera wa.me: solo dígitos, con código de país.
 * Costa Rica: 8 dígitos locales, se antepone el 506.
 */
export function numeroWhatsApp(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return null;
  return digitos.length === 8 ? `506${digitos}` : digitos;
}

/**
 * Enlace para mandarle al paciente el enlace de Meet de su sesión virtual. Sin
 * hora a propósito: el paciente puede estar en otra zona horaria y la hora tica
 * escrita a mano lo confundiría; el enlace es lo único que necesita.
 */
export function enlaceMeetPorWhatsApp({ telefono, nombre, meetLink }) {
  const numero = numeroWhatsApp(telefono);
  if (!numero || !meetLink) return null;
  const primerNombre = String(nombre || "").trim().split(/\s+/)[0];
  const saludo = primerNombre ? `Hola ${primerNombre}` : "Hola";
  const texto = `${saludo}, este es el enlace para nuestra sesión: ${meetLink}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
