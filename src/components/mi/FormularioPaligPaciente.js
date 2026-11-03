"use client";

// La parte del paciente del formulario de reclamo de PALIG. Se entrega una sola
// vez: en cada sesión pagada, su profesional le manda el formulario completo,
// con la fecha y su firma, listo para presentar a PALIG.
//
// Dos caminos, a elección del paciente: llenarlo acá y firmar con el dedo, o
// subir la foto o el PDF del papel ya firmado. Ver /api/mi/seguro-palig.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";
import { ConElDedo } from "@/components/firma/CapturaDeFirma";
import { Card } from "@/components/mi/ui";

const CAMPO = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm";
const ETIQUETA = "block text-sm font-medium text-neutral-800";
const BOTON =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

const ETAPAS = {
  SIN_FORMULARIO: null,
  FALTA_PROFESIONAL: "Recibimos tu parte. Tu profesional completa la suya y, desde la próxima sesión pagada, te llega el formulario listo.",
  LISTO: "Tu formulario está listo. Con cada sesión pagada te llega por correo, con la fecha y la firma de tu profesional.",
};

function Opciones({ nombre, valor, onChange, opciones }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {opciones.map(([clave, etiqueta]) => (
        <label
          key={clave}
          className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm ${
            valor === clave ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-neutral-300 text-neutral-700"
          }`}
        >
          <input type="radio" name={nombre} value={clave} checked={valor === clave} onChange={() => onChange(clave)} className="sr-only" />
          {etiqueta}
        </label>
      ))}
    </div>
  );
}

function EnLinea({ precarga, anteriores, onEnviado }) {
  const { avisar } = useToast();
  const [datos, setDatos] = useState(() => ({
    empresa: "", poliza: "", certificado: "", sexo: "", parentesco: "titular", tipoDeReclamo: "enfermedad", inicioSintomas: "",
    ...precarga,
    ...(anteriores || {}),
  }));
  const [firma, setFirma] = useState(null);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (clave) => (e) => setDatos((d) => ({ ...d, [clave]: e.target.value }));
  const elegir = (clave) => (valor) => setDatos((d) => ({ ...d, [clave]: valor }));
  const alFirmar = useCallback((lienzo) => setFirma(lienzo), []);

  async function enviar() {
    setEnviando(true);
    try {
      const blob = await new Promise((resolve) => firma.toBlob(resolve, "image/png"));
      const form = new FormData();
      form.append("modo", "enLinea");
      form.append("datos", JSON.stringify(datos));
      form.append("firma", blob, "firma.png");
      const r = await fetch("/api/mi/seguro-palig", { method: "POST", body: form });
      const respuesta = await r.json().catch(() => ({}));
      if (!r.ok) {
        avisar(respuesta.message || "No se pudo guardar el formulario.", "error");
        return;
      }
      avisar("Listo: recibimos tu parte del formulario.", "success");
      onEnviado();
    } finally {
      setEnviando(false);
    }
  }

  const completo = datos.empresa?.trim() && datos.poliza?.trim() && datos.nombre?.trim() && firma && acepta;

  return (
    <div className="space-y-4">
      <label className={ETIQUETA}>
        Empresa contratante de la póliza
        <input value={datos.empresa} onChange={cambiar("empresa")} className={CAMPO} placeholder="La empresa donde trabajás, o tu nombre si la póliza es personal" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={ETIQUETA}>
          N.º de póliza
          <input value={datos.poliza} onChange={cambiar("poliza")} className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          N.º de certificado
          <input value={datos.certificado} onChange={cambiar("certificado")} className={CAMPO} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-neutral-500">Los dos números están en tu carné del seguro.</p>
      <label className={ETIQUETA}>
        Nombre completo del paciente
        <input value={datos.nombre} onChange={cambiar("nombre")} className={CAMPO} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={ETIQUETA}>
          Fecha de nacimiento
          <input type="date" value={datos.nacimiento} onChange={cambiar("nacimiento")} className={CAMPO} />
        </label>
        <div className={ETIQUETA}>
          Sexo
          <Opciones nombre="sexo" valor={datos.sexo} onChange={elegir("sexo")} opciones={[["F", "F"], ["M", "M"]]} />
        </div>
      </div>
      <div className={ETIQUETA}>
        El paciente es
        <Opciones
          nombre="parentesco"
          valor={datos.parentesco}
          onChange={elegir("parentesco")}
          opciones={[["titular", "Titular"], ["conyuge", "Cónyuge"], ["hijo", "Hijo o hija"]]}
        />
      </div>
      <div className={ETIQUETA}>
        Motivo del reclamo
        <Opciones
          nombre="tipoDeReclamo"
          valor={datos.tipoDeReclamo}
          onChange={elegir("tipoDeReclamo")}
          opciones={[["enfermedad", "Enfermedad"], ["accidente", "Accidente"], ["maternidad", "Maternidad"]]}
        />
      </div>
      <label className={ETIQUETA}>
        Fecha en que empezaron los síntomas (o del accidente), si la sabés
        <input type="date" value={datos.inicioSintomas} onChange={cambiar("inicioSintomas")} className={CAMPO} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={ETIQUETA}>
          Teléfono del titular
          <input type="tel" value={datos.telefono} onChange={cambiar("telefono")} className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          Correo del titular
          <input type="email" value={datos.correo} onChange={cambiar("correo")} className={CAMPO} />
        </label>
      </div>

      <div className="rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">
        Al firmar, declarás lo mismo que en el formulario en papel: que tus respuestas son correctas y verdaderas, y
        autorizás a Pan-American Life Insurance de Costa Rica a pedir y compartir tu información médica para tramitar el
        reclamo, según su{" "}
        <a href="https://www.palig.com/es/privacy-policy" target="_blank" rel="noreferrer" className="underline">
          política de privacidad
        </a>
        . Si el paciente es menor de edad, firma la persona responsable.
      </div>

      <div>
        <p className={ETIQUETA}>Firma (como en tu documento de identidad)</p>
        <ConElDedo onLista={alFirmar} />
      </div>

      <label className="flex items-start gap-2 text-sm text-neutral-800">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" />
        Leí la declaración y autorizo que mi firma vaya en los formularios de reclamo de mis sesiones.
      </label>

      <button type="button" onClick={enviar} disabled={!completo || enviando} className={`${BOTON} w-full bg-brand-600 text-white hover:bg-brand-500`}>
        {enviando ? "Guardando…" : "Entregar mi parte"}
      </button>
    </div>
  );
}

function DesdeArchivo({ onEnviado }) {
  const { avisar } = useToast();
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("modo", "archivo");
      form.append("archivo", archivo);
      const r = await fetch("/api/mi/seguro-palig", { method: "POST", body: form });
      const respuesta = await r.json().catch(() => ({}));
      if (!r.ok) {
        avisar(respuesta.message || "No se pudo guardar el formulario.", "error");
        return;
      }
      avisar("Listo: recibimos tu formulario.", "success");
      onEnviado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
        <li>
          Descargá el{" "}
          <a href="/forms/palig-cr-reclamo-2023.pdf" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
            formulario de PALIG
          </a>{" "}
          y llená solo la parte «A llenar por el asegurado».
        </li>
        <li>Firmalo donde dice «Firma del paciente».</li>
        <li>Sacale una foto a la hoja completa, de frente y con buena luz, o subilo en PDF.</li>
      </ol>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => setArchivo(e.target.files?.[0] || null)}
        className="block w-full text-sm"
      />
      <p className="text-xs text-neutral-500">Hasta 4 MB.</p>
      <button type="button" onClick={enviar} disabled={!archivo || enviando} className={`${BOTON} w-full bg-brand-600 text-white hover:bg-brand-500`}>
        {enviando ? "Subiendo…" : "Entregar el formulario"}
      </button>
    </div>
  );
}

export default function FormularioPaligPaciente() {
  const [estado, setEstado] = useState(null);
  const [modo, setModo] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/mi/seguro-palig", { cache: "no-store" });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.message);
      setEstado(datos);
      setModo(null);
    } catch (e) {
      setError(e?.message || "No se pudo cargar tu formulario.");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) return <Card><p className="text-sm text-accent-800">{error}</p></Card>;
  if (!estado) return <p className="text-sm text-neutral-500">Cargando…</p>;

  const aviso = ETAPAS[estado.etapa];

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-neutral-700">
          Si tu seguro es PALIG, entregá tu parte del formulario de reclamo <strong>una sola vez</strong>. Después, con
          cada sesión pagada, te llega por correo el formulario completo —con la fecha y la firma de tu profesional— y la
          factura, listos para presentar a PALIG.{" "}
          <Link href="/ayuda/seguros" className="font-semibold text-brand-700 underline">
            Cómo funciona
          </Link>
        </p>
        {aviso ? <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-900">{aviso}</p> : null}
      </Card>

      {modo === null ? (
        <div className="space-y-2">
          <button type="button" onClick={() => setModo("enLinea")} className={`${BOTON} w-full bg-brand-600 text-white hover:bg-brand-500`}>
            {estado.etapa === "SIN_FORMULARIO" ? "Llenarlo acá y firmar con el dedo" : "Corregir mis datos"}
          </button>
          <button
            type="button"
            onClick={() => setModo("archivo")}
            className={`${BOTON} w-full border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}
          >
            Prefiero subir la foto del papel firmado
          </button>
        </div>
      ) : (
        <Card>
          {modo === "enLinea" ? (
            <EnLinea precarga={estado.precarga} anteriores={estado.datos} onEnviado={cargar} />
          ) : (
            <DesdeArchivo onEnviado={cargar} />
          )}
          <button type="button" onClick={() => setModo(null)} className="mt-3 text-sm text-neutral-500 underline">
            Volver
          </button>
        </Card>
      )}
    </div>
  );
}
