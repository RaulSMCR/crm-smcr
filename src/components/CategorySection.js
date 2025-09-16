// src/components/CategorySection.js
import CategoryCard from './CategoryCard';

const categories = [
  {
    title: 'Psicología',
    description: 'Terapia individual y de pareja para una mente sana.',
    href: '/servicios/psicologia',
    imageUrl: '/images/categories/psicologia.jpg' // <-- Ruta a tu imagen
  },
  {
    title: 'Nutrición',
    description: 'Planes alimenticios personalizados y coaching nutricional.',
    href: '/servicios/nutricion',
    imageUrl: '/images/categories/nutricion.jpg' // <-- Ruta a tu imagen
  },
  {
    title: 'Terapia Ocupacional',
    description: 'Apoyo para el desarrollo de habilidades de la vida diaria.',
    href: '/servicios/terapia',
    imageUrl: '/images/categories/terapia.jpg' // <-- Ruta a tu imagen
  },
  {
    title: 'Coaching de Vida',
    description: 'Define y alcanza tus metas personales y profesionales.',
    href: '/servicios/coaching',
    imageUrl: '/images/categories/coaching.jpg' // <-- Ruta a tu imagen
  }
];

export default function CategorySection() {
  return (
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">
          Explora nuestras categorías
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {categories.map((category) => (
            <CategoryCard 
              key={category.title}
              title={category.title}
              description={category.description}
              href={category.href}
              imageUrl={category.imageUrl}
            />
          ))}
        </div>
      </div>
    </section>
  );
}