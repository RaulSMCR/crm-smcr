"use client";

// src/components/ui/useAccionServidor.js
//
// Una sola forma de llamar a una server action desde la interfaz.
//
// El patrón que había repetido en unos sesenta componentes era éste:
//
//     startTransition(async () => {
//       const res = await miAccion(...);
//       if (res?.error) setError(res.error);
//       else router.refresh();
//     });
//
// y tiene un agujero: las acciones no solo devuelven `{ error }`, también
// **lanzan**. `requireAdmin` lanza cuando la sesión no es de admin, Prisma lanza
// cuando la base no responde, y Next lanza cuando la acción no se pudo entregar.
// En todos esos casos la promesa queda rechazada dentro del `startTransition`:
// no hay error en pantalla, no hay refresco, y quien hizo clic no tiene forma de
// saber que no pasó nada. Fue exactamente lo que ocurrió al crear una serie en
// el panel de taxonomía.
//
// Acá el try/catch no es opcional, el aviso tampoco, y el refresco solo ocurre
// cuando la acción efectivamente salió bien.

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

const ERROR_GENERICO = "No se pudo completar la acción. Volvé a intentarlo.";

/**
 * @returns {{
 *   pendiente: boolean,
 *   ejecutar: (fn: () => Promise<any>, opciones?: {
 *     exito?: string,            // mensaje del toast al salir bien
 *     refrescar?: boolean,       // router.refresh() tras el éxito (por defecto sí)
 *     alTerminar?: (res: any) => void,   // se corre solo si salió bien
 *     alFallar?: (mensaje: string) => void,
 *   }) => void,
 * }}
 */
export function useAccionServidor() {
  const router = useRouter();
  const { avisar } = useToast();
  const [pendiente, start] = useTransition();

  const ejecutar = useCallback((fn, opciones = {}) => {
    const { exito, refrescar = true, alTerminar, alFallar } = opciones;

    start(async () => {
      let res;
      try {
        res = await fn();
      } catch (error) {
        // El mensaje de una acción que lanza en producción suele venir
        // ofuscado por Next; si no dice nada útil, al menos que diga algo.
        const mensaje = String(error?.message || "").trim() || ERROR_GENERICO;
        avisar(mensaje, "error");
        alFallar?.(mensaje);
        return;
      }

      if (res?.error) {
        avisar(res.error, "error");
        alFallar?.(res.error);
        return;
      }

      // `exito` acepta una función porque muchos avisos útiles solo se pueden
      // escribir con lo que devolvió la acción: «Tipo de cambio guardado: ₡X».
      const mensaje = typeof exito === "function" ? exito(res) : exito;
      if (mensaje) avisar(mensaje, "success");
      alTerminar?.(res);
      if (refrescar) router.refresh();
    });
  }, [avisar, router]);

  return { pendiente, ejecutar };
}

export default useAccionServidor;
