// src/app/registro/profesional/page.js
import ProfessionalRegisterForm from "@/components/ProfessionalRegisterForm";

export default function RegistroProfesionalPage() {
  return (
    <main className="bg-neutral-250 py-12">
      <div className="container mx-auto px-6">
        <header className="mx-auto max-w-xl mb-6">
          <h1 className="text-2xl font-bold">Registro profesional</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Completá tus datos para postularte. Te enviaremos un email para verificar tu correo y un
            administrador te contactará para agendar una entrevista. Tu perfil no será visible hasta
            que sea validado.
          </p>
        </header>

        <ProfessionalRegisterForm />
      </div>
    </main>
  );
}
