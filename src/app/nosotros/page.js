// src/app/nosotros/page.js
import TeamMemberCard from "@/components/TeamMemberCard";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getTeamMembers() {
  // Obtenemos solo los profesionales que han sido aprobados
  const team = await prisma.professional.findMany({
    where: { isApproved: true },
  });
  return team;
}

export default async function NosotrosPage() {
  const teamMembers = await getTeamMembers();

  return (
    <div className="bg-white py-12">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Sobre Nosotros</h1>
          <p className="text-lg text-gray-600">
            Nuestra misión es conectar a las personas con profesionales de la salud mental y el bienestar de Costa Rica, ofreciendo un espacio seguro y accesible para el crecimiento personal.
          </p>
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">Nuestro Equipo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {teamMembers.map((member) => (
              <TeamMemberCard
                key={member.id}
                id={member.id} // <-- Pasamos el ID
                name={member.name}
                role={member.profession} // Usamos 'profession' de la base de datos
                imageUrl={'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1961'} // Placeholder de imagen
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}