// src/app/nosotros/page.js
import TeamMemberCard from "@/components/TeamMemberCard";

const teamMembers = [
  {
    name: 'Dra. Elena Vega',
    role: 'Fundadora y Psicóloga Clínica',
    imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1961',
  },
  {
    name: 'Marco Solano',
    role: 'Co-fundador y Coach de Vida',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1887',
  },
  {
    name: 'Sofía Rojas',
    role: 'Nutricionista Certificada',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1887',
  }
];

export default function NosotrosPage() {
  return (
    <div className="bg-white py-12">
      <div className="container mx-auto px-6">
        {/* Section 1: Title and Mission */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Sobre Nosotros</h1>
          <p className="text-lg text-gray-600">
            Nuestra misión es conectar a las personas con profesionales de la salud mental y el bienestar de Costa Rica, ofreciendo un espacio seguro y accesible para el crecimiento personal.
          </p>
        </div>

        {/* Section 2: Team */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">Nuestro Equipo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {teamMembers.map((member) => (
              <TeamMemberCard
                key={member.name}
                name={member.name}
                role={member.role}
                imageUrl={member.imageUrl}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}