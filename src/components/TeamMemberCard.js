// src/components/TeamMemberCard.js
import Image from 'next/image';
import Link from 'next/link';

// Ahora recibe el 'id' para poder crear el enlace
export default function TeamMemberCard({ name, role, imageUrl, id }) {
  return (
    <Link href={`/perfil/${id}`} className="block text-center group">
      <div className="relative w-40 h-40 mx-auto mb-4 rounded-full overflow-hidden shadow-lg transform group-hover:scale-105 transition-transform duration-300">
        <Image
          src={imageUrl}
          alt={`Foto de ${name}`}
          layout="fill"
          objectFit="cover"
        />
      </div>
      <h3 className="text-xl font-bold text-gray-800">{name}</h3>
      <p className="text-brand-primary">{role}</p>
    </Link>
  );
}