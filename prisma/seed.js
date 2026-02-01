const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos (Seeding)...');

  // Contraseñas hasheadas (una para admin, otra para pro)
  const passwordAdmin = await bcrypt.hash('Admin123!', 10);
  const passwordPro = await bcrypt.hash('Password123!', 10);

  // --------------------------------------------------------
  // 1. CREAR EL ADMINISTRADOR
  // --------------------------------------------------------
  console.log('👤 Creando/Verificando Administrador...');
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@saludmental.com' },
    update: {}, // Si existe, no hace nada
    create: {
      email: 'admin@saludmental.com',
      name: 'Super Admin',
      password: passwordAdmin,
      role: 'ADMIN', // ⚠️ Asegúrate de que tu modelo User tenga este campo
      phone: '000000000',
    },
  });
  console.log(`   Admin listo: ${admin.email}`);

  // --------------------------------------------------------
  // 2. CATEGORÍAS
  // --------------------------------------------------------
  console.log('📂 Verificando Categorías...');
  
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

  // --------------------------------------------------------
  // 3. PROFESIONAL DE PRUEBA
  // --------------------------------------------------------
  console.log('dOC Creando Profesional de prueba...');

  const pro = await prisma.professional.upsert({
    where: { email: 'pro@test.com' },
    update: { 
      // Actualizamos datos clave si ya existe
      isApproved: true, 
      slug: 'dr-test-house',
      // categories: { connect: ... } // A veces connect duplicado da error en update, mejor dejarlo en create o manejarlo aparte
    },
    create: {
      email: 'pro@test.com',
      name: 'Dr. Test House',
      slug: 'dr-test-house',
      specialty: 'Psicólogo Clínico', // Campo requerido según tu lógica anterior
      // declaredJobTitle: 'Psicólogo Clínico Especialista', // (Opcional si está en tu schema)
      
      password: passwordPro, // <--- CORREGIDO: Usamos 'password' para coincidir con tu schema actual
      
      isApproved: true,
      emailVerified: true,
      bio: 'Especialista en intervención clínica y psicopatología moderna.',
      
      // Conectar categorías
      categories: { 
        connect: [{ id: catSaludMental.id }, { id: catPsicologia.id }] 
      },
      
      // Crear Servicios Iniciales
      services: {
        create: [
          {
            title: 'Terapia Individual Adultos',
            description: 'Sesión focalizada en procesos de ansiedad y depresión.',
            price: 50.00,
            duration: 60, // Agregué duración por si acaso
            slug: 'terapia-individual-adultos'
          },
          {
            title: 'Evaluación Psicotécnica',
            description: 'Informes detallados para instituciones laborales o legales.',
            price: 75.00,
            duration: 90,
            slug: 'evaluacion-psicotecnica'
          }
        ]
      },

      // Crear Posts Iniciales
      posts: {
        create: [
          {
            title: 'Entendiendo la transferencia en la clínica',
            content: 'El concepto de transferencia es fundamental para el proceso terapéutico...',
            slug: 'entendiendo-la-transferencia',
            status: 'PUBLISHED',
            // postType: 'ARTICLE', // Descomenta si tienes este campo en tu schema
          }
        ]
      }
    },
  });

  console.log(`   Profesional listo: ${pro.email}`);

  // --------------------------------------------------------
  // 4. DISPONIBILIDAD (Agenda)
  // --------------------------------------------------------
  console.log('📅 Configurando Agenda...');

  // Limpiamos horarios viejos para evitar duplicados al re-ejecutar seed
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