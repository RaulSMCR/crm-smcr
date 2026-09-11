import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

/** La configuración se exige al recibir solicitudes, no al compilar la ruta. */
export function withQstashSignature(handler) {
  return async (request, params) => {
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY && !process.env.QSTASH_NEXT_SIGNING_KEY && !process.env.QSTASH_REGION) {
      return Response.json({ ok: false }, { status: 503 });
    }

    try {
      return await verifySignatureAppRouter(handler)(request, params);
    } catch (error) {
      // El SDK lanza SignatureError para firmas inválidas o cuerpos alterados.
      if (error?.name === "SignatureError") return Response.json({ ok: false }, { status: 403 });
      throw error;
    }
  };
}
