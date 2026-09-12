import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { leerLote } from "@/lib/hub-ingest";
import { MAX_ARCHIVOS_LOTE, MAX_ARCHIVO_BYTES } from "@/lib/hub-markdown";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Informe de lo que haría importar estos archivos. **No escribe nada.**
 *
 * Recibe el texto de cada archivo en JSON, no el archivo en `multipart`: el
 * navegador ya lo lee con `file.text()` para mostrarlo, así que mandar bytes
 * sería mandarlo dos veces. Devuelve el `sha256` de cada uno, que es lo que el
 * confirm exige después para garantizar que aplica lo mismo que se mostró.
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
    return NextResponse.json({ error: "Se esperaba JSON con { archivos: [{ nombre, texto }] }." }, { status: 400 });
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
  }

  try {
    const informe = await leerLote({ hubId: String(id || ""), archivos });
    if (informe.error) return NextResponse.json({ error: informe.error }, { status: 404 });
    return NextResponse.json({ ok: true, writesPerformed: false, confirmationRequired: true, ...informe });
  } catch (error) {
    console.error("ingesta de hub · preview falló:", error);
    return NextResponse.json({ error: "No se pudo leer el lote." }, { status: 500 });
  }
}
