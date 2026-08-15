"use client";

// Recordatorio de las reglas al reservar la segunda cita con un profesional.
//
// Aparece una sola vez, en el momento en que la persona deja de estar probando y
// pasa a sostener un proceso. Es deliberadamente el único punto del flujo de
// reserva donde se habla de la política: repetirlo en cada cita lo convertiría
// en ruido, y no decirlo nunca es lo que hacía que la gente se enterara con el
// cobro puesto.
//
// El tono importa tanto como el contenido. No dice "si incumplís"; dice cómo
// mover la cita. La casilla no es un trámite legal —el consentimiento ya se dio
// al registrarse— sino la forma de asegurarse de que se leyó.

export default function RecordatorioSegundaCita({ checked, onChange }) {
  return (
    <div className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm text-brand-950">
      <div className="font-semibold">Segunda cita: acá empieza el proceso</div>

      <p className="mt-1 leading-relaxed">
        A partir de ahora este horario queda apartado para vos y no se le ofrece a nadie más. Si
        algo se atraviesa, <b>movelo desde tu panel con al menos 24 horas</b>: es gratis y no hace
        falta que expliqués nada.
      </p>
      <p className="mt-2 leading-relaxed">
        Con menos de 24 horas, o si no llegás, se cobra el 50% y tu agenda queda en pausa hasta que
        conversemos. La regla no busca penalizarte: busca que el compromiso sea real en las dos
        direcciones.
      </p>

      <label className="mt-3 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-400 text-brand-600 focus:ring-brand-400"
        />
        <span className="font-medium">Entiendo cómo mover mi cita si lo necesito.</span>
      </label>
    </div>
  );
}
