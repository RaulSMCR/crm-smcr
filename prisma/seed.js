const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos (Seeding)...');

  const hashedPassword = await bcrypt.hash('Password123!', 12);

  // 1. ADMIN
  await prisma.user.upsert({
    where: { email: 'admin@crm-smcr.com' },
    update: {},
    create: {
      email: 'admin@crm-smcr.com',
      name: 'Super Admin',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  // 2. CATEGORÍAS (Mantenemos tu lógica de árbol)
  const taxonomy = [
    {
      name: 'Salud Mental', slug: 'salud-mental', icon: 'brain',
      children: [{ name: 'Psicología', slug: 'psicologia' }]
    },
    // ... (puedes mantener el resto de tu array taxonomy aquí)
  ];

  for (const group of taxonomy) {
    const parent = await prisma.category.upsert({
      where: { slug: group.slug },
      update: {},
      create: { name: group.name, slug: group.slug, icon: group.icon }
    });

    for (const child of group.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { parentId: parent.id },
        create: { name: child.name, slug: child.slug, parentId: parent.id }
      });
    }
  }

  // 3. PROFESIONAL (Dr. Test) + SERVICIOS + POSTS
  const catSaludMental = await prisma.category.findUnique({ where: { slug: 'salud-mental' }});
  const catPsicologia = await prisma.category.findUnique({ where: { slug: 'psicologia' }});

  const pro = await prisma.professional.upsert({
    where: { email: 'pro@test.com' },
    update: { 
      isApproved: true, 
      declaredJobTitle: 'Psicólogo Clínico Especialista',
      categories: { connect: [{ id: catSaludMental.id }, { id: catPsicologia.id }] }
    },
    create: {
      email: 'pro@test.com',
      name: 'Dr. Test House',
      slug: 'dr-test-house', // Asegúrate de tener este campo para URLs limpias
      declaredJobTitle: 'Psicólogo Clínico Especialista',
      passwordHash: hashedPassword,
      isApproved: true,
      emailVerified: true,
      bio: 'Especialista en intervención clínica y psicopatología moderna.',
      categories: { connect: [{ id: catSaludMental.id }, { id: catPsicologia.id }] },
      
      // --- NUEVO: Inserción de Servicios ---
      services: {
        create: [
          {
            name: 'Terapia Individual Adultos',
            description: 'Sesión focalizada en procesos de ansiedad y depresión.',
            price: 50.00,
            slug: 'terapia-individual-adultos',
          },
          {
            name: 'Evaluación Psicotécnica',
            description: 'Informes detallados para instituciones laborales o legales.',
            price: 75.00,
            slug: 'evaluacion-psicotecnica',
          }
        ]
      },

      // --- NUEVO: Inserción de Posts ---
      posts: {
        create: [
          {
            title: 'Entendiendo la transferencia en la clínica',
            content: 'El concepto de transferencia es fundamental para el proceso terapéutico...',
            slug: 'entendiendo-la-transferencia',
            status: 'PUBLISHED', // Asegúrate de que tu modelo use estos strings o Enums
            type: 'ARTICLE',
            publishedAt: new Date(),
          },
          {
            title: 'Mitos comunes sobre la salud mental',
            content: 'A menudo se piensa que ir a terapia es solo para crisis graves...',
            slug: 'mitos-salud-mental',
            status: 'PUBLISHED',
            type: 'ARTICLE',
            publishedAt: new Date(),
          }
        ]
      }
    },
  });

  console.log('✅ Profesional, Servicios y Posts creados para:', pro.email);

  // 4. HORARIOS (Limpieza y recreación)
  await prisma.availability.deleteMany({ where: { professionalId: pro.id } });
  const dias = [1, 2, 3, 4, 5]; 
  await prisma.availability.createMany({
    data: dias.map(day => ({
      professionalId: pro.id,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '17:00',
      isActive: true
    }))
  });

  console.log('🚀 Seed completado exitosamente.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });