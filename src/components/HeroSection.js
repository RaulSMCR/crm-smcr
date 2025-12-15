// src/components/HeroSection.js
import Link from 'next/link';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Banda de marca */}
      <div className="mx-auto mt-6 rounded-2xl border border-brand-800/40 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-700 text-white shadow-card">
        <div className="px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
          <div className="max-w-3xl">

            {/* ⭐ Logo + Marca con color destacado */}
            <Link href="/" className="mb-10 flex items-center gap-5">
              <Image
                src="/logo.svg"
                alt="Logo Salud Mental Costa Rica"
                width={120}
                height={120}
                className="h-auto w-28 sm:w-32 drop-shadow-lg"
                priority
              />
              <span className="font-extrabold text-4xl sm:text-5xl tracking-wide text-brand-300">
                Salud Mental<br />Costa Rica
              </span>
            </Link>

            <h1 className="text-3xl font-bold leading-tight sm:text-4xl text-brand-100">
              Bienestar con profesionales validados
            </h1>

            <p className="mt-3 text-white/90">
              Informate y acompañate con los profesionales que aportan a tu salud mental.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/servicios" className="btn btn-accent">
                Ver servicios
              </Link>
              <Link href="/blog" className="btn btn-outline bg-white/10 text-white hover:bg-white/20 border-white/40">
                Explorar blog
              </Link>
            </div>
          </div>
        </div>

        {/* Detalles decorativos */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-600/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-accent-600/20 blur-3xl" />
      </div>
    </section>
  );
}
