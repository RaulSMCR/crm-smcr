import Link from 'next/link';

export default function RegistroPage() {
  return (
    <div className="bg-neutral-250 py-12">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-brand-600 mb-4">Únete a Nuestra Comunidad</h1>
          <p className="text-lg text-breand-300 mb-10">
            Elige el tipo de cuenta que mejor se adapte a tus necesidades.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Link href="/registro/usuario" className="block bg-white p-8 rounded-lg shadow-md text-center hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-semibold mb-4 text-brand-primary">Quiero Encontrar un Profesional</h2>
            <p className="text-brand-600">Crea una cuenta para agendar citas, gestionar tu historial y conectar con especialistas en bienestar.</p>
          </Link>
          <Link href="/registro/profesional" className="block bg-white p-8 rounded-lg shadow-md text-center hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-semibold mb-4 text-brand-600">Soy un Profesional</h2>
            <p className="text-brand-300">Únete a nuestra red para ofrecer tus servicios, gestionar tu calendario y conectar con nuevos clientes.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}