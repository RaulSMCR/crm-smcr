import AccordionItem from "@/components/AccordionItem";
import FaqContactSection from "@/components/FaqContactSection";

export const metadata = {
  title: "Preguntas Frecuentes",
  description:
    "Encontrá respuestas a las consultas más frecuentes sobre nuestra plataforma de salud mental.",
};

const IconServiceFee = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);

const IconCalendar = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
    />
  </svg>
);

const IconShield = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"
    />
  </svg>
);

const faqSections = [
  {
    id: "servicios",
    title: "Dinámica del Servicio y Aranceles",
    Icon: IconServiceFee,
    headerBg: "bg-brand-50",
    headerBorder: "border-brand-200",
    iconColor: "text-brand-600",
    titleColor: "text-brand-800",
    items: [
      {
        id: "s1",
        question: "¿Los servicios de la plataforma son gratuitos?",
        answer:
          "No. Los profesionales que integran nuestra plataforma brindan servicios exclusivamente arancelados. Creemos en la justa retribución del trabajo profesional y en el establecimiento de un encuadre serio y ético para cada proceso de salud mental.",
      },
      {
        id: "s2",
        question:
          "¿Puedo recibir asesoría o realizar consultas orientativas por WhatsApp?",
        answer:
          "No. Por motivos éticos, de confidencialidad y secreto profesional, los especialistas no realizan atención, diagnóstico ni orientación clínica a través de mensajería instantánea o canales de soporte. La interacción profesional se inicia únicamente dentro del espacio formal de la sesión agendada.",
      },
      {
        id: "s3",
        question: "¿Cómo consulto los honorarios de los profesionales?",
        answer:
          "Los aranceles varían según la disciplina y el profesional elegido. Podrás visualizar los costos de forma transparente al ingresar al perfil de cada especialista dentro de la plataforma.",
      },
      {
        id: "s4",
        question:
          "¿Alguien me entrevistará o me pedirá mis motivos de consulta antes de la cita?",
        answer:
          "No. En nuestra plataforma respetamos estrictamente el secreto profesional y el derecho a la confidencialidad desde el primer segundo. Ningún intermediario, asistente o personal administrativo está autorizado a interrogarte, realizar cribados (triage) o solicitarte detalles sobre tu motivo de consulta.\n\nEntendemos que el malestar psicológico y la historia personal son estrictamente privados y solo deben ser abordados directamente con el profesional de la salud matriculado que hayas elegido, dentro del espacio seguro de la sesión. Los procesos automatizados de nuestro portal garantizan que tu información clínica no pase por terceros.",
      },
    ],
  },
  {
    id: "turnos",
    title: "Turnos y Agendamiento",
    Icon: IconCalendar,
    headerBg: "bg-brand-50",
    headerBorder: "border-brand-200",
    iconColor: "text-brand-600",
    titleColor: "text-brand-800",
    items: [
      {
        id: "t1",
        question: "¿Cómo solicito una cita?",
        answer:
          "Para garantizar la seguridad de tus datos y la gestión de tus turnos, el agendamiento se realiza exclusivamente creando un usuario en nuestra plataforma. El proceso es simple, seguro y te permitirá administrar tus sesiones.",
      },
      {
        id: "t2",
        question: "¿Qué modalidades de atención ofrecen?",
        answer:
          "La plataforma promueve un abordaje interdisciplinario de la salud mental. Encontrarás profesionales de distintas disciplinas que ofrecen atención en modalidad online (videoconsulta) y, según el caso, presencial.",
      },
    ],
  },
  {
    id: "emergencias",
    title: "Seguridad y Emergencias",
    Icon: IconShield,
    headerBg: "bg-accent-50",
    headerBorder: "border-accent-200",
    iconColor: "text-accent-700",
    titleColor: "text-accent-900",
    isEmergency: true,
    items: [
      {
        id: "e1",
        question:
          "¿Qué hago si me encuentro en una situación de urgencia o crisis?",
        answer:
          "Nuestra plataforma no es un servicio de urgencias médicas ni de atención a crisis agudas. Si te encontrás en una situación de riesgo inminente, por favor comunicate inmediatamente con las líneas de asistencia oficial de tu localidad o asistí al centro de salud más cercano.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-surface py-16 border-b border-neutral-200">
        <div className="container max-w-3xl text-center">
          <span className="inline-block mb-4 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700">
            Centro de ayuda
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Preguntas Frecuentes
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Encontrá respuestas a las consultas más frecuentes sobre el
            funcionamiento de nuestra plataforma.
          </p>
        </div>
      </section>

      {/* Sections */}
      <section className="py-14">
        <div className="container max-w-3xl">
          <div className="flex flex-col gap-8">
            {faqSections.map((section) => (
              <article
                key={section.id}
                className="card overflow-hidden"
                aria-labelledby={`section-heading-${section.id}`}
              >
                {/* Section header */}
                <div
                  className={`flex items-center gap-3 px-6 py-4 border-b ${section.headerBg} ${section.headerBorder}`}
                >
                  <span className={section.iconColor}>
                    <section.Icon />
                  </span>
                  <h2
                    id={`section-heading-${section.id}`}
                    className={`text-sm font-semibold uppercase tracking-wide ${section.titleColor}`}
                  >
                    {section.title}
                  </h2>
                </div>

                {/* Emergency notice */}
                {section.isEmergency && (
                  <div className="mx-6 mt-5 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3">
                    <p className="text-sm font-medium text-accent-800">
                      Si te encontrás en una situación de crisis inmediata,
                      comunicate con los servicios de emergencia de tu
                      localidad o concurrí al centro de salud más cercano.
                    </p>
                  </div>
                )}

                {/* Accordion items */}
                <div>
                  {section.items.map((item) => (
                    <AccordionItem
                      key={item.id}
                      id={item.id}
                      question={item.question}
                      answer={item.answer}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FaqContactSection />
    </>
  );
}
