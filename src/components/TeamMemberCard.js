// src/components/TeamMemberCard.js
import Link from "next/link";
import SafeImage from "@/components/SafeImage";

export default function TeamMemberCard({ name, role, imageUrl, id }) {
  return (
    <Link href={`/perfil/${id}`} className="group block text-center">
      <div className="relative mx-auto mb-4 h-40 w-40 overflow-hidden rounded-full shadow-lg transition-transform duration-300 group-hover:scale-105">
        <SafeImage
          src={imageUrl}
          alt={`Foto de ${name}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <h3 className="text-xl font-bold text-brand-600">{name}</h3>
      <p className="text-brand-600">{role}</p>
    </Link>
  );
}
