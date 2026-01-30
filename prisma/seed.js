const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos (Seeding)...');
  const hashedPassword = await bcrypt.hash('Password123!', 12);

  // 1. CATEGORÍAS
  const catSaludMental = await prisma.category.upsert({
    where: { slug: 'salud-mental' },
    update: {},
    create: { name: 'Salud Mental', slug: 'salud-mental', icon: 'brain' }
  });

  const catPsicologia = await prisma.category.upsert({
    where: { slug: 'psicologia' },
    update: { parentId: catSaludMental.id },
    create: { name: 'Psicología', slug: 'psicologia', parentId: catSaludMental.id }
  });

  // 2. PROFESIONAL
  // Nota: He incluido 'slug' porque lo agregamos al schema en el paso anterior
  const pro = await prisma.professional.upsert({
    where: { email: 'pro@test.com' },
    update: { 
      isApproved: true, 
      declaredJobTitle: 'Psicólogo Clínico Especialista',
      slug: 'dr-test-house',
      categories: { connect: [{ id: catSaludMental.id }, { id: catPsicologia.id }] }
    },
    create: {
      email: 'pro@test.com',
      name: 'Dr. Test House',
      slug: 'dr-test-house',
      declaredJobTitle: 'Psicólogo Clínico Especialista',
      passwordHash: hashedPassword,
      isApproved: true,
      emailVerified: true,
      bio: 'Especialista en intervención clínica y psicopatología moderna.',
      categories: { connect: [{ id: catSaludMental.id }, { id: catPsicologia.id }] },
      
      // 3. SERVICIOS (Corregido: 'title' en lugar de 'name')
      services: {
        create: [
          {
            title: 'Terapia Individual Adultos', // <--- CAMBIO AQUÍ
            description: 'Sesión focalizada en procesos de ansiedad y depresión.',
            price: 50.00,
            slug: 'terapia-individual-adultos'
          },
          {
            title: 'Evaluación Psicotécnica', // <--- CAMBIO AQUÍ
            description: 'Informes detallados para instituciones laborales o legales.',
            price: 75.00,
            slug: 'evaluacion-psicotecnica'
          }
        ]
      },

      // 4. POSTS (Usando Enums y nombres de campos correctos)
      posts: {
        create: [
          {
            title: 'Entendiendo la transferencia en la clínica',
            content: 'El concepto de transferencia es fundamental para el proceso terapéutico...',
            slug: 'entendiendo-la-transferencia',
            status: 'PUBLISHED',
            postType: 'ARTICLE',
          }
        ]
      }
    },
  });

  console.log('✅ Profesional y Servicios vinculados correctamente.');

  // 5. DISPONIBILIDAD
  await prisma.availability.deleteMany({ where: { professionalId: pro.id } });
  await prisma.availability.createMany({
    data: [1, 2, 3, 4, 5].map(day => ({
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