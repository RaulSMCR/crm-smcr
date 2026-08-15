import ConfirmarAcuerdo from "@/components/terminos/ConfirmarAcuerdo";

// El orden de esta página es una decisión, no una casualidad.
//
// Antes la política de reservas vivía al final, después del muro de privacidad,
// para no enmarcar el vínculo terapéutico en sanciones. El efecto real fue otro:
// se cobraban multas y se pausaban agendas sin que nadie la hubiera leído. Ahora
// va primero, escrita como se explica un encuadre y no como se recita un
// reglamento. Lo legal sigue completo, debajo.

export const metadata = {
  title: "Acuerdo de atención y privacidad",
  description:
    "Cómo funciona tu espacio, cómo se cobra, qué pasa si necesitás mover una cita y cómo se cuida tu información.",
};

const PRIVACIDAD = `Política de Privacidad y Tratamiento de Datos Sensibles - Salud Mental Costa Rica
[Salud Mental Costa Rica / Nombre Legal de la Empresa] (en adelante, "la Empresa") se compromete a proteger su privacidad. Esta Política describe cómo recopilamos, utilizamos y protegemos sus datos personales, en cumplimiento estricto con la Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley N.º 8968) y su Reglamento en la República de Costa Rica.

1. Responsable del Tratamiento de Datos
Identidad: [Nombre Legal de la Empresa, Cédula Jurídica]

Domicilio: [Dirección física en Costa Rica]

Contacto de Privacidad: [Correo electrónico designado para consultas de privacidad, ej: privacidad@saludmentalcostarica.com]

2. Categorías de Datos Recopilados
La Plataforma recopila las siguientes categorías de información con los fines específicos detallados a continuación:

2.1. Datos de Identificación y Contacto
Ejemplos: Nombre completo, dirección de correo electrónico, número de teléfono, país de residencia, fecha de nacimiento.

Propósito: Creación y gestión del perfil de usuario, comunicación de cambios en el servicio, envío de newsletters (si el Usuario lo consiente) y gestión de las citas.

2.2. Datos Transaccionales y de Conexión
Ejemplos: Historial de citas agendadas, direcciones IP, datos de navegación, tipo de dispositivo, cookies (ver Política de Cookies separada).

Propósito: Optimización técnica de la Plataforma, seguridad del sistema, y análisis estadístico interno sobre el uso de los servicios.

2.3. Datos Sensibles (Específicos del CRM y Citas)
De conformidad con el Artículo 3.c y Artículo 9 de la Ley 8968, se consideran "Datos Sensibles" aquellos relativos al estado de salud.

Ejemplos: El "Motivo de Consulta" ingresado al agendar una cita, el historial de asistencia a citas, y cualquier información de salud que el Usuario decida compartir a través de los formularios o chats del CRM con los Profesionales.

Propósito: Exclusivamente para permitir al Usuario concertar y gestionar sus citas con el Profesional elegido y facilitar al Profesional la información mínima necesaria para la atención inicial.

3. Consentimiento Expreso para Datos Sensibles (Art. 9, Ley 8968)
El tratamiento de sus Datos Sensibles requiere un nivel de consentimiento superior al de los datos ordinarios.

Mecanismo de Consentimiento: Al crear su perfil y, de manera particular, al completar el campo "Motivo de Consulta" o al utilizar el módulo de agendamiento, el Usuario deberá marcar una casilla de forma inequívoca que indique:

"He leído y acepto el Acuerdo de Atención y la Política de Privacidad, y otorgo mi consentimiento informado y expreso para el tratamiento de mis datos personales de salud (Datos Sensibles) por parte de Salud Mental Costa Rica, con el fin de gestionar mi conexión con el profesional de la salud mental y el seguimiento clínico de mi proceso."

Revocación: El Usuario tiene el derecho de revocar este consentimiento en cualquier momento, lo cual puede conllevar la imposibilidad de seguir utilizando la función de agendamiento, sin afectar la legalidad del tratamiento realizado previamente a la revocación.

4. Comunicación de Datos Personales a Terceros
La Empresa solo comunicará sus datos en los siguientes casos:

A Profesionales: Los datos de contacto, identificación y el Motivo de Consulta son transferidos al Profesional con el que el Usuario decide agendar la cita. Esta transferencia es esencial para la prestación del servicio que usted solicita.

A la Dirección Clínica: Las notas de apertura y de cierre del proceso de atención son accesibles para la Dirección Clínica de la Empresa, profesional colegiado activo, con el fin exclusivo de supervisar las altas y las bajas. Este acceso constituye un límite del secreto profesional declarado de forma previa y expresa, conforme al Código de Ética y Deontológico del Colegio de Profesionales en Psicología de Costa Rica, y queda registrado en la bitácora de cada expediente.

Por Obligación Legal: Cuando sea requerido por orden judicial o administrativa de la PRODHAB u otra autoridad competente.

Proveedores de Servicios (Encargados de Tratamiento): Se compartirán datos mínimos con plataformas de hosting, análisis web o pasarelas de pago, siempre y cuando estos proveedores ofrezcan garantías suficientes de seguridad y se rijan bajo un contrato que les obligue a tratar los datos según las directrices de la Ley 8968.

Nota: La Plataforma no vende, alquila ni intercambia sus Datos Sensibles con terceros con fines de marketing o publicidad.

5. Medidas de Seguridad de la Información
La Empresa implementa medidas técnicas y organizativas rigurosas para proteger los datos personales del acceso no autorizado, alteración, pérdida o destrucción, conforme a los principios de seguridad de la Ley 8968.

Medidas Específicas: Incluyen cifrado de datos sensibles (cifrado SSL en la transmisión y cifrado en el almacenamiento), control de acceso estricto a la base de datos y copias de seguridad periódicas.

6. Derechos del Usuario (Derechos ARCO)
Usted puede ejercer sus derechos frente al responsable del tratamiento de datos, según lo establecido en el Artículo 5 de la Ley 8968:

Acceso: Solicitar la información sobre si sus datos están siendo tratados y, en su caso, acceder a ellos.

Rectificación: Solicitar la corrección de datos inexactos o incompletos.

Cancelación (Supresión): Solicitar la eliminación de sus datos cuando ya no sean necesarios para los fines que fueron recogidos.

Oposición: Oponerse al tratamiento de sus datos por motivos legítimos y fundados, a excepción de los casos de obligación legal.

Para ejercer cualquiera de estos derechos, el Usuario debe enviar una solicitud clara y firmada, adjuntando una copia de su cédula de identidad, al correo electrónico de privacidad indicado en la Sección 1.

7. Plazo de Conservación de los Datos
Sus datos personales serán conservados por el tiempo necesario para cumplir con los fines descritos en esta política y para cumplir con cualquier obligación legal (por ejemplo, fiscales o de auditoría). Una vez que los datos dejen de ser útiles, serán eliminados o anonimizados de forma segura.

Excepción — expedientes clínicos: los registros de apertura y cierre del proceso de atención se conservan por un mínimo de diez (10) años a partir de la conclusión del servicio, conforme a los artículos 21 y 22 del Código de Ética y Deontológico del Colegio de Profesionales en Psicología de Costa Rica. Durante ese plazo no pueden eliminarse, ni siquiera a solicitud de la persona usuaria; sí puede solicitarse copia de ellos en cualquier momento, conforme a la Ley N.º 8239.`;

