import ServiceCategoryCard from "@/components/ServiceCategoryCard";

/**
 * Grilla de servicios a lo ancho, con el título centrado.
 *
 * La home dejó de usarla cuando los servicios pasaron a la columna ancha de
 * `HomeServicesAndBlog`. Se conserva porque es la disposición correcta para una
 * página que solo lista servicios, y porque la tarjeta ya no está duplicada:
 * las dos disposiciones comparten `ServiceCategoryCard`.
 */
export default function CategorySection({ categories, title }) {
  if (!categories || categories.length === 0) {
    return (
      <section className="bg-neutral-50 py-12 text-center">
        <p className="text-neutral-700">Cargando servicios...</p>
      </section>
    );
  }

  return (
    <section className="bg-surface py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-12 text-center text-3xl font-bold text-brand-900">
          {title || "Nuestros servicios"}
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <ServiceCategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}
