import HubAgendaLink from "@/components/hub/HubAgendaLink";
import HubWhatsappLink from "@/components/hub/HubWhatsappLink";

/**
 * Barra fija de acciones en móvil, para cualquier página del hub.
 *
 * Estaba solo en la portada, y el anuncio de la campaña no aterriza en la
 * portada sino en un tema: en un teléfono la acción quedaba arriba y
 * desaparecía al primer scroll. Ahora la llevan también los temas y la página
 * del formato de 15 sesiones.
 *
 * Es un componente y no JSX repetido en tres páginas porque el texto del enlace
 * a WhatsApp es el que declara que la consulta es paga: tiene que decir lo mismo
 * en las tres, y eso se garantiza teniéndolo escrito una sola vez.
 */
export default function HubMobileActions({
  agendaUrl,
  waUrl,
  tema = "",
  agendaEnabled = true,
  whatsappEnabled = true,
}) {
  if (!agendaEnabled && !whatsappEnabled) return null;

  return (
    <div className="hub-mobile-actions md:hidden">
      {agendaEnabled ? (
        <HubAgendaLink
          href={agendaUrl}
          eventName="click_hub_raul_agendar_mobile"
          destination="agenda-mobile"
          className="btn btn-accent w-full"
        >
          Agendar
        </HubAgendaLink>
      ) : null}
      {whatsappEnabled ? (
        <HubWhatsappLink
          href={waUrl}
          ubicacion="barra_movil"
          tema={tema}
          className="text-center text-sm font-bold text-nv-cream-hi underline decoration-nv-coral underline-offset-4"
        >
          o escribí para agendar tu sesión paga
        </HubWhatsappLink>
      ) : null}
    </div>
  );
}
