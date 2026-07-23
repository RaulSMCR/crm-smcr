// src/components/HeroSection.js
import Link from 'next/link';
import Image from 'next/image';
import WhiplashCorner from '@/components/ornaments/WhiplashCorner';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Banda de marca */}
      <div
        className="relative isolate mx-auto mt-6 overflow-hidden rounded-2xl border border-brand-800/40 text-white shadow-card"
        style={{ background: 'linear-gradient(112deg, #1E4F52 0%, #2B7073 52%, #3E8384 100%)' }}
      >
        {/* Neblina coral: capa de textura, por debajo del contenido. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'radial-gradient(ellipse 70% 90% at 92% 4%, rgba(251,122,98,.30), transparent 62%)',
          }}
        />

        {/* Ornamento latigazo: en la esquina opuesta al logo, nunca lo toca.
            Oculto bajo 820px: en móvil el hero no tiene aire para sostenerlo. */}
        <div
          className="pointer-events-none absolute z-[2] hidden [@media(min-width:820px)]:block"
          style={{ top: '-30px', right: '-40px', width: '300px', opacity: 0.34, color: '#F6EFDF' }}
        >
          <WhiplashCorner className="h-full w-full" />
        </div>

        <div className="relative z-[3] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
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
              <span
                className="font-display font-light text-nv-teal-pale"
                style={{
                  fontSize: 'clamp(32px, 4.4vw, 47px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.005em',
                }}
              >
                Salud Mental<br />Costa Rica
              </span>
            </Link>

            <h1
              className="font-display font-semibold text-nv-cream-hi"
              style={{
                fontSize: 'clamp(28px, 3.6vw, 38px)',
                lineHeight: 1.12,
                letterSpacing: '-0.005em',
              }}
            >
              Bienestar con profesionales validados
            </h1>

            {/* Sans a propósito: Cormorant es exclusivamente display. */}
            <p
              className="mt-3"
              style={{
                fontSize: '14.5px',
                lineHeight: 1.6,
                maxWidth: '52ch',
                color: 'rgba(246,239,223,.86)',
              }}
            >
              Informate y acompañate con los profesionales que aportan al cuidado de la salud mental.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/servicios" className="btn btn-accent">
                Ver servicios
              </Link>
              <Link href="/blog" className="btn btn-outline-dark">
                Explorar blog
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

