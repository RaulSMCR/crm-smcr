// src/components/CategoryCard.js
import Link from 'next/link';
import Image from 'next/image';

export default function CategoryCard({ title, description, href, imageUrl }) {
  return (
    <Link href={href} className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <div className="relative w-full h-40">
        <Image
          src={imageUrl}
          alt={`Imagen para ${title}`}
          layout="fill"
          objectFit="cover"
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </Link>
  );
}