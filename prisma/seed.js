// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Limpieza de datos de ejemplo existentes
  await prisma.post.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();
  console.log('Existing example data deleted.');

  // 2. Creación de nuevos profesionales
  const professional1 = await prisma.professional.create({
    data: {
      email: 'ana.perez@example.com', name: 'Dra. Ana Pérez', profession: 'Psicóloga Clínica',
      phone: '88887777', passwordHash: 'placeholder_hash', isApproved: true,
    },
  });
  const professional2 = await prisma.professional.create({
    data: {
      email: 'carlos.rojas@example.com', name: 'Lic. Carlos Rojas', profession: 'Nutricionista',
      phone: '88886666', passwordHash: 'placeholder_hash', isApproved: true,
    },
  });
  // ... (puedes añadir los otros profesionales aquí si quieres)

  // 3. Creación de nuevos servicios
  await prisma.service.createMany({
    data: [
      { title: 'Terapia Cognitivo-Conductual', description: 'Enfoque práctico...', price: 50, imageUrl: '...', professionalId: professional1.id },
      { title: 'Asesoría Nutricional', description: 'Plan alimenticio...', price: 45, imageUrl: '...', professionalId: professional2.id },
    ]
  });

  // 4. Creación de nuevos artículos (posts)
  await prisma.post.createMany({
    data: [
      {
        slug: 'mitos-terapia',
        title: '5 Mitos Comunes sobre la Terapia',
        content: 'Desmentimos algunas de las ideas erróneas más frecuentes sobre lo que significa ir a terapia...',
        imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070',
        postType: 'text',
        authorId: professional1.id,
      },
      {
        slug: 'video-mindfulness',
        title: 'Video: Guía de 5 minutos de Mindfulness',
        content: 'Sigue esta guía en video para una sesión rápida de mindfulness y reduce tu estrés.',
        postType: 'video',
        mediaUrl: 'https://www.youtube.com/embed/O-6f5wQXSu8',
        authorId: professional1.id,
      },
      {
        slug: 'podcast-nutricion',
        title: 'Podcast: Nutrición y Estado de Ánimo',
        content: 'Escucha nuestro último podcast donde exploramos la conexión entre lo que comes y cómo te sientes.',
        postType: 'audio',
        mediaUrl: 'https://open.spotify.com/embed/episode/06V21n84i8i0a3n3x1c3yC', // URL de ejemplo de Spotify
        authorId: professional2.id,
      },
    ],
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });