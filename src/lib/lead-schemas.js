// Validación de leads de marketing (formularios públicos de contacto).
// Mismo idiom que financial-schemas: safeParse en el consumidor + mensaje
// del primer issue para el usuario.
import { z } from "zod";

// RFC 5322 simplificado — el mismo patrón que usa contact-faq.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const optionalShort = (max) => z.string().trim().max(max).optional();

export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre es demasiado corto.")
    .max(120, "El nombre es demasiado largo."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "El correo es demasiado largo.")
    .regex(EMAIL_RE, "El correo electrónico no tiene un formato válido."),
  phone: optionalShort(32),
  subject: optionalShort(160),
  message: z
    .string()
    .trim()
    .min(10, "El mensaje es demasiado corto (mínimo 10 caracteres).")
    .max(4000, "El mensaje es demasiado largo (máximo 4000 caracteres)."),
  // El canal WHATSAPP existe en la DB pero aún no tiene superficie pública.
  channel: z.enum(["CONTACT_FORM", "FAQ_FORM"], { message: "Canal inválido." }).default("CONTACT_FORM"),
  // Atribución opcional capturada en el cliente
  utmSource: optionalShort(120),
  utmMedium: optionalShort(120),
  utmCampaign: optionalShort(160),
  utmTerm: optionalShort(160),
  utmContent: optionalShort(160),
  referrer: optionalShort(200),
  landingPath: optionalShort(500),
});

export { firstIssueMessage, validationMessage } from "./financial-schemas";
