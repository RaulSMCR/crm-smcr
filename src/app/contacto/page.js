import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: 'Contacto',
  description:
    'Ponete en contacto con el equipo de Salud Mental Costa Rica. Estamos disponibles para consultas, dudas y coordinar tu primera sesión.',
  alternates: { canonical: 'https://saludmentalcostarica.com/contacto' },
  openGraph: {
    title: 'Contacto | Salud Mental Costa Rica',
    description: 'Escribinos para coordinar tu primera sesión o resolver tus dudas.',
    url: 'https://saludmentalcostarica.com/contacto',
  },
};

export default function ContactoPage() {
  return (
    <div className="bg-surface py-12">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-brand-900">Contáctanos</h1>
          <p className="mb-10 text-lg text-neutral-800">
            Estamos aquí para ayudarle. Escríbanos un correo, un mensaje o utilice el
            formulario a continuación.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2">
          <div className="space-y-6 rounded-2xl border border-neutral-300 bg-neutral-50 p-8 shadow-card">
            <div>
              <h3 className="text-xl font-semibold text-brand-900">Correo</h3>
              <a
                href="mailto:contacto@saludmentalcostarica.com"
                className="font-medium text-brand-800 hover:text-brand-900"
              >
                contacto@saludmentalcostarica.com
              </a>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-brand-900">WhatsApp / Teléfono</h3>
              <a
                href="tel:+50671291909"
                className="font-medium text-brand-800 hover:text-brand-900"
              >
                +506 71291909
              </a>
            </div>
          </div>

          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