export default function Terminos() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-bold text-brand-700">Acuerdo de atención</h1>
      <p className="mt-3 text-neutral-700">
        Esto no es letra chica. Es el encuadre de tu proceso: cómo se sostiene tu espacio, qué
        pasa si algo se atraviesa y cómo se cuida lo que contás.
      </p>

      {/* Lo esencial, arriba del todo. Quien no lea nada más, que lea esto. */}
      <section
        aria-labelledby="resumen"
        className="mt-8 rounded-2xl border border-brand-200 bg-brand-50 p-6"
      >
        <h2 id="resumen" className="text-xs font-bold uppercase tracking-widest text-brand-700">
          En 30 segundos
        </h2>
        <ul className="mt-4 space-y-3 text-brand-950">
          <li className="flex gap-3">
            <span aria-hidden="true" className="font-bold text-brand-600">
              1.
            </span>
            <span>
              El precio que ves es el precio final. Se congela cuando reservás y no cambia después.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="font-bold text-brand-600">
              2.
            </span>
            <span>
              Podés mover tu cita desde tu panel avisando con{" "}
              <b>al menos 24 horas</b>. Es gratis y no hace falta explicar nada.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="font-bold text-brand-600">
              3.
            </span>
            <span>
              Con menos de 24 horas, o si no llegás, se cobra el <b>50%</b> y tu agenda queda en
              pausa hasta que conversemos. No es una expulsión: es una conversación pendiente.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="font-bold text-brand-600">
              4.
            </span>
            <span>
              Tu proceso lo lleva un profesional dentro de un equipo con dirección clínica, que
              revisa las altas y las bajas.
            </span>
          </li>
        </ul>
      </section>

      <section id="acuerdo" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-bold text-brand-700">Tu espacio y tu compromiso</h2>

        <h3 className="mt-6 font-bold text-neutral-900">Lo que ves es lo que pagás</h3>
        <p className="mt-2 leading-relaxed">
          El precio que ves publicado es el precio final: ya incluye el impuesto y el costo de la
          pasarela de pago. No se te suma nada encima. El precio se congela en el momento en que
          reservás, así que si el profesional actualiza su tarifa después, tu cita mantiene el
          valor que aceptaste.
        </p>
        <p className="mt-3 leading-relaxed">
          En la <b>primera cita con cada profesional</b> se cobra el 50% por adelantado para
          reservar el espacio, y el 50% restante al concluir la consulta. En las citas siguientes
          con ese mismo profesional se cobra el total al terminar. En ambos casos recibís el enlace
          de pago por correo.
        </p>

        <h3 className="mt-6 font-bold text-neutral-900">Si algo se atraviesa, movela</h3>
        <p className="mt-2 leading-relaxed">
          Podés reprogramarla avisando con <b>al menos 24 horas</b> de anticipación, desde tu panel,
          sin ningún costo. No tenés que dar explicaciones ni pedir permiso: la vida pasa, y mover
          una cita a tiempo es parte de sostener un proceso, no una falta.
        </p>
        <p className="mt-3 leading-relaxed">
          Con menos de 24 horas, o si no asistís, se cobra el <b>50% del valor de la cita</b>. Si ya
          habías pagado el adelanto, ese monto cubre el cargo y no se te cobra nada adicional.
        </p>

        <h3 className="mt-6 font-bold text-neutral-900">Por qué existe esta regla</h3>
        <p className="mt-2 leading-relaxed">
          El horario que reservás queda apartado para vos y no se le puede ofrecer a otra persona.
          Avisar a tiempo permite que ese espacio lo use alguien más que lo necesita. La regla no
          busca penalizarte: busca que el compromiso sea real en las dos direcciones.
        </p>

        <h3 className="mt-6 font-bold text-neutral-900">Un tropiezo no termina un proceso</h3>
        <p className="mt-2 leading-relaxed">
          Cuando se aplica el cargo, tu agenda queda en pausa: no vas a poder reservar por tu cuenta
          hasta que hablemos. <b>Esto no es una expulsión.</b> La administración se comunica con vos
          para coordinar tu próximo turno, y ahí mismo se te devuelve el acceso.
        </p>
        <p className="mt-3 leading-relaxed">
          La primera vez que te pase, en tu panel vas a encontrar un botón para pedir que te
          contactemos. También vamos a pedirte que releás esta página antes de volver a reservar. No
          es un castigo ni un trámite: es para que la próxima vez sepas exactamente qué hacer.
        </p>
      </section>

      {/* Este bloque es el que hace legítimo el acceso de la dirección clínica al
          cierre de los casos: el Código de Ética del CPPCR admite compartir con
          autorización expresa de la persona usuaria (art. 33), y exige que el
          consentimiento informado advierta los límites del secreto profesional.
          Por eso va en el cuerpo, con este tamaño, y no en una nota al pie. */}
      <section id="direccion-clinica" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-bold text-brand-700">Tu proceso no lo lleva una sola persona</h2>
        <p className="mt-3 leading-relaxed">
          El profesional que te atiende trabaja dentro de un equipo con <b>dirección clínica</b>, a
          cargo de un profesional colegiado activo. Cuando tu proceso se cierre —porque cumpliste
          tus objetivos, porque el camino cambió o porque conviene que sigas con otra persona— esa
          decisión no la toma tu profesional en soledad: la revisa junto a la dirección clínica
          antes de quedar en firme.
        </p>
        <p className="mt-3 leading-relaxed">
          Eso significa que la dirección clínica accede a las notas de apertura y de{" "}
          <b>cierre</b> de tu proceso. No a lo que conversás sesión a sesión. Es una garantía de que
          nadie cierra un proceso a la ligera, y es un límite del secreto profesional que preferimos
          decirte de frente, acá, antes de que aceptes.
        </p>
        <p className="mt-3 leading-relaxed">
          Cada vez que la dirección clínica abre tu expediente queda registrado quién fue y cuándo.
          Nadie más lo ve: ni el personal administrativo, ni otros profesionales de la red.
        </p>
        <p className="mt-3 leading-relaxed">
          Tenés derecho a acceder a tu expediente y a pedir una copia cuando querás
          (Ley N.º 8239). Podés solicitarla desde tu panel. Y por obligación profesional, tu
          expediente se conserva al menos <b>diez años</b> después de que tu proceso concluya.
        </p>
      </section>

      <ConfirmarAcuerdo />

      <section id="privacidad" className="mt-12 border-t border-neutral-300 pt-8">
        <h2 className="text-2xl font-bold text-brand-700">Cómo se cuida tu información</h2>
        <p className="mt-6 whitespace-pre-line leading-relaxed text-neutral-700">{PRIVACIDAD}</p>
      </section>

      <p className="mt-8 leading-relaxed text-neutral-700">
        La información publicada no sustituye la atención clínica personalizada. Para consultas
        específicas, recomendamos contactar con un profesional habilitado.
      </p>
    </main>
  );
}
