// src/app/panel/admin/personal/[id]/contrato/page.js
//
// El contrato de un profesional, con sus datos ya sustituidos y listo para
// imprimir o guardar como PDF desde el navegador.
//
// Lo que se ve en pantalla y lo que sale impreso no son lo mismo a propósito:
// los avisos —lo que quedó en blanco, los defectos del machote— son para quien
// lo prepara, no para quien lo firma, y por eso van con `print:hidden`. Un
// documento legal no lleva impresas las notas internas de quien lo armó.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { construirContratoProfesional } from "@/lib/contratos/contrato-profesional";
import { datosEmpresaParaContrato } from "@/lib/contratos/empresa";
import ContratoAcciones from "@/components/admin/ContratoAcciones";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contrato del profesional" };

function Bloque({ bloque }) {
  switch (bloque.tipo) {
    case "titulo":
      return (
        <h1 className="mb-8 text-center text-lg font-bold uppercase tracking-wide text-slate-900">
          {bloque.texto}
        </h1>
      );
    case "seccion":
      return (
        <h2 className="mb-4 mt-8 text-center text-base font-bold uppercase tracking-wide text-slate-900">
          {bloque.texto}
        </h2>
      );
    case "clausula":
      return <h3 className="mb-2 mt-6 text-sm font-bold text-slate-900">{bloque.texto}</h3>;
    case "parrafo":
      return <p className="mb-3 text-justify text-sm leading-relaxed text-slate-800">{bloque.texto}</p>;
    case "lista":
      return (
        <ul className="mb-3 space-y-2 pl-6">
          {bloque.items.map((item) => (
            <li key={item} className="text-justify text-sm leading-relaxed text-slate-800">
              {item}
            </li>
          ))}
        </ul>
      );
    case "firma":
      return (
        <div className="mt-16 mb-8 flex flex-wrap justify-around gap-10 break-inside-avoid text-center">
          {[bloque.izquierda, bloque.derecha].map((rotulo) => (
            <div key={rotulo}>
              <div className="w-56 border-t border-slate-800 pt-2 text-xs font-semibold text-slate-800">
                {rotulo}
              </div>
            </div>
          ))}
        </div>
      );
    case "anexoFila":
      return (
        <div className="mb-0 grid break-inside-avoid grid-cols-1 border-b border-slate-300 sm:grid-cols-[14rem_1fr]">
          <div className="whitespace-pre-line border-slate-300 px-3 py-3 text-sm font-semibold text-slate-900 sm:border-r">
            {bloque.encabezado}
          </div>
          <div className="px-3 py-3">
            {bloque.lineas.map((linea, i) => (
              <p key={i} className="mb-2 text-justify text-sm leading-relaxed text-slate-800 last:mb-0">
                {linea}
              </p>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default async function ContratoProfesionalPage({ params }) {
  // Next 16: `params` es una promesa. Leerlo síncrono devuelve undefined y la
  // ruta responde 404 sin decir por qué.
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const profile = await prisma.professionalProfile.findUnique({
    where: { id },
    select: {
      id: true,
      specialty: true,
      academicDegree: true,
      domicilio: true,
      iban: true,
      user: { select: { name: true, email: true, identification: true } },
    },
  });

  if (!profile) notFound();

  const contrato = construirContratoProfesional({
    profesional: {
      nombre: profile.user?.name,
      grado: profile.academicDegree,
      identificacion: profile.user?.identification,
      email: profile.user?.email,
      especialidad: profile.specialty,
      domicilio: profile.domicilio,
      iban: profile.iban,
    },
    empresa: datosEmpresaParaContrato(),
    firma: { fecha: new Date(), lugar: "San José" },
  });

  const anexo = contrato.bloques.filter((b) => b.tipo === "anexoFila");
  const cuerpo = contrato.bloques.filter((b) => b.tipo !== "anexoFila");

  return (
    <div className="mx-auto max-w-4xl p-8 print:p-0">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Contrato de {profile.user?.name || "profesional"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Machote {contrato.version}, tomado de {contrato.fuente}. Revise lo que quedó en blanco
            antes de imprimir.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/panel/admin/personal"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
          >
            Volver a Personal
          </Link>
          <ContratoAcciones />
        </div>
      </div>

      {contrato.pendientes.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 print:hidden">
          <h2 className="text-base font-semibold text-amber-900">
            Falta completar a mano ({contrato.pendientes.length})
          </h2>
          <p className="mt-1 text-xs text-amber-900">
            El sistema no inventa estos datos: salen como línea en blanco en el documento impreso.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {contrato.pendientes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-8 rounded-2xl border border-rose-300 bg-rose-50 p-5 print:hidden">
        <h2 className="text-base font-semibold text-rose-900">
          Defectos del machote, sin corregir
        </h2>
        <p className="mt-1 text-xs text-rose-900">
          Se transcribe el contrato tal como está. Corregir un documento legal por software y sin
          asesoría jurídica no es una opción; esto es para que nadie firme sin saberlo.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-900">
          {contrato.defectosConocidos.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-10 print:rounded-none print:border-0 print:p-0">
        {cuerpo.map((bloque, i) => (
          <Bloque key={i} bloque={bloque} />
        ))}

        <div className="mt-4 border-t border-slate-300">
          {anexo.map((bloque, i) => (
            <Bloque key={i} bloque={bloque} />
          ))}
        </div>
      </article>
    </div>
  );
}
