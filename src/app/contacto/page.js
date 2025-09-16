// src/app/contacto/page.js
import ContactForm from "@/components/ContactForm";

export default function ContactoPage() {
  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Contáctanos</h1>
          <p className="text-lg text-gray-600 mb-10">
            Estamos aquí para ayudarte. Escríbenos un correo, un mensaje o utiliza el formulario a continuación.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Contact Information Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Email</h3>
              <a href="mailto:contacto@saludmentalcostarica.com" className="text-brand-primary hover:underline">
                contacto@saludmentalcostarica.com
              </a>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800">WhatsApp / Teléfono</h3>
              <a href="tel:+50671291909" className="text-brand-primary hover:underline">
                7129-1909
              </a>
            </div>
          </div>

          {/* Contact Form Column */}
          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}