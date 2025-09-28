// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function hashPassword(plain) {
  const bcrypt = require('bcryptjs');
  const saltRounds = 10;
  return await bcrypt.hash(plain, saltRounds);
}

async function main() {
  console.log('— Start seeding...');

  // 1) Password de DEV (cámbiala cuando quieras)
  const DEV_PASSWORD = 'smcr1234';
  const passwordHash = await hashPassword(DEV_PASSWORD);

  // 2) Profesionales (upsert + approved + hash real)
  const prosData = [
    { email: 'ana.perez@example.com', name: 'Dra. Ana Pérez', profession: 'Psicóloga Clínica', introVideoUrl: 'https://www.youtube.com/embed/O-6f5wQXSu8' },
    { email: 'carlos.rojas@example.com', name: 'Lic. Carlos Rojas', profession: 'Nutricionista' },
    { email: 'laura.fernandez@example.com', name: 'Laura Fernández', profession: 'Coach de Carrera' },
    { email: 'sofia.vargas@example.com', name: 'MSc. Sofia Vargas', profession: 'Terapeuta Ocupacional' },
  ];

  const pros = {};
  for (const p of prosData) {
    const pro = await prisma.professional.upsert({
      where: { email: p.email },
      update: {
        name: p.name,
        profession: p.profession,
        introVideoUrl: p.introVideoUrl ?? null,
        passwordHash,          // ← bcrypt real
        isApproved: true,      // ← aprobado
      },
      create: {
        email: p.email,
        name: p.name,
        profession: p.profession,
        introVideoUrl: p.introVideoUrl ?? null,
        passwordHash,          // ← bcrypt real
        isApproved: true,
      },
      select: { id: true, email: true, name: true },
    });
    pros[p.email] = pro;
  }

  // 3) Servicios (upsert por slug)
  const servicesData = [
    {
      slug: 'terapia-cognitivo-conductual',
      title: 'Terapia Cognitivo-Conductual',
      description: 'Enfoque práctico y basado en evidencia para tratar la ansiedad y la depresión.',
      price: 50,
      imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1888',
      professionalEmails: ['ana.perez@example.com'],
    },
    {
      slug: 'asesoria-nutricional',
      title: 'Asesoría Nutricional',
      description: 'Plan alimenticio personalizado para tus metas de salud.',
      price: 45,
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070',
      professionalEmails: ['carlos.rojas@example.com'],
    },
    {
      slug: 'coaching-de-carrera',
      title: 'Coaching de Carrera',
      description: 'Define y alcanza tus objetivos profesionales con un plan claro.',
      price: 60,
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070',
      professionalEmails: ['laura.fernandez@example.com'],
    },
    {
      slug: 'terapia-ocupacional-infantil',
      title: 'Terapia Ocupacional Infantil',
      description: 'Apoyo especializado para el desarrollo de habilidades en niños.',
      price: 55,
      imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=1974',
      professionalEmails: ['sofia.vargas@example.com'],
    },
  ];

  const services = {};
  for (const s of servicesData) {
    // upsert básico
    const svc = await prisma.service.upsert({
      where: { slug: s.slug },
      update: { title: s.title, description: s.description, price: s.price, imageUrl: s.imageUrl },
      create: { slug: s.slug, title: s.title, description: s.description, price: s.price, imageUrl: s.imageUrl },
      select: { id: true, slug: true },
    });
    services[s.slug] = svc;

    // conectar profesionales (many-to-many), sin duplicar
    const connects = (s.professionalEmails || [])
      .map((email) => pros[email]?.id)
      .filter(Boolean)
      .map((id) => ({ id }));

    if (connects.length) {
      await prisma.service.update({
        where: { id: svc.id },
        data: { professionals: { connect: connects } },
      });
    }
  }

  // 4) Posts (upsert por slug)
  const postsData = [
    {
      slug: 'mitos-terapia',
      title: '5 Mitos Comunes sobre la Terapia',
      content: 'Desmentimos algunas de las ideas erróneas más frecuentes sobre lo que significa ir a terapia...',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070',
      postType: 'TEXT',
      authorEmail: 'ana.perez@example.com',
      serviceSlug: 'terapia-cognitivo-conductual',
      status: 'PUBLISHED',
    },
    {
      slug: 'video-mindfulness',
      title: 'Video: Guía de 5 minutos de Mindfulness',
      content: 'Sigue esta guía en video para una sesión rápida...',
      postType: 'VIDEO',
      mediaUrl: 'https://www.youtube.com/embed/O-6f5wQXSu8',
      authorEmail: 'ana.perez@example.com',
      serviceSlug: 'terapia-cognitivo-conductual',
      status: 'PUBLISHED',
    },
    {
      slug: 'podcast-nutricion',
      title: 'Podcast: Nutrición y Estado de Ánimo',
      content: 'Escucha nuestro último podcast...',
      postType: 'AUDIO',
      mediaUrl: 'https://open.spotify.com/embed/episode/06V21n84i8i0a3n3x1c3yC',
      authorEmail: 'carlos.rojas@example.com',
      serviceSlug: 'asesoria-nutricional',
      status: 'PUBLISHED',
    },
  ];

  for (const p of postsData) {
    const author = pros[p.authorEmail];
    const service = services[p.serviceSlug];

    await prisma.post.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        content: p.content,
        imageUrl: p.imageUrl ?? null,
        postType: p.postType,
        mediaUrl: p.mediaUrl ?? null,
        status: p.status || 'PENDING',
        authorId: author?.id,
        serviceId: service?.id ?? null,
      },
      create: {
        slug: p.slug,
        title: p.title,
        content: p.content,
        imageUrl: p.imageUrl ?? null,
        postType: p.postType,
        mediaUrl: p.mediaUrl ?? null,
        status: p.status || 'PENDING',
        authorId: author?.id,
        serviceId: service?.id ?? null,
      },
    });
  }

  console.log('— Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
