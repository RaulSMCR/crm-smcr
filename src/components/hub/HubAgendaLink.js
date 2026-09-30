"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackHubClick } from "@/components/hub/HubTracker";

/**
 * El enlace a agendar desde el hub, que arrastra el identificador del clic.
 *
 * Por qué existe: la conversión que le importa a la campaña es la reserva
 * pagada, y para atribuirla hace falta el `gclid` que Google puso en la URL del
 * aterrizaje. Hasta ahora ese valor se guardaba en `localStorage` y de ahí lo
 * leía el formulario de reserva. Guardar un identificador publicitario en el
 * dispositivo necesita consentimiento; pasarlo de una URL a la siguiente,
 * dentro de la misma visita, no guarda nada en ninguna parte.
 *
 * Por qué en el clic y no al renderizar: estas páginas se sirven cacheadas una
 * hora (`revalidate = 3600`), así que el `href` del HTML es el mismo para todo
 * el mundo y no puede llevar el gclid de nadie. El valor se agrega en el
 * navegador, en el momento del clic, leyéndolo de la URL que el visitante tiene
 * delante.
 *
 * Qué NO cubre: si la persona vuelve otro día, la URL ya no trae el gclid y
 * este camino no lo recupera. Para eso sigue estando `localStorage`, que ahora
 * solo se escribe con consentimiento. O sea: con consentimiento la atribución
 * aguanta días; sin consentimiento aguanta la visita. Antes aguantaba días sin
 * preguntar, que es justamente el problema.
 */
export default function HubAgendaLink({ eventName, destination, onClick, href, ...props }) {
  const router = useRouter();

  function handleClick(event) {
    trackHubClick(eventName, destination || href);
    onClick?.(event);

    // `event.defaultPrevented`: si quien nos usa ya canceló la navegación, no
    // la reintroducimos por la puerta de atrás.
    if (event.defaultPrevented) return;

    let gclid = "";
    try {
      gclid = new URLSearchParams(window.location.search).get("gclid") || "";
    } catch {
      // Sin gclid se navega igual: la reserva nunca depende de la medición.
    }
    if (!gclid) return;

    event.preventDefault();
    const destino = new URL(href, window.location.origin);
    destino.searchParams.set("gclid", gclid);
    router.push(`${destino.pathname}${destino.search}`);
  }

  return <Link href={href} {...props} onClick={handleClick} />;
}
