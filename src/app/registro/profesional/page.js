// src/app/registro/profesional/page.js
import ProfessionalRegisterClient from './ProfessionalRegisterClient'; // O la ruta correcta

export const metadata = {
  title: 'Registro Profesional | Salud Mental Costa Rica',
  description: 'Únete a nuestra red de profesionales.',
};

export default function ProfessionalRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Aquí llamamos al componente cliente */}
        <ProfessionalRegisterClient /> 
      </div>
    </div>
  );
}