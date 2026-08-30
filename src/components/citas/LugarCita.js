// src/components/citas/LugarCita.js
//
// Dónde es la cita, para todas las pantallas donde el paciente la ve.
//
// Es un componente y no tres copias del mismo JSX porque el dato tiene que
// aparecer igual en la agenda, en el panel y en el resumen: si en una pantalla
// aparece la dirección y en otra solo el rótulo del lugar, la persona no sabe
// cuál creer.

import { detalleLugarCita } from "@/lib/lugar-cita";

export default function LugarCita({ cita, compacto = false }) {
  // La agenda de /mi trae el lugar ya resuelto por el serializador; el panel
  // pasa la cita cruda. Se aceptan las dos formas.
  const lugar = cita?.lugar ?? detalleLugarCita(cita);
  if (!lugar?.titulo && !lugar?.direccion && !lugar?.aviso) return null;

  const encabezado = [lugar.titulo, lugar.modalidad ? `(${lugar.modalidad})` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={compacto ? "mt-1 text-xs" : "mt-2 text-sm"}>
      {encabezado ? <p className="font-medium text-neutral-800">{encabezado}</p> : null}
      {lugar.direccion ? <p className="text-neutral-700">{lugar.direccion}</p> : null}
      {lugar.comoLlegar ? <p className="text-neutral-500">{lugar.comoLlegar}</p> : null}
      {lugar.aviso ? <p className="mt-1 text-neutral-500">{lugar.aviso}</p> : null}
    </div>
  );
}
