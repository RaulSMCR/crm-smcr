// src/components/TeamMemberCard.js
import Image from 'next/image';

export default function TeamMemberCard({ name, role, imageUrl }) {
  return (
    <div className="text-center">
      <div className="relative w-40 h-40 mx-auto mb-4 rounded-full overflow-hidden shadow-lg">
        <Image
          src={imageUrl}
          alt={`Foto de ${name}`}
          layout="fill"
          objectFit="cover"
        />
      </div>
      <h3 className="text-xl font-bold text-gray-800">{name}</h3>
      <p className="text-brand-primary">{role}</p>
    </div>
  );
}