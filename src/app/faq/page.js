// src/app/faq/page.js
import AccordionItem from "@/components/AccordionItem";

const faqData = [
  {
    question: '¿Cómo puedo agendar una cita?',
    answer: 'Para agendar una cita, navega a la página de "Servicios", elige al profesional que prefieras y haz clic en "Ver Detalles". En la página de detalle, encontrarás el botón para agendar la cita.'
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer: 'Aceptamos pagos a través de la plataforma de pago del Banco de Costa Rica, que permite el uso de las principales tarjetas de crédito y débito.'
  },
  {
    question: '¿Puedo cancelar o reprogramar una cita?',
    answer: 'Sí, puedes cancelar o reprogramar tu cita con hasta 24 horas de antelación sin ningún costo. Las cancelaciones con menos de 24 horas de antelación pueden estar sujetas a una penalización según nuestras políticas.'
  },
  {
    question: '¿La información de mis sesiones es confidencial?',
    answer: 'Absolutamente. La confidencialidad es nuestra máxima prioridad. Todas las interacciones con nuestros profesionales están protegidas y se rigen por los códigos de ética profesionales y la ley.'
  }
];

export default function FaqPage() {
  return (
    <div className="bg-white py-12">
      <div className="container mx-auto px-6 max-w-3xl">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
          Preguntas Frecuentes
        </h1>
        <div className="border-t rounded-lg shadow-sm">
          {faqData.map((faq, index) => (
            <AccordionItem 
              key={index} 
              question={faq.question} 
              answer={faq.answer} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}