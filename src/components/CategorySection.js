// src/components/CategorySection.js
import CategoryCard from './CategoryCard';

// Si no recibimos categorías por props, usamos un set por defecto
const fallbackCategories = [
  {
    name: 'Psicología',
    slug: 'psicologia',
    imageUrl:
      'https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80&auto=format&fit=crop',
    description: 'Terapias y acompañamiento psicológico.',
  },
  {
    name: 'Nutrición',
    slug: 'nutricion',
    imageUrl:
      'https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80&auto=format&fit=crop',
    description: 'Planes alimenticios y bienestar integral.',
  },
  {
    name: 'Terapia',
    slug: 'terapia',
    imageUrl:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80&auto=format&fit=crop',
    description: 'Sesiones individuales y familiares.',
  },
  {
    name: 'Coaching',
    slug: 'coaching',
    imageUrl:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80&auto=format&fit=crop',
    description: 'Objetivos profesionales y personales.',
  },
];

export default function CategorySection({ categories = fallbackCategories, title = 'Servicios' }) {
  return (
    <section className="text-brand-600 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-brand-600 text-3xl font-bold">{title}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => (
          <CategoryCard key={cat.slug} category={cat} />
        ))}
      </div>
    </section>
  );
}
