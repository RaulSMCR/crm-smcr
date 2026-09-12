import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aplicarLote, hashDocumento } from "@/lib/hub-ingest";
import { revalidarHub } from "@/lib/hub-revalidate";
import { MAX_ARCHIVOS_LOTE, MAX_ARCHIVO_BYTES } from "@/lib/hub-markdown";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Aplica el lote. Exige el `sha256` que devolvió el preview y lo recalcula.
 *
 * Sin esa comprobación, entre ver el informe y confirmar podría cambiar el
 * contenido —otra pestaña, un archivo editado, un reintento— y se escribiría
 * algo que nadie revisó. No se guarda el lote entre las dos llamadas: no hay
 * dónde guardarlo en una función serverless, y un almacén temporal para esto
 * sería más estado del que el problema justifica.
 */
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado: se requiere rol ADMIN." }, { status: 403 });
  }

  const { id } = await params;

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Se esperaba JSON con { archivos: [{ nombre, texto, sha256 }] }." }, { status: 400 });
  }

  const archivos = Array.isArray(cuerpo?.archivos) ? cuerpo.archivos : [];
  if (!archivos.length) return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 422 });
  if (archivos.length > MAX_ARCHIVOS_LOTE) {
    return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS_LOTE} archivos por lote.` }, { status: 422 });
  }

  for (const archivo of archivos) {
    if (typeof archivo?.texto !== "string") {
      return NextResponse.json({ error: `«${archivo?.nombre || "sin nombre"}» llegó sin texto.` }, { status: 422 });
    }
    if (Buffer.byteLength(archivo.texto, "utf8") > MAX_ARCHIVO_BYTES) {
      return NextResponse.json({ error: `«${archivo.nombre}» pesa más de 2 MB.` }, { status: 413 });
    }
    if (!archivo.sha256) {
      return NextResponse.json({ error: `«${archivo.nombre}» llegó sin el sha256 del informe.` }, { status: 422 });
    }
    if (hashDocumento(archivo.texto) !== archivo.sha256) {
      return NextResponse.json(
        { error: `«${archivo.nombre}» cambió después del informe. Volvé a soltar los archivos para revisar las diferencias.` },
        { status: 409 },
      );
    }
  }

  try {
    const resultado = await aplicarLote({
      hubId: String(id || ""),
      archivos,
      actor: session.email || session.sub || "admin",
    });
    if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 404 });
    if (resultado.writesPerformed) revalidarHub(resultado.hub?.slug);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("ingesta de hub · confirm falló:", error);
    return NextResponse.json({ error: "No se pudo aplicar el lote." }, { status: 500 });
  }
}
