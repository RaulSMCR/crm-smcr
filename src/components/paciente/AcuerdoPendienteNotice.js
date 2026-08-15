import Link from "next/link";

// Invitación a repasar el acuerdo, en el panel del paciente.
//
// Aparece después de un aviso tardío o de una ausencia, y es el otro candado
// —además de la pausa de agenda— que hay que resolver para volver a reservar.
//
// No enumera lo que la persona hizo mal ni le recuerda el monto: eso ya lo sabe,
// y repetírselo solo agrega vergüenza a alguien que probablemente está a un paso
// de abandonar el proceso. Lo que se le ofrece es entender la regla, no
// escucharla otra vez.

export default function AcuerdoPendienteNotice({ titulo, cuerpo, accion }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-brand-300 bg-brand-50 p-5 text-brand-950"
    >
      <h2 className="font-semibold">{titulo}</h2>
      <p className="mt-1 text-sm leading-relaxed">{cuerpo}</p>

      <Link
        href="/terminos?revisar=1#acuerdo"
        className="mt-3 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
      >
        {accion}
      </Link>

      <p className="mt-2 text-xs text-brand-800">Son dos minutos de lectura.</p>
    </div>
  );
}
