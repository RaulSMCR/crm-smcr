/* eslint-disable react/no-unescaped-entities */

export default function Terminos() {
  return (
    <main className="max-w-4xl mx-auto py-16 px-6 text-neutral-800">
      <h1 className="text-3xl font-bold text-brand-700">Términos y Condiciones</h1>
      <p className="mt-6 text-neutral-700 leading-relaxed">
        Política de Privacidad y Tratamiento de Datos Sensibles - Salud Mental Costa Rica
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

"He leído y acepto la Política de Privacidad, y otorgo mi consentimiento informado y expreso para el tratamiento de mis datos personales de salud (Datos Sensibles) por parte de Salud Mental Costa Rica, con el único fin de gestionar mi conexión con el profesional de la salud mental."

Revocación: El Usuario tiene el derecho de revocar este consentimiento en cualquier momento, lo cual puede conllevar la imposibilidad de seguir utilizando la función de agendamiento, sin afectar la legalidad del tratamiento realizado previamente a la revocación.

4. Comunicación de Datos Personales a Terceros
La Empresa solo comunicará sus datos en los siguientes casos:

A Profesionales: Los datos de contacto, identificación y el Motivo de Consulta son transferidos al Profesional con el que el Usuario decide agendar la cita. Esta transferencia es esencial para la prestación del servicio que usted solicita.

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
      </p>
      {/* La política de reservas vive acá por decisión editorial: no aparece en el
          flujo de reserva para no enmarcar el vínculo terapéutico en sanciones.
          Cuando se aplica por primera vez, el panel del paciente le ofrece pedir
          que la administración lo contacte. */}
      <section className="mt-12 border-t border-neutral-300 pt-8">
        <h2 className="text-2xl font-bold text-brand-700">Reservas, pagos y ausencias</h2>

        <h3 className="mt-6 font-bold text-neutral-900">Cómo se cobra</h3>
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

        <h3 className="mt-6 font-bold text-neutral-900">Si necesitás mover tu cita</h3>
        <p className="mt-2 leading-relaxed">
          Podés reprogramarla avisando con <b>al menos 24 horas</b> de anticipación, desde tu panel,
          sin ningún costo.
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

        <h3 className="mt-6 font-bold text-neutral-900">Qué pasa después</h3>
        <p className="mt-2 leading-relaxed">
          Cuando se aplica el cargo, tu agenda queda en pausa: no vas a poder reservar por tu cuenta
          hasta que hablemos. <b>Esto no es una expulsión.</b> La administración se comunica con vos
          para coordinar tu próximo turno, y ahí mismo se te devuelve el acceso.
        </p>
        <p className="mt-3 leading-relaxed">
          La primera vez que te pase, en tu panel vas a encontrar un botón para pedir que te
          contactemos. Un tropiezo no termina un proceso.
        </p>
      </section>

      <p className="mt-8 text-neutral-700 leading-relaxed">
        La información publicada no sustituye la atención clínica personalizada. Para consultas específicas,
        recomendamos contactar con un profesional habilitado.
      </p>
    </main>
  );
}
