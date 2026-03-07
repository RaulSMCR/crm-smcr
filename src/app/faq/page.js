// src/app/faq/page.js
import AccordionItem from "@/components/AccordionItem";

const faqData = [
  {
    question: "¿Cómo se agenda una cita?",
    answer:
      'Para agendar una cita, diríjase a la página de "Servicios", seleccione el profesional de preferencia y haga clic en "Ver Detalles". En la página de detalle se mostrará el botón para continuar con la agenda.',
  },
  {
    question: "¿Qué métodos de pago se aceptan?",
    answer:
      "Se aceptan pagos a través de la plataforma del Banco de Costa Rica, con las principales tarjetas de crédito y débito.",
  },
  {
    question: "¿Es posible cancelar o reprogramar una cita?",
    answer:
      "Sí. Es posible cancelar o reprogramar una cita con hasta 24 horas de antelación sin costo. Las cancelaciones con menos de 24 horas pueden estar sujetas a penalización según la política vigente.",
  },
  {
    question: "¿La información de las sesiones es confidencial?",
    answer:
      "Sí. La confidencialidad es una prioridad. Todas las interacciones con profesionales se encuentran protegidas y se rigen por códigos de ética profesional y normativa aplicable.",
  },
];

export default function FaqPage() {
  return (
    <div className="bg-white py-12">
      <div className="container mx-auto px-6 max-w-3xl">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">Preguntas Frecuentes</h1>
        <div className="border-t rounded-lg shadow-sm">
          {faqData.map((faq, index) => (
            <AccordionItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </div>
  );
}
